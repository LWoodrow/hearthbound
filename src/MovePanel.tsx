import type {GameView} from './types';

export function MovePanel({movement,selected,busy,onSelect}:{movement:GameView['movement'];selected:string|null;busy:boolean;onSelect:(id:string,text:string)=>void}) {
  return <section className="guidance-panel composer-guidance movement-panel" aria-label="Movement destinations">
    <div className="guidance-top"><div><span>Move · {movement.locationName || 'Current scene'}</span><small>Select a destination, then Send to travel. You can also type your own movement.</small></div></div>
    {movement.reason&&<p className="movement-status" role="status">{movement.reason}</p>}
    <div className="guidance-options movement-options">{movement.options.map(option=><button type="button" key={option.id} disabled={busy||Boolean(movement.reason)} aria-pressed={selected===option.id} onClick={()=>onSelect(option.id,option.text)}><strong>{option.label}</strong><small>{option.detail}</small></button>)}
      {!movement.options.length&&<p>No available destination is established here. Ask the DM about visible routes or finish the current interaction.</p>}
    </div>
  </section>;
}
