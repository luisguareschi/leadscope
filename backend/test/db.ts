import "./env";
import { PrismaClient } from "@prisma/client";
import { decodeEncryptionKey } from "../src/crypto/secrets";

export const db = new PrismaClient();

export function testKey(): Buffer {
  return decodeEncryptionKey(process.env.SECRETS_ENCRYPTION_KEY!);
}

let queue: Promise<unknown> = Promise.resolve();

/** One database, so tests in this process take turns. */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function resetDb(): Promise<void> {
  await db.llmUsage.deleteMany();
  await db.message.deleteMany();
  await db.thread.deleteMany();
  await db.project.deleteMany();
  await db.operator.deleteMany();
  await db.company.deleteMany();
}
