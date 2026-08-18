import { lanternBelowAdventure } from "./adventures/lantern-below.mjs";
import { visibleLocationFeatures } from "./world-state.mjs";

const legacyLanternLocations = [
  { key:"outside-inn", names:["outside the crooked lantern"], minimumStage:0, minimumArrivalStage:0, x:45, y:115, w:230, h:130, label:"Outside the Crooked Lantern", mapLabel:"Inn frontage", kind:"road", connectsTo:["inn"], features:["inn sign","front door","taproom windows"] },
  { key:"inn", names:["the crooked lantern","the crooked lantern taproom","taproom","bar"], minimumStage:0, minimumArrivalStage:1, x:315, y:60, w:370, h:260, label:"The Crooked Lantern taproom", mapLabel:"Public taproom", kind:"inn", connectsTo:["outside-inn","back-room","kitchen"], features:["front entrance","bar","hearth","public tables"] },
  { key:"back-room", names:["the crooked lantern back room","back room","private room"], minimumStage:0, minimumArrivalStage:2, x:735, y:60, w:230, h:170, label:"The Crooked Lantern back room", mapLabel:"Private room", kind:"room", connectsTo:["inn"], features:["private table","writing desk","small oil lamp","inkwell","silver-moth letter"] },
  { key:"kitchen", names:["the crooked lantern kitchen","kitchen"], minimumStage:2, minimumArrivalStage:2, x:315, y:370, w:250, h:190, label:"The Crooked Lantern kitchen", mapLabel:"Kitchen", kind:"room", connectsTo:["inn","pantry"], features:["preparation table","cupboards","kitchen hearth","pantry door"] },
  { key:"pantry", names:["the crooked lantern pantry","pantry","pantry shelves"], minimumStage:2, minimumArrivalStage:2, x:610, y:385, w:205, h:160, label:"The Crooked Lantern pantry", mapLabel:"Pantry", kind:"room", connectsTo:["kitchen","cellar"], features:["pantry shelves","jars","concealed cellar door"] },
  { key:"cellar", names:["the crooked lantern cellar","cellar"], minimumStage:3, minimumArrivalStage:2, x:860, y:345, w:210, h:215, label:"The Crooked Lantern cellar", mapLabel:"Cellar", summary:"A cellar door has been unlocked and opened beneath the inn.", kind:"cellar", connectsTo:["pantry","cellar-passage"], features:["stone steps","storage barrels","old survey marks"] },
  { key:"cellar-passage", names:["the cellar passage"], minimumStage:4, x:595, y:325, w:180, h:65, label:"The Cellar Passage", mapLabel:"Cellar Passage", summary:"Beyond the unlocked cellar door, an old passage bears Mara Vey's abandoned survey mark.", kind:"small-passage", connectsTo:["cellar"] },
  { key:"mothglass", names:["the mothglass chamber"], minimumStage:5, x:535, y:430, w:300, h:180, label:"Mothglass Chamber", kind:"mechanism", connectsTo:["cellar-passage"] },
  { key:"passage", names:["the concealed passage"], minimumStage:7, x:880, y:165, w:145, h:370, label:"Concealed Passage", kind:"passage", connectsTo:["mothglass"] },
  { key:"alcove", names:["collapsed survey alcove"], minimumStage:8, x:865, y:570, w:180, h:105, label:"Survey Alcove", kind:"collapse", connectsTo:["passage"] },
];

const legacyLanternByKey = Object.fromEntries(legacyLanternLocations.map((location) => [location.key, location]));
const lanternLocations = Object.entries(lanternBelowAdventure.locations).map(([key, location]) => {
  const legacy = legacyLanternByKey[key] || {};
  const names = new Set([
    ...(legacy.names || []),
    location.name.toLowerCase(),
    ...(location.aliases || []).map((name) => String(name).toLowerCase()),
  ]);
  return {
    ...legacy,
    key,
    names: [...names],
    minimumStage: legacy.minimumStage ?? location.stage ?? 0,
    minimumArrivalStage: legacy.minimumArrivalStage ?? location.arrivalStage ?? 0,
    label: location.name,
    mapLabel: location.mapLabel || legacy.mapLabel || location.name,
    summary: location.description || legacy.summary,
    kind: location.map?.kind || legacy.kind || "room",
    connectsTo: (location.exits || []).map((exit) => exit.to),
    features: (location.features || []).map((feature) => feature.label),
  };
});

