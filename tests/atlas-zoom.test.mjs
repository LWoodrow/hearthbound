import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasZoomLimit} from '../shared/atlas-zoom.mjs';

test('bitmap zoom stops at available native detail instead of enlarging a crop blindly',()=>{
 assert.equal(atlasZoomLimit({sourceWidth:1536,viewportWidth:1280}),1);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:1280}),2.25);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:1280,pixelRatio:2}),1);
 assert.equal(atlasZoomLimit({sourceWidth:1536,viewportWidth:1280,cropScale:2.4}),1);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:320}),3);
});
test('zoom is safe before image load, for invalid dimensions and browser density changes',()=>{
 for(const sourceWidth of [0,NaN,Infinity,-10])assert.equal(atlasZoomLimit({sourceWidth,viewportWidth:1200}),1);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:0}),1);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:1024,pixelRatio:NaN}),3);
 assert.equal(atlasZoomLimit({sourceWidth:3072,viewportWidth:1024,pixelRatio:1.5}),2);
});
