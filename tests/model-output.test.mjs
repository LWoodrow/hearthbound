import test from "node:test";
import assert from "node:assert/strict";
import { parseModelJson, sanitizeModelText } from "../server/model-output.mjs";

test("removes leaked Qwen reasoning control tokens from dialogue fields", () => {
  const parsed = parseModelJson('{"reply":"Shall I fetch you one of those biscuits?}</think><\/s>","usedFacts":[]}');
  assert.equal(parsed.reply, "Shall I fetch you one of those biscuits?");
});

test("accepts strict JSON wrapped by thinking or markdown", () => {
  assert.deepEqual(parseModelJson('<think>private reasoning<\/think>\n```json\n{"answer":"Public answer"}\n```'), { answer:"Public answer" });
});

test("removes standalone model control tokens without changing ordinary prose", () => {
  assert.equal(sanitizeModelText("Ordinary prose. <\/s>"), "Ordinary prose.");
  assert.equal(sanitizeModelText("A cupboard contains {three} jars."), "A cupboard contains {three} jars.");
});
