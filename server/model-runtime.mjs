import { activeModelProfile, listModelProfiles } from "./model-profiles.mjs";
import { readAiSettings, saveAiSettings } from "./ai-settings.mjs";
import { discoverAi, generateStructured } from "./ai-transport.mjs";
import { localAiService } from "./ai-service.mjs";

let cachedDiscovery = null;
let cachedAt = 0;
let cacheKey = "";
let loading = "";
let selectionError = "";

export function profileForOllamaModel(model) {
  const name = String(model || "").trim();
  const known = listModelProfiles().find(profile => profile.model === name);
  return { ...(known || { id:`ollama:${name}`, version:1, displayName:name, provider:"ollama", model:name, think:false, status:"local", requestedId:`ollama:${name}`, fallbackUsed:false }), ollamaUrl:activeModelProfile.ollamaUrl, contextTokens:activeModelProfile.contextTokens, runtimeSelected:true };
}

export function profileForSettings(settings) {
  return { ...profileForOllamaModel(settings.model), id:`${settings.provider}:${settings.model}`, displayName:settings.model, provider:settings.provider, baseUrl:settings.baseUrl, ollamaUrl:settings.baseUrl, apiKey:settings.apiKey, contextTokens:settings.contextTokens };
}

export function currentModelProfile() { return profileForSettings(readAiSettings()); }
export function resetModelRuntime() { cachedDiscovery = null; cachedAt = 0; selectionError = ""; }

export async function testAiConnection(settings) {
  const profile = profileForSettings(settings);
  const models = await discoverAi(profile);
  if (!models.some(item => item.name === settings.model)) throw new Error(`The server does not advertise '${settings.model}'. Choose one of: ${models.map(item => item.name).join(", ") || "no models available"}.`);
  const result = await generateStructured(profile, [{ role:"user", content:'Return JSON: {"ready":true}.' }], { type:"object", properties:{ ready:{ type:"boolean" } }, required:["ready"], additionalProperties:false }, { temperature:0, numPredict:24, timeoutMs:150000 });
  if (result?.ready !== true) throw new Error("The server responded, but the structured JSON test failed.");
  return { ok:true, message:"Connection and structured JSON are ready.", models };
}

export async function modelRuntimeView({ force = false } = {}) {
  let profile;
  try {
    profile = currentModelProfile();
    const key = JSON.stringify(profile);
    if (force || !cachedDiscovery || key !== cacheKey || Date.now() - cachedAt > 1200) {
      cachedDiscovery = await discoverAi(profile); cachedAt = Date.now(); cacheKey = key;
    }
    const models = cachedDiscovery;
    const selected = models.find(item => item.name === profile.model);
    if (selected?.loaded) localAiService.markReady();
    const status = loading ? "loading" : selectionError ? "error" : !selected ? "unavailable" : selected.loaded ? "ready" : "available";
    return { connected:Boolean(selected), model:profile.model, profile:profile.id, provider:profile.provider, displayName:profile.displayName, status, pendingModel:loading, loadProgress:loading ? null : selected?.loaded ? 100 : 0, loaded:Boolean(selected?.loaded), error:selectionError || (selected ? "" : "The configured model is not advertised by this AI server."), loadDurationMs:null, models:models.map(item => ({ ...item, selected:item.name === profile.model })) };
  } catch (error) {
    const settings = (() => { try { return readAiSettings(); } catch { return {}; } })();
    return { connected:false, model:settings.model || "", profile:profile?.id || "", provider:settings.provider || "llamacpp", displayName:settings.model || "AI", status:loading || localAiService.view().phase === "starting" ? "loading" : "offline", pendingModel:loading, loadProgress:0, loaded:false, error:error instanceof Error ? error.message : "The AI server is unavailable.", loadDurationMs:null, models:[] };
  }
}

export async function isCurrentModelReady() { const view = await modelRuntimeView(); return view.connected && !["loading", "error"].includes(view.status); }

export async function selectAndLoadModel(model) {
  if (loading) throw new Error("A model is already being loaded.");
  const settings = { ...readAiSettings(), model:String(model || "").trim() };
  if (settings.mode === "local" && settings.model !== readAiSettings().model) throw new Error("Stop the local AI server and change its model alias in AI connection settings.");
  loading = settings.model; selectionError = "";
  try {
    await testAiConnection(settings);
    saveAiSettings({ model:settings.model });
    resetModelRuntime();
  } catch (error) { selectionError = error.message; throw error; }
  finally { loading = ""; }
  return modelRuntimeView({ force:true });
}
