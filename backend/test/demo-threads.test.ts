import assert from "node:assert/strict";
import test from "node:test";
import { seedDemoThreads } from "../src/companies/demo-threads";
import { seedAltamira } from "../src/companies/seed";
import { db, exclusive, resetDb, testKey } from "./db";

test("development seed inserts five sample threads only into an empty database", async () => {
  await exclusive(async () => {
    await resetDb();
    await seedAltamira(db, testKey(), { email: "operador@example.com", supabaseUserId: "fake-user" });
    assert.equal(await seedDemoThreads(db), 5);
    assert.equal(await seedDemoThreads(db), 0);

    const company = await db.company.findFirstOrThrow();
    const threads = await db.thread.findMany({ where: { companyId: company.id } });
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

    const handoffMessages = await db.message.findMany({
      where: { threadId: handoff!.id },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(handoffMessages.length, 4);
    assert.match(handoffMessages.at(-1)?.body ?? "", /asesor/);
    assert.equal(await db.message.count({ where: { threadId: qualify!.id } }), 2);
  });
});
