import { Router } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { readCompany } from "../companies/load";
import { KNOWLEDGE_MAX_UPLOAD_BYTES } from "../companies/knowledge-limits";
import { Env } from "../env";
import { KnowledgeError } from "../integrations/knowledge/extract";
import { log } from "../logger";
import { AuthedRequest } from "../routes/auth";
import {
  deleteKnowledgeFile,
  listKnowledgeFiles,
  replaceKnowledgeFile,
  uploadKnowledgeFile,
} from "../services/knowledge.service";

export function knowledgeRouter(db: PrismaClient, env: Env, key: Buffer | null) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.KNOWLEDGE_MAX_UPLOAD_BYTES || KNOWLEDGE_MAX_UPLOAD_BYTES, files: 1 },
  });

  router.get("/files", async (req: AuthedRequest, res) => {
    const companyId = req.operator!.companyId;
    const row = await db.company.findUnique({ where: { id: companyId } });
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const company = readCompany(row, key);
    const files = await listKnowledgeFiles(db, companyId);
    res.json({
      files,
      limits: {
        maxFileBytes: company.config.knowledge.maxFileBytes,
        maxCompanyBytes: company.config.knowledge.maxCompanyBytes,
        maxUploadBytes: env.KNOWLEDGE_MAX_UPLOAD_BYTES,
      },
    });
  });

  router.post("/files", receiveFile(upload), async (req: AuthedRequest, res) => {
    await writeFile(db, key, req, res, false);
  });

  router.put("/files/:id", receiveFile(upload), async (req: AuthedRequest, res) => {
    await writeFile(db, key, req, res, true);
  });

  router.delete("/files/:id", async (req: AuthedRequest, res) => {
    try {
      await deleteKnowledgeFile(db, req.operator!.companyId, req.params.id);
      res.json({ ok: true });
    } catch (err) {
      sendKnowledgeError(res, err);
    }
  });

  return router;
}

function receiveFile(upload: multer.Multer) {
  return (req: AuthedRequest, res: Parameters<ReturnType<multer.Multer["single"]>>[1], next: () => void) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "El archivo supera el límite de subida (1 MB)." });
        return;
      }
      log.error({ err }, "knowledge upload failed");
      res.status(400).json({ error: "No se pudo leer el archivo." });
    });
  };
}

async function writeFile(
  db: PrismaClient,
  key: Buffer | null,
  req: AuthedRequest,
  res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void },
  replace: boolean,
): Promise<void> {
  const upload = req.file;
  if (!upload) {
    res.status(400).json({ error: "Falta el archivo." });
    return;
  }
  const row = await db.company.findUnique({ where: { id: req.operator!.companyId } });
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const company = readCompany(row, key);
  try {
    const saved = replace
      ? await replaceKnowledgeFile(db, company, req.params.id, {
          filename: upload.originalname,
          bytes: upload.buffer,
        })
      : await uploadKnowledgeFile(db, company, { filename: upload.originalname, bytes: upload.buffer });
    res.json({ file: saved });
  } catch (err) {
    sendKnowledgeError(res, err, company.id);
  }
}

function sendKnowledgeError(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  err: unknown,
  companyId?: string,
): void {
  if (err instanceof KnowledgeError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  log.error({ err, companyId }, "knowledge file request failed");
  res.status(500).json({ error: "No se pudo guardar el archivo." });
}
