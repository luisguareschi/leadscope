import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { formLeadRouter } from "./controllers/form-lead.controller";
import { knowledgeRouter } from "./controllers/knowledge.controller";
import { threadsRouter } from "./controllers/threads.controller";
import { burstsFor, whatsappRouter } from "./controllers/whatsapp.controller";
import { BurstQueue } from "./conversation/burst";
import { Env } from "./env";
import { log } from "./logger";
import { requireOperator } from "./routes/auth";
import { WhatsAppDeps } from "./services/whatsapp.service";

export type AppDeps = WhatsAppDeps & {
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

  app.use("/webhooks/whatsapp", whatsappRouter(deps));
  app.use("/hooks/crm", formLeadRouter(deps));

  const auth = requireOperator(deps.db, deps.env);
  app.use("/internal/threads", auth, threadsRouter(deps.db));
  app.use("/internal/knowledge", auth, knowledgeRouter(deps.db, deps.env, deps.key));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log.error({ err }, "unhandled");
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

export { burstsFor };
