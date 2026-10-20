import { describe, expect, it } from "vitest";
import { capReply, foldText } from "../../src/engine/guardrails.js";

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
