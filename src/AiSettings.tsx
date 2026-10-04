import { useEffect, useState } from "react";
import type { GameView } from "./types";

type Settings = { provider:"llamacpp"|"ollama"; mode:"local"|"remote"; baseUrl:string; model:string; contextTokens:number; executablePath:string; modelPath:string; gpuLayers:number; autoStart:boolean; hasApiKey:boolean };
type Snapshot = { settings:Settings; runtime:GameView["ai"]; process:{ managed:boolean; phase:string; error:string } };
async function request<T>(url:string, body?:unknown, method = "POST"):Promise<T> {
  const response = await fetch(url, { method:body === undefined ? "GET" : method, headers:{"Content-Type":"application/json"}, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The connection request failed.");
  return result;
}

export function AiSettings({ close }:{close:()=>void}) {
  const [settings, setSettings] = useState<Settings|null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot|null>(null);
  const [key, setKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => { try { const next = await request<Snapshot>("/api/ai/settings"); if (active) { setSnapshot(next); setSettings(previous => previous || next.settings); } } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "Could not read settings."); } };
    void refresh(); const timer = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const update = (change:Partial<Settings>) => { setSettings(previous => previous ? {...previous,...change} : previous); setNotice(""); setError(""); };
  const draft = () => ({ ...settings, apiKey:key, clearApiKey:clearKey });
  const action = async (name:string) => {
    setBusy(name); setError(""); setNotice(name === "test" ? "Testing the server and structured JSON. Loading a model for the first time can take a few minutes." : "");
    try {
      if (name === "save" || name === "start") {
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
  const status = snapshot?.process.phase === "error" ? "Failed" : snapshot?.runtime.status === "ready" ? "Ready" : snapshot?.runtime.status === "loading" ? "Starting" : settings?.mode === "local" ? "Stopped" : "Not connected";
  return <main className="ai-setup-page">
    <header className="ai-setup-header"><button type="button" onClick={close}>← Game library</button><span>Settings · Applies to every adventure</span></header>
    <section className="ai-setup-card"><span className="eyebrow">Your storyteller</span><h1>AI connection</h1><p>Run your model on this computer, or connect Hearthbound to an AI server elsewhere.</p>
      {snapshot && <div className={`ai-setup-status ${status === "Ready" ? "ready" : ""}`} role="status"><strong>{status}</strong><span>{snapshot.runtime.model} · {snapshot.settings.provider === "llamacpp" ? "llama.cpp" : "Ollama"}</span><small>{snapshot.process.error || snapshot.runtime.error || "The configured AI server is responding."}</small></div>}
      {error && <p className="ai-setup-error" role="alert">{error}</p>}
      {notice && <p className="ai-setup-notice" role="status">{notice}</p>}
      {!settings && !error && <p>Reading connection settings…</p>}
      {settings && <form onSubmit={event => { event.preventDefault(); void action("save"); }}>
        <fieldset disabled={Boolean(busy) || managed}><legend>Connection</legend>
          <div className="ai-setup-grid"><label>AI software<select value={settings.provider} onChange={event => update({provider:event.target.value as Settings["provider"],mode:"remote",baseUrl:event.target.value === "llamacpp" ? "http://127.0.0.1:8080" : "http://127.0.0.1:11434",model:event.target.value === "llamacpp" ? "hearthbound" : "qwen3:14b-q4_K_M",hasApiKey:false})}><option value="llamacpp">llama.cpp</option><option value="ollama">Ollama (existing setup)</option></select></label>
          <label>Where it runs<select value={settings.mode} onChange={event => update({mode:event.target.value as Settings["mode"], ...(event.target.value === "local" ? {baseUrl:"http://127.0.0.1:8080"} : {})})}>{settings.provider === "llamacpp" && <option value="local">On this computer — start from Hearthbound</option>}<option value="remote">An existing server — connect by URL</option></select></label></div>
          <label>Server URL<input required type="url" value={settings.baseUrl} onChange={event => update({baseUrl:event.target.value})} placeholder="http://192.168.1.50:8080"/><small>Use the server address, for example http://127.0.0.1:8080 or https://ai.example.com.</small></label>
          <div className="ai-setup-grid"><label>Model name or alias<input required list="ai-server-models" value={settings.model} onChange={event => update({model:event.target.value})}/><datalist id="ai-server-models">{models.map(name => <option key={name} value={name}/>)}</datalist><small>Local llama.cpp uses this as its model alias. For an existing server, use Find models.</small></label>
          <label>Context size (tokens)<input type="number" min={2048} max={262144} step={1024} value={settings.contextTokens} onChange={event => update({contextTokens:Number(event.target.value)})}/><small>For a remote server, match its configured context capacity.</small></label></div>
          <label>API key (optional)<input type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} placeholder={settings.hasApiKey ? "Saved key — leave blank to keep it" : "Only if your server requires a key"}/></label>
          {settings.hasApiKey && <label className="ai-setup-checkbox"><input type="checkbox" checked={clearKey} onChange={event => setClearKey(event.target.checked)}/>Remove saved API key</label>}
        </fieldset>
        {settings.mode === "local" && <fieldset disabled={Boolean(busy) || managed}><legend>Local llama.cpp setup</legend><p>Install llama.cpp and download a compatible GGUF model first. Enter their full paths on this computer.</p>
          <label>llama-server executable<input value={settings.executablePath} onChange={event => update({executablePath:event.target.value})} placeholder="C:\\AI\\llama.cpp\\llama-server.exe"/></label>
          <label>GGUF model file<input value={settings.modelPath} onChange={event => update({modelPath:event.target.value})} placeholder="C:\\AI\\models\\your-model.gguf"/></label>
          <label>GPU layers<input type="number" min={0} max={999} value={settings.gpuLayers} onChange={event => update({gpuLayers:Number(event.target.value)})}/><small>Start with 99 for GPU offload. Use 0 for CPU; lower this if the model exceeds available GPU memory.</small></label>
          <label className="ai-setup-checkbox"><input type="checkbox" checked={settings.autoStart} onChange={event => update({autoStart:event.target.checked})}/>Start this AI server when Hearthbound opens</label>
          <p className="ai-setup-hint">Startup details are logged in data/logs/llamacpp.log.</p>
        </fieldset>}
        {managed && <p>Stop the local AI server to edit its launch settings.</p>}
        <div className="ai-setup-actions"><button type="submit" disabled={Boolean(busy) || managed}>{busy === "save" ? "Saving…" : "Save settings"}</button>
          {settings.mode === "local" && !managed && <button type="button" disabled={Boolean(busy)} onClick={() => void action("start")}>{busy === "start" ? "Starting…" : "Save & start local AI"}</button>}
          {managed && <button type="button" disabled={Boolean(busy)} onClick={() => void action("stop")}>Stop local AI</button>}
          <button type="button" disabled={Boolean(busy)} onClick={() => void action("models")}>{busy === "models" ? "Finding…" : "Find models"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void action("test")}>{busy === "test" ? "Testing…" : "Test connection"}</button></div>
        <p className="ai-setup-hint">Test connection checks both the server and a structured JSON answer. Save to apply your changes. Your settings belong to this computer and are independent of adventure saves.</p>
      </form>}
      <details className="ai-setup-help"><summary>Getting llama.cpp ready</summary><p>Download the llama.cpp Windows release that matches your hardware and extract it into a folder. Download a GGUF instruct model supported by that release. Select llama.cpp above, choose On this computer, and enter the two paths.</p><p>For another computer, start llama-server there with a network listening address and use that computer’s URL here. Use an API key and HTTPS or a private VPN for connections outside your home network.</p><a href="https://github.com/ggml-org/llama.cpp/releases" target="_blank" rel="noreferrer">llama.cpp releases</a></details>
    </section>
  </main>;
}
