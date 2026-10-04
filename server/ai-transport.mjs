import { parseModelJson } from "./model-output.mjs";

export async function aiRequest(profile, path, { body, timeoutMs = 2500, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${profile.baseUrl || profile.ollamaUrl}${path}`, {
      method:body ? "POST" : "GET", headers:{ "Content-Type":"application/json", ...(profile.apiKey ? { Authorization:`Bearer ${profile.apiKey}` } : {}) },
      ...(body ? { body:JSON.stringify(body) } : {}), signal:AbortSignal.timeout(timeoutMs),
    });
  } catch { throw new Error("Cannot reach the AI server. Check its address, that it is running, and the connection timeout."); }
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "The AI server rejected the API key." : response.status === 503 ? "The AI server is still loading or unavailable." : `The AI server returned HTTP ${response.status}.`);
  return response.json();
}

export async function generateStructured(profile, messages, schema, generation = {}, fetchImpl = fetch) {
  const maxTokens = generation.numPredict ?? 520;
  const body = profile.provider === "ollama" ? {
    model:profile.model, messages, stream:false, think:profile.think, format:schema,
    options:{ temperature:generation.temperature ?? .62, num_ctx:profile.contextTokens, num_predict:maxTokens },
  } : {
    model:profile.model, messages, stream:false, temperature:generation.temperature ?? .62, max_tokens:maxTokens,
    response_format:{ type:"json_object", schema }, chat_template_kwargs:{ enable_thinking:profile.think === true },
  };
  const result = await aiRequest(profile, profile.provider === "ollama" ? "/api/chat" : "/v1/chat/completions", { body, timeoutMs:generation.timeoutMs ?? 150000, fetchImpl });
  const content = profile.provider === "ollama" ? result.message?.content : result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The AI server did not return a structured answer.");
  return parseModelJson(content);
}

export async function discoverAi(profile, fetchImpl = fetch) {
  if (profile.provider === "ollama") {
    const tags = await aiRequest(profile, "/api/tags", { fetchImpl });
    const running = await aiRequest(profile, "/api/ps", { fetchImpl }).catch(() => ({ models:[] }));
    const loadedNames = new Set((running.models || []).flatMap(item => [item.name, item.model]));
    return (tags.models || []).map(item => ({ name:String(item.name || item.model), size:Number(item.size || 0), parameterSize:item.details?.parameter_size || "", quantization:item.details?.quantization_level || "", family:item.details?.family || "", modifiedAt:item.modified_at || "", loaded:loadedNames.has(item.name) || loadedNames.has(item.model) }));
  }
  await aiRequest(profile, "/health", { fetchImpl });
  const result = await aiRequest(profile, "/v1/models", { fetchImpl });
  return (result.data || []).map(item => ({ name:String(item.id), size:0, parameterSize:"", quantization:"", family:"llama.cpp", modifiedAt:"", loaded:!item.status || item.status.value === "loaded" }));
}
