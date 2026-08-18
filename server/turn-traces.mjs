import { createHash, randomUUID } from "node:crypto";

import { getPartyState, setPartyState } from "./database.mjs";
import { classifyWorldAction } from "./world-state.mjs";

const TRACE_VERSION = 1;
const TRACE_LIMIT = 30;
const clean = (value, limit = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

function locationTokens(value) {
  return clean(value, 100).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !["the","room","location"].includes(token));
}

export function assessNarrationOutcome({ narration = "", before = {}, after = {}, publicFacts = [] } = {}) {
  const text = clean(narration, 1600);
  if (!text) return { status:"not-recorded", issues:[] };
  const lower = text.toLowerCase();
  const issues = [];
  const moved = Boolean(before.location && after.location && before.location !== after.location);
  const beforeTokens = locationTokens(before.location);
  const afterTokens = locationTokens(after.location);
  const oldOnlyTokens = beforeTokens.filter((token) => !afterTokens.includes(token));
  const namesOldLocation = (oldOnlyTokens.length ? oldOnlyTokens : beforeTokens).some((token) => lower.includes(token));
  const claimsNoMovement = /\b(?:remain(?:s|ed)?|still (?:is|are|stands?|waits?)|does not (?:move|enter|leave)|cannot (?:move|enter|leave))\b/.test(lower);
  if (moved && claimsNoMovement && namesOldLocation) issues.push("narration-kept-previous-location");

  const factTerms = [...new Set((publicFacts || []).flatMap((fact) => clean(fact, 300).toLowerCase().split(/[^a-z0-9]+/)).filter((token) => token.length >= 6))];
  const supportedTerms = factTerms.filter((token) => lower.includes(token));
  return {
    status:issues.length ? "contradiction" : "consistent",
    issues,
    factCoverage:factTerms.length ? Number((supportedTerms.length / factTerms.length).toFixed(2)) : null,
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function stateHash(snapshot) {
  return createHash("sha256").update(JSON.stringify(stable(snapshot))).digest("hex").slice(0, 16);
}

function compactInventory(inventory = []) {
  return inventory.map((item) => ({
    id:clean(item.id, 80), name:clean(item.name, 80), quantity:Number(item.quantity || 0), status:clean(item.status, 24),
  })).sort((a, b) => a.id.localeCompare(b.id));
}

export function captureTurnState({ dmState = {}, worldState = {}, roomAuthority = null, pendingCheck = null, inventory = [], knownLocations = [] } = {}) {
  const snapshot = {
    revision:Math.max(0, Number(worldState.revision || 0)),
    location:clean(worldState.currentLocation || dmState.currentLocationKey || roomAuthority?.currentLocation?.key, 80),
    previousLocation:clean(worldState.previousLocation, 80),
    visited:[...(Array.isArray(worldState.visited) ? worldState.visited : [])].map((item) => clean(item, 80)).sort(),
    visibleFeatures:[...(roomAuthority?.currentLocation?.features || [])].map((item) => clean(item, 100)).sort(),
    exits:[...(roomAuthority?.currentLocation?.exits || [])].map((item) => clean(item, 80)).sort(),
    knownLocations:(Array.isArray(knownLocations) ? knownLocations : []).map((item) => clean(item?.name, 100)).filter(Boolean).sort(),
    clueStage:Number(dmState.clueStage || 0),
    objects:stable(worldState.objects || {}),
    containers:stable(worldState.containers || {}),
    itemOwners:stable(worldState.itemOwners || {}),
    discoveries:[...(Array.isArray(worldState.discoveries) ? worldState.discoveries : [])].map((item) => clean(item, 100)).sort(),
    flags:stable(worldState.flags || {}),
    inventory:compactInventory(inventory),
    pendingCheck:pendingCheck ? { ability:clean(pendingCheck.ability, 40), skill:clean(pendingCheck.skill, 60), dc:Number(pendingCheck.dc || 0) } : null,
  };
  return { version:1, hash:stateHash(snapshot), ...snapshot };
}

function role(pattern, action) {
  return clean(action.match(pattern)?.[1], 100);
}

function matchedEntities(action, state) {
  const words = new Set(clean(action, 1200).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean));
  const candidates = [...(state.visibleFeatures || []), ...(state.exits || []), ...(state.inventory || []).map((item) => item.name)];
  return [...new Set(candidates)].map((name) => {
    const tokens = clean(name).toLowerCase().split(/\s+/).filter((token) => token.length > 3);
    return { id:clean(name, 100), matchedTokens:tokens.filter((token) => words.has(token)) };
  }).filter((candidate) => candidate.matchedTokens.length).slice(0, 8);
}

export function interpretTurn({ mode = "act", audience = "nearby", text = "", state = {} }) {
  const action = clean(text, 1200);
  const lower = action.toLowerCase();
  const intent = mode === "ask" ? "question" : classifyWorldAction(action, mode);
  const verb = clean(lower.match(/\b(search|look|inspect|examine|investigate|study|read|use|unlock|lock|open|close|pick up|take|collect|grab|go|move|enter|cross|follow|descend|ascend|leave|return|walk|run|proceed|continue|sneak|slip|creep|crawl|head|warm|offer|give|ask|tell|say)\b/)?.[1], 32);
  return {
    mode, audience:mode === "speak" ? audience : "n/a", intent, verb,
    target:role(/\b(?:search|look at|inspect|examine|investigate|study|read|open|close|take|grab|warm)\s+(?:the\s+)?(.+?)(?:\s+(?:with|using|on|in|at|to|through)\b|$)/i, action),
    instrument:role(/\b(?:with|using|on)\s+(?:the\s+)?(.+)$/i, action),
    destination:role(/\b(?:go|move|enter|cross|follow|descend|ascend|return|walk|run|proceed|continue|sneak|slip|creep|crawl)(?:\s+(?:to|into|through|via))?\s+(?:the\s+)?(.+)$/i, action),
    explicitQuantity:Number(lower.match(/\b(\d+)\b/)?.[1] || 0) || null,
    entityCandidates:matchedEntities(action, state),
  };
}

function changedPaths(before, after, prefix = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [prefix || "state"];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].flatMap((key) => changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key)).slice(0, 80);
}

