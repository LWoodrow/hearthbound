import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDatabase } from "../server/database.mjs";
import { appendTurnTrace, assessNarrationOutcome, captureTurnState, completeTurnTrace, createTurnTrace, interpretTurn, listTurnTraces, redactTurnTrace } from "../server/turn-traces.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import { createInitialWorldState, resolveWorldAction } from "../server/world-state.mjs";

test("turn interpretation records literal roles and visible entity candidates", () => {
  const state = captureTurnState({
    worldState:{ currentLocation:"back-room", visited:["outside-inn","inn","back-room"] },
    roomAuthority:{ currentLocation:{ features:["sealed silver-moth letter","oil lamp","fresh inkwell"], exits:["inn"] } },
  });
  const parsed = interpretTurn({ mode:"act", text:"warm the silver-moth letter with the oil lamp", state });
  assert.equal(parsed.intent, "other");
  assert.equal(parsed.verb, "warm");
  assert.equal(parsed.target, "silver-moth letter");
  assert.equal(parsed.instrument, "oil lamp");
  assert.deepEqual(new Set(parsed.entityCandidates.map((item) => item.id)), new Set(["sealed silver-moth letter","oil lamp"]));
});

test("completed turn traces distinguish no-op narration from canonical state changes", () => {
  const before = captureTurnState({ worldState:{ currentLocation:"outside-inn", visited:["outside-inn"] } });
  const after = captureTurnState({ worldState:{ currentLocation:"inn", previousLocation:"outside-inn", visited:["outside-inn","inn"] } });
  const trace = completeTurnTrace(createTurnTrace({ adventureId:"lantern-below", playerId:"secret-player", mode:"act", audience:"nearby", text:"enter the inn", before, modelProfile:"test" }), {
    source:"rules", selectedRule:"structured-world-action", after, publicFacts:["The company enters the inn taproom."], narration:"The company enters the inn taproom.", promptPacketIds:["packet-secret"], rejectedProposals:["invented destination"], diagnostic:{ selectedAffordance:"move:outside-inn:inn", candidateAffordances:[{ id:"move:outside-inn:inn", kind:"movement", target:"inn", failedPrerequisites:[] }], rejectedAlternatives:[] },
  });
  assert.ok(trace.outcome.stateDelta.includes("location"));
  assert.ok(trace.outcome.stateDelta.includes("visited"));
  assert.equal(trace.resolution.selectedRule, "structured-world-action");
  assert.equal(trace.resolution.selectedAffordance, "move:outside-inn:inn");
  assert.deepEqual(trace.model.promptPacketIds, ["packet-secret"]);
  const redacted = redactTurnTrace(trace);
  assert.equal(redacted.playerId, undefined);
  assert.equal(JSON.stringify(redacted).includes("secret-player"), false);
  assert.equal(redacted.model.rejectedProposalCount, 1);
  assert.equal(JSON.stringify(redacted).includes("invented destination"), false);
  assert.equal(redacted.resolution.candidateAffordanceCount, 1);
  assert.equal(redacted.outcome.narrationAssessment.status, "consistent");
});

test("a narrator contradiction is distinct from a correct canonical transition", () => {
  const before = captureTurnState({ worldState:{ currentLocation:"outside-inn", visited:["outside-inn"] } });
  const after = captureTurnState({ worldState:{ currentLocation:"inn", previousLocation:"outside-inn", visited:["outside-inn","inn"] } });
  const trace = completeTurnTrace(createTurnTrace({ adventureId:"lantern-below", playerId:"dad", mode:"act", text:"enter the inn", before }), {
    source:"rules", selectedRule:"structured-world-action", after, publicFacts:["The company enters the inn."], narration:"The company remains outside the inn beneath the sign.",
  });
  assert.ok(trace.outcome.stateDelta.includes("location"));
  assert.equal(trace.resolution.accepted, true);
  assert.deepEqual(trace.outcome.narrationAssessment, { status:"contradiction", issues:["narration-kept-previous-location"], factCoverage:0.5 });
  assert.deepEqual(assessNarrationOutcome({ narration:"The company enters the inn.", before, after, publicFacts:["The company enters the inn."] }).issues, []);
});

