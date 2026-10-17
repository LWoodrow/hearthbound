import type {GameView} from './types';
const failures:Record<string,string>={
 'conversation-time-limit':'90-second conversation limit reached',
 'stage-timeout':'AI stage timed out',
 'conversation-call-limit':'Processing limit reached',
 'repair-budget':'Stopped before another full revision could be checked',
 'invalid-candidate':'Reply format or source check failed',
 'invalid-review':'AI review format was invalid',
 'claim-review-not-accepted':'Reply did not pass review',
 'answer-plan-invalid':'Background assessment was invalid',
 'transport-unavailable':'AI connection unavailable',
 'assessment-unavailable':'AI review unavailable',
 'invalid-output':'AI returned unreadable output',
};

export function NpcDialogueStatus({dialogue}:{dialogue:GameView['dialogue']}) {
 if(!dialogue)return null;
 const reply=dialogue.unavailable?'Reply not published · '+(failures[dialogue.failureKind || dialogue.reason] || 'AI checks could not be completed'):dialogue.source==='ai-reviewed'?'AI reply · grounding and relevance checked':dialogue.source==='rules'?'Authored dialogue or social outcome':'Prepared reply · AI unavailable or reply not accepted';
 return <span className="model-empty">Latest NPC reply: {reply}{dialogue.interpretation&&<><br/>{dialogue.interpretation==='ai'?'Understanding: AI interpreted your conversation':'Understanding: fallback matching · AI interpretation unavailable or not accepted'}</>}{dialogue.inputTool&&<><br/>{dialogue.inputTool==='respond_social'?'Social conversation · no knowledge lookup':dialogue.inputTool==='read_knowledge'?'Current knowledge requested':dialogue.inputTool==='consider_social_goal'?'Authored social goal requested':dialogue.inputTool==='clarify'?'Clarifying the conversation':'Input assessment unavailable'}</>}{dialogue.repaired&&<><br/>{dialogue.unavailable?'One revision was attempted':'AI repaired the reply before publication'}</>}{Boolean(dialogue.lookupCount)&&<><br/>Requested missing knowledge during review</>}{dialogue.answerKnowledge&&<><br/>Personal background: {dialogue.answerKnowledge==='supported'?'available':dialogue.answerKnowledge==='partial'?'partly available':'firsthand answer not established'}</>}{Boolean(dialogue.claimCount)&&<><br/>{dialogue.claimCount} source receipts recorded by AI review</>}{dialogue.elapsedMs!==undefined&&<><br/>{Math.round(dialogue.elapsedMs/1000)}s · {dialogue.calls || 0} AI calls</>}</span>;
}
