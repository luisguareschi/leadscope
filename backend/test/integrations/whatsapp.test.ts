import { describe, expect, it, vi } from "vitest";
import { createMetaChannel, ChannelError } from "../../src/integrations/whatsapp/channel.js";
import { isValidWebhookSignature, signWebhookBody } from "../../src/integrations/whatsapp/signature.js";
import { parseWebhookPayload } from "../../src/integrations/whatsapp/webhook-payload.js";

const change = (value: unknown) => ({ entry: [{ changes: [{ field: "messages", value }] }] });

describe("parseWebhookPayload", () => {
  it("reads text messages with the profile name and Meta's timestamp", () => {
    const { messages } = parseWebhookPayload(
      change({
        metadata: { phone_number_id: "PNID" },
        contacts: [{ wa_id: "59899111222", profile: { name: "Ana" } }],
        messages: [{ from: "59899111222", id: "wamid.1", timestamp: "1760000000", type: "text", text: { body: " Hola " } }],
      }),
    );
    expect(messages).toEqual([
      {
        phoneNumberId: "PNID",
        waMessageId: "wamid.1",
        from: "59899111222",
        profileName: "Ana",
        type: "text",
        body: "Hola",
        sentAt: new Date(1760000000 * 1000),
      },
    ]);
  });

  it("treats button and list replies as text, keeps captions, and ignores reactions", () => {
    const { messages } = parseWebhookPayload(
      change({
        metadata: { phone_number_id: "PNID" },
        messages: [
          { from: "1", id: "a", type: "button", button: { text: "Quiero info" } },
          { from: "1", id: "b", type: "interactive", interactive: { list_reply: { title: "2 dormitorios" } } },
          { from: "1", id: "c", type: "image", image: { caption: "¿Este cuánto sale?" } },
          { from: "1", id: "d", type: "audio", audio: { id: "media" } },
          { from: "1", id: "e", type: "reaction", reaction: { emoji: "👍" } },
        ],
      }),
    );
    expect(messages.map(({ type, body }) => ({ type, body }))).toEqual([
      { type: "text", body: "Quiero info" },
      { type: "text", body: "2 dormitorios" },
      { type: "image", body: "¿Este cuánto sale?" },
      { type: "audio", body: "" },
    ]);
  });

  it("reads delivery receipts and survives junk", () => {
    expect(
      parseWebhookPayload(change({ metadata: { phone_number_id: "P" }, statuses: [{ id: "wamid.9", status: "read" }] }))
        .statuses,
    ).toEqual([{ waMessageId: "wamid.9", status: "read" }]);
    expect(parseWebhookPayload("nonsense")).toEqual({ messages: [], statuses: [] });
    expect(parseWebhookPayload(change({ nope: true }))).toEqual({ messages: [], statuses: [] });
  });
});

describe("webhook signature", () => {
  it("accepts Meta's signature and rejects anything else", () => {
    const body = Buffer.from('{"a":1}');
    const header = signWebhookBody(body, "secret");
    expect(isValidWebhookSignature(body, header, "secret")).toBe(true);
    expect(isValidWebhookSignature(body, header, "other")).toBe(false);
    expect(isValidWebhookSignature(Buffer.from('{"a":2}'), header, "secret")).toBe(false);
    expect(isValidWebhookSignature(body, undefined, "secret")).toBe(false);
    expect(isValidWebhookSignature(body, "sha256=short", "secret")).toBe(false);
  });
});

describe("Meta channel", () => {
  it("sends text to the Graph API and returns the message id", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ messages: [{ id: "wamid.out" }] }));
    const channel = createMetaChannel({ phoneNumberId: "PNID", accessToken: "token", graphVersion: "v23.0", fetchImpl });
    await expect(channel.sendText({ to: "59899111222", body: "Hola" })).resolves.toEqual({ waMessageId: "wamid.out" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v23.0/PNID/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(JSON.parse(String(init.body))).toMatchObject({
      messaging_product: "whatsapp",
      to: "59899111222",
      type: "text",
      text: { body: "Hola", preview_url: false },
    });
  });

  it("raises Meta's error message and code", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: { message: "Re-engagement message", code: 131047 } }, { status: 400 }),
    );
    const channel = createMetaChannel({ phoneNumberId: "P", accessToken: "t", graphVersion: "v23.0", fetchImpl });
    const error = await channel.sendTemplate({ to: "1", name: "bienvenida", language: "es" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChannelError);
    expect(error).toMatchObject({ message: "Re-engagement message", code: 131047 });
  });

  it("never fails a turn because the read receipt failed", async () => {
    const fetchImpl = vi.fn(async () => Response.json({}, { status: 500 }));
    const channel = createMetaChannel({ phoneNumberId: "P", accessToken: "t", graphVersion: "v23.0", fetchImpl });
    await expect(channel.markReadWithTyping("wamid.1")).resolves.toBeUndefined();
  });
});
