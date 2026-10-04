import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { aiRequest } from "./ai-transport.mjs";
import { readAiSettings } from "./ai-settings.mjs";

export function localServerCommand(settings) {
  if (settings.mode !== "local" || settings.provider !== "llamacpp") throw new Error("Local startup is available only for llama.cpp on this computer.");
  for (const [label, filename] of [["llama-server executable", settings.executablePath], ["GGUF model", settings.modelPath]]) {
    if (!isAbsolute(filename) || !existsSync(filename) || !statSync(filename).isFile()) throw new Error(`Choose an existing absolute path for the ${label}.`);
  }
  if (!settings.modelPath.toLowerCase().endsWith(".gguf")) throw new Error("Choose a GGUF model file.");
  const url = new URL(settings.baseUrl);
  return { executable:settings.executablePath, args:["-m", settings.modelPath, "--alias", settings.model, "--host", url.hostname, "--port", url.port || "80", "-c", String(settings.contextTokens), "-ngl", String(settings.gpuLayers)] };
}

export function createLocalAiService({ spawnImpl = spawn, request = aiRequest } = {}) {
  let child = null;
  let phase = "stopped";
  let error = "";
  let launching = false;
  const view = () => ({ managed:Boolean(child), phase, error });
  return {
    view,
    async start(settings = readAiSettings()) {
      if (settings.mode !== "local") throw new Error("An existing server is managed on its own computer. Use Test connection.");
      if (launching || child) return view();
      launching = true;
      try {
        try { await request(settings, "/health"); phase = "ready"; error = ""; return view(); } catch { /* Start the configured local server. */ }
        const command = localServerCommand(settings);
        mkdirSync(resolve("data/logs"), { recursive:true });
        const log = openSync(resolve("data/logs/llamacpp.log"), "a");
        try {
          phase = "starting"; error = "";
          child = spawnImpl(command.executable, command.args, { windowsHide:true, shell:false, stdio:["ignore", log, log], env:{ ...process.env, LLAMA_API_KEY:settings.apiKey } });
          child.once("error", () => { child = null; phase = "error"; error = "Could not start llama.cpp. Check the executable and its dependencies; see data/logs/llamacpp.log."; });
          child.once("exit", (code) => { child = null; if (phase !== "stopped") { phase = "error"; error = `llama.cpp stopped (exit ${code}). Check data/logs/llamacpp.log.`; } });
        } finally { closeSync(log); }
        return view();
      } finally { launching = false; }
    },
    async stop() {
      if (launching) throw new Error("Local AI startup is in progress. Try again shortly.");
      if (!child) throw new Error("Hearthbound has no local AI process to stop. A server started elsewhere must be stopped there.");
      const processToStop = child;
      phase = "stopped"; error = "";
      await new Promise((done, reject) => {
        const timer = setTimeout(() => reject(new Error("The AI process has not stopped yet.")), 5000);
        processToStop.once("exit", () => { clearTimeout(timer); done(); });
        if (!processToStop.kill()) { clearTimeout(timer); reject(new Error("Could not stop the local AI process.")); }
      });
      return view();
    },
    markReady() { if (child) { phase = "ready"; error = ""; } },
  };
}

export const localAiService = createLocalAiService();
