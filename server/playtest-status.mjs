const clean = (value, limit = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

const LANTERN_GATES = [
  { id:"fresh-start", label:"Fresh start outside the inn", test:({ visited, location }) => location === "outside-inn" || visited.includes("outside-inn") },
  { id:"public-entry", label:"Enter the public taproom", test:({ visited }) => visited.includes("inn") },
  { id:"private-room", label:"Choose and enter a private room", test:({ visited }) => visited.includes("back-room") },
  { id:"letter-opened", label:"Open the sealed letter deliberately", test:({ stage }) => stage >= 1 },
  { id:"map-awakened", label:"Warm the seal and offer fresh ink", test:({ stage }) => stage >= 2 },
  { id:"pantry-route", label:"Follow the route through kitchen to pantry", test:({ visited }) => visited.includes("kitchen") && visited.includes("pantry") },
  { id:"cellar-found", label:"Find and open the cellar route", test:({ stage, visited }) => stage >= 3 && visited.includes("cellar") },
  { id:"survey-trail", label:"Follow Mara's survey trail", test:({ stage, visited }) => stage >= 5 && visited.includes("cellar-passage") },
  { id:"mothglass", label:"Reach and investigate the Mothglass chamber", test:({ stage, visited }) => stage >= 6 && visited.includes("mothglass") },
  { id:"spindle", label:"Operate the spindle and enter the ancient passage", test:({ stage, visited }) => stage >= 7 && visited.includes("passage") },
  { id:"rescue-scene", label:"Reach Mara's collapsed survey alcove", test:({ stage, visited }) => stage >= 8 && visited.includes("alcove") },
  { id:"guardian", label:"Resolve the ink guardian", test:({ flags }) => flags.guardianDefeated === true },
  { id:"rescue", label:"Free Mara and complete the adventure", test:({ flags, adventureStatus }) => flags.maraRescued === true && adventureStatus === "complete" },
];

export function playtestToolsEnabled(environment = process.env) {
  return environment.DND_PLAYTEST_TOOLS === "1";
}

export function buildHearthboundPlaytestStatus({ adventure, dmState = {}, worldState = {}, events = [], pendingCheck = null, turnTraces = [] }) {
  if (!String(adventure?.id || "").endsWith("lantern-below")) return null;
  const context = {
    stage:Number(dmState.clueStage || 0),
    location:String(worldState.currentLocation || dmState.currentLocationKey || "outside-inn"),
    visited:Array.isArray(worldState.visited) ? worldState.visited : [],
    flags:{ ...(worldState.flags || {}), ...(dmState.flags || {}) },
    adventureStatus:String(adventure?.status || "active"),
  };
  const gates = LANTERN_GATES.map((gate) => ({ id:gate.id, label:gate.label, passed:Boolean(gate.test(context)) }));
  const completed = gates.filter((gate) => gate.passed).length;
  const next = gates.find((gate) => !gate.passed) || null;
  const recent = events.slice(-8).map((event) => ({ kind:event.kind, speaker:clean(event.speaker, 60), text:clean(event.text, 260) }));
  return {
    version:2,
    adventureId:adventure.id,
    completed,
    total:gates.length,
    currentLocation:context.location,
    clueStage:context.stage,
    pendingCheck:pendingCheck ? `${clean(pendingCheck.ability, 30)} (${clean(pendingCheck.skill, 50)}) DC ${Number(pendingCheck.dc)}` : "",
    nextGate:next?.label || "Playtest route complete",
    gates,
    recent,
    turnTraces:Array.isArray(turnTraces) ? turnTraces : [],
  };
}
