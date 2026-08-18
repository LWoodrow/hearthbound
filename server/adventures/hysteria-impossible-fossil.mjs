import { assertValidAdventure } from "../adventure-schema.mjs";

const f=(id,label,kind="scenery")=>({id,label,kind});
const e=(to,via,options={})=>({to,via,...options});

export const hysteriaImpossibleFossil = assertValidAdventure({
  schemaVersion:1,id:"hysteria-impossible-fossil",title:"The Impossible Fossil",startLocation:"base-camp",stateKey:"exposure",
  premise:"A disciplined expedition must contain a higher-dimensional fossil whose separated sections converge when observed.",
  principles:["Measurements are authoritative outcomes.","Exposure has explicit sources and costs.","The phenomenon can be contained or escaped, not killed."],
  initialFlags:{alignmentMeasured:false,warningDecoded:false,anchorsPlaced:false,contained:false,escaped:false,aftermathRecorded:false},
  initialResources:{anchors:3,tethers:2},initialClocks:{exposure:0,fold:0},
  discoveries:{"impossible-alignment":{name:"Impossible alignment"},"prior-warning":{name:"Prior expedition warning"},"folding-law":{name:"Observation drives convergence"},"aftermath-residue":{name:"Irreversible missing space"}},
  story:{dramaticQuestion:"Can the expedition understand enough to survive without completing the impossible shape?",playerPromise:"Evidence-led cosmic horror with explicit exposure and containment choices.",
    fixedTruths:[{id:"cross-section",statement:"The fossils are spatial cross-sections of one higher-dimensional entity."},{id:"observation-coupling",statement:"Sustained observation accelerates convergence."}],
    acts:[{id:"baseline",title:"Baseline",stages:[0,1],purpose:"Establish credible measurements."},{id:"fold",title:"Convergence",stages:[2,3],purpose:"Contain or escape the folding site."}],
    npcs:{"dr-vale":{name:"Dr Vale",role:"Expedition geologist",locations:["base-camp","fossil-trench"],goals:["Preserve the team"],knows:["Baseline geology"],voice:"Clinical",mustNotKnow:["The full ontology before evidence"]}},
    clues:{"alignment":{fact:"The sections align impossibly.",essential:true,unlocks:"Competing hypotheses",sources:[{location:"fossil-trench",methods:["Measure sections"],outcome:"Record alignment"},{location:"archive-tent",methods:["Compare plates"],outcome:"Confirm alignment independently"}]},"warning":{fact:"Earlier observers warned against completing the shape.",essential:true,unlocks:"Containment",sources:[{location:"archive-tent",methods:["Decode notebook"],outcome:"Reveal warning"},{location:"fossil-trench",methods:["Inspect marker pattern"],outcome:"Reconstruct warning"}]}},
    consequences:{exposure:"Study grants useful facts and raises exposure.",failure:"A failed approach advances folding but preserves another route."},improvisation:{allowed:["Mundane expedition detail"],forbidden:["Changing the ontology","Inventing a kill condition"]}},
  locations:{
    "base-camp":{name:"Expedition Base Camp",description:"A calibrated safe baseline.",stage:0,map:{x:5,y:20},features:[f("equipment","survey equipment")],exits:[e("fossil-trench","marked trail"),e("archive-tent","canvas archive tent")]},
    "fossil-trench":{name:"Fossil Trench",description:"Separated fossil sections lie in one exposed stratum.",stage:1,map:{x:40,y:20},features:[f("sections","fossil sections","clue"),f("markers","survey markers","clue")],exits:[e("base-camp","marked trail"),e("archive-tent","tethered path")]},
    "archive-tent":{name:"Archive Tent",description:"Plates and a damaged prior notebook await comparison.",stage:1,map:{x:40,y:60},features:[f("plates","photographic plates","clue"),f("notebook","prior notebook","clue")],exits:[e("base-camp","canvas flap"),e("fossil-trench","tethered path")]},
  },objects:{},containers:{},items:{"anchor":{name:"Fixed survey anchor",location:"base-camp"}},scenes:{},
  interactions:[
    {id:"measure-alignment",idempotencyKey:"fossil:measure",location:"fossil-trench",modes:["act"],stage:1,verbs:["measure","compare","study"],targets:["fossil sections","sections","alignment"],effects:[{op:"set",path:"flags.alignmentMeasured",value:true},{op:"add",path:"discoveries",value:"impossible-alignment"},{op:"increment",path:"clocks.exposure",value:1}],outcome:{message:"The sections align only when treated as one impossible cross-section. The repeatable measurement raises exposure by one.",publicFacts:["The fossil sections have an impossible repeatable alignment."]}},
    {id:"decode-warning",idempotencyKey:"archive:warning",location:"archive-tent",modes:["act"],stage:2,verbs:["read","decode","compare","study"],targets:["notebook","plates","warning"],effects:[{op:"set",path:"flags.warningDecoded",value:true},{op:"add",path:"discoveries",value:"prior-warning"}],outcome:{message:"The prior notebook warns that completing the observed shape removes the space around it.",publicFacts:["Earlier observers warned against completing the shape."]}},
    {id:"place-anchors",idempotencyKey:"contain:anchors",location:"fossil-trench",modes:["act"],stage:3,verbs:["place","set","use"],targets:["anchors","survey anchors","fixed anchors"],requires:[{path:"discoveries",includes:"prior-warning"},{path:"resources.anchors",minimum:3}],effects:[{op:"consume",path:"resources.anchors",value:3},{op:"set",path:"flags.anchorsPlaced",value:true},{op:"set",path:"flags.contained",value:true},{op:"set",path:"flags.aftermathRecorded",value:true},{op:"add",path:"discoveries",value:"aftermath-residue"}],outcome:{message:"Three fixed anchors break the observed alignment. The fold stops, but a measured volume of the trench is permanently absent.",publicFacts:["The fold is contained.","Part of the trench is irreversibly missing."]}},
  ],milestones:{complete:{name:"Fold contained",requires:[{path:"flags.contained",equals:true}]}}
});
export default hysteriaImpossibleFossil;
