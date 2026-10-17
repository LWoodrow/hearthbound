import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createFeedFollower} from '../shared/feed-follow.mjs';

export function StoryFeed({latestId,children}:{latestId:number;children:ReactNode}){
 const feed=useRef<HTMLDivElement>(null);
 const follower=useRef(createFeedFollower());
 const [unseen,setUnseen]=useState(false);
 const jump=()=>{follower.current.jump();setUnseen(false);if(feed.current)feed.current.scrollTop=feed.current.scrollHeight;};
 useLayoutEffect(()=>{
  const next=follower.current.receive(latestId);setUnseen(next.unseen);
  // Scroll ONLY this pane: scrollIntoView also moves outer page ancestors.
  if(next.scroll&&feed.current)feed.current.scrollTop=feed.current.scrollHeight;
 },[latestId]);
 return <><div ref={feed} className="story-feed" role="log" tabIndex={0} aria-label="Adventure conversation" aria-live="polite" onScroll={event=>setUnseen(follower.current.scroll(event.currentTarget))}>{children}</div>
  {unseen&&<div className="story-feed-latest"><button type="button" onClick={jump}>New messages · Jump to latest ↓</button></div>}</>;
}
