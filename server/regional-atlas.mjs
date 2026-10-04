import {getActiveAdventure,getParty,getPartyState,setPartyState,listPlayers,selectAdventure} from "./database.mjs";
import {createCanonicalState,journeyAvailable,availableInteractions} from "./interaction-engine.mjs";
import {eldervaleRoads,regionalSites,regionalLinks} from "./adventures/eldervale-roads.mjs";
import {visibleLocationDescription,requirementsMet} from "./world-state.mjs";
import {willowfordAtlas} from "./adventures/willowford.mjs";
import {rivergateAtlas} from "./adventures/rivergate.mjs";
import {stonecrossAtlas} from "./adventures/stonecross.mjs";
import {carriageServices} from "./adventures/carriage-network.mjs";
import {projectScene} from "./scene-projection.mjs";
import {adventureRules,authoredRouteContext,locationIsRevealed} from "./adventure-rules.mjs";

// Future settlements provide the same data shape; projection never creates geography.
const settlements=[willowfordAtlas,rivergateAtlas,stonecrossAtlas];
function localView(state,reason) {
  const settlement=settlements.find(entry=>entry.places.some(place=>place.id===state.currentLocation));
  if(!settlement) return null;
  const exits=projectScene(eldervaleRoads,state).exits;
  const sites=settlement.places.filter(place=>requirementsMet(state,place.requires||[])).map(place=>({
    id:place.id,name:place.name,x:place.x,y:place.y,kind:"local",
    description:visibleLocationDescription(eldervaleRoads,state,place.id),
    visited:state.visited.includes(place.id),current:state.currentLocation===place.id,
    available:!reason&&exits.some(exit=>exit.to===place.id),travelText:"Go to "+place.name,
    npcs:state.visited.includes(place.id)?Object.values(eldervaleRoads.story.npcs).filter(npc=>npc.locations.includes(place.id)).map(npc=>npc.name):[],
  }));
  const visible=new Set(sites.map(site=>site.id));
  const task=settlement.taskStages.find(stage=>requirementsMet(state,stage.requires))?.text||"Explore the public places.";
  return {id:settlement.id,title:settlement.title,image:settlement.image,imageAlt:settlement.imageAlt,introduction:settlement.introduction,returnHint:settlement.returnHint,sites,
    routes:settlement.links.filter(([from,to])=>visible.has(from)&&visible.has(to)).map(([from,to])=>({from,to,travelled:traversed(state,from,to)})),
    task,actions:availableInteractions(eldervaleRoads,state).filter(action=>settlement.actionIds.includes(action.id)).map(action=>({id:action.id,text:action.verbs[0]+" "+action.targets[0]})),
    reason};
}
const traversed=(state,from,to)=>(state.outcomes||[]).some(outcome=>(outcome.canonicalEvents||[]).some(event=>event.type==="location-entered"&&[from,to].includes(event.locationId)&&[from,to].includes(event.previousLocationId)));
function transportView(state,reason) {
  return carriageServices.filter(service=>service.location===state.currentLocation).map(service=>{
    const unmet=!requirementsMet(state,service.requires);
    const unknown=!journeyAvailable(eldervaleRoads,state,service.journey);
    return {id:service.id,label:service.label,available:!reason&&!unmet&&!unknown,reason:reason||(unmet?"Repair the Stonecross mooring first.":unknown?"First visit every connecting stop, including the coach yard.":""),text:service.text};
  });
}

