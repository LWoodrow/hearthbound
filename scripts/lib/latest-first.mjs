// Evaluation only. No production import, settings writes, judge or retry chain.
import {calibratedLatestRouteRequest,validLatestRoute} from './latest-turn-router.mjs';
import {threadFirstRequest} from './thread-first.mjs';

export async function latestFirstRequest(request,infer){
 if(request.kind!=='npc-dialogue')throw Object.assign(Error('No automatic repair chain.'),{code:'invalid-output'});
 const input=JSON.parse(request.messages.at(-1).content);
 const result=await infer(calibratedLatestRouteRequest(input.newestPlayerSpeech));
 const output=result.output || result;
 if(!validLatestRoute(output))throw Object.assign(Error('Invalid latest-turn classification.'),{code:'invalid-output'});
 return threadFirstRequest(request,infer,{isolate:true,latestRoute:output.route});
}
