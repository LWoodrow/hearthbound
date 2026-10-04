// Stable IDs are saved, never filenames or user-supplied URLs.
const legacy = [
  ["guardian", "Guardian", "Human", "female"],
  ["wanderer", "Wayfarer", "Human", "male"],
  ["mystic", "Moon scholar", "Elf", "female"],
  ["shadow", "Shadow", "Human", "male"],
  ["wild", "Wildwood", "Human", "female"],
  ["scholar", "Scholar", "Human", "male"],
  ["minstrel", "Minstrel", "Human", "male"],
  ["noble", "Courtier", "Human", "female"],
];
export const PORTRAIT_SPECIES = Object.freeze(["Aasimar", "Dragonborn", "Dwarf", "Elf", "Gnome", "Goliath", "Halfling", "Human", "Orc", "Tiefling"]);
// Four independently designed faces per species: two male, then two female.
// Labels describe artistic inspiration only, never a class or mechanical bonus.
const additional = {
  Aasimar: [["male","Dawn sentinel"],["male","Star sage"],["female","Sun pilgrim"],["female","Moon envoy"]],
  Dragonborn: [["male","Ember veteran"],["male","Azure scholar"],["female","Pearl keeper"],["female","Jade pathfinder"]],
  Dwarf: [["male","Iron veteran"],["male","Mountain sage"],["female","Deepforge guard"],["female","Hearth storyteller"]],
  Elf: [["male","Woodland ranger"],["male","Twilight scholar"],["female","Sun courtier"],["female","Dusk wanderer"]],
  Gnome: [["male","Copper inventor"],["male","Night astronomer"],["female","Garden keeper"],["female","Violet chronicler"]],
  Goliath: [["male","Storm veteran"],["male","Flame traveller"],["female","Frost guardian"],["female","Stone storyteller"]],
  Halfling: [["male","Road musician"],["male","Quiet scholar"],["female","Orchard rover"],["female","Evening courtier"]],
  Orc: [["male","Iron sentinel"],["male","River sage"],["female","Golden trailguard"],["female","Elder herbalist"]],
  Tiefling: [["male","Crimson duellist"],["male","Indigo seer"],["female","Amber traveller"],["female","Sapphire courtier"]],
};
export const PLAYER_PORTRAITS = Object.freeze([
  ...legacy.map(([id, label, species, gender], index) => Object.freeze({id, label, species, gender, legacy: true,
    file: "/art/portraits/player-portraits-v1.png", size: "400% 200%", position: `${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 100}%`})),
  ...PORTRAIT_SPECIES.filter(species => species !== "Human").flatMap(species => ["male", "female"].map((gender, index) => Object.freeze({
    id: `${species.toLowerCase()}-${gender}-v1`, label: `${species} ${gender}`, species, gender, legacy: false,
    file: `/art/portraits/player-${species.toLowerCase()}-v1.png`, size: "200% auto", position: `${index * 100}% 50%`,
  }))),
  ...Object.entries(additional).flatMap(([species, designs]) => designs.map(([gender, label], index) => Object.freeze({
    id: `${species.toLowerCase()}-${gender}-${index % 2 + 2}-v2`, label, species, gender, legacy: false,
    file: `/art/portraits/player-${species.toLowerCase()}-variety-v2.png`, size: "200% 200%",
    position: `${index % 2 * 100}% ${Math.floor(index / 2) * 100}%`,
  }))),
]);
const byId = new Map(PLAYER_PORTRAITS.map(portrait => [portrait.id, portrait]));
export function playerPortrait(id) { return byId.get(id); }
export function portraitsFor(species, gender = "all") {
  return PLAYER_PORTRAITS.filter(portrait => portrait.species === species && (gender === "all" || portrait.gender === gender));
}
export function portraitSelection(species, gender = "all", preferred = "") {
  const choices = portraitsFor(species, gender);
  return choices.find(portrait => portrait.id === preferred)?.id || choices[0]?.id || "";
}
export function acceptedPlayerPortrait(id, species) {
  const portrait = playerPortrait(String(id || ""));
  // Legacy callers/saves remain compatible; new species IDs must match ancestry.
  return portrait && (portrait.legacy || portrait.species === species) ? portrait.id : "";
}
export function playerPortraitStyle(id) {
  const portrait = playerPortrait(id);
  return portrait ? {backgroundImage: `url(${portrait.file})`, backgroundSize: portrait.size, backgroundPosition: portrait.position} : undefined;
}
