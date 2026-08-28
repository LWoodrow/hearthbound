import { createInitialWorldState, requirementsMet } from "./world-state.mjs";
import { interactionMatch } from "./intent-resolver.mjs";

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalise = (value) => String(value || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (value) => normalise(value).split(" ").filter(Boolean);
const readPath = (value, path) => String(path || "").split(".").filter(Boolean).reduce((current, key) => current?.[key], value);

function setPath(value, path, nextValue) {
  const parts = String(path || "").split(".").filter(Boolean);
  let current = value;
  for (const part of parts.slice(0, -1)) current = current[part] ||= {};
  current[parts.at(-1)] = clone(nextValue);
}

function addPath(value, path, entry) {
  const current = readPath(value, path);
  setPath(value, path, [...new Set([...(Array.isArray(current) ? current : []), entry])]);
}

function references(action, aliases = []) {
  const words = normalise(action);
  return aliases.some((alias) => {
    const phrase = normalise(alias);
    if (!phrase) return false;
    if (words.includes(phrase)) return true;
    const meaningful = tokens(phrase).filter((token) => token.length > 3);
    return meaningful.length > 0 && meaningful.every((token) => tokens(words).includes(token));
  });
}

function verbMatches(action, verbs = []) {
  const words = new Set(tokens(action));
  return verbs.some((verb) => tokens(verb).every((token) => words.has(token)));
}

function failedRequirements(state, requirements = []) {
  return requirements.filter((requirement) => !requirementsMet(state, [requirement])).map((requirement) => ({
    path:String(requirement.path || ""),
    predicate:Object.hasOwn(requirement, "equals") ? "equals" : Object.hasOwn(requirement, "minimum") ? "minimum" : Object.hasOwn(requirement, "includes") ? "includes" : "truthy",
  }));
}

export function createCanonicalState(definition, persisted = {}) {
  const world = createInitialWorldState(definition, persisted);
  return {
    ...world,
    schemaVersion:2,
    discoveries:[...new Set([...(persisted.discoveries || [])])],
    completedInteractions:[...new Set([...(persisted.completedInteractions || [])])],
    resources:{ ...(definition.initialResources || {}), ...(persisted.resources || {}) },
    clocks:{ ...(definition.initialClocks || {}), ...(persisted.clocks || {}) },
    knowledge:{ ...(persisted.knowledge || {}) },
    outcomes:Array.isArray(persisted.outcomes) ? persisted.outcomes.slice(-100) : [],
  };
}

export function canonicalStage(definition, state) {
  const locations = (state.visited || []).map((id) => Number(definition.locations?.[id]?.stage || 0));
  const completed = state.completedInteractions || [];
  const interactions = (definition.interactions || []).filter((entry) => completed.includes(entry.id)).map((entry) => Number(entry.stage || 0));
  return Math.max(0, ...locations, ...interactions);
}

export function canonicalProjection(definition, state) {
  const location = definition.locations?.[state.currentLocation];
  return {
    ...(state.flags || {}),
    ...(state.knowledge || {}),
    currentLocationKey:state.currentLocation,
    locationName:location?.name || state.currentLocation,
    locationNote:location?.description || "",
    clueStage:canonicalStage(definition, state),
    dangerClock:Number(state.clocks?.danger || 0),
    storyDiscoveries:[...(state.discoveries || [])],
    ...(Number.isFinite(Number(location?.arrivalStage)) ? { lanternArrivalStage:Number(location.arrivalStage) } : {}),
  };
}

export function assertCanonicalState(definition, state) {
  const errors = [];
  if (state.schemaVersion !== 2) errors.push("canonical state schemaVersion must be 2");
  if (!definition.locations?.[state.currentLocation]) errors.push(`unknown current location '${state.currentLocation}'`);
  if (state.previousLocation && !definition.locations?.[state.previousLocation]) errors.push(`unknown previous location '${state.previousLocation}'`);
  for (const location of state.visited || []) if (!definition.locations?.[location]) errors.push(`visited unknown location '${location}'`);
  for (const interaction of state.completedInteractions || []) if (!(definition.interactions || []).some((entry) => entry.id === interaction)) errors.push(`completed unknown interaction '${interaction}'`);
  for (const discovery of state.discoveries || []) if (!definition.discoveries?.[discovery] && !definition.story?.clues?.[discovery]) errors.push(`unknown discovery '${discovery}'`);
  if (!state.visited.includes(state.currentLocation)) errors.push("current location must be visited");
  return errors;
}

function applyEffects(state, effects = []) {
  for (const effect of effects) {
    if (effect.op === "set") setPath(state, effect.path, effect.value);
    else if (effect.op === "add") addPath(state, effect.path, effect.value);
    else if (effect.op === "increment") setPath(state, effect.path, Number(readPath(state, effect.path) || 0) + Number(effect.value || 1));
    else if (effect.op === "consume") setPath(state, effect.path, Math.max(0, Number(readPath(state, effect.path) || 0) - Number(effect.value || 1)));
  }
}

function candidateFor(interaction, state, action, mode) {
  // A completed one-shot interaction is an idempotent fact, not a newly
  // unsatisfied action. Its original prerequisites commonly become false as a
  // direct result of completion (for example, opening requires closed=false).
  // Keep the location boundary, but allow the stable repeat response to win.
  const repeated = interaction.once !== false && state.completedInteractions.includes(interaction.id);
  const failed = repeated ? [] : failedRequirements(state, interaction.requires || []);
  if (interaction.location && interaction.location !== state.currentLocation) failed.push({ path:"currentLocation", predicate:"equals" });
  if (!repeated && interaction.forbids && requirementsMet(state, interaction.forbids)) failed.push({ path:"forbids", predicate:"false" });
  const match = interactionMatch(interaction, action, mode);
  return { id:interaction.id, kind:"authored-interaction", target:(interaction.targets || [])[0] || "", priority:Number(interaction.priority || 0), ...match, confidence:match.target.selected?.confidence || 0, failedPrerequisites:failed, repeated };
}

export function availableInteractions(definition, suppliedState, mode = "act") {
  const state = createCanonicalState(definition, suppliedState);
  return (definition.interactions || []).filter((interaction) => {
    if (interaction.location && interaction.location !== state.currentLocation) return false;
    if (interaction.modes?.length && !interaction.modes.includes(mode)) return false;
    if (!requirementsMet(state, interaction.requires || [])) return false;
    if (interaction.once !== false && state.completedInteractions.includes(interaction.id)) return false;
    return true;
  });
}

// Conversation can establish a single authored next step before the player
// explicitly accepts it. Keep that offer deterministic: it must identify one
// currently available interaction by its authored target and prerequisites.
export function conversationInteractionOffer(definition, suppliedState, action, mode = "speak") {
  const state = createCanonicalState(definition, suppliedState);
  const candidates = (definition.interactions || [])
    .map((interaction) => ({ interaction, candidate:candidateFor(interaction, state, action, mode) }))
    .filter(({ candidate }) => candidate.modeMatch
      && candidate.targetMatch
      && candidate.instrumentMatch
      && candidate.groupMatch
      && candidate.failedPrerequisites.length === 0
      && !candidate.repeated)
    .sort((left, right) => right.candidate.priority - left.candidate.priority
      || right.candidate.confidence - left.candidate.confidence);
  if (candidates.length !== 1) return null;
  return { interactionId:candidates[0].interaction.id };
}

export function resolveAuthoredInteraction({ definition, state:suppliedState, action, mode = "act", excludeInteractionIds = [] }) {
  const state = createCanonicalState(definition, suppliedState);
  const excluded = new Set(excludeInteractionIds);
  const candidates = (definition.interactions || []).filter((interaction) => !excluded.has(interaction.id)).map((interaction) => candidateFor(interaction, state, action, mode));
  const matched = candidates.filter((candidate) => candidate.modeMatch && candidate.verbMatch && candidate.targetMatch && candidate.instrumentMatch && candidate.groupMatch);
  const available = matched.filter((candidate) => candidate.failedPrerequisites.length === 0)
    .sort((a,b) => b.priority - a.priority || b.confidence - a.confidence);
  if (!available.length) {
    const blocked = matched.filter((candidate) => candidate.failedPrerequisites.length > 0
      && !candidate.failedPrerequisites.some((failure) => failure.path === "currentLocation"))
      .sort((a,b) => b.priority - a.priority || b.confidence - a.confidence)[0];
    if (blocked) {
      const interaction = definition.interactions.find((entry) => entry.id === blocked.id);
      return {
        handled:true, accepted:false, state, interactionId:interaction.id, reason:"prerequisites",
        message:interaction.blocked?.message || `That action cannot be completed yet. An established prerequisite for ${interaction.targets?.[0] || "the interaction"} has not been satisfied.`,
        publicFacts:interaction.blocked?.publicFacts || [],
        diagnostic:{ candidateAffordances:matched, selectedAffordance:`blocked:${interaction.id}`, rejectedAlternatives:matched.filter((item) => item.id !== interaction.id).map((item) => item.id) },
      };
    }
    return { handled:false, state, diagnostic:{ candidateAffordances:matched, selectedAffordance:"", rejectedAlternatives:matched.map((item) => item.id) } };
  }
  const selected = available[0];
  const interaction = definition.interactions.find((entry) => entry.id === selected.id);
  const repeated = state.completedInteractions.includes(interaction.id);
  if (repeated && interaction.once !== false) return {
    handled:true, accepted:true, repeated:true, state, interactionId:interaction.id,
    message:interaction.repeat?.message || interaction.outcome.message,
    publicFacts:interaction.repeat?.publicFacts || interaction.outcome.publicFacts || [],
    diagnostic:{ candidateAffordances:candidates, selectedAffordance:`interaction:${interaction.id}`, rejectedAlternatives:candidates.filter((item) => item.id !== interaction.id).map((item) => item.id) },
  };
  if (interaction.check) return {
    handled:true, accepted:true, state, interactionId:interaction.id, check:{ ...interaction.check, interactionId:interaction.id },
    message:interaction.check.reason,
    publicFacts:[],
    diagnostic:{ candidateAffordances:candidates, selectedAffordance:`interaction:${interaction.id}`, rejectedAlternatives:candidates.filter((item) => item.id !== interaction.id).map((item) => item.id) },
  };
  const next = clone(state);
  applyEffects(next, interaction.effects || []);
  if (interaction.once !== false) addPath(next, "completedInteractions", interaction.id);
  next.revision = Number(state.revision || 0) + 1;
  const publicFacts = interaction.outcome.publicFacts || [interaction.outcome.message];
  next.outcomes = [...next.outcomes, { revision:next.revision, interactionId:interaction.id, publicFacts }].slice(-100);
  const errors = assertCanonicalState(definition, next);
  if (errors.length) throw new Error(`Canonical interaction '${interaction.id}' produced invalid state: ${errors.join("; ")}`);
  return {
    handled:true, accepted:true, state:next, interactionId:interaction.id, message:interaction.outcome.message, publicFacts,
    diagnostic:{ candidateAffordances:candidates, selectedAffordance:`interaction:${interaction.id}`, rejectedAlternatives:candidates.filter((item) => item.id !== interaction.id).map((item) => item.id) },
  };
}

export function resolveAuthoredInteractionSequence({ definition, state:suppliedState, action, mode = "act" }) {
  let state = createCanonicalState(definition, suppliedState);
  const verbCount = new Set((definition.interactions || [])
    .flatMap((interaction) => interaction.verbs || [])
    .filter((verb) => verbMatches(action, [verb])))
    .size;
  if (verbCount < 2) return resolveAuthoredInteraction({ definition, state, action, mode });

  const applied = [];
  const messages = [];
  const facts = [];
  let finalDiagnostic = { candidateAffordances:[], selectedAffordance:"", rejectedAlternatives:[] };
  for (let step = 0; step < 8; step += 1) {
    const outcome = resolveAuthoredInteraction({ definition, state, action, mode, excludeInteractionIds:applied });
    finalDiagnostic = outcome.diagnostic || finalDiagnostic;
    if (!outcome.handled || !outcome.accepted) {
      if (!applied.length) return outcome;
      break;
    }
    state = outcome.state;
    applied.push(outcome.interactionId);
    messages.push(outcome.message);
    facts.push(...(outcome.publicFacts || []));
  }
  if (!applied.length) return { handled:false, state, diagnostic:finalDiagnostic };
  return {
    handled:true, accepted:true, state, interactionId:applied.at(-1), interactionIds:applied,
    message:messages.join(" "), publicFacts:[...new Set(facts)],
    diagnostic:{ ...finalDiagnostic, selectedAffordance:`interaction-sequence:${applied.join(",")}` },
  };
}

export function resolveCheckedInteraction({ definition, state:suppliedState, interactionId, success }) {
  const state = createCanonicalState(definition, suppliedState);
  const interaction = (definition.interactions || []).find((entry) => entry.id === interactionId);
  if (!interaction?.check) return { handled:false, state };
  const branch = success ? interaction.success : interaction.failure;
  const next = clone(state);
  applyEffects(next, branch.effects || []);
  if (success && interaction.once !== false) addPath(next, "completedInteractions", interaction.id);
  next.revision = Number(state.revision || 0) + 1;
  const publicFacts = branch.publicFacts || [branch.message];
  next.outcomes = [...next.outcomes, { revision:next.revision, interactionId:interaction.id, success, publicFacts }].slice(-100);
  return { handled:true, accepted:true, state:next, interactionId:interaction.id, message:branch.message, publicFacts };
}

export function validateInteractions(definition) {
  const errors = [];
  const ids = new Set();
  const idempotency = new Set();
  const producedPaths = new Set((definition.interactions || []).flatMap((interaction) => [
    ...(interaction.effects || []), ...(interaction.success?.effects || []), ...(interaction.failure?.effects || []),
  ]).filter((effect) => effect.op === "set" || effect.op === "add").map((effect) => `${effect.path}:${String(effect.value)}`));
  for (const [index, interaction] of (definition.interactions || []).entries()) {
    const path = `interactions[${index}]`;
    if (!interaction.id) errors.push(`${path}.id is required.`);
    if (ids.has(interaction.id)) errors.push(`Duplicate interaction id '${interaction.id}'.`);
    ids.add(interaction.id);
    if (!definition.locations?.[interaction.location]) errors.push(`${path} references unknown location '${interaction.location}'.`);
    if (!Array.isArray(interaction.modes) || !interaction.modes.length || interaction.modes.some((mode) => !["act","speak"].includes(mode))) errors.push(`${path}.modes must explicitly contain act, speak, or both.`);
    if (!interaction.verbs?.length || !interaction.targets?.length) errors.push(`${path} needs verbs and targets.`);
    if (interaction.priority !== undefined && !Number.isFinite(Number(interaction.priority))) errors.push(`${path}.priority must be numeric when supplied.`);
    if (interaction.matchAll && (!Array.isArray(interaction.matchAll) || interaction.matchAll.some((group) => !Array.isArray(group) || !group.length))) errors.push(`${path}.matchAll must contain non-empty alias groups.`);
    if (!interaction.outcome?.message && !interaction.check) errors.push(`${path} needs an outcome or check.`);
    if (interaction.idempotencyKey) {
      if (idempotency.has(interaction.idempotencyKey)) errors.push(`Duplicate idempotency key '${interaction.idempotencyKey}'.`);
      idempotency.add(interaction.idempotencyKey);
    }
    for (const requirement of interaction.requires || []) if (!String(requirement.path).match(/^(flags|objects|containers|itemOwners|discoveries|completedInteractions|resources|clocks|knowledge|visited)(\.|$)/)) errors.push(`${path} has unsupported prerequisite '${requirement.path}'.`);
    for (const effect of [...(interaction.effects || []), ...(interaction.success?.effects || []), ...(interaction.failure?.effects || [])]) {
      if (!effect.path || !["set","add","increment","consume"].includes(effect.op)) errors.push(`${path} contains an invalid effect.`);
      if (effect.path === "discoveries" && effect.op === "add" && !definition.discoveries?.[effect.value] && !definition.story?.clues?.[effect.value]) errors.push(`${path} reveals unknown discovery '${effect.value}'.`);
      const objectMatch=String(effect.path || "").match(/^objects\.([^.]+)/);
      if(objectMatch&&!definition.objects?.[objectMatch[1]]) errors.push(`${path} changes unknown object '${objectMatch[1]}'.`);
      const resourceMatch=String(effect.path || "").match(/^resources\.([^.]+)/);
      if(resourceMatch&&!Object.hasOwn(definition.initialResources || {},resourceMatch[1])) errors.push(`${path} changes undeclared resource '${resourceMatch[1]}'.`);
    }
    for(const requirement of interaction.requires || []) if(Object.hasOwn(requirement,"equals")&&requirement.equals===true&&String(requirement.path).startsWith("flags.")&&!Object.hasOwn(definition.initialFlags || {},String(requirement.path).slice(6))&&!producedPaths.has(`${requirement.path}:true`)) errors.push(`${path} has impossible prerequisite '${requirement.path}'.`);
  }
  return errors;
}
