import { useCallback, useEffect, useRef, useState } from "react";
import type { Adventure, GameView, LobbyData, Party, Player, StoryEvent, World } from "./types";
import { UNIVERSE_IDS, universeIdForWorld, universeTheme } from "../shared/universe-themes.mjs";
import type { UniverseId, UniverseTheme } from "../shared/universe-themes.mjs";

const CLASSES = ["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard"];
const SPECIES = ["Aasimar","Dragonborn","Dwarf","Elf","Gnome","Goliath","Halfling","Human","Orc","Tiefling"];
const BACKGROUNDS = ["Acolyte","Artisan","Charlatan","Criminal","Entertainer","Farmer","Guard","Guide","Hermit","Merchant","Noble","Sage","Sailor","Scribe","Soldier","Wayfarer"];
const SKILLS = ["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"];
const SKILL_INFO: Record<string, { ability: AbilityName; description: string }> = {
  Acrobatics:{ ability:"dexterity", description:"Keep your balance, perform agile movement, tumble, or escape a difficult physical position." },
  "Animal Handling":{ ability:"wisdom", description:"Calm, guide, train, or understand an animal, and keep control of a mount when it is frightened." },
  Arcana:{ ability:"intelligence", description:"Recall knowledge about spells, magic items, magical traditions, planes, and arcane symbols." },
  Athletics:{ ability:"strength", description:"Climb, jump, swim, force movement, grapple, or overcome another demanding physical obstacle." },
  Deception:{ ability:"charisma", description:"Convincingly lie, hide the truth, maintain a disguise, or mislead someone through words or actions." },
  History:{ ability:"intelligence", description:"Recall events, people, nations, wars, cultures, customs, and clues from the past." },
  Insight:{ ability:"wisdom", description:"Read motives and emotions, notice changes in behaviour, and judge whether someone seems truthful." },
  Intimidation:{ ability:"charisma", description:"Influence someone through threats, force of personality, hostility, or an imposing presence." },
  Investigation:{ ability:"intelligence", description:"Deduce how clues connect, search methodically, and understand hidden mechanisms or evidence." },
  Medicine:{ ability:"wisdom", description:"Recognise illness or injury, provide basic treatment, and stabilise a dying creature." },
  Nature:{ ability:"intelligence", description:"Recall knowledge about terrain, plants, animals, weather, natural cycles, and the wilderness." },
  Perception:{ ability:"wisdom", description:"Notice sights, sounds, smells, movement, concealed creatures, traps, and other immediate details." },
  Performance:{ ability:"charisma", description:"Entertain or hold an audience through music, acting, dance, storytelling, or another performance." },
  Persuasion:{ ability:"charisma", description:"Influence someone through honesty, tact, good manners, reason, negotiation, or friendly conversation." },
  Religion:{ ability:"intelligence", description:"Recall lore about deities, faiths, rites, holy symbols, religious groups, and related supernatural traditions." },
  "Sleight of Hand":{ ability:"dexterity", description:"Pick a pocket, conceal an object, perform manual trickery, or manipulate something without being noticed." },
  Stealth:{ ability:"dexterity", description:"Hide, move quietly, avoid notice, follow someone unseen, or approach without revealing your position." },
  Survival:{ ability:"wisdom", description:"Track creatures, navigate, forage, predict wilderness hazards, and recognise signs in the natural world." }
};
const CLASS_SKILL_RULES: Record<string, { count: number; allowed: string[] }> = {
  Barbarian:{ count:2, allowed:["Animal Handling","Athletics","Intimidation","Nature","Perception","Survival"] },
  Bard:{ count:3, allowed:SKILLS },
  Cleric:{ count:2, allowed:["History","Insight","Medicine","Persuasion","Religion"] },
  Druid:{ count:2, allowed:["Arcana","Animal Handling","Insight","Medicine","Nature","Perception","Religion","Survival"] },
  Fighter:{ count:2, allowed:["Acrobatics","Animal Handling","Athletics","History","Insight","Intimidation","Perception","Persuasion","Survival"] },
  Monk:{ count:2, allowed:["Acrobatics","Athletics","History","Insight","Religion","Stealth"] },
  Paladin:{ count:2, allowed:["Athletics","Insight","Intimidation","Medicine","Persuasion","Religion"] },
  Ranger:{ count:3, allowed:["Animal Handling","Athletics","Insight","Investigation","Nature","Perception","Stealth","Survival"] },
  Rogue:{ count:4, allowed:["Acrobatics","Athletics","Deception","Insight","Intimidation","Investigation","Perception","Persuasion","Sleight of Hand","Stealth"] },
  Sorcerer:{ count:2, allowed:["Arcana","Deception","Insight","Intimidation","Persuasion","Religion"] },
  Warlock:{ count:2, allowed:["Arcana","Deception","History","Intimidation","Investigation","Nature","Religion"] },
  Wizard:{ count:2, allowed:["Arcana","History","Insight","Investigation","Medicine","Nature","Religion"] }
};
const ALIGNMENTS = ["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"];
const SPECIES_HELP: Record<string,string> = {
  Aasimar:"Mortals touched by the Upper Planes, with healing light and a temporary celestial revelation.", Dragonborn:"People with draconic ancestry, a breath weapon, elemental resilience, and a commanding presence.", Dwarf:"Sturdy, long-lived folk with darkvision, poison resilience, and a strong connection to stone and craft.", Elf:"Graceful, perceptive folk with keen senses, magic-touched lineages, and no need for ordinary sleep.", Gnome:"Small, inventive folk with sharp minds, darkvision, and unusual resistance to magical mental effects.", Goliath:"Powerful descendants of giants who can briefly draw on a giant ancestry and grow in stature.", Halfling:"Small, brave and remarkably fortunate folk who can turn disastrous natural-one rolls into another chance.", Human:"Adaptable and resourceful, gaining extra versatility through a skill and an additional origin feat.", Orc:"Powerful, relentless folk with darkvision, bursts of speed, and the ability to remain standing when others fall.", Tiefling:"People with fiendish legacies that grant darkvision, resistance, and innate magic shaped by that legacy."
};
const BACKGROUND_HELP: Record<string,string> = {
  Acolyte:"You served in a temple or religious community and learned its rites, teachings, and responsibilities.", Artisan:"You learned a skilled trade through a workshop or guild and know the value of patient, practical work.", Charlatan:"You survived through confidence tricks, disguises, false stories, and an instinct for what people want to hear.", Criminal:"You worked beyond the law and understand secrecy, risk, underworld contacts, and guarded places.", Entertainer:"You made a life before audiences as a musician, actor, dancer, storyteller, or other performer.", Farmer:"You were shaped by hard rural work, changing seasons, animals, and the endurance of ordinary communities.", Guard:"You protected a gate, settlement, caravan, or important person and learned to stay alert when others relax.", Guide:"You led travellers through dangerous country and learned routes, weather, wilderness signs, and self-reliance.", Hermit:"You spent formative years in seclusion, contemplation, study, or survival away from ordinary society.", Merchant:"You bought, sold, negotiated, travelled, and learned how goods and information move between communities.", Noble:"You were raised among status, obligation, etiquette, politics, and the expectations attached to a respected name.", Sage:"You pursued formal learning in libraries, academies, laboratories, or the company of other scholars.", Sailor:"You lived aboard ships or along busy waterways and learned ropes, weather, teamwork, and life at sea.", Scribe:"You preserved records, copied important works, handled correspondence, and learned the power of exact words.", Soldier:"Military service taught you discipline, endurance, weapons, hierarchy, and how to rely on companions under pressure.", Wayfarer:"You grew up moving through streets and roads without secure roots, becoming observant, lucky, stealthy, and resourceful."
};
const CLASS_HELP: Record<string,string> = {
  Barbarian:"A fierce front-line warrior who enters Rage to hit harder and withstand punishment.", Bard:"A versatile magical performer who inspires companions and solves problems with skill, charm, and spells.", Cleric:"A divine spellcaster whose sacred calling provides healing, protection, and formidable supernatural power.", Druid:"A primal spellcaster connected to nature, animals, elemental forces, and eventually shape-changing magic.", Fighter:"A highly trained warrior with dependable attacks, broad equipment choices, and exceptional tactical flexibility.", Monk:"A swift martial artist who fights through disciplined movement, unarmed techniques, and focused inner energy.", Paladin:"An armored sacred warrior combining martial strength, healing, protective auras, and powerful smites.", Ranger:"A skilled explorer and hunter blending weapons, wilderness expertise, tracking, and primal magic.", Rogue:"A precise, mobile expert in stealth and skills who exploits openings for powerful Sneak Attacks.", Sorcerer:"An instinctive spellcaster whose magic comes from within and can be reshaped through innate sorcery.", Warlock:"A spellcaster empowered by an otherworldly patron, combining unusual invocations with potent, renewable magic.", Wizard:"A scholarly spellcaster with the broadest spellbook and exceptional flexibility when preparation and knowledge matter."
};

const CLASS_EQUIPMENT: Record<string, { summary: string; items: string[] }> = {
  Barbarian:{ summary:"A rugged front-line kit built around a heavy weapon and travel in the wild.", items:["Greataxe", "Four handaxes", "Explorer’s pack", "15 gp for personal purchases"] },
  Bard:{ summary:"A flexible performer’s kit with a finesse weapon, light armor, and an instrument.", items:["Leather armor", "Two daggers", "Musical instrument of your choice", "Entertainer’s pack", "19 gp for personal purchases"] },
  Cleric:{ summary:"An armored divine caster’s kit with a holy symbol and dependable protection.", items:["Chain shirt and shield", "Mace", "Holy symbol", "Priest’s pack", "7 gp for personal purchases"] },
  Druid:{ summary:"A practical wilderness kit with simple weapons and a focus for primal magic.", items:["Leather armor and shield", "Sickle", "Druidic focus", "Explorer’s pack", "9 gp for personal purchases"] },
  Fighter:{ summary:"A versatile martial kit with heavy protection, melee and ranged options.", items:["Chain mail", "Greatsword", "Flail", "Eight javelins", "Dungeoneer’s pack", "4 gp for personal purchases"] },
  Monk:{ summary:"A light travelling kit that leaves you free to rely on speed and martial arts.", items:["Spear", "Five daggers", "Artisan’s tools or musical instrument", "Explorer’s pack", "11 gp for personal purchases"] },
  Paladin:{ summary:"A heavily armored sacred warrior’s kit with weapons and a holy symbol.", items:["Chain mail and shield", "Longsword", "Six javelins", "Holy symbol", "Priest’s pack", "9 gp for personal purchases"] },
  Ranger:{ summary:"A mobile hunter’s kit prepared for both archery and close combat.", items:["Studded leather armor", "Scimitar and shortsword", "Longbow and 20 arrows", "Druidic focus", "Explorer’s pack", "7 gp for personal purchases"] },
  Rogue:{ summary:"A discreet specialist’s kit for infiltration, ranged attacks, and precise melee strikes.", items:["Leather armor", "Two daggers and shortsword", "Shortbow and 20 arrows", "Thieves’ tools", "Burglar’s pack", "8 gp for personal purchases"] },
  Sorcerer:{ summary:"A lightly equipped spellcaster’s kit centred on innate arcane power.", items:["Spear", "Two daggers", "Arcane focus", "Dungeoneer’s pack", "28 gp for personal purchases"] },
  Warlock:{ summary:"A lightly armored occult spellcaster’s kit with an arcane focus and practical weapons.", items:["Leather armor", "Sickle and two daggers", "Arcane focus", "Scholar’s pack", "15 gp for personal purchases"] },
  Wizard:{ summary:"A scholar’s kit containing a spellbook, arcane focus, and simple protection.", items:["Two daggers", "Arcane focus", "Robe", "Spellbook", "Scholar’s pack", "5 gp for personal purchases"] }
};
type AbilityName = "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
type AbilityBuild = { name: string; summary: string; scores: Record<AbilityName, number> };
const ABILITY_LABELS: Record<AbilityName, string> = { strength:"Strength", dexterity:"Dexterity", constitution:"Constitution", intelligence:"Intelligence", wisdom:"Wisdom", charisma:"Charisma" };
const CLASS_BUILDS: Record<string, AbilityBuild[]> = {
  Barbarian:[{ name:"Heavy hitter", summary:"Strength drives your weapon attacks. Constitution keeps you standing, while Dexterity helps when you are not wearing heavy armor.", scores:{ strength:15, constitution:14, dexterity:13, wisdom:12, charisma:10, intelligence:8 } }],
  Bard:[{ name:"Inspiring spellcaster", summary:"Charisma powers your spells and social skills. Dexterity improves defense and finesse weapons; Constitution protects concentration and hit points.", scores:{ charisma:15, dexterity:14, constitution:13, wisdom:12, intelligence:10, strength:8 } }],
  Cleric:[{ name:"Divine caster", summary:"Wisdom powers your cleric spells. Constitution supports hit points and concentration, with Strength useful for an armored melee cleric.", scores:{ wisdom:15, constitution:14, strength:13, dexterity:12, charisma:10, intelligence:8 } }],
  Druid:[{ name:"Primal caster", summary:"Wisdom powers your druid magic. Constitution helps concentration and survival, while Dexterity improves defense outside Wild Shape.", scores:{ wisdom:15, constitution:14, dexterity:13, intelligence:12, charisma:10, strength:8 } }],
  Fighter:[
    { name:"Strength fighter", summary:"Best for heavy armor and powerful melee weapons. Strength drives attacks, Constitution adds durability, and Dexterity still helps initiative and ranged backups.", scores:{ strength:15, constitution:14, dexterity:13, wisdom:12, charisma:10, intelligence:8 } },
    { name:"Dexterity fighter", summary:"Best for bows, finesse weapons, and lighter armor. Dexterity drives attacks and defense, Constitution adds durability, and Wisdom supports awareness.", scores:{ dexterity:15, constitution:14, wisdom:13, strength:12, intelligence:10, charisma:8 } }
  ],
  Monk:[{ name:"Mobile martial artist", summary:"Dexterity drives attacks and defense. Wisdom strengthens key monk features, while Constitution keeps a front-line character alive.", scores:{ dexterity:15, wisdom:14, constitution:13, strength:12, intelligence:10, charisma:8 } }],
  Paladin:[{ name:"Armored champion", summary:"Strength drives melee attacks, Charisma powers sacred abilities and your aura, and Constitution supports front-line durability.", scores:{ strength:15, charisma:14, constitution:13, wisdom:12, dexterity:10, intelligence:8 } }],
  Ranger:[
    { name:"Dexterity ranger", summary:"Best for archery, finesse weapons, and light armor. Dexterity drives attacks, Wisdom supports spells and exploration, and Constitution adds durability.", scores:{ dexterity:15, wisdom:14, constitution:13, strength:12, intelligence:10, charisma:8 } },
    { name:"Strength ranger", summary:"Best for heavier melee weapons. Strength drives attacks, Wisdom supports spells and exploration, and Constitution helps you survive in close combat.", scores:{ strength:15, wisdom:14, constitution:13, dexterity:12, charisma:10, intelligence:8 } }
  ],
  Rogue:[{ name:"Agile expert", summary:"Dexterity drives attacks, defense, stealth, and thieves’ tools. Constitution adds durability, while Wisdom improves perception and insight.", scores:{ dexterity:15, constitution:14, wisdom:13, intelligence:12, charisma:10, strength:8 } }],
  Sorcerer:[{ name:"Innate spellcaster", summary:"Charisma powers your sorcerer spells. Constitution protects concentration and hit points, while Dexterity improves defense and initiative.", scores:{ charisma:15, constitution:14, dexterity:13, wisdom:12, intelligence:10, strength:8 } }],
  Warlock:[{ name:"Pact spellcaster", summary:"Charisma powers your warlock magic. Constitution protects concentration and hit points, while Dexterity improves defense and initiative.", scores:{ charisma:15, constitution:14, dexterity:13, wisdom:12, intelligence:10, strength:8 } }],
  Wizard:[{ name:"Arcane scholar", summary:"Intelligence powers your wizard spells. Constitution protects concentration and hit points, while Dexterity improves your limited defenses.", scores:{ intelligence:15, constitution:14, dexterity:13, wisdom:12, charisma:10, strength:8 } }]
};

