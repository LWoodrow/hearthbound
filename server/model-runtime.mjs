import { activeModelProfile, listModelProfiles } from "./model-profiles.mjs";

let selectedProfile = { ...activeModelProfile };
let transition = {
  phase:"checking",
  pendingModel:"",
  error:"",
  loadDurationMs:null,
  changedAt:new Date().toISOString(),
};
let cachedDiscovery = null;
let cachedAt = 0;

const normaliseModel = (value) => String(value || "").trim();
const knownProfileForModel = (model) => listModelProfiles().find((profile) => profile.model === model);

export function profileForOllamaModel(model) {
  const name = normaliseModel(model);
  const known = knownProfileForModel(name);
  if (known) return {
    ...known,
    ollamaUrl:activeModelProfile.ollamaUrl,
    contextTokens:activeModelProfile.contextTokens,
    runtimeSelected:true,
  };
  return {
    id:`ollama:${name}`,
    version:1,
    displayName:name,
    provider:"ollama",
    model:name,
    contextTokens:activeModelProfile.contextTokens,
    think:false,
    status:"local",
    ollamaUrl:activeModelProfile.ollamaUrl,
    requestedId:`ollama:${name}`,
    fallbackUsed:false,
    runtimeSelected:true,
  };
}

export function currentModelProfile() {
  return { ...selectedProfile };
}

async function ollamaDiscovery(force = false) {
  if (!force && cachedDiscovery && Date.now() - cachedAt < 1200) return cachedDiscovery;
  const [tagsResponse, runningResponse] = await Promise.all([
    fetch(`${activeModelProfile.ollamaUrl}/api/tags`, { signal:AbortSignal.timeout(2500) }),
    fetch(`${activeModelProfile.ollamaUrl}/api/ps`, { signal:AbortSignal.timeout(2500) }).catch(() => null),
  ]);
  if (!tagsResponse.ok) throw new Error(`Ollama returned ${tagsResponse.status} while listing models.`);
  const tags = await tagsResponse.json();
  const running = runningResponse?.ok ? await runningResponse.json() : { models:[] };
  const loadedNames = new Set((running.models || []).flatMap((item) => [item.name, item.model]).filter(Boolean));
  const models = (tags.models || []).map((item) => ({
    name:String(item.name || item.model || ""),
    size:Number(item.size || 0),
    parameterSize:String(item.details?.parameter_size || ""),
    quantization:String(item.details?.quantization_level || ""),
    family:String(item.details?.family || ""),
    modifiedAt:String(item.modified_at || ""),
    loaded:loadedNames.has(item.name) || loadedNames.has(item.model),
  })).filter((item) => item.name).sort((left, right) => left.name.localeCompare(right.name));
  cachedDiscovery = { models, loadedNames };
  cachedAt = Date.now();
  return cachedDiscovery;
}

export async function modelRuntimeView({ force = false } = {}) {
  try {
    const discovery = await ollamaDiscovery(force);
    const installed = discovery.models.some((item) => item.name === selectedProfile.model);
    const loaded = discovery.loadedNames.has(selectedProfile.model);
    if (!["loading", "error"].includes(transition.phase)) transition = {
      ...transition,
      phase:installed ? loaded ? "ready" : "available" : "unavailable",
      error:installed ? "" : `The selected model '${selectedProfile.model}' is not installed in Ollama.`,
    };
    return {
      connected:installed,
      model:selectedProfile.model,
      profile:selectedProfile.id,
      displayName:selectedProfile.displayName,
      status:transition.phase,
      pendingModel:transition.pendingModel,
      loadProgress:transition.phase === "loading" ? null : loaded ? 100 : 0,
      loaded,
      error:transition.error,
      loadDurationMs:transition.loadDurationMs,
      models:discovery.models.map((item) => ({ ...item, selected:item.name === selectedProfile.model })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ollama is unavailable.";
    if (transition.phase !== "loading") transition = { ...transition, phase:"offline", error:message };
    return {
      connected:false,
      model:selectedProfile.model,
      profile:selectedProfile.id,
      displayName:selectedProfile.displayName,
      status:transition.phase === "loading" ? "loading" : "offline",
      pendingModel:transition.pendingModel,
      loadProgress:transition.phase === "loading" ? null : 0,
      loaded:false,
      error:message,
      loadDurationMs:transition.loadDurationMs,
      models:[],
    };
  }
}

export async function isCurrentModelReady() {
  const view = await modelRuntimeView();
  return view.connected && view.status !== "loading";
}

export async function selectAndLoadModel(model) {
  const requested = normaliseModel(model);
  if (!requested) throw new Error("Choose an installed Ollama model first.");
  const discovery = await ollamaDiscovery(true);
  if (!discovery.models.some((item) => item.name === requested)) throw new Error(`'${requested}' is not installed in Ollama.`);
  transition = { phase:"loading", pendingModel:requested, error:"", loadDurationMs:null, changedAt:new Date().toISOString() };
  try {
    const response = await fetch(`${activeModelProfile.ollamaUrl}/api/chat`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        model:requested,
        messages:[{ role:"user", content:"Reply with exactly READY." }],
        stream:false,
        keep_alive:"30m",
        options:{ temperature:0, num_predict:8, num_ctx:Math.min(4096, activeModelProfile.contextTokens) },
      }),
      signal:AbortSignal.timeout(300000),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status} while loading '${requested}'.`);
    const result = await response.json();
    selectedProfile = profileForOllamaModel(requested);
    transition = {
      phase:"ready",
      pendingModel:"",
      error:"",
      loadDurationMs:Math.round(Number(result.load_duration || 0) / 1_000_000) || null,
      changedAt:new Date().toISOString(),
    };
    cachedAt = 0;
    return modelRuntimeView({ force:true });
  } catch (error) {
    transition = {
      phase:"error",
      pendingModel:requested,
      error:error instanceof Error ? error.message : `Ollama could not load '${requested}'.`,
      loadDurationMs:null,
      changedAt:new Date().toISOString(),
    };
    throw error;
  }
}
