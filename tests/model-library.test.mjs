import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModelDownloader, huggingFaceDownload, isGgufFile, listLocalModels, localModelCatalogue, resolveLocalModelSelection } from "../server/model-library.mjs";

const source = "https://huggingface.co/example/instruct/resolve/main/model.gguf";
const model = () => { const bytes=Buffer.alloc(32); bytes.write("GGUF"); bytes.writeUInt32LE(3,4); return bytes; };
const fixture = async work => { const folder=mkdtempSync(join(tmpdir(),"hearthbound model library ")); try { await work(folder); } finally { rmSync(folder,{recursive:true,force:true}); } };
const downloader = fetchImpl => createModelDownloader({fetchImpl,diskFree:()=>10*1024**3});
const fileResponse = (bytes=model(),length=bytes.length) => new Response(bytes,{headers:{"Content-Length":String(length)}});

test("library lists supported GGUF files, not partial downloads, invalid files or split shards",()=>fixture(folder=>{
  mkdirSync(join(folder,"nested"));
  writeFileSync(join(folder,"complete.gguf"),model());
  writeFileSync(join(folder,"nested","other.gguf"),model());
  writeFileSync(join(folder,"partial.gguf.part"),model());
  writeFileSync(join(folder,"bad.gguf"),"not a model");
  writeFileSync(join(folder,"split-00001-of-00002.gguf"),model());
  assert.deepEqual(listLocalModels(folder).map(item=>item.name),["complete","other"]);
  assert.equal(isGgufFile(join(folder,"bad.gguf")),false);
  assert.deepEqual(listLocalModels(join(folder,"missing")),[]);
}));

test("downloads accept public HF file links and contain safe names in the library",()=>{
  assert.equal(huggingFaceDownload(source.replace("resolve","blob")+"?download=true").url,source);
  assert.equal(huggingFaceDownload(source).filename,"example--instruct--model.gguf");
  for (const url of ["http://huggingface.co/example/instruct/resolve/main/a.gguf","https://user:secret@huggingface.co/example/instruct/resolve/main/a.gguf","https://evil.example/example/instruct/resolve/main/a.gguf",source.replace("model.gguf","file-00001-of-00002.gguf"),source.replace("model.gguf","..%5Cescape.gguf"),source.replace("model.gguf","%2Fescape.gguf")]) assert.throws(()=>huggingFaceDownload(url));
});

test("successful streamed download becomes selectable only when complete and cannot overwrite",()=>fixture(async folder=>{
  let release;
  const gate=new Promise(done=>release=done);
  const bytes=model();
  const transfer=downloader(async()=>new Response(new ReadableStream({async start(controller){controller.enqueue(bytes.subarray(0,8));await gate;controller.enqueue(bytes.subarray(8));controller.close();}}),{headers:{"Content-Length":String(bytes.length)}}));
  transfer.start(source,folder);
  await new Promise(done=>setTimeout(done,20));
  assert.deepEqual(listLocalModels(folder),[]);
  assert.throws(()=>transfer.start(source,folder),/already running/);
  release(); await transfer.wait();
  assert.equal(transfer.view().phase,"complete"); assert.equal(transfer.view().progress,100);
  assert.deepEqual(readFileSync(transfer.view().path),bytes);
  assert.equal(listLocalModels(folder).length,1);
  assert.equal(readdirSync(folder).some(name=>name.endsWith(".part")),false);
  assert.throws(()=>transfer.start(source,folder),/already downloaded/);
}));

test("incomplete, non-GGUF and gated downloads leave no selectable or partial file",()=>fixture(async folder=>{
  for (const response of [fileResponse(model(),100),fileResponse(Buffer.alloc(32)),new Response("private",{status:403})]) {
    const transfer=downloader(async()=>response); transfer.start(source,folder); await transfer.wait();
    assert.equal(transfer.view().phase,"error"); assert.deepEqual(readdirSync(folder),[]);
  }
}));

