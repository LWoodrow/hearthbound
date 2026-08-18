import test from "node:test";
import assert from "node:assert/strict";
import { listModelProfiles, resolveModelProfile } from "../server/model-profiles.mjs";
import { profileForOllamaModel } from "../server/model-runtime.mjs";
import { buildPromptPacket, clearPromptPacketTraces, inspectPromptPackets, promptInspectorEnabled, recordPromptPacket } from "../server/prompt-packets.mjs";

test("Qwen remains the default while Gemma is an explicit candidate profile", () => {
  const active = resolveModelProfile({});
  assert.equal(active.id, "qwen3-local-v1");
  assert.equal(active.model, "qwen3:14b-q4_K_M");
  assert.equal(active.status, "active");
  const gemma = resolveModelProfile({ DND_MODEL_PROFILE:"gemma4-12b-eval-v1", GEMMA_MODEL:"gemma-test:12b" });
  assert.equal(gemma.id, "gemma4-12b-eval-v1");
  assert.equal(gemma.model, "gemma-test:12b");
  assert.equal(gemma.status, "candidate");
  assert.equal(listModelProfiles().filter((profile) => profile.status === "active").length, 1);
});

test("unknown profiles fall back safely and context overrides are bounded", () => {
  const low = resolveModelProfile({ DND_MODEL_PROFILE:"unknown", DND_CONTEXT_TOKENS:"10" });
  assert.equal(low.id, "qwen3-local-v1");
  assert.equal(low.fallbackUsed, true);
  assert.equal(low.contextTokens, 2048);
  const high = resolveModelProfile({ DND_CONTEXT_TOKENS:"999999" });
  assert.equal(high.contextTokens, 262144);
});

test("any installed Ollama model can receive a bounded runtime profile", () => {
  const custom = profileForOllamaModel("llama3.2:latest");
  assert.equal(custom.id, "ollama:llama3.2:latest");
  assert.equal(custom.model, "llama3.2:latest");
  assert.equal(custom.provider, "ollama");
  assert.equal(custom.think, false);
  assert.ok(custom.contextTokens >= 2048);

  const known = profileForOllamaModel("gemma4:12b");
  assert.equal(known.id, "gemma4-12b-eval-v1");
  assert.equal(known.runtimeSelected, true);
});

test("prompt packets preserve required authority and shed optional history first", () => {
  const profile = { id:"test-v1", version:1, provider:"test", model:"test", contextTokens:2048 };
  const packet = buildPromptPacket({
    kind:"action-director",
    profile,
    responseTokens:512,
    reserveTokens:512,
    sections:[
      { id:"contract", role:"system", content:"RULES ".repeat(300), visibility:"secret" },
      { id:"facts", role:"user", content:"AUTHORITATIVE FACT", visibility:"private" },
      { id:"history", role:"user", content:"old history ".repeat(300), visibility:"private", required:false },
    ],
  });
  assert.deepEqual(packet.sections.map((section) => [section.id, section.included]), [["contract", true], ["facts", true], ["history", false]]);
  assert.equal(packet.messages.some((message) => message.content.includes("AUTHORITATIVE FACT")), true);
  assert.equal(packet.messages.some((message) => message.content.includes("old history")), false);
});

test("prompt packets report when mandatory authority cannot safely fit", () => {
  const packet = buildPromptPacket({
    kind:"oversized",
    profile:{ id:"small-v1", version:1, provider:"test", model:"test", contextTokens:2048 },
    responseTokens:512,
    reserveTokens:512,
    sections:[{ id:"mandatory", role:"system", content:"fixed authority ".repeat(500), visibility:"secret" }],
  });
  assert.equal(packet.overBudget, true);
  assert.equal(packet.sections[0].included, true);
});

test("changing model profiles does not alter the facts sent to the model", () => {
  const sections = [
    { id:"contract", role:"system", content:"Do not invent facts.", visibility:"secret" },
    { id:"facts", role:"user", content:JSON.stringify({ currentRoom:"pantry", visible:["sealed door"] }), visibility:"private" },
  ];
  const qwen = buildPromptPacket({ kind:"test", profile:resolveModelProfile({}), sections });
  const gemma = buildPromptPacket({ kind:"test", profile:resolveModelProfile({ DND_MODEL_PROFILE:"gemma4-12b-eval-v1" }), sections });
  assert.deepEqual(qwen.messages, gemma.messages);
  assert.notEqual(qwen.profile.id, gemma.profile.id);
});

test("the opt-in inspector isolates players and always redacts non-public content", () => {
  clearPromptPacketTraces();
  const profile = resolveModelProfile({});
  recordPromptPacket(buildPromptPacket({ kind:"test", profile, metadata:{ partyId:"party-a", playerId:"player-a", adventureId:"adventure-a" }, sections:[
    { id:"public", role:"user", content:"visible fact", visibility:"public" },
    { id:"private", role:"user", content:"private character detail", visibility:"private" },
    { id:"secret", role:"system", content:"the hidden answer", visibility:"secret" },
  ] }));
  recordPromptPacket(buildPromptPacket({ kind:"other", profile, metadata:{ partyId:"party-b", playerId:"player-b" }, sections:[{ id:"secret", role:"system", content:"other party secret" }] }));
  const view = inspectPromptPackets({ partyId:"party-a", playerId:"player-a" });
  assert.equal(view.length, 1);
  assert.equal(view[0].sections[0].preview, "visible fact");
  assert.equal(view[0].sections[1].preview, "[redacted]");
  assert.equal(view[0].sections[2].preview, "[redacted]");
  assert.equal(JSON.stringify(view).includes("hidden answer"), false);
  assert.equal(JSON.stringify(view).includes("other party secret"), false);
  assert.equal(promptInspectorEnabled({}), false);
  assert.equal(promptInspectorEnabled({ DND_PROMPT_INSPECTOR:"1" }), true);
});
