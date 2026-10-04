import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { canManageAi, defaultAiSettings, mergeAiSettings, normalizeAiSettings, publicAiSettings, readAiSettings, saveAiSettings } from "../server/ai-settings.mjs";
import { aiRequest, discoverAi, generateStructured } from "../server/ai-transport.mjs";
import { createLocalAiService, localServerCommand } from "../server/ai-service.mjs";
import { profileForSettings } from "../server/model-runtime.mjs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const settings = () => defaultAiSettings({});
const response = body => ({ ok:true, json:async () => body });

test("library settings work before login, test a remote AI and persist across app restarts", async () => {
  const directory=mkdtempSync(join(tmpdir(),"hearthbound-ai-http-"));
  const fake=createServer(async (req,res) => {
    let body=""; for await (const chunk of req) body+=chunk;
    if (req.url === "/v1/chat/completions") { assert.equal(JSON.parse(body).response_format.type,"json_object"); assert.equal(req.headers.authorization,"Bearer test-secret"); }
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify(req.url === "/health" ? {status:"ok"} : req.url === "/v1/models" ? {data:[{id:"hearthbound"}]} : {choices:[{message:{content:'{"ready":true}'}}]}));
  });
  fake.listen(0,"127.0.0.1"); await once(fake,"listening");
  const reservation=createServer(); reservation.listen(0,"127.0.0.1"); await once(reservation,"listening");
  const port=reservation.address().port; await new Promise(done=>reservation.close(done));
  const base=`http://127.0.0.1:${port}`;
  let child;
  const launch=async () => {
    child=spawn(process.execPath,["server/index.mjs"],{cwd:fileURLToPath(new URL("../",import.meta.url)),windowsHide:true,stdio:"ignore",env:{...process.env,PORT:String(port),HOST:"127.0.0.1",DND_DATABASE:join(directory,"campaign.sqlite"),AI_SETTINGS_FILE:join(directory,"ai.json"),AI_PROVIDER:"llamacpp",AI_BASE_URL:`http://127.0.0.1:${fake.address().port}`,AI_MODEL:"hearthbound",AI_API_KEY:"test-secret",HTTPS_KEY:"",HTTPS_CERT:""}});
    let spawnError; child.once("error",error=>{spawnError=error;});
    for(let i=0;i<60;i++) { if(spawnError) throw spawnError; try { const result=await fetch(`${base}/api/lobby`); if(result.ok) return; } catch {} await new Promise(done=>setTimeout(done,100)); }
    throw Error("Test Hearthbound server did not start.");
  };
  const stop=async()=>{ if(child && child.exitCode === null) { const exit=once(child,"exit"); child.kill(); await exit; } child=null; };
  try {
    await launch();
    const before=await (await fetch(`${base}/api/ai/settings`)).json();
    assert.equal(before.settings.apiKey,undefined); assert.equal(before.settings.hasApiKey,true);
    const testResponse=await fetch(`${base}/api/ai/test`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
    assert.equal(testResponse.status,200); assert.equal((await testResponse.json()).ok,true);
    const foreign=await fetch(`${base}/api/ai/settings`,{method:"PUT",headers:{"Content-Type":"application/json",Origin:"https://foreign.example"},body:"{}"});
    assert.equal(foreign.status,403);
    const saved=await fetch(`${base}/api/ai/settings`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({contextTokens:4096})});
    assert.equal(saved.status,200);
    await stop(); await launch();
    const after=await (await fetch(`${base}/api/ai/settings`)).json(); assert.equal(after.settings.contextTokens,4096); assert.equal(after.settings.apiKey,undefined);
    await new Promise(done=>fake.close(done));
    const offline=await (await fetch(`${base}/api/ai/settings`)).json(); assert.equal(offline.runtime.status,"offline");
    assert.equal((await fetch(`${base}/api/lobby`)).status,200);
  } finally { await stop(); if(fake.listening) await new Promise(done=>fake.close(done)); rmSync(directory,{recursive:true,force:true}); }
});

test("new setups default to llama.cpp; existing Ollama environment remains usable", () => {
  assert.equal(settings().provider, "llamacpp");
  const legacy = defaultAiSettings({ OLLAMA_URL:"http://localhost:11434", DND_MODEL:"custom:14b" });
  assert.equal(legacy.provider, "ollama"); assert.equal(legacy.model, "custom:14b");
  assert.equal(normalizeAiSettings({...settings(),baseUrl:"http://example.com/prefix/v1/"}).baseUrl,"http://example.com/prefix");
  assert.throws(() => normalizeAiSettings({...settings(),baseUrl:"file:///secret"}));
  assert.throws(() => normalizeAiSettings({...settings(),baseUrl:"http://key:secret@example.com"}));
  assert.throws(() => normalizeAiSettings({...settings(),mode:"local",baseUrl:"http://192.168.1.2:8080"}));
});