type AvatarId = "guardian" | "wanderer" | "mystic" | "shadow" | "wild" | "scholar" | "minstrel" | "noble" | "cat";
const AVATAR_OPTIONS: Array<{ id: Exclude<AvatarId, "cat">; label: string }> = [
  { id:"guardian", label:"Guardian" }, { id:"wanderer", label:"Compass" },
  { id:"mystic", label:"Mystic" }, { id:"shadow", label:"Shadow" },
  { id:"wild", label:"Wild" }, { id:"scholar", label:"Scholar" },
  { id:"minstrel", label:"Minstrel" }, { id:"noble", label:"Crown" }
];
const CLASS_AVATARS: Record<string, Exclude<AvatarId, "cat">> = {
  Barbarian:"wild", Bard:"minstrel", Cleric:"noble", Druid:"wild", Fighter:"guardian", Monk:"wanderer",
  Paladin:"guardian", Ranger:"wanderer", Rogue:"shadow", Sorcerer:"mystic", Warlock:"shadow", Wizard:"scholar"
};
const AVATAR_IDS = new Set<AvatarId>([...AVATAR_OPTIONS.map((item) => item.id), "cat"]);

function AvatarGlyph({ id }: { id: AvatarId }) {
  const props = { viewBox:"0 0 24 24", "aria-hidden":true, fill:"none", stroke:"currentColor", strokeWidth:1.7, strokeLinecap:"round" as const, strokeLinejoin:"round" as const };
  if (id === "guardian") return <svg {...props}><path d="M12 3 19 6v5.2c0 4.5-2.8 7.7-7 9.8-4.2-2.1-7-5.3-7-9.8V6l7-3Z"/><path d="M12 6.5v10"/></svg>;
  if (id === "wanderer") return <svg {...props}><circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z"/><circle cx="12" cy="12" r="1"/></svg>;
  if (id === "mystic") return <svg {...props}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m18 16 .8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16Z"/></svg>;
  if (id === "shadow") return <svg {...props}><path d="M18.7 15.7A8.1 8.1 0 0 1 8.3 5.3 8.4 8.4 0 1 0 18.7 15.7Z"/><path d="m16.5 5 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z"/></svg>;
  if (id === "wild") return <svg {...props}><path d="M19.5 4.5C12 4.8 6.4 8.4 5.2 14.8c3.7 1.5 8.2.3 10.8-3.2 1.8-2.4 2.8-4.8 3.5-7.1Z"/><path d="M5 19c2.3-4.1 5.2-6.8 9.2-9"/></svg>;
  if (id === "scholar") return <svg {...props}><path d="M4 5.5c3.4-.8 5.9-.3 8 1.5v12c-2.1-1.8-4.6-2.3-8-1.5v-12Z"/><path d="M20 5.5c-3.4-.8-5.9-.3-8 1.5v12c2.1-1.8 4.6-2.3 8-1.5v-12Z"/></svg>;
  if (id === "minstrel") return <svg {...props}><path d="M9 17.5V6l9-2v11.5"/><path d="M9 9 18 7"/><ellipse cx="6.5" cy="18" rx="2.5" ry="2"/><ellipse cx="15.5" cy="16" rx="2.5" ry="2"/></svg>;
  if (id === "noble") return <svg {...props}><path d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13L4 8Z"/><path d="M6 21h12"/></svg>;
  return <svg {...props}><path d="m5 9 1-5 4 3h4l4-3 1 5v7c0 3-3 5-7 5s-7-2-7-5V9Z"/><path d="M9 13h.1M15 13h.1" stroke="#86cfff" strokeWidth="2.6"/><path d="m10 17 2 1 2-1"/></svg>;
}

function avatarFor(player: Player): AvatarId {
  if (player.isCompanion) return "cat";
  const chosen = player.avatarId as AvatarId | undefined;
  return chosen && AVATAR_IDS.has(chosen) ? chosen : (CLASS_AVATARS[player.className] || "wanderer");
}

function CharacterAvatar({ player, size = "party" }: { player: Player; size?: "lobby" | "party" | "sheet" }) {
  return <span className={`character-avatar avatar-${size}`} role="img" aria-label={`${player.name} avatar`}><AvatarGlyph id={avatarFor(player)} /></span>;
}

function UniverseMark({ theme, compact = false }: { theme:UniverseTheme; compact?:boolean }) {
  const icon = theme.icon;
  return <span className={`universe-mark ${compact ? "compact" : ""}`} aria-hidden="true"><svg viewBox="0 0 48 48">
    {icon === "shield" && <><path d="M8 7h32v16c0 10-5.8 16.8-16 21C13.8 39.8 8 33 8 23V7Z"/><path d="m9.5 27 14.5-10 14.5 10"/><path d="M12 10h7l-2.2 2.4 2.2 2.4h-2.6v5.7h-1.8v-5.7H12l2.2-2.4L12 10ZM29 10h7l-2.2 2.4 2.2 2.4h-2.6v5.7h-1.8v-5.7H29l2.2-2.4L29 10ZM20.5 27h7l-2.2 2.4 2.2 2.4h-2.6v6.2h-1.8v-6.2h-2.6l2.2-2.4-2.2-2.4Z"/></>}
    {icon === "cross" && <><path d="M21 5h6l-1 9 9-1v7l-9-1v23h-4V19l-9 1v-7l9 1-1-9Z"/><path d="M18 16h12M24 10v27"/><path d="m19 8 5-3 5 3M19 39l5 3 5-3"/></>}
    {icon === "magnifier" && <><circle cx="20" cy="20" r="11"/><path d="m28 28 12 12"/></>}
    {icon === "pentacle-image" && <image href="/art/universes/forsaken-pentagram.png" x="-3" y="-3" width="54" height="54" preserveAspectRatio="xMidYMid meet"/>}
    {icon === "cthulhu-bust" && <image href="/art/universes/hysteria-monster.png" x="-1" y="1" width="50" height="46" preserveAspectRatio="xMidYMid meet"/>}
    {icon === "dossier" && <><path d="M7 13h13l4 5h17v22H7z"/><path d="M10 10h13l4 5h11M13 25h12M13 31h8"/><circle cx="32" cy="29" r="5"/><path d="m36 33 5 5"/></>}
  </svg></span>;
}

function BrandIdentity({ theme, detail }: { theme:UniverseTheme; detail:string }) {
  return <div className="brand-identity"><UniverseMark theme={theme} compact/><span><strong>{theme.wordmark}</strong><small>{detail}</small></span></div>;
}

function MenuJourney({ theme, world, adventure, party, activeStep, onLibrary }: { theme:UniverseTheme; world?:string; adventure?:string; party?:string; activeStep:number; onLibrary?:()=>void }) {
  const steps = [
    { label:"Universe", value:theme.displayName },
    { label:theme.terms.campaign, value:world || `Choose ${theme.terms.campaign.toLowerCase()}` },
    { label:theme.terms.content, value:adventure || `Choose ${theme.terms.content.toLowerCase()}` },
    { label:theme.terms.party, value:party || `Choose ${theme.terms.party.toLowerCase()}` },
    { label:"Play", value:theme.terms.play },
  ];
  const currentIndex = Math.max(0, Math.min(steps.length - 1, activeStep - 1));
  const current = steps[currentIndex];
  const next = steps[currentIndex + 1];
  return <nav className="menu-journey" aria-label={`Setup progress: step ${currentIndex + 1} of ${steps.length}`}>
    {onLibrary&&<button type="button" className="journey-back" onClick={onLibrary}>← All universes</button>}
    <div className="journey-current" aria-current="step"><span>Step {currentIndex + 1} of {steps.length}</span><strong>{current.label}</strong><small>{current.value}</small></div>
    {next&&<div className="journey-next"><span>Next</span><strong>{next.label}</strong><small>{next.value}</small></div>}
    <details className="journey-route"><summary>Full route</summary><ol>{steps.map((step,index)=><li className={index<currentIndex?"complete":index===currentIndex?"active":""} key={step.label}><span>{index+1}</span>{step.label}</li>)}</ol></details>
  </nav>;
}

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const token = localStorage.getItem("hearthbound.token");
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
};