const briarwatchLocations = [
  { key:"briarwatch-road", names:["the briarwatch road","briarwatch road"], minimumStage:0, x:55, y:80, w:300, h:150, label:"The Briarwatch Road", mapLabel:"Briarwatch Road", summary:"The ash-marked road leading toward the abandoned watchtower.", kind:"road", connectsTo:[] },
  { key:"road-beyond-barrier", names:["road beyond the barrier","the road beyond the barrier","passage beyond the barrier"], minimumStage:1, x:410, y:80, w:280, h:150, label:"Road Beyond the Barrier", summary:"The road continues beyond the broken wooden barrier; no building has been entered here.", kind:"road", connectsTo:["briarwatch-road"] },
  { key:"east-well", names:["briarwatch east well","the east well","east well"], minimumStage:2, x:745, y:65, w:270, h:180, label:"Briarwatch East Well", mapLabel:"East Well", summary:"The first occupied stopping place on the edge of Briarwatch, where survivors can be questioned.", kind:"outdoor", connectsTo:["road-beyond-barrier"] },
  { key:"burn-site", names:["moonfire burn site","the moonfire burn site","burned croft","the burned croft"], minimumStage:3, x:745, y:330, w:270, h:180, label:"Moonfire Burn Site", mapLabel:"Burn Site", summary:"A damaged Briarwatch croft where the strange flame left evidence that can be examined.", kind:"ruin", connectsTo:["east-well"] },
  { key:"watchtower", names:["briarwatch watchtower","the briarwatch watchtower","watchtower approach"], minimumStage:4, x:410, y:345, w:280, h:170, label:"Briarwatch Watchtower", mapLabel:"Watchtower", summary:"The abandoned watchtower indicated by the matching angles of the scorch marks.", kind:"tower", connectsTo:["burn-site"] },
  { key:"signal-room", names:["signal room","the signal room","watchtower signal room"], minimumStage:5, x:65, y:350, w:280, h:165, label:"Watchtower Signal Room", mapLabel:"Signal Room", summary:"The watchtower chamber containing the old signal mirrors.", kind:"room", connectsTo:["watchtower"] },
  { key:"cinder-vault", names:["cinder vault","the cinder vault","vault beneath the signal room"], minimumStage:6, x:65, y:565, w:280, h:125, label:"Cinder Vault", mapLabel:"Cinder Vault", summary:"The sealed chamber beneath the signal room where the source of the projected fire is bound.", kind:"vault", connectsTo:["signal-room"] },
];

const hollowStarLocations = [
  { key:"astronomers-court", names:["astronomer's court","the astronomer's court","astronomers court"], minimumStage:0, x:55, y:75, w:300, h:180, label:"Astronomer's Court", mapLabel:"Astronomer's Court", kind:"court", connectsTo:[] },
  { key:"heirs-hall", names:["heirs' hall","the heirs' hall","heirs hall"], minimumStage:1, x:420, y:75, w:280, h:180, label:"Heirs' Hall", mapLabel:"Heirs' Hall", kind:"hall", connectsTo:["astronomers-court"] },
  { key:"chart-archive", names:["royal chart archive","the royal chart archive","chart archive"], minimumStage:2, x:760, y:75, w:280, h:180, label:"Royal Chart Archive", mapLabel:"Chart Archive", kind:"archive", connectsTo:["heirs-hall"] },
  { key:"observatory-approach", names:["observatory approach","the observatory approach"], minimumStage:3, x:760, y:345, w:280, h:170, label:"Observatory Approach", kind:"passage", connectsTo:["chart-archive"] },
  { key:"lens-chamber", names:["observatory lens chamber","the observatory lens chamber","lens chamber"], minimumStage:4, x:420, y:345, w:280, h:170, label:"Observatory Lens Chamber", mapLabel:"Lens Chamber", kind:"room", connectsTo:["observatory-approach"] },
  { key:"alignment-dais", names:["coronation alignment","the coronation alignment","alignment dais"], minimumStage:5, x:55, y:345, w:300, h:170, label:"Coronation Alignment", mapLabel:"Alignment Dais", kind:"dais", connectsTo:["lens-chamber"] },
];

export const ADVENTURE_RULES = [
  { suffix:"lantern-below", stateKey:"clueStage", mapHeight:700, locations:lanternLocations, events:{ keyedDoorOpened:{ minimumStage:3, locationKey:"cellar" }, keyedDoorCrossed:{ minimumStage:4, locationKey:"cellar-passage" } } },
  { suffix:"ashes-briarwatch", stateKey:"clueStage", mapHeight:720, locations:briarwatchLocations },
  { suffix:"hollow-star", stateKey:"clueStage", mapHeight:620, locations:hollowStarLocations },
  { suffix:"combat-workshop", stateKey:"clueStage", mapHeight:540, locations:[] },
];

export function adventureRules(adventureId) {
  const id=String(adventureId || "");
  return ADVENTURE_RULES.find((item)=>id.endsWith(item.suffix)) || { suffix:"custom", stateKey:"clueStage", mapHeight:620, locations:[] };
}

const normalize=(value)=>String(value || "").trim().toLowerCase();
const phraseInText=(text,phrase)=>` ${normalize(text)} `.includes(` ${normalize(phrase)} `);

