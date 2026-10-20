import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { createCompany, resetDb, testDb } from "../support/harness.js";

const db = testDb();
const MIGRATION = readFileSync(
  new URL(
    "../../prisma/migrations/20261021090000_lead_stage_and_assignment/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
/** The part that moves existing threads; the columns already exist in the test database. */
const DATA_STEP = MIGRATION.slice(MIGRATION.indexOf("-- Existing threads"));

class Rollback extends Error {}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Seeds threads, runs the data step, and reads the result, all in one rolled-back transaction. */
async function migratedRows(seed: (tx: Tx) => Promise<void>) {
  let rows: Array<Record<string, unknown>> = [];
  await db
    .$transaction(async (tx) => {
      await seed(tx);
      for (const statement of DATA_STEP.split(";").map((part) => part.trim()))
        if (statement) await tx.$executeRawUnsafe(statement);
      rows = await tx.$queryRawUnsafe(
        'SELECT "phone", "stage"::text AS "stage", "handedOffAt" FROM "Thread" ORDER BY "phone"',
      );
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
  return rows;
}

describe("the lead stage migration", () => {
  let companyId: string;
  const qualified = {
    interest: "2 dormitorios",
    budget: "USD 150.000",
    knowsProjects: "No",
  };
  const synced = new Date("2026-10-15T12:00:00Z");
  const lastInbound = new Date("2026-10-16T09:30:00Z");

  beforeEach(async () => {
    await resetDb();
    companyId = (await createCompany(db, { slug: "altamira" })).id;
  });

  it("puts handoff threads and reopened handed-off threads in Por contactar, closed in Sin interés", async () => {
    const rows = await migratedRows(async (tx) => {
      const thread = (phone: string, data: Record<string, unknown>) =>
        tx.thread.create({
          data: { companyId, phone, waId: phone.slice(1), ...data },
        });
      // Asking for the call time: handed off by the old rule, no CRM write yet.
      await thread("+59899000001", {
        state: "handoff",
        collected: qualified,
        lastInboundAt: lastInbound,
      });
      // Handed off with a call time, then the lead asked more: the "Respondiendo" bug.
      await thread("+59899000002", {
        state: "answer",
        collected: qualified,
        callTime: "Mañana a las 10",
        crmSyncedAt: synced,
        lastInboundAt: lastInbound,
      });
      // A call time but a required item missing: never handed off.
      await thread("+59899000003", {
        state: "answer",
        collected: { interest: "x" },
        callTime: "Mañana",
      });
      await thread("+59899000004", { state: "closed" });
      await thread("+59899000005", { state: "qualify", collected: qualified });
      await thread("+59899000006", { state: "greeting" });
      // Paused or waiting for a person: the bot flags do not change the stage.
      await thread("+59899000007", {
        state: "handoff",
        paused: true,
        needsHuman: true,
        lastInboundAt: lastInbound,
      });
    });
    expect(rows).toEqual([
      {
        phone: "+59899000001",
        stage: "to_contact",
        handedOffAt: lastInbound,
      },
      { phone: "+59899000002", stage: "to_contact", handedOffAt: synced },
      { phone: "+59899000003", stage: "qualifying", handedOffAt: null },
      { phone: "+59899000004", stage: "not_interested", handedOffAt: null },
      { phone: "+59899000005", stage: "qualifying", handedOffAt: null },
      { phone: "+59899000006", stage: "qualifying", handedOffAt: null },
      {
        phone: "+59899000007",
        stage: "to_contact",
        handedOffAt: lastInbound,
      },
    ]);
  });

  it("checks the required items against each company's own config", async () => {
    const zoneCo = await createCompany(db, {
      slug: "zona",
      config: {
        collect: [
          {
            key: "zone",
            name: "Zona",
            description: "Barrio.",
            required: true,
          },
          {
            key: "budget",
            name: "Presupuesto",
            description: "Monto.",
            required: false,
          },
        ],
      },
    });
    const rows = await migratedRows(async (tx) => {
      await tx.thread.create({
        data: {
          companyId: zoneCo.id,
          phone: "+59899000011",
          waId: "59899000011",
          state: "answer",
          callTime: "Hoy",
          collected: { zone: "Pocitos" },
        },
      });
      await tx.thread.create({
        data: {
          companyId: zoneCo.id,
          phone: "+59899000012",
          waId: "59899000012",
          state: "answer",
          callTime: "Hoy",
          collected: { budget: "USD 100.000" },
        },
      });
    });
    expect(rows.map((row) => row.stage)).toEqual(["to_contact", "qualifying"]);
  });
});
