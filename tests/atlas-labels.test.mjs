import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";

test('district exits and beyond-view destinations remain distinct and accessible in the shared map UI',()=>{
 const require=createRequire(import.meta.url),exports={};
 const compiled=ts.transpileModule(readFileSync(new URL('../src/LocalAtlas.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(compiled,{exports,require});
 const sites=[{id:'junction',name:'Junction',x:50,y:50,kind:'local',current:true,visited:true,npcs:[]},{id:'neighbour',name:'Neighbour',x:95,y:20,kind:'district-exit',current:false,visited:false,npcs:[]},{id:'hostel',name:'Hostel',x:20,y:98,kind:'local',beyondView:true,current:false,visited:false,npcs:[]}];
 const html=renderToStaticMarkup(React.createElement(exports.LocalAtlas,{atlas:{id:'junction',title:'Test',sites,routes:[],actions:[],image:'/test.png',imageAlt:'Test',task:'Test'},busy:false,travel:()=>{},act:()=>{}}));
 assert.match(html,/Neighbour · Exit/);assert.match(html,/Hostel · Beyond view/);
 assert.match(html,/aria-label="Neighbouring district exits"/);
 assert.match(html,/aria-label="Neighbour, district exit, charted"/);
 assert.match(html,/district-exit/);assert.match(html,/edge-destination/);
});

test('authored local street bends and label sides render without moving markers; legacy straight routes still render',()=>{
 const require=createRequire(import.meta.url),exports={};
 const compiled=ts.transpileModule(readFileSync(new URL('../src/LocalAtlas.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(compiled,{exports,require});
 const sites=[{id:'a',name:'Maps',x:29,y:35,labelSide:'left',current:true,visited:true,npcs:[]},{id:'b',name:'Tavern',x:45,y:34,current:false,visited:false,npcs:[]}];
 const render=routes=>renderToStaticMarkup(React.createElement(exports.LocalAtlas,{atlas:{id:'test',title:'Test',sites,routes,actions:[],image:'/test.png',imageAlt:'Test',task:'Test'},busy:false,travel:()=>{},act:()=>{}}));
 assert.match(render([{from:'a',to:'b',points:[[29,35],[37,34],[45,34]]}]),/d="M29 35 L37 34 L45 34"/);
 assert.match(render([{from:'a',to:'b'}]),/d="M29 35 L45 34"/);
 assert.match(render([]),/class="atlas-destination label-left current[^\"]*" style="left:29%;top:35%"/);
});

test("right-edge map labels face inward without moving canonical anchors",()=>{
  const require=createRequire(import.meta.url),exports={};
  const source=readFileSync(new URL("../src/LocalAtlas.tsx",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(compiled,{exports,require});
  const sites=[{id:"landing",name:"Landing",x:59,y:34,current:true,visited:true,npcs:[]},{id:"bell",name:"Old Bell Boathouse",x:82,y:88,current:false,visited:true,npcs:[]}];
  const atlas={id:"test",title:"Test",sites,routes:[],actions:[],image:"/test.png",imageAlt:"Test",task:"Test"};
  const html=renderToStaticMarkup(React.createElement(exports.LocalAtlas,{atlas,busy:false,travel:()=>{},act:()=>{}}));
  assert.match(html,/class="atlas-destination label-left [^"]*" style="left:82%;top:88%"/);
  assert.match(html,/class="atlas-destination  current[^"]*" style="left:59%;top:34%"/);
  const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
  assert.match(css,/\.atlas-destination\.label-left \{ flex-direction:row-reverse; transform:translate\(calc\(-100% \+ 15px\),-50%\)/);
  const world=readFileSync(new URL("../src/WorldAtlas.tsx",import.meta.url),"utf8");
  assert.match(world,/place.x>=72\?"label-left"/);
});