export function locationRule(adventureId, nameOrKey) {
  const wanted=normalize(nameOrKey);
  return adventureRules(adventureId).locations.find((item)=>item.key===wanted || item.names.some((name)=>normalize(name)===wanted)) || null;
}

export function featureLocationRule(adventureId, featureName) {
  const wanted=normalize(featureName);
  if (!wanted) return null;
  return adventureRules(adventureId).locations.find((item)=>(item.features || []).some((feature)=>phraseInText(wanted,feature) || phraseInText(feature,wanted))) || null;
}

export function locationIsRevealed(adventureId, state, nameOrKey) {
  const rules=adventureRules(adventureId);
  if (!rules.locations.length) return true;
  const location=locationRule(adventureId, nameOrKey);
  const arrivalStage=Object.prototype.hasOwnProperty.call(state || {},"lanternArrivalStage") ? Number(state.lanternArrivalStage || 0) : 2;
  return Boolean(location)
    && Number(state?.[rules.stateKey] || 0) >= Number(location.minimumStage || 0)
    && arrivalStage >= Number(location.minimumArrivalStage || 0);
}

export function locationTransitionIsAllowed(adventureId, state, currentNameOrKey, targetNameOrKey) {
  const rules=adventureRules(adventureId);
  if (!rules.locations.length) return true;
  const target=locationRule(adventureId,targetNameOrKey);
  if (!target || !locationIsRevealed(adventureId,state,target.key)) return false;
  const current=locationRule(adventureId,currentNameOrKey);
  if (!current) return target.key===rules.locations[0]?.key;
  if (current.key===target.key) return true;
  return current.connectsTo.includes(target.key) || target.connectsTo.includes(current.key);
}

export function authoredRouteContext(adventureId, state, worldState = null) {
  const rules=adventureRules(adventureId);
  if (!rules.locations.length) return null;
  const stage=Number(state?.[rules.stateKey] || 0);
  const revealed=rules.locations.filter((item)=>locationIsRevealed(adventureId,state,item.key));
  const revealedKeys=new Set(revealed.map((item)=>item.key));
  const current=locationRule(adventureId,state?.currentLocationKey) || revealed.at(-1);
  const connectedKeys=(room)=>rules.locations
    .filter((item)=>revealedKeys.has(item.key) && (room.connectsTo.includes(item.key) || item.connectsTo.includes(room.key)))
    .map((item)=>item.key);
  const presentedFeatures=(room)=>worldState && String(adventureId || "").endsWith("lantern-below")
    ? visibleLocationFeatures(lanternBelowAdventure, worldState, room.key).map((feature)=>feature.label)
    : room.features || [];
  return {
    instruction:"The currentLocation and room contents are authoritative. Only describe features listed in the current room. A character may enter only a revealed location directly connected to it, and crossing a doorway must be an explicit movement action.",
    currentLocation:current ? { key:current.key, name:current.label, features:presentedFeatures(current), exits:connectedKeys(current) } : null,
    revealedLocations:revealed.map((item)=>({ key:item.key, name:item.label, connectsTo:connectedKeys(item), features:presentedFeatures(item) })),
    nextLocation:rules.locations.find((item)=>Number(item.minimumStage || 0)===stage+1)?.label || "",
  };
}

export function enrichKnownLocations(adventureId, state, locations) {
  const rules=adventureRules(adventureId);
  const source=Array.isArray(locations) ? locations : [];
  const revealed=source.filter((location)=>locationIsRevealed(adventureId,state,location?.name));
  const revealedKeys=new Set(revealed.map((location)=>locationRule(adventureId,location?.name)?.key || location.id));
  return revealed.map((location,index)=>{
    const previous=revealed[index-1];
    const rule=locationRule(adventureId,location?.name);
    const map=rule || { key:location.id, x:65+(index%3)*345, y:70+Math.floor(index/3)*235, w:245+(index%2)*35, h:150, label:location.name, kind:"room", connectsTo:previous?[previous.id]:[] };
    return { ...location, map:{ key:map.key, x:map.x, y:map.y, w:map.w, h:map.h, label:map.mapLabel || map.label, kind:map.kind, connectsTo:(map.connectsTo || []).filter((key)=>revealedKeys.has(key)), height:rules.mapHeight } };
  });
}

export function applyAdventureEvent(adventureId, state, eventName) {
  const rules=adventureRules(adventureId);
  const event=rules.events?.[eventName];
  if (!event) return { state, location:null };
  const current=Number(state?.[rules.stateKey] || 0);
  return { state:{ ...state, [rules.stateKey]:Math.max(current,Number(event.minimumStage || current)) }, location:rules.locations.find((item)=>item.key===event.locationKey) || null };
}
