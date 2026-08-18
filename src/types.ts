export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  status: "equipped" | "carried" | "stored";
  notes: string;
  origin: "starting" | "adventure";
  sourceAdventureId: string | null;
};

export type Player = {
  id: string;
  worldId: string;
  partyId: string;
  name: string;
  avatarId?: string;
  fullName?: string;
  isCompanion?: boolean;
  divine?: boolean;
  className: string;
  species: string;
  background: string;
  alignment: string;
  abilities: Record<string, number>;
  skills: string[];
  expertise: string[];
  subclass: string;
  classFeatures: Array<{ level:number; name:string; automated:boolean }>;
  equipmentChoice: string;
  backstory: string;
  appearance: string;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  armorClass: number;
  spellcasting: null | {
    ability: string;
    cantrips: string[];
    prepared: string[];
    spellbook: string[];
    slots: Record<string, { current: number; max: number }>;
    pactMagic?: boolean;
    invocations?: string[];
    metamagic?: string[];
    sorceryPoints?: { current: number; max: number };
  };
  inventory: InventoryItem[];
};

export type Adventure = {
  id: string;
  worldId: string;
  title: string;
  synopsis: string;
  minLevel: number;
  maxLevel: number;
  milestoneLevel: number;
  chapter: string;
  scene: string;
  seriesId?: string | null;
  seriesTitle?: string | null;
  episodeNumber?: number | null;
  seriesHook?: string | null;
};

export type Party = {
  id: string;
  worldId: string;
  name: string;
  activeAdventureId: string | null;
  averageLevel: number;
  characters: Player[];
};

export type World = {
  id: string;
  name: string;
  description: string;
  series?: { id: string; title: string; premise: string; episodeCount: number };
  parties: Party[];
  adventures: Adventure[];
};

export type LobbyData = { worlds: World[] };

export type StoryEvent = {
  id: number;
  visibility: "public" | "player";
  playerId: string | null;
  kind: "narration" | "action" | "roll" | "system";
  speaker: string;
  text: string;
  payload?: { authoritativeFacts?: string[]; [key:string]: unknown };
  createdAt: string;
};

export type KnownLocation = {
  id: string;
  name: string;
  summary: string;
  firstSeen: string;
  map?: { key:string; x:number; y:number; w:number; h:number; label:string; kind:string; connectsTo:string[]; height:number };
};

export type GameView = {
  world: { id: string; name: string };
  group: { id: string; name: string };
  campaign: { title: string; chapter: string; scene: string; minLevel: number; maxLevel: number };
  player: Player;
  party: Player[];
  events: StoryEvent[];
  recap: {
    version:number; title:string; currentLocation:string; visibleFeatures:string[]; establishedFacts:string[];
    recentActions:string[]; recentRolls:string[]; campaignUpdates:string[]; carriedItems:string[];
    knownLocations:Array<{name:string;summary:string}>; pendingCheck:string;
  };
  playtest:null | {
    version:number; adventureId:string; completed:number; total:number; currentLocation:string; clueStage:number;
    pendingCheck:string; nextGate:string; gates:Array<{id:string;label:string;passed:boolean}>;
    recent:Array<{kind:string;speaker:string;text:string}>;
    turnTraces:Array<Record<string, unknown>>;
  };
  knownLocations: KnownLocation[];
  spotlight: { playerId: string | null; name: string; position: number; total: number };
  pendingCheck: null | { ability: string; skill: string; modifier: number; dc: number; reason: string };
  combat: null | {
    active: boolean;
    encounterId: string;
    round: number;
    outcome: "victory" | "defeat" | null;
    turn: null | { id: string; name: string; type: "player" | "enemy" | "companion"; isYou: boolean };
    order: Array<{ id: string; name: string; type: "player" | "enemy" | "companion"; initiative: number; current: boolean }>;
    enemies: Array<{ id: string; name: string; status: string; defeated: boolean }>;
    pendingRoll: null | { kind: "attack" | "damage" | "healing"; weaponName?: string; attackBonus?: number; diceCount?: number; dieSides?: number; modifier?: number };
    attacks: Array<{ name: string; attackBonus: number; damage: string }>;
    spells: Array<{ name: string; level: number; attackBonus: number | null; damage: string; available: boolean; castsRemaining:number|null; castsMaximum:number|null }>;
    potionCount: number;
    canUsePotion: boolean;
    canAct: boolean;
  };
  workshop: null | {
    active: boolean;
    opponents: Array<{ id: string; label: string; summary: string }>;
    checklist: string[];
  };
  levelUp: null | {
    nextLevel: number; className: string; hpIncrease: number; newSpellCount: number; preparedCount: number; cantripCount: number;
    availableSpells: Array<{ name:string; level:number; description:string }>; availableCantrips:string[]; spellSummaries:Record<string,string>; expertiseChoices:string[]; subclassChoices:string[]; abilityIncrease:boolean; usesSpellbook:boolean;
    invocationChoices:Array<{name:string;description:string}>; currentInvocations:string[]; invocationCount:number; choiceFeatureLabel?:string; progressionMode?:string; featureNotes:string[];
    nextSlots:Array<{level:number;count:number;label:string}>;
    primaryAbility:string; subclassDescription:string;
    currentSpellbook:string[]; currentPrepared:string[]; currentAbilities:Record<string,number>;
  };
  guidanceMode: "guided" | "standard" | "classic";
  guidance: Array<{ label: string; text: string; mode: "act" | "speak" | "ask"; reason: string }>;
  ai: {
    connected:boolean; model:string; profile:string; displayName:string; promptInspectorEnabled:boolean;
    status:"checking"|"available"|"ready"|"loading"|"unavailable"|"offline"|"error";
    pendingModel:string; loadProgress:number|null; loaded:boolean; error:string; loadDurationMs:number|null;
    models:Array<{name:string;size:number;parameterSize:string;quantization:string;family:string;modifiedAt:string;loaded:boolean;selected:boolean}>;
  };
  speech: { transcriptionConfigured: boolean };
  art: { imageConfigured: boolean };
};
