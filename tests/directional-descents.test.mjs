import test from 'node:test';
import assert from 'node:assert/strict';
import roads from '../server/adventures/eldervale-roads.mjs';
import {createCanonicalState,resolveAuthoredInteraction} from '../server/interaction-engine.mjs';
import {resolveWorldAction,classifyWorldAction} from '../server/world-state.mjs';
import {normaliseActionText} from '../server/semantic-tokens.mjs';
import {parseLiteralIntent} from '../server/intent-resolver.mjs';
import {buildSceneCommandSurface} from '../server/scene-command-surface.mjs';
import {interpretSceneTurn} from '../server/turn-interpretation.mjs';
const at=(id,flags={})=>createCanonicalState(roads,{currentLocation:id,visited:['city',id],flags});
const move=(definition,state,action,mode='act')=>resolveWorldAction({definition,state,action,mode,turn:interpretSceneTurn(buildSceneCommandSurface(definition,state),action,mode)});

test('all three city descents resolve direction after briefing and retain requirements and return routes',()=>{
 for(const [surface,room,target,flag] of [['city-delvers-last','landing','descent safety ledger','cityDescentBriefed'],['city-mourning-crypt','steps','public crypt register','cityCryptBriefed'],['city-lowwater-pump','cistern','pumping station notice','cityPumpBriefed']]){
  const before=at(surface);
  for(const action of ['descend','go down','enter the lower area','decend into the dark','descend the maintained route']){
   const blocked=move(roads,before,action);assert.equal(blocked.accepted,false,action);assert.equal(blocked.state.currentLocation,surface);
   const read=resolveAuthoredInteraction({definition:roads,state:before,action:'read '+target});assert.equal(read.accepted,true);assert.equal(read.state.currentLocation,surface);assert.equal(read.state.flags[flag],true);assert.ok(read.message.includes(roads.locations['city-under-'+room].name));
   const entered=move(roads,read.state,action);assert.equal(entered.accepted,true,action);assert.equal(entered.state.currentLocation,'city-under-'+room);
   const back=move(roads,entered.state,'ascend');assert.equal(back.accepted,true);assert.equal(back.state.currentLocation,surface);
  }
 }
});

test('single directional choice is shared, unambiguous and cannot bypass locked or hidden route guards',()=>{
 const definition={id:'vertical-test',startLocation:'hall',initialFlags:{briefed:false},objects:{hatch:{name:'hatch'}},locations:{hall:{name:'Hall',exits:[{to:'depth',via:'shaft',direction:'down',object:'hatch',requires:[{path:'flags.briefed',equals:true}]},{to:'shop',via:'lane'}]},depth:{name:'Depth',exits:[]},shop:{name:'Shop',exits:[]},other:{name:'Other depth',exits:[]}}};
 const state=createCanonicalState(definition,{currentLocation:'hall',flags:{briefed:true},objects:{hatch:{discovered:true,open:true,locked:false}}});
 assert.equal(move(definition,state,'enter the lower area').state.currentLocation,'depth');
 assert.equal(move(definition,state,'go down to Shop').accepted,false);
 assert.equal(move(definition,state,'ascend').accepted,false);
 for(const patch of [{discovered:false},{locked:true}])assert.equal(move(definition,{...state,objects:{hatch:{...state.objects.hatch,...patch}}},'descend').accepted,false);
 const ambiguous=structuredClone(definition);ambiguous.locations.hall.exits.push({to:'other',via:'another shaft',direction:'down'});
 const unresolved=move(ambiguous,state,'descend');assert.equal(unresolved.handled,false);assert.equal(unresolved.state.currentLocation,'hall');
 assert.equal(move(roads,at('city-delvers-last',{cityDescentBriefed:true}),'descend','speak').state.currentLocation,'city-delvers-last');
});

test('vertical typo correction applies only to command verbs, not entity words or speech modes',()=>{
 assert.equal(normaliseActionText('decend into the dark'),'descend into the dark');
 assert.equal(normaliseActionText('please asend'),'please ascend');
 assert.equal(normaliseActionText('look at decend sign'),'look at decend sign');
 assert.equal(classifyWorldAction('decend into the dark'),'move');
 assert.equal(classifyWorldAction('decend into the dark','speak'),'speech');
 const parsed=parseLiteralIntent('decend into the dark');assert.equal(parsed.verb,'move');assert.equal(parsed.literal,'decend into the dark');
 assert.equal(classifyWorldAction('decen into the dark'),'other');
});

test('Hester locates the ledger inside the tavern; ledger cannot be read remotely',()=>{
 const greeting=roads.locations['city-delvers'].entryBeats[0].text;assert.match(greeting,/inside The Last Lantern/);assert.match(greeting,/Rope Landing/);
 const state=at('city-delvers');const read=resolveAuthoredInteraction({definition:roads,state,action:'read safety ledger'});assert.notEqual(read.accepted,true);assert.equal(state.flags.cityDescentBriefed,false);
});
