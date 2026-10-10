import type { ErrorRequestHandler } from "express";
import multer from "multer";
import type { AppContext } from "../context.js";
import { HttpError } from "../lib/http-error.js";
import { reportError } from "../lib/monitoring.js";

export function errorHandler(ctx: AppContext): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { code: error.code ?? "error", message: error.message } });
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? "file_too_large" : "invalid_upload",
          message: tooLarge ? "El archivo es demasiado grande." : "No se pudo leer el archivo enviado.",
        },
      });
      return;
    }
    ctx.logger.error({ err: error, method: req.method, path: req.path }, "unhandled request error");
    reportError(error);
    res.status(500).json({ error: { code: "internal", message: "Error interno" } });
  };
}
