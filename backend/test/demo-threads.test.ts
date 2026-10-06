import assert from "node:assert/strict";
import test from "node:test";
import { seedDemoThreads } from "../src/companies/demo-threads";
import { seedAltamira } from "../src/companies/seed";
import { MemoryStore } from "../src/store/memory";

test("in-memory demo threads cover the panel and do not duplicate", async () => {
  const store = new MemoryStore();
  await seedAltamira(store, { email: "operador@example.com", supabaseUserId: "fake-user" });
  assert.equal(await seedDemoThreads(store), 5);
  assert.equal(await seedDemoThreads(store), 0);

  const company = (await store.listCompanies())[0];
  const threads = await store.listThreads(company.id);
  assert.equal(threads.length, 5);

  const byPhone = new Map(threads.map((thread) => [thread.phone, thread]));
  const qualify = byPhone.get("+59899000001");
  const answer = byPhone.get("+59899000002");
  const handoff = byPhone.get("+59899000003");
  const paused = byPhone.get("+59899000004");
  const needsHuman = byPhone.get("+59899000005");

  assert.equal(qualify?.state, "Qualify");
  assert.equal(qualify?.budget, null);
  assert.equal(answer?.state, "Answer");
  assert.equal(answer?.knowsProjects, false);
  assert.equal(handoff?.state, "Handoff");
  assert.equal(handoff?.callTime, "mañana a las 10");
  assert.equal(paused?.paused, true);
  assert.equal(needsHuman?.needsHuman, true);

  const handoffMessages = await store.listMessages(company.id, handoff!.id);
  assert.equal(handoffMessages.length, 4);
  assert.match(handoffMessages.at(-1)?.body ?? "", /asesor/);
  assert.equal((await store.listMessages(company.id, qualify!.id)).length, 2);
});
