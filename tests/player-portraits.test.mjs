import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {runInNewContext} from "node:vm";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";
import {PLAYER_PORTRAITS, PORTRAIT_SPECIES, playerPortrait, playerPortraitStyle, portraitsFor, portraitSelection, acceptedPlayerPortrait} from "../shared/player-portraits.mjs";
import {createDatabase, createPlayer, getPlayer} from "../server/database.mjs";
import {NPC_PORTRAIT_CROPS,NPC_PORTRAIT_INDEX,npcPortraitStyle} from "../shared/portrait-catalogue.mjs";

test("every supported species has male and female portraits with valid square crops and local assets",()=>{
  assert.equal(new Set(PLAYER_PORTRAITS.map(p=>p.id)).size,PLAYER_PORTRAITS.length);
  for(const species of PORTRAIT_SPECIES) for(const gender of ["male","female"]){
    const choices=portraitsFor(species,gender);
    assert.ok(choices.length>=3,`${species} ${gender} needs variety comparable to the Human set`);
    assert.ok(choices.every(p=>p.species===species&&p.gender===gender));
    for(const portrait of choices) assert.ok(existsSync(new URL("../public"+portrait.file,import.meta.url)));
  }
  for(const species of PORTRAIT_SPECIES.filter(s=>s!=="Human")){
    const png=readFileSync(new URL("../public/art/portraits/player-"+species.toLowerCase()+"-v1.png",import.meta.url));
    assert.equal(png.readUInt32BE(16),2*png.readUInt32BE(20));
    const variety=readFileSync(new URL("../public/art/portraits/player-"+species.toLowerCase()+"-variety-v2.png",import.meta.url));
    assert.equal(variety.readUInt32BE(16),variety.readUInt32BE(20));
    const cells=PLAYER_PORTRAITS.filter(p=>p.species===species&&p.file.endsWith("-variety-v2.png"));
    assert.equal(cells.length,4);
    assert.equal(new Set(cells.map(p=>p.position)).size,4);
    assert.deepEqual(cells.map(p=>p.gender),["male","male","female","female"]);
  }
  assert.equal(playerPortrait("mystic").species,"Elf");
  assert.ok(!portraitsFor("Human").some(p=>p.id==="mystic"));
});

test("species and presentation transitions always choose a valid portrait, preserving explicit choices",()=>{
  assert.equal(portraitSelection("Human","all","noble"),"noble");
  assert.equal(portraitSelection("Orc","female","noble"),"orc-female-v1");
  assert.equal(portraitSelection("Orc","male","orc-female-v1"),"orc-male-v1");
  assert.equal(portraitSelection("Tiefling","all","tiefling-female-v1"),"tiefling-female-v1");
  assert.equal(portraitSelection("Tiefling","female","tiefling-female-3-v2"),"tiefling-female-3-v2");
  assert.equal(acceptedPlayerPortrait("orc-female-v1","Human"),"");
  assert.equal(acceptedPlayerPortrait("/arbitrary.png","Human"),"");
  assert.equal(acceptedPlayerPortrait("cat","Human"),"");
  assert.equal(acceptedPlayerPortrait("mystic","Human"),"mystic"); // Existing callers remain compatible.
});

test("creation persists every new portrait; legacy pictures survive reload without a save migration",()=>{
  const db=createDatabase(":memory:");
  try {
    for(const portrait of PLAYER_PORTRAITS){
      const player=createPlayer(db,{partyId:"party-first-company",name:portrait.label,species:portrait.species,avatarId:portrait.id});
      assert.equal(player.avatarId,portrait.id);
      assert.equal(getPlayer(db,player.id).avatarId,portrait.id);
      assert.equal(getPlayer(db,player.id).species,portrait.species);
    }
    const invalid=createPlayer(db,{partyId:"party-first-company",name:"Invalid",species:"Elf",avatarId:"orc-male-v1"});
    assert.equal(invalid.avatarId,"");
  } finally { db.close(); }
});

