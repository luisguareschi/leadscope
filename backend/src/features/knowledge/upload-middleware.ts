import multer from "multer";
import { MAX_UPLOAD_BYTES } from "../../companies/company-config.js";

/** Hard ceiling for any upload. Each company's own (lower) limit is checked in the service. */
export const singleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  defParamCharset: "utf8",
}).single("file");
