import test from "node:test";
import assert from "node:assert/strict";
import { readRunningBuildInfo } from "../server/build-info.mjs";

test("running build information reports the exact branch, commit, and service start", () => {
  const calls=[];
  const run=(_command,args)=>{
    calls.push(args.join(" "));
    return args.includes("--show-current") ? "main\n" : "f6debc7\n";
  };
  assert.deepEqual(readRunningBuildInfo({cwd:"C:/repo",env:{},startedAt:"2026-08-29T10:00:00.000Z",run}),{
    branch:"main",commit:"f6debc7",startedAt:"2026-08-29T10:00:00.000Z",
  });
  assert.deepEqual(calls,["branch --show-current","rev-parse --short HEAD"]);
});

test("explicit build metadata supports packaged services without Git", () => {
  const build=readRunningBuildInfo({env:{HEARTHBOUND_BUILD_BRANCH:"main",HEARTHBOUND_BUILD_COMMIT:"abc1234"},startedAt:"now",run:()=>{throw new Error("git unavailable");}});
  assert.deepEqual(build,{branch:"main",commit:"abc1234",startedAt:"now"});
});
