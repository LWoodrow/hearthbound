import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

test("portrait dialog displays escaped background, opens modally and restores focus on close",()=>{
  const require=createRequire(import.meta.url);
  const source=readFileSync(new URL("../src/PortraitDialog.tsx",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  let effect, opened=0, closed=0, focused=0, dismissed=0;
  class Element { isConnected=true; focus(){focused++;} }
  const opener=new Element();
  const dialog={showModal(){opened++;},close(){closed++;}};
  const exports={};
  runInNewContext(compiled,{exports,HTMLElement:Element,document:{activeElement:opener},require:name=>name==="react"?{
    useRef:()=>({current:dialog}),useId:()=>"portrait-title",useEffect:callback=>{effect=callback;},
  }:require(name)});
  const element=exports.PortraitDialog({name:"Neil",subtitle:"Fighter",background:"<script>secret</script>",appearance:"A traveller.",children:React.createElement("span",{className:"avatar-expanded"}),onClose:()=>{dismissed++;}});
  const html=renderToStaticMarkup(element);
  assert.match(html,/<dialog[^>]+aria-labelledby="portrait-title"/);
  assert.match(html,/avatar-expanded/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  const cleanup=effect();
  assert.equal(opened,1);
  let prevented=false;
  element.props.onCancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(dismissed,1);
  const target={getBoundingClientRect:()=>({left:10,right:100,top:10,bottom:100})};
  element.props.onClick({target,currentTarget:target,clientX:50,clientY:50});
  assert.equal(dismissed,1);
  element.props.onClick({target,currentTarget:target,clientX:0,clientY:50});
  assert.equal(dismissed,2);
  cleanup();
  assert.equal(closed,1);
  assert.equal(focused,1);
});
