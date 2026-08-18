import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { REPLAY_FAILURE_CATEGORIES, validateReplayCorpus } from "../server/replay-fixture-schema.mjs";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import { createInitialWorldState, resolveWorldAction } from "../server/world-state.mjs";
import { storyEngineReplays } from "./fixtures/story-engine-replays.mjs";

function readPath(value, path) {
  return String(path).split(".").reduce((current, key) => current?.[key], value);
}

function testNames() {
  return ["tests/adventure-engine.test.mjs", "tests/server.test.mjs", "tests/story-recaps.test.mjs"]
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
    .flatMap((source) => [...source.matchAll(/test\("([^"]+)"/g)].map((match) => match[1]));
}

test("the reported story-engine failure corpus is valid, unique, and classified", () => {
  assert.deepEqual(validateReplayCorpus(storyEngineReplays), []);
  assert.ok(storyEngineReplays.length >= 14);
  const categories = new Set(storyEngineReplays.map((fixture) => fixture.category));
  for (const expected of ["story-binding", "intent-reference", "engine-semantics", "state-persistence", "context-visibility"]) {
    assert.ok(categories.has(expected), `missing incident category ${expected}`);
  }
  for (const category of categories) assert.ok(REPLAY_FAILURE_CATEGORIES.includes(category));
});

test("every replay fixture links to an existing named regression test", () => {
  const available = new Set(testNames());
  for (const fixture of storyEngineReplays) {
    for (const name of fixture.regressionTests) {
      assert.ok(available.has(name), `${fixture.id} links missing regression test '${name}'`);
    }
  }
});

test("generic world-action incidents replay their required state outcomes", () => {
  const fixtures = storyEngineReplays.filter((fixture) => fixture.runner === "world-action");
  assert.ok(fixtures.length >= 8);

  for (const fixture of fixtures) {
    for (const wording of [fixture.input.text, ...fixture.paraphrases]) {
      const initial = createInitialWorldState(lanternBelowAdventure, fixture.initialState);
      const result = resolveWorldAction({
        definition:lanternBelowAdventure,
        state:initial,
        action:wording,
        actorId:"dad",
        inventory:[],
        mode:fixture.input.mode,
      });
    const expected = fixture.expected.world;
    if (Object.hasOwn(expected, "accepted")) assert.equal(result.accepted, expected.accepted, fixture.id);
    if (Object.hasOwn(expected, "handled")) assert.equal(result.handled, expected.handled, fixture.id);
    if (expected.reason) assert.equal(result.reason, expected.reason, fixture.id);
    if (expected.currentLocation) assert.equal(result.state.currentLocation, expected.currentLocation, fixture.id);
    if (expected.previousLocation) assert.equal(result.state.previousLocation, expected.previousLocation, fixture.id);
    if (expected.visited) assert.deepEqual(result.state.visited, expected.visited, fixture.id);
    if (expected.messageIncludes) assert.match(result.message || "", new RegExp(expected.messageIncludes, "i"), fixture.id);
    for (const [path, value] of Object.entries(expected.pathEquals || {})) assert.deepEqual(readPath(result.state, path), value, `${fixture.id}:${path}`);
      for (const path of expected.pathMissing || []) assert.equal(readPath(result.state, path), undefined, `${fixture.id}:${path}:${wording}`);
    }
  }
});

test("integration incidents retain explicit required and forbidden outcomes for later executors", () => {
  const fixtures = storyEngineReplays.filter((fixture) => fixture.runner === "integration");
  assert.ok(fixtures.length >= 6);
  for (const fixture of fixtures) {
    assert.ok(fixture.expected.assertions.length > 0, fixture.id);
    const forbidden = [
      ...(fixture.forbidden.stateChanges || []),
      ...(fixture.forbidden.narrationTerms || []),
      ...(fixture.forbidden.inventedEntities || []),
    ];
    assert.ok(forbidden.length > 0, fixture.id);
    assert.equal(fixture.traceExpectation.owner, fixture.category, fixture.id);
    assert.ok(fixture.traceExpectation.evidence.length >= 2, fixture.id);
    assert.equal(fixture.traceExpectation.narrationStatus, "consistent", fixture.id);
  }
});

test("story-engine planning keeps the living authoring-ruleset guardrail", () => {
  const rules=readFileSync(new URL("../docs/STORY-BUILDING-RULESET.md",import.meta.url),"utf8");
  const roadmap=readFileSync(new URL("../docs/STORY-ENGINE-ROADMAP.md",import.meta.url),"utf8");
  const backlog=readFileSync(new URL("../BACKLOG.md",import.meta.url),"utf8");
  assert.match(rules,/Living-ruleset guardrail/i);
  assert.match(rules,/same work package/i);
  assert.match(rules,/existing rule already covered/i);
  assert.match(roadmap,/Delivery guardrail/i);
  assert.match(roadmap,/STORY-BUILDING-RULESET\.md/);
  assert.match(backlog,/Maintenance guardrail/i);
});
