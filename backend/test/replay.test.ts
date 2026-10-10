import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { applyTurn } from "../src/engine/transition";
import { ThreadSnapshot, TurnEvent, TurnOptions } from "../src/engine/types";

const options: TurnOptions = {
  fallbackMessage: "Te va a contactar un asesor.",
  nonTextMessage: "¿Me lo podés escribir? Así te ayudo.",
  maxReplyChars: 500,
  forbiddenTopics: ["renta garantizada"],
};

test("sample replay file follows the engine", () => {
  const file = JSON.parse(readFileSync(path.join(__dirname, "../replay/sample-turns.json"), "utf8")) as {
    steps: { event: TurnEvent; expect: { state: string; crm?: string; needsHuman?: boolean } }[];
  };
  let current: ThreadSnapshot = {
    state: "Greeting",
    paused: false,
    needsHuman: false,
    interest: null,
    budget: null,
    knowsProjects: null,
    callTime: null,
  };
  for (const step of file.steps) {
    const decision = applyTurn(current, step.event, options);
    assert.equal(decision.state, step.expect.state);
    if (step.expect.crm) assert.equal(decision.crm, step.expect.crm);
    if (step.expect.needsHuman != null) assert.equal(decision.needsHuman, step.expect.needsHuman);
    current = {
      state: decision.state,
      paused: decision.paused,
      needsHuman: decision.needsHuman,
      interest: decision.interest,
      budget: decision.budget,
      knowsProjects: decision.knowsProjects,
      callTime: decision.callTime,
    };
  }
});
