import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { Env } from "./env";
import { BurstQueue } from "./conversation/burst";
import { acceptFormLead, processThread, recordInbound } from "./conversation/process";
import { ProcessorDeps } from "./conversation/process";
import { parseInbound } from "./integrations/whatsapp/parse";
import { verifyMetaSignature } from "./integrations/whatsapp/signature";
import { syncSheet, syncSiteNotes } from "./integrations/knowledge/sync";
import { log } from "./logger";
import { requireOperator, AuthedRequest } from "./routes/auth";
import { Store } from "./store/types";

export type AppDeps = ProcessorDeps & {
  env: Env;
  bursts: BurstQueue;
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(
    cors({
      origin: deps.env.BACKOFFICE_ORIGIN,
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use((req, res, next) => {
    res.on("finish", () => {
      const pathOnly = req.originalUrl.split("?")[0];
      log.info({ method: req.method, path: pathOnly, status: res.statusCode }, "request");
    });
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === deps.env.META_WEBHOOK_VERIFY_TOKEN && typeof challenge === "string") {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("forbidden");
  });

  app.post("/webhooks/whatsapp", (req, res) => {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    if (!verifyMetaSignature(raw, req.header("x-hub-signature-256"), deps.env.META_APP_SECRET)) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
    const messages = parseInbound(req.body);
    res.status(200).json({ ok: true });
    for (const message of messages) {
      void recordInbound(deps, message)
        .then((result) => {
          if (result.threadId && !result.duplicate) deps.bursts.push(result.threadId);
        })
        .catch((err) => {
          log.error({ err }, "inbound record failed");
        });
    }
  });

  const formSchema = z.object({
    phone: z.string().min(1),
    email: z.string().email().optional(),
    hubspotContactId: z.string().min(1).optional(),
  });

  app.post("/hooks/crm/form-lead", async (req, res) => {
    const parsed = formSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body" });
      return;
    }
    const result = await acceptFormLead(deps, {
      secret: req.header("x-form-lead-secret") ?? "",
      ...parsed.data,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json({ ok: true });
  });

  const auth = requireOperator(deps.store, deps.env);
  app.use("/internal", auth);

  app.get("/internal/threads", async (req: AuthedRequest, res) => {
    const threads = await deps.store.listThreads(req.operator!.companyId);
    res.json({ threads });
  });

  app.get("/internal/threads/:id", async (req: AuthedRequest, res) => {
    const thread = await deps.store.getThread(req.operator!.companyId, req.params.id);
    if (!thread) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const messages = await deps.store.listMessages(req.operator!.companyId, thread.id);
    res.json({ thread, messages });
  });

  app.post("/internal/threads/:id/pause", async (req: AuthedRequest, res) => {
    await setFlag(deps.store, req, res, { paused: true });
  });

  app.post("/internal/threads/:id/resume", async (req: AuthedRequest, res) => {
    await setFlag(deps.store, req, res, { paused: false });
  });

  app.post("/internal/threads/:id/clear-needs-human", async (req: AuthedRequest, res) => {
    await setFlag(deps.store, req, res, { needsHuman: false });
  });

  app.delete("/internal/threads/:id", async (req: AuthedRequest, res) => {
    const deleted = await deps.store.deleteThread(req.operator!.companyId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ ok: true });
  });

  app.get("/internal/knowledge", async (req: AuthedRequest, res) => {
    const projects = await deps.store.listProjects(req.operator!.companyId);
    const lastSyncedAt = projects.reduce<string | null>((latest, project) => {
      if (!project.syncedAt) return latest;
      if (!latest || project.syncedAt > latest) return project.syncedAt;
      return latest;
    }, null);
    res.json({ projectCount: projects.length, lastSyncedAt });
  });

  app.post("/internal/knowledge/sync", async (req: AuthedRequest, res) => {
    const company = await deps.store.getCompany(req.operator!.companyId);
    if (!company) {
      res.status(404).json({ error: "not found" });
      return;
    }
    try {
      const upserted = await syncSheet(company, deps.store, deps.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      const siteNotes = req.body?.siteNotes === true;
      const notes = siteNotes ? await syncSiteNotes(company, deps.store) : 0;
      const projects = await deps.store.listProjects(company.id);
      const lastSyncedAt = projects.reduce<string | null>((latest, project) => {
        if (!project.syncedAt) return latest;
        if (!latest || project.syncedAt > latest) return project.syncedAt;
        return latest;
      }, null);
      res.json({ upserted, siteNotes: notes, lastSyncedAt });
    } catch (err) {
      log.error({ err, companyId: company.id }, "manual knowledge sync failed");
      res.status(502).json({ error: "sync failed" });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error({ err }, "unhandled");
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

async function setFlag(
  store: Store,
  req: AuthedRequest,
  res: Response,
  patch: { paused?: boolean; needsHuman?: boolean },
): Promise<void> {
  const thread = await store.getThread(req.operator!.companyId, req.params.id);
  if (!thread) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const saved = await store.saveThread(req.operator!.companyId, thread.id, patch);
  res.json({ thread: saved });
}

export function burstsFor(deps: ProcessorDeps, delayMs: number): BurstQueue {
  return new BurstQueue(delayMs, (threadId) => processThread(deps, threadId));
}
