import assert from "node:assert/strict";
import test from "node:test";
import { THEME_PACKAGE_VERSION, UNIVERSE_IDS, UNIVERSE_THEMES, universeIdForWorld, universeTheme } from "../shared/universe-themes.mjs";

test("every registered universe provides one complete theme package", () => {
  assert.equal(THEME_PACKAGE_VERSION, 1);
  assert.deepEqual(UNIVERSE_IDS, ["hearthbound", "supernatural", "mystery", "gothic", "cosmic", "espionage"]);
  for (const id of UNIVERSE_IDS) {
    const theme = UNIVERSE_THEMES[id];
    assert.equal(theme.id, id);
    for (const field of ["displayName", "wordmark", "icon", "art", "artAlt", "genre", "tagline", "description", "texture", "mapTreatment", "sceneArtStyle", "narrationMood", "audioMood"]) {
      assert.ok(theme[field], `${id}.${field} is required`);
    }
    assert.ok(theme.motifs.length >= 4);
    assert.deepEqual(Object.keys(theme.palette), ["ink", "panel", "panelRaised", "accent", "accentBright", "text", "muted", "line", "danger"]);
    for (const term of ["library", "campaign", "campaigns", "content", "contents", "character", "characters", "characterSheet", "map", "party", "parties", "journal", "play"]) {
      assert.ok(theme.terms[term], `${id}.terms.${term} is required`);
    }
  }
});

test("Hunters is the player-facing supernatural brand while its identifier remains stable", () => {
  const supernatural = universeTheme("supernatural");
  assert.equal(supernatural.id, "supernatural");
  assert.equal(supernatural.displayName, "Hunters");
  assert.equal(supernatural.terms.character, "Hunter");
  assert.equal(supernatural.terms.content, "Episode");
  assert.equal(supernatural.icon, "cross");
  assert.doesNotMatch(JSON.stringify(supernatural), /Wayward Sons/i);
});

test("the three revised universe marks keep their agreed simple identities", () => {
  assert.equal(universeTheme("hearthbound").icon, "shield");
  assert.equal(universeTheme("supernatural").icon, "cross");
  assert.equal(universeTheme("mystery").icon, "magnifier");
  assert.equal(universeTheme("cosmic").icon, "cthulhu-bust");
});

test("world theme selection accepts stable explicit or namespaced identifiers and safely falls back", () => {
  assert.equal(universeIdForWorld({ id:"world-eldervale" }), "hearthbound");
  assert.equal(universeIdForWorld({ id:"supernatural:night-road" }), "supernatural");
  assert.equal(universeIdForWorld({ id:"legacy", universeId:"espionage" }), "espionage");
  assert.equal(universeIdForWorld({ id:"unknown:example", universeId:"unknown" }), "hearthbound");
});

test("every theme keeps primary text and active controls at accessible contrast", () => {
  const luminance = (hex) => {
    const values = [1, 3, 5]
      .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const contrast = (left, right) => {
    const first = luminance(left);
    const second = luminance(right);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  for (const theme of Object.values(UNIVERSE_THEMES)) {
    assert.ok(contrast(theme.palette.text, theme.palette.panel) >= 7, `${theme.id} primary text should meet enhanced contrast`);
    assert.ok(contrast(theme.palette.accentBright, theme.palette.ink) >= 7, `${theme.id} active controls should meet enhanced contrast`);
  }
});