test("state hashes are deterministic and change with authoritative state", () => {
  const first = captureTurnState({ worldState:{ currentLocation:"inn", objects:{ door:{ open:false, locked:false } } } });
  const reordered = captureTurnState({ worldState:{ objects:{ door:{ locked:false, open:false } }, currentLocation:"inn" } });
  const changed = captureTurnState({ worldState:{ currentLocation:"inn", objects:{ door:{ open:true, locked:false } } } });
  assert.equal(first.hash, reordered.hash);
  assert.notEqual(first.hash, changed.hash);
});

test("world resolution reports considered affordances, failures, and the selected rule", () => {
  const state = createInitialWorldState(lanternBelowAdventure, { currentLocation:"outside-inn" });
  const movement = resolveWorldAction({ definition:lanternBelowAdventure, state, action:"enter the inn", actorId:"dad" });
  assert.equal(movement.diagnostic.selectedAffordance, "move:outside-inn:inn");
  assert.ok(movement.diagnostic.candidateAffordances.some((item) => item.target === "inn"));

  const lockedState = createInitialWorldState(lanternBelowAdventure, { currentLocation:"cellar", visited:["outside-inn","inn","kitchen","pantry","cellar"], objects:{ "keyed-stone-door":{ discovered:true, locked:true, open:false } } });
  const blocked = resolveWorldAction({ definition:lanternBelowAdventure, state:lockedState, action:"go through the keyed stone door", actorId:"dad" });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, "requirements");
  assert.ok(blocked.diagnostic.candidateAffordances.some((item) => item.failedPrerequisites.some((failure) => failure.predicate === "unlocked")));
});

test("trace persistence is bounded per adventure and assigns monotonic state revisions", () => {
  const folder = mkdtempSync(join(tmpdir(), "hearthbound-traces-"));
  const db = createDatabase(join(folder, "test.sqlite"));
  try {
    for (let revision = 1; revision <= 35; revision += 1) appendTurnTrace(db, "party-first-company", "lantern-below", { id:`turn-${revision}`, before:{ hash:`hash-${revision - 1}` }, after:{ hash:`hash-${revision}` } });
    const traces = listTurnTraces(db, "party-first-company", "lantern-below", 30);
    assert.equal(traces.length, 30);
    assert.equal(traces[0].id, "turn-6");
    assert.deepEqual(traces.at(-1).stateRevision, { before:34, after:35, changed:true });
    assert.deepEqual(listTurnTraces(db, "party-first-company", "another-adventure"), []);
  } finally {
    db.close();
    rmSync(folder, { recursive:true, force:true });
  }
});

test("redaction removes hidden state and candidate identifiers", () => {
  const redacted = redactTurnTrace({
    version:1, id:"secret-test", action:{ mode:"act", text:"look around" },
    before:{ hash:"a", location:"cellar", flags:{ secretGuardian:true }, discoveries:["hidden-ending"], visibleFeatures:["lantern"] },
    after:{ hash:"b", location:"cellar", objects:{ "secret-door":{ discovered:false } }, visibleFeatures:["lantern"] },
    interpretation:{ intent:"observe" },
    resolution:{ source:"rules", selectedRule:"structured-world-action", selectedAffordance:"observe:cellar", candidateAffordances:[{ id:"move:cellar:secret-vault", failedPrerequisites:[{ path:"objects.secret-door.discovered", predicate:"visible" }] }], rejectedAlternatives:["move:cellar:secret-vault"] },
    outcome:{ publicFacts:["A lantern is visible."], stateDelta:[] }, model:{ rejectedProposals:["SECRET PROPHECY"] },
  });
  const serialized = JSON.stringify(redacted);
  for (const secret of ["secretGuardian","hidden-ending","secret-door","secret-vault","SECRET PROPHECY"]) assert.equal(serialized.includes(secret), false);
  assert.equal(redacted.resolution.candidateAffordanceCount, 1);
  assert.equal(redacted.resolution.failedPrerequisiteCount, 1);
});
