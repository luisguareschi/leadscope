import { describe, expect, it } from "vitest";
import {
  capReply,
  foldText,
  MAX_REPLY_BUBBLES,
  normalizeReplies,
} from "../../src/engine/guardrails.js";

describe("foldText", () => {
  it("lower-cases and strips accents", () => {
    expect(foldText("Garantía Año PLUSVALÍA")).toBe("garantia ano plusvalia");
  });
});

describe("capReply", () => {
  it("leaves short replies alone", () => {
    expect(capReply("  Hola.  ", 50)).toBe("Hola.");
  });

  it("cuts at the last sentence that fits", () => {
    expect(
      capReply("Uno dos tres. Cuatro cinco seis. Siete ocho nueve.", 35),
    ).toBe("Uno dos tres. Cuatro cinco seis.");
  });

  it("cuts at a word with an ellipsis when there is no sentence end", () => {
    const capped = capReply("palabra ".repeat(20), 30);
    expect(capped.length).toBeLessThanOrEqual(31);
    expect(capped.endsWith("…")).toBe(true);
  });
});

describe("normalizeReplies", () => {
  it("keeps distinct trimmed bubbles from replies array", () => {
    expect(
      normalizeReplies(
        {
          replies: [
            "  Hola Ana, soy Almira.  ",
            "",
            "Tenemos opciones en Pocitos.",
            "¿Qué presupuesto manejás?",
          ],
        },
        600,
      ),
    ).toEqual([
      "Hola Ana, soy Almira.",
      "Tenemos opciones en Pocitos.",
      "¿Qué presupuesto manejás?",
    ]);
  });

  it("splits a single multi-paragraph string on blank lines", () => {
    expect(
      normalizeReplies(
        {
          reply:
            "Hola Ana, soy Almira.\n\nTenemos dos proyectos en Montevideo.\n\n¿Cuál te interesa?",
        },
        600,
      ),
    ).toEqual([
      "Hola Ana, soy Almira.",
      "Tenemos dos proyectos en Montevideo.",
      "¿Cuál te interesa?",
    ]);
  });

  it("caps bubble count at MAX_REPLY_BUBBLES without dropping overflow text", () => {
    const result = normalizeReplies(
      { replies: ["Uno.", "Dos.", "Tres.", "Cuatro.", "Cinco.", "Seis."] },
      600,
    );
    expect(result).toHaveLength(MAX_REPLY_BUBBLES);
    expect(result.at(-1)).toBe("Cuatro.\n\nCinco.\n\nSeis.");
  });

  it("caps total length across bubbles to maxTotalChars", () => {
    const result = normalizeReplies(
      {
        replies: [
          "Primer mensaje corto.",
          "Segundo mensaje bastante largo que supera el presupuesto total permitido para este turno.",
          "Tercer mensaje que no entra.",
        ],
      },
      65,
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.join("\n\n").length).toBeLessThanOrEqual(66);
    expect(result).not.toContain("Tercer mensaje que no entra.");
  });

  it("keeps a short final bubble that fits verbatim even when remaining budget is under 20 chars", () => {
    // 32 chars + 2 separator + 10 chars = 44 <= 46 (budget for 2nd bubble is 12 < 20)
    const result = normalizeReplies(
      {
        replies: ["Tenemos opciones en Tres Cruces.", "¿Te sirve?"],
      },
      46,
    );
    expect(result).toEqual(["Tenemos opciones en Tres Cruces.", "¿Te sirve?"]);
  });

  it("returns an empty array for blank input", () => {
    expect(normalizeReplies({ replies: ["  ", "\n"] }, 600)).toEqual([]);
    expect(normalizeReplies({ reply: "   " }, 600)).toEqual([]);
  });
});
