import { execFileSync } from "node:child_process";

function gitValue(cwd, args, run) {
  try {
    return String(run("git", args, { cwd, encoding:"utf8", windowsHide:true })).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export function readRunningBuildInfo({ cwd=process.cwd(), env=process.env, startedAt=new Date().toISOString(), run=execFileSync }={}) {
  return {
    branch:String(env.HEARTHBOUND_BUILD_BRANCH || gitValue(cwd,["branch","--show-current"],run)),
    commit:String(env.HEARTHBOUND_BUILD_COMMIT || gitValue(cwd,["rev-parse","--short","HEAD"],run)),
    startedAt,
  };
}
