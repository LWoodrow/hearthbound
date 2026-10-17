// Explicit --live host-admin diagnostic. Temporarily switches one managed model
// and ALWAYS attempts to restore the original settings/model in finally.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {evaluateDialogue,scenarios} from './evaluate-one-pass-dialogue.mjs';
import {threadFirstRequest} from './lib/thread-first.mjs';
import {currentModelProfile} from '../server/model-runtime.mjs';

if(!process.argv.includes('--live'))throw Error('Explicit --live approval is required.');
const option=name=>process.argv.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3);
const baselinePath=option('baseline');if(!baselinePath)throw Error('Specify --baseline=absolute/path/to/unchanged/evaluate-one-pass-dialogue.mjs');
const base=option('app-url') || 'http://127.0.0.1:4173';
if(new URL(base).hostname!=='127.0.0.1')throw Error('Comparison is restricted to the local host app.');
const settingsPath=resolve('data/ai-settings.json'),originalBytes=readFileSync(settingsPath),original=JSON.parse(originalBytes);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=async(path,body)=>{
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const value=await response.json();if(!response.ok)throw Error(value.error || `Host returned ${response.status}`);return value;
};
const waitReady=async model=>{
 const deadline=Date.now()+120000;
 while(Date.now()<deadline){
  const state=await request('/api/ai/settings');
  if(state.runtime?.model===model&&state.runtime.status==='ready'&&state.runtime.loaded)return;
  if(state.process?.phase==='error'||state.runtime?.status==='error')throw Error(state.process?.error || state.runtime?.error || 'Model load failed.');
  await new Promise(done=>setTimeout(done,1000));
 }
 throw Error('Model did not become ready within120s.');
};
const before=await request('/api/ai/settings');
if(original.provider!=='llamacpp'||original.mode!=='local'||!before.process?.managed)throw Error('Expected the existing app-managed local llama.cpp model.');
const originalModel=before.runtime.models.find(model=>model.selected&&model.name===original.model);
const coder=before.runtime.models.find(model=>model.name==='Qwen2.5-Coder-7B-Instruct-Q8_0');
if(!originalModel?.selectionKey||!coder?.selectionKey)throw Error('Original and coder selections must both exist before any switch.');
const report={startedAt:new Date().toISOString(),originalModel:original.model,testModel:coder.name,settingsHashBefore:hash(originalBytes),runs:[],restored:false};
const reportPath=new URL('../data/logs/coder-comparison-'+Date.now()+'.json',import.meta.url);
const baseline=await import(pathToFileURL(resolve(baselinePath)));
let changed=false,error;
try{
 changed=true;console.log(JSON.stringify({stage:'loading-coder',model:coder.name}));
 await request('/api/ai/load',{selectionKey:coder.selectionKey});await waitReady(coder.name);
 const profile=currentModelProfile();if(profile.model!==coder.name)throw Error('Inference settings did not select coder.');
 for(const experiment of [
  {name:'unchanged-main-nima',evaluate:baseline.evaluateDialogue,scenario:scenarios['nima-fiction']},
  {name:'typed-one-pass-nima',evaluate:evaluateDialogue,scenario:scenarios['nima-fiction']},
  {name:'thread-first-nima',evaluate:evaluateDialogue,scenario:scenarios['nima-fiction'],pipeline:threadFirstRequest},
  {name:'thread-first-selka',evaluate:evaluateDialogue,scenario:scenarios['selka-fiction'],pipeline:threadFirstRequest},
 ]){
  console.log(JSON.stringify({stage:'testing',run:experiment.name}));
  const result=await experiment.evaluate({profile,scenario:experiment.scenario,requestPipeline:experiment.pipeline,run:experiment.name,emit:turn=>console.log(JSON.stringify(turn.text?{run:experiment.name,question:turn.text,reply:turn.reply,thread:turn.conversationThread,kind:turn.utteranceKind,calls:turn.calls,ms:turn.elapsedMs,unchanged:turn.canonicalUnchanged}:turn))});
  report.runs.push({name:experiment.name,...result});
 }
}catch(caught){error=caught;report.error=caught.message;}
finally{
 if(changed){
  console.log(JSON.stringify({stage:'restoring-original',model:original.model}));
  try{
   await request('/api/ai/load',{...original,selectionKey:originalModel.selectionKey});await waitReady(original.model);
   report.settingsHashAfter=hash(readFileSync(settingsPath));
   report.restored=report.settingsHashAfter===report.settingsHashBefore;
   if(!report.restored)throw Error('Model ready, but full settings fingerprint differs.');
  }catch(restoreError){report.restoreError=restoreError.message;error=restoreError;}
 }
 report.finishedAt=new Date().toISOString();mkdirSync(dirname(fileURLToPath(reportPath)),{recursive:true});
 writeFileSync(reportPath,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify({stage:'finished',restored:report.restored,report:reportPath.href,runs:report.runs.map(run=>({name:run.name,...run.summary}))}));
}
if(error)throw error;