function App() {
  const [lobby, setLobby] = useState<LobbyData>({ worlds: [] });
  const [universeId, setUniverseId] = useState<UniverseId>(() => {
    const saved = localStorage.getItem("storyman.universe") as UniverseId | null;
    return saved && UNIVERSE_IDS.includes(saved) ? saved : "hearthbound";
  });
  const [worldId, setWorldId] = useState(() => localStorage.getItem("hearthbound.world") || "");
  const [partyId, setPartyId] = useState(() => localStorage.getItem("hearthbound.party") || "");
  const [playerId, setPlayerId] = useState(() => localStorage.getItem("hearthbound.player") || "");
  const [view, setView] = useState<GameView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const renderedUniverseId = view ? universeIdForWorld(view.world) : universeId;
  const activeTheme = universeTheme(renderedUniverseId);

  useEffect(() => {
    document.documentElement.dataset.universe = activeTheme.id;
    document.title = playerId && view ? `${view.campaign.title} · ${activeTheme.displayName}` : `${activeTheme.displayName} · Game Library`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", activeTheme.palette.ink);
  }, [activeTheme, playerId, view]);

  const loadLobby = useCallback(async () => {
    try {
      const data = await api<LobbyData>("/api/lobby");
      setLobby(data);
      const chosenWorld = data.worlds.find((item) => item.id === worldId) || data.worlds[0];
      if (chosenWorld && chosenWorld.id !== worldId) setWorldId(chosenWorld.id);
      const chosenParty = chosenWorld?.parties.find((item) => item.id === partyId) || chosenWorld?.parties[0];
      if (chosenParty && chosenParty.id !== partyId) setPartyId(chosenParty.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The campaign server is unavailable."); }
    finally { setLoading(false); }
  }, [worldId, partyId]);

  useEffect(() => { void loadLobby(); }, [loadLobby]);
  useEffect(() => { localStorage.setItem("storyman.universe", universeId); }, [universeId]);
  useEffect(() => { if (worldId) localStorage.setItem("hearthbound.world", worldId); }, [worldId]);
  useEffect(() => { if (partyId) localStorage.setItem("hearthbound.party", partyId); }, [partyId]);

  useEffect(() => {
    if (!playerId) return;
    localStorage.setItem("hearthbound.player", playerId);
    let stopped = false;
    const refresh = async () => {
      try { const data = await api<GameView>("/api/game"); if (!stopped) setView(data); }
      catch (error) { if (!stopped) { setNotice(error instanceof Error ? error.message : "Unable to refresh the scene."); setView(null); } }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1800);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [playerId]);

  const leaveGame = () => {
    localStorage.removeItem("hearthbound.player");
    localStorage.removeItem("hearthbound.token");
    setView(null);
    setPlayerId("");
    void loadLobby();
  };

  if (loading) return <main className="loading"><UniverseMark theme={activeTheme}/><p>Opening the game library…</p></main>;
  if (playerId && view) return <GameScreen view={view} theme={activeTheme} notice={notice} clearNotice={() => setNotice("")} leave={leaveGame} />;

  return (
    <LobbyScreen
      lobby={lobby}
      universeId={universeId}
      setUniverse={setUniverseId}
      worldId={worldId}
      partyId={partyId}
      notice={notice}
      setWorld={(id) => { setWorldId(id); const next = lobby.worlds.find((item) => item.id === id); setPartyId(next?.parties[0]?.id || ""); }}
      setParty={setPartyId}
      refresh={loadLobby}
      join={async (id) => {
        try {
          const session = await api<{ player: Player; token: string }>("/api/login", { method: "POST", body: JSON.stringify({ playerId: id }) });
          localStorage.setItem("hearthbound.token", session.token);
          setPlayerId(session.player.id);
          setNotice("");
        } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to join."); }
      }}
      deleted={(id) => { if (id === playerId) leaveGame(); void loadLobby(); }}
    />
  );
}

function UniverseLibrary({ universeId, setUniverse, open }: { universeId:UniverseId; setUniverse:(id:UniverseId)=>void; open:()=>void }) {
  const selected = universeTheme(universeId);
  return <main className="campaign-hub universe-library">
    <header className="hub-header"><BrandIdentity theme={selected} detail="Game library · Six distinct universes"/><span className="library-status">Separate worlds · Shared controls</span></header>
    <section className="hub-content">
      <MenuJourney theme={selected} activeStep={1}/>
      <div className="library-hero"><span className="eyebrow">Game library</span><h1>Choose your universe</h1><p>Choose a world. Each keeps its own rules, characters and atmosphere.</p></div>
      <div className="universe-grid">{UNIVERSE_IDS.map((id) => {
        const theme = universeTheme(id);
        const selectedCard = id === universeId;
        return <button type="button" data-universe={id} className={`universe-card ${selectedCard ? "active" : ""}`} aria-pressed={selectedCard} onClick={()=>setUniverse(id)} key={id}><img className="universe-card-art" src={theme.art} alt=""/><UniverseMark theme={theme}/><span className="universe-card-copy"><small>{theme.genre}</small><strong>{theme.displayName}</strong><em>{theme.tagline}</em></span><span className={`availability ${theme.availability}`}>{theme.availability === "playable" ? "Ready" : "Planned"}</span></button>;
      })}</div>
      <section className="universe-preview" data-universe={selected.id} aria-live="polite"><img className="preview-background" src={selected.art} alt=""/><div className="preview-summary"><UniverseMark theme={selected}/><div><span className="eyebrow">Selected · {selected.genre}</span><h2>{selected.displayName}</h2><p>{selected.description}</p></div><button type="button" disabled={selected.availability !== "playable"} onClick={open}>{selected.availability === "playable" ? `Open ${selected.displayName}` : "Content pack not installed"}</button></div><details className="preview-details"><summary>Identity and interface details</summary><div className="theme-facts"><div><span>Identity</span><strong>{selected.texture}</strong></div><div><span>Navigation language</span><strong>{selected.terms.campaign} · {selected.terms.content} · {selected.terms.character} · {selected.terms.map}</strong></div><div><span>Map treatment</span><strong>{selected.mapTreatment}</strong></div><div><span>Narration</span><strong>{selected.narrationMood}</strong></div></div></details><p className="preview-availability">{selected.availability === "playable" ? `${selected.displayName} is installed and ready to play.` : `${selected.displayName}'s interface identity is ready; its rules and content are not installed yet.`}</p></section>
    </section>
  </main>;
}

function LobbyScreen({ lobby, universeId, worldId, partyId, notice, setUniverse, setWorld, setParty, refresh, join, deleted }: {
  lobby: LobbyData; worldId: string; partyId: string; notice: string;
  universeId:UniverseId; setUniverse:(id:UniverseId)=>void;
  setWorld: (id: string) => void; setParty: (id: string) => void; refresh: () => Promise<void>; join: (id: string) => Promise<void>; deleted: (id: string) => void;
}) {
  const theme = universeTheme(universeId);
  const world = lobby.worlds.find((item) => item.id === worldId) || lobby.worlds[0];
  const party = world?.parties.find((item) => item.id === partyId) || world?.parties[0];
  const activeAdventure = world?.adventures.find((item) => item.id === party?.activeAdventureId);
  const storyAdventures = world?.adventures.filter((item) => !item.title.includes("Combat Workshop")) || [];
  const combatWorkshop = world?.adventures.find((item) => item.title.includes("Combat Workshop"));
  const [form, setForm] = useState<"world" | "party" | "character" | null>(null);
  const [screen, setScreen] = useState<"universes" | "library" | "characters">("universes");
  const [restartingApp, setRestartingApp] = useState(false);

  if (screen === "universes") return <UniverseLibrary universeId={universeId} setUniverse={setUniverse} open={()=>setScreen("library")}/>;

  const restartApplication = async () => {
    if (restartingApp || !window.confirm(`Restart the ${theme.displayName} application?\n\nThe game will be unavailable for a few seconds while the local service restarts. ${theme.terms.campaigns}, ${theme.terms.characters.toLowerCase()}, progress, and settings will not be changed.`)) return;
    setRestartingApp(true);
    try {
      await api("/api/system/restart", { method:"POST" });
      await new Promise((resolveWait) => window.setTimeout(resolveWait, 1100));
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          const response = await fetch("/api/health", { cache:"no-store" });
          if (response.ok) { window.location.reload(); return; }
        } catch { /* The brief disconnect is expected during restart. */ }
        await new Promise((resolveWait) => window.setTimeout(resolveWait, 500));
      }
      window.alert(`${theme.displayName} has not come back online yet. Use its desktop icon to start it.`);
    } catch {
      window.alert(`The restart could not be started. Use the desktop ${theme.displayName} icon instead.`);
    } finally { setRestartingApp(false); }
  };

  const submitNamed = async (event: React.FormEvent<HTMLFormElement>, kind: "world" | "party") => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (kind === "party") values.worldId = world.id;
    const result = await api<{ world?: World; party?: Party }>(`/api/${kind === "world" ? "worlds" : "parties"}`, { method: "POST", body: JSON.stringify(values) });
    await refresh();
    if (result.world) setWorld(result.world.id);
    if (result.party) setParty(result.party.id);
    setForm(null);
  };

  const createCharacter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(formData);
    values.skills = formData.getAll("skills");
    values.abilities = { strength:Number(formData.get("strength")), dexterity:Number(formData.get("dexterity")), constitution:Number(formData.get("constitution")), intelligence:Number(formData.get("intelligence")), wisdom:Number(formData.get("wisdom")), charisma:Number(formData.get("charisma")) };
    for (const ability of ["strength","dexterity","constitution","intelligence","wisdom","charisma"]) delete values[ability];
    values.partyId = party.id;
    const result = await api<{ player: Player }>("/api/players", { method: "POST", body: JSON.stringify(values) });
    await refresh();
    setForm(null);
    await join(result.player.id);
  };

  const chooseAdventure = async (adventure: Adventure) => {
    await api("/api/adventures/select", { method: "POST", body: JSON.stringify({ partyId: party.id, adventureId: adventure.id }) });
    await refresh();
  };

  if (screen === "characters" && world && party) return (
    <main className="campaign-hub roster-page" data-universe={theme.id}>
      <header className="hub-header"><BrandIdentity theme={theme} detail={`${world.name} › ${party.name} › ${theme.terms.characters}`}/><div className="hub-actions"><button className="ghost-button" onClick={() => { setScreen("universes"); setForm(null); }}>Game library</button><button className="ghost-button" onClick={() => { setScreen("library"); setForm(null); }}>← {theme.terms.campaign} library</button></div></header>
      <section className="hub-content roster-content">
        {notice && <div className="notice">{notice}</div>}
        <MenuJourney theme={theme} world={world.name} adventure={activeAdventure?.title} party={party.name} activeStep={4} onLibrary={()=>setScreen("universes")}/>
        <div className="roster-hero">
          <div><span className="eyebrow">{theme.terms.character} selection</span><h1>Who enters the tale?</h1><p>Choose a family {theme.terms.character.toLowerCase()}, or create someone new for {party.name}. {theme.terms.characters} here belong only to this {theme.terms.party.toLowerCase()} and keep their progress between {theme.terms.contents.toLowerCase()}.</p></div>
          <div className="roster-context"><span>Current {theme.terms.content.toLowerCase()}</span><strong>{activeAdventure?.title || `No ${theme.terms.content.toLowerCase()} selected`}</strong><small>{activeAdventure ? activeAdventure.title.includes("Combat Workshop") ? "Disposable testing · No milestones or story consequences" : `Levels ${activeAdventure.minLevel}–${activeAdventure.maxLevel} · Milestone ${activeAdventure.milestoneLevel}` : `Return to the library to choose one.`}</small></div>
        </div>
        {form !== "character" && <>
          <div className="section-heading"><div><span className="eyebrow">{party.name}</span><h2>Your {theme.terms.characters.toLowerCase()}</h2></div><button className="ghost-button" onClick={() => setForm("character")}>＋ New {theme.terms.character.toLowerCase()}</button></div>
          <div className="roster-grid">{party.characters.map((player) => <article className="roster-card" key={player.id}><button className="roster-enter" onClick={() => void join(player.id)}><CharacterAvatar player={player} size="lobby"/><span><strong>{player.name}</strong><small>Level {player.level} {player.species} {player.className} · {party.name}</small></span><span className="enter-label">{theme.terms.play} →</span></button><div className="character-management">{world.parties.length > 1 && <label><span>Move to {theme.terms.party.toLowerCase()}</span><select value={party.id} onChange={async (event) => { const destination=event.target.value; if (destination !== party.id && window.confirm(`Move ${player.name} to ${world.parties.find((item)=>item.id===destination)?.name}? Their progress and items will move with them.`)) { await api(`/api/players/${encodeURIComponent(player.id)}/move`, { method:"POST", body:JSON.stringify({partyId:destination}) }); await refresh(); } }}><option value={party.id}>{party.name}</option>{world.parties.filter((item)=>item.id!==party.id).map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}<button className="delete-character" title={`Delete ${player.name}`} onClick={async () => { if (window.confirm(`Delete ${player.name}? This removes the ${theme.terms.character.toLowerCase()} and their private messages permanently.`)) { await api(`/api/players/${encodeURIComponent(player.id)}`, { method: "DELETE" }); deleted(player.id); } }}>Delete {theme.terms.character.toLowerCase()}</button></div></article>)}</div>
          {!party.characters.length && <div className="empty-party"><strong>No {theme.terms.characters.toLowerCase()} yet</strong><p>Create the first {theme.terms.character.toLowerCase()} for this {theme.terms.party.toLowerCase()}.</p></div>}
        </>}
        {form === "character" && <CharacterForm worldName={world.name} partyName={party.name} onSubmit={createCharacter} cancel={() => setForm(null)} />}
      </section>
    </main>
  );

  return (
    <main className="campaign-hub" data-universe={theme.id}>
      <header className="hub-header"><BrandIdentity theme={theme} detail={`${theme.terms.campaign} library ${world ? `› ${world.name}` : ""}${party ? ` › ${party.name}` : ""}`}/><div className="hub-actions"><button className="ghost-button" onClick={()=>setScreen("universes")}>Game library</button><button className="restart-application" disabled={restartingApp} onClick={()=>void restartApplication()}>{restartingApp ? "Restarting…" : "Restart application"}</button><button className="ghost-button" onClick={() => setForm("world")}>＋ New {theme.terms.campaign.toLowerCase()}</button></div></header>
      <section className="hub-content">
        {notice && <div className="notice">{notice}</div>}
        <MenuJourney theme={theme} world={world?.name} adventure={activeAdventure?.title} party={party?.name} activeStep={world ? activeAdventure ? party ? 4 : 3 : 2 : 1} onLibrary={()=>setScreen("universes")}/>
        <div className="hub-title"><span className="stage-number">3</span><span className="eyebrow">Choose a {theme.terms.campaign.toLowerCase()}</span><h1>Where will you gather?</h1></div>
        <div className="world-grid">
          {lobby.worlds.map((item) => <button key={item.id} className={`world-card ${item.id === world?.id ? "active" : ""}`} onClick={() => setWorld(item.id)}><UniverseMark theme={theme} compact/><div><strong>{item.name}</strong><small>{item.description || `A ${theme.terms.campaign.toLowerCase()} waiting to be explored.`}</small></div></button>)}
        </div>

        {form === "world" && <NamedForm title={`Create a new ${theme.terms.campaign.toLowerCase()}`} description onSubmit={(event) => void submitNamed(event, "world")} cancel={() => setForm(null)} />}
        {world?.series && <section className="campaign-series-banner"><div><span className="eyebrow">Overarching {theme.terms.campaign.toLowerCase()}</span><h2>{world.series.title}</h2></div><p>{world.series.premise}</p><small>{world.series.episodeCount} connected {theme.terms.contents.toLowerCase()} · Local victories, one continuing mystery</small></section>}

        {world && party && <section className="menu-stage adventure-stage">
            <div className="section-heading"><div><span className="stage-number">4</span><span className="eyebrow">{theme.terms.content} shelf</span><h2>Choose the next tale</h2></div></div>
            <div className="adventure-list">{storyAdventures.map((adventure) => {
              const active = party.activeAdventureId === adventure.id;
              const fit = party.averageLevel < adventure.minLevel ? "Above party level" : party.averageLevel > adventure.maxLevel ? "Below party level" : "Well matched";
              const workshop = adventure.title.includes("Combat Workshop");
              return <article className={`adventure-card ${active ? "active" : ""} ${workshop ? "workshop-card" : ""}`} key={adventure.id}><div className="level-ribbon">{workshop ? <>TEST<br/><strong>ALL</strong></> : <>LEVELS<br/><strong>{adventure.minLevel}–{adventure.maxLevel}</strong></>}</div><div><span className={`fit ${fit === "Well matched" ? "good" : ""}`}>{active ? `Current ${theme.terms.content.toLowerCase()}` : workshop ? "Disposable testing" : fit}</span>{adventure.episodeNumber && <span className="series-episode">{adventure.seriesTitle} · {theme.terms.content} {adventure.episodeNumber}</span>}<h3>{adventure.title}</h3><p>{adventure.synopsis}</p>{adventure.seriesHook && <p className="series-hook">{adventure.seriesHook}</p>}<small>{workshop ? `Uses ${party.name}'s roster. Create a separate ${theme.terms.party.toLowerCase()} for separate test ${theme.terms.characters.toLowerCase()}.` : `Milestone: reach level ${adventure.milestoneLevel}`}</small></div>{!active && <button onClick={() => void chooseAdventure(adventure)}>Select</button>}</article>;
            })}</div>
        </section>}

        {world && <section className="menu-stage party-stage"><div className="section-heading"><div><span className="stage-number">5</span><span className="eyebrow">{theme.terms.parties} in {world.name}</span><h2>Choose your {theme.terms.party.toLowerCase()}</h2></div><button className="ghost-button" onClick={() => setForm("party")}>＋ New {theme.terms.party.toLowerCase()}</button></div><div className="party-tabs">{world.parties.map((item) => <button key={item.id} className={item.id === party?.id ? "active" : ""} onClick={() => setParty(item.id)}><strong>{item.name}</strong><small>{item.characters.length} {theme.terms.character.toLowerCase()}{item.characters.length === 1 ? "" : "s"} · Average level {formatLevel(item.averageLevel)}</small></button>)}</div>{form === "party" && <NamedForm title={`Form a new ${theme.terms.party.toLowerCase()}`} onSubmit={(event) => void submitNamed(event, "party")} cancel={() => setForm(null)} />}</section>}

        {world && party && <aside className="party-launch play-launch"><span className="stage-number">6</span><div><span className="eyebrow">Ready to play</span><h2>Choose a {theme.terms.character.toLowerCase()}</h2><p>{party.characters.length ? `${party.characters.length} ${theme.terms.character.toLowerCase()}${party.characters.length === 1 ? " is" : "s are"} ready in ${party.name}.` : `${party.name} needs its first ${theme.terms.character.toLowerCase()}.`}</p></div><div className="party-launch-adventure"><small>Current {theme.terms.content.toLowerCase()}</small><strong>{activeAdventure?.title || "Not selected"}</strong></div><button onClick={() => { setForm(null); setScreen("characters"); }}>Open {theme.terms.character.toLowerCase()} selection →</button></aside>}
        {world && party && combatWorkshop && <section className="testing-shelf"><div className="section-heading"><div><span className="eyebrow">Separate testing area</span><h2>Combat Workshop</h2></div><small>Outside the continuing story</small></div><article className={`adventure-card workshop-card ${party.activeAdventureId === combatWorkshop.id ? "active" : ""}`}><div className="level-ribbon">TEST<br/><strong>ALL</strong></div><div><span className="fit">{party.activeAdventureId === combatWorkshop.id ? "Current test" : "Disposable testing"}</span><h3>{combatWorkshop.title}</h3><p>{combatWorkshop.synopsis}</p><small>Uses {party.name}'s roster. Fights do not change story progress.</small></div>{party.activeAdventureId !== combatWorkshop.id && <button onClick={() => void chooseAdventure(combatWorkshop)}>Select</button>}</article></section>}
      </section>
    </main>
  );
}

function NamedForm({ title, description = false, onSubmit, cancel }: { title: string; description?: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; cancel: () => void }) {
  return <form className="create-form inline-form" onSubmit={onSubmit}><h2>{title}</h2><label>Name<input required name="name" maxLength={50} autoFocus /></label>{description && <label>Short description<input name="description" maxLength={180} placeholder="What makes this world distinctive?" /></label>}<FormActions cancel={cancel} /></form>;
}
function FormActions({ cancel, disabled = false }: { cancel: () => void; disabled?: boolean }) { return <div className="form-actions"><button type="button" className="ghost" onClick={cancel}>Cancel</button><button disabled={disabled}>Save</button></div>; }
function formatLevel(level: number) { return Number.isInteger(level) ? String(level) : level.toFixed(1); }

function CharacterForm({ worldName, partyName, onSubmit, cancel }: { worldName: string; partyName: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; cancel: () => void }) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [className, setClassName] = useState("Fighter");
  const [avatarId, setAvatarId] = useState<Exclude<AvatarId, "cat">>(CLASS_AVATARS.Fighter);
  const [buildIndex, setBuildIndex] = useState(0);
  const [abilities, setAbilities] = useState<Record<AbilityName, number>>(() => CLASS_BUILDS.Fighter[0].scores);
  const [species, setSpecies] = useState("Human");
  const [background, setBackground] = useState("Wayfarer");
  const [help, setHelp] = useState<"species"|"background"|"class"|"equipment"|null>(null);
  const [equipmentChoice, setEquipmentChoice] = useState<"recommended"|"gold">("recommended");
  const [appearance, setAppearance] = useState("");
  const [backstory, setBackstory] = useState("");
  const [generating, setGenerating] = useState<"appearance"|"backstory"|null>(null);
  const [generationError, setGenerationError] = useState<{ kind:"appearance"|"backstory"; message:string }|null>(null);
  const [chosenSkills, setChosenSkills] = useState<string[]>([]);
  const skillRule = CLASS_SKILL_RULES[className];
  const skillLimit = skillRule.count;
  const SKILLS = skillRule.allowed;
  useEffect(() => { setChosenSkills([]); }, [className]);
  const toggleSkill = (skill: string) => setChosenSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : current.length < skillLimit ? [...current, skill] : current);
  const chooseClass = (nextClass: string) => { setClassName(nextClass); setAvatarId(CLASS_AVATARS[nextClass] || "wanderer"); setBuildIndex(0); setAbilities(CLASS_BUILDS[nextClass][0].scores); };
  const chooseBuild = (index: number) => { setBuildIndex(index); setAbilities(CLASS_BUILDS[className][index].scores); };
  const changeAbility = (ability: AbilityName, score: number) => setAbilities((current) => {
    const other = (Object.keys(current) as AbilityName[]).find((name) => name !== ability && current[name] === score);
    return other ? { ...current, [ability]: score, [other]: current[ability] } : { ...current, [ability]: score };
  });
  const activeBuild = CLASS_BUILDS[className][buildIndex];
  const abilityOrder: AbilityName[] = ["strength","dexterity","constitution","intelligence","wisdom","charisma"];
  const modifier = (score: number) => Math.floor((score - 10) / 2);
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
  const generateDetail = async (kind: "appearance"|"backstory") => {
    if (!formRef.current || generating) return;
    setGenerating(kind);
    setGenerationError(null);
    const values = Object.fromEntries(new FormData(formRef.current));
    try {
      const result = await api<{ text: string; source: "ollama"|"fallback" }>("/api/character-suggestion", { method:"POST", body:JSON.stringify({ kind, characterName:values.name, alignment:values.alignment, species, background, className, build:activeBuild.name, worldName, partyName }) });
      if (kind === "appearance") setAppearance(result.text); else setBackstory(result.text);
    } catch (error) { setGenerationError({ kind, message:error instanceof Error ? error.message : "The suggestion could not be created." }); }
    finally { setGenerating(null); }
  };
  return <form ref={formRef} className="create-form character-builder" onSubmit={onSubmit}>
    <div className="builder-heading"><button type="button" className="builder-back" onClick={cancel}>← Back to party</button><span className="eyebrow">2024 rules · Level one</span><h2>Create an adventurer</h2><p>Build the character in the traditional order. Standard-array scores are used for a fair starting party.</p></div>
    <fieldset><legend>1 · Identity</legend><div className="form-row"><label>Character name<input required name="name" maxLength={40} autoFocus /></label><label>Alignment<select name="alignment" defaultValue="Neutral">{ALIGNMENTS.map((item)=><option key={item}>{item}</option>)}</select></label></div><div className="avatar-field"><div className="avatar-field-copy"><span>Character emblem</span><small>Shown beside your name during play</small></div><input type="hidden" name="avatarId" value={avatarId}/><div className="avatar-picker" role="group" aria-label="Character emblem">{AVATAR_OPTIONS.map((avatar)=><button type="button" className="avatar-choice" aria-pressed={avatarId===avatar.id} onClick={()=>setAvatarId(avatar.id)} key={avatar.id}><span className="character-avatar avatar-choice-preview"><AvatarGlyph id={avatar.id}/></span><small>{avatar.label}</small></button>)}</div></div><label><span className="field-action"><span>Appearance</span><button type="button" onClick={()=>void generateDetail("appearance")} disabled={Boolean(generating)}>{generating === "appearance" ? "Creating…" : "✦ Suggest with AI"}</button></span><textarea name="appearance" maxLength={500} value={appearance} onChange={(event)=>setAppearance(event.target.value)} placeholder="Age, build, clothing, distinguishing features…" /></label>{generationError?.kind === "appearance" && <p className="generation-error">{generationError.message}</p>}</fieldset>
    <fieldset><legend>2 · Origin and class</legend><div className="form-row three help-fields"><label><span className="field-title">Species <button type="button" className="help-button" aria-label="Explain species" aria-expanded={help==="species"} onClick={()=>setHelp(help==="species"?null:"species")}>?</button></span><select name="species" value={species} onChange={(event)=>setSpecies(event.target.value)}>{SPECIES.map((item)=><option key={item}>{item}</option>)}</select><small>{SPECIES_HELP[species]}</small></label><label><span className="field-title">Background <button type="button" className="help-button" aria-label="Explain background" aria-expanded={help==="background"} onClick={()=>setHelp(help==="background"?null:"background")}>?</button></span><select name="background" value={background} onChange={(event)=>setBackground(event.target.value)}>{BACKGROUNDS.map((item)=><option key={item}>{item}</option>)}</select><small>{BACKGROUND_HELP[background]}</small></label><label><span className="field-title">Class <button type="button" className="help-button" aria-label="Explain class" aria-expanded={help==="class"} onClick={()=>setHelp(help==="class"?null:"class")}>?</button></span><select name="className" value={className} onChange={(event)=>chooseClass(event.target.value)}>{CLASSES.map((item)=><option key={item}>{item}</option>)}</select><small>{CLASS_HELP[className]}</small></label></div>{help && help !== "equipment" && <div className="help-panel" role="status"><strong>{help === "species" ? species : help === "background" ? background : className}</strong><p>{help === "species" ? SPECIES_HELP[species] : help === "background" ? BACKGROUND_HELP[background] : CLASS_HELP[className]}</p><span>{help === "species" ? "Species describes your ancestry and innate traits." : help === "background" ? "Background describes your life before adventuring and influences your starting talents." : "Class determines your main abilities, combat role, hit points, and how you grow."}</span></div>}</fieldset>
    <fieldset><legend>3 · Ability scores</legend><p className="field-help">Assign 15, 14, 13, 12, 10 and 8 once each. Changing one score swaps it with the ability already using that number.</p><div className="build-guidance"><div><span className="eyebrow">Suggested {className} focus</span><h3>{activeBuild.name}</h3><p>{activeBuild.summary}</p><small className="template-note">{CLASS_BUILDS[className].length > 1 ? `${className}s have two common starting styles, so choose the one matching the weapons you want to use.` : `Most new ${className}s can begin with this dependable arrangement. You can still change any score.`}</small></div>{CLASS_BUILDS[className].length > 1 && <div className="build-tabs" aria-label={`${className} build style`}>{CLASS_BUILDS[className].map((build,index)=><button type="button" key={build.name} className={index===buildIndex?"active":""} onClick={()=>chooseBuild(index)}>{build.name}</button>)}</div>}<div className="priority-row"><span><strong>{ABILITY_LABELS[abilityOrder.find((ability)=>activeBuild.scores[ability]===15)!]}</strong> primary</span><span><strong>Constitution</strong> supports hit points</span><button type="button" onClick={()=>setAbilities(activeBuild.scores)}>Apply suggested scores</button></div></div><div className="ability-grid">{abilityOrder.map((ability)=>{ const value=abilities[ability]; return <label key={ability} className={value===15?"primary-ability":value===8?"low-ability":""}>{ability.slice(0,3).toUpperCase()}<select name={ability} value={value} onChange={(event)=>changeAbility(ability,Number(event.target.value))}>{[15,14,13,12,10,8].map((score)=><option key={score} value={score}>{score} ({signed(modifier(score))})</option>)}</select><small>{value===15?"Main focus":value===8?"Lowest priority":""}</small></label>})}</div></fieldset>
    <fieldset><legend>4 · Proficiencies</legend><div className="proficiency-intro"><p className="field-help">Choose {skillLimit} skill proficienc{skillLimit === 1 ? "y" : "ies"}. A proficient skill adds your proficiency bonus—<strong>+2 at level 1</strong>—on top of its ability modifier when the DM calls for a check.</p><span>Tap a skill to see what it covers and your current bonus.</span></div><div className="skill-grid">{SKILLS.map((skill)=>{ const info=SKILL_INFO[skill]; return <label key={skill} className={chosenSkills.includes(skill)?"chosen":""}><input type="checkbox" name="skills" value={skill} checked={chosenSkills.includes(skill)} disabled={!chosenSkills.includes(skill)&&chosenSkills.length>=skillLimit} onChange={()=>toggleSkill(skill)}/><span>{skill}</span><small>{info.ability.slice(0,3).toUpperCase()}</small></label>})}</div>{chosenSkills.length > 0 && <div className="skill-details" aria-live="polite">{chosenSkills.map((skill)=>{ const info=SKILL_INFO[skill]; const abilityModifier=modifier(abilities[info.ability]); return <article key={skill}><div><strong>{skill}</strong><span>{ABILITY_LABELS[info.ability]} skill</span></div><p>{info.description}</p><small>Your current check bonus: {ABILITY_LABELS[info.ability].slice(0,3).toUpperCase()} {signed(abilityModifier)} + proficiency +2 = <strong>{signed(abilityModifier + 2)}</strong></small></article>})}</div>}</fieldset>
    <fieldset><legend>5 · Equipment and story</legend><span className="field-title equipment-title">Starting equipment <button type="button" className="help-button" aria-label="Explain starting equipment" aria-expanded={help==="equipment"} onClick={()=>setHelp(help==="equipment"?null:"equipment")}>?</button></span><div className="choice-row equipment-options"><label className={equipmentChoice==="recommended"?"selected":""}><input type="radio" name="equipmentChoice" value="recommended" checked={equipmentChoice==="recommended"} onChange={()=>setEquipmentChoice("recommended")}/><span><strong>Use {className} equipment</strong><small>Ready to adventure immediately</small></span></label><label className={equipmentChoice==="gold"?"selected":""}><input type="radio" name="equipmentChoice" value="gold" checked={equipmentChoice==="gold"} onChange={()=>setEquipmentChoice("gold")}/><span><strong>Take starting gold</strong><small>Choose every item yourself later</small></span></label></div>{equipmentChoice === "recommended" ? <div className="equipment-detail"><div><span className="eyebrow">Recommended for {className}</span><p>{CLASS_EQUIPMENT[className].summary}</p></div><ul>{CLASS_EQUIPMENT[className].items.map((item)=><li key={item}>{item}</li>)}</ul></div> : <div className="equipment-detail gold-choice"><div><span className="eyebrow">Custom equipment</span><p>Start with your class’s gold instead of the ready-made kit, then shop for weapons, armor, tools, and supplies. The inventory and shop screen will calculate the exact amount before play.</p></div></div>}{help === "equipment" && <div className="help-panel equipment-help" role="status"><strong>Which should I choose?</strong><p>The recommended kit is the easiest choice and changes with your class. Starting gold gives you more control, but you must buy everything before the character is ready to adventure.</p><span>This choice does not change your class abilities; it only changes what the character carries at the start.</span></div>}<label><span className="field-action"><span>Backstory</span><button type="button" onClick={()=>void generateDetail("backstory")} disabled={Boolean(generating)}>{generating === "backstory" ? "Creating…" : "✦ Suggest with AI"}</button></span><textarea name="backstory" maxLength={1200} value={backstory} onChange={(event)=>setBackstory(event.target.value)} placeholder="Where did they come from, what do they want, and why did they join this company?" /></label>{generationError?.kind === "backstory" && <p className="generation-error">{generationError.message}</p>}</fieldset>
    <FormActions cancel={cancel} disabled={chosenSkills.length !== skillLimit}/>
  </form>;
}

