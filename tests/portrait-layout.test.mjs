import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";

const source=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const parsed=ts.createSourceFile("App.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const selected=parsed.statements.filter((node)=>ts.isFunctionDeclaration(node) && ["CharacterAvatar","EventCard"].includes(node.name?.text))
  .map((node)=>"export "+node.getText(parsed)).join("\n");
const compiled=ts.transpileModule(selected,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
const exported={};
runInNewContext(compiled,{
  exports:exported,React,avatarFor:(player)=>player.avatarId || "guardian",
  Portrait:({className})=>React.createElement("span",{className:"character-avatar "+className}),
});
const player={name:"Nigel",avatarId:"guardian"};
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
const rule=(selector)=>css.split("\n").find((line)=>line.trimStart().startsWith(selector+" {")) || "";

test("game portraits offer an accessible inspect button while lobby portraits stay non-interactive",()=>{
  const html=render(exported.CharacterAvatar,{player,onInspect:()=>{}});
  assert.match(html,/aria-haspopup="dialog"/);
  assert.match(html,/View Nigel portrait and background/);
  assert.doesNotMatch(render(exported.CharacterAvatar,{player,size:"lobby"}),/<button/);
});

test("NPC event portraits are clickable without making unknown speakers interactive",()=>{
  const props={ownPlayer:player,party:[player],npcPortraits:{"Tamsin Reed":"tamsin"},onInspectNpc:()=>{}};
  assert.match(render(exported.EventCard,{...props,event:{kind:"narration",speaker:"Tamsin Reed",text:"Evening."}}),/View Tamsin Reed portrait and background/);
  assert.doesNotMatch(render(exported.EventCard,{...props,event:{kind:"narration",speaker:"Unknown",text:"Evening."}}),/portrait-trigger/);
});

test("party and sheet portraits preserve accessible names and use separate size classes",()=>{
  const party=render(exported.CharacterAvatar,{player});
  assert.match(party,/portrait-frame/);
  assert.match(party,/role="img" aria-label="Nigel portrait"/);
  assert.match(party,/avatar-party/);
  assert.match(render(exported.CharacterAvatar,{player,size:"sheet"}),/avatar-sheet/);
  assert.match(rule(".avatar-party"),/width:48px; height:48px/);
  assert.match(rule(".avatar-sheet"),/width:96px; height:96px/);
  assert.match(css,/@media \(max-width: 900px\) \{\s*\.game-shell[^\n]*\n\s*\.avatar-party \{ width:40px; height:40px/);
});

test("player NPC and roll cards all use the 40px event portrait rather than party dimensions",()=>{
  for (const event of [
    {kind:"narration",speaker:"Nigel",text:"Hello.",visibility:"public"},
    {kind:"narration",speaker:"Tamsin Reed",text:"Evening.",visibility:"public"},
    {kind:"roll",speaker:"Combat",text:"Nigel attacks.",visibility:"public"},
  ]) {
    const html=render(exported.EventCard,{event,ownPlayer:player,party:[player],npcPortraits:{"Tamsin Reed":"tamsin"}});
    assert.match(html,/avatar-event/);
    assert.doesNotMatch(html,/avatar-party/);
  }
  assert.match(rule(".avatar-event"),/width:40px; height:40px/);
});

test("borderless rounded portraits use the full artwork area without enlarging the UI",()=>{
  assert.match(rule(".character-avatar"),/border-radius:8px/);
  assert.match(rule(".portrait-frame"),/flex:0 0 auto; line-height:0/);
  assert.match(rule(".combat-actions button::before"),/width:40px; height:40px/);
  assert.match(rule(".combat-actions button::before"),/border-radius:8px/);
  assert.match(rule(".combat-actions button"),/grid-template-columns:40px minmax\(0,1fr\)/);
  assert.match(rule(".character-avatar"),/border:0/);
  assert.match(rule(".painted-portrait"),/box-shadow:none/);
  assert.match(rule(".combat-actions button::before"),/border:0/);
  assert.equal(rule(".party-member.you .character-avatar, .party-member.spotlight .character-avatar"),"");
  assert.equal(rule(".party-member.companion .party-portrait, .party-member.companion .character-avatar"),"");
  assert.match(rule(".party-strip"),/minmax\(0,auto\)/);
  assert.match(rule(".story-feed"),/var\(--party-bar-height\)/);
});
