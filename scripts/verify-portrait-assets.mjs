import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PLAYER_PORTRAITS } from "../shared/player-portraits.mjs";
import { NPC_PORTRAIT_FILES,NPC_PORTRAIT_CROPS } from "../shared/portrait-catalogue.mjs";

const signature = Buffer.from([137,80,78,71,13,10,26,10]);
const files = [...new Set([...PLAYER_PORTRAITS.map(portrait => portrait.file),...Object.values(NPC_PORTRAIT_FILES),...Object.values(NPC_PORTRAIT_CROPS).map(portrait=>portrait.file),"/art/portraits/npc-portraits-v1.png"])];
for (const file of files) {
  const source = readFileSync(resolve("public", "." + file));
  const built = readFileSync(resolve("dist", "." + file));
  if (!built.subarray(0,8).equals(signature) || !built.equals(source)) throw new Error("Missing or stale built portrait: " + file);
}
console.log("Verified " + files.length + " built portrait assets against their source artwork.");