function GameScreen({ view, theme, notice, clearNotice, leave }: { view: GameView; theme:UniverseTheme; notice: string; clearNotice: () => void; leave: () => void }) {
  const [activeTab, setActiveTab] = useState<"adventure"|"character"|"map">("adventure");
  const [mode, setMode] = useState<"act" | "speak" | "ask">("act");
  const [speechAudience, setSpeechAudience] = useState<"party" | "nearby">("party");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(() => localStorage.getItem("hearthbound.audio") === "on");
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState(() => localStorage.getItem("hearthbound.voice") || "");
  const [speechRate, setSpeechRate] = useState(() => Number(localStorage.getItem("hearthbound.voiceRate") || ".94"));
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false);
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelChoice, setModelChoice] = useState(view.ai.pendingModel || view.ai.model);
  const [modelSwitching, setModelSwitching] = useState(false);
  const [sceneArt, setSceneArt] = useState<{image:string;caption:string}|null>(null);
  const [sceneArtBusy, setSceneArtBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [workshopOpponent, setWorkshopOpponent] = useState("training-dummy");
  const [workshopMode, setWorkshopMode] = useState<"solo"|"party">("solo");
  const [workshopBusy, setWorkshopBusy] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const lastSpoken = useRef<number>(Math.max(0, ...view.events.map((event) => event.id)));
  const feedEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => setSpeechVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    if (!modelSwitching) setModelChoice(view.ai.pendingModel || view.ai.model);
  }, [view.ai.model, view.ai.pendingModel, modelSwitching]);

  const speakText = (words:string, pitch=.92) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(words);
    utterance.rate = speechRate;
    utterance.pitch = pitch;
    const selected = speechVoices.find((voice)=>voice.name===voiceName);
    if (selected) utterance.voice = selected;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const narration = view.events.filter((event) => event.id > lastSpoken.current && event.kind === "narration");
    if (audioEnabled) narration.forEach((event) => speakText(event.text, event.visibility === "player" ? .86 : .92));
    if (view.events.length) lastSpoken.current = view.events[view.events.length - 1].id;
    feedEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [view.events, audioEnabled, voiceName, speechRate]);

  const toggleAudio = () => { const next = !audioEnabled; setAudioEnabled(next); localStorage.setItem("hearthbound.audio", next ? "on" : "off"); if (next) speakText("Narration enabled."); if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  const chooseVoice = (next:string) => { setVoiceName(next); localStorage.setItem("hearthbound.voice", next); };
  const chooseRate = (next:number) => { setSpeechRate(next); localStorage.setItem("hearthbound.voiceRate", String(next)); };
  const generateSceneArt = async () => {
    if (sceneArtBusy || !view.art.imageConfigured) return;
    setSceneArtBusy(true);
    try { setSceneArt(await api("/api/scene-image", { method:"POST", body:"{}" })); }
    catch (error) { alert(error instanceof Error ? error.message : "The scene picture could not be generated."); }
    finally { setSceneArtBusy(false); }
  };
  const submit = async () => { if (!text.trim() || sending) return; setSending(true); clearNotice(); try { await api("/api/action", { method: "POST", body: JSON.stringify({ mode, audience:mode === "speak" ? speechAudience : undefined, text: text.trim() }) }); setText(""); } finally { setSending(false); } };
  const roll = async (sides: number) => { clearNotice(); await api("/api/roll", { method: "POST", body: JSON.stringify({ sides }) }); };
  const combatAttack = async (weaponName: string) => { clearNotice(); await api("/api/combat/attack", { method:"POST", body:JSON.stringify({ weaponName }) }); };
  const combatSpell = async (spellName: string) => { clearNotice(); await api("/api/combat/spell", { method:"POST", body:JSON.stringify({ spellName }) }); };
  const combatPotion = async () => { clearNotice(); await api("/api/combat/potion", { method:"POST", body:"{}" }); };
  const combatDodge = async () => { clearNotice(); await api("/api/combat/dodge", { method:"POST", body:"{}" }); };
  const startWorkshopFight = async () => { if (workshopBusy) return; setWorkshopBusy(true); clearNotice(); try { await api("/api/workshop/start", { method:"POST", body:JSON.stringify({ opponentId:workshopOpponent, participantMode:workshopMode }) }); } finally { setWorkshopBusy(false); } };
  const resetWorkshopFight = async () => { if (workshopBusy) return; setWorkshopBusy(true); clearNotice(); try { await api("/api/workshop/reset", { method:"POST", body:"{}" }); } finally { setWorkshopBusy(false); } };
  const changeGuidanceMode = async (next: GameView["guidanceMode"]) => { clearNotice(); await api("/api/guidance-mode", { method:"POST", body:JSON.stringify({ mode:next }) }); };
  const partySpeech = mode === "speak" && speechAudience === "party";
  const combatBlocksInput = Boolean(view.combat?.active && mode !== "ask" && !partySpeech && (!view.combat.canAct || view.combat.pendingRoll));
  const restartAdventure = async () => {
    if (resetting || !window.confirm(`Restart ${view.campaign.title} from the beginning?\n\nThis clears this ${theme.terms.content.toLowerCase()}'s narration, actions, rolls, private observations, discovered map locations, clue progress, and gained items. Your ${theme.terms.characters.toLowerCase()}, levels, starting equipment, ${theme.terms.campaign.toLowerCase()}, and ${theme.terms.party.toLowerCase()} are kept.`)) return;
    setResetting(true); clearNotice();
    try { await api("/api/adventure/restart", { method:"POST" }); setText(""); setActiveTab("adventure"); }
    finally { setResetting(false); }
  };
  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const next = new MediaRecorder(stream); chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunks.current, { type: next.mimeType || "audio/mp4" }); try { const response = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": blob.type }, body: blob }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setText(result.text || ""); } catch (error) { alert(error instanceof Error ? error.message : "Transcription is not available yet."); } };
      recorder.current = next; next.start(); setRecording(true);
    } catch { alert("Microphone access needs HTTPS and permission on this iPad."); }
  };
  const stopRecording = () => { if (recording) { recorder.current?.stop(); setRecording(false); } };

  const switchModel = async () => {
    if (!modelChoice || modelSwitching) return;
    setModelSwitching(true); clearNotice();
    try {
      await api("/api/models/select", { method:"POST", body:JSON.stringify({ model:modelChoice }) });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ollama could not load that model.");
    } finally { setModelSwitching(false); }
  };

  const modelLabel=(view.ai.displayName || view.ai.model).replace(/\s*\(evaluation candidate\)/i," · Eval").replace(/\s*\(local default\)/i,"");
  const modelStatus=view.ai.status === "loading" ? "Loading" : view.ai.status === "offline" ? "Ollama offline" : view.ai.status === "error" ? "Load failed" : view.ai.loaded ? "Ready" : view.ai.connected ? "Available" : "Unavailable";
  const formatModelSize=(bytes:number)=>bytes>0?`${(bytes/1024/1024/1024).toFixed(1)} GB`:"Local model";
  return <main data-universe={theme.id} className={`game-shell ${view.party.length === 1 ? "solo-party" : ""} ${view.levelUp ? "level-up-available" : ""}`}>
    <div className="build-marker" title={`Service started ${new Date(view.build.startedAt).toLocaleString()}`}>Running {view.build.branch} · {view.build.commit}</div>
    <header className="topbar"><div className="campaign-identity"><UniverseMark theme={theme} compact/><span><strong>{view.campaign.title}</strong><small>{theme.displayName} · {view.world.name} · {view.group.name} · Levels {view.campaign.minLevel}–{view.campaign.maxLevel}</small><span className="model-control"><button type="button" className={`ai-model-line ${view.ai.connected?"connected":"offline"} ${view.ai.status}`} title="Choose the local AI model" aria-expanded={modelSettingsOpen} onClick={()=>setModelSettingsOpen((open)=>!open)}><i/>AI · {modelLabel} · {modelStatus}<b>⌄</b></button>{modelSettingsOpen&&<span className="model-settings"><span className="model-settings-heading"><strong>Local AI model</strong><small>Applies to every game on this server.</small></span>{view.ai.models.length?<label>Installed in Ollama<select value={modelChoice} disabled={modelSwitching||view.ai.status==="loading"} onChange={(event)=>setModelChoice(event.target.value)}>{view.ai.models.map((model)=><option value={model.name} key={model.name}>{model.name}{model.loaded?" · loaded":""}</option>)}</select></label>:<span className="model-empty">{view.ai.error||"No installed Ollama models were found."}</span>}<span className={`model-load-track ${view.ai.status==="loading"||modelSwitching?"loading":""}`} aria-label={view.ai.loadProgress===null?"Model loading":"Model load progress"}><i style={{width:`${view.ai.loadProgress??35}%`}}/></span><span className="model-status"><strong>{view.ai.status==="loading"||modelSwitching?`Loading ${view.ai.pendingModel||modelChoice}…`:view.ai.loaded?`${view.ai.model} is loaded and ready.`:view.ai.connected?`${view.ai.model} is installed; load it before testing.`:modelStatus}</strong><small>{view.ai.loadProgress===null?"Ollama does not report a trustworthy intermediate percentage. This becomes 100% only after the model responds.":`${view.ai.loadProgress}%`}{view.ai.loadDurationMs?` · Loaded in ${(view.ai.loadDurationMs/1000).toFixed(1)}s`:""}</small></span>{view.ai.error&&view.ai.status==="error"&&<span className="model-error">{view.ai.error}</span>}<button type="button" className="model-load-button" disabled={!modelChoice||modelSwitching||view.ai.status==="loading"||(modelChoice===view.ai.model&&view.ai.loaded)} onClick={()=>void switchModel()}>{modelSwitching||view.ai.status==="loading"?"Loading…":modelChoice===view.ai.model?"Load model":"Load & use model"}</button><span className="model-list">{view.ai.models.map((model)=><span key={model.name}><i className={model.loaded?"loaded":""}/><b>{model.name}</b><small>{model.parameterSize||model.family||formatModelSize(model.size)}{model.quantization?` · ${model.quantization}`:""} · {model.loaded?"in memory":"available"}</small></span>)}</span></span>}</span></span></div><div className="topbar-center"><nav className="view-tabs" aria-label="Game views">{(["adventure","character","map"] as const).map((tab)=><button key={tab} className={activeTab===tab?"active":""} onClick={()=>setActiveTab(tab)}>{tab === "adventure" ? theme.terms.content : tab === "character" ? theme.terms.characterSheet : theme.terms.map}</button>)}</nav></div><div className="top-actions"><button className="library-button" onClick={leave}>← Game library</button><div className="voice-control"><button className={`audio-button ${audioEnabled ? "active" : ""}`} onClick={toggleAudio}>{audioEnabled ? "Narration on" : "Narration off"}</button><button className="voice-settings-button" aria-label="Narration voice settings" title="Choose this device's narration voice" onClick={()=>setVoiceSettingsOpen((open)=>!open)}>Voice</button>{voiceSettingsOpen&&<div className="voice-settings"><label>Voice<select value={voiceName} onChange={(event)=>chooseVoice(event.target.value)}><option value="">Device default</option>{speechVoices.map((voice)=><option value={voice.name} key={`${voice.name}-${voice.lang}`}>{voice.name} ({voice.lang})</option>)}</select></label><label>Speed <strong>{speechRate.toFixed(2)}×</strong><input type="range" min="0.7" max="1.2" step="0.05" value={speechRate} onChange={(event)=>chooseRate(Number(event.target.value))}/></label><button onClick={()=>speakText(`This is ${theme.displayName}. The story is ready.`)}>Test voice</button><small>This choice belongs to this iPad or computer.</small></div>}</div><button className="scene-art-button" data-label={view.art.imageConfigured?(sceneArtBusy?"…":"Art"):"No art"} disabled={sceneArtBusy||!view.art.imageConfigured} title={view.art.imageConfigured?"Illustrate the current known room":"Scene pictures are unavailable because no local image generator is configured"} onClick={()=>void generateSceneArt()}>{sceneArtBusy?"Drawing…":view.art.imageConfigured?"Picture":"Picture unavailable"}</button><button className="reset-story" aria-label={`Restart ${theme.terms.content.toLowerCase()}`} title={`Restart this ${theme.terms.content.toLowerCase()} from the beginning`} disabled={resetting} onClick={()=>void restartAdventure()}>{resetting ? "Restarting…" : <><span className="restart-long">Restart {theme.terms.content.toLowerCase()}</span><span className="restart-short">Restart</span></>}</button></div></header>
    <section className="party-strip" aria-label={`${theme.terms.party} roster`}><div className="active-character-summary"><CharacterAvatar player={view.player}/><div className="active-character-copy"><strong>{view.player.name}</strong><small>Lv {view.player.level} · {view.player.className}</small></div><div className="health-summary"><span><b>{view.player.hp}/{view.player.maxHp}</b> HP</span><div className="health-track" aria-label={`${view.player.hp} of ${view.player.maxHp} hit points`}><i style={{width:`${Math.max(0,Math.min(100,(view.player.hp/Math.max(1,view.player.maxHp))*100))}%`}}/></div></div></div><div className="party-roster">{view.party.map((member) => <div className={`party-member ${member.id === view.player.id ? "you" : ""} ${member.isCompanion ? "companion" : ""}`} title={member.isCompanion ? `${member.fullName}. An immortal god in cat form who automatically evades harm.` : `${member.name}, level ${member.level} ${member.className}, ${member.hp} of ${member.maxHp} hit points`} key={member.id}><CharacterAvatar player={member}/><span><strong>{member.name}</strong><small>{member.isCompanion ? `Lv ${member.level} · ∞ HP` : `Lv ${member.level} · ${member.hp}/${member.maxHp} HP`}</small></span></div>)}</div><div className="party-strip-balance" aria-hidden="true"/></section>
    {activeTab === "adventure" && <>
      <div className="game-grid"><section className="story-panel">
        <div className="scene-heading"><span>{view.campaign.chapter}</span><h1>{view.campaign.scene}</h1></div>
        {view.playtest&&<details className="playtest-panel"><summary><span>Hearthbound playtest</span><strong>{view.playtest.completed}/{view.playtest.total} gates passed</strong></summary><div className="playtest-progress"><i style={{width:`${Math.round((view.playtest.completed/Math.max(1,view.playtest.total))*100)}%`}}/></div><div className="playtest-body"><div className="playtest-next"><span>Next checkpoint</span><strong>{view.playtest.nextGate}</strong><small>Engine location: {view.playtest.currentLocation} · clue stage {view.playtest.clueStage}{view.playtest.pendingCheck?` · waiting for ${view.playtest.pendingCheck}`:""}</small></div><ol>{view.playtest.gates.map((gate)=><li key={gate.id} className={gate.passed?"passed":""}><span>{gate.passed?"✓":"○"}</span>{gate.label}</li>)}</ol><button onClick={()=>void navigator.clipboard.writeText(JSON.stringify(view.playtest,null,2)).then(()=>alert("Playtest status copied."))}>Copy test status</button></div></details>}
        <details className="story-recap"><summary><span>Previously in this adventure</span><strong>{view.recap.currentLocation}</strong></summary><div className="recap-grid"><section><span>Current position</span><strong>{view.recap.currentLocation}</strong>{view.recap.visibleFeatures.length>0&&<p>Visible here: {view.recap.visibleFeatures.join(", ")}.</p>}{view.recap.pendingCheck&&<p>Waiting for: {view.recap.pendingCheck}.</p>}</section>{view.recap.establishedFacts.length>0&&<section><span>Established outcomes</span><ul>{view.recap.establishedFacts.map((fact)=><li key={fact}>{fact}</li>)}</ul></section>}{view.recap.recentActions.length>0&&<section><span>Recent choices</span><ul>{view.recap.recentActions.map((action)=><li key={action}>{action}</li>)}</ul></section>}{view.recap.recentRolls.length>0&&<section><span>Recent rolls</span><ul>{view.recap.recentRolls.map((roll)=><li key={roll}>{roll}</li>)}</ul></section>}{view.recap.carriedItems.length>0&&<section><span>Recorded equipment</span><p>{view.recap.carriedItems.join(" · ")}</p></section>}{view.recap.knownLocations.length>0&&<section><span>Known places</span><p>{view.recap.knownLocations.map((place)=>place.name).join(" · ")}</p></section>}</div><small className="recap-source">Built from recorded game state and accepted outcomes; no AI summary is used.</small></details>
        {sceneArt&&<figure className="scene-art"><button aria-label="Close scene picture" onClick={()=>setSceneArt(null)}>×</button><img src={sceneArt.image} alt={`Illustration of ${sceneArt.caption}`}/><figcaption>Current scene · {sceneArt.caption}</figcaption></figure>}
        <div className="story-feed" aria-live="polite">{view.events.map((event) => <EventCard key={event.id} event={event} ownPlayer={view.player} />)}<div ref={feedEnd}/></div>
        {notice && <button className="notice inline" onClick={clearNotice}>{notice} ×</button>}
        {view.levelUp && <section className="workshop-level-up"><div><span>{view.workshop?"Level testing":"Milestone level-up"}</span><strong>{view.player.name} is ready for level {view.levelUp.nextLevel}</strong><small>Complete the choices before the character's level, Hit Points, and features change.</small></div><button disabled={Boolean(view.combat?.active)} onClick={()=>{setLevelUpOpen(true);setActiveTab("character");}}>{view.combat?.active?"Finish or reset fight first":`Complete level ${view.levelUp.nextLevel} →`}</button></section>}
        {view.workshop && <section className="workshop-panel"><div className="workshop-heading"><div><span>Disposable rules laboratory</span><strong>Combat Workshop</strong><small>Fights here do not award levels, treasure, map discoveries, or story progress.</small></div><button disabled={workshopBusy} onClick={()=>void resetWorkshopFight()}>{workshopBusy ? "Resetting…" : "Reset fight & heal"}</button></div><div className="workshop-controls"><label><span>Opponent</span><select value={workshopOpponent} onChange={(event)=>setWorkshopOpponent(event.target.value)}>{view.workshop.opponents.map((opponent)=><option value={opponent.id} key={opponent.id}>{opponent.label}</option>)}</select><small>{view.workshop.opponents.find((opponent)=>opponent.id===workshopOpponent)?.summary}</small></label><div><span>Participants</span><div className="workshop-mode"><button className={workshopMode==="solo"?"active":""} onClick={()=>setWorkshopMode("solo")}>Just {view.player.name}</button><button className={workshopMode==="party"?"active":""} onClick={()=>setWorkshopMode("party")}>Whole party</button></div><small>Solo is best for running through one class at a time.</small></div><button className="start-workshop" disabled={workshopBusy || Boolean(view.combat?.active)} onClick={()=>void startWorkshopFight()}>{view.combat?.active ? "Fight in progress" : "Start test fight"}</button></div><details className="workshop-checklist"><summary>Class testing checklist</summary><ol>{view.workshop.checklist.map((item)=><li key={item}>{item}</li>)}</ol><p>Unsupported spells, features, conditions, or items should be recorded as gaps rather than improvised as automatic successes.</p></details></section>}
        {view.combat?.active && <section className="combat-panel" aria-label="Combat"><div className="combat-heading"><div><span>Combat · Round {view.combat.round}</span><strong>{view.combat.turn?.isYou ? "Your turn" : `${view.combat.turn?.name || "Combatant"}'s turn`}</strong></div>{view.combat.enemies.map((enemy)=><div className={`enemy-condition ${enemy.status.toLowerCase().replace(/\s/g,"-")}`} key={enemy.id}><small>{enemy.name}</small><strong>{enemy.status}</strong></div>)}</div><div className="initiative-order" aria-label="Initiative order">{view.combat.order.map((combatant)=><span key={combatant.id} className={combatant.current?"current":""}><b>{combatant.initiative}</b>{combatant.name}</span>)}</div>{view.combat.pendingRoll ? <div className="combat-roll"><div><span>{view.combat.pendingRoll.kind === "attack" ? "Attack roll" : view.combat.pendingRoll.kind === "healing" ? "Healing roll" : "Damage roll"}</span><strong>{view.combat.pendingRoll.weaponName}</strong><small>{view.combat.pendingRoll.kind === "attack" ? `Roll d20 ${(view.combat.pendingRoll.attackBonus||0)>=0?"+":""}${view.combat.pendingRoll.attackBonus||0}` : `Roll ${view.combat.pendingRoll.diceCount}d${view.combat.pendingRoll.dieSides}${view.combat.pendingRoll.modifier ? `${view.combat.pendingRoll.modifier>0?"+":""}${view.combat.pendingRoll.modifier}` : ""}`}</small></div><button onClick={()=>void roll(view.combat!.pendingRoll!.kind === "attack" ? 20 : Number(view.combat!.pendingRoll!.dieSides))}>Roll {view.combat.pendingRoll.kind === "attack" ? "d20" : view.combat.pendingRoll.kind === "healing" ? "healing" : "damage"}</button></div> : view.combat.canAct ? <div className="combat-actions"><div>{view.combat.attacks.map((attack)=><button key={attack.name} onClick={()=>void combatAttack(attack.name)}><strong>Attack · {attack.name}</strong><small>d20 {attack.attackBonus>=0?"+":""}{attack.attackBonus} · {attack.damage} damage</small></button>)}{view.combat.spells.map((spell)=><button key={spell.name} disabled={!spell.available} onClick={()=>void combatSpell(spell.name)}><strong>Cast · {spell.name}</strong><small>{spell.level===0?"Cantrip · Unlimited":`Level ${spell.level} · ${spell.castsRemaining}/${spell.castsMaximum} slots remaining`} · {spell.attackBonus!==null?`d20 ${spell.attackBonus>=0?"+":""}${spell.attackBonus} · `:""}{spell.damage} damage</small></button>)}</div><div className="combat-utility"><button className="dodge-action" onClick={()=>void combatDodge()}><strong>Dodge</strong><small>Enemy attacks have Disadvantage</small></button><button disabled={!view.combat.canUsePotion} onClick={()=>void combatPotion()}><strong>Drink healing potion · ×{view.combat.potionCount}</strong><small>Bonus Action · restores 2d4 + 2 HP</small></button></div><p>Only recorded weapons, prepared spells, cantrips, and carried items appear here.</p></div> : <p className="combat-wait">The controls will activate when your initiative turn arrives.</p>}</section>}
        {view.pendingCheck && <div className="pending-check"><div><span>Check requested</span><strong>{view.pendingCheck.ability} ({view.pendingCheck.skill})</strong><small>Roll d20 {view.pendingCheck.modifier>=0?"+":""}{view.pendingCheck.modifier} against DC {view.pendingCheck.dc}</small></div><button onClick={()=>void roll(20)}>Roll d20</button></div>}
        <div className="composer">
          <div className="composer-toolbar"><div className="composer-left"><div className="mode-tabs">{(["act", "speak", "ask"] as const).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item === "ask" ? <>Help / Ask DM{mode !== "ask" && view.guidance.length > 0 && <span className="guidance-count">{view.guidance.length}</span>}</> : item[0].toUpperCase() + item.slice(1)}</button>)}</div><button className={`mic ${recording ? "recording" : ""}`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); void startRecording(); }} onPointerUp={stopRecording} onPointerCancel={stopRecording}>{recording ? "Release" : "Hold to talk"}</button></div><div className="composer-right"><button className="send" disabled={!text.trim() || sending || combatBlocksInput} onClick={() => void submit()}>{sending ? "Thinking…" : "Send"}</button></div></div>
          {mode === "speak" && <div className="speech-audience"><div className="audience-options"><button className={speechAudience === "party" ? "active" : ""} onClick={()=>setSpeechAudience("party")}><strong>Party only</strong><small>Player characters hear it</small></button><button className={speechAudience === "nearby" ? "active" : ""} onClick={()=>setSpeechAudience("nearby")}><strong>Say aloud</strong><small>Nearby NPCs and creatures may hear</small></button></div><p>{speechAudience === "party" ? "The DM will not answer for another family member, and NPCs or creatures do not hear it." : "This is spoken into the scene. Anyone close enough may hear and react."}</p></div>}
          {mode === "ask" && <div className={`guidance-panel composer-guidance ${view.guidanceMode}`}><div className="guidance-top"><div><span>DM guidance</span><small>{view.guidanceMode === "guided" ? "Suggestions after each scene" : view.guidanceMode === "standard" ? "Suggestions when the party gets stuck" : "Suggestions hidden"}</small></div><select aria-label="DM guidance level" value={view.guidanceMode} onChange={(event)=>void changeGuidanceMode(event.target.value as GameView["guidanceMode"])}><option value="guided">Guided</option><option value="standard">Standard</option><option value="classic">Classic</option></select></div>{view.guidanceMode !== "classic" && <div className="guidance-options">{view.guidance.map((suggestion)=><button key={`${suggestion.mode}-${suggestion.label}`} title={suggestion.reason} onClick={()=>{setMode(suggestion.mode);setText(suggestion.text);}}><strong>{suggestion.label}</strong><small>{suggestion.reason}</small></button>)}{!view.guidance.length&&<p>{view.guidanceMode === "guided" ? "The DM will offer options after the next response." : "No guidance needed yet."}</p>}</div>}</div>}
          <textarea disabled={combatBlocksInput} value={text} onChange={(event) => setText(event.target.value)} placeholder={combatBlocksInput ? "Waiting for your combat turn or roll…" : mode === "speak" ? speechAudience === "party" ? "What do you say to the other player characters?" : "What do you say aloud in the scene?" : mode === "ask" ? "Ask about a rule, a visible detail, or which check might apply…" : "What does your character do?"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }}/>
        </div>
      </section></div></>}
    {activeTab === "character" && <div className="character-page"><CharacterSheet player={view.player} label={theme.terms.characterSheet}/><ClassFeaturesPanel player={view.player}/><SpellcastingPanel player={view.player}/>{view.levelUp&&<LevelUpPanel key={`${view.player.id}-${view.levelUp.nextLevel}`} player={view.player} options={view.levelUp} combatActive={Boolean(view.combat?.active)} clearNotice={clearNotice} open={levelUpOpen} setOpen={setLevelUpOpen} workshop={Boolean(view.workshop)}/>}</div>}
    {activeTab === "map" && <><WorldMap world={view.world.name} campaign={view.campaign.title} theme={theme}/><FoundMaps theme={theme} inventory={view.party.flatMap((member)=>member.inventory.map((item)=>({owner:member.name,item})))}/><KnownMap campaign={view.campaign.title} locations={view.knownLocations} theme={theme}/></>}
  </main>;
}

