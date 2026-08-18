import test from "node:test";
import assert from "node:assert/strict";
import { buildAuthoritativeRecap } from "../server/story-recaps.mjs";
import { listNarrationStyles, narrationStylePrompt } from "../server/narration-styles.mjs";

test("authoritative recaps ignore unsupported narration and hidden ledger notes", () => {
  const recap = buildAuthoritativeRecap({
    campaign:{ title:"The Lantern Below", scene:"Old fallback scene" },
    roomAuthority:{ currentLocation:{ name:"Private Back Room", features:["writing desk", "sealed letter"] } },
    events:[
      { visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"A hallucinated dragon becomes king." },
      { visibility:"dm", kind:"system", speaker:"DM Ledger", text:"SECRET CULPRIT" },
      { visibility:"public", kind:"action", speaker:"Elara", text:"attempts: examine the sealed letter" },
      { visibility:"public", kind:"narration", speaker:"Dungeon Master", text:"The seal remains closed.", payload:{ authoritativeFacts:["The silver-moth seal remains unbroken."] } },
      { visibility:"public", kind:"roll", speaker:"Dice", text:"Elara rolled 14 +2 = 16 for Perception against DC 12: success." },
    ],
    knownLocations:[{ name:"The Crooked Lantern", summary:"A known inn." }],
    party:[{ name:"Elara", inventory:[{ name:"Lantern", quantity:1 }] }],
  });
  const serialized = JSON.stringify(recap);
  assert.equal(recap.currentLocation, "Private Back Room");
  assert.deepEqual(recap.establishedFacts, ["The silver-moth seal remains unbroken."]);
  assert.equal(serialized.includes("hallucinated dragon"), false);
  assert.equal(serialized.includes("SECRET CULPRIT"), false);
  assert.equal(serialized.includes("examine the sealed letter"), true);
  assert.equal(serialized.includes("Lantern"), true);
});

test("recaps expose a pending check without exposing its hidden reason", () => {
  const recap = buildAuthoritativeRecap({
    campaign:{ title:"Test", scene:"Threshold" },
    pendingCheck:{ ability:"Wisdom", skill:"Perception", dc:12, reason:"Secret trap mechanism" },
  });
  assert.equal(recap.pendingCheck, "Wisdom (Perception) DC 12");
  assert.equal(JSON.stringify(recap).includes("Secret trap mechanism"), false);
});

test("Hearthbound narration examples are versioned and explicitly style-only", () => {
  const styles = listNarrationStyles();
  assert.equal(styles.length, 1);
  assert.equal(styles[0].id, "hearthbound-narration-v1");
  assert.equal(styles[0].version, 1);
  const prompt = narrationStylePrompt("hearthbound");
  assert.match(prompt, /cadence only/i);
  assert.match(prompt, /must never be imported into the campaign/i);
});
