import { createHash, randomUUID } from "node:crypto";

const DEFAULT_RESPONSE_TOKENS = 520;
const DEFAULT_RESERVE_TOKENS = 640;
const TRACE_LIMIT = 24;
const promptTraces = [];

const stringContent = (content) => typeof content === "string" ? content : JSON.stringify(content);
const digest = (content) => createHash("sha256").update(content).digest("hex").slice(0, 16);

export function estimatePromptTokens(content) {
  const text = stringContent(content || "");
  return text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}

export function buildPromptPacket({ kind, profile, sections, responseTokens = DEFAULT_RESPONSE_TOKENS, reserveTokens = DEFAULT_RESERVE_TOKENS, metadata = {} }) {
  if (!profile?.id || !profile?.model) throw new Error("A resolved model profile is required.");
  const normalized = (Array.isArray(sections) ? sections : []).map((section, index) => {
    const content = stringContent(section?.content || "");
    return {
      id:String(section?.id || `section-${index + 1}`),
      role:["system", "user", "assistant"].includes(section?.role) ? section.role : "user",
      visibility:["public", "private", "secret"].includes(section?.visibility) ? section.visibility : "secret",
      required:section?.required !== false,
      priority:Number.isFinite(Number(section?.priority)) ? Number(section.priority) : 50,
      content,
      estimatedTokens:estimatePromptTokens(content),
      order:index,
    };
  });
  const inputBudget = Math.max(256, Number(profile.contextTokens) - Number(responseTokens) - Number(reserveTokens));
  const requiredTokens = normalized.filter((section) => section.required).reduce((sum, section) => sum + section.estimatedTokens, 0);
  let remaining = Math.max(0, inputBudget - requiredTokens);
  const optionalIncluded = new Set();
  for (const section of normalized.filter((item) => !item.required).sort((a, b) => b.priority - a.priority || a.order - b.order)) {
    if (section.estimatedTokens <= remaining) {
      optionalIncluded.add(section.order);
      remaining -= section.estimatedTokens;
    }
  }
  const packetSections = normalized.map((section) => ({ ...section, included:section.required || optionalIncluded.has(section.order) }));
  const includedSections = packetSections.filter((section) => section.included);
  return Object.freeze({
    id:randomUUID(),
    kind:String(kind || "unspecified"),
    createdAt:new Date().toISOString(),
    profile:{ id:profile.id, version:profile.version, provider:profile.provider, model:profile.model, contextTokens:profile.contextTokens },
    responseTokens:Number(responseTokens),
    reserveTokens:Number(reserveTokens),
    inputBudget,
    estimatedInputTokens:includedSections.reduce((sum, section) => sum + section.estimatedTokens, 0),
    overBudget:requiredTokens > inputBudget,
    metadata:{ ...metadata },
    sections:packetSections,
    messages:includedSections.map(({ role, content }) => ({ role, content })),
  });
}

export function recordPromptPacket(packet) {
  promptTraces.push(packet);
  if (promptTraces.length > TRACE_LIMIT) promptTraces.splice(0, promptTraces.length - TRACE_LIMIT);
  return packet;
}

export function inspectPromptPackets({ partyId, playerId, limit = 8 } = {}) {
  return promptTraces
    .filter((packet) => (!partyId || packet.metadata.partyId === partyId) && (!playerId || packet.metadata.playerId === playerId))
    .slice(-Math.max(1, Math.min(TRACE_LIMIT, Number(limit) || 8)))
    .reverse()
    .map((packet) => ({
      id:packet.id,
      kind:packet.kind,
      createdAt:packet.createdAt,
      profile:packet.profile,
      inputBudget:packet.inputBudget,
      estimatedInputTokens:packet.estimatedInputTokens,
      responseTokens:packet.responseTokens,
      overBudget:packet.overBudget,
      metadata:{ adventureId:packet.metadata.adventureId || "" },
      sections:packet.sections.map((section) => ({
        id:section.id,
        role:section.role,
        visibility:section.visibility,
        required:section.required,
        included:section.included,
        estimatedTokens:section.estimatedTokens,
        contentHash:digest(section.content),
        preview:section.visibility === "public" ? section.content.slice(0, 280) : "[redacted]",
      })),
    }));
}

export function clearPromptPacketTraces() {
  promptTraces.splice(0, promptTraces.length);
}

export function promptInspectorEnabled(environment = process.env) {
  return environment.DND_PROMPT_INSPECTOR === "1";
}
