import type { ErrorRequestHandler } from "express";
import multer from "multer";
import type { AppContext } from "../context.js";
import { StorageError } from "../integrations/storage/storage.js";
import { HttpError } from "../lib/http-error.js";
import { reportError } from "../lib/monitoring.js";

function bodyParserError(
  error: unknown,
): { status: number; code: string; message: string } | null {
  const type =
    error && typeof error === "object" && "type" in error
      ? (error as { type: unknown }).type
      : null;
  if (type === "entity.too.large")
    return {
      status: 413,
      code: "body_too_large",
      message: "La solicitud es demasiado grande.",
    };
  if (type === "entity.parse.failed")
    return {
      status: 400,
      code: "invalid_json",
      message: "La solicitud no es JSON válido.",
    };
  return null;
}

export function errorHandler(ctx: AppContext): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        error: {
          code: error.code ?? "error",
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
      return;
    }
    // express.json: a body over the limit, or one that is not valid JSON.
    const parserError = bodyParserError(error);
    if (parserError) {
      const { status, ...body } = parserError;
      res.status(status).json({ error: body });
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? "file_too_large" : "invalid_upload",
          message: tooLarge
            ? "El archivo es demasiado grande."
            : "No se pudo leer el archivo enviado.",
        },
      });
      return;
    }
    if (error instanceof StorageError && error.status === 404) {
      res.status(404).json({
        error: {
          code: "not_found",
          message: "Archivo no disponible.",
        },
      });
      return;
    }
    ctx.logger.error(
      { err: error, method: req.method, path: req.path },
      "unhandled request error",
    );
    reportError(error);
    res
      .status(500)
      .json({ error: { code: "internal", message: "Error interno" } });
  };
}
