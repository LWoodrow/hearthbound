import { resolve } from "node:path";

process.env.PORT = process.env.HEARTHBOUND_PLAYTEST_PORT || "4321";
process.env.HOST ||= "0.0.0.0";
process.env.DND_DATABASE = process.env.HEARTHBOUND_PLAYTEST_DATABASE || resolve("data", "hearthbound-playtest.sqlite");
process.env.DND_PLAYTEST_TOOLS = "1";
process.env.DND_PROMPT_INSPECTOR ||= "1";

const { start } = await import("../server/index.mjs");
await start();
