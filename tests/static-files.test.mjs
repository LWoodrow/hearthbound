import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveStaticFile } from "../server/static-files.mjs";

test("static HTTP serves actual artwork, rejects missing assets and preserves SPA navigation", async () => {
  const root = mkdtempSync(join(tmpdir(), "hearthbound-static-"));
  mkdirSync(join(root,"art"));
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  writeFileSync(join(root,"art","portrait.png"),png);
  writeFileSync(join(root,"index.html"),"<html>application</html>");
  const server = createServer((request,response) => serveStaticFile(request,response,new URL(request.url,"http://localhost").pathname,root));
  await new Promise(done => server.listen(0,"127.0.0.1",done));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const valid = await fetch(base+"/art/portrait.png");
    assert.equal(valid.status,200);
    assert.equal(valid.headers.get("content-type"),"image/png");
    assert.deepEqual(Buffer.from(await valid.arrayBuffer()),png);
    const head = await fetch(base+"/art/portrait.png",{method:"HEAD"});
    assert.equal(head.headers.get("content-length"),"8");
    assert.equal((await head.arrayBuffer()).byteLength,0);
    for (const path of ["/art/missing.png","/assets/missing.js","/art/missing","/%2e%2e%2foutside.png"]) {
      const missing = await fetch(base+path);
      assert.equal(missing.status,404,path);
      assert.equal(await missing.text(),"Not found.");
    }
    for (const path of ["/","/library","/create-adventurer"]) {
      const page = await fetch(base+path);
      assert.equal(page.status,200);
      assert.match(page.headers.get("content-type"),/text\/html/);
    }
    assert.equal((await fetch(base+"/%ZZ")).status,400);
  } finally {
    await new Promise(done => server.close(done));
    rmSync(root,{recursive:true,force:true});
  }
});
