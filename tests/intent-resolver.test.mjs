import test from "node:test";
import assert from "node:assert/strict";
import { interactionMatch, parseLiteralIntent, resolveEntityReferences } from "../server/intent-resolver.mjs";

test("literal intent records scope and compound actions without changing state",()=>{
  assert.deepEqual(parseLiteralIntent("warm the moth and then offer one drop of ink","act"),{mode:"act",verb:"use",literal:"warm the moth and then offer one drop of ink",quantity:1,compound:true});
});

test("entity resolution reports confidence and refuses tied ambiguity",()=>{
  const resolved=resolveEntityReferences("inspect the silver moth",[{id:"seal",name:"silver moth seal"},{id:"mite",name:"silver moth mite"}]);
  assert.equal(resolved.selected,null);
  assert.equal(resolved.candidates.length,2);
});

test("interaction matching treats a represented destination separately from location",()=>{
  const match=interactionMatch({modes:["act"],verbs:["study"],targets:["drawn route"],representations:["pantry shelves"]},"study the route to the pantry shelves","act");
  assert.equal(match.targetMatch,true);
  assert.equal(match.parsed.verb,"observe");
});
