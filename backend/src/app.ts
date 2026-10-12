import cors from "cors";
import express, { type Express } from "express";
import type { AppContext } from "./context.js";
import { companiesRoutes } from "./features/companies/companies.routes.js";
import { formLeadsRoutes } from "./features/form-leads/form-leads.routes.js";
import { knowledgeRoutes } from "./features/knowledge/knowledge.routes.js";
import { meRoutes } from "./features/me/me.routes.js";
import { secretsRoutes } from "./features/secrets/secrets.routes.js";
import { threadsRoutes } from "./features/threads/threads.routes.js";
import { whatsappWebhookRoutes } from "./features/whatsapp-webhook/whatsapp-webhook.routes.js";
import { errorHandler } from "./http/error-handler.js";
import { requirePlatformAdmin } from "./http/platform-admin.js";
import { requireOperator, requireSession } from "./http/require-operator.js";

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      ctx.logger.info(
        {
          method: req.method,
          path: req.originalUrl.split("?")[0],
          status: res.statusCode,
          ms: Date.now() - started,
        },
        "request",
      );
    });
    next();
  });

  app.get("/health", async (_req, res) => {
    await ctx.db.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  // Called by Meta and by the company's CRM, not by the browser: no CORS, their own verification.
  app.use("/webhooks/whatsapp", whatsappWebhookRoutes(ctx));
  app.use("/hooks/crm/form-lead", formLeadsRoutes(ctx));

  const backoffice = express.Router();
  backoffice.use(
    cors({
      origin: ctx.env.BACKOFFICE_ORIGIN,
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  backoffice.use(express.json({ limit: "100kb" }));
  backoffice.use(requireSession(ctx));
  backoffice.use("/me", meRoutes(ctx));
  backoffice.use("/threads", requireOperator(), threadsRoutes(ctx));
  backoffice.use("/knowledge", requireOperator(), knowledgeRoutes(ctx));
  backoffice.use("/secrets", requireOperator(), secretsRoutes(ctx));
  backoffice.use("/companies", requirePlatformAdmin(ctx), companiesRoutes(ctx));
  app.use("/internal", backoffice);

  app.use(errorHandler(ctx));
  return app;
}
