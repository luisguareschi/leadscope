import { Request, Router } from "express";
import { BurstQueue } from "../conversation/burst";
import { Env } from "../env";
import { parseInbound } from "../integrations/whatsapp/parse";
import { verifyMetaSignature } from "../integrations/whatsapp/signature";
import { log } from "../logger";
import { processThread, recordInbound, WhatsAppDeps } from "../services/whatsapp.service";

export function whatsappRouter(deps: WhatsAppDeps & { env: Env; bursts: BurstQueue }) {
  const router = Router();

  router.get("/", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === deps.env.META_WEBHOOK_VERIFY_TOKEN && typeof challenge === "string") {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("forbidden");
  });

  router.post("/", (req, res) => {
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

  return router;
}

export function burstsFor(deps: WhatsAppDeps, delayMs: number): BurstQueue {
  return new BurstQueue(delayMs, (threadId) => processThread(deps, threadId));
}
