export type KnowledgeFormat =
  | "pdf"
  | "docx"
  | "doc"
  | "odt"
  | "pptx"
  | "xlsx"
  | "xls"
  | "ods"
  | "csv"
  | "txt"
  | "md"
  | "html"
  | "json";

type Container = "pdf" | "zip" | "ole" | "text";

export const KNOWLEDGE_FORMATS: Record<KnowledgeFormat, { extensions: string[]; label: string; container: Container }> = {
  pdf: { extensions: ["pdf"], label: "PDF", container: "pdf" },
  docx: { extensions: ["docx"], label: "Word", container: "zip" },
  doc: { extensions: ["doc"], label: "Word 97-2003", container: "ole" },
  odt: { extensions: ["odt"], label: "OpenDocument", container: "zip" },
  pptx: { extensions: ["pptx"], label: "PowerPoint", container: "zip" },
  xlsx: { extensions: ["xlsx", "xlsm"], label: "Excel", container: "zip" },
  xls: { extensions: ["xls"], label: "Excel 97-2003", container: "ole" },
  ods: { extensions: ["ods"], label: "OpenDocument hoja", container: "zip" },
  csv: { extensions: ["csv", "tsv"], label: "CSV", container: "text" },
  txt: { extensions: ["txt"], label: "Texto", container: "text" },
  md: { extensions: ["md", "markdown"], label: "Markdown", container: "text" },
  html: { extensions: ["html", "htm"], label: "HTML", container: "text" },
  json: { extensions: ["json"], label: "JSON", container: "text" },
};

export const ACCEPTED_EXTENSIONS = Object.values(KNOWLEDGE_FORMATS).flatMap((format) =>
  format.extensions.map((extension) => `.${extension}`),
);

export function formatFromFilename(filename: string): KnowledgeFormat | null {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  for (const [format, spec] of Object.entries(KNOWLEDGE_FORMATS)) {
    if (spec.extensions.includes(extension)) return format as KnowledgeFormat;
  }
  return null;
}

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/** Checks the first bytes, so a renamed or broken file is rejected before any parser runs. */
export function matchesContainer(format: KnowledgeFormat, data: Buffer): boolean {
  switch (KNOWLEDGE_FORMATS[format].container) {
    case "pdf":
      return data.subarray(0, 1024).includes("%PDF-");
    case "zip":
      return data.subarray(0, 4).equals(ZIP);
    case "ole":
      return data.subarray(0, 8).equals(OLE);
    case "text": {
      const sample = data.subarray(0, 8192);
      const isUtf16 = sample[0] === 0xff && sample[1] === 0xfe;
      return isUtf16 || !sample.includes(0);
    }
  }
}
