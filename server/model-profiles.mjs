const PROFILE_DEFINITIONS = Object.freeze({
  "qwen3-local-v1": Object.freeze({
    id:"qwen3-local-v1",
    version:1,
    displayName:"Qwen 3 14B (local default)",
    provider:"ollama",
    model:"qwen3:14b-q4_K_M",
    contextTokens:8192,
    think:false,
    status:"active",
  }),
  "gemma4-12b-eval-v1": Object.freeze({
    id:"gemma4-12b-eval-v1",
    version:1,
    displayName:"Gemma 4 12B (evaluation candidate)",
    provider:"ollama",
    model:"gemma4:12b",
    contextTokens:8192,
    think:false,
    status:"candidate",
  }),
});

const boundedInteger = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

export function listModelProfiles() {
  return Object.values(PROFILE_DEFINITIONS).map((profile) => ({ ...profile }));
}

export function resolveModelProfile(environment = process.env) {
  const requestedId = String(environment.DND_MODEL_PROFILE || "qwen3-local-v1");
  const definition = PROFILE_DEFINITIONS[requestedId] || PROFILE_DEFINITIONS["qwen3-local-v1"];
  const modelOverride = definition.id === "gemma4-12b-eval-v1" ? environment.GEMMA_MODEL : environment.DND_MODEL;
  return Object.freeze({
    ...definition,
    model:String(modelOverride || definition.model),
    ollamaUrl:String(environment.OLLAMA_URL || "http://127.0.0.1:11434"),
    contextTokens:boundedInteger(environment.DND_CONTEXT_TOKENS, definition.contextTokens, 2048, 262144),
    requestedId,
    fallbackUsed:requestedId !== definition.id,
  });
}

export const activeModelProfile = resolveModelProfile();
