import multer from "multer";

/** Hard ceiling for any upload. Each company's own (lower) limit is checked in the service. */
const ABSOLUTE_MAX_BYTES = 50 * 1024 * 1024;

export const singleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ABSOLUTE_MAX_BYTES, files: 1 },
  defParamCharset: "utf8",
}).single("file");
