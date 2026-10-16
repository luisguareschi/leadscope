import { describe, expect, it, vi } from "vitest";
import { ChannelError } from "../../src/integrations/whatsapp/channel.js";
import { createKapsoChannel } from "../../src/integrations/whatsapp/kapso/kapso-channel.js";
import { checkKapsoConnection } from "../../src/integrations/whatsapp/kapso/kapso-connection.js";
import {
  isValidKapsoSignature,
  signKapsoWebhook,
} from "../../src/integrations/whatsapp/kapso/kapso-signature.js";
import { parseKapsoWebhook } from "../../src/integrations/whatsapp/kapso/kapso-webhook.js";

const RECEIVED = "whatsapp.message.received";

/** Shapes copied from https://docs.kapso.ai/docs/platform/webhooks/message-events. */
const receivedEvent = (message: Record<string, unknown>) => ({
  message: {
    id: "wamid.123",
    timestamp: "1730092800",
    type: "text",
    from: "16315551181",
    text: { body: " Hello " },
    kapso: {
      direction: "inbound",
      status: "received",
      processing_status: "pending",
      origin: "cloud_api",
      has_media: false,
      content: "Hello",
    },
    ...message,
  },
  conversation: {
    id: "conv_123",
    contact_name: "John Doe",
    phone_number: "16315551181",
    phone_number_id: "123456789012345",
  },
  is_new_conversation: true,
  phone_number_id: "123456789012345",
});

describe("parseKapsoWebhook", () => {
  it("reads Kapso's documented message.received payload", () => {
    expect(parseKapsoWebhook(RECEIVED, receivedEvent({}))).toEqual({
      messages: [
        {
          phoneNumberId: "123456789012345",
          waMessageId: "wamid.123",
          from: "16315551181",
          profileName: "John Doe",
          type: "text",
          body: "Hello",
          sentAt: new Date(1730092800 * 1000),
        },
      ],
      statuses: [],
      withoutPhone: 0,
    });
  });

  it("reads the batch envelope, where the phone is only on the conversation", () => {
    const item = (id: string, body: string) => ({
      message: {
        id,
        timestamp: "1730092801",
        type: "text",
        text: { body },
        kapso: {
          direction: "inbound",
          origin: "cloud_api",
          phone_number: "+15551234567",
          phone_number_id: "123456789012345",
        },
      },
      conversation: {
        id: "conv_123",
        phone_number: "+15551234567",
        phone_number_id: "123456789012345",
      },
      phone_number_id: "123456789012345",
    });
    const { messages } = parseKapsoWebhook(undefined, {
      type: RECEIVED,
      batch: true,
      data: [item("wamid.111", "First"), item("wamid.112", "Second")],
      batch_info: { size: 2, window_ms: 5000 },
    });
    expect(
      messages.map(({ waMessageId, from, body }) => ({
        waMessageId,
        from,
        body,
      })),
    ).toEqual([
      { waMessageId: "wamid.111", from: "15551234567", body: "First" },
      { waMessageId: "wamid.112", from: "15551234567", body: "Second" },
    ]);
  });

  it("treats button and list replies as text, keeps captions, and ignores reactions", () => {
    const types = [
      { type: "button", button: { text: "Quiero info" } },
      {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "b", title: "2 dormitorios" },
        },
      },
      { type: "image", image: { caption: "¿Cuánto sale?", id: "m" } },
      { type: "audio", audio: { id: "media" } },
      { type: "reaction", reaction: { emoji: "👍" } },
    ].map((message, index) =>
      receivedEvent({ ...message, id: `wamid.${index}`, text: undefined }),
    );
    const parsed = types.flatMap(
      (event) => parseKapsoWebhook(RECEIVED, event).messages,
    );
    expect(parsed.map(({ type, body }) => ({ type, body }))).toEqual([
      { type: "text", body: "Quiero info" },
      { type: "text", body: "2 dormitorios" },
      { type: "image", body: "¿Cuánto sale?" },
      { type: "audio", body: "" },
    ]);
  });

  it("skips history sync, outbound echoes, passive messages, and BSUID-only senders", () => {
    const skipped = [
      receivedEvent({
        kapso: { direction: "inbound", origin: "history_sync" },
      }),
      receivedEvent({
        kapso: { direction: "outbound", origin: "business_app" },
      }),
      receivedEvent({ kapso: { direction: "inbound", passive: true } }),
    ];
    for (const event of skipped)
      expect(parseKapsoWebhook(RECEIVED, event).messages).toEqual([]);

    const bsuid = receivedEvent({
      from: undefined,
      from_user_id: "US.13491208655302741918",
    });
    bsuid.conversation.phone_number = undefined as unknown as string;
    expect(parseKapsoWebhook(RECEIVED, bsuid)).toMatchObject({
      messages: [],
      withoutPhone: 1,
    });
  });

  it("maps status events to receipts and ignores other events and junk", () => {
    const outbound = {
      message: {
        id: "wamid.456",
        type: "text",
        to: "15551234567",
        kapso: { direction: "outbound", status: "delivered" },
      },
      conversation: { phone_number_id: "123456789012345" },
      phone_number_id: "123456789012345",
    };
    expect(
      parseKapsoWebhook("whatsapp.message.delivered", outbound).statuses,
    ).toEqual([
      {
        phoneNumberId: "123456789012345",
        waMessageId: "wamid.456",
        status: "delivered",
      },
    ]);
    expect(
      parseKapsoWebhook("whatsapp.message.failed", outbound).statuses,
    ).toMatchObject([{ status: "failed" }]);
    expect(
      parseKapsoWebhook("whatsapp.conversation.created", outbound),
    ).toEqual({ messages: [], statuses: [], withoutPhone: 0 });
    expect(parseKapsoWebhook(RECEIVED, "nonsense")).toEqual({
      messages: [],
      statuses: [],
      withoutPhone: 0,
    });
    expect(parseKapsoWebhook(RECEIVED, { message: { nope: 1 } })).toEqual({
      messages: [],
      statuses: [],
      withoutPhone: 0,
    });
  });
});

