import { Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthedRequest } from "../routes/auth";
import {
  clearNeedsHuman,
  deleteThread,
  getThreadDetail,
  listThreads,
  pauseThread,
  resumeThread,
} from "../services/threads.service";

export function threadsRouter(db: PrismaClient) {
  const router = Router();

  router.get("/", async (req: AuthedRequest, res) => {
    const threads = await listThreads(db, req.operator!.companyId);
    res.json({ threads });
  });

  router.get("/:id", async (req: AuthedRequest, res) => {
    const detail = await getThreadDetail(db, req.operator!.companyId, req.params.id);
    if (!detail) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(detail);
  });

  router.post("/:id/pause", async (req: AuthedRequest, res) => {
    await respond(db, req, res, pauseThread);
  });

  router.post("/:id/resume", async (req: AuthedRequest, res) => {
    await respond(db, req, res, resumeThread);
  });

  router.post("/:id/clear-needs-human", async (req: AuthedRequest, res) => {
    await respond(db, req, res, clearNeedsHuman);
  });

  router.delete("/:id", async (req: AuthedRequest, res) => {
    const deleted = await deleteThread(db, req.operator!.companyId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

async function respond(
  db: PrismaClient,
  req: AuthedRequest,
  res: Response,
  action: (db: PrismaClient, companyId: string, threadId: string) => Promise<{ id: string } | null>,
): Promise<void> {
  const thread = await action(db, req.operator!.companyId, req.params.id);
  if (!thread) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ thread });
}