function CharacterSheet({ player, label }: { player: Player; label:string }) {
  const abilityOrder = ["strength","dexterity","constitution","intelligence","wisdom","charisma"];
  const modifier = (score:number) => Math.floor((score-10)/2);
  const equipment = CLASS_EQUIPMENT[player.className];
  return <section className="sheet-view"><header className="sheet-hero"><CharacterAvatar player={player} size="sheet"/><div><span className="eyebrow">{label}</span><h1>{player.name}</h1><p>Level {player.level} · {player.species} {player.className}{player.subclass?` · ${player.subclass}`:""} · {player.background} · {player.alignment}</p></div><div className="sheet-vitals"><span><small>Hit points</small><strong>{player.hp}/{player.maxHp}</strong></span><span><small>Armor class</small><strong>{player.armorClass}</strong></span><span><small>Level</small><strong>{player.level}</strong></span></div></header><div className="sheet-columns"><div><section className="sheet-card"><span className="eyebrow">Ability scores</span><div className="sheet-abilities">{abilityOrder.map((ability)=>{const score=Number(player.abilities[ability]||10);const mod=modifier(score);return <div key={ability}><span>{ability.slice(0,3).toUpperCase()}</span><strong>{score}</strong><small>{mod>=0?"+":""}{mod}</small></div>})}</div></section><section className="sheet-card"><span className="eyebrow">Proficient skills</span><div className="sheet-skills">{player.skills.map((skill)=><div key={skill}><strong>{skill}</strong><small>{SKILL_INFO[skill]?.description}</small></div>)}</div>{!player.skills.length&&<p className="empty-copy">No skill proficiencies were recorded.</p>}</section></div><div><section className="sheet-card"><span className="eyebrow">Appearance</span><p>{player.appearance||"No appearance has been written yet."}</p></section><section className="sheet-card"><span className="eyebrow">Backstory</span><p>{player.backstory||"No backstory has been written yet."}</p></section><section className="sheet-card inventory-card"><div className="inventory-heading"><span className="eyebrow">Items and equipment</span><small>{player.inventory.length} item type{player.inventory.length===1?"":"s"}</small></div>{equipment&&<p>{equipment.summary}</p>}<div className="inventory-list">{player.inventory.map((item)=><div className="inventory-item" key={item.id}><div><strong>{item.name}</strong>{item.notes&&<small>{item.notes}</small>}</div><span className={`item-status ${item.status}`}>{item.status}</span>{item.quantity>1&&<b>×{item.quantity}</b>}</div>)}</div>{!player.inventory.length&&<p className="empty-copy">Nothing is currently recorded here.</p>}</section></div></div></section>;
}