const source=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const ast=ts.createSourceFile("App.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const chosen=ast.statements.filter(node=>(ts.isVariableStatement(node)&&node.pos<source.indexOf("function Portrait(")) || (ts.isFunctionDeclaration(node)&&["Portrait","AvatarGlyph","avatarFor","CharacterForm"].includes(node.name?.text)));
const code=ts.transpileModule(chosen.map(node=>(ts.isFunctionDeclaration(node)?"export ":"")+node.getText(ast)).join("\n"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
function harness(){
  const state=[]; let cursor=0;
  const exports={};
  runInNewContext(code,{exports,React,PORTRAIT_SPECIES,playerPortrait,playerPortraitStyle,portraitsFor,portraitSelection,npcPortraitStyle,NPC_PORTRAIT_INDEX,
    useRef:()=>({current:null}),useEffect:()=>{},
    useState:initial=>{const index=cursor++; if(!(index in state))state[index]=typeof initial==="function"?initial():initial; return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},
    FormActions:()=>null,
  });
  return {exports,render:()=>{cursor=0;return exports.CharacterForm({worldName:"Eldervale",partyName:"Company",onSubmit:()=>{},cancel:()=>{}});}};
}
function find(element,predicate){
  if(!element||typeof element!=="object")return;
  if(predicate(element))return element;
  for(const child of React.Children.toArray(element.props?.children)){const found=find(child,predicate);if(found)return found;}
}

test("creation places portraits after origin/class and updates the submitted ID immediately after filters change",()=>{
  const ui=harness(); let tree=ui.render();
  let html=renderToStaticMarkup(tree);
  assert.ok(html.indexOf("2 · Origin and class")<html.indexOf("3 · Portrait"));
  assert.ok(html.indexOf("3 · Portrait")<html.indexOf("4 · Ability scores"));
  assert.match(html,/>Male and female</); assert.match(html,/>Male</); assert.match(html,/>Female</);
  find(tree,e=>e.props?.["aria-label"]==="Courtier portrait · female").props.onClick();
  tree=ui.render();
  find(tree,e=>e.props?.name==="className").props.onChange({target:{value:"Rogue"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"noble");
  find(tree,e=>e.props?.name==="species").props.onChange({target:{value:"Dragonborn"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"dragonborn-male-v1");
  find(tree,e=>e.type==="select"&&e.props.value==="all").props.onChange({target:{value:"female"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"dragonborn-female-v1");
  html=renderToStaticMarkup(tree);
  assert.match(html,/dragonborn-female-v1/); assert.doesNotMatch(html,/aria-label="Dragonborn male portrait/);
  find(tree,e=>e.props?.name==="className").props.onChange({target:{value:"Wizard"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"dragonborn-female-v1");
  find(tree,e=>e.props?.name==="species").props.onChange({target:{value:"Gnome"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"gnome-female-v1");
  find(tree,e=>e.props?.["aria-label"]==="Violet chronicler portrait · female").props.onClick();
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"gnome-female-3-v2");
  find(tree,e=>e.props?.name==="className").props.onChange({target:{value:"Bard"}});
  tree=ui.render();
  assert.equal(find(tree,e=>e.props?.name==="avatarId").props.value,"gnome-female-3-v2");
});

test("shared portrait rendering preserves old IDs and uses the same crop at small and enlarged sizes",()=>{
  const {exports}=harness();
  for(const portrait of PLAYER_PORTRAITS)for(const size of ["avatar-party","avatar-event","avatar-sheet","avatar-expanded"]){
    const html=renderToStaticMarkup(React.createElement(exports.Portrait,{avatarId:portrait.id,className:size}));
    assert.match(html,new RegExp(portrait.file.replaceAll(".","\\.")));
    assert.ok(html.includes(portrait.position));
    assert.match(html,/painted-portrait/);
  }
  assert.equal(exports.avatarFor({species:"Human",className:"Wizard",avatarId:"mystic"}),"mystic");
  assert.equal(exports.avatarFor({species:"Orc",className:"Wizard"}),"orc-male-v1");
  assert.equal(exports.avatarFor({isCompanion:true}),"cat");
  const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
  assert.match(css,/background-image:var\(--portrait-image/);
  assert.match(source,/"--portrait-position":combatPortrait.backgroundPosition/);
});

test("named resident portraits render their reviewed species cell, not the whole sheet, at every portrait size",()=>{
  const {exports}=harness();
  for(const [npcId,crop] of Object.entries(NPC_PORTRAIT_CROPS)){
    for(const size of ["avatar-party","avatar-event","avatar-sheet","avatar-expanded"]){
      const html=renderToStaticMarkup(React.createElement(exports.Portrait,{npcId,className:size}));
      assert.ok(html.includes(crop.file),npcId);
      assert.ok(html.includes(crop.size),npcId);
      assert.ok(html.includes(crop.position),npcId);
      assert.doesNotMatch(html,/portrait-fallback/);
    }
  }
  for(const npcId of ["tamsin","mara","cotton","jory","merrin","elin"]){
    const html=renderToStaticMarkup(React.createElement(exports.Portrait,{npcId,className:"avatar-expanded"}));
    assert.doesNotMatch(html,/portrait-fallback/);
  }
});
