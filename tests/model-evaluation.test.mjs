import test from "node:test";
import assert from "node:assert/strict";
import { compareModelRuns, scoreNarration } from "../server/model-evaluation.mjs";

const sample={id:"letter-inspection",requiredFacts:["seal remains intact","sender unknown"],forbiddenTerms:["Mara","pantry","cellar"],repetitionTerms:["seal"]};
test("model scoring separates canonical faithfulness from forbidden invention",()=>{
  const score=scoreNarration(sample,{text:"The seal remains intact and the sender unknown.",latencyMs:120});
  assert.equal(score.faithfulness,1); assert.equal(score.inventionRate,0); assert.equal(score.latencyMs,120);
});
test("Qwen and Gemma runs use the same versioned evaluation corpus",()=>{
  const report=compareModelRuns([sample],{"qwen3-local-v1":[{text:"The seal remains intact; sender unknown."}],"gemma4-12b-eval-v1":[{text:"The seal remains intact. Mara sent it to the pantry."}]});
  assert.equal(report["qwen3-local-v1"].meanInventionRate,0);
  assert.ok(report["gemma4-12b-eval-v1"].meanInventionRate>0);
});
