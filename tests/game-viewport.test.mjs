import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

test('adventure context and action panels share the feed; composer stays outside it',()=>{
  const source=ts.createSourceFile('App.tsx',readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const elements=[];
  const visit=node=>{if(ts.isJsxElement(node))elements.push(node);ts.forEachChild(node,visit);};visit(source);
  const feed=elements.find(node=>node.openingElement.tagName.getText(source)==='StoryFeed');
  assert.ok(feed);
  const text=feed.getText(source);
  for(const panel of ['scene-heading','story-recap','scene-art','EventCard','aftermath-panel','LevelUpPanel','workshop-panel','combat-panel','pending-check'])assert.ok(text.includes(panel),`${panel} must remain reachable in the scroll region`);
  assert.ok(!text.includes('className="composer"'),'composer must not scroll out with conversation');
  assert.ok(feed.parent.getText(source).includes('className="composer"'));
  assert.match(readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8'),/import "\.\/game-viewport.css"/);
});

test('viewport containment is scoped to the game and leaves accessible scroll surfaces',()=>{
  const css=readFileSync(new URL('../src/game-viewport.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/(?:^|\n)(?:body|html|#root)\s*\{/);
  assert.match(css,/height:100dvh/);
  assert.match(css,/\.game-view \{[^}]*min-height:0[^}]*overflow:auto/s);
  assert.match(css,/\.game-view \.story-feed \{[^}]*min-height:0[^}]*max-height:none/s);
  assert.match(css,/@media \(pointer:coarse\)/);
  assert.match(css,/@media \(forced-colors:active\)/);
});

test('speaker cards share a transcript rail and readable prose is measured in its own font',()=>{
  const css=readFileSync(new URL('../src/game-viewport.css',import.meta.url),'utf8');
  assert.match(css,/\.game-view \.narration \{[^}]*width:100%; max-width:none/);
  assert.match(css,/\.game-view \.narration p \{ max-width:84ch;/);
  assert.match(css,/\.game-view \.player-event \{[^}]*width:100%; max-width:none; margin:12px 0;/);
});
