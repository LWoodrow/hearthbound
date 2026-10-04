import test from "node:test";
import assert from "node:assert/strict";
import {allAdventureDefinitions} from "../server/adventure-registry.mjs";
import {classifyWorldAction,resolveWorldAction} from "../server/world-state.mjs";
import {createCanonicalState} from "../server/interaction-engine.mjs";
import {parseLiteralIntent,interactionMatch} from "../server/intent-resolver.mjs";
import {buildSceneCommandSurface} from "../server/scene-command-surface.mjs";
import {interpretSceneTurn} from "../server/turn-interpretation.mjs";

test("navigation shorthand is normalized across all registered adventures, not by destination phrase",()=>{
  for(const definition of allAdventureDefinitions()) {
    const state=createCanonicalState(definition);
    const exit=definition.locations[state.currentLocation].exits[0];
    if(!exit) continue;
    const destination=definition.locations[exit.to].name;
    const surface=buildSceneCommandSurface(definition,state);
    const normal="go to "+destination,compact="goto "+destination;
    const turn=interpretSceneTurn(surface,compact);
    assert.equal(turn.worldIntent,"move",definition.id);
    assert.equal(turn.parsed.verb,"move",definition.id);
    assert.equal(turn.parsed.literal,compact,"trace retains original literal wording");
    const a=resolveWorldAction({definition,state,action:normal,turn:interpretSceneTurn(surface,normal)});
    const b=resolveWorldAction({definition,state,action:compact,turn});
    assert.equal(b.accepted,a.accepted,definition.id);
    assert.deepEqual(b.state,a.state,definition.id);
  }
});
test("authored verb aliases and speech/observation boundaries use the same normalized navigation",()=>{
  const interaction={modes:["act"],verbs:["go"],targets:["courtyard"]};
  assert.equal(interactionMatch(interaction,"goto courtyard").verbMatch,true);
  for(const action of ["goto courtyard","head back to courtyard","travel to courtyard"]) {
    assert.equal(classifyWorldAction(action),"move");
    assert.equal(parseLiteralIntent(action).verb,"move");
    assert.equal(classifyWorldAction(action,"speak"),"speech");
  }
  assert.equal(classifyWorldAction("look at the courtyard"),"observe");
  assert.equal(classifyWorldAction("look at the goto sign"),"observe");
  assert.equal(classifyWorldAction("gotos courtyard"),"other","do not fuzzy-match arbitrary tokens");
});
