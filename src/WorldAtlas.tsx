import {useEffect,useState} from "react";
import type {RegionalAtlas} from "./types";

export function WorldAtlas({atlas,busy,travel,journey,carriage}:{atlas:RegionalAtlas;busy:boolean;travel:(destinationId:string)=>Promise<void>;journey:(kind:"explore"|"return")=>Promise<void>;carriage:(id:string)=>Promise<void>}) {
  const [selected,setSelected]=useState(atlas.currentSite);
  const [zoom,setZoom]=useState(1);
  useEffect(()=>setSelected(atlas.currentSite),[atlas.currentSite]);
  const site=atlas.sites.find(place=>place.id===selected) || atlas.sites.find(place=>place.current) || atlas.sites[0];
  return <section className="world-atlas"><header><div><span className="eyebrow">The open roads · Regional atlas</span><h1>{atlas.title}</h1><p>Choose a place, follow its connected roads and meet the people who live there. Public settlements are charted; visited places are marked. The wider terrain is illustrative, not an invented travel route.</p></div><div className="atlas-zoom" aria-label="Map zoom"><button type="button" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))} aria-label="Zoom out">−</button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.5))} aria-label="Zoom in">+</button></div></header>
    <div className="illustrated-atlas-scroll"><div className="illustrated-atlas-plate" style={{width:`${zoom*100}%`}}>
      <img src={atlas.image} alt="Illustrated Eldervale terrain: river valleys, forests, mountains, islands and coastlines. Selectable destinations are separate map markers."/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="illustrated-atlas-roads" aria-hidden="true">{atlas.routes.map(route=>{
        const from=atlas.sites.find(place=>place.id===route.from),to=atlas.sites.find(place=>place.id===route.to);
        return from&&to ? <path key={route.from+route.to} className={route.travelled?"travelled":""} d={`M${from.x} ${from.y} L${to.x} ${to.y}`}/> : null;
      })}</svg>
      {atlas.sites.map(place=><button type="button" key={place.id} className={`atlas-destination ${place.current?"current":""} ${place.visited?"visited":""} ${place.id===site.id?"selected":""}`} style={{left:`${place.x}%`,top:`${place.y}%`}} onClick={()=>setSelected(place.id)} aria-pressed={place.id===site.id} aria-label={`${place.name}${place.current?", current location":place.visited?", visited":", charted"}`}><span aria-hidden="true">{place.kind==="chapter"?"⚑":place.kind==="city"?"⌂":"•"}</span><strong>{place.name}</strong></button>)}
    </div></div>
    <label className="atlas-place-picker">Choose a destination<select value={site.id} onChange={event=>setSelected(event.target.value)}>{atlas.sites.map(place=><option key={place.id} value={place.id}>{place.name}{place.current?" · You are here":place.visited?" · Visited":""}</option>)}</select></label>
    <div className="atlas-exploration-panel"><article><span className="eyebrow">{site.current?"You are here":site.visited?"Visited":"Known from the public regional chart"}</span><h2>{site.name}</h2><p>{site.description}</p>{site.npcs.length>0&&<p>People met here: {site.npcs.join(", ")}.</p>}
      {atlas.exploring&&site.travelText&&<button type="button" disabled={busy||!site.available} onClick={()=>void travel(site.id)}>{site.current?"You are here":`Travel to ${site.name}`}</button>}
      {atlas.exploring&&!site.available&&!site.current&&site.kind!=="chapter"&&<small>Follow the connected stops to reach this place; there is no teleporting across the map.</small>}
      {atlas.reason&&<p role="status">{atlas.reason}</p>}
      {atlas.carriages.length>0&&<div className="carriage-options"><h3>Public carriage</h3><p>Established roads only · No fare in this introductory service</p>{atlas.carriages.map(service=><div key={service.id}><button type="button" disabled={busy||!service.available} onClick={()=>void carriage(service.id)}>Carriage to {service.label}</button>{service.reason&&<small>{service.reason}</small>}</div>)}</div>}
    </article><aside><span className="eyebrow">Your continuing adventure</span><h3>The Hollow Road</h3><p>{atlas.mainAdventure}</p><p>Detours keep your main story, inventory and character progress. They do not skip chapter gates or award main-story levels.</p>
      {!atlas.exploring&&<><button type="button" disabled={busy||!atlas.canExplore} aria-describedby="regional-departure-help" onClick={()=>void journey("explore")}>Explore the public roads</button><p id="regional-departure-help" role={atlas.reason?"status":undefined}>{atlas.reason||atlas.departureDescription}</p></>}
      {atlas.exploring&&<><p>Available next stops: {atlas.sites.filter(place=>place.available).map(place=>place.name).join(" · ")||(atlas.reason|| (atlas.local?"Return to the village square for the regional roads.":"No connected stop is currently available."))}</p>{atlas.hasPausedAdventure?<><button type="button" disabled={busy||!atlas.canReturn} onClick={()=>void journey("return")}>Resume saved main adventure</button>{!atlas.canReturn&&<small>Return along the roads to Eldervale City to resume.</small>}</>:<p>No main adventure is paused. Use Game library to choose The Lantern Below when you want to begin the main story.</p>}<p>{atlas.activities.ferryRepaired?"✓ Stonecross mooring restored":"Optional local help: ask Jory at Stonecross."}<br/>{atlas.activities.storyRecorded?"✓ Traveller account recorded":"Optional visit: meet Iona at Greyfen."}</p></>}
    </aside></div>
  </section>;
}
