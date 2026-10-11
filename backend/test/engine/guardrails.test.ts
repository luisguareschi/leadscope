import { describe, expect, it } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { capReply, findForbidden, foldText } from "../../src/engine/guardrails.js";
import { altamiraConfig } from "../../prisma/seed-data/altamira.js";

const altamira = parseCompanyConfig(altamiraConfig).forbiddenTopics.patterns;

describe("findForbidden with Altamira's patterns", () => {
  it.each([
    "La rentabilidad estimada es muy buena",
    "Te garantizamos la renta durante 3 años",
    "Tiene alquiler garantizado",
    "El retorno de la inversión es de 6 años",
    "Un 7,5 % de rentabilidad",
    "Es una zona con mucha plusvalía",
    "El ROI es alto",
    "Con una renta mensual asegurada",
  ])("blocks: %s", (reply) => {
    expect(findForbidden(reply, altamira)).not.toBeNull();
  });

  it.each([
    "Los precios arrancan en USD 129.000",
    "La entrega está prevista para diciembre de 2027",
    "Las unidades al frente miran al norte",
    "Tenemos financiación: reserva con USD 5.000 y saldo a la entrega",
    "El edificio tiene garantía de construcción",
    "Excelente rendimiento energético",
  ])("allows: %s", (reply) => {
    expect(findForbidden(reply, altamira)).toBeNull();
  });

  it("matches regardless of accents and case", () => {
    expect(findForbidden("PLUSVALÍA", ["plusvalia"])).toBe("plusvalia");
    expect(foldText("Garantía Año")).toBe("garantia ano");
  });

  it("skips invalid patterns instead of crashing", () => {
    expect(findForbidden("texto", ["(", "texto"])).toBe("texto");
  });
});

describe("capReply", () => {
  it("leaves short replies alone", () => {
    expect(capReply("  Hola.  ", 50)).toBe("Hola.");
  });

  it("cuts at the last sentence that fits", () => {
    expect(capReply("Uno dos tres. Cuatro cinco seis. Siete ocho nueve.", 35)).toBe("Uno dos tres. Cuatro cinco seis.");
  });

  it("cuts at a word with an ellipsis when there is no sentence end", () => {
    const capped = capReply("palabra ".repeat(20), 30);
    expect(capped.length).toBeLessThanOrEqual(31);
    expect(capped.endsWith("…")).toBe(true);
  });
});
