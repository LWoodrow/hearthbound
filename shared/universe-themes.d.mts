export type UniverseId = "hearthbound" | "supernatural" | "mystery" | "gothic" | "cosmic" | "espionage";
export type UniverseAvailability = "playable" | "planned";
export type UniverseTerms = {
  library:string; campaign:string; campaigns:string; content:string; contents:string;
  character:string; characters:string; characterSheet:string; map:string;
  party:string; parties:string; journal:string; play:string;
};
export type UniverseTheme = {
  id:UniverseId; displayName:string; wordmark:string; icon:string; art:string; artAlt:string; genre:string;
  availability:UniverseAvailability; tagline:string; description:string;
  palette:Record<"ink"|"panel"|"panelRaised"|"accent"|"accentBright"|"text"|"muted"|"line"|"danger",string>;
  typography:{ heading:string; body:string }; texture:string; motifs:string[];
  mapTreatment:string; sceneArtStyle:string; narrationMood:string; audioMood:string;
  terms:UniverseTerms;
};
export const THEME_PACKAGE_VERSION:number;
export const UNIVERSE_THEMES:Readonly<Record<UniverseId,Readonly<UniverseTheme>>>;
export const UNIVERSE_IDS:ReadonlyArray<UniverseId>;
export function universeTheme(id:string):Readonly<UniverseTheme>;
export function universeIdForWorld(world:{id?:string;universeId?:string}):UniverseId;