const slug=id=>["lantern-below","ashes-briarwatch","hollow-star","eldervale-roads"].find(value=>String(id||"").endsWith("-"+value));
const busyReason=(db,partyId)=>{
  if (getPartyState(db,partyId,"combat")?.active) return "Finish combat before travelling.";
  if (listPlayers(db,partyId).some(player=>getPartyState(db,partyId,"pendingCheck:"+player.id))) return "Resolve the company's pending check before travelling.";
  if (listPlayers(db,partyId).some(player=>player.hp<=0)) return "Help every fallen party member before travelling.";
  return "";
};
export function regionalAtlasView(db,player) {
  const party=getParty(db,player.partyId);
  const adventure=getActiveAdventure(db,player.partyId);
  const currentSlug=slug(adventure?.id);
  if (!currentSlug) return null;
  const exploring=currentSlug==="eldervale-roads";
  const state=createCanonicalState(eldervaleRoads,getPartyState(db,player.partyId,"world:eldervale-roads")||{});
  const dm=getPartyState(db,player.partyId,"dm")||{};
  const rules=adventureRules(adventure.id);
  // Read only the active adventure's state. Legacy chapters infer their current
  // scene through the same authored route projection used by movement/recap.
  const activeWorld=getPartyState(db,player.partyId,"world:"+currentSlug);
  const mainLocation=activeWorld?.currentLocation || dm.currentLocationKey
    || (currentSlug==="lantern-below"?"outside-inn":authoredRouteContext(adventure.id,dm)?.currentLocation?.key);
  const gateway=rules.regionalDeparture;
  const departureSafe=Boolean(gateway?.locations.includes(mainLocation))
    && locationIsRevealed(adventure.id,dm,mainLocation);
  const departureReason=gateway?.reason || "Regional detours are not yet available from this chapter.";
  const reason=busyReason(db,player.partyId);
  const resume=getPartyState(db,player.partyId,"regionalReturn");
  const settlement=settlements.find(entry=>entry.places.some(place=>place.id===state.currentLocation));
  const currentSite=exploring ? settlement?.root || state.currentLocation : currentSlug==="ashes-briarwatch" ? "briarwatch" : currentSlug==="hollow-star" ? "court" : "city";
  const sites=regionalSites.map(site=>({...site,description:visibleLocationDescription(eldervaleRoads,state,site.id),visited:state.visited.includes(site.id),current:currentSite===site.id,
    available:exploring && !reason && eldervaleRoads.locations[state.currentLocation].exits.some(exit=>exit.to===site.id),
    travelText:"Go to "+site.name,
    npcs:state.visited.includes(site.id) ? Object.values(eldervaleRoads.story.npcs).filter(npc=>npc.locations.includes(site.id)).map(npc=>npc.name) : [],
  }));
  const completed=id=>db.prepare("SELECT status FROM party_adventures WHERE party_id=? AND adventure_id=?").get(player.partyId,party.worldId+"-"+id)?.status==="complete";
  if (completed("lantern-below") || currentSlug==="ashes-briarwatch") sites.push({id:"briarwatch",name:"Briarwatch",x:65,y:28,kind:"chapter",description:"The next main-story chapter. Follow the adventure's closing scene and level requirements to continue; this is not a free-travel shortcut.",current:currentSite==="briarwatch",visited:currentSlug==="ashes-briarwatch"||completed("ashes-briarwatch"),available:false,npcs:[]});
  if (completed("ashes-briarwatch") || currentSlug==="hollow-star") sites.push({id:"court",name:"Astronomer's Court",x:49,y:52,kind:"chapter",description:"A later main-story destination in Eldervale City. Continue through the campaign rather than skipping its discoveries.",current:currentSite==="court",visited:currentSlug==="hollow-star",available:false,npcs:[]});
  return {image:"/art/maps/eldervale-atlas-v1.png",title:party.worldName,exploring,currentSite,sites,
    routes:regionalLinks.map(([from,to])=>({from,to,travelled:traversed(state,from,to)})),
    local:exploring?localView(state,reason):null,carriages:exploring?transportView(state,reason):[],
    canExplore:departureSafe&&!reason,canReturn:exploring&&state.currentLocation==="city"&&Boolean(resume?.adventureId)&&!reason,
    departureDescription:gateway?.description || "",
    reason:reason || (!exploring&&!departureSafe ? departureReason : ""),
    hasPausedAdventure:Boolean(resume?.adventureId),mainAdventure:exploring ? resume?.title || "No main adventure paused" : adventure.title,
    activities:{ferryRepaired:state.flags.ferryRepaired,storyRecorded:state.flags.storyRecorded}};
}

export function regionalTravelCommand(db,player,destinationId) {
  const view=regionalAtlasView(db,player);
  const site=view?.local?.sites.find(entry=>entry.id===destinationId)||view?.sites.find(entry=>entry.id===destinationId);
  if (!view?.exploring || !site?.available) throw new Error(view?.reason || "Choose an available connected road; that destination cannot be reached directly.");
  return site.travelText;
}

export function carriageTravelCommand(db,player,serviceId) {
  const view=regionalAtlasView(db,player);
  const service=view?.carriages.find(entry=>entry.id===serviceId);
  if(!view?.exploring||!service?.available) throw new Error(service?.reason||view?.reason||"Choose an available carriage at the current stop.");
  return service.text;
}

// Selection already archives per-adventure DM state and maps. The detour adds
// strict physical departure/return guards and an atomic completion-status restore.
export function changeRegionalJourney(db,player,kind) {
  const view=regionalAtlasView(db,player);
  if (!view || !["explore","return"].includes(kind) || !(kind==="explore" ? view.canExplore : view.canReturn)) throw new Error(view?.reason || "That journey is not available from this location.");
  const party=getParty(db,player.partyId);
  const active=getActiveAdventure(db,player.partyId);
  const resume=getPartyState(db,player.partyId,"regionalReturn");
  db.exec("SAVEPOINT regional_journey");
  try {
    let adventure;
    if (kind==="explore") {
      setPartyState(db,player.partyId,"regionalReturn",{adventureId:active.id,title:active.title,status:active.status});
      adventure=selectAdventure(db,player.partyId,party.worldId+"-eldervale-roads");
    } else {
      adventure=selectAdventure(db,player.partyId,resume.adventureId);
      if (resume.status==="complete") {
        db.prepare("UPDATE party_adventures SET status='complete' WHERE party_id=? AND adventure_id=?").run(player.partyId,resume.adventureId);
        adventure.status="complete";
      }
      setPartyState(db,player.partyId,"regionalReturn",null);
    }
    db.exec("RELEASE regional_journey");
    return adventure;
  } catch(error) {db.exec("ROLLBACK TO regional_journey");db.exec("RELEASE regional_journey");throw error;}
}
