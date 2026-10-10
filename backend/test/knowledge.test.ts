import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { createApp } from "../src/app";
import { seedAltamira } from "../src/companies/seed";
import { BurstQueue } from "../src/conversation/burst";
import { altamiraConfig } from "../src/companies/altamira";
import { readCompany } from "../src/companies/load";
import { loadEnv } from "../src/env";
import { buildSystemPrompt } from "../src/engine/prompt";
import { ModelOutput } from "../src/engine/types";
import { FakeChannel } from "../src/integrations/channel";
import { FakeCrm } from "../src/integrations/crm/types";
import { extractText, KnowledgeError } from "../src/integrations/knowledge/extract";
import { recordInbound, processThread } from "../src/services/whatsapp.service";
import {
  deleteKnowledgeFile,
  knowledgeForPrompt,
  uploadKnowledgeFile,
} from "../src/services/knowledge.service";
import { db, exclusive, resetDb, testKey } from "./db";

const quiet: ModelOutput = {
  reply: "Hola",
  interest: null,
  budget: null,
  knowsProjects: null,
  callTime: null,
  intent: "continue",
};

async function company() {
  await resetDb();
  const key = testKey();
  await seed();
  const row = await db.company.findFirstOrThrow();
  return readCompany(row, key);
}

async function seed() {
  await seedAltamira(db, testKey(), { email: "operador@example.com", supabaseUserId: "fake-user" });
}

test("plain text, markdown, and csv are accepted; other types are rejected", async () => {
  const text = await extractText("notas.txt", Buffer.from("Precio desde: USD 10"));
  assert.equal(text.format, "txt");
  assert.match(text.text, /USD 10/);
  const markdown = await extractText("notas.md", Buffer.from("# Ficha\n\nOrientación: Norte"));
  assert.match(markdown.text, /Orientación: Norte/);
  const csv = await extractText("notas.csv", Buffer.from("nombre,precio\nNorte,USD 10"));
  assert.match(csv.text, /USD 10/);

  await assert.rejects(
    () => extractText("foto.png", Buffer.from("no")),
    (err: unknown) => err instanceof KnowledgeError && err.status === 415 && /no está admitido/.test(err.message),
  );
  await assert.rejects(
    () => extractText("viejo.doc", Buffer.from("no")),
    (err: unknown) => err instanceof KnowledgeError && err.status === 415,
  );
});

