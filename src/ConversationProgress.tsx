import {useEffect,useState} from 'react';
import type {GameView} from './types';
const labels:Record<string,string>={understanding:'Understanding your message',knowledge:'Reading available knowledge',background:'Checking personal background',writing:'Writing the reply',checking:'Checking the reply',repairing:'Revising the reply once',thinking:'Working on your message'};
export function ConversationProgress({progress,active}:{progress:GameView['conversationProgress'];active:boolean}){
 const [started,setStarted]=useState(Date.now());
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!active)return;setStarted(Date.now());setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return ()=>window.clearInterval(timer);},[active]);
 if(!active)return null;
 const seconds=Math.max(0,Math.floor((now-(progress?.startedAt || started))/1000));
 return <p className="conversation-progress" role="status"><span>{labels[progress?.stage || 'thinking'] || labels.thinking}…</span> <span aria-hidden="true">{seconds}s{progress?' · up to '+Math.ceil(progress.budgetMs/1000)+'s total':''}</span></p>;
}
