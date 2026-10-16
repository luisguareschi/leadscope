import type { CorsOptions } from "cors";
import type { Request } from "express";
import type { Env } from "../config/env.js";
import { badRequest } from "../lib/http-error.js";

type OriginEnv = Pick<Env, "BACKOFFICE_ORIGIN">;

/** https, one `*` inside the leftmost host label next to fixed text, at least two labels after it. */
const WILDCARD_ENTRY =
  /^https:\/\/(?:[a-z0-9-]+\*[a-z0-9-]*|[a-z0-9-]*\*[a-z0-9-]+)(?:\.[a-z0-9-]+){2,}(?::\d+)?$/;

function entries(env: OriginEnv): string[] {
  return env.BACKOFFICE_ORIGIN.split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** `*` matches part of one DNS label: letters, digits, hyphens, never a dot. */
function matches(entry: string, origin: string): boolean {
  if (!entry.includes("*")) return entry === origin;
  if (!WILDCARD_ENTRY.test(entry)) return false;
  const pattern = entry
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[a-z0-9-]+");
  return new RegExp(`^${pattern}$`).test(origin);
}

/**
 * BACKOFFICE_ORIGIN is a comma-separated list of panel origins. An entry may hold one `*` inside
 * its first host label, e.g. `https://leadscope-backoffice-pr-*.onrender.com` for Render previews.
 */
export function isAllowedPanelOrigin(env: OriginEnv, origin: string): boolean {
  return entries(env).some((entry) => matches(entry, origin));
}

export function backofficeCors(env: OriginEnv): CorsOptions["origin"] {
  if (env.BACKOFFICE_ORIGIN.trim() === "*") return "*";
  return (origin, callback) =>
    callback(null, origin !== undefined && isAllowedPanelOrigin(env, origin));
}

/** The first entry without a wildcard. */
export function defaultPanelOrigin(env: OriginEnv): string | null {
  return entries(env).find((entry) => !entry.includes("*")) ?? null;
}

/**
 * Where links in emails point: the Origin of the request that triggered them when it is on the
 * list, otherwise the first exact entry. Never "*": Supabase drops a redirect it does not accept
 * and sends the user to the project's Site URL instead.
 */
export function panelOriginFor(env: OriginEnv, req: Request): string {
  const origin = req.get("origin");
  if (origin && isAllowedPanelOrigin(env, origin)) return origin;
  const fallback = defaultPanelOrigin(env);
  if (fallback) return fallback;
  throw badRequest(
    "No se pudo saber la dirección del panel para el enlace del email. Configurá BACKOFFICE_ORIGIN en el servidor con la URL del panel (por ejemplo https://panel.ejemplo.com).",
    "panel_origin_unknown",
  );
}

/** Where invitation and password-reset links land: the backoffice's set-password page. */
export function setPasswordUrl(panelOrigin: string): string {
  return `${panelOrigin}/auth/set-password`;
}
