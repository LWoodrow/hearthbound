import { closeSync, existsSync, linkSync, mkdirSync, openSync, readSync, readdirSync, statfsSync, statSync, unlinkSync } from "node:fs";
import { open } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export function isGgufFile(filename, requireExtension = true) {
  let file;
  try {
    if ((requireExtension && !filename.toLowerCase().endsWith(".gguf")) || statSync(filename).size < 24) return false;
    file = openSync(filename, "r");
    const header = Buffer.alloc(8);
    if (readSync(file, header, 0, 8, 0) !== 8 || header.subarray(0,4).toString() !== "GGUF") return false;
    return [2,3].includes(header.readUInt32LE(4));
  } catch { return false; } finally { if (file !== undefined) closeSync(file); }
}

export function listLocalModels(directory) {
  const root = resolve(directory);
  if (!existsSync(root)) return [];
  if (!statSync(root).isDirectory()) throw new Error("The model library path must be a folder.");
  const models = [];
  let visited = 0;
  function scan(folder, depth) {
    for (const entry of readdirSync(folder, { withFileTypes:true })) {
      if (++visited > 2000) throw new Error("This folder is too large to scan. Choose a dedicated model folder.");
      if (entry.isSymbolicLink()) continue;
      const filename = join(folder, entry.name);
      if (entry.isDirectory() && depth < 2) scan(filename, depth + 1);
      else if (entry.isFile() && isGgufFile(filename) && !/-\d{5}-of-\d{5}\.gguf$/i.test(entry.name)) models.push({ name:basename(filename, ".gguf"), path:filename, size:statSync(filename).size });
    }
  }
  scan(root, 0);
  return models.sort((left,right)=>left.name.localeCompare(right.name));
}

export const localModelKey = filename => "gguf:" + createHash("sha256").update(resolve(filename)).digest("hex").slice(0,24);

export function localModelCatalogue(settings, advertised = []) {
  const files=listLocalModels(settings.modelsDirectory);
  if (settings.modelPath && isGgufFile(settings.modelPath) && !files.some(file=>resolve(file.path)===resolve(settings.modelPath))) files.push({name:basename(settings.modelPath).replace(/\.gguf$/i,""),path:resolve(settings.modelPath),size:statSync(settings.modelPath).size});
  return files.map(file=>{
    const selected=Boolean(settings.modelPath) && resolve(file.path)===resolve(settings.modelPath);
    return {name:file.name,selectionKey:localModelKey(file.path),size:file.size,family:"GGUF",parameterSize:"",quantization:"",modifiedAt:"",selected,loaded:selected && advertised.some(item=>item.name===settings.model && item.loaded)};
  });
}

export function resolveLocalModelSelection(settings, selectionKey) {
  const files=listLocalModels(settings.modelsDirectory);
  if (settings.modelPath && isGgufFile(settings.modelPath)) files.push({path:settings.modelPath,name:basename(settings.modelPath).replace(/\.gguf$/i,"")});
  const chosen=files.find(file=>localModelKey(file.path)===selectionKey);
  if (!chosen) throw new Error("This model is no longer in the configured library. Refresh the model list.");
  return {...settings,modelPath:chosen.path,model:chosen.name.slice(0,200)};
}

export function huggingFaceDownload(source) {
  const url = new URL(String(source || "").trim());
  if (url.protocol !== "https:" || url.hostname !== "huggingface.co" || (url.port && url.port !== "443") || url.username || url.password) throw new Error("Use a public HTTPS Hugging Face GGUF file link.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(resolve|blob)\/([^/]+)\/(.+\.gguf)$/i);
  if (!match) throw new Error("Open Files and versions on Hugging Face and copy a single GGUF file link.");
  const filename = decodeURIComponent(basename(match[5]));
  const safe = value => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value);
  if (!safe(match[1]) || !safe(match[2]) || !safe(filename) || filename.includes("..") || /-\d{5}-of-\d{5}\.gguf$/i.test(filename)) throw new Error("Choose one complete GGUF file, rather than a split-model shard.");
  const destination = `${match[1]}--${match[2]}--${filename}`;
  if (destination.length > 220) throw new Error("The model filename is too long. Download it manually into your library folder.");
  url.pathname = url.pathname.replace("/blob/", "/resolve/"); url.search = ""; url.hash = "";
  return { url:url.href, filename:destination };
}

const validDownloadHost = url => url.protocol === "https:" && (!url.port || url.port === "443") && !url.username && !url.password && (url.hostname === "huggingface.co" || url.hostname.endsWith(".huggingface.co") || url.hostname === "hf.co" || url.hostname.endsWith(".hf.co"));

