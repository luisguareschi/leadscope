import assert from "node:assert/strict";
import test from "node:test";
import { BurstQueue } from "../src/conversation/burst";
import { decodeEncryptionKey, decryptSecrets, encryptSecrets, safeEqual } from "../src/crypto/secrets";
import { htmlToText } from "../src/integrations/knowledge/website";
import { signBody, verifyMetaSignature } from "../src/integrations/whatsapp/signature";
import { parseInbound } from "../src/integrations/whatsapp/parse";
import { toE164 } from "../src/phone";
import { withinSessionWindow } from "../src/session-window";
import { buildSystemPrompt } from "../src/engine/prompt";
import { altamiraConfig } from "../src/companies/altamira";

test("secrets round-trip and reject tampering", () => {
  const key = decodeEncryptionKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
  const payload = encryptSecrets(
    {
      anthropicApiKey: "sk-test",
      hubspotAccessToken: "pat-test",
      metaAccessToken: "meta-test",
      googleAccessJson: "",
      formLeadSecret: "form-secret",
    },
    key,
  );
  const back = decryptSecrets(payload, key);
  assert.equal(back.anthropicApiKey, "sk-test");
  assert.equal(back.formLeadSecret, "form-secret");
  assert.throws(() => decryptSecrets(`${payload.slice(0, -2)}aa`, key));
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
});

test("webhook signature and parser", () => {
  const body = Buffer.from(JSON.stringify({ hello: true }));
  const secret = "dev-meta-app-secret";
  assert.equal(verifyMetaSignature(body, signBody(body, secret), secret), true);
  assert.equal(verifyMetaSignature(body, "sha256=nope", secret), false);

  const parsed = parseInbound({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "FAKE_PHONE_NUMBER_ID" },
              messages: [
                { from: "59899111222", id: "wamid.1", type: "text", text: { body: "hola" } },
                { from: "59899111222", id: "wamid.2", type: "sticker" },
              ],
              statuses: [{ id: "wamid.1", status: "delivered" }],
            },
          },
        ],
      },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, "hola");
  assert.equal(parsed[1].contentType, "sticker");
  assert.equal(parsed[1].text, null);
});

test("phone and session window", () => {
  assert.equal(toE164("+598 99 111 222"), "+59899111222");
  assert.equal(toE164("123"), null);
  const now = new Date("2026-10-06T12:00:00Z");
  assert.equal(withinSessionWindow(new Date("2026-10-05T12:00:00Z"), now), true);
  assert.equal(withinSessionWindow(new Date("2026-10-05T11:59:00Z"), now), false);
  assert.equal(withinSessionWindow(null, now), false);
});

test("html is stripped to text", () => {
  assert.equal(htmlToText("<style>x</style><p>Rambla &amp; amenities</p>"), "Rambla & amenities");
});

test("system prompt includes the uploaded file text", () => {
  const prompt = buildSystemPrompt(altamiraConfig(), [
    { filename: "ficha.txt", text: "Precio desde: USD 120.000" },
  ]);
  assert.match(prompt, /ficha\.txt/);
  assert.match(prompt, /USD 120\.000/);
  assert.match(prompt, /Uploaded files win/i);
  assert.doesNotMatch(prompt, /if \(company/);
});

test("a burst of pushes runs once", async () => {
  let runs = 0;
  const queue = new BurstQueue(30, async () => {
    runs += 1;
  });
  queue.push("thread-1");
  queue.push("thread-1");
  await queue.flush();
  assert.equal(runs, 1);
});
