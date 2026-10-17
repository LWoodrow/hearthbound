const running=new Map();
const stageNames={
 'npc-conversation-input':'understanding',
 'npc-conversation-interpretation':'knowledge',
 'npc-answer-plan':'background',
 'npc-natural-performance':'writing',
 'npc-natural-repair':'repairing',
 'npc-claim-review':'checking',
 'npc-natural-review':'checking',
};
const key=(partyId,playerId)=>JSON.stringify([partyId,playerId]);
export function conversationFailureMessage(reason){
 const unchanged=' Nothing in the scene has changed.';
 if(['conversation-time-limit','stage-timeout','assessment-timeout'].includes(reason))return 'The AI took too long to finish this reply, so the conversation stopped.'+unchanged;
 if(reason==='conversation-call-limit'||reason==='repair-budget')return 'This reply reached its processing limit and was stopped.'+unchanged;
 if(reason==='transport-unavailable')return 'The AI connection is unavailable. Check AI connection or load your model.'+unchanged;
 if(reason==='invalid-output'||reason==='assessment-output-invalid')return 'The AI returned an unreadable answer.'+unchanged;
 if(reason==='invalid-review')return 'The AI could not complete a valid reply check.'+unchanged;
 if(reason==='answer-plan-invalid')return 'The AI could not check this character’s background.'+unchanged;
 return 'The AI reply did not pass its checks, so it was not shown.'+unchanged;
}
export function conversationProgress(partyId,playerId){
 const current=running.get(key(partyId,playerId));
 if(!current)return null;
 const {id,...publicProgress}=current;
 return {...publicProgress,elapsedMs:Math.max(0,Date.now()-current.startedAt)};
}
export function createConversationSession({partyId,playerId,budgetMs=90000,maxCalls=5,now=Date.now,publish=true}={}){
 const startedAt=now(),id=Symbol('conversation'),stages=[];
 let calls=0,closed=false,failure='';
 const progressKey=key(partyId,playerId);
 const snapshot=()=>({elapsedMs:Math.max(0,now()-startedAt),calls,budgetMs,failure,stages:stages.map(stage=>({...stage}))});
 const error=(code)=>Object.assign(new Error(code==='conversation-time-limit'?'Conversation time limit reached.':'Conversation call limit reached.'),{code});
 const mark=(stage)=>{
  if(!publish||closed)return;
  running.set(progressKey,{id,stage:stageNames[stage.kind] || 'thinking',startedAt,budgetMs,calls});
 };
 return {
  snapshot,
  canRun(count=1,minMs=1){return !closed&&!failure&&calls+count<=maxCalls&&budgetMs-(now()-startedAt)>=minMs;},
  async generate(request,transport){
   if(failure)throw Object.assign(new Error('The conversation AI stage has already failed.'),{code:failure});
   const remaining=budgetMs-(now()-startedAt);
   if(closed||remaining<=0){failure='conversation-time-limit';throw error(failure);}
   if(calls>=maxCalls){failure='conversation-call-limit';throw error(failure);}
   const timeoutMs=Math.max(1,Math.min(remaining,request.generation?.timeoutMs || remaining));
   const stage={kind:request.kind,startedMs:now()-startedAt,status:'running'};stages.push(stage);calls++;mark(stage);
   const controller=new AbortController();let timer;
   const timedOut=new Promise((_,reject)=>{timer=setTimeout(()=>{
    failure=remaining<=timeoutMs?'conversation-time-limit':'stage-timeout';
    controller.abort();reject(Object.assign(new Error('Conversation AI response timed out.'),{code:failure}));
   },timeoutMs);});
   try{
    const result=await Promise.race([Promise.resolve().then(()=>transport({...request,generation:{...request.generation,timeoutMs,signal:controller.signal}})),timedOut]);
    if(now()-startedAt>=budgetMs){failure='conversation-time-limit';throw error(failure);}
    stage.status='completed';return result;
   }catch(cause){stage.status='failed';stage.failure=failure || (/timeout|timed out/i.test(cause.message || '')?'stage-timeout':cause instanceof SyntaxError?'invalid-output':'transport-unavailable');failure=stage.failure;throw cause;}
   finally{clearTimeout(timer);stage.elapsedMs=Math.max(0,now()-startedAt-stage.startedMs);}
  },
  close(){closed=true;if(running.get(progressKey)?.id===id)running.delete(progressKey);return snapshot();},
 };
}