test("connection settings survive restart independently of saves and never expose saved keys", () => {
  const directory = mkdtempSync(join(tmpdir(),"hearthbound-ai-settings-"));
  const previous = process.env.AI_SETTINGS_FILE;
  process.env.AI_SETTINGS_FILE = join(directory,"settings.json");
  try {
    saveAiSettings({...settings(),apiKey:"private-key"});
    assert.equal(readAiSettings().apiKey,"private-key");
    saveAiSettings({contextTokens:4096,apiKey:""});
    assert.equal(readAiSettings().apiKey,"private-key");
    assert.equal(publicAiSettings().hasApiKey,true); assert.equal(publicAiSettings().apiKey,undefined);
    saveAiSettings({baseUrl:"https://ai.example.com"}); assert.equal(readAiSettings().apiKey,"");
    saveAiSettings({apiKey:"another-key"});
    saveAiSettings({clearApiKey:true}); assert.equal(readAiSettings().apiKey,"");
    assert.equal(mergeAiSettings({model:"another"},settings()).model,"another");
  } finally { if (previous === undefined) delete process.env.AI_SETTINGS_FILE; else process.env.AI_SETTINGS_FILE=previous; rmSync(directory,{recursive:true,force:true}); }
});

test("only host-computer same-origin requests can configure or launch AI", () => {
  const req = { socket:{remoteAddress:"127.0.0.1"}, headers:{host:"localhost:4173",origin:"http://localhost:4173"} };
  assert.equal(canManageAi(req),true);
  assert.equal(canManageAi({...req,socket:{remoteAddress:"192.168.1.50"}}),false);
  assert.equal(canManageAi({...req,headers:{...req.headers,origin:"https://other.example"}}),false);
  assert.equal(canManageAi({...req,headers:{host:"rebound.example",origin:"http://rebound.example"}}),false);
});

test("llama.cpp generation preserves prompt messages, schema and token limits", async () => {
  const profile = profileForSettings({...settings(),apiKey:"private"});
  const messages=[{role:"system",content:"Canonical state only"},{role:"user",content:"Look around"}];
  const schema={type:"object",properties:{text:{type:"string"}},required:["text"]};
  const result = await generateStructured(profile,messages,schema,{numPredict:70},async (url,options) => {
    assert.equal(url,"http://127.0.0.1:8080/v1/chat/completions");
    const body=JSON.parse(options.body); assert.deepEqual(body.messages,messages);
    assert.deepEqual(body.response_format.schema,schema); assert.equal(body.max_tokens,70);
    assert.equal(body.chat_template_kwargs.enable_thinking,false);
    assert.equal(options.headers.Authorization,"Bearer private");
    assert.equal(body.options,undefined);
    return response({choices:[{message:{content:'{"text":"Visible room"}'}}]});
  });
  assert.deepEqual(result,{text:"Visible room"});
});

test("Ollama fallback uses the same structured adapter", async () => {
  const profile = profileForSettings({...settings(),provider:"ollama"});
  const result = await generateStructured(profile,[],{type:"object"},{},async (url,options) => {
    assert.ok(url.endsWith("/api/chat")); assert.equal(JSON.parse(options.body).options.num_ctx,8192);
    return response({message:{content:'{"ready":true}'}});
  });
  assert.equal(result.ready,true);
});

test("AI authentication, loading, network and malformed response errors are bounded", async () => {
  const profile=profileForSettings(settings());
  await assert.rejects(aiRequest(profile,"/health",{fetchImpl:async()=>({ok:false,status:401})}),/API key/);
  await assert.rejects(aiRequest(profile,"/health",{fetchImpl:async()=>({ok:false,status:503})}),/loading/);
  await assert.rejects(aiRequest(profile,"/health",{fetchImpl:async()=>{throw Error("private-key");}}),/Cannot reach/);
  await assert.rejects(generateStructured(profile,[],{}, {},async()=>response({choices:[]})),/structured answer/);
  await assert.rejects(generateStructured(profile,[],{}, {},async()=>response({choices:[{message:{content:"invalid"}}]})));
});

test("llama.cpp discovers advertised models without Ollama installed-model assumptions", async () => {
  const models=await discoverAi(profileForSettings(settings()),async url => response(url.endsWith("/health") ? {status:"ok"} : {data:[{id:"hearthbound"}]}));
  assert.deepEqual(models.map(item=>[item.name,item.loaded]),[["hearthbound",true]]);
});

test("local launch preserves paths with spaces and stops only its own process", async () => {
  const directory=mkdtempSync(join(tmpdir(),"hearthbound local ai "));
  const executable=join(directory,"llama-server.exe"), model=join(directory,"a model.gguf");
  writeFileSync(executable,""); writeFileSync(model,"");
  const local={...settings(),mode:"local",executablePath:executable,modelPath:model};
  let launches=0;
  const child=new EventEmitter(); child.kill=()=>{setImmediate(()=>child.emit("exit",0));return true;};
  const service=createLocalAiService({request:async()=>{throw Error("offline");},spawnImpl:(file,args,options)=>{launches++;assert.equal(file,executable);assert.equal(args[1],model);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);return child;}});
  try {
    assert.equal(localServerCommand(local).args.includes("8192"),true);
    await service.start(local); await service.start(local); assert.equal(launches,1);
    assert.equal(service.view().managed,true); await service.stop(); assert.equal(service.view().managed,false);
    await assert.rejects(service.stop(),/no local AI process/);
    const existing=createLocalAiService({request:async()=>({status:"ok"}),spawnImpl:()=>assert.fail("Must not start duplicate server")});
    await existing.start(local); assert.equal(existing.view().managed,false); await assert.rejects(existing.stop(),/no local AI process/);
    await assert.rejects(service.start(settings()),/existing server/);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
