import type { Logger } from "./logger.js";

function parseUrl(input: Parameters<typeof fetch>[0]): {
  host: string;
  path: string;
} {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    const parsed = new URL(raw);
    return { host: parsed.host, path: parsed.pathname };
  } catch {
    const safePath = raw.startsWith("/")
      ? raw.split(/[?#]/)[0] || "/"
      : "unknown";
    return { host: "unknown", path: safePath };
  }
}

function sanitizeFetchError(err: unknown): unknown {
  if (err instanceof Error && /Failed to parse URL/i.test(err.message)) {
    const sanitized = new TypeError("Failed to parse URL");
    sanitized.stack = undefined;
    return sanitized;
  }
  return err;
}

/**
 * Wraps `fetch` to log every outbound HTTP request (service, method, host, path, status, ms)
 * without query strings, headers, or bodies so credentials and personal data never reach logs.
 */
export function createLoggedFetch(
  logger: Pick<Logger, "info" | "warn" | "error">,
  service: string,
  baseFetch: typeof fetch = (input, init) => fetch(input, init),
): typeof fetch {
  return async (input, init) => {
    const started = Date.now();
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const { host, path } = parseUrl(input);
    try {
      const response = await baseFetch(input, init);
      const fields = {
        service,
        method,
        host,
        path,
        status: response.status,
        ms: Date.now() - started,
      };
      if (response.status >= 500) {
        logger.error(fields, "outbound request");
      } else if (response.status >= 400) {
        logger.warn(fields, "outbound request");
      } else {
        logger.info(fields, "outbound request");
      }
      return response;
    } catch (err) {
      logger.error(
        {
          service,
          method,
          host,
          path,
          ms: Date.now() - started,
          err: sanitizeFetchError(err),
        },
        "outbound request failed",
      );
      throw err;
    }
  };
}
