import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { aiRequest } from "./ai-transport.mjs";
import { readAiSettings } from "./ai-settings.mjs";

export function localServerCommand(settings) {
  if (settings.mode !== "local" || settings.provider !== "llamacpp") throw new Error("Local startup is available only for llama.cpp on this computer.");
  let executable = settings.executablePath;
  if (isAbsolute(executable) && existsSync(executable) && statSync(executable).isDirectory()) executable = join(executable, process.platform === "win32" ? "llama-server.exe" : "llama-server");
  for (const [label, filename] of [["llama-server executable", executable], ["GGUF model", settings.modelPath]]) {
    if (!isAbsolute(filename) || !existsSync(filename) || !statSync(filename).isFile()) throw new Error(`Choose an existing absolute path for the ${label}. ${label === "llama-server executable" ? "Select llama-server.exe, or its installation folder containing that executable." : "Select a downloaded GGUF file."}`);
  }
  if (!settings.modelPath.toLowerCase().endsWith(".gguf")) throw new Error("Choose a GGUF model file.");
  const url = new URL(settings.baseUrl);
  return { executable, args:["-m", settings.modelPath, "--alias", settings.model, "--host", url.hostname, "--port", url.port || "80", "-c", String(settings.contextTokens), "-ngl", String(settings.gpuLayers), "--parallel", "1"] };
}

export function localSetupStatus(settings = readAiSettings()) {
  if (settings.mode !== "local") return null;
  try { return { valid:true, executablePath:localServerCommand(settings).executable, error:"" }; }
  catch (error) { return { valid:false, executablePath:"", error:error.message }; }
}

export function readStartupLog(filename, offset = 0, secret = "") {
  let file;
  try {
    const size=statSync(filename).size;
    const start=Math.max(offset,size-16384);
    if (start >= size) return [];
    file=openSync(filename,"r");const bytes=Buffer.alloc(size-start);readSync(file,bytes,0,bytes.length,start);
    return bytes.toString("utf8").split(/[\r\n]+/).filter(line=>/load_tensors|load_model|model loaded|llama_model_load|llama_context|CUDA|offload|buffer size|listening|error|failed|fatal|out of memory/i.test(line) && !/prompt|chat_template|chat template|request body|\/completion/i.test(line)).slice(-14).map(line=>{
      let redacted=secret ? line.split(secret).join("[redacted]") : line;
      return redacted.replace(/Bearer\s+\S+/gi,"Bearer [redacted]").replace(/((?:api[_ -]?key|token|password)\s*[:=]\s*)\S+/gi,"$1[redacted]").slice(0,500);
    });
  } catch { return []; } finally { if(file!==undefined) closeSync(file); }
}

export function createLocalAiService({ spawnImpl = spawn, request = aiRequest, clock = Date.now, logReader = readStartupLog } = {}) {
  let child = null;
  let phase = "stopped";
  let error = "";
  let launching = false;
  let startedAt = null;
  let logOffset = 0;
  let logSecret = "";
  let lastLogLines = [];
  const logPath=resolve("data/logs/llamacpp.log");
  const view = () => {
    if (startedAt && phase !== "ready") lastLogLines=logReader(logPath,logOffset,logSecret);
    return { managed:Boolean(child), phase, error, pid:child?.pid || null, startedAt, elapsedMs:startedAt && phase === "starting" ? Math.max(0,clock()-startedAt) : null, logLines:lastLogLines };
  };
  return {
    view,
    async start(settings = readAiSettings()) {
      if (settings.mode !== "local") throw new Error("An existing server is managed on its own computer. Use Test connection.");
      if (launching || child) return view();
      launching = true;
      try {
        try { await request(settings, "/health"); phase = "ready"; error = ""; startedAt=null; lastLogLines=[]; return view(); } catch { /* Start the configured local server. */ }
        const command = localServerCommand(settings);
        mkdirSync(resolve("data/logs"), { recursive:true });
        logOffset=existsSync(logPath) ? statSync(logPath).size : 0;logSecret=settings.apiKey;lastLogLines=[];
        const log = openSync(logPath, "a");
        try {
          phase = "starting"; error = ""; startedAt=clock();
          child = spawnImpl(command.executable, command.args, { windowsHide:true, shell:false, stdio:["ignore", log, log], env:{ ...process.env, LLAMA_API_KEY:settings.apiKey } });
          child.once("error", () => { child = null; phase = "error"; error = "Could not start llama.cpp. Check the executable and its dependencies; see data/logs/llamacpp.log."; });
          child.once("exit", (code) => { child = null; if (phase !== "stopped") { phase = "error"; error = `llama.cpp stopped (exit ${code}). Check data/logs/llamacpp.log.`; } });
        } finally { closeSync(log); }
        return view();
      } catch (failure) { phase="error";error=failure.message;throw failure; }
      finally { launching = false; }
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
    markReady() { if (child) { lastLogLines=logReader(logPath,logOffset,logSecret);phase = "ready"; error = ""; } },
  };
}

export const localAiService = createLocalAiService();
