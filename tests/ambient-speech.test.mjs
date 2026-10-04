import test from "node:test";
import assert from "node:assert/strict";
import {unansweredSpeech} from "../server/ambient-speech.mjs";
import {classifyWorldAction,resolveWorldAction} from "../server/world-state.mjs";
import {validateAdventure} from "../server/adventure-schema.mjs";
import roads from "../server/adventures/eldervale-roads.mjs";

test("unanswered greetings and general speech remain valid speech without physical-action advice",()=>{
  const definition={locations:{empty:{name:"Quiet Room",occupants:[]}}},state={currentLocation:"empty"};
  for(const text of ["hello","hi there","good morning","greetings everyone"]) {
    const reply=unansweredSpeech(definition,state,"Neil",text);
    assert.match(reply,/greeting.*No reply/);
    assert.doesNotMatch(reply,/Use Act/);
  }
  assert.match(unansweredSpeech(definition,state,"Neil","open the door"),/says this aloud.*remains/);
  assert.equal(classifyWorldAction("hello","speak"),"speech");
});
test("presence questions describe only local authored occupants; physical commands do not become observations",()=>{
  const definition={id:"test",startLocation:"room",initialFlags:{},locations:{room:{name:"Quiet Room",description:"A quiet room.",features:[],exits:[]}}};
  for(const action of ["any people around here","anyone nearby","people in here"]) {
    assert.equal(classifyWorldAction(action),"observe");
    assert.match(resolveWorldAction({definition,state:{currentLocation:"room"},action}).message,/No specific person/);
  }
  assert.equal(classifyWorldAction("follow people around the square"),"move");
  assert.equal(classifyWorldAction("hello","speak"),"speech");
});
test("ambient greetings require authored occupants and never imply an invented listener",()=>{
  const bad=structuredClone(roads);
  bad.locations.village.occupants=[];
  assert.ok(validateAdventure(bad).errors.some(error=>/ambientGreeting/.test(error)));
  assert.match(unansweredSpeech(bad,{currentLocation:"village"},"Neil","hello"),/No reply/);
});