function ClassFeaturesPanel({ player }: { player: Player }) {
  return <section className="spellcasting-panel class-features-panel"><div className="spellcasting-heading"><div><span className="eyebrow">Class progression</span><h2>{player.className} features</h2></div><p>Recorded features are always part of the character. A feature is only resolved automatically in combat when the Workshop presents its action or resource control.</p></div><div className="spell-groups">{player.classFeatures.map((feature)=><article key={`${feature.level}-${feature.name}`}><strong>Level {feature.level}</strong><p>{feature.name}</p><small>{feature.automated?"Combat automated":"Recorded · automation may be pending"}</small></article>)}</div></section>;
}

function SpellcastingPanel({ player }: { player: Player }) {
  const magic = player.spellcasting;
  if (!magic) return null;
  const abilityModifier = Math.floor((Number(player.abilities[magic.ability] || 10)-10)/2);
  const proficiency = 2 + Math.floor((Math.max(1,player.level)-1)/4);
  const invocations = magic.pactMagic ? (magic.invocations || []) : (magic.metamagic || []);
  const featureChoiceLabel = magic.pactMagic ? "Eldritch Invocations" : "Metamagic";
  const patronFeature = player.subclass === "Fiend Patron" ? "Dark One’s Blessing: defeating an enemy grants temporary Hit Points equal to your Charisma modifier plus your Warlock level." : "";
  return <section className="spellcasting-panel"><div className="spellcasting-heading"><div><span className="eyebrow">Spellcasting</span><h2>{magic.pactMagic?"Pact Magic":"Prepared magic"}</h2></div><div><span><small>Spell attack</small><strong>{abilityModifier+proficiency>=0?"+":""}{abilityModifier+proficiency}</strong></span><span><small>Save DC</small><strong>{8+abilityModifier+proficiency}</strong></span>{Object.entries(magic.slots).map(([level,slot])=><span key={level}><small>Level {level} slots</small><strong>{slot.current}/{slot.max}</strong></span>)}</div></div><div className="spell-groups"><article><strong>Cantrips</strong><small>Cast freely; no spell slot</small><p>{magic.cantrips.join(", ")||"None"}</p></article><article><strong>Prepared spells</strong><small>Levelled spells consume a slot</small><p>{magic.prepared.join(", ")||"None"}</p></article>{magic.spellbook.length>0&&<article><strong>Spellbook</strong><small>Prepare four after a Long Rest at Wizard level 1</small><p>{magic.spellbook.join(", ")}</p></article>}{invocations.length>0&&<article><strong>{featureChoiceLabel}</strong><small>{magic.pactMagic?"Permanent Warlock features":"Sorcerer spell-shaping options"}</small><p>{invocations.join(", ")}</p></article>}{patronFeature&&<article><strong>{player.subclass}</strong><small>Subclass feature</small><p>{patronFeature}</p></article>}</div></section>;
}

