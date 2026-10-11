import {getActiveAdventure,getPartyState,listPlayers} from './database.mjs';
import {authoredRouteContext} from './adventure-rules.mjs';
import {adventureDefinition} from './adventure-registry.mjs';
import {createCanonicalState} from './interaction-engine.mjs';
import {buildSceneCommandSurface} from './scene-command-surface.mjs';

export function movementFromScene(definition, state, reason='') {
  if (!definition) return {locationId:'',locationName:'',reason:'No authored movement options are available in this adventure.',options:[]};
  const surface=buildSceneCommandSurface(definition,state);
  const seen=new Set();
  return {locationId:surface.location.id,locationName:surface.location.name,reason,
    options:surface.exits.filter(route=>route.available && !seen.has(route.destinationId) && seen.add(route.destinationId)).map(route=>({
      id:route.destinationId,label:route.destination,text:`Go to ${route.destination} through the ${route.via}.`,
      detail:route.via,
    }))};
}

export function movementForPlayer(db, player) {
  const adventure=getActiveAdventure(db,player.partyId), definition=adventureDefinition(adventure);
  if (!definition) return movementFromScene(null,null);
  const saved=getPartyState(db,player.partyId,`world:${definition.id}`) || {};
  const legacy=getPartyState(db,player.partyId,'dm') || {};
  const current=saved.currentLocation || authoredRouteContext(adventure?.id,legacy,saved)?.currentLocation?.key;
  const state=createCanonicalState(definition,{...saved,...(definition.locations[current]?{currentLocation:current}:{})});
  const party=listPlayers(db,player.partyId);
  const reason=getPartyState(db,player.partyId,'combat')?.active?'Finish combat before travelling.':
    party.some(member=>getPartyState(db,player.partyId,`pendingCheck:${member.id}`))?"Resolve the company's pending check before travelling.":
    party.some(member=>member.hp<=0)?'Help every fallen party member before travelling.':'';
  return movementFromScene(definition,state,reason);
}