test("allowed CDN redirects have no credentials; untrusted redirects are never fetched",()=>fixture(async folder=>{
  const calls=[];
  const transfer=downloader(async(url,options)=>{
    calls.push(url); assert.equal(options.headers.Authorization,undefined);
    return calls.length===1 ? new Response(null,{status:302,headers:{Location:"https://cdn.hf.co/model"}}) : fileResponse();
  });
  transfer.start(source,folder); await transfer.wait(); assert.equal(transfer.view().phase,"complete"); assert.equal(calls.length,2);
  const blockedCalls=[];
  const blocked=downloader(async url=>{blockedCalls.push(url); return new Response(null,{status:302,headers:{Location:"http://127.0.0.1/private"}});});
  blocked.start(source.replace("model.gguf","other.gguf"),folder); await blocked.wait();
  assert.equal(blocked.view().phase,"error"); assert.equal(blockedCalls.length,1);
}));

test("cancellation cleans its temporary file and releases the download slot",()=>fixture(async folder=>{
  let started;
  const ready=new Promise(done=>started=done);
  const transfer=downloader(async(_url,{signal})=>new Response(new ReadableStream({start(controller){controller.enqueue(model().subarray(0,8));signal.addEventListener("abort",()=>controller.error(new Error("cancelled")),{once:true});started();}})));
  transfer.start(source,folder); await ready; await transfer.cancel();
  assert.equal(transfer.view().phase,"cancelled"); assert.deepEqual(readdirSync(folder),[]); assert.equal(transfer.active(),false);
}));

test("insufficient disk space cancels the response without creating a file",()=>fixture(async folder=>{
  let cancelled=false;
  const transfer=createModelDownloader({diskFree:()=>0,fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{"Content-Length":"1000"}})});
  transfer.start(source,folder);await transfer.wait();assert.match(transfer.view().error,/disk space/);assert.equal(cancelled,true);assert.deepEqual(readdirSync(folder),[]);
}));

test("a destination created during download is preserved",()=>fixture(async folder=>{
  const transfer=downloader(async()=>{writeFileSync(join(folder,"example--instruct--model.gguf"),"existing");return fileResponse();});
  transfer.start(source,folder);await transfer.wait();assert.equal(transfer.view().phase,"error");assert.equal(readFileSync(transfer.view().path,"utf8"),"existing");assert.equal(readdirSync(folder).length,1);
}));

test("local picker lists offline files, keeps duplicate names distinct, and never exposes paths",()=>fixture(folder=>{
  mkdirSync(join(folder,"nested"));
  const first=join(folder,"same.gguf"),second=join(folder,"nested","same.gguf");writeFileSync(first,model());writeFileSync(second,model());
  const settings={modelsDirectory:folder,modelPath:first,model:"server-alias"};
  const offline=localModelCatalogue(settings);
  assert.equal(offline.length,2);assert.notEqual(offline[0].selectionKey,offline[1].selectionKey);
  assert.equal(offline.filter(item=>item.selected).length,1);assert.equal(offline.some(item=>item.loaded),false);
  assert.equal(JSON.stringify(offline).includes(folder.replaceAll("\\","\\\\")),false);
  assert.equal(offline.some(item=>"path" in item),false);
  assert.equal(localModelCatalogue(settings,[{name:"server-alias",loaded:true}]).filter(item=>item.loaded).length,1);
  const alternative=offline.find(item=>!item.selected);
  assert.equal(resolveLocalModelSelection(settings,alternative.selectionKey).modelPath,second);
  assert.throws(()=>resolveLocalModelSelection(settings,"gguf:unknown"),/no longer/);
}));

test("configured external GGUF is retained without importing arbitrary selection paths",()=>fixture(folder=>{
  const external=join(folder,"outside.gguf");writeFileSync(external,model());
  const settings={modelsDirectory:join(folder,"empty"),modelPath:external,model:"alias"};
  const catalogue=localModelCatalogue(settings);assert.equal(catalogue.length,1);assert.equal(catalogue[0].selected,true);
  assert.equal(resolveLocalModelSelection(settings,catalogue[0].selectionKey).modelPath,external);
  assert.throws(()=>resolveLocalModelSelection(settings,external),/no longer/);
}));
