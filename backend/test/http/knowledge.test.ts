import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createCompany, createTestContext, resetDb, testDb } from "../support/harness.js";
import { makeDocx, makePdf, makeSpreadsheet } from "../support/file-fixtures.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
const auth = { Authorization: "Bearer dev:operador@test.com" };
const limits = { maxFileBytes: 200_000, maxCharsPerFile: 400, maxCharsTotal: 600 };

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, { slug: "altamira", config: { knowledge: limits } });
  const other = await createCompany(db, { slug: "otra" });
  await db.operator.create({ data: { email: "operador@test.com", companyId: company.id } });
  await db.knowledgeFile.create({
    data: {
      companyId: other.id,
      name: "ajeno.txt",
      nameKey: "ajeno.txt",
      format: "txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      sha256: "x",
      text: "ajeno",
      charCount: 5,
    },
  });
  app = createApp(createTestContext());
});

const upload = (name: string, data: Buffer) =>
  request(app).post("/internal/knowledge/files").set(auth).attach("file", data, name);

describe("knowledge files", () => {
  it("extracts and stores an uploaded file, and reports usage against the limits", async () => {
    const response = await upload("Precios Año 2026.xlsx", makeSpreadsheet([["Torre Sur", "USD 150.000"]], "xlsx")).expect(201);
    expect(response.body).toMatchObject({
      replaced: false,
      file: { name: "Precios Año 2026.xlsx", format: "xlsx", formatLabel: "Excel", uploadedBy: "operador@test.com" },
    });

    const list = await request(app).get("/internal/knowledge/files").set(auth).expect(200);
    expect(list.body.files.map((file: { name: string }) => file.name)).toEqual(["Precios Año 2026.xlsx"]);
    expect(list.body.usage).toMatchObject({ ...limits, usedChars: response.body.file.charCount });
    expect(list.body.acceptedExtensions).toContain(".pdf");

    const detail = await request(app).get(`/internal/knowledge/files/${response.body.file.id}`).set(auth).expect(200);
    expect(detail.body.file.text).toBe("## Hoja: Precios\nTorre Sur,USD 150.000");
  });

  it("replaces a file uploaded again with the same name, in any case", async () => {
    const first = await upload("faq.docx", await makeDocx(["Entrega 2027"])).expect(201);
    const second = await upload("FAQ.docx", await makeDocx(["Entrega 2028"])).expect(200);
    expect(second.body).toMatchObject({ replaced: true, file: { id: first.body.file.id, name: "FAQ.docx" } });
    expect(await db.knowledgeFile.count({ where: { name: { not: "ajeno.txt" } } })).toBe(1);
    const stored = await db.knowledgeFile.findUniqueOrThrow({ where: { id: first.body.file.id } });
    expect(stored.text).toBe("Entrega 2028");
  });

  it("replaces a specific file with one that has another name", async () => {
    const first = await upload("viejo.pdf", makePdf("Precio viejo")).expect(201);
    await upload("otro.txt", Buffer.from("otro")).expect(201);
    const replaced = await request(app)
      .put(`/internal/knowledge/files/${first.body.file.id}`)
      .set(auth)
      .attach("file", makePdf("Precio nuevo"), "nuevo.pdf")
      .expect(200);
    expect(replaced.body.file).toMatchObject({ id: first.body.file.id, name: "nuevo.pdf" });

    await request(app)
      .put(`/internal/knowledge/files/${first.body.file.id}`)
      .set(auth)
      .attach("file", Buffer.from("x"), "otro.txt")
      .expect(409);
  });

  it("explains what is wrong with a rejected file", async () => {
    const unsupported = await upload("foto.png", Buffer.from("png")).expect(415);
    expect(unsupported.body.error.code).toBe("unsupported_format");
    const scanned = await upload("escaneado.pdf", makePdf("")).expect(422);
    expect(scanned.body.error.message).toContain("escaneado");
    const corrupt = await upload("precios.xlsx", Buffer.from("not excel")).expect(422);
    expect(corrupt.body.error.code).toBe("corrupt_file");
    await request(app).post("/internal/knowledge/files").set(auth).expect(400);
  });

  it("enforces the per-file and per-company text limits", async () => {
    const tooLong = await upload("largo.txt", Buffer.from("a".repeat(401))).expect(422);
    expect(tooLong.body.error.code).toBe("file_text_too_long");

    await upload("uno.txt", Buffer.from("a".repeat(350))).expect(201);
    const overTotal = await upload("dos.txt", Buffer.from("b".repeat(300))).expect(422);
    expect(overTotal.body.error.code).toBe("company_text_limit");
    // Replacing a file only counts the new version.
    await upload("uno.txt", Buffer.from("c".repeat(390))).expect(200);
  });

  it("enforces the per-file size limit", async () => {
    const response = await upload("grande.txt", Buffer.alloc(200_001, "a")).expect(413);
    expect(response.body.error.code).toBe("file_too_large");
  });

  it("deletes a file, never another company's", async () => {
    const created = await upload("borrar.txt", Buffer.from("borrar")).expect(201);
    await request(app).delete(`/internal/knowledge/files/${created.body.file.id}`).set(auth).expect(204);
    const foreign = await db.knowledgeFile.findFirstOrThrow({ where: { name: "ajeno.txt" } });
    await request(app).delete(`/internal/knowledge/files/${foreign.id}`).set(auth).expect(404);
    await request(app).get(`/internal/knowledge/files/${foreign.id}`).set(auth).expect(404);
  });
});
