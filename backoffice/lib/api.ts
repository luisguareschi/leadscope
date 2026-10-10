export type Thread = {
  id: string;
  phone: string;
  state: string;
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  email: string | null;
  updatedAt: string;
  preview?: string;
};

export type ChatMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  contentType: string;
  createdAt: string;
};

const backend = () => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!isForm && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${backend()}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401) {
    sessionStorage.removeItem("leadscope.token");
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `request failed (${response.status})`);
  }
  return (await response.json()) as T;
}
