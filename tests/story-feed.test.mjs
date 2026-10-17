import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {createFeedFollower} from '../shared/feed-follow.mjs';

test('feed follows only new event IDs, not repeated polling or voice-setting rerenders',()=>{
 const feed=createFeedFollower();assert.equal(feed.receive(10).scroll,true);
 assert.equal(feed.receive(10).scroll,false);assert.equal(feed.receive(11).scroll,true);
 feed.scroll({scrollTop:40,scrollHeight:1000,clientHeight:300});
 assert.deepEqual(feed.receive(12),{scroll:false,unseen:true});
 assert.deepEqual(feed.receive(12),{scroll:false,unseen:true});
 feed.jump();assert.equal(feed.receive(13).scroll,true);
});

test('manually returning near the bottom resumes following and a story reset clears unread state',()=>{
 const feed=createFeedFollower();feed.receive(50);feed.scroll({scrollTop:0,scrollHeight:1000,clientHeight:300});
 assert.equal(feed.receive(51).unseen,true);
 assert.equal(feed.scroll({scrollTop:690,scrollHeight:1000,clientHeight:300}),false);
 assert.equal(feed.receive(52).scroll,true);
 feed.scroll({scrollTop:0,scrollHeight:1000,clientHeight:300});feed.receive(53);
 assert.deepEqual(feed.receive(0),{scroll:true,unseen:false});
});

test('actual feed component leaves a reader alone on polls/new arrivals and Jump moves only the pane',()=>{
 const slots=[],effects=[];let cursor=0,writes=0,top=0;
 const react={
  useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index];},
  useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=value;}];},
  useLayoutEffect(effect,deps){const index=cursor++,old=slots[index];if(!old||deps.some((value,i)=>value!==old[i])){slots[index]=deps;effects.push(effect);}},
 };
 const require=createRequire(import.meta.url),exports={};
 const source=readFileSync(new URL('../src/StoryFeed.tsx',import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:require(name)});
 const element={scrollHeight:1000,clientHeight:300,get scrollTop(){return top;},set scrollTop(value){top=Math.min(700,value);writes++;}};
 const render=id=>{cursor=0;const tree=exports.StoryFeed({latestId:id,children:'Chat'}),[pane]=tree.props.children;pane.props.ref.current=element;while(effects.length)effects.shift()();return tree;};
 let tree=render(10);assert.equal(top,700);assert.equal(writes,1);assert.equal(tree.props.children[0].props.tabIndex,0);
 render(10);assert.equal(writes,1,'same IDs must not scroll');
 top=40;tree.props.children[0].props.onScroll({currentTarget:element});
 render(11);tree=render(11);assert.equal(top,40);assert.equal(writes,1);
 const latest=tree.props.children[1].props.children;assert.match(latest.props.children,/Jump to latest/);
 latest.props.onClick();assert.equal(top,700);assert.equal(writes,2);
 render(12);assert.equal(writes,3);
 assert.doesNotMatch(source,/\.scrollIntoView\s*\(/,'the component must not move outer ancestors');
});