describe("Kapso webhook signature", () => {
  it("is the hex HMAC-SHA256 of the raw body, with no prefix", () => {
    // echo -n '{"a":1}' | openssl dgst -sha256 -hmac secret
    expect(signKapsoWebhook('{"a":1}', "secret")).toBe(
      "aa9e2e3575f5d7098b6caccd790888c36d5fdb63342a73bada2d6a51747a8494",
    );
  });

  it("accepts the right signature and rejects anything else", () => {
    const body = Buffer.from('{"message":{"id":"wamid.1"}}');
    const header = signKapsoWebhook(body, "secret");
    expect(isValidKapsoSignature(body, header, "secret")).toBe(true);
    expect(isValidKapsoSignature(body, header, "other")).toBe(false);
    expect(
      isValidKapsoSignature(
        Buffer.from('{"message":{"id":"wamid.2"}}'),
        header,
        "secret",
      ),
    ).toBe(false);
    expect(isValidKapsoSignature(body, undefined, "secret")).toBe(false);
    expect(isValidKapsoSignature(body, "", "secret")).toBe(false);
    expect(isValidKapsoSignature(body, "short", "secret")).toBe(false);
    expect(isValidKapsoSignature(body, `sha256=${header}`, "secret")).toBe(
      false,
    );
  });
});

function mockFetch(
  respond: (url: string, init: RequestInit) => Response = () =>
    Response.json({
      messaging_product: "whatsapp",
      contacts: [{ input: "59899111222", wa_id: "59899111222" }],
      messages: [{ id: "wamid.out" }],
    }),
) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) =>
    respond(String(url), init ?? {}),
  );
}

const callOf = (fetchImpl: ReturnType<typeof mockFetch>, index = 0) => {
  const [url, init] = fetchImpl.mock.calls[index] as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(String(init.body)) as Record<string, unknown>,
  };
};

describe("Kapso channel", () => {
  const channelWith = (fetchImpl: ReturnType<typeof mockFetch>) =>
    createKapsoChannel({
      apiKey: "kapso-key",
      phoneNumberId: "647015955153740",
      fetchImpl,
    });

  it("sends text to Kapso's WhatsApp API with the project key", async () => {
    const fetchImpl = mockFetch();
    await expect(
      channelWith(fetchImpl).sendText({ to: "59899111222", body: "Hola" }),
    ).resolves.toEqual({ waMessageId: "wamid.out" });
    expect(callOf(fetchImpl)).toEqual({
      url: "https://api.kapso.ai/meta/whatsapp/v24.0/647015955153740/messages",
      method: "POST",
      headers: {
        "X-API-Key": "kapso-key",
        "Content-Type": "application/json",
      },
      body: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "59899111222",
        type: "text",
        text: { preview_url: false, body: "Hola" },
      },
    });
  });

  it("sends the welcome template by name and language", async () => {
    const fetchImpl = mockFetch();
    await channelWith(fetchImpl).sendTemplate({
      to: "59899111222",
      name: "bienvenida_formulario",
      language: "es",
    });
    expect(callOf(fetchImpl).body).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "59899111222",
      type: "template",
      template: { name: "bienvenida_formulario", language: { code: "es" } },
    });
  });

  it("marks as read with the typing indicator and never fails a turn for it", async () => {
    const fetchImpl = mockFetch(() => Response.json({}, { status: 500 }));
    await expect(
      channelWith(fetchImpl).markReadWithTyping("wamid.in"),
    ).resolves.toBeUndefined();
    expect(callOf(fetchImpl).body).toEqual({
      messaging_product: "whatsapp",
      status: "read",
      message_id: "wamid.in",
      typing_indicator: { type: "text" },
    });
  });

  it("raises Meta-style errors with their code", async () => {
    const fetchImpl = mockFetch(() =>
      Response.json(
        {
          error: {
            message:
              "Cannot send non-template messages outside the 24-hour window.",
            type: "MessageError",
            code: 131047,
          },
        },
        { status: 422 },
      ),
    );
    const error = await channelWith(fetchImpl)
      .sendText({ to: "1", body: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error).toMatchObject({
      message: "Cannot send non-template messages outside the 24-hour window.",
      code: 131047,
      status: 422,
    });
  });

  it("raises Kapso's own errors (plain string and string code)", async () => {
    const fetchImpl = mockFetch(() =>
      Response.json(
        {
          error:
            "Your Kapso balance doesn't cover Meta's fee for this message.",
          code: "insufficient_credits",
        },
        { status: 402 },
      ),
    );
    const error = await channelWith(fetchImpl)
      .sendTemplate({ to: "1", name: "bienvenida", language: "es" })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      message: "Your Kapso balance doesn't cover Meta's fee for this message.",
      code: "insufficient_credits",
      status: 402,
    });
  });

  it("fails when Kapso accepts but returns no message id", async () => {
    const fetchImpl = mockFetch(() => Response.json({ messages: [] }));
    await expect(
      channelWith(fetchImpl).sendText({ to: "1", body: "x" }),
    ).rejects.toThrow("no message id");
  });
});

