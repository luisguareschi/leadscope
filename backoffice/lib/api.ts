export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    /** Per-field messages, keyed by the field's dotted path (e.g. "questions.budget"). */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const isForm =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor.", "network");
  }
  if (response.status === 204) return undefined as T;
  const json = (await response.json().catch(() => null)) as {
    error?: {
      message?: string;
      code?: string;
      fields?: Record<string, string>;
    };
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.error?.message ?? "Ocurrió un error inesperado.",
      json?.error?.code,
      json?.error?.fields,
    );
  }
  return json as T;
}
