import type { Response } from "express";

/** Passive MIME types safe to render inline under a sandboxed CSP. */
const SAFE_INLINE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function asciiFallbackFilename(name: string): string {
  return (
    name
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;\r\n]/g, "_")
      .trim() || "archivo"
  );
}

/**
 * Streams a stored binary file with security headers that prevent MIME sniffing and active
 * content execution (e.g. HTML or SVG scripts) on the API/panel origin.
 */
export function sendSafeStoredFile(
  res: Response,
  file: { data: Buffer; mimeType: string; fileName?: string | null },
): void {
  const mime =
    file.mimeType.split(";")[0]?.trim().toLowerCase() ||
    "application/octet-stream";
  const disposition = SAFE_INLINE_MIMES.has(mime) ? "inline" : "attachment";
  const name = file.fileName?.trim();

  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (name) {
    const fallback = asciiFallbackFilename(name);
    const encoded = encodeURIComponent(name);
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`,
    );
  } else {
    res.setHeader("Content-Disposition", disposition);
  }
  res.send(file.data);
}
