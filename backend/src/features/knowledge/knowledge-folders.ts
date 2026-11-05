import type { AppContext } from "../../context.js";
import { folderPath, type FolderNode } from "../../engine/knowledge-tree.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, conflict, notFound } from "../../lib/http-error.js";

export type KnowledgeTx = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction that holds the company's knowledge lock, so two moves at once can
 * never build a cycle, and a name check, the total-size check, and the write that follows them
 * see the same folders and files.
 */
export function withKnowledgeLock<T>(
  ctx: AppContext,
  companyId: string,
  fn: (tx: KnowledgeTx) => Promise<T>,
): Promise<T> {
  return ctx.db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`knowledge:${companyId}`}))`;
    return fn(tx);
  });
}

export const MAX_FOLDER_NAME = 100;
export const MAX_FILE_NAME = 200;

/** Trims, drops control characters, and refuses slashes, which the prompt uses between folders. */
export function cleanName(raw: string, max: number, what: string): string {
  // eslint-disable-next-line no-control-regex -- drop ASCII control characters from names
  const name = raw.replace(/[\u0000-\u001f]/g, "").trim();
  if (!name)
    throw badRequest(`Escribe un nombre para ${what}.`, "invalid_name");
  if (/[\\/]/.test(name))
    throw badRequest(
      "El nombre no puede tener / ni \\, porque separan carpetas.",
      "invalid_name",
    );
  if (name.length > max)
    throw badRequest(
      `El nombre puede tener hasta ${max} caracteres.`,
      "invalid_name",
    );
  return name;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

/** A renamed file keeps its extension: "Precios 2027" for "precios.xlsx" becomes "Precios 2027.xlsx". */
export function renamedFileName(current: string, requested: string): string {
  const extension = extensionOf(current);
  let name = cleanName(requested, MAX_FILE_NAME, "el archivo");
  if (
    extension &&
    extensionOf(name).toLowerCase() !== extension.toLowerCase()
  ) {
    name = `${name}${extension}`;
  }
  if (name.length > MAX_FILE_NAME)
    throw badRequest(
      `El nombre puede tener hasta ${MAX_FILE_NAME} caracteres.`,
      "invalid_name",
    );
  return name;
}

export async function loadFolders(
  tx: KnowledgeTx,
  companyId: string,
): Promise<Map<string, FolderNode>> {
  const folders = await tx.knowledgeFolder.findMany({
    where: { companyId },
    select: { id: true, parentId: true, name: true },
  });
  return new Map(folders.map((folder) => [folder.id, folder]));
}

/** Throws 404 unless the folder is the company's. Null is the root. */
export function assertFolder(
  folders: ReadonlyMap<string, FolderNode>,
  folderId: string | null,
): void {
  if (folderId !== null && !folders.has(folderId))
    throw notFound("Carpeta no encontrada");
}

/** "Proyectos / Tres Cruces", or "Conocimiento" for the root, for messages to the operator. */
export function placeName(
  folders: ReadonlyMap<string, FolderNode>,
  folderId: string | null,
): string {
  const path = folderPath(folders, folderId);
  return path.length ? `"${path.join(" / ")}"` : "la raíz de Conocimiento";
}

export async function assertFolderNameFree(
  tx: KnowledgeTx,
  folders: ReadonlyMap<string, FolderNode>,
  input: {
    companyId: string;
    parentId: string | null;
    nameKey: string;
    exceptId?: string;
  },
): Promise<void> {
  const clash = await tx.knowledgeFolder.findFirst({
    where: {
      companyId: input.companyId,
      parentId: input.parentId,
      nameKey: input.nameKey,
      ...(input.exceptId ? { NOT: { id: input.exceptId } } : {}),
    },
  });
  if (clash)
    throw conflict(
      `Ya hay una carpeta llamada "${clash.name}" en ${placeName(folders, input.parentId)}.`,
      "name_taken",
    );
}

export async function assertFileNameFree(
  tx: KnowledgeTx,
  folders: ReadonlyMap<string, FolderNode>,
  input: {
    companyId: string;
    folderId: string | null;
    nameKey: string;
    exceptId: string;
  },
): Promise<void> {
  const clash = await tx.knowledgeFile.findFirst({
    where: {
      companyId: input.companyId,
      folderId: input.folderId,
      nameKey: input.nameKey,
      NOT: { id: input.exceptId },
    },
  });
  if (clash)
    throw conflict(
      `Ya hay un archivo llamado "${clash.name}" en ${placeName(folders, input.folderId)}.`,
      "name_taken",
    );
}