export function createModelDownloader({ fetchImpl = fetch, diskFree = folder => { const stats = statfsSync(folder); return stats.bavail * stats.bsize; } } = {}) {
  let controller;
  let completion = Promise.resolve();
  let state = { phase:"idle", received:0, total:null, progress:null, filename:"", path:"", error:"" };
  const view = () => ({ ...state });
  const active = () => ["connecting", "downloading", "cancelling"].includes(state.phase);
  async function run(url, folder, target, partial, signal) {
    let file;
    let response;
    try {
      for (let redirects=0;redirects<8;redirects++) {
        if (!validDownloadHost(url)) throw new Error("The download redirected outside Hugging Face's file servers.");
        const connection = new AbortController();
        const timer = setTimeout(() => connection.abort(), 60000);
        try { response = await fetchImpl(url.href, { redirect:"manual", headers:{"Accept-Encoding":"identity"}, signal:AbortSignal.any([signal, connection.signal]) }); }
        finally { clearTimeout(timer); }
        if (![301,302,303,307,308].includes(response.status)) break;
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("The file server returned an invalid redirect.");
        url = new URL(location, url);
        if (redirects === 7) throw new Error("The download returned too many redirects.");
      }
      if (!response?.ok || !response.body) throw new Error(response?.status === 401 || response?.status === 403 ? "This model needs Hugging Face approval or sign-in. Download it manually into the library folder." : `The model download failed (HTTP ${response?.status || "unknown"}).`);
      const length = Number(response.headers.get("content-length"));
      state.total = length > 0 ? length : null;
      const maximum = 64 * 1024 ** 3;
      if (state.total && state.total > maximum) throw new Error("This model exceeds the 64 GB single-file download limit.");
      if (state.total && diskFree(folder) < state.total + 256 * 1024 ** 2) throw new Error("There is not enough free disk space for this model.");
      file = await open(partial, "wx"); state.phase = "downloading";
      let first = Buffer.alloc(0);
      for await (const chunk of response.body) {
        if (signal.aborted) throw new Error("Cancelled");
        const buffer = Buffer.from(chunk);
        if (first.length < 8) { first = Buffer.concat([first,buffer.subarray(0,8-first.length)]); if (first.length === 8 && (first.subarray(0,4).toString() !== "GGUF" || ![2,3].includes(first.readUInt32LE(4)))) throw new Error("The downloaded file is not a supported GGUF model."); }
        state.received += buffer.length;
        if (state.received > maximum) throw new Error("The model exceeds the download size limit.");
        let written = 0;
        while (written < buffer.length) { const result = await file.write(buffer, written, buffer.length - written); written += result.bytesWritten; }
        state.progress = state.total ? Math.min(99, Math.floor(state.received / state.total * 100)) : null;
      }
      if (signal.aborted) throw new Error("Cancelled");
      if (state.total && state.received !== state.total) throw new Error("The model download was incomplete. Try downloading again.");
      await file.close(); file = null;
      if (!isGgufFile(partial, false)) throw new Error("The download is not a complete GGUF file.");
      // Linking is atomic and refuses to replace any existing model at the destination.
      linkSync(partial, target);
      state.phase = "complete"; state.progress = 100;
    } catch (error) {
      state.phase = signal.aborted ? "cancelled" : "error";
      state.error = signal.aborted ? "Download cancelled." : error.code === "EEXIST" ? "A model already exists at this destination. It was preserved." : error.message === "Cancelled" ? "Download cancelled." : "Download failed: " + (error instanceof TypeError ? "check the connection and try again." : error.message);
    } finally {
      if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
      await file?.close().catch(() => {});
      try { if (existsSync(partial)) unlinkSync(partial); } catch { state.error += " A partial download file could not be removed."; }
    }
  }
  return {
    view, active,
    start(source, directory) {
      if (active()) throw new Error("A model download is already running.");
      const parsed = huggingFaceDownload(source);
      const folder = resolve(directory); mkdirSync(folder, { recursive:true });
      const target = join(folder, parsed.filename);
      if (existsSync(target)) throw new Error("This model is already downloaded. Refresh the library to select it.");
      controller = new AbortController();
      state = { phase:"connecting", received:0, total:null, progress:null, filename:parsed.filename, path:target, error:"" };
      completion = run(new URL(parsed.url), folder, target, `${target}.${randomUUID()}.part`, controller.signal);
      return view();
    },
    async cancel() { if (!active()) throw new Error("No model download is running."); state.phase = "cancelling"; controller.abort(); await completion; return view(); },
    wait() { return completion; },
  };
}

export const modelDownloader = createModelDownloader();
