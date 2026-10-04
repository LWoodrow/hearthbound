import test from "node:test";
import assert from "node:assert/strict";
import { visibleNpcProfiles } from "../shared/portrait-catalogue.mjs";

const definition = { story:{ npcs:{ host:{name:"Host",portraitId:"tamsin",publicBackground:"A welcoming host.",knows:["SECRET"],goals:["SECRET"],appearance:"SECRET",conversation:{conditionalFacts:["SECRET"]}}, hidden:{name:"Surveyor",portraitId:"mara",publicBackground:"Future identity."}, unknown:{name:"Unknown",portraitId:"unapproved"} } } };
test("portrait profiles reveal only encountered approved identities",()=>{
  assert.deepEqual(visibleNpcProfiles(definition,[]),{});
  const profiles=visibleNpcProfiles(definition,[{speaker:"Host"},{speaker:"Unknown"}]);
  assert.deepEqual(Object.keys(profiles),["Host"]);
  assert.equal(profiles.Host.background,"A welcoming host.");
  assert.doesNotMatch(JSON.stringify(profiles),/SECRET|Future identity/);
  assert.deepEqual(Object.keys(profiles.Host).sort(),["background","name","portraitId"]);
});
test("missing biographies use an honest fallback rather than private story data",()=>{
  const profiles=visibleNpcProfiles({story:{npcs:{cat:{name:"Cat",portraitId:"cotton",knows:["SECRET"]}}}},[{speaker:"Cat"}]);
  assert.match(profiles.Cat.background,/No background/);
  assert.deepEqual(visibleNpcProfiles(null,[{speaker:"Host"}]),{});
});