test("pdf, docx, and xlsx extraction keep the commercial text", async () => {
  const pdf = await readFile(path.join(process.cwd(), "fixtures", "sample-knowledge.pdf"));
  const fromPdf = await extractText("ficha.pdf", pdf);
  assert.match(fromPdf.text, /USD 120000/);

  const docx = await minimalDocx("Precio desde: USD 77.000");
  const fromDocx = await extractText("ficha.docx", docx);
  assert.match(fromDocx.text, /USD 77\.000/);

  const xlsx = await minimalXlsx();
  const fromXlsx = await extractText("ficha.xlsx", xlsx);
  assert.match(fromXlsx.text, /USD 88\.000/);

  const pptx = new JSZip();
  pptx.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Precio desde: USD 33</a:t></p:sld>`,
  );
  assert.match((await extractText("deck.pptx", await pptx.generateAsync({ type: "nodebuffer" }))).text, /USD 33/);

  const odt = new JSZip();
  odt.file("content.xml", `<?xml version="1.0"?><office:document-content><text:p>Entrega: 2029</text:p></office:document-content>`);
  assert.match((await extractText("nota.odt", await odt.generateAsync({ type: "nodebuffer" }))).text, /2029/);
});

test("upload replaces the same filename, delete removes it, and the prompt gets the extracted text", async () => {
  await exclusive(async () => {
    const view = await company();
    await uploadKnowledgeFile(db, view, { filename: "nota.txt", bytes: Buffer.from("version uno") });
    await uploadKnowledgeFile(db, view, { filename: "nota.txt", bytes: Buffer.from("version dos MARCA-7781") });
    const rows = await db.knowledgeFile.findMany({ where: { companyId: view.id, filename: "nota.txt" } });
    assert.equal(rows.length, 1);
    assert.match(rows[0].extractedText, /MARCA-7781/);
    assert.doesNotMatch(rows[0].extractedText, /version uno/);

    const files = await knowledgeForPrompt(db, view.id);
    const prompt = buildSystemPrompt(view.config, files);
    assert.match(prompt, /MARCA-7781/);
    assert.match(prompt, /File: nota\.txt/);

    let seen = "";
    const recorded = await recordInbound(
      { db, key: testKey() },
      {
        phoneNumberId: view.whatsappPhoneNumberId!,
        from: "59899119999",
        messageId: "wamid.knowledge",
        contentType: "text",
        text: "hola",
      },
    );
    await processThread(
      {
        db,
        key: testKey(),
        channel: new FakeChannel(),
        crm: new FakeCrm(),
        model: "claude-haiku-4-5",
        complete: async (input) => {
          seen = input.system;
          return { output: quiet, model: "test", inputTokens: 1, outputTokens: 1 };
        },
      },
      recorded.threadId!,
    );
    assert.match(seen, /MARCA-7781/);

    await deleteKnowledgeFile(db, view.id, rows[0].id);
    const after = await knowledgeForPrompt(db, view.id);
    assert.equal(after.some((file) => file.filename === "nota.txt"), false);
    await assert.rejects(
      () => deleteKnowledgeFile(db, view.id, rows[0].id),
      (err: unknown) => err instanceof KnowledgeError && err.status === 404,
    );
  });
});

test("extracted text over the company limit is rejected", async () => {
  await exclusive(async () => {
    const view = await company();
    const config = altamiraConfig();
    config.knowledge.maxFileBytes = 30;
    config.knowledge.maxCompanyBytes = 40;
    await db.company.update({ where: { id: view.id }, data: { config } });
    await db.knowledgeFile.deleteMany({ where: { companyId: view.id } });
    const tight = readCompany(await db.company.findFirstOrThrow(), testKey());
    const chunk = Buffer.from("1234567890123456789012345");
    await uploadKnowledgeFile(db, tight, { filename: "uno.txt", bytes: chunk });
    await assert.rejects(
      () => uploadKnowledgeFile(db, tight, { filename: "dos.txt", bytes: chunk }),
      (err: unknown) => err instanceof KnowledgeError && err.status === 413 && /empresa/.test(err.message),
    );
  });
});

test("the panel route rejects a bad type and accepts a text upload", async () => {
  await exclusive(async () => {
    await resetDb();
    await seed();
    const env = loadEnv({
      NODE_ENV: "test",
      AUTH_MODE: "fake",
      BACKOFFICE_ORIGIN: "http://localhost:3000",
      SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
    });
    const app = createApp({
      db,
      key: testKey(),
      channel: new FakeChannel(),
      crm: new FakeCrm(),
      complete: async () => ({ output: quiet, model: "test", inputTokens: 0, outputTokens: 0 }),
      model: "claude-haiku-4-5",
      env,
      bursts: new BurstQueue(60_000, async () => undefined),
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const headers = { Authorization: "Bearer fake:operador@example.com" };
    try {
      const bad = new FormData();
      bad.append("file", new Blob([Buffer.from("nope")]), "foto.png");
      const rejected = await fetch(`http://127.0.0.1:${port}/internal/knowledge/files`, {
        method: "POST",
        headers,
        body: bad,
      });
      assert.equal(rejected.status, 415);
      const rejectedBody = (await rejected.json()) as { error: string };
      assert.match(rejectedBody.error, /no está admitido/);

      const good = new FormData();
      good.append("file", new Blob([Buffer.from("Precio desde: USD 55")]), "panel.txt");
      const accepted = await fetch(`http://127.0.0.1:${port}/internal/knowledge/files`, {
        method: "POST",
        headers,
        body: good,
      });
      assert.equal(accepted.status, 200);
      const listed = await fetch(`http://127.0.0.1:${port}/internal/knowledge/files`, { headers });
      const list = (await listed.json()) as { files: { id: string; filename: string }[] };
      const panel = list.files.find((file) => file.filename === "panel.txt");
      assert.ok(panel);

      const replaced = new FormData();
      replaced.append("file", new Blob([Buffer.from("Precio desde: USD 56")]), "panel.txt");
      const put = await fetch(`http://127.0.0.1:${port}/internal/knowledge/files/${panel.id}`, {
        method: "PUT",
        headers,
        body: replaced,
      });
      assert.equal(put.status, 200);
      const stored = await db.knowledgeFile.findUniqueOrThrow({ where: { id: panel.id } });
      assert.match(stored.extractedText, /USD 56/);

      const removed = await fetch(`http://127.0.0.1:${port}/internal/knowledge/files/${panel.id}`, {
        method: "DELETE",
        headers,
      });
      assert.equal(removed.status, 200);
      assert.equal(await db.knowledgeFile.findUnique({ where: { id: panel.id } }), null);
    } finally {
      server.close();
    }
  });
});

async function minimalDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

async function minimalXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Norte");
  sheet.addRow(["Precio desde", "USD 88.000"]);
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}
