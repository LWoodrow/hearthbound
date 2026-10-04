import { useEffect, useRef, useState } from "react";
import type { GameView } from "./types";
import { ModelLoadProgress } from "./ModelLoadProgress";

type Settings = { provider:"llamacpp"|"ollama"; mode:"local"|"remote"; baseUrl:string; model:string; contextTokens:number; executablePath:string; modelPath:string; modelsDirectory:string; gpuLayers:number; autoStart:boolean; hasApiKey:boolean };
type LocalModel = { name:string; path:string; size:number };
type Download = { phase:string; received:number; total:number|null; progress:number|null; filename:string; path:string; error:string };
const fileSize = (size:number) => size >= 1024 ** 3 ? `${(size/1024**3).toFixed(1)} GB` : `${(size/1024**2).toFixed(1)} MB`;
type Snapshot = { settings:Settings; runtime:GameView["ai"]; process:{ managed:boolean; phase:string; error:string; pid?:number|null; elapsedMs?:number|null; logLines?:string[] }; setup?:{valid:boolean;executablePath:string;error:string}|null };
async function request<T>(url:string, body?:unknown, method = "POST"):Promise<T> {
  const response = await fetch(url, { method:body === undefined ? "GET" : method, headers:{"Content-Type":"application/json"}, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The connection request failed.");
  return result;
}

export function AiSettings({ close }:{close:()=>void}) {
  const statusRef=useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Settings|null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot|null>(null);
  const [key, setKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [download, setDownload] = useState<Download|null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { const [next, transfer] = await Promise.all([request<Snapshot>("/api/ai/settings"),request<Download>("/api/ai/download")]); if (active) { setSnapshot(next); setSettings(previous => previous || next.settings); setDownload(transfer); } } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Could not read settings."); } };
    void refresh(); const timer = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (settings?.provider !== "llamacpp" || settings.mode !== "local") return;
    let active = true;
    void request<{models:LocalModel[]}>("/api/ai/library",settings).then(result => {if(active) setLocalModels(result.models);}).catch(failure => {if(active) setError(failure.message);});
    return () => {active=false;};
  }, [settings?.mode, settings?.provider, download?.phase]);
  const update = (change:Partial<Settings>) => { if (change.provider || change.baseUrl) setModels([]); setSettings(previous => previous ? {...previous,...change} : previous); setNotice(""); setError(""); };
  const draft = () => ({ ...settings, apiKey:key, clearApiKey:clearKey });
  const action = async (name:string) => {
    setBusy(name); setError(""); setNotice(name === "test" ? "Testing the server and structured JSON. Loading a model for the first time can take a few minutes." : name === "load" ? "Checking files and starting llama.cpp…" : "");
    if(name === "load" || name === "test") statusRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
    try {
      if (name === "load") {
        const loaded = await request<{settings:Settings}>("/api/ai/load",draft());
        setSettings(loaded.settings); setKey(""); setClearKey(false);
        setNotice("Loading the selected model. First startup can take a few minutes.");
      } else if (name === "library") {
        const result = await request<{models:LocalModel[]}>("/api/ai/library",draft()); setLocalModels(result.models);
        setNotice(result.models.length ? "Downloaded GGUF models found. Select one below." : "No complete GGUF models found in this folder yet.");
      } else if (name === "download") {
        setDownload(await request<Download>("/api/ai/download",{...draft(),url:downloadUrl}));
        setNotice("Downloading to your model library. You can select the model once it finishes.");
      } else if (name === "cancel") {
        setDownload(await request<Download>("/api/ai/download/cancel",{})); setNotice("Download cancelled; the incomplete file was removed.");
      } else if (name === "save" || name === "start") {
        const saved = await request<Snapshot>("/api/ai/settings", draft(), "PUT");
        setSettings(saved.settings); setSnapshot(saved); setKey(""); setClearKey(false);
        if (name === "start") await request("/api/ai/start", {});
        setNotice(name === "start" ? "Starting llama.cpp. The first load can take a few minutes." : "Connection settings saved for every game on this server.");
      } else if (name === "stop") {
        await request("/api/ai/stop", {}); setNotice("Local AI server stopped.");
      } else {
        const result = await request<{message?:string;models:Array<{name:string}>}>(name === "test" ? "/api/ai/test" : "/api/ai/models", draft());
        setModels(result.models.map(model => model.name));
        setNotice(result.message || "Available models found. Choose a name below, then test and save.");
      }
      setSnapshot(await request<Snapshot>("/api/ai/settings"));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The operation failed."); }
    finally { setBusy(""); }
  };
  const managed = Boolean(snapshot?.process.managed);
  const downloading = Boolean(download && ["connecting","downloading","cancelling"].includes(download.phase));
  const starting=busy === "load" || snapshot?.process.phase === "starting" || snapshot?.runtime.status === "loading";
  const status = busy === "load" ? "Starting model" : snapshot?.process.phase === "error" ? "Failed to start" : snapshot?.runtime.status === "ready" ? "Ready" : starting ? "Loading model" : settings?.mode === "local" ? "Stopped" : "Not connected";
  const detail = snapshot?.process.error || (starting ? "llama.cpp is starting or loading the model into memory. Large models can take several minutes; updates appear here automatically." : snapshot?.runtime.status === "ready" ? snapshot.process.managed ? "Started by Hearthbound. You can stop or switch it here." : "Server started outside Hearthbound. Saved launch settings do not control this process." : snapshot?.runtime.error || "No AI server is responding. Choose a model and use Load selected model; Save settings alone does not start it.");
  return <main className="ai-setup-page">
    <header className="ai-setup-header"><button type="button" onClick={close}>← Game library</button><span>Settings · Applies to every adventure</span></header>
    <section className="ai-setup-card"><span className="eyebrow">Your storyteller</span><h1>AI connection</h1><p>Run your model on this computer, or connect Hearthbound to an AI server elsewhere.</p>
      {snapshot && <div ref={statusRef} className={`ai-setup-status ${status === "Ready" ? "ready" : ""}`} role="status"><strong>{status}</strong><span>{snapshot.runtime.model} · {snapshot.settings.provider === "llamacpp" ? "llama.cpp" : "Ollama"}</span><small>{detail}</small><ModelLoadProgress loading={Boolean(starting)} progress={starting ? null : snapshot.runtime.loaded ? 100 : 0}/>{starting && <><small>{snapshot.process.elapsedMs != null ? `${Math.floor(snapshot.process.elapsedMs/1000)} seconds elapsed · ` : ""}{snapshot.process.pid ? `Process ${snapshot.process.pid} · ` : ""}Checking every 3 seconds. No reliable percentage is available.</small></>}</div>}
      {snapshot?.setup && !snapshot.setup.valid && <p className="ai-setup-error" role="alert">Saved local setup needs attention: {snapshot.setup.error}</p>}
      {snapshot?.setup?.valid && settings?.mode === "local" && <p className="ai-setup-hint">Executable found: {snapshot.setup.executablePath}</p>}
      {settings?.mode === "local" && <details className="ai-startup-log" open={starting || snapshot?.process.phase === "error"}><summary>Local AI startup diagnostics</summary><p>Recent loading and error messages from this Hearthbound-started process. API keys are redacted; prompts and conversation logs are not shown.</p><pre>{snapshot?.process.logLines?.length ? snapshot.process.logLines.join("\n") : "No startup messages yet. Use Load selected model to start llama.cpp. A server launched in a terminal writes its messages there instead."}</pre></details>}
      {error && <p className="ai-setup-error" role="alert">{error}</p>}
      {notice && <p className="ai-setup-notice" role="status">{notice}</p>}
      {!settings && !error && <p>Reading connection settings…</p>}
      {settings && <form onSubmit={event => { event.preventDefault(); void action("save"); }}>
        <fieldset disabled={Boolean(busy) || managed || downloading}><legend>Connection</legend>
          <div className="ai-setup-grid"><label>AI software<select value={settings.provider} onChange={event => update({provider:event.target.value as Settings["provider"],mode:"remote",baseUrl:event.target.value === "llamacpp" ? "http://127.0.0.1:8080" : "http://127.0.0.1:11434",model:event.target.value === "llamacpp" ? "hearthbound" : "qwen3:14b-q4_K_M",hasApiKey:false})}><option value="llamacpp">llama.cpp</option><option value="ollama">Ollama (existing setup)</option></select></label>
          <label>Where it runs<select value={settings.mode} onChange={event => update({mode:event.target.value as Settings["mode"], ...(event.target.value === "local" ? {baseUrl:"http://127.0.0.1:8080"} : {})})}>{settings.provider === "llamacpp" && <option value="local">On this computer — start from Hearthbound</option>}<option value="remote">An existing server — connect by URL</option></select></label></div>
          <label>Server URL<input required type="url" value={settings.baseUrl} onChange={event => update({baseUrl:event.target.value})} placeholder="http://192.168.1.50:8080"/><small>Use the server address, for example http://127.0.0.1:8080 or https://ai.example.com.</small></label>
          <div className="ai-setup-grid"><label>{settings.mode === "local" ? "Server model alias" : "Server model"}{settings.mode === "remote" && models.length ? <select value={settings.model} onChange={event=>update({model:event.target.value})}>{!models.includes(settings.model) && <option value={settings.model}>{settings.model} (configured)</option>}{models.map(name=><option value={name} key={name}>{name}</option>)}</select> : <input required value={settings.model} onChange={event => update({model:event.target.value})}/>}<small>Local aliases follow the selected GGUF filename. For an existing server, use Find models.</small></label>
          <label>Context size (tokens)<input type="number" min={2048} max={262144} step={1024} value={settings.contextTokens} onChange={event => update({contextTokens:Number(event.target.value)})}/><small>For a remote server, match its configured context capacity.</small></label></div>
          <label>API key (optional)<input type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} placeholder={settings.hasApiKey ? "Saved key — leave blank to keep it" : "Only if your server requires a key"}/></label>
          {settings.hasApiKey && <label className="ai-setup-checkbox"><input type="checkbox" checked={clearKey} onChange={event => setClearKey(event.target.checked)}/>Remove saved API key</label>}
        </fieldset>
        {settings.mode === "local" && <><fieldset disabled={Boolean(busy) || downloading}><legend>Your model library</legend>
          <label>Models folder<input value={settings.modelsDirectory} disabled={managed} onChange={event=>{update({modelsDirectory:event.target.value});setLocalModels([]);}}/><small>Choose the folder containing your downloaded GGUF models, then refresh the library.</small></label>
          <label>Downloaded model<select value={settings.modelPath} onChange={event=>{const chosen=localModels.find(model=>model.path===event.target.value);update({modelPath:event.target.value,...(chosen ? {model:chosen.name.slice(0,200)} : {})});}}><option value="">Choose a downloaded model</option>{settings.modelPath && !localModels.some(model=>model.path===settings.modelPath) && <option value={settings.modelPath}>{settings.modelPath.split(/[\\/]/).pop()} (current file)</option>}{localModels.map(model=><option value={model.path} key={model.path}>{model.name} · {fileSize(model.size)}{snapshot?.settings.modelPath===model.path && snapshot.runtime.loaded ? " · loaded" : ""}</option>)}</select></label>
          <button type="button" onClick={()=>void action("library")}>Refresh model library</button>
          {!localModels.length && <p>No complete single-file GGUF models are listed yet. Add models to this folder or use Download a model below.</p>}
        </fieldset><fieldset disabled={Boolean(busy) || managed || downloading}><legend>Local llama.cpp setup</legend><p>Select the installed llama.cpp executable. The model file follows your dropdown selection.</p>
          <label>llama-server executable or installation folder<input value={settings.executablePath} onChange={event => update({executablePath:event.target.value})} placeholder="C:\\AI\\llama.cpp\\llama-server.exe"/><small>You may enter the installation folder; Hearthbound finds llama-server.exe inside it.</small></label>
          <details><summary>Use a model file outside the library</summary><label>GGUF model file<input value={settings.modelPath} onChange={event => update({modelPath:event.target.value})} placeholder="C:\\AI\\models\\your-model.gguf"/></label></details>
          <label>GPU layers<input type="number" min={0} max={999} value={settings.gpuLayers} onChange={event => update({gpuLayers:Number(event.target.value)})}/><small>Start with 99 for GPU offload. Use 0 for CPU; lower this if the model exceeds available GPU memory.</small></label>
          <label className="ai-setup-checkbox"><input type="checkbox" checked={settings.autoStart} onChange={event => update({autoStart:event.target.checked})}/>Start this AI server when Hearthbound opens</label>
          <p className="ai-setup-hint">Startup details are logged in data/logs/llamacpp.log.</p>
        </fieldset><fieldset disabled={Boolean(busy) || downloading}><legend>Download a model</legend><label>Hugging Face GGUF file link<input type="url" value={downloadUrl} onChange={event=>setDownloadUrl(event.target.value)} placeholder="https://huggingface.co/owner/repo/resolve/main/model.gguf"/><small>Copy a single GGUF file link from Files and versions. Public models only; check its model card and license before downloading.</small></label><button type="button" disabled={!downloadUrl.trim()} onClick={()=>void action("download")}>Download to model library</button><p className="ai-setup-hint">Files can be several GB. Downloads show progress and become selectable only when complete. Split models and sign-in downloads need manual setup.</p><a href="https://huggingface.co/models?library=gguf" target="_blank" rel="noreferrer">Browse GGUF models on Hugging Face</a></fieldset>
          {download && download.phase!=="idle" && <div className="ai-download-status" role="status"><strong>{download.filename}</strong><span>{download.phase === "complete" ? "Downloaded — refresh or choose it in the model library" : download.phase} · {fileSize(download.received)}{download.total ? ` / ${fileSize(download.total)}` : ""}</span><progress max={100} value={download.progress ?? undefined}/>{download.error && <p>{download.error}</p>}{downloading && <button type="button" disabled={Boolean(busy)} onClick={()=>void action("cancel")}>Cancel download</button>}</div>}
        </>}
        {managed && <p>Stop the local AI server to edit its launch settings.</p>}
        <div className="ai-setup-actions"><button type="submit" disabled={Boolean(busy) || managed || downloading}>{busy === "save" ? "Saving…" : "Save settings"}</button>
          {settings.mode === "local" && <button type="button" disabled={Boolean(busy) || (managed && starting) || downloading || !settings.modelPath || !settings.executablePath} onClick={() => void action("load")}>{busy === "load" || (managed && starting) ? "Loading model…" : managed ? "Switch & load selected model" : "Load selected model"}</button>}
          {managed && <button type="button" disabled={Boolean(busy)} onClick={() => void action("stop")}>{starting ? "Cancel model startup" : "Stop local AI"}</button>}
          <button type="button" disabled={Boolean(busy)} onClick={() => void action("models")}>{busy === "models" ? "Finding…" : "Find models"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void action("test")}>{busy === "test" ? "Testing…" : "Test connection"}</button></div>
        <p className="ai-setup-hint">Test connection checks both the server and a structured JSON answer. Save to apply your changes. Your settings belong to this computer and are independent of adventure saves.</p>
      </form>}
      <details className="ai-setup-help"><summary>Getting llama.cpp ready</summary><p>Download the llama.cpp Windows release that matches your hardware and extract it into a folder. Download a GGUF instruct model supported by that release. Select llama.cpp above, choose On this computer, and enter the two paths.</p><p>For another computer, start llama-server there with a network listening address and use that computer’s URL here. Use an API key and HTTPS or a private VPN for connections outside your home network.</p><a href="https://github.com/ggml-org/llama.cpp/releases" target="_blank" rel="noreferrer">llama.cpp releases</a></details>
    </section>
  </main>;
}
