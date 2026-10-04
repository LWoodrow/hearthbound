import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {runInNewContext} from "node:vm";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";

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
