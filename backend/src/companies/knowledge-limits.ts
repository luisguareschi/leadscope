/** Extracted text must fit in the prompt. These are the conservative defaults. */
export const KNOWLEDGE_MAX_FILE_BYTES = 80 * 1024;
export const KNOWLEDGE_MAX_COMPANY_BYTES = 200 * 1024;
/** Original upload, before extraction. Larger than the text cap so a small PDF can still be read. */
export const KNOWLEDGE_MAX_UPLOAD_BYTES = 1024 * 1024;
