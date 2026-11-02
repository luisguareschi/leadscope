import type {
  KnowledgeFile,
  KnowledgeFolder,
} from "../../generated/prisma/client.js";
import {
  KNOWLEDGE_FORMATS,
  type KnowledgeFormat,
} from "../../integrations/knowledge/formats.js";

export function toKnowledgeFileDto(
  file: KnowledgeFile & { uploadedBy?: { email: string } | null },
) {
  return {
    id: file.id,
    folderId: file.folderId,
    name: file.name,
    format: file.format,
    formatLabel:
      KNOWLEDGE_FORMATS[file.format as KnowledgeFormat]?.label ?? file.format,
    sizeBytes: file.sizeBytes,
    charCount: file.charCount,
    uploadedBy: file.uploadedBy?.email ?? null,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

export type KnowledgeFileDto = ReturnType<typeof toKnowledgeFileDto>;

export function toKnowledgeFolderDto(folder: KnowledgeFolder) {
  return {
    id: folder.id,
    parentId: folder.parentId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}