export function createTurnTrace({ adventureId, playerId, mode, audience, text, before, modelProfile = "" }) {
  return {
    version:TRACE_VERSION, id:randomUUID(), createdAt:new Date().toISOString(), adventureId:clean(adventureId, 100), playerId:clean(playerId, 100),
    action:{ mode, audience, text:clean(text, 1200) }, before, interpretation:interpretTurn({ mode, audience, text, state:before }),
    resolution:null, outcome:null, after:null, model:{ profile:clean(modelProfile, 100), promptPacketIds:[], rejectedProposals:[] },
  };
}

export function completeTurnTrace(trace, { source, selectedRule = "", after, publicFacts = [], narration = "", pendingCheck = null, accepted = true, reason = "", diagnostic = {}, promptPacketIds = [], rejectedProposals = [] }) {
  const narrationAssessment = assessNarrationOutcome({ narration, before:trace.before, after, publicFacts });
  return {
    ...trace,
    resolution:{ source:clean(source, 40), accepted:Boolean(accepted), selectedRule:clean(selectedRule || source, 100), selectedAffordance:clean(diagnostic.selectedAffordance, 140), reason:clean(reason, 180), candidateAffordances:(diagnostic.candidateAffordances || []).map((item) => ({ id:clean(item.id, 140), kind:clean(item.kind, 40), target:clean(item.target, 100), failedPrerequisites:(item.failedPrerequisites || []).map((failure) => ({ path:clean(failure.path, 140), predicate:clean(failure.predicate, 40) })) })).slice(0, 20), rejectedAlternatives:(diagnostic.rejectedAlternatives || []).map((item) => clean(item, 140)).slice(0, 20) },
    outcome:{ publicFacts:(publicFacts || []).map((fact) => clean(fact, 300)).filter(Boolean).slice(0, 6), narration:clean(narration, 1600), narrationAssessment, pendingCheck:pendingCheck || null, stateDelta:changedPaths(trace.before, after) },
    after,
    model:{ ...trace.model, promptPacketIds:(promptPacketIds || []).map((id) => clean(id, 100)).filter(Boolean).slice(0, 8), rejectedProposals:(rejectedProposals || []).map((item) => clean(item, 180)).filter(Boolean).slice(0, 12) },
  };
}

