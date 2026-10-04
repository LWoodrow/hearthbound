import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../src/styles.css",import.meta.url),"utf8");
const rule=selector=>{
  const start=css.indexOf(selector+" {");
  return start<0 ? "" : css.slice(start,css.indexOf("}",start)+1);
};
const luminance=hex=>{
  const channels=hex.match(/[a-f\d]{2}/gi).map(value=>parseInt(value,16)/255);
  return channels.map(value=>value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4)
    .reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
};
const contrast=(foreground,background)=>{
  const values=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};
const readable=selector=>{
  const style=rule(selector);
  const foreground=style.match(/(?:^|[;{])\s*color:(#[a-f\d]{6})/i)?.[1];
  const background=style.match(/(?:^|[;{])\s*background:(#[a-f\d]{6})/i)?.[1];
  assert.ok(foreground && background, "Explicit button colours: "+selector);
  assert.ok(contrast(foreground,background)>=4.5, "Readable text: "+selector);
};

test("library and every AI settings button share explicit readable themed styling",()=>{
  const selector=".library-ai-button, .ai-setup-page button";
  readable(selector);
  assert.match(rule(selector),/appearance:none/);
  assert.match(rule(selector),/min-height:44px/);
  assert.match(rule(selector),/border-radius:6px/);
  readable(".ai-setup-page button:disabled");
  assert.match(rule(".ai-setup-page button:disabled"),/opacity:1/);
  const primary=".ai-setup-actions button[type=submit]:not(:disabled)";
  readable(primary);
});

test("AI controls and download links have visible keyboard focus and no default blue links",()=>{
  assert.match(rule(".library-ai-button:focus-visible, .ai-setup-page button:focus-visible, .ai-setup-page a:focus-visible"),/outline:2px solid #e3bd71; outline-offset:4px/);
  assert.match(rule(".ai-setup-page a"),/color:#e3bd71/);
  assert.match(rule(".ai-setup-page a"),/text-decoration:underline/);
  assert.ok(contrast("#e3bd71","#242018")>=4.5);
});
