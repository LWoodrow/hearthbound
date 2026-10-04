import {assertValidAdventure} from "../adventure-schema.mjs";
import {withEldervaleCity} from "./eldervale-city.mjs";
import {withRegionalResidents} from "./regional-residents.mjs";
import {willowfordLocations,willowfordNpcs,willowfordInteractions,willowfordFlags,willowfordDiscoveries,willowfordClues} from "./willowford.mjs";
import {carriageInteractions} from "./carriage-network.mjs";
import {rivergateLocations,rivergateNpcs,rivergateInteractions,rivergateFlags,rivergateDiscoveries,rivergateClues} from "./rivergate.mjs";
import {stonecrossLocations,stonecrossNpcs,stonecrossInteractions,stonecrossFlags,stonecrossDiscoveries,stonecrossClues,stonecrossEncounters} from "./stonecross.mjs";

// Fixed public geography, not an LLM-generated list of destinations.
export const regionalSites=[
  {id:"city",name:"Eldervale City",x:48,y:58,kind:"city",description:"The river city and the Crooked Lantern. Return here to resume your saved main adventure."},
  {id:"market",name:"Rivergate Market",x:43,y:63,kind:"market",description:"An open-air market of boatfolk, traders and travelling messengers."},
  {id:"ferry",name:"Stonecross Ferry",x:55,y:68,kind:"ferry",description:"A working river crossing, where a damaged mooring has stranded the ferryman."},
  {id:"village",name:"Willowford",x:61,y:60,kind:"village",description:"A village of orchards and sheep fields, with a community anxious about its river crossing."},
  {id:"wood",name:"Mosswood Trail",x:65,y:48,kind:"wood",description:"A marked woodland trail watched by a ranger, not an unexplored dungeon."},
  {id:"abbey",name:"Greyfen Abbey",x:37,y:48,kind:"abbey",description:"A weathered abbey where a keeper records the names and stories of travellers."},
  {id:"hill",name:"Signal Hill",x:47,y:36,kind:"hill",description:"An old lookout with a broad view of the northern valley."},
];
const links=[["city","market"],["city","abbey"],["city","hill"],["market","ferry"],["ferry","village"],["village","wood"],["wood","hill"],["hill","abbey"]];
export const regionalLinks=links;
const characters=[
  {id:"courier",name:"Elin Marr",location:"market",role:"Rivergate courier",voice:"Quick-witted, curious and practical.",facts:["Elin carries ordinary letters between the river settlements.","Stonecross Ferry is the reliable crossing to Willowford.","Greyfen Abbey keeps a public register of travellers, not secret survey records."],greeting:"“Taking the long way round?” Elin asks, sorting a bundle of letters. “Good. There are people worth meeting along the river. Stop by Jory's ferry if you're heading to Willowford.”"},
  {id:"ferryman",name:"Jory Pike",location:"ferry",role:"Stonecross ferryman",voice:"Plain-spoken, patient, grateful for practical help.",facts:["Jory runs Stonecross Ferry.","A frayed mooring has left the ferry tied up; sound spare rope lies on the landing.","Jory needs someone to secure the spare rope to the landing ring; no payment or special tool is required."],greeting:"Jory lifts a frayed rope. “Boat's sound; this isn't. There's spare rope on the landing. Help me secure the mooring and we'll have the crossing working again.”"},
  {id:"ranger",name:"Rowan Ash",location:"wood",role:"Mosswood trail ranger",voice:"Unhurried, observant and careful about claims.",facts:["Rowan maintains the public Mosswood Trail.","The marked path connects Willowford and Signal Hill.","Unmarked forest has not been surveyed for safe travel; Rowan will not invent a shortcut."],greeting:"A ranger beside a waypost nods. “Rowan Ash. Keep to the markers. You can reach the hill from here, or head back to Willowford.”"},
  {id:"keeper",name:"Keeper Iona",location:"abbey",role:"Greyfen register keeper",voice:"Thoughtful, hospitable and attentive to people's stories.",facts:["Greyfen Abbey offers travellers a quiet bench and a public visitor register.","Iona records travellers' names only when they volunteer them.","The abbey is a safe public stop; no cellar, hidden chamber or magical cure is established."],greeting:"“Welcome to Greyfen,” Iona says beside a visitors' register. “Sit a while. Where has the road brought you from?”"},
  {id:"watcher",name:"Perrin Vale",location:"hill",role:"Signal Hill lookout",voice:"Cheerful, precise about what can actually be seen.",facts:["Signal Hill overlooks the river valley.","Perrin watches weather and the public roads, not hidden activity in distant towers.","The hill has marked routes to the city, Greyfen and Mosswood."],greeting:"Perrin shades his eyes against the sun. “Room for another pair of eyes up here. The river tells a different story from this height.”"},
];
const npcs=Object.fromEntries(characters.map(c=>[c.id,{name:c.name,role:c.role,locations:[c.location],goals:["Look after their community","Talk with visiting adventurers"],knows:c.facts,voice:c.voice,mustNotKnow:["Hidden main-campaign answers or future adventure outcomes"],conversation:{publicFacts:c.id==="ferryman"?c.facts.slice(0,1):c.facts,conditionalFacts:c.id==="ferryman"?[{requires:[{path:"flags.ferryRepaired",equals:false}],fact:c.facts[1]},{requires:[{path:"flags.ferryRepaired",equals:false}],fact:c.facts[2]},{requires:[{path:"flags.ferryRepaired",equals:true}],fact:"The company repaired the mooring; the ferry is working safely again."}]:[]}}]));
export const eldervaleRoads=assertValidAdventure(withEldervaleCity(withRegionalResidents({
  schemaVersion:1,id:"eldervale-roads",title:"The Roads of Eldervale",startLocation:"city",stateKey:"region",initializeOnSelection:true,
  premise:"Explore the river settlements at your own pace while keeping the Hollow Road investigation separate and resumable.",
  initialFlags:{ferryRepaired:false,storyRecorded:false,...willowfordFlags,...rivergateFlags,...stonecrossFlags},initialResources:{},initialClocks:{},
  discoveries:{"ferry-restored":{name:"Stonecross crossing restored"},"traveller-record":{name:"A traveller's story recorded"},...willowfordDiscoveries,...rivergateDiscoveries,...stonecrossDiscoveries},
  story:{dramaticQuestion:"Who will the company meet and help on the roads between its larger adventures?",playerPromise:"Optional visits, bounded NPC conversation and small persistent local consequences, without a compulsory order.",
    fixedTruths:[{id:"public-roads",statement:"These seven places are public settlements or marked stopping places connected by the authored roads."},{id:"damaged-mooring",statement:"The Stonecross mooring can be repaired using the spare rope already at the landing."}],
    acts:[{id:"explore",title:"The open roads",stages:[0,0],purpose:"Choose optional destinations and meet their residents."}],npcs:{...npcs,...willowfordNpcs,...rivergateNpcs,...stonecrossNpcs},
    clues:{"mooring":{fact:"The ferry needs its spare rope secured to the landing ring.",essential:false,unlocks:"A working local crossing",sources:[{location:"ferry",npc:"ferryman",methods:["Ask Jory about the crossing","Inspect the mooring"],outcome:"Explain the available spare rope and landing ring."}]},...willowfordClues,...rivergateClues,...stonecrossClues},
    improvisation:{allowed:["State-neutral small talk and atmosphere supported by the present NPC's facts"],forbidden:["Invented destinations, shops, purchases, quests, rewards or main-story disclosures"]}},
  locations:{...Object.fromEntries(regionalSites.map((site,index)=>[site.id,{
    name:site.name,description:site.description,stage:0,aliases:[site.name],
    presentations:site.id==="ferry"?[{requires:[{path:"flags.ferryRepaired",equals:true}],description:"Stonecross Ferry is back in service. Jory tends the repaired mooring beside the landing; the public riverside roads remain open."}]:[],
    map:{x:10+(index%3)*31,y:12+Math.floor(index/3)*28,w:24,h:19,kind:site.id==="wood"?"outdoor":"court",label:site.name},
    features:[...characters.filter(c=>c.location===site.id).map(c=>({id:c.id,label:c.name,kind:"npc"})),...(site.id==="ferry"?[{id:"mooring",label:"ferry mooring",kind:"scenery",observation:"The mooring is frayed. Sound spare rope and a landing ring are within reach.",presentations:[{requires:[{path:"flags.ferryRepaired",equals:true}],observation:"Sound rope is securely tied to the landing ring. The repaired mooring holds the ferry safely."}]}]:[]),...(site.id==="abbey"?[{id:"register",label:"visitor register",kind:"scenery",observation:"A public register of voluntarily shared traveller stories."}]:[])],
    exits:links.filter(link=>link.includes(site.id)).map(link=>{const to=link.find(id=>id!==site.id);return {to,via:"marked road to "+regionalSites.find(s=>s.id===to).name};}),
    entryBeats:characters.filter(c=>c.location===site.id).map(c=>({id:c.id+"-welcome",npc:c.id,text:c.greeting,...(c.id==="ferryman"?{requires:[{path:"flags.ferryRepaired",equals:false}]}:{})})),
  }])),...willowfordLocations,...rivergateLocations,...stonecrossLocations,...Object.fromEntries([["village",willowfordLocations.village],["market",rivergateLocations.market],["ferry",stonecrossLocations.ferry]].map(([id,location])=>[id,{...location,exits:[...location.exits,...links.filter(link=>link.includes(id)).map(link=>{const to=link.find(next=>next!==id);return {to,via:"marked road to "+regionalSites.find(s=>s.id===to).name};})]}]))},
  encounters:stonecrossEncounters,
  objects:{},containers:{},items:{},scenes:{},
  interactions:[
    ...willowfordInteractions,...rivergateInteractions,...stonecrossInteractions,...carriageInteractions,
    {id:"repair-ferry",idempotencyKey:"region:ferry-repaired",location:"ferry",modes:["act"],verbs:["repair","secure","tie","fix"],targets:["mooring","rope","ferry","landing ring"],effects:[{op:"set",path:"flags.ferryRepaired",value:true},{op:"add",path:"discoveries",value:"ferry-restored"}],outcome:{message:"The company secures the sound spare rope to the landing ring. Jory tests the mooring, then smiles. “That'll hold. Thank you.” Stonecross Ferry is working again. The company stays at the landing.",publicFacts:["The Stonecross mooring is repaired.","No money, item or main-campaign milestone is awarded."]},repeat:{message:"The mooring is already secure; Jory's ferry remains in service."}},
    {id:"record-travel-story",idempotencyKey:"region:story-recorded",location:"abbey",modes:["act","speak"],verbs:["share","tell","record","write"],targets:["story","travels","register","Iona"],effects:[{op:"set",path:"flags.storyRecorded",value:true},{op:"add",path:"discoveries",value:"traveller-record"}],outcome:{message:"Iona records only the account the company chooses to share. “The road is made of people, too,” she says, closing the register. No private discovery or hidden adventure answer is disclosed.",publicFacts:["The company shared a voluntary traveller account at Greyfen."]},repeat:{message:"Iona remembers the company's visit and welcomes another conversation; no duplicate reward is granted."}},
  ],
})));
export default eldervaleRoads;
