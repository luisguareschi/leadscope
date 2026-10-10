import { PrismaClient } from "@prisma/client";

export const SAMPLE_KNOWLEDGE_FILENAME = "ficha-de-prueba.txt";

/** Dev sample only. Not inventory. */
export const SAMPLE_KNOWLEDGE_TEXT = [
  "Ejemplo Norte (dato de prueba, no es inventario)",
  "Precio desde: USD 120.000",
  "Tipologías: 1 y 2 dormitorios",
  "Entrega: 2027",
  "Orientación: Norte",
].join("\n");

/**
 * Inserts one small text file for each company that has no knowledge files.
 * A company that already has uploads is left alone. Production startup does not call this.
 */
export async function ensureSampleKnowledge(db: PrismaClient): Promise<number> {
  const companies = await db.company.findMany({ select: { id: true } });
  let inserted = 0;
  for (const company of companies) {
    const existing = await db.knowledgeFile.count({ where: { companyId: company.id } });
    if (existing > 0) continue;
    await db.knowledgeFile.create({
      data: {
        companyId: company.id,
        filename: SAMPLE_KNOWLEDGE_FILENAME,
        format: "txt",
        extractedText: SAMPLE_KNOWLEDGE_TEXT,
        byteSize: Buffer.byteLength(SAMPLE_KNOWLEDGE_TEXT, "utf8"),
      },
    });
    inserted += 1;
  }
  return inserted;
}
