import type {GameView} from './types';

export function NpcDialogueStatus({dialogue}:{dialogue:GameView['dialogue']}) {
 if(!dialogue)return null;
 const reply=dialogue.source==='ai-reviewed'?'AI reply · grounding checked':dialogue.source==='rules'?'Authored dialogue or social outcome':'Prepared reply · AI unavailable or reply not accepted';
 return <span className="model-empty">Latest NPC reply: {reply}{dialogue.interpretation&&<><br/>{dialogue.interpretation==='ai'?'Understanding: AI interpreted your conversation':'Understanding: fallback matching · AI interpretation unavailable or not accepted'}</>}</span>;
}
