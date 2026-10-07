import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { readCompany } from "../companies/load";
import { Env } from "../env";
import { log } from "../logger";
import { AuthedRequest } from "../routes/auth";
import { knowledgeStatus, syncKnowledge } from "../services/knowledge.service";

export function knowledgeRouter(db: PrismaClient, env: Env, key: Buffer | null) {
  const router = Router();

  router.get("/", async (req: AuthedRequest, res) => {
    res.json(await knowledgeStatus(db, req.operator!.companyId));
  });

  router.post("/sync", async (req: AuthedRequest, res) => {
    const row = await db.company.findUnique({ where: { id: req.operator!.companyId } });
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const company = readCompany(row, key);
    try {
      const result = await syncKnowledge(db, company, env.GOOGLE_SERVICE_ACCOUNT_JSON, req.body?.siteNotes === true);
      res.json(result);
    } catch (err) {
      log.error({ err, companyId: company.id }, "manual knowledge sync failed");
      res.status(502).json({ error: "sync failed" });
    }
  });

  return router;
}
