import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source=readFileSync(new URL("../src/ModelLoadProgress.tsx",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
const exported={};runInNewContext(compiled,{exports:exported,React});
const render=props=>renderToStaticMarkup(React.createElement(exported.ModelLoadProgress,props));

test("shared model loading bar animates without asserting a fabricated percentage",()=>{
  const html=render({loading:true,progress:100});
  assert.match(html,/model-load-track loading/);assert.match(html,/role="progressbar"/);
  assert.equal(html.includes("aria-valuenow"),false);assert.match(html,/progress not yet available/);
});

test("shared model ready bar displays confirmed completion and clamps values",()=>{
  assert.match(render({loading:false,progress:100}),/aria-valuenow="100"/);
  assert.match(render({loading:false,progress:100}),/width:100%/);
  assert.match(render({loading:false,progress:-20}),/aria-valuenow="0"/);
});
