// Optional browser geometry check using an externally installed Playwright module.
// PLAYWRIGHT_MODULE must name its entry point; no app server or real saves are used.
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

if(!process.env.PLAYWRIGHT_MODULE)throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright entry point.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'msedge',headless:true});
const css=['styles.css','game-viewport.css'].map(name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8')).join('\n');
// Representative game chrome and overflow-heavy content exercise the actual production CSS.
const fixture=(tab,expanded)=>`<main class="game-shell solo-party">
  <header class="topbar"><div class="campaign-identity"><span><strong>The Roads of Eldervale</strong><small>Hearthbound · Eldervale</small></span></div><div class="topbar-center"><nav class="view-tabs"><button>Adventure</button><button>Character sheet</button><button>Known map</button></nav></div><div class="top-actions"><button>Library</button></div></header>
  <section class="party-strip"><div>Nigel · 12/12 HP</div><div>Cotton</div></section>
  <div class="game-view game-view-${tab}">${tab==='adventure'?`<div class="game-grid"><section class="story-panel"><div class="story-feed" tabindex="0"><div class="scene-heading"><h1>Returners’ Wall</h1></div><details class="story-recap" open><summary>Recap</summary><p>${'Recorded outcomes. '.repeat(100)}</p></details>${Array.from({length:40},()=>'<article class="narration"><p>A traveller stops to speak with the company beside the returners’ wall.</p></article>').join('')}<section class="combat-panel"><h2>Combat controls</h2><button>Roll d20</button></section><section class="level-up-panel"><h2>Choose your level</h2><button>Complete level</button></section></div><div class="composer"><div class="composer-toolbar"><div class="composer-left"><div class="mode-tabs"><button>Act</button><button>Move</button><button>Speak</button><button>Help / Ask DM</button></div><button class="mic">Hold to talk</button></div><div class="composer-right"><button>Send</button></div></div>${expanded?'<div class="guidance-panel composer-guidance"><div class="movement-options">'+Array.from({length:30},()=>'<button>Walk to a nearby public place</button>').join('')+'</div></div>':''}<textarea aria-label="Message" placeholder="What do you say?"></textarea></div></section></div>`:'<div style="height:3000px">Map or character content <button style="margin-top:2900px">Bottom control</button></div>'}</div></main>`;
try {
  for(const [width,height,touch] of [[1920,1080,false],[1366,768,false],[1024,600,false],[960,540,false],[1024,768,true],[768,1024,true],[390,844,true],[390,460,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch});const page=await context.newPage();
    for(const tab of ['adventure','map','character'])for(const expanded of tab==='adventure'?[false,true]:[false]){
      await page.setContent(`<style>${css}</style>${fixture(tab,expanded)}`);
      if(tab==='adventure')await page.locator('.story-feed').evaluate(feed=>{
        feed.insertAdjacentHTML('beforeend','<article class="player-event"><p>A player asks about the city.</p></article><article class="narration"><p>'+ 'The keeper describes the busy streets and returning travellers. '.repeat(15)+'</p></article>');
      });
      const geometry=await page.evaluate(()=>{
        const surface=document.querySelector('.story-feed')||document.querySelector('.game-view');
        const composer=document.querySelector('.composer');
        surface.scrollTop=surface.scrollHeight;
        const rect=composer?.getBoundingClientRect();
        const npc=document.querySelector('.narration:last-child'),player=document.querySelector('.player-event');
        let alignment=null;
        if(npc&&player){
          const p=npc.querySelector('p'),bounds=p.getBoundingClientRect(),style=getComputedStyle(npc),range=document.createRange();range.selectNodeContents(p);
          const lines=[...range.getClientRects()];
          alignment={npc:npc.getBoundingClientRect().left,player:player.getBoundingClientRect().left,npcText:bounds.left,playerText:player.querySelector('p').getBoundingClientRect().left,proseWidth:bounds.width,contentWidth:npc.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),wrappedLines:lines.length,rightGap:bounds.right-Math.max(...lines.map(line=>line.right))};
        }
        return {alignment,outerHeight:document.documentElement.scrollHeight,outerWidth:document.documentElement.scrollWidth,
          height:innerHeight,width:innerWidth,scroll:surface.scrollTop,composer:rect&&{top:rect.top,bottom:rect.bottom,width:rect.width},feed:surface.clientHeight};
      });
      const label=`${width}x${height} ${tab} expanded=${expanded}`;
      assert.ok(geometry.outerHeight<=height+1,`${label}: outer vertical overflow ${JSON.stringify(geometry)}`);
      assert.ok(geometry.outerWidth<=width+1,`${label}: outer horizontal overflow`);
      assert.ok(geometry.scroll>0,`${label}: content must remain scrollable`);
      if(tab==='adventure'){
        assert.ok(Math.abs(geometry.alignment.npc-geometry.alignment.player)<2,`${label}: speaker cards must share a left rail`);
        assert.ok(Math.abs(geometry.alignment.npcText-geometry.alignment.playerText)<2,`${label}: paragraph starts must align`);
        assert.ok(Math.abs(geometry.alignment.proseWidth-geometry.alignment.contentWidth)<2,`${label}: paragraph must fill the message content width`);
        assert.ok(geometry.alignment.wrappedLines>1,`${label}: long prose must wrap`);
        assert.ok(geometry.alignment.rightGap<80,`${label}: wrapped text must approach the right edge without a hidden text-width cap`);
        assert.ok(geometry.feed>=70,`${label}: feed must retain useful height`);
        assert.ok(geometry.composer.top>=0&&geometry.composer.bottom<=height+1,`${label}: composer must stay visible`);
        if(width>=1366)assert.ok(geometry.composer.width>width*.65,`${label}: use more desktop width`);
      }
      console.log(`PASS ${label}`);
    }
    await context.close();
  }
} finally {await browser.close();}
