import type { KnowledgeDocument, SendableFile } from "./prompt.js";

export type FolderNode = { id: string; parentId: string | null; name: string };

export type FileNode = {
  id: string;
  folderId: string | null;
  name: string;
  updatedAt: Date;
  text: string;
  format?: string;
  visibility?: "internal" | "public";
  storagePath?: string | null;
  description?: string | null;
};

const collator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});

/** By name as people read it ("Torre 2" before "Torre 10"), then by id so the order never moves. */
function byName<T extends { id: string; name: string }>(a: T, b: T): number {
  return (
    collator.compare(a.name, b.name) ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
    (a.id < b.id ? -1 : 1)
  );
}

/** Folder names from the root down to `folderId`, inclusive. Empty at the root. */
export function folderPath(
  folders: ReadonlyMap<string, FolderNode>,
  folderId: string | null,
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  let current = folderId ? folders.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? folders.get(current.parentId) : undefined;
  }
  return names;
}

/** True when `candidateId` is `folderId` itself or any folder inside it. */
export function isSameOrInside(
  folders: ReadonlyMap<string, FolderNode>,
  folderId: string,
  candidateId: string | null,
): boolean {
  const seen = new Set<string>();
  let current = candidateId;
  while (current && !seen.has(current)) {
    if (current === folderId) return true;
    seen.add(current);
    current = folders.get(current)?.parentId ?? null;
  }
  return false;
}

function walkFiles(
  folders: FolderNode[],
  files: FileNode[],
): Array<{ file: FileNode; path: string[] }> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const childFolders = new Map<string | null, FolderNode[]>();
  for (const folder of folders) {
    const parent =
      folder.parentId && byId.has(folder.parentId) ? folder.parentId : null;
    childFolders.set(parent, [...(childFolders.get(parent) ?? []), folder]);
  }
  const childFiles = new Map<string | null, FileNode[]>();
  for (const file of files) {
    const folder =
      file.folderId && byId.has(file.folderId) ? file.folderId : null;
    childFiles.set(folder, [...(childFiles.get(folder) ?? []), file]);
  }

  const ordered: Array<{ file: FileNode; path: string[] }> = [];
  const visited = new Set<string>();
  const walk = (folderId: string | null) => {
    const path = folderPath(byId, folderId);
    for (const file of [...(childFiles.get(folderId) ?? [])].sort(byName)) {
      ordered.push({ file, path });
    }
    for (const folder of [...(childFolders.get(folderId) ?? [])].sort(byName)) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      walk(folder.id);
    }
  };
  walk(null);
  return ordered;
}

/**
 * The company's text-bearing files in the order the prompt lists them, each with its folder path:
 * depth-first from the root, a folder's own files (by name) before its subfolders (by name).
 */
export function knowledgeDocuments(
  folders: FolderNode[],
  files: FileNode[],
): KnowledgeDocument[] {
  return walkFiles(folders, files)
    .filter(({ file }) => file.text.trim().length > 0)
    .map(({ file, path }) => ({
      name: file.name,
      folders: path,
      updatedAt: file.updatedAt,
      text: file.text,
    }));
}

/**
 * Public files that have an original binary stored and can be sent to leads by the assistant.
 * Internal files are strictly excluded.
 */
export function sendableKnowledgeFiles(
  folders: FolderNode[],
  files: FileNode[],
): SendableFile[] {
  return walkFiles(folders, files)
    .filter(
      ({ file }) => file.visibility === "public" && Boolean(file.storagePath),
    )
    .map(({ file, path }) => ({
      id: file.id,
      path: [...path, file.name].join(" / "),
      format: file.format ?? "file",
      description: file.description?.trim() || null,
    }));
}