function LevelUpPanel({ player, options, combatActive, clearNotice, open, setOpen, workshop }: { player:Player; options:NonNullable<GameView["levelUp"]>; combatActive:boolean; clearNotice:()=>void; open:boolean; setOpen:(open:boolean)=>void; workshop:boolean }) {
  const initialNew = options.availableSpells.slice(0,options.newSpellCount).map((spell)=>spell.name);
  const initialBook = [...options.currentSpellbook,...initialNew];
  const initialPrepared = [...options.currentPrepared,...initialNew.filter((spell)=>!options.currentPrepared.includes(spell))].slice(0,options.preparedCount);
  const [newSpells,setNewSpells] = useState<string[]>(initialNew);
  const [prepared,setPrepared] = useState<string[]>(initialPrepared);
  const [expertise,setExpertise] = useState(options.expertiseChoices[0]||"");
  const [subclass,setSubclass] = useState(options.subclassChoices[0]||"");
  const [ability,setAbility] = useState(options.primaryAbility);
  const [newCantrip,setNewCantrip] = useState(options.availableCantrips[0]||"");
  const [invocations,setInvocations] = useState<string[]>([...options.currentInvocations,...options.invocationChoices.slice(0,Math.max(0,options.invocationCount-options.currentInvocations.length)).map((item)=>item.name)]);
  const [saving,setSaving] = useState(false);
  const spellbook = [...new Set([...options.currentSpellbook,...newSpells])];
  const toggleNewSpell = (name:string) => setNewSpells((current)=>current.includes(name)?current.filter((item)=>item!==name):current.length<options.newSpellCount?[...current,name]:current);
  const toggleInvocation = (name:string) => setInvocations((current)=>current.includes(name)?current.filter((item)=>item!==name):current.length<options.invocationCount?[...current,name]:current);
  const togglePrepared = (name:string) => setPrepared((current)=>current.includes(name)?current.filter((item)=>item!==name):current.length<options.preparedCount?[...current,name]:current);
  const valid = newSpells.length===options.newSpellCount && prepared.length===options.preparedCount && prepared.every((spell)=>spellbook.includes(spell)) && invocations.length===options.invocationCount && (!options.expertiseChoices.length||Boolean(expertise)) && (!options.subclassChoices.length||Boolean(subclass)) && (!options.availableCantrips.length||Boolean(newCantrip));
  const submit = async () => { if(!valid||saving)return; setSaving(true); clearNotice(); try { await api("/api/workshop/level-up",{method:"POST",body:JSON.stringify({newSpells,prepared,expertise,subclass,ability,newCantrip,invocations})}); setOpen(false); } finally { setSaving(false); } };
  if (!open) return <section className="level-up-launch"><div><span className="eyebrow">{workshop?"Combat Testers · levels 1–20":"Milestone earned"}</span><h2>{player.name} is ready for {player.className} level {options.nextLevel}</h2><p>Review the class features, choices, Hit Points, and resources before applying the level.</p></div><button disabled={combatActive} onClick={()=>setOpen(true)}>{combatActive?"Finish or reset the fight first":`Complete level ${options.nextLevel}`}</button></section>;
  return <section className="level-up-panel">
    <header><div><span className="eyebrow">{player.className} level {player.level} → {options.nextLevel}</span><h2>Choose the level-up changes</h2><p>Average HP adds {options.hpIncrease}.{options.newSpellCount>0?` Choose ${options.newSpellCount} new spell${options.newSpellCount===1?"":"s"}${options.preparedCount>0?` and finish with ${options.preparedCount} prepared spells`:""}.`:" Review the recorded class features and any choices below."}</p></div><button className="ghost-button" onClick={()=>setOpen(false)}>Cancel</button></header>
    {options.expertiseChoices.length>0&&<label className="level-choice">Scholar expertise<select value={expertise} onChange={(event)=>setExpertise(event.target.value)}>{options.expertiseChoices.map((skill)=><option key={skill}>{skill}</option>)}</select><small>Double the proficiency bonus for this trained knowledge skill.</small></label>}
    {options.subclassChoices.length>0&&<label className="level-choice">{player.className} subclass<select value={subclass} onChange={(event)=>setSubclass(event.target.value)}>{options.subclassChoices.map((item)=><option key={item}>{item}</option>)}</select><small>{options.subclassDescription}</small></label>}
    {options.abilityIncrease&&<label className="level-choice">Ability Score Improvement<select value={ability} onChange={(event)=>setAbility(event.target.value)}>{Object.entries(options.currentAbilities).filter(([,score])=>score<=18).map(([name,score])=><option value={name} key={name}>{name[0].toUpperCase()+name.slice(1)} {score} → {score+2}</option>)}</select><small>Add +2, up to the normal maximum of 20.</small></label>}
    {options.availableCantrips.length>0&&<label className="level-choice cantrip-choice">New cantrip<select value={newCantrip} onChange={(event)=>setNewCantrip(event.target.value)}>{options.availableCantrips.map((item)=><option key={item}>{item}</option>)}</select><small><b>Cast freely:</b> {options.spellSummaries[newCantrip]}</small></label>}
    {options.featureNotes.map((note)=><p className="level-feature-note" key={note}>{note}</p>)}
    {options.invocationCount>0&&<fieldset className="invocation-choices"><legend>{options.choiceFeatureLabel||"Eldritch Invocations"} <b>{invocations.length}/{options.invocationCount}</b></legend>{[...options.currentInvocations.map((name)=>({name,description:"Already known · locked for this level-up"})),...options.invocationChoices].map((item)=>{const locked=options.currentInvocations.includes(item.name);return <label className={`${invocations.includes(item.name)?"selected":""} ${locked?"locked":""}`} key={item.name}><input type="checkbox" disabled={locked} checked={invocations.includes(item.name)} onChange={()=>toggleInvocation(item.name)}/><span><strong>{item.name}</strong><small>{item.description}</small></span></label>})}</fieldset>}
    {(options.newSpellCount>0||options.availableSpells.length>0)&&<div className="level-spell-columns">
      <fieldset><legend>1 · Add {options.newSpellCount} spell{options.newSpellCount===1?"":"s"} <b>{newSpells.length}/{options.newSpellCount}</b></legend><p className="choice-help">Only spells of a level you can cast are shown. Earlier permanent choices have already been removed from this list.</p><div className="level-spell-list">{options.availableSpells.map((spell)=><label title={spell.description} key={spell.name} className={newSpells.includes(spell.name)?"selected":""}><input type="checkbox" checked={newSpells.includes(spell.name)} onChange={()=>toggleNewSpell(spell.name)}/><span><strong>{spell.name}</strong><small>Level {spell.level} · eligible now</small><em>{spell.description}</em></span></label>)}</div></fieldset>
      <fieldset><legend>2 · {options.usesSpellbook?"Prepare spells":"Spells known after levelling"} <b>{prepared.length}/{options.preparedCount}</b></legend><p className="choice-help">{options.usesSpellbook?"Wizard preparations may be changed from the spellbook after a Long Rest.":"Previously learned Warlock spells stay checked and locked; this level adds one new choice."}</p><div className="level-spell-list">{spellbook.map((spell)=>{const locked=!options.usesSpellbook&&options.currentPrepared.includes(spell);return <label title={options.spellSummaries[spell]} key={spell} className={`${prepared.includes(spell)?"selected":""} ${locked?"locked":""}`}><input type="checkbox" disabled={locked} checked={prepared.includes(spell)} onChange={()=>togglePrepared(spell)}/><span><strong>{spell}</strong><small>{locked?"Previously learned · locked":newSpells.includes(spell)?"New this level":"In spellbook"}</small><em>{options.spellSummaries[spell]}</em></span></label>})}</div></fieldset>
    </div>}
    <footer><p>After saving: level {options.nextLevel}, +{options.hpIncrease} maximum HP{options.nextSlots.length?`, ${options.nextSlots.map((slot)=>`${slot.count} level-${slot.level} ${slot.label}`).join(" · ")}`:""}.</p><button disabled={!valid||saving} onClick={()=>void submit()}>{saving?"Applying level…":`Confirm level ${options.nextLevel}`}</button></footer>
  </section>;
}

function WorldMap({ world, campaign, theme }: { world:string; campaign:string; theme:UniverseTheme }) {
  const stage=campaign.includes("Hollow Star")?2:campaign.includes("Briarwatch")?1:0;
  const places=[
    {name:"Eldervale City",detail:"The Crooked Lantern",x:268,y:322},
    {name:"Briarwatch",detail:"Eastern border road",x:650,y:220},
    {name:"Astronomer's Court",detail:"The capital heights",x:405,y:108},
  ].slice(0,stage+1);
  const current=places[places.length-1];
  return <section className="world-map-view"><header><div><span className="eyebrow">{theme.terms.map}</span><h1>{world}</h1><p>{theme.mapTreatment}. New regions and routes appear only when this {theme.terms.content.toLowerCase()} establishes them.</p></div><div className="world-location"><span>You are here</span><strong>{current.name}</strong><small>{current.detail}</small></div></header><div className="world-map-frame"><svg viewBox="0 0 900 470" role="img" aria-label={`${theme.terms.map} of ${world}, with the ${theme.terms.party.toLowerCase()} at ${current.name}`}>
    <defs><linearGradient id="atlas-land" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5b4628"/><stop offset="1" stopColor="#2a2318"/></linearGradient><pattern id="atlas-paper" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1"/></pattern><filter id="atlas-shadow"><feDropShadow dx="0" dy="7" stdDeviation="8" floodOpacity=".55"/></filter></defs>
    <rect className="atlas-paper" x="1" y="1" width="898" height="468" rx="4"/><path className="atlas-land" filter="url(#atlas-shadow)" d="M86 254 C105 139 215 58 350 66 C440 15 588 52 625 126 C739 131 828 204 811 307 C793 405 681 437 578 407 C492 456 346 441 294 389 C198 407 103 354 86 254Z"/>
    <path className="atlas-river" d="M353 74 C335 133 402 167 383 219 C365 269 279 283 298 332 C312 370 381 383 402 428"/><path className="atlas-road" d="M268 322 C330 280 397 265 474 264 C548 262 592 244 650 220"/><path className="atlas-road faint" d="M268 322 C315 252 352 180 405 108"/>
    <g className="atlas-mountains"><path d="M126 215 l30-57 32 57 24-42 38 67 M535 120 l35-61 35 61 24-42 41 70 M710 335 l28-54 32 54 22-38 34 62"/></g><g className="atlas-woods"><path d="M185 304 l12-29 12 29 h-8 l13 27 h-34 l13-27z M215 288 l12-29 12 29 h-8 l13 27 h-34 l13-27z M570 337 l12-29 12 29 h-8 l13 27 h-34 l13-27z M604 352 l12-29 12 29 h-8 l13 27 h-34 l13-27z"/></g>
    <text className="atlas-region" x="145" y="120">THE WESTERN MARCHES</text><text className="atlas-region" x="605" y="387">ASHEN EAST</text><text className="atlas-water-label" x="338" y="242" transform="rotate(-73 338 242)">RIVER VEY</text>
    {places.map((place,index)=><g className={`atlas-place ${index===places.length-1?"current":""}`} key={place.name} transform={`translate(${place.x} ${place.y})`}><circle r={index===places.length-1?13:9}/><path d="M-5 0 H5 M0-5 V5"/><text x="18" y="-3">{place.name}</text><text className="atlas-detail" x="18" y="13">{place.detail}</text></g>)}
  </svg><div className="atlas-legend"><span><i className="current"/>Current region</span><span><i/>Known place</span><span><b/>Known route</span></div></div></section>;
}

