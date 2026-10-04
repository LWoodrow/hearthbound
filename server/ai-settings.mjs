import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const settingsPath = () => resolve(process.env.AI_SETTINGS_FILE || "data/ai-settings.json");

export function defaultAiSettings(env = process.env) {
  const provider = env.AI_PROVIDER || (env.OLLAMA_URL || env.DND_MODEL ? "ollama" : "llamacpp");
  return normalizeAiSettings({ provider, mode:env.AI_MODE || "remote", baseUrl:env.AI_BASE_URL || (provider === "ollama" ? env.OLLAMA_URL || "http://127.0.0.1:11434" : "http://127.0.0.1:8080"), model:env.AI_MODEL || env.DND_MODEL || (provider === "ollama" ? "qwen3:14b-q4_K_M" : "hearthbound"), apiKey:env.AI_API_KEY || "", contextTokens:Number(env.DND_CONTEXT_TOKENS || 8192), executablePath:"", modelPath:"", gpuLayers:99, autoStart:false });
}

export function normalizeAiSettings(input) {
  if (!["llamacpp", "ollama"].includes(input.provider)) throw new Error("Choose llama.cpp or Ollama.");
  if (!["local", "remote"].includes(input.mode)) throw new Error("Choose this computer or an existing server.");
  if (input.mode === "local" && input.provider !== "llamacpp") throw new Error("Local process controls are for llama.cpp. Use an existing server for Ollama.");
  const url = new URL(String(input.baseUrl || "").trim());
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Enter an HTTP or HTTPS server URL without credentials or query parameters.");
  url.pathname = url.pathname.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
  if (input.mode === "local" && (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || !["", "/"].includes(url.pathname))) throw new Error("A managed local server needs an address such as http://127.0.0.1:8080.");
  const integer = (value, min, max, name) => { const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${name} must be between ${min} and ${max}.`); return number; };
  const model = String(input.model || "").trim();
  if (!model || model.length > 200) throw new Error("Enter a model name or server alias (up to 200 characters).");
  return { version:1, provider:input.provider, mode:input.mode, baseUrl:url.href.replace(/\/+$/, ""), model, apiKey:String(input.apiKey || ""), contextTokens:integer(input.contextTokens, 2048, 262144, "Context size"), executablePath:String(input.executablePath || "").trim(), modelPath:String(input.modelPath || "").trim(), gpuLayers:integer(input.gpuLayers ?? 99, 0, 999, "GPU layers"), autoStart:Boolean(input.autoStart) && input.mode === "local" };
}

export function readAiSettings() {
  const filename = settingsPath();
  return existsSync(filename) ? normalizeAiSettings(JSON.parse(readFileSync(filename, "utf8"))) : defaultAiSettings();
}

export function mergeAiSettings(input, previous = readAiSettings()) {
  const merged = normalizeAiSettings({ ...previous, ...input, apiKey:"" });
  const sameServer = merged.baseUrl === previous.baseUrl && merged.provider === previous.provider;
  return { ...merged, apiKey:input.clearApiKey ? "" : input.apiKey || (sameServer ? previous.apiKey : "") };
}

export function saveAiSettings(input) {
  const settings = mergeAiSettings(input);
  const filename = settingsPath();
  mkdirSync(dirname(filename), { recursive:true });
  const temporary = `${filename}.tmp`;
  writeFileSync(temporary, JSON.stringify(settings, null, 2), { mode:0o600 });
  renameSync(temporary, filename);
  return settings;
}

export function publicAiSettings(settings = readAiSettings()) {
  const { apiKey, ...visible } = settings;
  return { ...visible, hasApiKey:Boolean(apiKey) };
}

// Configuration is an administrator capability on the host PC, independent of characters.
export function canManageAi(request) {
  const address = request.socket?.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  try { if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(`http://${request.headers.host}`).hostname)) return false; } catch { return false; }
  if (!request.headers.origin) return true;
  try { return new URL(request.headers.origin).host === request.headers.host; } catch { return false; }
}
