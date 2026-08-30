import test from "node:test";
import assert from "node:assert/strict";
import { lanternBelowAdventure } from "../server/adventures/lantern-below.mjs";
import { allAdventureDefinitions } from "../server/adventure-registry.mjs";
import { buildSceneCommandSurface } from "../server/scene-command-surface.mjs";

test("scene command surface contains only current visible entities and exits", () => {
  const surface = buildSceneCommandSurface(lanternBelowAdventure, {
    currentLocation:"cellar",
    visited:["outside-inn","inn","kitchen","pantry","cellar"],
    objects:{"keyed-stone-door":{discovered:true,locked:true,open:false}},
  }, { inventory:[{id:"rope",name:"Rope",quantity:1,status:"carried"}] });

  assert.equal(surface.location.id, "cellar");
  assert(surface.visibleFeatures.some((feature) => feature.label === "locked stone door"));
  assert(!surface.visibleFeatures.some((feature) => /letter/i.test(feature.label)));
  assert(surface.exits.every((route) => route.sourceId === "cellar"));
  assert.deepEqual(surface.carriedItems.map((item) => item.name), ["Rope"]);
  assert.deepEqual(surface.localPortableItems.map((item) => item.name), ["Cellar key"]);
  assert(surface.guidance.some((suggestion) => suggestion.text === "Take the Cellar key."));
  assert(surface.guidance.every((suggestion) => !/letter/i.test(suggestion.text)));
});

test("hidden executable interactions do not automatically become player guidance", () => {
  const surface = buildSceneCommandSurface(lanternBelowAdventure, {
    currentLocation:"back-room",
    visited:["outside-inn","inn","back-room"],
  });

  assert(surface.interactions.some((interaction) => interaction.id === "open-silver-moth-letter"));
  assert(surface.visibleFeatures.some((feature) => /letter/i.test(feature.label)));
  assert(surface.guidance.every((suggestion) => !suggestion.sourceId.startsWith("interaction:")));
  assert(surface.guidance.every((suggestion) => suggestion.reason.includes("visible") || suggestion.reason.includes("exit") || suggestion.reason.includes("present")));
});

test("initial taproom guidance does not reveal Mara before the party learns her name", () => {
  const surface = buildSceneCommandSurface(lanternBelowAdventure, { currentLocation:"inn", visited:["outside-inn","inn"] });
  assert(surface.interactions.some((interaction) => /mara/i.test(interaction.target)));
  assert(!surface.guidance.some((suggestion) => /mara/i.test(`${suggestion.label} ${suggestion.text}`)));
  assert(surface.guidance.some((suggestion) => /Tamsin Reed/i.test(suggestion.text)));
});

test("a pending conversational offer appears only at its recorded revision", () => {
  const state = {
    currentLocation:"inn",
    visited:["outside-inn","inn"],
    revision:4,
  };
  const valid = buildSceneCommandSurface(lanternBelowAdventure, state, {
    pendingOffer:{interactionId:"request-private-room",npcId:"tamsin-reed",worldRevision:4},
  });
  assert.equal(valid.pendingOffer?.npcName, "Tamsin Reed");
  assert.match(valid.guidance[0].text, /Follow Tamsin Reed/);

  const stale = buildSceneCommandSurface(lanternBelowAdventure, state, {
    pendingOffer:{interactionId:"request-private-room",npcId:"tamsin-reed",worldRevision:3},
  });
  assert.equal(stale.pendingOffer, null);
  assert(!stale.guidance.some((suggestion) => /Follow Tamsin Reed/.test(suggestion.text)));
});

test("every registered universe produces the same command-surface shape", () => {
  for (const definition of allAdventureDefinitions()) {
    const surface = buildSceneCommandSurface(definition);
    assert.equal(surface.location.id, definition.startLocation);
    assert(Array.isArray(surface.visibleFeatures));
    assert(Array.isArray(surface.exits));
    assert(Array.isArray(surface.presentNpcs));
    assert(Array.isArray(surface.carriedItems));
    assert(Array.isArray(surface.localPortableItems));
    assert(Array.isArray(surface.interactions));
    assert(Array.isArray(surface.guidance));
    assert(surface.guidance.length <= 3);
  }
});
