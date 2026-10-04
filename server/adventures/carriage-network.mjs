// Established-road transport is data, not a teleport or an AI-authored promise.
export const carriageStops=[{id:"city",name:"Eldervale City"},{id:"market",name:"Rivergate Market"},{id:"willow-coach",name:"Willowford Coach Yard"}];
const road=["city","market","ferry","village","willow-coach"];
export const carriageServices=carriageStops.flatMap(from=>carriageStops.filter(to=>to.id!==from.id).map(to=>{
  const start=road.indexOf(from.id),end=road.indexOf(to.id);
  const journey=start<end?road.slice(start,end+1):road.slice(end,start+1).reverse();
  return {id:"carriage-"+from.id+"-"+to.id,location:from.id,destination:to.id,label:to.name,text:"Ride carriage to "+to.name,journey,requires:journey.includes("ferry")?[{path:"flags.ferryRepaired",equals:true}]:[]};
}));
// A local boarding point extends the established market road. Existing market
// service IDs remain valid; every extra intermediate stop is still recorded.
for(const destination of ["city","willow-coach"]) {
  const base=carriageServices.find(service=>service.location==="market"&&service.destination===destination);
  const outward=["rivergate-coach",...base.journey];
  carriageServices.push({id:"carriage-rivergate-coach-"+destination,location:"rivergate-coach",destination,label:base.label,text:"Ride carriage to "+base.label,journey:outward,requires:base.requires});
  carriageServices.push({id:"carriage-"+destination+"-rivergate-coach",location:destination,destination:"rivergate-coach",label:"Rivergate Coach Stand",text:"Ride carriage to Rivergate Coach Stand",journey:[...outward].reverse(),requires:base.requires});
}
// Stonecross is a physical local stop, not a remote shortcut. Its public
// carriage uses the same crossing gate even when travelling back toward town.
for(const [destination,label,journey] of [
  ["city","Eldervale City",["stonecross-coach","ferry","market","city"]],
  ["market","Rivergate Market",["stonecross-coach","ferry","market"]],
  ["rivergate-coach","Rivergate Coach Stand",["stonecross-coach","ferry","market","rivergate-coach"]],
  ["willow-coach","Willowford Coach Yard",["stonecross-coach","ferry","village","willow-coach"]],
]) {
  const requires=[{path:"flags.ferryRepaired",equals:true}];
  carriageServices.push({id:"carriage-stonecross-coach-"+destination,location:"stonecross-coach",destination,label,text:"Ride carriage to "+label,journey,requires});
  carriageServices.push({id:"carriage-"+destination+"-stonecross-coach",location:destination,destination:"stonecross-coach",label:"Stonecross Coach Stop",text:"Ride carriage to Stonecross Coach Stop",journey:[...journey].reverse(),requires});
}
export const carriageInteractions=carriageServices.map(service=>({
  id:service.id,location:service.location,once:false,modes:["act"],verbs:["ride","board"],targets:["carriage to "+service.label],journey:service.journey,requires:service.requires,effects:[],
  outcome:{message:"The company takes the public carriage along the established road to "+service.label+". The saved main adventure and character resources are unchanged."},
  blocked:{message:"First visit every connecting stop on this route. Carriages through Stonecross also require its mooring repaired. No journey has been made."},
}));
