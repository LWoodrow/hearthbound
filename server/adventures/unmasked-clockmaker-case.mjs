import { assertValidAdventure } from "../adventure-schema.mjs";
import { validateCaseDossier } from "../case-engine.mjs";

const dossier={
  id:"unmasked-clockmaker-case",seed:"clockmaker-v1",culprit:"elias-voss",motive:"Prevent exposure of procurement fraud",method:"Aconite in the victim's medicinal cordial",opportunity:"A seven-minute service-corridor gap during the gala",
  timeline:[{time:"20:40",event:"Voss enters service corridor"},{time:"20:43",event:"Voss doses cordial"},{time:"20:47",event:"Voss returns to ballroom"},{time:"21:05",event:"Victim drinks cordial"}],
  suspects:{
    "elias-voss":{name:"Elias Voss",observations:[{text:"He saw the cordial tray before service."}],beliefs:["The procurement ledger can expose him."],permittedDisclosures:["He attended the gala."],deliberateLies:["He never left the ballroom."]},
    "mara-quill":{name:"Mara Quill",observations:[{text:"She saw Voss return through the east door.",requires:"east-door-print"}],beliefs:["The victim planned an audit."],permittedDisclosures:["She argued with the victim."],deliberateLies:[]},
    "jonas-reed":{name:"Jonas Reed",observations:[{text:"He prepared an unpoisoned cordial."}],beliefs:["Someone used his pantry key."],permittedDisclosures:["His key went missing briefly."],deliberateLies:["He did not gamble with staff funds."]},
  },
  evidence:{
    "cordial-residue":{source:"victim glass",provenance:"sealed by Inspector Hale",supports:["aconite method"]},
    "east-door-print":{source:"service corridor east door",provenance:"photographed before collection",supports:["Voss corridor access"]},
    "ledger-page":{source:"procurement archive",provenance:"signed extraction log",supports:["Voss motive"]},
    "kitchen-timeline":{source:"staff statements",provenance:"three separately timed interviews",supports:["poisoning window"]},
  },
  contradictions:[{statement:"Voss never left the ballroom",evidence:["east-door-print","kitchen-timeline"]}],
  accusationRequirements:[["cordial-residue"],["east-door-print","kitchen-timeline"],["ledger-page"]],
  wrongAccusation:{effect:"The suspect withdraws cooperation and the case clock advances."},
};
if(validateCaseDossier(dossier).length) throw new Error(validateCaseDossier(dossier).join("; "));

const f=(id,label,kind="scenery")=>({id,label,kind});
const e=(to,via)=>({to,via});
export const unmaskedClockmakerCase=assertValidAdventure({
  schemaVersion:1,id:"unmasked-clockmaker-case",title:"The Clockmaker's Alibi",startLocation:"ballroom",stateKey:"caseStage",caseDossier:dossier,
  premise:"A poisoned cordial, a seven-minute gap, and an audit ledger form a fixed fair-play case.",principles:["The dossier never changes.","Evidence has provenance and custody.","Suspects know only their projection."],
  initialFlags:{glassTested:false,printCollected:false,ledgerRecovered:false},discoveries:{"cordial-residue":{name:"Aconite residue"},"east-door-print":{name:"East-door print"},"ledger-page":{name:"Procurement ledger page"}},
  story:{dramaticQuestion:"Can investigators prove who poisoned the clockmaker before the case is politically buried?",playerPromise:"A fair mystery whose solution is fixed before play.",fixedTruths:[{id:"culprit",statement:"Elias Voss poisoned the cordial."},{id:"timeline",statement:"The poisoning occurred during the seven-minute corridor gap."}],acts:[{id:"scene",title:"The Gala",stages:[0,1],purpose:"Establish evidence."},{id:"case",title:"The Contradiction",stages:[2,3],purpose:"Prove motive, method, and opportunity."}],npcs:Object.fromEntries(Object.entries(dossier.suspects).map(([id,s])=>[id,{name:s.name,role:"Suspect",locations:["ballroom","interview-room"],goals:["Protect private interests"],knows:s.permittedDisclosures,voice:"Controlled",mustNotKnow:[]}])) ,clues:{"method":{fact:"Aconite killed the victim.",essential:true,unlocks:"Method",sources:[{location:"ballroom",methods:["Test glass"],outcome:"Find residue"},{location:"laboratory",methods:["Test sample"],outcome:"Confirm residue"}]},"opportunity":{fact:"Voss used the service corridor.",essential:true,unlocks:"Opportunity",sources:[{location:"service-corridor",methods:["Lift print"],outcome:"Record print"},{location:"interview-room",methods:["Compare timelines"],outcome:"Establish gap"}]}},consequences:{wrongAccusation:"Advance pressure without changing the culprit."},improvisation:{allowed:["Atmosphere"],forbidden:["Changing culprit","Inventing evidence"]}},
  locations:{ballroom:{name:"Gala Ballroom",description:"The victim's sealed glass remains by the clock display.",stage:0,map:{x:10,y:20},features:[f("glass","victim glass","evidence")],exits:[e("service-corridor","east door"),e("interview-room","interview door")]},"service-corridor":{name:"Service Corridor",description:"A narrow route with a preserved east-door print.",stage:1,map:{x:45,y:20},features:[f("print","east-door print","evidence")],exits:[e("ballroom","east door"),e("laboratory","laboratory door")]},laboratory:{name:"Police Laboratory",description:"Evidence can be tested under recorded custody.",stage:1,map:{x:75,y:20},features:[f("lab","analysis bench")],exits:[e("service-corridor","laboratory door")]},"interview-room":{name:"Interview Room",description:"Suspects are questioned against recorded evidence.",stage:2,map:{x:45,y:60},features:[f("recorder","interview recorder")],exits:[e("ballroom","interview door")]},},objects:{},containers:{},items:{},scenes:{},
  interactions:[
    {id:"test-cordial",idempotencyKey:"evidence:cordial",location:"ballroom",modes:["act"],stage:1,verbs:["test","inspect","analyse","examine"],targets:["glass","cordial","residue"],effects:[{op:"set",path:"flags.glassTested",value:true},{op:"add",path:"discoveries",value:"cordial-residue"},{op:"set",path:"knowledge.custody.cordial-residue",value:"Inspector Hale"}],outcome:{message:"A sealed test establishes aconite residue in the victim's cordial; custody remains recorded to Inspector Hale.",publicFacts:["The victim's cordial contained aconite."]}},
    {id:"collect-east-print",idempotencyKey:"evidence:print",location:"service-corridor",modes:["act"],stage:2,verbs:["collect","lift","photograph","inspect"],targets:["east door print","fingerprint","print"],effects:[{op:"set",path:"flags.printCollected",value:true},{op:"add",path:"discoveries",value:"east-door-print"}],outcome:{message:"The east-door print is photographed in place and lifted under seal, preserving provenance.",publicFacts:["A preserved print establishes corridor access."]}},
  ],milestones:{complete:{name:"Case proved",requires:[{path:"flags.glassTested",equals:true},{path:"flags.printCollected",equals:true}]}}
});
export { dossier as unmaskedCaseDossier };
export default unmaskedClockmakerCase;
