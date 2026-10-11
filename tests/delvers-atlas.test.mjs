import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import roads from '../server/adventures/eldervale-roads.mjs';
import {cityAtlases,cityOverview} from '../server/adventures/eldervale-city.mjs';
import {delversLayout} from '../server/adventures/delvers-atlas.mjs';
import {createCanonicalState} from '../server/interaction-engine.mjs';
import {projectLocalAtlas} from '../server/regional-atlas.mjs';
import {resolveWorldAction} from '../server/world-state.mjs';
const atlas=cityAtlases.find(a=>a.id==='city-delvers');
const stateAt=id=>createCanonicalState(roads,{currentLocation:id,visited:['city',id]});

test('only Delvers switches to approved full-frame artwork; every referenced district asset exists',()=>{
 for(const a of cityAtlases){assert.ok(existsSync(new URL('../public'+a.image,import.meta.url)));if(a!==atlas){assert.equal(a.image,cityOverview.image);assert.deepEqual(a.imageViewport.scale,2.4);assert.equal(a.routeGeometry,undefined);}}
 assert.equal(atlas.places.length,9);assert.equal(atlas.places.find(p=>p.id==='city-delvers-last').x,50);
 assert.deepEqual(atlas.places.map(p=>p.id).sort(),['city-delvers','city-delvers-last','city-delvers-rope','city-delvers-maps','city-delvers-board','city-delvers-memorial','city-delvers-gear','city-delvers-hostel','city-delvers-guild'].sort());
 const approved=readFileSync(new URL('../public'+atlas.image,import.meta.url));assert.equal(approved.subarray(1,4).toString(),'PNG');
});

test('authored street bends reach exact markers and every rendered route is a bidirectional canonical exit',()=>{
 assert.equal(atlas.routeGeometry.length,atlas.links.length);
 for(const [from,to] of atlas.links){const route=atlas.routeGeometry.find(r=>r.from===from&&r.to===to);const a=atlas.places.find(p=>p.id===from),b=atlas.places.find(p=>p.id===to);assert.deepEqual(route.points[0],[a.x,a.y]);assert.deepEqual(route.points.at(-1),[b.x,b.y]);assert.ok(route.points.length>2);for(const p of route.points)assert.ok(p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=100));for(const [a,b] of [[from,to],[to,from]]){assert.ok(roads.locations[a].exits.some(e=>e.to===b));assert.equal(resolveWorldAction({definition:roads,state:stateAt(a),action:'Go to '+roads.locations[b].name,actorId:'test'}).accepted,true);}}
 const view=projectLocalAtlas(stateAt('city-delvers'));for(const route of view.routes){const authored=atlas.routeGeometry.find(r=>r.from===route.from&&r.to===route.to)||atlas.gateways.find(p=>p.id===route.to);assert.deepEqual(route.points,authored.points);}
 assert.equal(view.sites.find(s=>s.id==='city-delvers-guild').available,true,'public walking is not restricted to the illustrated lane graph');
 assert.equal(view.sites.find(s=>s.id==='city-delvers-last').available,true);
});

test('district arrows expose exactly the canonical neighbours without shortcuts or remote travel',()=>{
 const root=projectLocalAtlas(stateAt('city-delvers'));
 const expected=['city','city-crown','city-lantern','city-old','city-temples'];
 assert.deepEqual(root.sites.filter(s=>s.kind==='district-exit').map(s=>s.id).sort(),expected.sort());
 for(const id of expected){const marker=root.sites.find(s=>s.id===id);assert.equal(marker.available,true);const route=root.routes.find(r=>r.to===id);assert.deepEqual(route.points[0],[58,86]);assert.deepEqual(route.points.at(-1),[marker.x,marker.y]);assert.ok(route.points.every(p=>p.every(n=>n>=0&&n<=100)));assert.equal(resolveWorldAction({definition:roads,state:stateAt('city-delvers'),action:'Go to '+roads.locations[id].name,actorId:'test'}).accepted,true);}
 const remote=projectLocalAtlas(stateAt('city-delvers-last'));
 assert.equal(remote.sites.filter(s=>s.kind==='district-exit').length,5);
 assert.ok(remote.sites.filter(s=>s.kind==='district-exit').every(s=>!s.available));
 assert.ok(!root.sites.some(s=>s.id==='city-exchange'));
 assert.ok(projectLocalAtlas(stateAt('city-delvers'),'Finish combat first').sites.every(s=>!s.available));
 assert.equal(root.sites.find(s=>s.id==='city-delvers-hostel').beyondView,true);
 assert.ok(roads.locations['city-delvers-hostel']);
});

test('street layout connects all destinations and preserves existing district boundary exits',()=>{
 const seen=new Set(['city-delvers']),queue=['city-delvers'];while(queue.length){for(const [a,b] of atlas.links){const id=queue[0];const next=a===id?b:b===id?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push(next);}}queue.shift();}assert.equal(seen.size,9);
 const expected=cityOverview.links.filter(l=>l.includes('city-delvers')).map(l=>l.find(id=>id!=='city-delvers')).sort();
 assert.deepEqual(roads.locations['city-delvers'].exits.filter(e=>!atlas.places.some(p=>p.id===e.to)).map(e=>e.to).sort(),expected);
});

test('eligible descent is anchored beside the tavern and hidden before briefing; return remains open',()=>{
 const state=stateAt('city-delvers-last');assert.ok(!projectLocalAtlas(state).sites.some(s=>s.id==='city-under-landing'));
 state.flags.cityDescentBriefed=true;const view=projectLocalAtlas(state),marker=view.sites.find(s=>s.id==='city-under-landing');
 assert.deepEqual([marker.x,marker.y],delversLayout.boundaryAnchors[marker.id]);assert.equal(marker.available,true);
 const entered=resolveWorldAction({definition:roads,state,action:'Go to Rope Landing',actorId:'test'});assert.equal(entered.accepted,true);
 assert.equal(resolveWorldAction({definition:roads,state:entered.state,action:'Go to The Last Lantern',actorId:'test'}).accepted,true);
});
