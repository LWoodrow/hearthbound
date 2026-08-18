import test from "node:test";
import assert from "node:assert/strict";
import { buildHearthboundPlaytestStatus, playtestToolsEnabled } from "../server/playtest-status.mjs";

test("playtest tools are explicitly opt-in", () => {
  assert.equal(playtestToolsEnabled({}), false);
  assert.equal(playtestToolsEnabled({ DND_PLAYTEST_TOOLS:"1" }), true);
});

test("the Lantern playtest checklist follows authoritative route and flags", () => {
  const status = buildHearthboundPlaytestStatus({
    adventure:{ id:"world-hearthbound-lantern-below", status:"active" },
    dmState:{ clueStage:7 },
    worldState:{ currentLocation:"passage", visited:["outside-inn","inn","back-room","kitchen","pantry","cellar","cellar-passage","mothglass","passage"], flags:{} },
  });
  assert.equal(status.completed, 10);
  assert.equal(status.total, 13);
  assert.equal(status.nextGate, "Reach Mara's collapsed survey alcove");
  assert.equal(status.gates.find((gate) => gate.id === "spindle").passed, true);
  assert.equal(status.gates.find((gate) => gate.id === "guardian").passed, false);
});

test("the playtest checklist exposes no hidden adventure content", () => {
  const status = buildHearthboundPlaytestStatus({
    adventure:{ id:"world-hearthbound-lantern-below", status:"active", hiddenTruth:"SECRET" },
    dmState:{ clueStage:0, adventureBible:{ culprit:"SECRET CULPRIT" } },
    worldState:{ currentLocation:"outside-inn", visited:["outside-inn"] },
    events:[{ kind:"narration", speaker:"Dungeon Master", text:"Public opening" }],
  });
  const serialized = JSON.stringify(status);
  assert.equal(serialized.includes("SECRET"), false);
  assert.equal(serialized.includes("Public opening"), true);
});

test("the playtest export carries only supplied redacted turn traces", () => {
  const turnTrace = { id:"turn-1", before:{ revision:0, hash:"before" }, after:{ revision:1, hash:"after" }, resolution:{ selectedRule:"structured-world-action" } };
  const status = buildHearthboundPlaytestStatus({ adventure:{ id:"lantern-below" }, turnTraces:[turnTrace] });
  assert.equal(status.version, 2);
  assert.deepEqual(status.turnTraces, [turnTrace]);
});
