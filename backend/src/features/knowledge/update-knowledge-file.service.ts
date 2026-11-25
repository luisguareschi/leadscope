import type { AppContext } from "../../context.js";
import { isMediaOnlyFormat } from "../../integrations/knowledge/formats.js";
import { badRequest, notFound } from "../../lib/http-error.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import {
  assertFileNameFree,
  assertFolder,
  loadFolders,
  renamedFileName,
  withKnowledgeLock,
} from "./knowledge-folders.js";
import type { KnowledgeVisibility } from "./prepare-upload.js";

/**
 * Renames a file (keeps its extension), moves it to another folder, or changes its visibility
 * (`internal` vs `public`) and description. Its date stays the one of its content.
 */
export async function updateKnowledgeFile(
  ctx: AppContext,
  companyId: string,
  fileId: string,
  change: {
    name?: string;
    folderId?: string | null;
    visibility?: KnowledgeVisibility;
    description?: string | null;
  },
) {
  return withKnowledgeLock(ctx, companyId, async (tx) => {
    const current = await tx.knowledgeFile.findFirst({
      where: { id: fileId, companyId },
    });
    if (!current) throw notFound("Archivo no encontrado");
    const folders = await loadFolders(tx, companyId);
    const folderId =
      change.folderId === undefined ? current.folderId : change.folderId;
    assertFolder(folders, folderId);
    const name =
      change.name === undefined
        ? current.name
        : renamedFileName(current.name, change.name);
    const nameKey = name.toLowerCase();
    if (nameKey !== current.nameKey || folderId !== current.folderId) {
      await assertFileNameFree(tx, folders, {
        companyId,
        folderId,
        nameKey,
        exceptId: current.id,
      });
    }
    const visibility = change.visibility ?? current.visibility;
    if (visibility === "public" && !current.storagePath) {
      throw badRequest(
        "Este archivo se subió antes de activar el almacenamiento de archivos. Reemplázalo para poder marcarlo como público.",
        "missing_file_binary",
      );
    }
    if (visibility === "internal" && isMediaOnlyFormat(current.format)) {
      throw badRequest(
        "Las imágenes no tienen texto para el conocimiento interno; deben permanecer como públicas.",
        "media_requires_public",
      );
    }
    if (visibility === "internal" && current.charCount === 0) {
      throw badRequest(
        "Este archivo no tiene texto extraído y solo puede usarse como archivo público.",
        "empty_text_requires_public",
      );
    }
    const description =
      change.description === undefined
        ? current.description
        : change.description?.trim() || null;

    const saved = await tx.knowledgeFile.update({
      where: { id: current.id },
      data: {
        name,
        nameKey,
        folderId,
        visibility,
        description,
        updatedAt: current.updatedAt,
      },
      include: { uploadedBy: { select: { email: true } } },
    });
    return { file: toKnowledgeFileDto(saved) };
  });
}
