import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {movementFromScene,movementForPlayer} from '../server/movement-view.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {resolveWorldAction} from '../server/world-state.mjs';
import {buildSceneCommandSurface} from '../server/scene-command-surface.mjs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createDatabase,createPlayer,selectAdventure,setPartyState,getPartyState,getPlayer,getParty} from '../server/database.mjs';
import {resolveAction} from '../server/dm.mjs';

const at=(location,flags={})=>createCanonicalState(roads,{currentLocation:location,flags});
test('Move lists every currently eligible public walk without the three-card guidance limit or a separate travel rule',()=>{
 const state=at('city-delvers-rope'),view=movementFromScene(roads,state);
 assert.equal(view.options.length,8);
 assert.equal(view.locationName,'Three Knots Ropeworks');
 for(const option of view.options){
  const moved=resolveWorldAction({definition:roads,state,action:option.text});
  assert.equal(moved.state.currentLocation,option.id,option.text);
 }
 assert.ok(!view.options.some(option=>option.id==='city-under-landing'));
 assert.ok(!buildSceneCommandSurface(roads,state).guidance.some(suggestion=>suggestion.sourceId.startsWith('exit:')));
});
test('Move reveals descent after briefing, refreshes on return, and never charts remote dungeon rooms',()=>{
 assert.ok(!movementFromScene(roads,at('city-delvers-last')).options.some(option=>option.id==='city-under-landing'));
 const view=movementFromScene(roads,at('city-delvers-last',{cityDescentBriefed:true}));
 assert.ok(view.options.some(option=>option.id==='city-under-landing'));
 const underground=movementFromScene(roads,at('city-under-landing'));
 assert.deepEqual(underground.options.map(option=>option.id).sort(),['city-delvers-last','city-under-crossing']);
 assert.ok(!JSON.stringify(underground).includes('Citadel Threshold'));
});
test('Move cards exclude locked, undiscovered, prerequisite-gated and unopenable doors',()=>{
 const definition={id:'gates',startLocation:'hall',initialFlags:{permit:false},objects:{locked:{name:'Locked door'},hidden:{name:'Hidden door'},sealed:{name:'Sealed door',openable:false}},locations:{
  hall:{name:'Hall',exits:[{to:'a',via:'locked door',object:'locked'},{to:'b',via:'hidden door',object:'hidden'},{to:'c',via:'sealed door',object:'sealed'},{to:'d',via:'gated stair',requires:[{path:'flags.permit',equals:true}]}]},
  a:{name:'Locked room'},b:{name:'Hidden room'},c:{name:'Sealed room'},d:{name:'Gated room'}}};
 const state=createCanonicalState(definition,{objects:{locked:{locked:true},hidden:{discovered:false},sealed:{open:false}}});
 assert.deepEqual(movementFromScene(definition,state).options,[]);
 assert.equal(movementFromScene(null,null).options.length,0);
});
test('real player Move projection is independent of guidance mode and honours whole-party travel blockers',async()=>{
 const db=createDatabase(':memory:');try{
  const player=createPlayer(db,{partyId:'party-first-company',name:'Neil',species:'Human',className:'Fighter'});
  // Use the actual world's ID rather than relying on a UI label.
  selectAdventure(db,player.partyId,getParty(db,player.partyId).worldId+'-eldervale-roads');
  setPartyState(db,player.partyId,'world:eldervale-roads',at('city-delvers-rope'));
  setPartyState(db,player.partyId,'guidanceMode','classic');
  const view=movementForPlayer(db,player);assert.equal(view.options.length,8);
  const chosen=view.options.find(option=>option.id==='city-delvers-maps');
  const before=getPartyState(db,player.partyId,'world:eldervale-roads');
  assert.equal(before.currentLocation,'city-delvers-rope','projecting and selecting do not travel');
  await resolveAction(db,getPlayer(db,player.id),'act',chosen.text);
  assert.equal(movementForPlayer(db,player).locationId,'city-delvers-maps');
  setPartyState(db,player.partyId,'combat',{active:true});assert.match(movementForPlayer(db,player).reason,/combat/);
  setPartyState(db,player.partyId,'combat',{active:false});
  const other=createPlayer(db,{partyId:player.partyId,name:'Other',species:'Elf',className:'Fighter'});
  setPartyState(db,player.partyId,'pendingCheck:'+other.id,{kind:'ability'});assert.match(movementForPlayer(db,player).reason,/pending check/);
  setPartyState(db,player.partyId,'pendingCheck:'+other.id,null);
  db.prepare('UPDATE players SET hp=0 WHERE id=?').run(other.id);assert.match(movementForPlayer(db,player).reason,/fallen/);
 }finally{db.close();}
});
test('Move panel renders all destination cards, selected state and disabled blockers; selection only prepares text',()=>{
 const require=createRequire(import.meta.url),exports={};
 const source=readFileSync(new URL('../src/MovePanel.tsx',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require});
 const movement=movementFromScene(roads,at('city-delvers-rope'));let chosen;
 const element=exports.MovePanel({movement,selected:'city-delvers-maps',busy:false,onSelect:(id,text)=>{chosen={id,text};}});
 const html=renderToStaticMarkup(element);assert.equal((html.match(/aria-pressed=/g)||[]).length,8);assert.match(html,/aria-pressed="true"/);
 assert.match(html,/then Send to travel/);assert.match(html,/Moth &amp; Compass Maps/);
 const grid=element.props.children.at(-1),button=grid.props.children[0].find(button=>button.key==='city-delvers-maps');
 button.props.onClick();assert.equal(chosen.id,'city-delvers-maps');assert.match(chosen.text,/^Go to/);
 const blocked=renderToStaticMarkup(exports.MovePanel({movement:{...movement,reason:'Finish combat before travelling.'},selected:null,busy:false,onSelect(){}}));
 assert.equal((blocked.match(/disabled=""/g)||[]).length,8);assert.match(blocked,/role="status"/);
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/\["act", "move", "speak", "ask"\]/);assert.match(app,/mode:mode === "move" \? "act" : mode/);
});
