import {useEffect,useState} from "react";
import type {LocalAtlasData} from "./types";

// A shared illustrated settlement view. Every marker/route comes from the
// server's current canonical projection, never from image recognition.
export function LocalAtlas({atlas,busy,travel,act}:{atlas:LocalAtlasData;busy:boolean;travel:(id:string)=>Promise<void>;act:(text:string)=>Promise<void>}) {
  const current=atlas.sites.find(place=>place.current)?.id||atlas.sites[0].id;
  const [selected,setSelected]=useState(current);
  const [zoom,setZoom]=useState(1);
  useEffect(()=>setSelected(current),[current,atlas.id]);
  const site=atlas.sites.find(place=>place.id===selected)||atlas.sites.find(place=>place.current)||atlas.sites[0];
  return <section className="world-atlas local-atlas">
    <header><div><span className="eyebrow">Local atlas · Public paths and discovered places</span><h1>{atlas.title}</h1><p>{atlas.introduction}</p></div><div className="atlas-zoom" aria-label="Local map zoom"><button type="button" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))} aria-label="Zoom local map out">−</button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" disabled={zoom>=3} onClick={()=>setZoom(value=>Math.min(3,value+.5))} aria-label="Zoom local map in">+</button></div></header>
    <div className="illustrated-atlas-scroll"><div className="illustrated-atlas-plate" style={{width:`${zoom*100}%`}}>
      <img src={atlas.image} alt={atlas.imageAlt}/>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="illustrated-atlas-roads" aria-hidden="true">{atlas.routes.map(route=>{
        const from=atlas.sites.find(place=>place.id===route.from),to=atlas.sites.find(place=>place.id===route.to);
        return from&&to?<path key={route.from+route.to} className={route.travelled?"travelled":""} d={`M${from.x} ${from.y} L${to.x} ${to.y}`}/>:null;
      })}</svg>
      {atlas.sites.map(place=><button type="button" key={place.id} className={`atlas-destination ${place.current?"current":""} ${place.visited?"visited":""} ${site.id===place.id?"selected":""}`} style={{left:`${place.x}%`,top:`${place.y}%`}} onClick={()=>setSelected(place.id)} aria-pressed={site.id===place.id} aria-label={`${place.name}${place.current?", current location":place.visited?", visited":", charted"}`}><span aria-hidden="true">•</span><strong>{place.name}</strong></button>)}
    </div></div>
    <label className="atlas-place-picker">Choose a local place<select value={site.id} onChange={event=>setSelected(event.target.value)}>{atlas.sites.map(place=><option key={place.id} value={place.id}>{place.name}{place.current?" · You are here":place.visited?" · Visited":""}</option>)}</select></label>
    <div className="atlas-exploration-panel"><article><span className="eyebrow">{site.current?"You are here":site.visited?"Visited":"Public local chart"}</span><h2>{site.name}</h2><p>{site.description}</p>{site.npcs.length>0&&<p>People met here: {site.npcs.join(", ")}.</p>}
      <button type="button" disabled={busy||!site.available} onClick={()=>void travel(site.id)}>{site.current?"You are here":`Visit ${site.name}`}</button>
      {!site.current&&!site.available&&<small>Follow the connected public paths; the map does not permit remote travel.</small>}
      {atlas.reason&&<p role="status">{atlas.reason}</p>}
    </article><aside><span className="eyebrow">Local life · Optional help</span><p>{atlas.task}</p>{atlas.actions.length>0&&<div className="local-atlas-actions">{atlas.actions.map(action=><button type="button" key={action.id} disabled={busy||Boolean(atlas.reason)} onClick={()=>void act(action.text)}>{action.text}</button>)}</div>}<p>{atlas.returnHint}</p></aside></div>
  </section>;
}
