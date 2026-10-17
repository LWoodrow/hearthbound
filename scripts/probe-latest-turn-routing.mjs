import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {currentModelProfile} from '../server/model-runtime.mjs';
import {generateStructured} from '../server/ai-transport.mjs';
import {latestRouteRequest,calibratedLatestRouteRequest,validLatestRoute,latestActRequest,validLatestActs,resolvedLatestRoute} from './lib/latest-turn-router.mjs';

export const routingCases=[
 {speech:'hi nima',expected:['greeting']},
 {speech:'Hello there!',expected:['greeting']},
 {speech:'Good to see you. Where can I sleep?',expected:['ordinary']},
 {speech:'Enough stories. Where can I get food nearby?',expected:['ordinary']},
 {speech:'Leave the story there. What should I read before descending?',expected:['ordinary']},
 {speech:'Tell me a story.',expected:['new-fiction']},
 {speech:'I would like a funny tale about a lost boot.',expected:['new-fiction']},
 {speech:'the brass please',expected:['continuation']},
 {speech:'tell away',expected:['continuation']},
 {speech:'Your choice.',expected:['continuation']},
 {speech:'Grand sweep.',expected:['continuation']},
 {speech:'Make the ending funnier.',expected:['continuation']},
 {speech:'Did that really happen to you and Maren?',expected:['ordinary']},
 {speech:'Was that a real expedition you went on?',expected:['ordinary']},
 {speech:'Say that again, please.',expected:['repeat']},
 {speech:'No thanks, let us stop there.',expected:['end']},
 {speech:'Hi! Could you tell an imaginary story with a happy ending?',expected:['new-fiction']},
 {speech:'No more tales. Are you doing all right?',expected:['ordinary']},
];
export const heldOutCases=[
 {speech:'Evening! Does anybody sell bread nearby?',expected:['ordinary']},
 {speech:'Put that yarn aside; do you know a quiet inn?',expected:['ordinary']},
 {speech:'Actually, I need directions to the rope shop.',expected:['ordinary']},
 {speech:'Go on then.',expected:['continuation']},
 {speech:'Make it tragic instead.',expected:['continuation']},
 {speech:'Were you really there?',expected:['ordinary']},
 {speech:'How about a made-up ghost story?',expected:['new-fiction']},
 {speech:'That is enough for me today.',expected:['end']},
];
export async function probeLatestRoutes({profile,generate=generateStructured,cases=routingCases,decompose=false,calibrated=false,emit=console.log}){
 const turns=[];
 for(const item of cases){const request=(decompose?latestActRequest:calibrated?calibratedLatestRouteRequest:latestRouteRequest)(item.speech),start=Date.now();let output,error;
  try{output=await generate(profile,request.messages,request.schema,request.generation);}catch(caught){error=caught.message;}
  const valid=decompose?validLatestActs(output,item.speech):validLatestRoute(output),route=valid?(decompose?resolvedLatestRoute(output,item.speech):output.route):null;
  const result={...item,output,route,elapsedMs:Date.now()-start,valid,matched:valid&&item.expected.includes(route),...(error?{error}:{})};turns.push(result);emit(result);
 }
 const summary={model:profile.displayName,variant:decompose?'acts':calibrated?'calibrated':'route-only',cases:turns.length,matched:turns.filter(turn=>turn.matched).length,valid:turns.filter(turn=>turn.valid).length,maxMs:Math.max(0,...turns.map(turn=>turn.elapsedMs)),medianMs:turns.map(turn=>turn.elapsedMs).sort((a,b)=>a-b)[Math.floor(turns.length/2)]};
 emit(summary);return {turns,summary};
}
async function main(){
 if(!process.argv.includes('--live'))throw Error('Use --live for a no-save inference-only router probe.');
 const result=await probeLatestRoutes({profile:currentModelProfile(),cases:process.argv.includes('--held-out')?heldOutCases:routingCases,decompose:process.argv.includes('--decompose'),calibrated:process.argv.includes('--calibrated'),emit:value=>console.log(JSON.stringify(value))});
 const target=process.argv.find(arg=>arg.startsWith('--report='))?.slice(9);
 if(target){const path=resolve(target);if(!path.endsWith('.json'))throw Error('Report must end in .json');mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({report:path}));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
