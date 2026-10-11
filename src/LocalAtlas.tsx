import {useEffect,useRef,useState} from "react";
import type {LocalAtlasData} from "./types";
import {atlasZoomLimit} from "../shared/atlas-zoom.mjs";

// A shared illustrated settlement view. Every marker/route comes from the
// server's current canonical projection, never from image recognition.
export function LocalAtlas({atlas,busy,travel,act}:{atlas:LocalAtlasData;busy:boolean;travel:(id:string)=>Promise<void>;act:(text:string)=>Promise<void>}) {
  const current=atlas.sites.find(place=>place.current)?.id||atlas.sites[0].id;
  const [selected,setSelected]=useState(current);
  const [zoom,setZoom]=useState(1);
  const [sourceWidth,setSourceWidth]=useState(0);
  const [viewportWidth,setViewportWidth]=useState(0);
  const [pixelRatio,setPixelRatio]=useState(1);
  const viewport=useRef<HTMLDivElement>(null);
  const source=useRef<HTMLImageElement>(null);
  const maxZoom=atlas.schematic?3:atlasZoomLimit({sourceWidth,viewportWidth,pixelRatio,cropScale:atlas.imageViewport?.scale||1});
  useEffect(()=>{setZoom(1);setSourceWidth(source.current?.complete?source.current.naturalWidth:0);},[atlas.id,atlas.image]);
  useEffect(()=>{
    const element=viewport.current;
    if(!element) return;
    const measure=()=>{const plate=element.firstElementChild;const minimum=plate?parseFloat(window.getComputedStyle(plate).minWidth)||0:0;setViewportWidth(Math.max(element.clientWidth,minimum));setPixelRatio(window.devicePixelRatio||1);};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    window.addEventListener("resize",measure);
    return ()=>{observer.disconnect();window.removeEventListener("resize",measure);};
  },[]);
  useEffect(()=>setZoom(value=>Math.min(value,maxZoom)),[maxZoom]);
  useEffect(()=>setSelected(current),[current,atlas.id]);
  const site=atlas.sites.find(place=>place.id===selected)||atlas.sites.find(place=>place.current)||atlas.sites[0];
  const gateways=atlas.sites.filter(place=>place.kind==='district-exit');
  return <section className="world-atlas local-atlas">
    <header><div><span className="eyebrow">Local atlas · Public paths and discovered places</span><h1>{atlas.title}</h1><p>{atlas.introduction}</p></div><div className="atlas-zoom" aria-label="Local map zoom"><button type="button" disabled={zoom<=1} onClick={()=>setZoom(value=>Math.max(1,value-.5))} aria-label="Zoom local map out">−</button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" disabled={zoom>=maxZoom} title={zoom>=maxZoom?"Full available image detail at this screen size":"Zoom within the image’s available detail"} onClick={()=>setZoom(value=>Math.min(maxZoom,value+.5))} aria-label="Zoom local map in">+</button></div></header>
    {!atlas.schematic&&sourceWidth>0&&zoom>=maxZoom&&<p className="atlas-detail-limit" role="status">Full available image detail at this screen size. Further enlargement would soften the artwork.</p>}
    <div className="illustrated-atlas-scroll" ref={viewport}><div className="illustrated-atlas-plate" style={{width:`${zoom*100}%`}}>
      {atlas.schematic?<div className="city-survey-background" role="img" aria-label={atlas.imageAlt}/>:atlas.imageViewport?<><img key={atlas.image} ref={source} src={atlas.image} alt="" aria-hidden="true" hidden onLoad={event=>setSourceWidth(event.currentTarget.naturalWidth)}/><div className="city-district-art" role="img" aria-label={atlas.imageAlt} style={{backgroundImage:`url(${atlas.image})`,backgroundSize:`${atlas.imageViewport.scale*100}%`,backgroundPosition:`${atlas.imageViewport.x}% ${atlas.imageViewport.y}%`}}/></>:<img key={atlas.image} ref={source} src={atlas.image} alt={atlas.imageAlt} onLoad={event=>setSourceWidth(event.currentTarget.naturalWidth)}/>}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="illustrated-atlas-roads" aria-hidden="true">{atlas.routes.map(route=>{
        const from=atlas.sites.find(place=>place.id===route.from),to=atlas.sites.find(place=>place.id===route.to);
        const points=route.points||[[from?.x,from?.y],[to?.x,to?.y]];
        return from&&to?<path key={route.from+route.to} className={route.travelled?"travelled":""} d={points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')}/>:null;
      })}</svg>
      {atlas.sites.map(place=><button type="button" key={place.id} className={`atlas-destination ${place.labelSide==='left'||(!place.labelSide&&place.x>=72)?"label-left":""} ${place.current?"current":""} ${place.visited?"visited":""} ${site.id===place.id?"selected":""} ${place.kind==='district-exit'?"district-exit":""} ${place.beyondView?"edge-destination":""}`} style={{left:`${place.x}%`,top:`${place.y}%`}} onClick={()=>setSelected(place.id)} aria-pressed={site.id===place.id} aria-label={`${place.name}${place.kind==='district-exit'?", district exit":place.beyondView?", beyond this view":""}${place.current?", current location":place.visited?", visited":", charted"}`}><span aria-hidden="true">{place.kind==='district-exit'?"→":place.beyondView?"↓":"•"}</span><strong>{place.name}{place.kind==='district-exit'?" · Exit":place.beyondView?" · Beyond view":""}</strong></button>)}
    </div></div>
    {gateways.length>0&&<nav className="atlas-district-exits" aria-label="Neighbouring district exits"><span>District exits · Select an arrow to see its route</span>{gateways.map(place=><button type="button" key={place.id} onClick={()=>setSelected(place.id)} aria-pressed={site.id===place.id}>→ {place.name}</button>)}</nav>}
    <label className="atlas-place-picker">Choose a local place<select value={site.id} onChange={event=>setSelected(event.target.value)}>{atlas.sites.map(place=><option key={place.id} value={place.id}>{place.name}{place.current?" · You are here":place.visited?" · Visited":""}</option>)}</select></label>
    <div className="atlas-exploration-panel"><article><span className="eyebrow">{site.current?"You are here":site.visited?"Visited":"Public local chart"}</span><h2>{site.name}</h2><p>{site.description}</p>{site.npcs.length>0&&<p>People met here: {site.npcs.join(", ")}.</p>}
      <button type="button" disabled={busy||!site.available} onClick={()=>void travel(site.id)}>{site.current?"You are here":`Visit ${site.name}`}</button>
      {!site.current&&!site.available&&<small>{site.kind==='district-exit'?`Return to the ${atlas.title} junction to take this district exit.`:"Follow the connected public paths; the map does not permit remote travel."}</small>}
      {site.kind==='district-exit'&&!site.available&&atlas.sites.some(place=>place.id===atlas.id)&&<button type="button" onClick={()=>setSelected(atlas.id)}>Show district junction</button>}
      {atlas.reason&&<p role="status">{atlas.reason}</p>}
    </article><aside><span className="eyebrow">Local life · Optional help</span><p>{atlas.task}</p>{atlas.actions.length>0&&<div className="local-atlas-actions">{atlas.actions.map(action=><button type="button" key={action.id} disabled={busy||Boolean(atlas.reason)} onClick={()=>void act(action.text)}>{action.text}</button>)}</div>}<p>{atlas.returnHint}</p></aside></div>
  </section>;
}
