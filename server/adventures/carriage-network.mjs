// Established-road transport is data, not a teleport or an AI-authored promise.
export const carriageStops=[{id:"city",name:"Eldervale City"},{id:"market",name:"Rivergate Market"},{id:"willow-coach",name:"Willowford Coach Yard"}];
const road=["city","market","ferry","village","willow-coach"];
export const carriageServices=carriageStops.flatMap(from=>carriageStops.filter(to=>to.id!==from.id).map(to=>{
  const start=road.indexOf(from.id),end=road.indexOf(to.id);
  const journey=start<end?road.slice(start,end+1):road.slice(end,start+1).reverse();
  return {id:"carriage-"+from.id+"-"+to.id,location:from.id,destination:to.id,label:to.name,text:"Ride carriage to "+to.name,journey,requires:journey.includes("ferry")?[{path:"flags.ferryRepaired",equals:true}]:[]};
}));
export const carriageInteractions=carriageServices.map(service=>({
  id:service.id,location:service.location,once:false,modes:["act"],verbs:["ride","board"],targets:["carriage to "+service.label],journey:service.journey,requires:service.requires,effects:[],
  outcome:{message:"The company takes the public carriage along the established road to "+service.label+". The saved main adventure and character resources are unchanged."},
  blocked:{message:"First visit every connecting stop on this route. Carriages through Stonecross also require its mooring repaired. No journey has been made."},
}));
