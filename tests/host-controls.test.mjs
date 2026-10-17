import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('actual API protects destructive library/restart controls while permitting ordinary LAN character login',()=>{
 // A separate process ensures index.mjs can ONLY open a memory database,
 // never the user's save or another test's cached application singleton.
 const source=`
  process.env.DND_DATABASE=':memory:';
  const {Readable}=await import('node:stream');
  const {handleApi}=await import('./server/index.mjs');
  const assert=(await import('node:assert/strict')).default;
  async function call(method,path,body,{remote=false,origin}={}){
   let status,data;
   const host=remote?'192.168.1.2:4173':'127.0.0.1:4173';
   const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.method=method;
   req.headers={host,...(origin?{origin}:{})};req.socket={remoteAddress:remote?'192.168.1.99':'127.0.0.1'};
   const res={writeHead:n=>{status=n;},end:bytes=>{data=JSON.parse(bytes);}};
   await handleApi(req,res,new URL(path,'http://'+host));return {status,data};
  }
  const created=await call('POST','/api/players',{partyId:'party-first-company',name:'Temporary review',species:'Human',className:'Fighter'},{remote:true});
  assert.equal(created.status,201);const id=created.data.player.id;
  for(const remote of [true,false]){
   const options=remote?{remote:true}:{origin:'https://foreign.example'};
   for(const [method,path,body] of [['DELETE','/api/players/'+id],['POST','/api/players/'+id+'/move',{partyId:'party-first-company'}],['POST','/api/adventures/select',{partyId:'party-first-company',adventureId:'world-hearthbound-lantern-below'}],['POST','/api/system/restart'],['POST','/api/adventure/restart'],['POST','/api/test/reset-story']]){
    const result=await call(method,path,body,options);assert.equal(result.status,403,path);
   }
  }
  assert.equal((await call('POST','/api/login',{playerId:id},{remote:true})).status,200);
  assert.equal((await call('POST','/api/adventures/select',{partyId:'party-first-company',adventureId:'world-hearthbound-lantern-below'})).status,200);
  assert.equal((await call('DELETE','/api/players/'+id)).status,200);
  console.log('host-control-regressions-pass');
 `;
 const output=execFileSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('../',import.meta.url),windowsHide:true,encoding:'utf8',timeout:15000});
 assert.match(output,/host-control-regressions-pass/);
});