const traceKey = (adventureId) => `turnTraces:${clean(adventureId, 100)}`;
const revisionKey = (adventureId) => `turnRevision:${clean(adventureId, 100)}`;

export function appendTurnTrace(db, partyId, adventureId, trace) {
  const key = traceKey(adventureId);
  const existing = getPartyState(db, partyId, key);
  const storedRevision = Math.max(0, Number(getPartyState(db, partyId, revisionKey(adventureId)) || 0));
  const changed = trace?.before?.hash !== trace?.after?.hash;
  const revision = changed ? storedRevision + 1 : storedRevision;
  const revisioned = { ...trace, stateRevision:{ before:storedRevision, after:revision, changed } };
  const traces = [...(Array.isArray(existing) ? existing : []), revisioned].slice(-TRACE_LIMIT);
  setPartyState(db, partyId, key, traces);
  setPartyState(db, partyId, revisionKey(adventureId), revision);
  return revisioned;
}

export function listTurnTraces(db, partyId, adventureId, limit = 8) {
  const traces = getPartyState(db, partyId, traceKey(adventureId));
  return (Array.isArray(traces) ? traces : []).slice(-Math.max(1, Math.min(TRACE_LIMIT, Number(limit) || 8)));
}

export function redactTurnTrace(trace) {
  if (!trace) return null;
  const safeState = (state = {}) => ({
    version:state.version, revision:state.revision, hash:state.hash, location:state.location, previousLocation:state.previousLocation,
    visited:state.visited, visibleFeatures:state.visibleFeatures, exits:state.exits, knownLocations:state.knownLocations,
    clueStage:state.clueStage, inventory:(state.inventory || []).map((item) => ({ name:item.name, quantity:item.quantity, status:item.status })), pendingCheck:state.pendingCheck,
  });
  const resolution = trace.resolution ? {
    source:trace.resolution.source, accepted:trace.resolution.accepted, selectedRule:trace.resolution.selectedRule,
    selectedAffordance:trace.resolution.selectedAffordance, reason:trace.resolution.reason,
    candidateAffordanceCount:trace.resolution.candidateAffordances?.length || 0,
    failedPrerequisiteCount:(trace.resolution.candidateAffordances || []).reduce((sum, item) => sum + (item.failedPrerequisites?.length || 0), 0),
    rejectedAlternativeCount:trace.resolution.rejectedAlternatives?.length || 0,
  } : null;
  return {
    version:trace.version, id:trace.id, createdAt:trace.createdAt, adventureId:trace.adventureId,
    action:trace.action, stateRevision:trace.stateRevision, before:safeState(trace.before), interpretation:trace.interpretation, resolution,
    outcome:trace.outcome ? { publicFacts:trace.outcome.publicFacts || [], narration:trace.outcome.narration || "", narrationAssessment:trace.outcome.narrationAssessment || { status:"not-recorded", issues:[] }, pendingCheck:trace.outcome.pendingCheck || null, stateDeltaCount:trace.outcome.stateDelta?.length || 0 } : null,
    after:safeState(trace.after),
    model:{ profile:trace.model?.profile || "", promptPacketIds:trace.model?.promptPacketIds || [], rejectedProposalCount:trace.model?.rejectedProposals?.length || 0 },
  };
}

export function redactedTurnTraces(traces = []) {
  return traces.map(redactTurnTrace).filter(Boolean);
}
