import { describe, expect, it } from "vitest";
import {
  decodeText,
  extractKnowledgeText,
  htmlToText,
  KnowledgeExtractionError,
} from "../../src/integrations/knowledge/extract-text.js";
import { makeDocx, makeOdt, makePdf, makePptx, makeSpreadsheet } from "../support/file-fixtures.js";

async function extractionError(filename: string, data: Buffer) {
  try {
    await extractKnowledgeText(filename, data);
  } catch (error) {
    if (error instanceof KnowledgeExtractionError) return error.code;
    throw error;
  }
  throw new Error("expected extraction to fail");
}

describe("extractKnowledgeText", () => {
  it("reads PDF text", async () => {
    const result = await extractKnowledgeText("ficha.pdf", makePdf("Precio desde USD 150.000"));
    expect(result).toEqual({ format: "pdf", text: "Precio desde USD 150.000" });
  });

  it("rejects a PDF with no text layer as a scan", async () => {
    expect(await extractionError("escaneado.pdf", makePdf(""))).toBe("empty_text");
  });

  it("reads Word documents", async () => {
    const result = await extractKnowledgeText("faq.docx", await makeDocx(["Entrega: diciembre 2027", "Orientación norte"]));
    expect(result.format).toBe("docx");
    expect(result.text).toBe("Entrega: diciembre 2027\n\nOrientación norte");
  });

  it.each(["xlsx", "biff8", "ods"] as const)("reads %s spreadsheets as one CSV block per sheet", async (bookType) => {
    const extension = bookType === "biff8" ? "xls" : bookType;
    const data = makeSpreadsheet(
      [
        ["Proyecto", "Precio desde", "Entrega"],
        ["Torre Sur", "USD 150.000", "2027"],
      ],
      bookType,
    );
    const result = await extractKnowledgeText(`precios.${extension}`, data);
    expect(result.format).toBe(extension);
    expect(result.text).toBe("## Hoja: Precios\nProyecto,Precio desde,Entrega\nTorre Sur,USD 150.000,2027");
  });

  it("reads PowerPoint slides in order", async () => {
    const data = await makePptx([["Proyecto Rambla", "Desde USD 129.000"], ["Amenities: piscina"]]);
    const result = await extractKnowledgeText("presentacion.pptx", data);
    expect(result.text).toBe("Proyecto Rambla\nDesde USD 129.000\n\nAmenities: piscina");
  });

  it("reads OpenDocument text", async () => {
    const result = await extractKnowledgeText("notas.odt", await makeOdt(["Uno", "Dos &amp; tres"]));
    expect(result.text).toBe("Uno\nDos & tres");
  });

  it("reads CSV, Markdown, text, and JSON as text", async () => {
    expect((await extractKnowledgeText("a.csv", Buffer.from("a;b\n1;2\n"))).text).toBe("a;b\n1;2");
    expect((await extractKnowledgeText("a.md", Buffer.from("# Título\n\n\n\nTexto"))).text).toBe("# Título\n\nTexto");
    expect((await extractKnowledgeText("a.TXT", Buffer.from("hola"))).format).toBe("txt");
    expect((await extractKnowledgeText("a.json", Buffer.from('{"precio": 1}'))).text).toBe('{"precio": 1}');
  });

  it("strips HTML down to its text", async () => {
    const html = "<html><head><title>x</title></head><body><script>alert(1)</script><p>Precio&nbsp;desde</p><p>USD 1</p></body></html>";
    expect((await extractKnowledgeText("pagina.html", Buffer.from(html))).text).toBe("Precio desde\nUSD 1");
  });

  it("rejects formats it does not support", async () => {
    expect(await extractionError("foto.png", Buffer.from("png"))).toBe("unsupported_format");
  });

  it("rejects files whose bytes do not match the extension", async () => {
    expect(await extractionError("precios.xlsx", Buffer.from("not a zip"))).toBe("corrupt_file");
    expect(await extractionError("viejo.doc", Buffer.from("not ole"))).toBe("corrupt_file");
    expect(await extractionError("ficha.pdf", Buffer.from("hello"))).toBe("corrupt_file");
  });

  it("rejects a broken archive", async () => {
    const broken = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("garbage")]);
    expect(await extractionError("faq.docx", broken)).toBe("corrupt_file");
  });

  it("rejects empty text files", async () => {
    expect(await extractionError("vacio.txt", Buffer.from("  \n\n "))).toBe("empty_text");
  });
});

describe("decodeText", () => {
  it("handles Windows-1252 files saved by Excel or Notepad", () => {
    expect(decodeText(Buffer.from("Año;Precio\nPeñarol;100", "latin1"))).toBe("Año;Precio\nPeñarol;100");
  });

  it("handles UTF-8 with a BOM and UTF-16", () => {
    expect(decodeText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("señal")]))).toBe("señal");
    expect(decodeText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("año", "utf16le")]))).toBe("año");
  });
});

describe("htmlToText", () => {
  it("turns table cells and line breaks into readable text", () => {
    expect(htmlToText("<table><tr><td>A</td><td>B</td></tr></table>line<br>two")).toContain(" | A | B");
  });
});
