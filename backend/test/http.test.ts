import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import { burstsFor, createApp } from "../src/app";
import { seedAltamira } from "../src/companies/seed";
import { loadEnv } from "../src/env";
import { FakeChannel } from "../src/integrations/channel";
import { FakeCrm } from "../src/integrations/crm/types";
import { signBody } from "../src/integrations/whatsapp/signature";
import { complete } from "../src/llm/complete";
import { acceptFormLead } from "../src/services/form-lead.service";
import { db, exclusive, resetDb, testKey } from "./db";

async function start() {
  await resetDb();
  const key = testKey();
  await seedAltamira(db, key, { email: "operador@example.com", supabaseUserId: "fake-user" });
  const env = loadEnv({
    NODE_ENV: "test",
    AUTH_MODE: "fake",
    META_APP_SECRET: "dev-meta-app-secret",
    META_WEBHOOK_VERIFY_TOKEN: "dev-verify-token",
    BACKOFFICE_ORIGIN: "http://localhost:3000",
    BURST_WAIT_MS: "3000",
    SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
  });
  const channel = new FakeChannel();
  const crm = new FakeCrm();
  const processor = { db, key, channel, crm, complete, model: "claude-haiku-4-5" };
  const bursts = burstsFor(processor, 60_000);
  const app = createApp({ ...processor, env, bursts });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  return { server, port, channel, bursts };
}

test("webhook rejects a bad signature and accepts a signed greeting", async () => {
  await exclusive(async () => {
    const { server, port, channel, bursts } = await start();
    try {
      const bad = await fetch(`http://127.0.0.1:${port}/webhooks/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=nope" },
        body: "{}",
      });
      assert.equal(bad.status, 401);

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: "FAKE_PHONE_NUMBER_ID" },
                  messages: [{ from: "59899123456", id: "wamid.http", type: "text", text: { body: "hola" } }],
                },
              },
            ],
          },
        ],
      };
      const raw = Buffer.from(JSON.stringify(payload));
      const ok = await fetch(`http://127.0.0.1:${port}/webhooks/whatsapp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signBody(raw, "dev-meta-app-secret"),
        },
        body: raw,
      });
      assert.equal(ok.status, 200);
      await waitFor(async () => (await db.thread.findFirst({ where: { phone: "+59899123456" } })) != null);
      await bursts.flush();
      assert.equal(channel.sent.length, 1);

      const verify = await fetch(
        `http://127.0.0.1:${port}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=dev-verify-token&hub.challenge=abc`,
      );
      assert.equal(await verify.text(), "abc");
    } finally {
      server.close();
    }
  });
});

test("internal routes require the operator and stay inside the company", async () => {
  await exclusive(async () => {
    const { server, port } = await start();
    try {
      const denied = await fetch(`http://127.0.0.1:${port}/internal/threads`);
      assert.equal(denied.status, 401);
      const headers = { Authorization: "Bearer fake:operador@example.com" };
      const list = await fetch(`http://127.0.0.1:${port}/internal/threads`, { headers });
      assert.equal(list.status, 200);
      const sync = await fetch(`http://127.0.0.1:${port}/internal/knowledge/sync`, { method: "POST", headers });
      assert.equal(sync.status, 200);
      const body = (await sync.json()) as { upserted: number };
      assert.equal(body.upserted, 2);
      const projects = await db.project.findMany({ orderBy: { name: "asc" } });
      assert.equal(projects.length, 2);
      assert.match(projects[0].name, /fixture/i);
    } finally {
      server.close();
    }
  });
});

test("form lead sends one template and starts in Qualify", async () => {
  await exclusive(async () => {
    await resetDb();
    const key = testKey();
    await seedAltamira(db, key, { email: "operador@example.com", supabaseUserId: "fake-user" });
    const channel = new FakeChannel();
    const deps = { db, key, channel };
    const first = await acceptFormLead(deps, { secret: "dev-form-secret", phone: "+59899111000", email: "a@b.co" });
    const second = await acceptFormLead(deps, { secret: "dev-form-secret", phone: "+59899111000" });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(channel.sent.length, 1);
    assert.equal(channel.sent[0].kind, "template");
    const thread = await db.thread.findFirst({ where: { phone: "+59899111000" } });
    assert.equal(thread?.state, "Qualify");
    assert.equal(thread?.email, "a@b.co");
    const rejected = await acceptFormLead(deps, { secret: "nope", phone: "+59899111001" });
    assert.equal(rejected.ok, false);
  });
});

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("timed out");
}
