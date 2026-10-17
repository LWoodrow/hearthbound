// Authored knowledge domains, not keyword guesses about the player's speech.
export const practicalDomains=Object.freeze(['place','opening-hours','menu','price','availability','service']);
export function practicalKnowledgeCoverage(entries){
 const known=entries.filter(entry=>practicalDomains.includes(entry.domain)).map(({id,domain,text})=>({sourceId:id,domain,fact:text}));
 return {known,notRecorded:practicalDomains.filter(domain=>!known.some(entry=>entry.domain===domain)),
  authority:'Current eligible authored sources only. Not recorded means unknown, not unavailable or nonexistent. A venue name or recommendation supplies no menu, hours, prices, vacancy or first-hand experience.'};
}