describe("Kapso connection check", () => {
  const WEBHOOK_PATH = "/webhooks/kapso/altamira";
  const healthy = {
    status: "healthy",
    timestamp: "2026-10-16T12:00:00Z",
    checks: {
      phone_number_access: {
        passed: true,
        details: {
          verified_name: "Altamira",
          display_phone_number: "+598 99 000 000",
        },
      },
      phone_number_connection: {
        passed: true,
        details: { status: "CONNECTED" },
      },
    },
  };
  const webhook = (overrides: Record<string, unknown> = {}) => ({
    id: "9e8d7c6b-5a4f-3e2d-1c0b-9a8f7e6d5c4b",
    url: `https://api.leadscope.test${WEBHOOK_PATH}`,
    kind: "kapso",
    events: [
      "whatsapp.message.received",
      "whatsapp.message.sent",
      "whatsapp.message.delivered",
      "whatsapp.message.read",
      "whatsapp.message.failed",
    ],
    active: true,
    secret_key: "hook-secret",
    payload_version: "v2",
    ...overrides,
  });
  const fetchWith = (
    hooks: unknown[],
    health: unknown = healthy,
    status = 200,
  ) =>
    mockFetch((url) =>
      url.includes("/health")
        ? Response.json(health, { status })
        : Response.json({ data: hooks }, { status }),
    );
  const run = (
    fetchImpl: ReturnType<typeof mockFetch>,
    secret = "hook-secret",
  ) =>
    checkKapsoConnection(
      { apiKey: "kapso-key", fetchImpl },
      {
        phoneNumberId: "647015955153740",
        webhookPath: WEBHOOK_PATH,
        webhookSecret: secret,
      },
    );

  it("calls Kapso's health and webhook-list endpoints with the project key", async () => {
    const fetchImpl = fetchWith([webhook()]);
    const checks = await run(fetchImpl);
    const urls = fetchImpl.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual([
      "https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/647015955153740/health",
      `https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/647015955153740/webhooks?url_contains=${encodeURIComponent(WEBHOOK_PATH)}&per_page=50`,
    ]);
    for (const [, init] of fetchImpl.mock.calls)
      expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe(
        "kapso-key",
      );
    expect(checks.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "number", status: "ok" },
      { id: "webhook", status: "ok" },
    ]);
    expect(checks[0]!.detail).toContain("+598 99 000 000");
  });

  it("explains a rejected key, a missing webhook, and a mismatched secret", async () => {
    const unauthorized = await run(
      fetchWith([], { error: "Invalid API key" }, 401),
    );
    expect(unauthorized.map((check) => check.status)).toEqual([
      "error",
      "error",
    ]);
    expect(unauthorized[0]!.detail).toContain("rechazó la clave");

    const none = await run(fetchWith([]));
    expect(none[1]).toMatchObject({ status: "error" });
    expect(none[1]!.detail).toContain("whatsapp.message.received");

    const meta = await run(fetchWith([webhook({ kind: "meta", events: [] })]));
    expect(meta[1]!.detail).toContain("tipo Meta");

    const paused = await run(fetchWith([webhook({ active: false })]));
    expect(paused[1]!.detail).toContain("pausado");

    const wrongSecret = await run(fetchWith([webhook()]), "other");
    expect(wrongSecret[1]!.detail).toContain("no coincide");
  });

  it("warns when the number is degraded or the webhook misses status events", async () => {
    const checks = await run(
      fetchWith([webhook({ events: ["whatsapp.message.received"] })], {
        status: "degraded",
        checks: { webhook_verified: { passed: false } },
      }),
    );
    expect(checks.map((check) => check.status)).toEqual(["warning", "warning"]);
    expect(checks[0]!.detail).toContain("verificación de Meta");
    expect(checks[1]!.detail).toContain("whatsapp.message.delivered");
  });
});
