import { useEffect, useId, useRef, type ReactNode } from "react";

export function PortraitDialog({ name, subtitle, background, appearance, children, onClose }: {
  name:string; subtitle?:string; background:string; appearance?:string; children:ReactNode; onClose:()=>void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus({ preventScroll:true });
    };
  }, []);
  return <dialog ref={dialog} className="portrait-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header><div><span className="eyebrow">Character portrait</span><h2 id={titleId}>{name}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" autoFocus onClick={onClose} aria-label={`Close ${name}'s portrait`}>Close ×</button></header>
    <div className="portrait-dialog-content"><div className="portrait-enlargement">{children}</div><div className="portrait-biography"><h3>Background</h3><p>{background}</p>{appearance && <><h3>Appearance</h3><p>{appearance}</p></>}</div></div>
  </dialog>;
}
