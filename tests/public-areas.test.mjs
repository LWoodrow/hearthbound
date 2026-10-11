import test from 'node:test';
import assert from 'node:assert/strict';
import {connectPublicAreas} from '../server/public-areas.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {resolveWorldAction} from '../server/world-state.mjs';
import {projectScene} from '../server/scene-projection.mjs';
import {buildSceneCommandSurface} from '../server/scene-command-surface.mjs';
import {interpretSceneTurn} from '../server/turn-interpretation.mjs';

function fixture(){
 const source={square:{name:'Square',exits:[{to:'shop',via:'shop door',object:'door',requires:[{path:'flags.permit',equals:true}]}]},
  workshop:{name:'Workshop',exits:[]},shop:{name:'Shop',exits:[]},vault:{name:'Vault',exits:[]}};
 const definition={id:'public-test',startLocation:'workshop',objects:{door:{name:'Shop door'}},initialFlags:{permit:false},
  locations:connectPublicAreas(source,[{id:'plaza',members:['square','workshop',{id:'shop',object:'door',requires:[{path:'flags.permit',equals:true}]}]}])};
 const state=createCanonicalState(definition,{currentLocation:'workshop',visited:['workshop'],flags:{permit:true},objects:{door:{open:true,locked:false,discovered:true}}});
 return {source,definition,state};
}
const move=(definition,state,action)=>resolveWorldAction({definition,state,action,turn:interpretSceneTurn(buildSceneCommandSurface(definition,state),action,'act')});
test('authored public areas compile direct walking for all ordinary consumers without intermediate visits or mutation',()=>{
 const {source,definition,state}=fixture();
 assert.equal(source.workshop.exits.length,0);
 assert.ok(projectScene(definition,state).exits.some(exit=>exit.to==='shop'));
 const result=move(definition,state,'go to Shop');
 assert.equal(result.state.currentLocation,'shop');assert.deepEqual(result.state.visited,['workshop','shop']);
 assert.equal(result.state.previousLocation,'workshop');assert.equal(state.currentLocation,'workshop');
 assert.equal(definition.locations.square.exits.filter(exit=>exit.to==='shop').length,1);
 assert.equal(definition.locations.square.exits.find(exit=>exit.to==='shop').object,'door');
});
test('public walking does not bypass prerequisites, locked/hidden doors, nonmembers or speech boundaries',()=>{
 const {definition,state}=fixture();
 for(const patch of [{locked:true},{discovered:false}]){
  const blocked=move(definition,{...state,objects:{door:{...state.objects.door,...patch}}},'go to Shop');
  assert.equal(blocked.accepted,false);assert.equal(blocked.state.currentLocation,'workshop');
 }
 const blocked=move(definition,{...state,flags:{permit:false}},'go to Shop');assert.equal(blocked.accepted,false);
 assert.ok(!projectScene(definition,{...state,flags:{permit:false}}).exits.some(exit=>exit.to==='shop'));
 assert.equal(move(definition,state,'go to Vault').state.currentLocation,'workshop');
 assert.equal(resolveWorldAction({definition,state,action:'go to Shop',mode:'speak'}).state.currentLocation,'workshop');
});
test('public area membership must be explicit, valid and nonoverlapping',()=>{
 const {source}=fixture();
 assert.throws(()=>connectPublicAreas(source,[{id:'a',members:['missing']}]),/Unknown/);
 assert.throws(()=>connectPublicAreas(source,[{id:'a',members:['square']},{id:'b',members:['square']}]),/Overlapping/);
 assert.throws(()=>connectPublicAreas(source,[{id:'a',members:['square','workshop','shop']}]),/explicit public entrance/);
});
test('a fully named remote place never becomes a local destination sharing the same noun',()=>{
 const definition={id:'district-names',startLocation:'square',locations:{square:{name:'Square',exits:[{to:'local',via:'public walk'}]},local:{name:'Local Exchange',exits:[]},remote:{name:'Grand Exchange',exits:[]}}};
 const state=createCanonicalState(definition);
 assert.equal(move(definition,state,'go to Grand Exchange').state.currentLocation,'square');
 assert.equal(move(definition,state,'go to Local Exchange').state.currentLocation,'local');
});
