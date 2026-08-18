export const REPLAY_FAILURE_CATEGORIES = Object.freeze([
  "story-definition",
  "story-binding",
  "intent-reference",
  "engine-semantics",
  "state-persistence",
  "context-visibility",
  "narration",
  "ux-guidance",
]);

const CATEGORY_SET = new Set(REPLAY_FAILURE_CATEGORIES);
const RUNNERS = new Set(["world-action", "integration"]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function push(errors, condition, message) {
  if (!condition) errors.push(message);
}

export function validateReplayFixture(fixture) {
  const errors = [];
  const prefix = nonEmpty(fixture?.id) ? fixture.id : "(unnamed fixture)";

  push(errors, fixture && typeof fixture === "object" && !Array.isArray(fixture), `${prefix} must be an object.`);
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) return errors;

  push(errors, nonEmpty(fixture.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fixture.id), `${prefix}.id must be a kebab-case identifier.`);
  push(errors, nonEmpty(fixture.title), `${prefix}.title is required.`);
  push(errors, nonEmpty(fixture.adventureId), `${prefix}.adventureId is required.`);
  push(errors, CATEGORY_SET.has(fixture.category), `${prefix}.category must be a recognised failure category.`);
  push(errors, nonEmpty(fixture.invariant), `${prefix}.invariant is required.`);
  push(errors, RUNNERS.has(fixture.runner), `${prefix}.runner must be world-action or integration.`);

  push(errors, fixture.source && typeof fixture.source === "object", `${prefix}.source is required.`);
  if (fixture.source && typeof fixture.source === "object") {
    push(errors, ["reported-playtest", "regression-history"].includes(fixture.source.kind), `${prefix}.source.kind is invalid.`);
    push(errors, nonEmpty(fixture.source.reference), `${prefix}.source.reference is required.`);
  }

  push(errors, fixture.input && typeof fixture.input === "object", `${prefix}.input is required.`);
  if (fixture.input && typeof fixture.input === "object") {
    push(errors, ["act", "speak", "ask"].includes(fixture.input.mode), `${prefix}.input.mode must be act, speak, or ask.`);
    push(errors, nonEmpty(fixture.input.text), `${prefix}.input.text is required.`);
  }
  push(errors, Array.isArray(fixture.paraphrases) && fixture.paraphrases.length >= 2, `${prefix}.paraphrases must contain at least two alternate phrasings.`);
  if (Array.isArray(fixture.paraphrases)) {
    push(errors, fixture.paraphrases.every(nonEmpty), `${prefix}.paraphrases must contain only non-empty strings.`);
    push(errors, new Set(fixture.paraphrases.map((item) => item.trim().toLowerCase())).size === fixture.paraphrases.length, `${prefix}.paraphrases must be unique.`);
  }

  push(errors, fixture.expected && typeof fixture.expected === "object", `${prefix}.expected is required.`);
  if (fixture.expected && typeof fixture.expected === "object") {
    push(errors, nonEmpty(fixture.expected.intent), `${prefix}.expected.intent is required.`);
    push(errors, Array.isArray(fixture.expected.assertions) && fixture.expected.assertions.length > 0, `${prefix}.expected.assertions must not be empty.`);
  }

  push(errors, fixture.forbidden && typeof fixture.forbidden === "object", `${prefix}.forbidden is required.`);
  if (fixture.forbidden && typeof fixture.forbidden === "object") {
    const forbiddenCount = [
      ...(fixture.forbidden.stateChanges || []),
      ...(fixture.forbidden.narrationTerms || []),
      ...(fixture.forbidden.inventedEntities || []),
    ].length;
    push(errors, forbiddenCount > 0, `${prefix}.forbidden must name at least one prohibited outcome.`);
  }

  push(errors, Array.isArray(fixture.regressionTests) && fixture.regressionTests.length > 0, `${prefix}.regressionTests must link at least one test.`);

  if (fixture.runner === "world-action") {
    push(errors, fixture.initialState && typeof fixture.initialState === "object", `${prefix}.initialState is required for world-action fixtures.`);
    push(errors, nonEmpty(fixture.initialState?.currentLocation), `${prefix}.initialState.currentLocation is required for world-action fixtures.`);
    push(errors, fixture.expected?.world && typeof fixture.expected.world === "object", `${prefix}.expected.world is required for world-action fixtures.`);
  }

  if (fixture.runner === "integration") {
    push(errors, fixture.traceExpectation && typeof fixture.traceExpectation === "object", `${prefix}.traceExpectation is required for integration fixtures.`);
    if (fixture.traceExpectation && typeof fixture.traceExpectation === "object") {
      push(errors, nonEmpty(fixture.traceExpectation.owner), `${prefix}.traceExpectation.owner is required.`);
      push(errors, CATEGORY_SET.has(fixture.traceExpectation.owner), `${prefix}.traceExpectation.owner must be a recognised failure category.`);
      push(errors, Array.isArray(fixture.traceExpectation.evidence) && fixture.traceExpectation.evidence.length > 0, `${prefix}.traceExpectation.evidence must name the trace evidence used for classification.`);
      push(errors, ["consistent", "contradiction", "not-recorded"].includes(fixture.traceExpectation.narrationStatus), `${prefix}.traceExpectation.narrationStatus is invalid.`);
    }
  }

  return errors;
}

export function validateReplayCorpus(fixtures) {
  const errors = [];
  if (!Array.isArray(fixtures) || !fixtures.length) return ["Replay corpus must be a non-empty array."];
  const ids = new Set();
  for (const fixture of fixtures) {
    errors.push(...validateReplayFixture(fixture));
    if (nonEmpty(fixture?.id)) {
      if (ids.has(fixture.id)) errors.push(`Duplicate replay fixture id '${fixture.id}'.`);
      ids.add(fixture.id);
    }
  }
  return errors;
}
