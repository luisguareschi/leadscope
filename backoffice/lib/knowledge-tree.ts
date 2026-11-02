import type { KnowledgeFile, KnowledgeFolder } from "./types";

const collator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});
const byName = (a: { name: string }, b: { name: string }) =>
  collator.compare(a.name, b.name);

export type FolderStats = {
  /** Files anywhere inside, subfolders included. */
  files: number;
  /** Subfolders anywhere inside. */
  folders: number;
  chars: number;
};

/** The folders and files of a company, indexed for the Conocimiento tree. */
export type KnowledgeTree = {
  folders: Map<string, KnowledgeFolder>;
  childFolders: (parentId: string | null) => KnowledgeFolder[];
  childFiles: (folderId: string | null) => KnowledgeFile[];
  stats: (folderId: string) => FolderStats;
  /** Folder names from the root down to `folderId`. Empty at the root. */
  path: (folderId: string | null) => string[];
  /** True when `candidateId` is `folderId` or inside it. */
  isSameOrInside: (folderId: string, candidateId: string | null) => boolean;
  /** Every folder, depth-first in the order the tree shows them. */
  ordered: { folder: KnowledgeFolder; depth: number }[];
};

export function buildKnowledgeTree(
  folders: KnowledgeFolder[],
  files: KnowledgeFile[],
): KnowledgeTree {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const parentOf = (id: string | null) => (id && byId.has(id) ? id : null);
  const folderChildren = new Map<string | null, KnowledgeFolder[]>();
  for (const folder of folders) {
    const key = parentOf(folder.parentId);
    folderChildren.set(key, [...(folderChildren.get(key) ?? []), folder]);
  }
  const fileChildren = new Map<string | null, KnowledgeFile[]>();
  for (const file of files) {
    const key = parentOf(file.folderId);
    fileChildren.set(key, [...(fileChildren.get(key) ?? []), file]);
  }
  for (const list of folderChildren.values()) list.sort(byName);
  for (const list of fileChildren.values()) list.sort(byName);

  const statsCache = new Map<string, FolderStats>();
  const stats = (folderId: string, seen = new Set<string>()): FolderStats => {
    const cached = statsCache.get(folderId);
    if (cached) return cached;
    seen.add(folderId);
    const own = fileChildren.get(folderId) ?? [];
    const result: FolderStats = {
      files: own.length,
      folders: 0,
      chars: own.reduce((sum, file) => sum + file.charCount, 0),
    };
    for (const child of folderChildren.get(folderId) ?? []) {
      if (seen.has(child.id)) continue;
      const inner = stats(child.id, seen);
      result.files += inner.files;
      result.folders += inner.folders + 1;
      result.chars += inner.chars;
    }
    statsCache.set(folderId, result);
    return result;
  };

  const isSameOrInside = (folderId: string, candidateId: string | null) => {
    const seen = new Set<string>();
    let current = candidateId;
    while (current && !seen.has(current)) {
      if (current === folderId) return true;
      seen.add(current);
      current = byId.get(current)?.parentId ?? null;
    }
    return false;
  };

  const path = (folderId: string | null) => {
    const names: string[] = [];
    const seen = new Set<string>();
    let current = folderId ? byId.get(folderId) : undefined;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return names;
  };

  const ordered: KnowledgeTree["ordered"] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of folderChildren.get(parentId) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      ordered.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);

  return {
    folders: byId,
    childFolders: (parentId) => folderChildren.get(parentId) ?? [],
    childFiles: (folderId) => fileChildren.get(folderId) ?? [],
    stats: (folderId) => stats(folderId),
    path,
    isSameOrInside,
    ordered,
  };
}

/** "Proyectos / Tres Cruces", or "Conocimiento" for the root. */
export function placeLabel(tree: KnowledgeTree, folderId: string | null) {
  const path = tree.path(folderId);
  return path.length ? path.join(" / ") : "Conocimiento";
}

/** "3 archivos", "1 archivo y 2 subcarpetas", "Vacía". */
export function describeContents(stats: FolderStats): string {
  const files = `${stats.files} ${stats.files === 1 ? "archivo" : "archivos"}`;
  if (stats.folders === 0) return stats.files === 0 ? "Vacía" : files;
  const folders = `${stats.folders} ${stats.folders === 1 ? "subcarpeta" : "subcarpetas"}`;
  return stats.files === 0 ? folders : `${files} y ${folders}`;
}