function FoundMaps({ inventory, theme }: { inventory:Array<{owner:string;item:Player["inventory"][number]}>; theme:UniverseTheme }) {
  const maps=inventory.filter(({item})=>/\b(map|chart|floor ?plan|plans)\b/i.test(item.name));
  if (!maps.length) return null;
  return <section className="found-map-shelf"><div className="found-map-heading"><div><span className="eyebrow">Found handouts</span><h2>Maps carried by the {theme.terms.party.toLowerCase()}</h2></div><small>{maps.length} found map{maps.length===1?"":"s"}</small></div><div className="found-map-list">{maps.map(({owner,item})=><article className="found-map-card" key={`${owner}-${item.id}`}><svg viewBox="0 0 280 160" role="img" aria-label={`${item.name}, carried by ${owner}`}><rect x="4" y="4" width="272" height="152"/><path d="M24 34 H112 V72 H158 V126 H246 M112 72 V126 H55"/><circle cx="24" cy="34" r="5"/><circle cx="112" cy="72" r="5"/><circle cx="158" cy="126" r="5"/><circle cx="246" cy="126" r="5"/><text x="20" y="24">INN</text><text x="58" y="145">PANTRY</text><text x="190" y="145">MARKED ROUTE</text></svg><div><span className="eyebrow">Carried by {owner}</span><h3>{item.name}</h3><p>{item.notes||`A map recovered during the ${theme.terms.content.toLowerCase()}. It records only established markings.`}</p></div></article>)}</div></section>;
}

type MapArea = { key:string; index:number; x:number; y:number; w:number; h:number; label:string; kind:string; connectsTo:string[] };
function MapTileObjects({ area, bespoke }: { area:MapArea; bespoke:boolean }) {
  const {x,y,w,h,kind}=area; const cx=x+w/2,cy=y+h/2;
  if (kind==="road") return <g className="tile-objects road"><path d={`M ${x+18} ${cy+18} C ${x+w*.28} ${y+h*.2}, ${x+w*.62} ${y+h*.82}, ${x+w-18} ${cy-15}`}/><circle cx={x+w*.2} cy={y+h*.25} r="7"/><circle cx={x+w*.72} cy={y+h*.72} r="9"/><path d={`M${x+w*.12} ${y+h*.72}l10-24 10 24h-6l8 18h-28l8-18z M${x+w*.82} ${y+h*.22}l10-24 10 24h-6l8 18h-28l8-18z`}/></g>;
  if (kind==="outdoor") return <g className="tile-objects outdoor"><path d={`M${x+18} ${y+h*.3}H${x+w-18} M${x+18} ${y+h*.7}H${x+w-18}`}/><circle cx={cx} cy={cy} r={Math.min(w,h)*.14}/><circle cx={cx} cy={cy} r="5"/><path d={`M${x+w*.18} ${cy}l9-22 9 22h-5l7 15h-22l7-15z M${x+w*.82} ${cy}l9-22 9 22h-5l7 15h-22l7-15z`}/></g>;
  if (kind==="ruin") return <g className="tile-objects ruin"><path d={`M${x+20} ${y+h*.28}h${w*.28}v${h*.22}h${w*.18} M${x+w*.64} ${y+20}v${h*.26}h${w*.24} M${x+w*.55} ${y+h*.72}h${w*.3}`}/><circle cx={x+w*.22} cy={y+h*.77} r="7"/><circle cx={x+w*.3} cy={y+h*.72} r="5"/><circle cx={x+w*.72} cy={y+h*.64} r="9"/></g>;
  if (kind==="tower") return <g className="tile-objects tower"><circle cx={cx} cy={cy} r={Math.min(w,h)*.27}/><circle cx={cx} cy={cy} r={Math.min(w,h)*.13}/><path d={`M${cx} ${cy-Math.min(w,h)*.27}V${cy+Math.min(w,h)*.27} M${cx-Math.min(w,h)*.27} ${cy}H${cx+Math.min(w,h)*.27}`}/></g>;
  if (kind==="passage") return <g className="tile-objects passage">{[.2,.4,.6,.8].map((part)=><path key={part} d={`M${x+10} ${y+h*part}H${x+w-10}`}/>)}</g>;
  if (!bespoke) return <g className="tile-objects room"><rect x={x+18} y={y+18} width={Math.min(70,w*.25)} height={Math.min(42,h*.25)}/><circle cx={x+w*.72} cy={y+h*.35} r={Math.min(20,h*.12)}/><path d={`M${x+w*.55} ${y+h*.72}H${x+w*.85}`}/></g>;
  return null;
}

function KnownMap({ campaign, locations, theme }: { campaign:string; locations:GameView["knownLocations"]; theme:UniverseTheme }) {
  const [selected,setSelected]=useState(Math.max(0,locations.length-1));
  const [zoom,setZoom]=useState(1);
  useEffect(()=>setSelected(Math.max(0,locations.length-1)),[locations.length]);
  const active=locations[Math.min(selected,Math.max(0,locations.length-1))];
  // Decorations are selected by stable map keys supplied by the adventure rules, never by campaign prose.
  const lantern=campaign.toLowerCase().includes("lantern");
  const discovered:MapArea[]=locations.map((location,index)=>({
    key:location.map?.key||location.id,index,
    x:location.map?.x??65+(index%3)*345,y:location.map?.y??70+Math.floor(index/3)*235,
    w:location.map?.w??245,h:location.map?.h??150,label:location.map?.label||location.name,
    kind:location.map?.kind||"room",connectsTo:location.map?.connectsTo||(index?[locations[index-1].map?.key||locations[index-1].id]:[]),
  }));
  const byKey=new Map(discovered.map((area)=>[area.key,area]));
  const selectArea=(index:number)=>setSelected(index);
  const mapHeight=Math.max(locations[0]?.map?.height||0,540,Math.ceil(locations.length/3)*235+90);
  return <section className="map-view"><header><span className="eyebrow">{theme.terms.party} knowledge</span><h1>{theme.terms.map}</h1><p>A record of places the {theme.terms.party.toLowerCase()} has explored or clearly seen. Hidden rooms, secret routes, and unrevealed locations are never drawn.</p></header><div className="map-canvas"><div className="map-caption"><span>{campaign}</span><div className="map-tools"><strong>{locations.length} mapped place{locations.length===1?"":"s"}</strong><button type="button" aria-label="Zoom map out" onClick={()=>setZoom((value)=>Math.max(.75,value-.25))}>−</button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><button type="button" aria-label="Zoom map in" onClick={()=>setZoom((value)=>Math.min(1.75,value+.25))}>+</button></div></div>{locations.length ? <><div className="floor-map-scroll"><svg className="floor-map" style={{width:`${zoom*100}%`}} viewBox={`0 0 1100 ${mapHeight}`} role="img" aria-label={`${theme.terms.map} for ${campaign}`}>
    <defs><pattern id="floor-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25"/></pattern><pattern id="tile-wood" width="38" height="14" patternUnits="userSpaceOnUse"><rect width="38" height="14"/><path d="M0 1H38 M0 13H38 M11 1V13 M30 1V13"/></pattern><pattern id="tile-stone" width="42" height="28" patternUnits="userSpaceOnUse"><rect width="42" height="28"/><path d="M0 1H42 M0 27H42 M21 1V14 M8 14V27 M36 14V27 M0 14H42"/></pattern><pattern id="tile-earth" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34"/><circle cx="7" cy="10" r="1.5"/><circle cx="25" cy="22" r="2"/><path d="M12 29l6-3"/></pattern><filter id="map-shadow"><feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".55"/></filter></defs>
    <rect className="map-paper" x="1" y="1" width="1098" height={mapHeight-2}/><rect className="map-grid" x="1" y="1" width="1098" height={mapHeight-2}/>
    {discovered.flatMap((area)=>area.connectsTo.map((key)=>{const prior=byKey.get(key);return prior?<path className="map-corridor wide" key={`${key}-${area.key}`} d={`M ${prior.x+prior.w/2} ${prior.y+prior.h/2} L ${area.x+area.w/2} ${area.y+area.h/2}`}/>:null}))}
    {discovered.map((area)=><g key={area.key} className={`floor-room ${area.index===selected?"selected":""} ${area.index===locations.length-1?"current":""}`} role="button" tabIndex={0} aria-label={area.label} onClick={()=>selectArea(area.index)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" ")selectArea(area.index)}}>
      <rect className={`room-floor tile-${area.kind}`} x={area.x} y={area.y} width={area.w} height={area.h}/><path className="room-walls" d={`M ${area.x} ${area.y+area.h} V ${area.y} H ${area.x+area.w} V ${area.y+area.h} H ${area.x} Z`}/><MapTileObjects area={area} bespoke={lantern&&["inn","cellar","mothglass","passage","alcove"].includes(area.key)}/>
      {lantern&&area.key==="inn"&&<g className="map-furniture"><rect x="82" y="92" width="92" height="58"/><path d="M 94 121 H 162 M 128 103 V 139"/><rect x="350" y="90" width="100" height="36"/><circle cx="300" cy="185" r="27"/><circle cx="390" cy="205" r="27"/><circle cx="300" cy="185" r="4"/><circle cx="390" cy="205" r="4"/><path d="M 455 210 h20 M 455 230 h20"/><text className="map-feature-label" x="128" y="165" textAnchor="middle">HEARTH</text><text className="map-feature-label" x="400" y="145" textAnchor="middle">BAR</text><text className="map-feature-label" x="345" y="252" textAnchor="middle">TABLES</text><text className="map-feature-label" x="448" y="275" textAnchor="end">ENTRANCE</text></g>}
      {lantern&&area.key==="cellar"&&<g className="map-furniture"><path d="M 575 105 h75 v42 h-75z M 720 105 h72 v42 h-72z M 575 235 h217"/><circle cx="625" cy="205" r="22"/><circle cx="750" cy="205" r="22"/><text className="map-feature-label" x="612" y="162" textAnchor="middle">STORAGE</text><text className="map-feature-label" x="750" y="162" textAnchor="middle">OLD TOOLS</text><text className="map-feature-label" x="688" y="273" textAnchor="middle">BARRELS</text></g>}
      {lantern&&area.key==="mothglass"&&<g className="map-furniture"><circle cx="685" cy="500" r="52"/><path d="M 685 448 V552 M633 500 H737 M648 463 L722 537 M722 463 L648 537"/><text className="map-feature-label" x="685" y="574" textAnchor="middle">BRASS LANTERN MECHANISM</text></g>}
      {lantern&&area.key==="passage"&&<g className="map-furniture"><path d="M 910 185 V510 M 955 185 V510 M 995 185 V510"/><text className="map-feature-label" x="932" y="350" textAnchor="middle" transform="rotate(-90 932 350)">NARROW STONE PASSAGE</text></g>}
      {lantern&&area.key==="alcove"&&<g className="map-furniture rubble"><path d="M 885 642 l18-26 14 18 17-35 18 32 17-24 21 34 18-17 20 18"/><text className="map-feature-label" x="955" y="594" textAnchor="middle">COLLAPSED STONES</text></g>}
      <text className="room-number" x={area.x+18} y={area.y+27}>{area.index+1}</text><text className="room-label" x={area.x+area.w/2} y={area.y+area.h/2+5} textAnchor="middle">{area.label}</text>
      {area.index===locations.length-1&&<circle className="current-marker" cx={area.x+area.w-18} cy={area.y+18} r="7"/>}
    </g>)}
    {lantern&&discovered.some((area)=>area.key==="cellar")&&<g className="map-stairs"><path d="M485 195 h60 M485 205 h60 M485 215 h60 M485 225 h60 M485 235 h60 M485 245 h60"/><text x="515" y="268" textAnchor="middle">STAIRS DOWN</text></g>}
  </svg></div><article className="map-place-detail"><span className="eyebrow">{selected===locations.length-1?"Latest known location":`Mapped location ${selected+1}`}</span><h2>{active.name}</h2><p>{active.summary}</p></article></> : <div className="empty-map"><strong>The parchment is blank</strong><p>Known locations will be drawn as the party explores.</p></div>}</div></section>;
}

function EventCard({ event, ownPlayer }: { event: StoryEvent; ownPlayer: Player }) {
  if (event.kind === "narration") return <article className={`narration ${event.visibility === "player" ? "private" : ""}`}><span>{event.visibility === "player" ? `Only ${ownPlayer.name} hears this` : event.speaker}</span><p>{event.text}</p></article>;
  if (event.kind === "roll") return <article className="roll-event"><span className="die">◆</span><p>{event.text}</p></article>;
  return <article className="player-event"><span>{event.speaker}</span><p>{event.text}</p></article>;
}

export default App;
