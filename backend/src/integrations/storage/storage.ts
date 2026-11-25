import type { Env } from "../../config/env.js";

export type StoredObject = {
  data: Buffer;
  contentType: string;
};

/**
 * Binary file storage for knowledge attachments and WhatsApp media.
 * Production uses Supabase Storage; local dev and tests use an in-memory fake when Supabase
 * credentials are absent.
 */
export type FileStorage = {
  readonly kind: "supabase" | "fake";
  upload(path: string, data: Buffer, contentType: string): Promise<void>;
  download(path: string): Promise<StoredObject>;
  remove(paths: string[]): Promise<void>;
};

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class FakeFileStorage implements FileStorage {
  readonly kind = "fake" as const;
  readonly files = new Map<string, StoredObject>();

  async upload(path: string, data: Buffer, contentType: string): Promise<void> {
    this.files.set(path, { data: Buffer.from(data), contentType });
  }

  async download(path: string): Promise<StoredObject> {
    const entry = this.files.get(path);
    if (!entry) throw new StorageError(`Object not found: ${path}`, 404);
    return { data: Buffer.from(entry.data), contentType: entry.contentType };
  }

  async remove(paths: string[]): Promise<void> {
    for (const path of paths) this.files.delete(path);
  }
}

type SupabaseStorageOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetchImpl?: typeof fetch;
};

function encodeObjectPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Supabase Storage REST API adapter (no extra SDK dependency). Automatically creates a private
 * bucket on first upload if it does not exist yet.
 */
export function createSupabaseStorage(
  options: SupabaseStorageOptions,
): FileStorage {
  const baseUrl = options.supabaseUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const bucket = encodeURIComponent(options.bucket);
  const authHeaders = {
    Authorization: `Bearer ${options.serviceRoleKey}`,
    apikey: options.serviceRoleKey,
  };
  let bucketEnsured = false;

  async function ensureBucket(): Promise<void> {
    if (bucketEnsured) return;
    const response = await fetchImpl(`${baseUrl}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: options.bucket,
        name: options.bucket,
        public: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok || response.status === 409) {
      bucketEnsured = true;
      return;
    }
    const text = await response.text().catch(() => "");
    // Some Supabase versions return 400 with "already exists" on duplicate bucket creation.
    if (response.status === 400 && /already exists/i.test(text)) {
      bucketEnsured = true;
      return;
    }
    throw new StorageError(
      `Supabase Storage bucket setup failed (${response.status}): ${text.slice(0, 200)}`,
      response.status,
    );
  }

  return {
    kind: "supabase",
    async upload(path, data, contentType) {
      const url = `${baseUrl}/storage/v1/object/${bucket}/${encodeObjectPath(path)}`;
      const put = () =>
        fetchImpl(url, {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": contentType || "application/octet-stream",
            "x-upsert": "true",
          },
          body: new Uint8Array(data),
          signal: AbortSignal.timeout(30_000),
        });
      let response = await put();
      if (response.status === 404 || response.status === 400) {
        const text = await response.text().catch(() => "");
        if (/bucket.*not found/i.test(text)) {
          await ensureBucket();
          response = await put();
        } else {
          throw new StorageError(
            `Supabase Storage upload failed (${response.status}): ${text.slice(0, 200)}`,
            response.status,
          );
        }
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new StorageError(
          `Supabase Storage upload failed (${response.status}): ${text.slice(0, 200)}`,
          response.status,
        );
      }
      bucketEnsured = true;
    },
    async download(path) {
      const url = `${baseUrl}/storage/v1/object/${bucket}/${encodeObjectPath(path)}`;
      const response = await fetchImpl(url, {
        method: "GET",
        headers: authHeaders,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new StorageError(
          `Supabase Storage download failed (${response.status}): ${text.slice(0, 200)}`,
          response.status,
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      return {
        data: Buffer.from(arrayBuffer),
        contentType:
          response.headers.get("content-type") ?? "application/octet-stream",
      };
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const url = `${baseUrl}/storage/v1/object/${bucket}`;
      const response = await fetchImpl(url, {
        method: "DELETE",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok && response.status !== 404) {
        const text = await response.text().catch(() => "");
        throw new StorageError(
          `Supabase Storage delete failed (${response.status}): ${text.slice(0, 200)}`,
          response.status,
        );
      }
    },
  };
}

export function createFileStorage(
  env: Env,
  fetchImpl?: typeof fetch,
): FileStorage {
  if (
    env.AUTH_MODE !== "dev" &&
    env.SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return createSupabaseStorage({
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_STORAGE_BUCKET,
      fetchImpl,
    });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for file storage in production",
    );
  }
  return new FakeFileStorage();
}
