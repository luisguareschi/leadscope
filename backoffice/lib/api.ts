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
  const response = await fetch(`${backend()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (response.status === 401) {
    sessionStorage.removeItem("leadscope.token");
    throw new Error("unauthorized");
  }
  if (!response.ok) {
    throw new Error(`request failed (${response.status})`);
  }
  return (await response.json()) as T;
}
