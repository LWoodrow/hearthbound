export declare const NPC_PORTRAIT_INDEX: Readonly<Record<string, number>>;
export declare const NPC_PORTRAIT_FILES: Readonly<Record<string,string>>;
export declare const NPC_PORTRAIT_CROPS: Readonly<Record<string, {sourceId:string; file:string; size:string; position:string; species:string; gender:string}>>;
export declare function npcPortraitStyle(id:string): {backgroundImage:string; backgroundSize:string; backgroundPosition:string} | undefined;
export declare function visibleNpcPortraits(definition: unknown, events?: Array<{ speaker:string }>): Record<string,string>;
