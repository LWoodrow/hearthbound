import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes, randomUUID, scryptSync } from "node:crypto";
import { enrichKnownLocations, locationIsRevealed } from "./adventure-rules.mjs";
import { adventureDefinition } from "./adventure-registry.mjs";

const DEFAULT_WORLD = "world-hearthbound";
const DEFAULT_PARTY = "party-first-company";
export const CLASS_SKILL_RULES = {
  Barbarian:{ count:2, allowed:["Animal Handling","Athletics","Intimidation","Nature","Perception","Survival"] },
  Bard:{ count:3, allowed:["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History","Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance","Persuasion","Religion","Sleight of Hand","Stealth","Survival"] },
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
const CLASS_SUBCLASSES = {Barbarian:"Path of the Berserker",Bard:"College of Lore",Cleric:"Life Domain",Druid:"Circle of the Land",Fighter:"Champion",Monk:"Warrior of the Open Hand",Paladin:"Oath of Devotion",Ranger:"Hunter",Rogue:"Thief",Sorcerer:"Draconic Sorcery",Warlock:"Fiend Patron",Wizard:"Evoker"};
const PRIMARY_ABILITIES = {Barbarian:"strength",Bard:"charisma",Cleric:"wisdom",Druid:"wisdom",Fighter:"strength",Monk:"dexterity",Paladin:"strength",Ranger:"dexterity",Rogue:"dexterity",Sorcerer:"charisma",Warlock:"charisma",Wizard:"intelligence"};
const AVERAGE_HP = {Barbarian:7,Bard:5,Cleric:5,Druid:5,Fighter:6,Monk:5,Paladin:6,Ranger:6,Rogue:5,Sorcerer:4,Warlock:5,Wizard:4};
const CLASS_LEVEL_FEATURES = {
  Barbarian:{1:"Rage, Unarmored Defense, Weapon Mastery",2:"Danger Sense, Reckless Attack",3:"Barbarian Subclass, Primal Knowledge",4:"Ability Score Improvement",5:"Extra Attack, Fast Movement",6:"Subclass feature",7:"Feral Instinct, Instinctive Pounce",8:"Ability Score Improvement",9:"Brutal Strike",10:"Subclass feature",11:"Relentless Rage",12:"Ability Score Improvement",13:"Improved Brutal Strike",14:"Subclass feature",15:"Persistent Rage",16:"Ability Score Improvement",17:"Improved Brutal Strike",18:"Indomitable Might",19:"Epic Boon",20:"Primal Champion"},
  Bard:{1:"Bardic Inspiration, Spellcasting",2:"Expertise, Jack of All Trades",3:"Bard Subclass",4:"Ability Score Improvement",5:"Font of Inspiration",6:"Subclass feature",7:"Countercharm",8:"Ability Score Improvement",9:"Expertise",10:"Magical Secrets",11:"Spell progression",12:"Ability Score Improvement",13:"Spell progression",14:"Subclass feature",15:"Bardic Inspiration d12",16:"Ability Score Improvement",17:"Spell progression",18:"Superior Inspiration",19:"Epic Boon",20:"Words of Creation"},
  Cleric:{1:"Spellcasting, Divine Order",2:"Channel Divinity",3:"Cleric Subclass",4:"Ability Score Improvement",5:"Sear Undead",6:"Subclass feature",7:"Blessed Strikes",8:"Ability Score Improvement",9:"Spell progression",10:"Divine Intervention",11:"Spell progression",12:"Ability Score Improvement",13:"Spell progression",14:"Improved Blessed Strikes",15:"Spell progression",16:"Ability Score Improvement",17:"Subclass feature",18:"Channel Divinity improvement",19:"Epic Boon",20:"Greater Divine Intervention"},
  Druid:{1:"Spellcasting, Druidic, Primal Order",2:"Wild Shape, Wild Companion",3:"Druid Subclass",4:"Ability Score Improvement",5:"Wild Resurgence",6:"Subclass feature",7:"Elemental Fury",8:"Ability Score Improvement",9:"Spell progression",10:"Subclass feature",11:"Spell progression",12:"Ability Score Improvement",13:"Spell progression",14:"Subclass feature",15:"Improved Elemental Fury",16:"Ability Score Improvement",17:"Spell progression",18:"Beast Spells",19:"Epic Boon",20:"Archdruid"},
  Fighter:{1:"Fighting Style, Second Wind, Weapon Mastery",2:"Action Surge, Tactical Mind",3:"Fighter Subclass",4:"Ability Score Improvement",5:"Extra Attack, Tactical Shift",6:"Ability Score Improvement",7:"Subclass feature",8:"Ability Score Improvement",9:"Indomitable, Tactical Master",10:"Subclass feature",11:"Two Extra Attacks",12:"Ability Score Improvement",13:"Indomitable improvement, Studied Attacks",14:"Ability Score Improvement",15:"Subclass feature",16:"Ability Score Improvement",17:"Action Surge and Indomitable improvement",18:"Subclass feature",19:"Epic Boon",20:"Three Extra Attacks"},
  Monk:{1:"Martial Arts, Unarmored Defense",2:"Monk's Focus, Unarmored Movement, Uncanny Metabolism",3:"Deflect Attacks, Monk Subclass",4:"Ability Score Improvement, Slow Fall",5:"Extra Attack, Stunning Strike",6:"Empowered Strikes, Subclass feature",7:"Evasion",8:"Ability Score Improvement",9:"Acrobatic Movement",10:"Heightened Focus, Self-Restoration",11:"Subclass feature",12:"Ability Score Improvement",13:"Deflect Energy",14:"Disciplined Survivor",15:"Perfect Focus",16:"Ability Score Improvement",17:"Subclass feature",18:"Superior Defense",19:"Epic Boon",20:"Body and Mind"},
  Paladin:{1:"Lay On Hands, Spellcasting, Weapon Mastery",2:"Fighting Style, Paladin's Smite",3:"Channel Divinity, Paladin Subclass",4:"Ability Score Improvement",5:"Extra Attack, Faithful Steed",6:"Aura of Protection",7:"Subclass feature",8:"Ability Score Improvement",9:"Abjure Foes",10:"Aura of Courage",11:"Radiant Strikes",12:"Ability Score Improvement",13:"Restoring Touch",14:"Aura expansion",15:"Subclass feature",16:"Ability Score Improvement",17:"Spell progression",18:"Aura expansion",19:"Epic Boon",20:"Subclass capstone"},
  Ranger:{1:"Spellcasting, Favored Enemy, Weapon Mastery",2:"Deft Explorer, Fighting Style",3:"Ranger Subclass",4:"Ability Score Improvement",5:"Extra Attack",6:"Roving",7:"Subclass feature",8:"Ability Score Improvement",9:"Expertise",10:"Tireless",11:"Subclass feature",12:"Ability Score Improvement",13:"Relentless Hunter",14:"Nature's Veil",15:"Subclass feature",16:"Ability Score Improvement",17:"Precise Hunter",18:"Feral Senses",19:"Epic Boon",20:"Foe Slayer"},
  Rogue:{1:"Expertise, Sneak Attack, Thieves' Cant, Weapon Mastery",2:"Cunning Action",3:"Rogue Subclass, Steady Aim",4:"Ability Score Improvement",5:"Cunning Strike, Uncanny Dodge",6:"Expertise",7:"Evasion, Reliable Talent",8:"Ability Score Improvement",9:"Subclass feature",10:"Ability Score Improvement",11:"Improved Cunning Strike",12:"Ability Score Improvement",13:"Subclass feature",14:"Devious Strikes",15:"Slippery Mind",16:"Ability Score Improvement",17:"Subclass feature",18:"Elusive",19:"Epic Boon",20:"Stroke of Luck"},
  Sorcerer:{1:"Spellcasting, Innate Sorcery",2:"Font of Magic, Metamagic",3:"Sorcerer Subclass",4:"Ability Score Improvement",5:"Sorcerous Restoration",6:"Subclass feature",7:"Sorcery Incarnate",8:"Ability Score Improvement",9:"Spell progression",10:"Metamagic improvement",11:"Spell progression",12:"Ability Score Improvement",13:"Spell progression",14:"Subclass feature",15:"Spell progression",16:"Ability Score Improvement",17:"Metamagic improvement",18:"Subclass feature",19:"Epic Boon",20:"Arcane Apotheosis"},
  Warlock:{1:"Eldritch Invocations, Pact Magic",2:"Magical Cunning",3:"Warlock Subclass",4:"Ability Score Improvement",5:"Invocation and Pact Magic progression",6:"Subclass feature",7:"Invocation and Pact Magic progression",8:"Ability Score Improvement",9:"Contact Patron",10:"Subclass feature",11:"Mystic Arcanum (level 6)",12:"Ability Score Improvement",13:"Mystic Arcanum (level 7)",14:"Subclass feature",15:"Mystic Arcanum (level 8)",16:"Ability Score Improvement",17:"Mystic Arcanum (level 9)",18:"Eldritch Invocation",19:"Epic Boon",20:"Eldritch Master"},
  Wizard:{1:"Spellcasting, Ritual Adept, Arcane Recovery",2:"Scholar",3:"Wizard Subclass",4:"Ability Score Improvement",5:"Memorize Spell",6:"Subclass feature",7:"Spell progression",8:"Ability Score Improvement",9:"Spell progression",10:"Subclass feature",11:"Spell progression",12:"Ability Score Improvement",13:"Spell progression",14:"Subclass feature",15:"Spell progression",16:"Ability Score Improvement",17:"Spell progression",18:"Spell Mastery",19:"Epic Boon",20:"Signature Spells"}
};
const STARTING_INVENTORY = {
  Barbarian:[{name:"Greataxe"},{name:"Handaxe",quantity:4},{name:"Explorer's pack"},{name:"Gold pieces",quantity:15}],
  Bard:[{name:"Leather armor",status:"equipped"},{name:"Dagger",quantity:2},{name:"Musical instrument"},{name:"Entertainer's pack"},{name:"Gold pieces",quantity:19}],
  Cleric:[{name:"Chain shirt",status:"equipped"},{name:"Shield",status:"equipped"},{name:"Mace"},{name:"Holy symbol"},{name:"Priest's pack"},{name:"Gold pieces",quantity:7}],
  Druid:[{name:"Leather armor",status:"equipped"},{name:"Shield",status:"equipped"},{name:"Sickle"},{name:"Druidic focus"},{name:"Explorer's pack"},{name:"Gold pieces",quantity:9}],
  Fighter:[{name:"Chain mail",status:"equipped"},{name:"Greatsword"},{name:"Flail"},{name:"Javelin",quantity:8},{name:"Dungeoneer's pack"},{name:"Gold pieces",quantity:4}],
  Monk:[{name:"Spear"},{name:"Dagger",quantity:5},{name:"Artisan's tools or musical instrument"},{name:"Explorer's pack"},{name:"Gold pieces",quantity:11}],
  Paladin:[{name:"Chain mail",status:"equipped"},{name:"Shield",status:"equipped"},{name:"Longsword"},{name:"Javelin",quantity:6},{name:"Holy symbol"},{name:"Priest's pack"},{name:"Gold pieces",quantity:9}],
  Ranger:[{name:"Studded leather armor",status:"equipped"},{name:"Scimitar"},{name:"Shortsword"},{name:"Longbow"},{name:"Arrow",quantity:20},{name:"Druidic focus"},{name:"Explorer's pack"},{name:"Gold pieces",quantity:7}],
  Rogue:[{name:"Leather armor",status:"equipped"},{name:"Dagger",quantity:2},{name:"Shortsword"},{name:"Shortbow"},{name:"Arrow",quantity:20},{name:"Thieves' tools"},{name:"Burglar's pack"},{name:"Gold pieces",quantity:8}],
  Sorcerer:[{name:"Spear"},{name:"Dagger",quantity:2},{name:"Arcane focus"},{name:"Dungeoneer's pack"},{name:"Gold pieces",quantity:28}],
  Warlock:[{name:"Leather armor",status:"equipped"},{name:"Sickle"},{name:"Dagger",quantity:2},{name:"Arcane focus"},{name:"Scholar's pack"},{name:"Gold pieces",quantity:15}],
  Wizard:[{name:"Dagger",quantity:2},{name:"Arcane focus"},{name:"Robe",status:"equipped"},{name:"Spellbook"},{name:"Scholar's pack"},{name:"Gold pieces",quantity:5}],
};
const SPELLCASTING_DEFAULTS = {
  Bard:{ ability:"charisma", cantrips:["Dancing Lights","Vicious Mockery"], prepared:["Dissonant Whispers","Faerie Fire","Healing Word","Thunderwave"], spellbook:[], slots:{ 1:{ current:2, max:2 } } },
  Cleric:{ ability:"wisdom", cantrips:["Guidance","Sacred Flame","Thaumaturgy"], prepared:["Bless","Cure Wounds","Guiding Bolt","Shield of Faith"], spellbook:[], slots:{ 1:{ current:2, max:2 } } },
  Druid:{ ability:"wisdom", cantrips:["Druidcraft","Produce Flame"], prepared:["Cure Wounds","Entangle","Faerie Fire","Thunderwave"], spellbook:[], slots:{ 1:{ current:2, max:2 } } },
  Paladin:{ ability:"charisma", cantrips:[], prepared:["Bless","Cure Wounds"], spellbook:[], slots:{ 1:{ current:2, max:2 } } },
  Ranger:{ ability:"wisdom", cantrips:[], prepared:["Cure Wounds","Hail of Thorns","Hunter's Mark"], spellbook:[], slots:{ 1:{ current:2, max:2 } } },
  Sorcerer:{ ability:"charisma", cantrips:["Light","Prestidigitation","Shocking Grasp","Sorcerous Burst"], prepared:["Burning Hands","Detect Magic"], spellbook:[], slots:{ 1:{ current:2, max:2 } }, metamagic:[], sorceryPoints:{current:0,max:0} },
  Warlock:{ ability:"charisma", cantrips:["Eldritch Blast","Prestidigitation"], prepared:["Charm Person","Hex"], spellbook:[], slots:{ 1:{ current:1, max:1 } }, pactMagic:true, invocations:["Pact of the Tome"] },
  Wizard:{ ability:"intelligence", cantrips:["Light","Mage Hand","Ray of Frost"], prepared:["Mage Armor","Magic Missile","Sleep","Thunderwave"], spellbook:["Detect Magic","Feather Fall","Mage Armor","Magic Missile","Sleep","Thunderwave"], slots:{ 1:{ current:2, max:2 } } },
};
const WIZARD_LEVELS = {
  1:{ cantrips:3, prepared:4, slots:{1:2} }, 2:{ cantrips:3, prepared:5, slots:{1:3} }, 3:{ cantrips:3, prepared:6, slots:{1:4,2:2} },
  4:{ cantrips:4, prepared:7, slots:{1:4,2:3} }, 5:{ cantrips:4, prepared:9, slots:{1:4,2:3,3:2} },
  6:{cantrips:4,prepared:10,slots:{1:4,2:3,3:3}},7:{cantrips:4,prepared:11,slots:{1:4,2:3,3:3,4:1}},8:{cantrips:4,prepared:12,slots:{1:4,2:3,3:3,4:2}},9:{cantrips:4,prepared:14,slots:{1:4,2:3,3:3,4:3,5:1}},10:{cantrips:5,prepared:15,slots:{1:4,2:3,3:3,4:3,5:2}},11:{cantrips:5,prepared:16,slots:{1:4,2:3,3:3,4:3,5:2,6:1}},12:{cantrips:5,prepared:16,slots:{1:4,2:3,3:3,4:3,5:2,6:1}},13:{cantrips:5,prepared:17,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1}},14:{cantrips:5,prepared:18,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1}},15:{cantrips:5,prepared:19,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1}},16:{cantrips:5,prepared:21,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1}},17:{cantrips:5,prepared:22,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1,9:1}},18:{cantrips:5,prepared:23,slots:{1:4,2:3,3:3,4:3,5:3,6:1,7:1,8:1,9:1}},19:{cantrips:5,prepared:24,slots:{1:4,2:3,3:3,4:3,5:3,6:2,7:1,8:1,9:1}},20:{cantrips:5,prepared:25,slots:{1:4,2:3,3:3,4:3,5:3,6:2,7:2,8:1,9:1}},
};
const WARLOCK_LEVELS = {
  1:{ cantrips:2, prepared:2, slots:1, slotLevel:1, invocations:1 },
  2:{ cantrips:2, prepared:3, slots:2, slotLevel:1, invocations:3 },
  3:{ cantrips:2, prepared:4, slots:2, slotLevel:2, invocations:3 },
  4:{ cantrips:3, prepared:5, slots:2, slotLevel:2, invocations:3 },
  5:{ cantrips:3, prepared:6, slots:2, slotLevel:3, invocations:5 },
  6:{cantrips:3,prepared:7,slots:2,slotLevel:3,invocations:5},7:{cantrips:3,prepared:8,slots:2,slotLevel:4,invocations:6},8:{cantrips:3,prepared:9,slots:2,slotLevel:4,invocations:6},9:{cantrips:3,prepared:10,slots:2,slotLevel:5,invocations:7},10:{cantrips:4,prepared:10,slots:2,slotLevel:5,invocations:7},11:{cantrips:4,prepared:11,slots:3,slotLevel:5,invocations:7},12:{cantrips:4,prepared:11,slots:3,slotLevel:5,invocations:8},13:{cantrips:4,prepared:12,slots:3,slotLevel:5,invocations:8},14:{cantrips:4,prepared:12,slots:3,slotLevel:5,invocations:8},15:{cantrips:4,prepared:13,slots:3,slotLevel:5,invocations:9},16:{cantrips:4,prepared:13,slots:3,slotLevel:5,invocations:9},17:{cantrips:4,prepared:14,slots:4,slotLevel:5,invocations:9},18:{cantrips:4,prepared:14,slots:4,slotLevel:5,invocations:10},19:{cantrips:4,prepared:15,slots:4,slotLevel:5,invocations:10},20:{cantrips:4,prepared:15,slots:4,slotLevel:5,invocations:10},
};
const SORCERER_LEVELS = {
  1:{ cantrips:4, prepared:2, points:0, slots:{1:2} },
  2:{ cantrips:4, prepared:4, points:2, slots:{1:3} },
  3:{ cantrips:4, prepared:6, points:3, slots:{1:4,2:2} },
  4:{ cantrips:5, prepared:7, points:4, slots:{1:4,2:3} },
  5:{ cantrips:5, prepared:9, points:5, slots:{1:4,2:3,3:2} },
  6:{cantrips:5,prepared:10,points:6,slots:{1:4,2:3,3:3}},7:{cantrips:5,prepared:11,points:7,slots:{1:4,2:3,3:3,4:1}},8:{cantrips:5,prepared:12,points:8,slots:{1:4,2:3,3:3,4:2}},9:{cantrips:5,prepared:14,points:9,slots:{1:4,2:3,3:3,4:3,5:1}},10:{cantrips:6,prepared:15,points:10,slots:{1:4,2:3,3:3,4:3,5:2}},11:{cantrips:6,prepared:16,points:11,slots:{1:4,2:3,3:3,4:3,5:2,6:1}},12:{cantrips:6,prepared:16,points:12,slots:{1:4,2:3,3:3,4:3,5:2,6:1}},13:{cantrips:6,prepared:17,points:13,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1}},14:{cantrips:6,prepared:17,points:14,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1}},15:{cantrips:6,prepared:18,points:15,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1}},16:{cantrips:6,prepared:18,points:16,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1}},17:{cantrips:6,prepared:19,points:17,slots:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1,9:1}},18:{cantrips:6,prepared:20,points:18,slots:{1:4,2:3,3:3,4:3,5:3,6:1,7:1,8:1,9:1}},19:{cantrips:6,prepared:21,points:19,slots:{1:4,2:3,3:3,4:3,5:3,6:2,7:1,8:1,9:1}},20:{cantrips:6,prepared:22,points:20,slots:{1:4,2:3,3:3,4:3,5:3,6:2,7:2,8:1,9:1}},
};
const HALF_CASTER_SLOTS = {
  1:{1:2},2:{1:2},3:{1:3},4:{1:3},5:{1:4,2:2},6:{1:4,2:2},7:{1:4,2:3},8:{1:4,2:3},9:{1:4,2:3,3:2},10:{1:4,2:3,3:2},11:{1:4,2:3,3:3},12:{1:4,2:3,3:3},13:{1:4,2:3,3:3,4:1},14:{1:4,2:3,3:3,4:1},15:{1:4,2:3,3:3,4:2},16:{1:4,2:3,3:3,4:2},17:{1:4,2:3,3:3,4:3,5:1},18:{1:4,2:3,3:3,4:3,5:1},19:{1:4,2:3,3:3,4:3,5:2},20:{1:4,2:3,3:3,4:3,5:2}
};
function slotsAtLevel(className,level){
  if(className==="Warlock"){const rule=WARLOCK_LEVELS[level];return rule?{[rule.slotLevel]:rule.slots}:{};}
  if(className==="Sorcerer")return SORCERER_LEVELS[level]?.slots||{};
  if(["Bard","Cleric","Druid","Wizard"].includes(className))return WIZARD_LEVELS[level]?.slots||{};
  if(["Paladin","Ranger"].includes(className))return HALF_CASTER_SLOTS[level]||{};
  return {};
}
const SORCERER_SPELL_NAMES = ["Burning Hands","Charm Person","Color Spray","Comprehend Languages","Detect Magic","Disguise Self","Expeditious Retreat","False Life","Feather Fall","Fog Cloud","Grease","Jump","Mage Armor","Magic Missile","Shield","Silent Image","Sleep","Thunderwave","Alter Self","Blindness/Deafness","Blur","Darkness","Darkvision","Detect Thoughts","Enhance Ability","Enlarge/Reduce","Hold Person","Invisibility","Levitate","Mirror Image","Misty Step","Scorching Ray","Shatter","Spider Climb","Suggestion","Web","Counterspell","Dispel Magic","Fear","Fly","Gaseous Form","Haste","Hypnotic Pattern","Lightning Bolt","Major Image","Protection from Energy","Sleet Storm","Slow","Stinking Cloud"];
const SORCERER_CANTRIPS = ["Acid Splash","Chill Touch","Dancing Lights","Fire Bolt","Light","Mage Hand","Mending","Message","Minor Illusion","Poison Spray","Prestidigitation","Ray of Frost","Shocking Grasp","Sorcerous Burst","Thunderclap","True Strike"];
const METAMAGIC_OPTIONS = [
  {name:"Careful Spell",description:"Spend 1 Sorcery Point to protect selected creatures from a spell's saving throw effects."},
  {name:"Distant Spell",description:"Spend 1 Sorcery Point to double a ranged spell's range or make a Touch spell reach 30 feet."},
  {name:"Empowered Spell",description:"Spend 1 Sorcery Point to reroll a number of spell damage dice up to your Charisma modifier."},
  {name:"Extended Spell",description:"Spend 1 Sorcery Point to double a spell's duration and gain Advantage on its Concentration saves."},
  {name:"Heightened Spell",description:"Spend 2 Sorcery Points to give one target Disadvantage on saves against the spell."},
  {name:"Quickened Spell",description:"Spend 2 Sorcery Points to cast an Action spell as a Bonus Action, subject to the levelled-spell limit."},
  {name:"Seeking Spell",description:"Spend 1 Sorcery Point to reroll a missed spell attack."},
  {name:"Subtle Spell",description:"Spend 1 Sorcery Point to cast without Verbal, Somatic, or most Material components."},
  {name:"Transmuted Spell",description:"Spend 1 Sorcery Point to change a spell's elemental damage type."},
  {name:"Twinned Spell",description:"Spend 1 Sorcery Point to increase a spell that can target another creature when cast at a higher level."},
];
const WARLOCK_SPELLS = [
  {name:"Armor of Agathys",level:1},{name:"Arms of Hadar",level:1},{name:"Charm Person",level:1},{name:"Comprehend Languages",level:1},{name:"Detect Magic",level:1},{name:"Expeditious Retreat",level:1},{name:"Hellish Rebuke",level:1},{name:"Hex",level:1},{name:"Protection from Evil and Good",level:1},{name:"Speak with Animals",level:1},{name:"Unseen Servant",level:1},{name:"Witch Bolt",level:1},
  {name:"Cloud of Daggers",level:2},{name:"Crown of Madness",level:2},{name:"Darkness",level:2},{name:"Hold Person",level:2},{name:"Invisibility",level:2},{name:"Mind Spike",level:2},{name:"Mirror Image",level:2},{name:"Misty Step",level:2},{name:"Spider Climb",level:2},{name:"Suggestion",level:2},
  {name:"Counterspell",level:3},{name:"Dispel Magic",level:3},{name:"Fear",level:3},{name:"Fly",level:3},{name:"Gaseous Form",level:3},{name:"Hunger of Hadar",level:3},{name:"Hypnotic Pattern",level:3},{name:"Major Image",level:3},{name:"Remove Curse",level:3},{name:"Sending",level:3},{name:"Vampiric Touch",level:3},
];
const WARLOCK_CANTRIPS = ["Chill Touch","Eldritch Blast","Mage Hand","Message","Minor Illusion","Poison Spray","Prestidigitation","Thunderclap","True Strike"];
const WARLOCK_INVOCATIONS = [
  {name:"Agonizing Blast",description:"Add your Charisma modifier to the damage of Eldritch Blast."},
  {name:"Armor of Shadows",description:"Cast Mage Armor on yourself without spending a spell slot."},
  {name:"Eldritch Mind",description:"Gain Advantage on Constitution saves made to maintain Concentration."},
  {name:"Fiendish Vigor",description:"Cast False Life on yourself without spending a spell slot."},
  {name:"Mask of Many Faces",description:"Cast Disguise Self without spending a spell slot."},
  {name:"Misty Visions",description:"Cast Silent Image without spending a spell slot."},
  {name:"Otherworldly Leap",description:"Cast Jump on yourself without spending a spell slot."},
  {name:"Pact of the Blade",description:"Conjure or bond with a pact weapon and attack with Charisma."},
  {name:"Pact of the Chain",description:"Learn Find Familiar and summon an empowered familiar."},
  {name:"Pact of the Tome",description:"Gain a Book of Shadows containing three extra cantrips."},
  {name:"Repelling Blast",description:"Push a creature hit by Eldritch Blast up to 10 feet away."},
];
const WIZARD_SPELLS = [
  {name:"Alarm",level:1},{name:"Burning Hands",level:1},{name:"Charm Person",level:1},{name:"Color Spray",level:1},{name:"Comprehend Languages",level:1},{name:"Detect Magic",level:1},{name:"Disguise Self",level:1},{name:"False Life",level:1},{name:"Feather Fall",level:1},{name:"Find Familiar",level:1},{name:"Fog Cloud",level:1},{name:"Grease",level:1},{name:"Identify",level:1},{name:"Jump",level:1},{name:"Longstrider",level:1},{name:"Mage Armor",level:1},{name:"Magic Missile",level:1},{name:"Shield",level:1},{name:"Silent Image",level:1},{name:"Sleep",level:1},{name:"Thunderwave",level:1},{name:"Unseen Servant",level:1},
  {name:"Alter Self",level:2},{name:"Blindness/Deafness",level:2},{name:"Blur",level:2},{name:"Darkness",level:2},{name:"Darkvision",level:2},{name:"Detect Thoughts",level:2},{name:"Enhance Ability",level:2},{name:"Enlarge/Reduce",level:2},{name:"Flaming Sphere",level:2},{name:"Hold Person",level:2},{name:"Invisibility",level:2},{name:"Knock",level:2},{name:"Levitate",level:2},{name:"Mirror Image",level:2},{name:"Misty Step",level:2},{name:"Scorching Ray",level:2},{name:"Shatter",level:2},{name:"Spider Climb",level:2},{name:"Suggestion",level:2},{name:"Web",level:2},
  {name:"Animate Dead",level:3},{name:"Blink",level:3},{name:"Counterspell",level:3},{name:"Dispel Magic",level:3},{name:"Fear",level:3},{name:"Fireball",level:3},{name:"Fly",level:3},{name:"Haste",level:3},{name:"Hypnotic Pattern",level:3},{name:"Lightning Bolt",level:3},{name:"Major Image",level:3},{name:"Remove Curse",level:3},{name:"Sending",level:3},{name:"Slow",level:3},{name:"Water Breathing",level:3},
];
const WIZARD_CANTRIPS = ["Acid Splash","Chill Touch","Dancing Lights","Fire Bolt","Light","Mage Hand","Mending","Message","Minor Illusion","Poison Spray","Prestidigitation","Ray of Frost","Shocking Grasp","Thunderclap","True Strike"];
const SPELL_SUMMARIES = {
  "Acid Splash":"Dexterity save; creatures in a small area take 1d6 Acid damage. Damage improves at higher character levels.",
  "Chill Touch":"Melee spell attack for 1d10 Necrotic damage; the target cannot regain Hit Points until the end of your next turn.",
  "Dancing Lights":"Concentration. Create and move four hovering dim lights, or combine them into one glowing humanoid shape.",
  "Fire Bolt":"120-foot ranged spell attack for 1d10 Fire damage; it can also ignite an unattended flammable object.",
  "Light":"Make a touched object shed bright and dim light for 1 hour; useful when nobody has Darkvision.",
  "Mage Hand":"Create a spectral hand that can move and manipulate small objects from up to 30 feet away.",
  "Mending":"Repair one break or tear in an object. It takes 1 minute to cast and cannot restore lost magic.",
  "Message":"Send a private magical whisper to a creature at range; the recipient can immediately whisper a reply.",
  "Minor Illusion":"Create a brief sound or a motionless image of an object; creatures can investigate to identify the illusion.",
  "Poison Spray":"Constitution save; one nearby creature takes 1d12 Poison damage. Damage improves at higher levels.",
  "Prestidigitation":"Perform harmless minor magic such as cleaning, marking, flavouring, chilling, warming, or creating a sensory effect.",
  "Ray of Frost":"60-foot ranged spell attack for 1d8 Cold damage and reduces the target's Speed by 10 feet for one turn.",
  "Shocking Grasp":"Melee spell attack for 1d8 Lightning damage; the target cannot make Opportunity Attacks until its next turn.",
  "Thunderclap":"Constitution save; creatures within 5 feet take 1d6 Thunder damage. The sound is audible far away.",
  "True Strike":"Make one weapon attack using Intelligence and change its damage to Radiant; it gains extra damage at higher levels.",
  "Eldritch Blast":"120-foot ranged spell attack for 1d10 Force damage. It fires additional beams at higher character levels.",
  "Armor of Agathys":"Gain 5 Temporary Hit Points for 1 hour; while any remain, a creature that hits you with a melee attack takes 5 Cold damage.",
  "Arms of Hadar":"Strength save in a 10-foot area around you; failures take 2d6 Necrotic damage and cannot take Reactions until their next turn.",
  "Expeditious Retreat":"Bonus Action and Concentration. Immediately Dash and take Dash as a Bonus Action on later turns for up to 10 minutes.",
  "Hellish Rebuke":"Reaction after a nearby creature damages you; it makes a Dexterity save against 2d10 Fire damage, taking half on a success.",
  "Hex":"Bonus Action and Concentration. Curse a creature for extra 1d6 Necrotic damage when you hit it and hinder checks using one chosen ability.",
  "Protection from Evil and Good":"Concentration. Protect a willing creature from Aberrations, Celestials, Elementals, Fey, Fiends, and Undead for 10 minutes.",
  "Speak with Animals":"Ritual. For 10 minutes, understand Beasts and communicate simple ideas with them.",
  "Witch Bolt":"60-foot ranged spell attack for 2d12 Lightning damage; Concentration can sustain the arc for automatic damage on later turns.",
  "Cloud of Daggers":"Concentration. Fill a 5-foot cube with spinning blades that deal 4d4 Slashing damage when creatures enter or end a turn there.",
  "Crown of Madness":"Concentration and Wisdom save. Charm a Humanoid and potentially force it to make melee attacks against nearby creatures.",
  "Mind Spike":"Wisdom save for 3d8 Psychic damage, half on a success; on failure you also know the target's location while concentrating.",
  "Gaseous Form":"Concentration. Transform a willing creature into mist with flight, resistance to ordinary damage, and movement through narrow gaps.",
  "Hunger of Hadar":"Concentration. Create a 20-foot-radius sphere of magical darkness and cold that damages creatures entering or ending turns inside.",
  "Vampiric Touch":"Concentration. Make melee spell attacks for 3d6 Necrotic damage and regain Hit Points equal to half the damage dealt.",
  "Alarm":"Ritual. Guard a door, window, or small area for 8 hours and receive a mental or audible warning when it is entered.",
  "Burning Hands":"Dexterity save in a 15-foot cone; deals 3d6 Fire damage, half on a success, and can ignite unattended objects.",
  "Charm Person":"Wisdom save. A Humanoid becomes Charmed by you for 1 hour, but knows afterward that magic influenced it.",
  "Color Spray":"Constitution save in a 15-foot cone; affected creatures are Blinded until the end of your next turn.",
  "Comprehend Languages":"Ritual. For 1 hour, understand the literal meaning of languages you hear or read by touching the writing.",
  "Detect Magic":"Concentration and ritual. Sense nearby magic for 10 minutes and use an action to see its aura and school.",
  "Disguise Self":"Alter your visible appearance, clothing, and equipment for 1 hour; physical inspection can expose the illusion.",
  "False Life":"Give yourself 2d4 + 4 Temporary Hit Points for 1 hour; useful protection before danger begins.",
  "Feather Fall":"Reaction when creatures fall. Up to five targets descend safely instead of taking normal falling damage.",
  "Find Familiar":"Ritual with a material cost. Summon a spirit animal scout that can deliver touch spells and share its senses.",
  "Fog Cloud":"Concentration. Create a heavily obscured 20-foot-radius fog sphere for up to 1 hour.",
  "Grease":"Dexterity save in a 10-foot square; creatures can fall Prone, and the slippery ground lasts 1 minute.",
  "Identify":"Ritual with a costly reusable pearl. Learn a touched magic item's properties or which spells affect a creature or object.",
  "Jump":"Bonus Action. Touch a willing creature and greatly increase its jumping distance for 1 minute.",
  "Longstrider":"Increase a touched creature's Speed by 10 feet for 1 hour without requiring Concentration.",
  "Mage Armor":"For 8 hours, an unarmoured target's base Armor Class becomes 13 plus its Dexterity modifier.",
  "Magic Missile":"Three darts automatically hit visible targets for 1d4 + 1 Force damage each; no attack roll or save.",
  "Shield":"Reaction when hit or targeted by Magic Missile. Gain +5 AC until your next turn and block Magic Missile.",
  "Silent Image":"Concentration. Create and move a convincing silent visual illusion inside a 15-foot cube for up to 10 minutes.",
  "Sleep":"Wisdom save in a 5-foot-radius area; failures become Incapacitated until damaged or shaken awake. Concentration, up to 1 minute.",
  "Thunderwave":"Constitution save in a 15-foot cube; deals 2d8 Thunder damage and pushes failures 10 feet away.",
  "Unseen Servant":"Ritual. Create an invisible, mindless helper for 1 hour to perform simple household tasks.",
  "Alter Self":"Concentration. Gain aquatic adaptation, change appearance, or create magical natural weapons for up to 1 hour.",
  "Blindness/Deafness":"Constitution save; Blind or Deafen one creature for 1 minute. The target repeats the save each turn; no Concentration.",
  "Blur":"Concentration. Attacks against you have Disadvantage for up to 1 minute unless the attacker bypasses the illusion.",
  "Darkness":"Concentration. Fill a 15-foot-radius sphere with magical darkness that Darkvision cannot see through.",
  "Darkvision":"Give a willing touched creature 150-foot Darkvision for 8 hours without requiring Concentration.",
  "Detect Thoughts":"Concentration. Read surface thoughts and probe deeper with a Wisdom save for up to 1 minute.",
  "Enhance Ability":"Concentration. Give one creature Advantage on checks using a chosen ability for up to 1 hour.",
  "Enlarge/Reduce":"Concentration and Constitution save if unwilling. Change a creature's size and alter its weapon damage and physical capability.",
  "Flaming Sphere":"Concentration. Create a movable burning sphere that damages nearby creatures for up to 1 minute.",
  "Hold Person":"Concentration and Wisdom save. Paralyze a Humanoid, with another save at the end of each of its turns.",
  "Invisibility":"Concentration. Make a creature Invisible for up to 1 hour; attacking, dealing damage, or casting a spell ends it.",
  "Knock":"Open a locked or stuck object at 60 feet, but creates a loud sound audible up to 300 feet away.",
  "Levitate":"Concentration and Constitution save if unwilling. Raise one creature or object vertically for up to 10 minutes.",
  "Mirror Image":"Create three illusory duplicates for 1 minute that can cause attacks against you to miss; no Concentration.",
  "Misty Step":"Bonus Action. Teleport up to 30 feet to an unoccupied space you can see.",
  "Scorching Ray":"Make three ranged spell attacks, each dealing 2d6 Fire damage; rays may target one creature or several.",
  "Shatter":"Constitution save in a 10-foot-radius sphere; deals 3d8 Thunder damage, half on a success.",
  "Spider Climb":"Concentration. A willing creature can climb walls and ceilings hands-free for up to 1 hour.",
  "Suggestion":"Concentration and Wisdom save. Magically influence a creature to follow a reasonable course of action for up to 8 hours.",
  "Web":"Concentration. Fill a 20-foot cube with webs that can Restrict creatures and can be burned away.",
  "Animate Dead":"Create or regain control of an undead servant from a corpse or pile of bones for 24 hours.",
  "Blink":"For 1 minute, a die roll at each turn's end may move you briefly to the Ethereal Plane; no Concentration.",
  "Counterspell":"Reaction when you see a spell being cast. Interrupt it automatically at lower levels or make an ability check for stronger magic.",
  "Dispel Magic":"End ongoing spells on a creature, object, or magical effect; level 4+ spells may require an Intelligence check.",
  "Fear":"Concentration and Wisdom save in a 30-foot cone; failures drop held items, become Frightened, and must flee.",
  "Fireball":"Dexterity save in a 20-foot-radius sphere at 150 feet; deals 8d6 Fire damage, half on a success.",
  "Fly":"Concentration. Give a willing creature a 60-foot Fly Speed for up to 10 minutes.",
  "Haste":"Concentration. Improve one creature's Speed, AC, Dexterity saves, and actions, followed by a brief lethargy when it ends.",
  "Hypnotic Pattern":"Concentration and Wisdom save in a 30-foot cube; failures are Charmed and Incapacitated until disturbed.",
  "Lightning Bolt":"Dexterity save along a 100-foot line; deals 8d6 Lightning damage, half on a success.",
  "Major Image":"Concentration. Create a convincing moving illusion with sound, smell, and temperature inside a 20-foot cube.",
  "Remove Curse":"Touch a creature or object to end all curses affecting it; cursed magic items are not destroyed.",
  "Sending":"Send a private message of up to 25 words to a known creature anywhere; it can immediately reply.",
  "Slow":"Concentration and Wisdom save. Hamper up to six creatures' movement, defenses, actions, and spellcasting for up to 1 minute.",
  "Water Breathing":"Ritual. Up to ten willing creatures can breathe underwater for 24 hours.",
};

function defaultSpellcasting(className) {
  return SPELLCASTING_DEFAULTS[className] ? structuredClone(SPELLCASTING_DEFAULTS[className]) : null;
}
const opening = "Rain silvers the lamps of Eldervale as the company reaches the Crooked Lantern. Its painted sign creaks above the public front door, and warm light, conversation, and supper-smoke spill through the taproom windows into the wet street. What do you do?";
const CAMPAIGN_SERIES = {
  id: "the-hollow-road",
  title: "The Hollow Road",
  publicPremise: "Across Eldervale, forgotten roads, abandoned wards, and missing stars are beginning to answer one another. Each adventure ends its immediate danger while uncovering another part of the same mystery.",
  hiddenTruth: "The old roads, Briarwatch signal mirrors, and the vanished Witness constellation are parts of one ancient ward network. Chancellor Oris Vale is reactivating its anchor sites and erasing The Witness so the resulting Hollow Star can serve as a celestial throne. Mara Vey has been following the disturbed anchors without yet knowing Vale is responsible.",
};

const SERIES_EPISODES = {
  "lantern-below": { number:1, hook:"A silver-moth messenger reveals that forgotten routes beneath Eldervale are waking.", hiddenConnection:"Mara's passages are the first disturbed anchor of the ancient ward-road network. Her survey mark contains an incomplete form of The Witness constellation, but neither Mara nor the party should identify it yet.", completionDiscovery:"Mara confirms that the passage beneath the Crooked Lantern is only one of several old routes stirring across Eldervale. Her next lead is a signal mark from Briarwatch, where a tower that has been cold for a century has begun to burn." },
  "ashes-briarwatch": { number:2, hook:"A dead signal tower burns without fuel, carrying the mystery of the old roads to Eldervale's border.", hiddenConnection:"Briarwatch is a second anchor in the same network. Its mirrors once relayed the light of The Witness; Vale's agents altered them to test whether a bound oath could power the empty place left by the erased constellation.", completionDiscovery:"The restored signal mirrors briefly trace a gap in the night sky shaped like a missing constellation. Mara recognises the same geometry in her old-road surveys, and the trail now points to the Astronomer's Court in the capital." },
  "hollow-star": { number:3, hook:"The connected disturbances lead to the capital, where an absent star is drawing forgotten heirs into one shared dream.", hiddenConnection:"This is the convergence of the previous anchors. Evidence from the old road and Briarwatch can expose Vale's alterations and provide alternatives to simply destroying the observatory lens.", completionDiscovery:"The company has followed the Hollow Road from buried passages to burning mirrors and finally to the empty place among the stars. What the network becomes next depends on the choices made at the Astronomer's Court." },
};

function seriesEpisodeForAdventure(adventureId) {
  const id=String(adventureId||"");
  return Object.entries(SERIES_EPISODES).find(([slug])=>id.endsWith(slug))?.[1]||null;
}

function campaignSeriesState(db,partyId){
  const completed=db.prepare("SELECT adventure_id FROM party_adventures WHERE party_id = ? AND status = 'complete'").all(partyId).map((row)=>row.adventure_id);
  const episodes=completed.map((id)=>seriesEpisodeForAdventure(id)).filter(Boolean).sort((a,b)=>a.number-b.number);
  return {id:CAMPAIGN_SERIES.id,title:CAMPAIGN_SERIES.title,hiddenTruth:CAMPAIGN_SERIES.hiddenTruth,completedEpisodes:episodes.map((item)=>item.number),establishedConnections:episodes.map((item)=>item.completionDiscovery)};
}

function adventureStateWithSeries(db,partyId,adventureId,savedState=null){
  const base=initialStateForAdventure(adventureId); const saved=savedState||{}; const episode=seriesEpisodeForAdventure(adventureId);
  return {...base,...saved,adventureBible:{...base.adventureBible,...(saved.adventureBible||{}),campaignSeries:episode?{title:CAMPAIGN_SERIES.title,episode:episode.number,hiddenTruth:CAMPAIGN_SERIES.hiddenTruth,thisEpisodeConnection:episode.hiddenConnection,priorEstablishedConnections:campaignSeriesState(db,partyId).establishedConnections,instruction:"Make this adventure satisfying by itself, but carry forward established connections. Seed at most one subtle series reminder in a scene unless the party actively investigates it. Never reveal a future episode's answer early."}:null}};
}

const initialDmState = {
  dangerClock: 0,
  lanternArrivalStage: 0,
  adventureBible: {
    premise: "Mara Vey sent a living map hidden inside a sealed letter because the old smuggler passages beneath the Crooked Lantern have awakened.",
    immediateGoal: "Use warmth and fresh ink to wake the ink-mite, learn what Mara discovered, and follow its map beneath the inn.",
    letterText: "To whoever still honours the old road: the way below the lantern is not sealed, only forgotten. Warm my silver moth over a flame, give what wakes inside one drop of fresh ink, and follow the line it draws. Do not let the innkeeper see it. — Mara Vey",
    clueChain: ["Warm the silver-moth seal", "Feed the awakened ink-mite fresh ink on paper", "Follow the map it draws to the pantry shelves", "Open the cellar stair and find Mara's abandoned survey mark"],
    concreteFacts: ["The ink-mite is harmless unless burned", "It draws routes it has previously travelled", "The pantry shelves conceal the cellar door", "Mara Vey disappeared eleven days ago"],
    revelationGates: {
      inspectSealedLetter: "Reveal only the unbroken silver-moth wax, dry paper despite the rain, faint warmth, and one soft scratch inside. The contents cannot be read while sealed.",
      deliberatelyOpenLetter: "Reveal the signed letterText and the tiny dormant ink-mite. Do not reveal where its map leads.",
      warmSealAndOfferInk: "The ink-mite wakes and draws a route ending at the pantry shelves. Only now reveal that destination.",
      searchPantry: "Reveal the concealed cellar door and signs that it was used recently. Do not yet explain what lies below.",
      exploreCellar: "Reveal Mara's survey mark and evidence that she entered the old passages. Her fate and full discovery remain unknown.",
    },
  },
  silverMothLetter: { origin: "Mara Vey", contains: "a dormant ink-mite", purpose: "lead the party beneath the inn" },
  cellarDoor: "hidden behind the pantry shelves",
};
const ashesDmState = { dangerClock:0, adventureBible:{ premise:"Briarwatch burns each new moon because an imprisoned cinder wight is projecting fire through the abandoned watchtower's signal mirrors.", immediateGoal:"Reach Briarwatch, compare the burn sites, and break or realign the watchtower mirrors before the next moonrise.", clueChain:["Interview survivors at the east well","Find that flame appeared without consuming lamp oil","Trace identical scorch angles toward the watchtower","Discover the cinder wight bound beneath the signal room"], concreteFacts:["The fires begin at moonrise","Old Captain Sera Holt knows the tower tunnels","Cold iron disrupts the projected flame","The wight wants its military oath formally released"], carryForwardClues:["Mara Vey's old-road survey geometry may be compared with the mirror alignments only if the party completed The Lantern Below."], revelationGates:{ arrival:"Reveal the aftermath and frightened witnesses, not the cause.", interviewSurvivors:"Reveal the moonrise timing and fire without consumed oil.", examineBurnSites:"A successful investigation can reveal the matching angles toward the tower.", enterSignalRoom:"Reveal the altered mirrors, not the bound creature's motive.", confrontWight:"Reveal its oath and desired release through interaction." } } };
const hollowStarDmState = { dangerClock:0, adventureBible:{ premise:"The missing constellation is being used as an empty celestial throne by Chancellor Oris Vale, who is drawing forgotten heirs into a shared coronation dream.", immediateGoal:"Compare the heirs' dreams, investigate the Astronomer's Court, and stop the coronation before the hollow star gains a mortal vessel.", clueChain:["Record the repeated dream phrases","Identify the absent constellation on older charts","Find Vale's altered observatory lens","Interrupt the coronation alignment"], concreteFacts:["The dreams occur at the same bell each night","Each heir sees one different piece of the crown","The old charts name the constellation The Witness","Breaking the lens ends the shared dream but alerts Vale"], revelationGates:{ interviewHeirs:"Reveal only dream details each heir actually shares.", compareAccounts:"Reveal the shared timing and repeated phrases.", researchOldCharts:"Reveal the constellation's old name only after successful research.", inspectObservatory:"Reveal the altered lens through close investigation.", confrontVale:"Reveal his intended vessel and coronation plan through evidence or confession." } } };

const starterAdventures = [
  { slug: "lantern-below", title: "The Lantern Below", synopsis: "A sealed letter and a forgotten stair draw the company beneath a rain-soaked inn.", min: 1, max: 3, milestone: 3, chapter: "Chapter One · An Unexpected Letter", scene: "Outside the Crooked Lantern" },
  { slug: "ashes-briarwatch", title: "Ashes of Briarwatch", synopsis: "A border village burns each new moon, though its abandoned watchtower has been cold for a century.", min: 3, max: 5, milestone: 5, chapter: "Chapter One · Smoke Without Flame", scene: "The Briarwatch Road" },
  { slug: "hollow-star", title: "Crown of the Hollow Star", synopsis: "An empty constellation appears above the capital and forgotten heirs begin dreaming the same coronation.", min: 5, max: 8, milestone: 8, chapter: "Chapter One · The Missing Constellation", scene: "The Astronomer's Court" },
  { slug: "combat-workshop", title: "Testing · Combat Workshop", synopsis: "A disposable training arena for testing weapons, class abilities, spells, items, damage, healing, and combat turns without changing a real adventure.", min: 1, max: 20, milestone: 20, chapter: "Rules Laboratory · No Story Progress", scene: "The Brassbound Training Hall" },
];

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

function seedAdventures(db, worldId) {
  const insert = db.prepare("INSERT OR IGNORE INTO adventures (id, world_id, title, synopsis, min_level, max_level, milestone_level, chapter, opening_scene, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const now = new Date().toISOString();
  for (const item of starterAdventures) insert.run(`${worldId}-${item.slug}`, worldId, item.title, item.synopsis, item.min, item.max, item.milestone, item.chapter, item.scene, now);
  db.prepare("UPDATE adventures SET opening_scene = 'Outside the Crooked Lantern' WHERE world_id = ? AND id LIKE '%-lantern-below'").run(worldId);
}

function seedPartyState(db, partyId, adventureId = `${DEFAULT_WORLD}-lantern-below`) {
  const now = new Date().toISOString();
  const adventure = db.prepare("SELECT * FROM adventures WHERE id = ?").get(adventureId);
  db.prepare("INSERT OR IGNORE INTO party_state (party_id, key, value_json, updated_at) VALUES (?, 'dm', ?, ?)").run(partyId, JSON.stringify(initialStateForAdventure(adventureId)), now);
  if (adventure) rememberKnownLocation(db, partyId, { name: adventure.opening_scene, summary: `The party began ${adventure.title} here.` });
  const eventCount = db.prepare("SELECT COUNT(*) AS count FROM events WHERE party_id = ? AND adventure_id = ?").get(partyId, adventureId).count;
  if (!eventCount) {
    addOpeningEvents(db, partyId, adventure);
  }
  db.prepare("INSERT OR IGNORE INTO party_adventures (party_id, adventure_id, status, started_at) VALUES (?, ?, 'active', ?)").run(partyId, adventureId, now);
  if (!getPartyState(db,partyId,"campaignSeries")) setPartyState(db,partyId,"campaignSeries",campaignSeriesState(db,partyId));
}

function initialStateForAdventure(adventureId) {
  const id = String(adventureId || "");
  if (id.endsWith("lantern-below")) return structuredClone(initialDmState);
  if (id.endsWith("ashes-briarwatch")) return structuredClone(ashesDmState);
  if (id.endsWith("hollow-star")) return structuredClone(hollowStarDmState);
  if (id.endsWith("combat-workshop")) return { dangerClock:0, workshop:true, adventureBible:{ premise:"A consequence-free rules testing arena.", immediateGoal:"Test combat mechanics without story progression.", clueChain:[], concreteFacts:[] } };
  return { dangerClock: 0, adventureBible:{ premise:"A new adventure is beginning.", immediateGoal:"Establish the party's immediate objective through concrete discoveries.", clueChain:[], concreteFacts:[] } };
}

function addOpeningEvents(db, partyId, adventure) {
  const isLantern = String(adventure?.id || "").endsWith("lantern-below");
  const isWorkshop = String(adventure?.id || "").endsWith("combat-workshop");
  const text = isLantern ? opening : isWorkshop ? "Brass lines mark a clean training floor surrounded by padded walls and silent measuring crystals. Choose an opponent and begin whenever you are ready; injuries and test resources will be restored when the fight resets." : `The company arrives at ${adventure?.opening_scene || "the threshold"}, at the beginning of ${adventure?.title || "a new adventure"}. The way ahead is open. What do you do?`;
  addEvent(db, { partyId, adventureId:adventure?.id, visibility: "public", kind: "narration", speaker: "Dungeon Master", text });
  if (isLantern) addEvent(db, { partyId, visibility: "dm", kind: "system", speaker: "DM Ledger", text: "The letter is bait. Its scratching comes from an ink-mite that will trace a map when warmed." });
}

export function createDatabase(filename = process.env.DND_DATABASE || resolve("data", "campaign.sqlite")) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      name TEXT NOT NULL,
      active_adventure_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS adventures (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      title TEXT NOT NULL,
      synopsis TEXT NOT NULL,
      min_level INTEGER NOT NULL,
      max_level INTEGER NOT NULL,
      milestone_level INTEGER NOT NULL,
      chapter TEXT NOT NULL,
      opening_scene TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS party_adventures (
      party_id TEXT NOT NULL,
      adventure_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available','active','paused','complete')),
      started_at TEXT,
      completed_at TEXT,
      PRIMARY KEY(party_id, adventure_id),
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE,
      FOREIGN KEY(adventure_id) REFERENCES adventures(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS party_state (
      party_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(party_id, key),
      FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      world_id TEXT,
      party_id TEXT,
      name TEXT NOT NULL,
      avatar_id TEXT NOT NULL DEFAULT '',
      pronouns TEXT NOT NULL DEFAULT '',
      class_name TEXT NOT NULL,
      species TEXT NOT NULL,
      background TEXT NOT NULL DEFAULT 'Wayfarer',
      alignment TEXT NOT NULL DEFAULT 'Neutral',
      abilities_json TEXT NOT NULL DEFAULT '{}',
      skills_json TEXT NOT NULL DEFAULT '[]',
      equipment_choice TEXT NOT NULL DEFAULT 'recommended',
      backstory TEXT NOT NULL DEFAULT '',
      appearance TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      experience INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 12,
      max_hp INTEGER NOT NULL DEFAULT 12,
      armor_class INTEGER NOT NULL DEFAULT 14,
      spellcasting_json TEXT NOT NULL DEFAULT 'null',
      expertise_json TEXT NOT NULL DEFAULT '[]',
      subclass TEXT NOT NULL DEFAULT '',
      pin_salt TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id TEXT,
      adventure_id TEXT,
      visibility TEXT NOT NULL CHECK (visibility IN ('public','player','dm')),
      player_id TEXT,
      kind TEXT NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY(player_id) REFERENCES players(id)
    );
    CREATE TABLE IF NOT EXISTS campaign_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      status TEXT NOT NULL DEFAULT 'carried' CHECK(status IN ('equipped','carried','stored')),
      notes TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT 'adventure' CHECK(origin IN ('starting','adventure')),
      source_adventure_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    );
  `);

  if (!hasColumn(db, "players", "world_id")) db.exec("ALTER TABLE players ADD COLUMN world_id TEXT");
  if (!hasColumn(db, "players", "party_id")) db.exec("ALTER TABLE players ADD COLUMN party_id TEXT");
  if (!hasColumn(db, "players", "experience")) db.exec("ALTER TABLE players ADD COLUMN experience INTEGER NOT NULL DEFAULT 0");
  if (!hasColumn(db, "players", "background")) db.exec("ALTER TABLE players ADD COLUMN background TEXT NOT NULL DEFAULT 'Wayfarer'");
  if (!hasColumn(db, "players", "alignment")) db.exec("ALTER TABLE players ADD COLUMN alignment TEXT NOT NULL DEFAULT 'Neutral'");
  if (!hasColumn(db, "players", "abilities_json")) db.exec("ALTER TABLE players ADD COLUMN abilities_json TEXT NOT NULL DEFAULT '{}'");
  if (!hasColumn(db, "players", "skills_json")) db.exec("ALTER TABLE players ADD COLUMN skills_json TEXT NOT NULL DEFAULT '[]'");
  if (!hasColumn(db, "players", "equipment_choice")) db.exec("ALTER TABLE players ADD COLUMN equipment_choice TEXT NOT NULL DEFAULT 'recommended'");
  if (!hasColumn(db, "players", "backstory")) db.exec("ALTER TABLE players ADD COLUMN backstory TEXT NOT NULL DEFAULT ''");
  if (!hasColumn(db, "players", "appearance")) db.exec("ALTER TABLE players ADD COLUMN appearance TEXT NOT NULL DEFAULT ''");
  if (!hasColumn(db, "players", "spellcasting_json")) db.exec("ALTER TABLE players ADD COLUMN spellcasting_json TEXT NOT NULL DEFAULT 'null'");
  if (!hasColumn(db, "players", "expertise_json")) db.exec("ALTER TABLE players ADD COLUMN expertise_json TEXT NOT NULL DEFAULT '[]'");
  if (!hasColumn(db, "players", "subclass")) db.exec("ALTER TABLE players ADD COLUMN subclass TEXT NOT NULL DEFAULT ''");
  if (!hasColumn(db, "players", "avatar_id")) db.exec("ALTER TABLE players ADD COLUMN avatar_id TEXT NOT NULL DEFAULT ''");
  if (!hasColumn(db, "events", "party_id")) db.exec("ALTER TABLE events ADD COLUMN party_id TEXT");
  if (!hasColumn(db, "events", "adventure_id")) db.exec("ALTER TABLE events ADD COLUMN adventure_id TEXT");

  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO worlds (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(DEFAULT_WORLD, "Eldervale", "A rain-dark realm of old roads, buried kingdoms, and troublesome stars.", now);
  seedAdventures(db, DEFAULT_WORLD);
  const firstAdventure = `${DEFAULT_WORLD}-lantern-below`;
  db.prepare("INSERT OR IGNORE INTO parties (id, world_id, name, active_adventure_id, created_at) VALUES (?, ?, ?, ?, ?)").run(DEFAULT_PARTY, DEFAULT_WORLD, "The First Company", firstAdventure, now);
  db.prepare("UPDATE players SET world_id = ? WHERE world_id IS NULL OR world_id = ''").run(DEFAULT_WORLD);
  db.prepare("UPDATE players SET party_id = ? WHERE party_id IS NULL OR party_id = ''").run(DEFAULT_PARTY);
  for (const row of db.prepare("SELECT id, class_name, skills_json FROM players").all()) {
    const rule=CLASS_SKILL_RULES[row.class_name]; if(!rule) continue;
    const saved=JSON.parse(row.skills_json||"[]"); const valid=[...new Set(saved.filter((skill)=>rule.allowed.includes(skill)))].slice(0,rule.count);
    for(const skill of rule.allowed){if(valid.length>=rule.count)break;if(!valid.includes(skill))valid.push(skill);}
    if(JSON.stringify(valid)!==JSON.stringify(saved)) db.prepare("UPDATE players SET skills_json=? WHERE id=?").run(JSON.stringify(valid),row.id);
  }
  db.prepare("UPDATE events SET party_id = ? WHERE party_id IS NULL OR party_id = ''").run(DEFAULT_PARTY);
  db.prepare("UPDATE events SET adventure_id = (SELECT active_adventure_id FROM parties WHERE parties.id = events.party_id) WHERE adventure_id IS NULL OR adventure_id = ''").run();
  db.prepare("DELETE FROM inventory_items WHERE lower(trim(name)) IN ('cotton', 'sir cotton woltanade floof the 67th')").run();

  const oldDm = db.prepare("SELECT value_json FROM campaign_state WHERE key = 'dm'").get();
  db.prepare("INSERT OR IGNORE INTO party_state (party_id, key, value_json, updated_at) VALUES (?, 'dm', ?, ?)").run(DEFAULT_PARTY, oldDm?.value_json || JSON.stringify(initialDmState), now);
  seedPartyState(db, DEFAULT_PARTY, firstAdventure);
  for (const row of db.prepare("SELECT p.id AS party_id, a.id AS adventure_id, a.title, a.opening_scene FROM parties p JOIN adventures a ON a.id = p.active_adventure_id").all()) {
    if (!getKnownLocations(db, row.party_id).length) rememberKnownLocation(db, row.party_id, { name: row.opening_scene, summary: `The party began ${row.title} here.` });
    const baseState = initialStateForAdventure(row.adventure_id);
    const savedState = getPartyState(db, row.party_id, "dm") || {};
    const mergedState = { ...adventureStateWithSeries(db,row.party_id,row.adventure_id,savedState), silverMothLetter:{ ...(baseState.silverMothLetter || {}), ...(savedState.silverMothLetter || {}) } };
    if (String(row.adventure_id).endsWith("lantern-below") && !Object.prototype.hasOwnProperty.call(savedState,"lanternArrivalStage")) mergedState.lanternArrivalStage = 2;
    if (String(row.adventure_id).endsWith("lantern-below") && Number(mergedState.clueStage || 0) === 3) {
      const enteredChamber = db.prepare("SELECT 1 FROM events WHERE party_id = ? AND visibility = 'public' AND kind = 'narration' AND text LIKE '%ornate lantern%' AND text LIKE '%chamber%' LIMIT 1").get(row.party_id);
      if (enteredChamber) mergedState.clueStage = 5;
    }
    setPartyState(db, row.party_id, "dm", mergedState);
  }
  for(const row of db.prepare("SELECT party_id, adventure_id FROM party_adventures WHERE status = 'complete'").all()){
    const episode=seriesEpisodeForAdventure(row.adventure_id); if(!episode)continue;
    const exists=db.prepare("SELECT 1 FROM events WHERE party_id = ? AND adventure_id = ? AND speaker = 'The Hollow Road' LIMIT 1").get(row.party_id,row.adventure_id);
    if(!exists)addEvent(db,{partyId:row.party_id,adventureId:row.adventure_id,visibility:"public",kind:"system",speaker:"The Hollow Road",text:episode.completionDiscovery});
    setPartyState(db,row.party_id,"campaignSeries",campaignSeriesState(db,row.party_id));
  }

  db.exec("CREATE INDEX IF NOT EXISTS idx_players_party_id ON players(party_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_events_party_visibility_player ON events(party_id, visibility, player_id, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_events_party_adventure_id ON events(party_id, adventure_id, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_inventory_items_player_id ON inventory_items(player_id)");
  for (const row of db.prepare("SELECT id, class_name, spellcasting_json FROM players").all()) {
    if (!row.spellcasting_json || row.spellcasting_json === "null" || row.spellcasting_json === "{}") {
      db.prepare("UPDATE players SET spellcasting_json = ? WHERE id = ?").run(JSON.stringify(defaultSpellcasting(row.class_name)), row.id);
    }
  }
  for (const row of db.prepare("SELECT id, class_name, equipment_choice FROM players").all()) seedStartingInventory(db, row.id, row.class_name, row.equipment_choice);
  db.exec("PRAGMA optimize");
  return db;
}

function mapInventoryItem(row) {
  return { id:row.id, name:row.name, quantity:row.quantity, status:row.status, notes:row.notes || "", origin:row.origin, sourceAdventureId:row.source_adventure_id || null };
}

export function listInventory(db, playerId) {
  return db.prepare("SELECT * FROM inventory_items WHERE player_id = ? ORDER BY CASE status WHEN 'equipped' THEN 0 WHEN 'carried' THEN 1 ELSE 2 END, origin, name COLLATE NOCASE").all(playerId).map(mapInventoryItem);
}

function seedStartingInventory(db, playerId, className, equipmentChoice = "recommended") {
  if (equipmentChoice !== "recommended") return;
  const existing = db.prepare("SELECT COUNT(*) AS count FROM inventory_items WHERE player_id = ? AND origin = 'starting'").get(playerId).count;
  if (existing) return;
  const insert = db.prepare("INSERT INTO inventory_items (id, player_id, name, quantity, status, notes, origin, source_adventure_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', 'starting', NULL, ?, ?)");
  const now = new Date().toISOString();
  for (const item of STARTING_INVENTORY[className] || []) insert.run(randomUUID(), playerId, item.name, Math.max(1, Number(item.quantity || 1)), item.status || "carried", now, now);
}

export function addInventoryItem(db, playerId, input) {
  const player = db.prepare("SELECT id FROM players WHERE id = ?").get(playerId);
  if (!player) return null;
  const name = String(input.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!name) return null;
  const quantity = Math.max(1, Math.min(999, Number(input.quantity || 1)));
  const status = ["equipped","carried","stored"].includes(input.status) ? input.status : "carried";
  const origin = input.origin === "starting" ? "starting" : "adventure";
  const existing = db.prepare("SELECT * FROM inventory_items WHERE player_id = ? AND name = ? COLLATE NOCASE AND status = ? AND origin = ? AND COALESCE(source_adventure_id, '') = COALESCE(?, '') LIMIT 1").get(playerId, name, status, origin, input.sourceAdventureId || null);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare("UPDATE inventory_items SET quantity = quantity + ?, notes = CASE WHEN ? != '' THEN ? ELSE notes END, updated_at = ? WHERE id = ?").run(quantity, String(input.notes || ""), String(input.notes || "").slice(0,180), now, existing.id);
    return listInventory(db, playerId).find((item) => item.id === existing.id);
  }
  const id = randomUUID();
  db.prepare("INSERT INTO inventory_items (id, player_id, name, quantity, status, notes, origin, source_adventure_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, playerId, name, quantity, status, String(input.notes || "").slice(0,180), origin, input.sourceAdventureId || null, now, now);
  return listInventory(db, playerId).find((item) => item.id === id);
}

export function removeInventoryItem(db, playerId, name, quantity = 1) {
  const item = db.prepare("SELECT * FROM inventory_items WHERE player_id = ? AND name = ? COLLATE NOCASE ORDER BY CASE origin WHEN 'adventure' THEN 0 ELSE 1 END LIMIT 1").get(playerId, String(name || "").trim());
  if (!item) return false;
  const amount = Math.max(1, Math.min(999, Number(quantity || 1)));
  if (item.quantity <= amount) db.prepare("DELETE FROM inventory_items WHERE id = ?").run(item.id);
  else db.prepare("UPDATE inventory_items SET quantity = quantity - ?, updated_at = ? WHERE id = ?").run(amount, new Date().toISOString(), item.id);
  return true;
}

function mapPlayer(row, db) {
  const classFeatures=Object.entries(CLASS_LEVEL_FEATURES[row.class_name]||{}).filter(([level])=>Number(level)<=Number(row.level)).map(([level,name])=>({level:Number(level),name,automated:false}));
  return { id: row.id, worldId: row.world_id, partyId: row.party_id, name: row.name, avatarId: row.avatar_id || "", className: row.class_name, species: row.species, background: row.background || "Wayfarer", alignment: row.alignment || "Neutral", abilities: JSON.parse(row.abilities_json || "{}"), skills: JSON.parse(row.skills_json || "[]"), expertise:JSON.parse(row.expertise_json || "[]"), subclass:row.subclass || "", classFeatures, equipmentChoice: row.equipment_choice || "recommended", backstory: row.backstory || "", appearance: row.appearance || "", level: row.level, experience: row.experience || 0, hp: row.hp, maxHp: row.max_hp, armorClass: row.armor_class, spellcasting:JSON.parse(row.spellcasting_json || "null"), inventory:listInventory(db, row.id) };
}

export function listPlayers(db, partyId = null) {
  const rows = partyId ? db.prepare("SELECT * FROM players WHERE party_id = ? ORDER BY created_at, name").all(partyId) : db.prepare("SELECT * FROM players ORDER BY created_at, name").all();
  return rows.map((row) => mapPlayer(row, db));
}

export function getPlayer(db, id) {
  const row = db.prepare("SELECT * FROM players WHERE id = ?").get(id);
  return row ? mapPlayer(row, db) : null;
}

export function setPlayerHp(db, playerId, hp) {
  const row = db.prepare("SELECT max_hp FROM players WHERE id = ?").get(playerId);
  if (!row) return null;
  const next = Math.max(0, Math.min(Number(row.max_hp), Math.trunc(Number(hp) || 0)));
  db.prepare("UPDATE players SET hp = ? WHERE id = ?").run(next, playerId);
  return next;
}

export function setPlayerSpellcasting(db, playerId, spellcasting) {
  const row = db.prepare("SELECT id FROM players WHERE id = ?").get(playerId);
  if (!row) return null;
  db.prepare("UPDATE players SET spellcasting_json = ? WHERE id = ?").run(JSON.stringify(spellcasting || null), playerId);
  return getPlayer(db, playerId)?.spellcasting || null;
}

export function restorePlayerSpellSlots(db, playerId) {
  const player = getPlayer(db, playerId);
  if (!player?.spellcasting) return null;
  const spellcasting = structuredClone(player.spellcasting);
  for (const slot of Object.values(spellcasting.slots || {})) slot.current = Number(slot.max || 0);
  return setPlayerSpellcasting(db, playerId, spellcasting);
}

export function spendPlayerSpellSlot(db, playerId, level = 1) {
  const player = getPlayer(db, playerId);
  const spellcasting = player?.spellcasting ? structuredClone(player.spellcasting) : null;
  const slot = spellcasting?.slots?.[String(level)] || spellcasting?.slots?.[level];
  if (!slot || Number(slot.current || 0) < 1) return false;
  slot.current -= 1;
  setPlayerSpellcasting(db, playerId, spellcasting);
  return true;
}

export function createPlayer(db, input) {
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(String(input.partyId || ""));
  if (!party) throw new Error("Choose a party before creating a character.");
  const pin = randomBytes(16).toString("hex");
  const pinSalt = randomBytes(16).toString("hex");
  const pinHash = scryptSync(pin, pinSalt, 32).toString("hex");
  const classes = ["Barbarian","Bard","Cleric","Druid","Fighter","Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard"];
  const species = ["Aasimar","Dragonborn","Dwarf","Elf","Gnome","Goliath","Halfling","Human","Orc","Tiefling"];
  const className = classes.includes(String(input.className)) ? String(input.className) : "Fighter";
  const speciesName = species.includes(String(input.species)) ? String(input.species) : "Human";
  const allowedAvatarIds = new Set(["guardian", "wanderer", "mystic", "shadow", "wild", "scholar", "minstrel", "noble"]);
  const avatarId = allowedAvatarIds.has(String(input.avatarId || "")) ? String(input.avatarId) : "";
  const abilities = input.abilities && typeof input.abilities === "object" ? input.abilities : { strength:15, dexterity:14, constitution:13, intelligence:12, wisdom:10, charisma:8 };
  const scores = [abilities.strength, abilities.dexterity, abilities.constitution, abilities.intelligence, abilities.wisdom, abilities.charisma].map(Number);
  if ([...scores].sort((a,b)=>b-a).join(",") !== "15,14,13,12,10,8") throw new Error("Assign each standard-array score exactly once.");
  const skillRule = CLASS_SKILL_RULES[className];
  const submittedSkills = Array.isArray(input.skills) ? [...new Set(input.skills.map(String))] : null;
  const skills = submittedSkills || skillRule.allowed.slice(0, skillRule.count);
  if (skills.length !== skillRule.count || skills.some((skill) => !skillRule.allowed.includes(skill))) {
    throw new Error(`Choose exactly ${skillRule.count} skill proficiencies allowed for a ${className}.`);
  }
  const conModifier = Math.floor((Number(abilities.constitution) - 10) / 2);
  const hitDice = { Barbarian:12, Fighter:10, Paladin:10, Ranger:10, Bard:8, Cleric:8, Druid:8, Monk:8, Rogue:8, Warlock:8, Sorcerer:6, Wizard:6 };
  const defaultAc = { Barbarian:14, Bard:13, Cleric:16, Druid:14, Fighter:16, Monk:14, Paladin:16, Ranger:15, Rogue:14, Sorcerer:12, Warlock:13, Wizard:12 };
  const maxHp = Math.max(1, hitDice[className] + conModifier);
  const player = { id: randomUUID(), worldId: party.world_id, partyId: party.id, name: String(input.name || "").trim().slice(0, 40), avatarId, className, species: speciesName, background: String(input.background || "Wayfarer").slice(0,30), alignment: String(input.alignment || "Neutral").slice(0,30), abilities, skills, equipmentChoice: input.equipmentChoice === "gold" ? "gold" : "recommended", backstory: String(input.backstory || "").trim().slice(0,1200), appearance: String(input.appearance || "").trim().slice(0,500), level: 1, experience: 0, hp: maxHp, maxHp, armorClass: defaultAc[className], spellcasting:defaultSpellcasting(className) };
  if (!player.name) throw new Error("A character name is required.");
  db.prepare("INSERT INTO players (id, world_id, party_id, name, pronouns, class_name, species, background, alignment, abilities_json, skills_json, equipment_choice, backstory, appearance, level, experience, hp, max_hp, armor_class, spellcasting_json, pin_salt, pin_hash, created_at) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(player.id, player.worldId, player.partyId, player.name, player.className, player.species, player.background, player.alignment, JSON.stringify(player.abilities), JSON.stringify(player.skills), player.equipmentChoice, player.backstory, player.appearance, player.level, player.experience, player.hp, player.maxHp, player.armorClass, JSON.stringify(player.spellcasting), pinSalt, pinHash, new Date().toISOString());
  db.prepare("UPDATE players SET avatar_id = ? WHERE id = ?").run(player.avatarId, player.id);
  seedStartingInventory(db, player.id, player.className, player.equipmentChoice);
  addEvent(db, { partyId: player.partyId, visibility: "public", playerId: player.id, kind: "system", speaker: "Campaign", text: `${player.name}, a ${player.species} ${player.className}, joins the company.` });
  return getPlayer(db, player.id);
}

export function movePlayerToParty(db, playerId, partyId) {
  const player = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(partyId);
  if (!player || !party || player.world_id !== party.world_id) return null;
  if (player.party_id === party.id) return getPlayer(db, playerId);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE players SET party_id = ? WHERE id = ?").run(party.id, playerId);
    db.prepare("DELETE FROM sessions WHERE player_id = ?").run(playerId);
    db.prepare("DELETE FROM party_state WHERE party_id = ? AND key LIKE ?").run(player.party_id, `%${playerId}%`);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  addEvent(db, { partyId:party.id, visibility:"public", playerId, kind:"system", speaker:"Campaign", text:`${player.name} joins ${party.name}.` });
  return getPlayer(db, playerId);
}

export function getLevelUpOptions(db, playerId) {
  const player = getPlayer(db, playerId);
  if (!player || player.level >= 20) return null;
  const adventure = getActiveAdventure(db, player.partyId);
  const workshop = String(adventure?.id || "").endsWith("combat-workshop");
  const pendingLevelUps = getPartyState(db, player.partyId, "pendingLevelUps") || {};
  const targetLevel = Math.min(20, Number(pendingLevelUps[player.id] || 0));
  if (!workshop && targetLevel <= player.level) return null;
  const nextLevel = player.level + 1;
  if (player.className === "Sorcerer" && nextLevel <= 5) {
    const rules=SORCERER_LEVELS[nextLevel];
    const currentMetamagic=player.spellcasting?.metamagic||[];
    const known=player.spellcasting?.prepared||[];
    const newSpellCount=Math.max(0,rules.prepared-known.length);
    const allSorcererSpells=[...WIZARD_SPELLS,...WARLOCK_SPELLS].filter((spell,index,list)=>SORCERER_SPELL_NAMES.includes(spell.name)&&list.findIndex((item)=>item.name===spell.name)===index);
    const maxSpellLevel=Math.max(...Object.keys(rules.slots).map(Number));
    return {nextLevel,className:"Sorcerer",hpIncrease:Math.max(1,4+Math.floor((Number(player.abilities.constitution||10)-10)/2)),newSpellCount,preparedCount:rules.prepared,cantripCount:rules.cantrips,usesSpellbook:false,
      availableSpells:allSorcererSpells.filter((spell)=>spell.level<=maxSpellLevel&&!known.includes(spell.name)).map((spell)=>({...spell,description:SPELL_SUMMARIES[spell.name]||"A Sorcerer spell available at this level."})),
      availableCantrips:nextLevel===4?SORCERER_CANTRIPS.filter((spell)=>!(player.spellcasting?.cantrips||[]).includes(spell)):[],spellSummaries:SPELL_SUMMARIES,expertiseChoices:[],subclassChoices:nextLevel===3?["Draconic Sorcery"]:[],subclassDescription:"Draconic Sorcery grants Draconic Resilience and always-prepared draconic spells, with further features at later levels.",abilityIncrease:nextLevel===4,primaryAbility:"charisma",
      currentSpellbook:known,currentPrepared:known,currentAbilities:player.abilities,invocationChoices:nextLevel===2?METAMAGIC_OPTIONS:[],currentInvocations:currentMetamagic,invocationCount:nextLevel>=2?2:0,choiceFeatureLabel:"Metamagic options",featureNotes:nextLevel===2?["Font of Magic grants 2 Sorcery Points. Choose two Metamagic options."]:nextLevel===5?["Sorcerous Restoration can restore up to 2 Sorcery Points after a Short Rest, once per Long Rest."]:[],nextSlots:Object.entries(rules.slots).map(([level,count])=>({level:Number(level),count,label:"slots"}))};
  }
  if (player.className === "Warlock" && nextLevel <= 5) {
    const rules=WARLOCK_LEVELS[nextLevel];
    const currentInvocations=player.spellcasting?.invocations?.length?player.spellcasting.invocations:["Pact of the Tome"];
    return {nextLevel,className:"Warlock",hpIncrease:Math.max(1,5+Math.floor((Number(player.abilities.constitution||10)-10)/2)),newSpellCount:1,preparedCount:rules.prepared,cantripCount:rules.cantrips,usesSpellbook:false,
      availableSpells:WARLOCK_SPELLS.filter((spell)=>spell.level<=rules.slotLevel&&!(player.spellcasting?.prepared||[]).includes(spell.name)).map((spell)=>({...spell,description:SPELL_SUMMARIES[spell.name]})),
      availableCantrips:nextLevel===4?WARLOCK_CANTRIPS.filter((spell)=>!(player.spellcasting?.cantrips||[]).includes(spell)):[],spellSummaries:SPELL_SUMMARIES,expertiseChoices:[],subclassChoices:nextLevel===3?["Fiend Patron"]:[],subclassDescription:"Fiend Patron grants Dark One's Blessing now and additional patron features at later Warlock levels.",abilityIncrease:nextLevel===4,primaryAbility:"charisma",
      currentSpellbook:player.spellcasting?.prepared||[],currentPrepared:player.spellcasting?.prepared||[],currentAbilities:player.abilities,invocationChoices:WARLOCK_INVOCATIONS.filter((item)=>!currentInvocations.includes(item.name)),currentInvocations,invocationCount:rules.invocations,featureNotes:nextLevel===2?["Magical Cunning restores expended Pact Magic slots after a 1-minute rite once per Long Rest."]:[],nextSlots:[{level:rules.slotLevel,count:rules.slots,label:"Pact slots"}]};
  }
  if (player.className !== "Wizard" || nextLevel > 5) {
    const magic=player.spellcasting;
    const feature=CLASS_LEVEL_FEATURES[player.className]?.[nextLevel]||`${player.className} level ${nextLevel} features`;
    const isAbilityIncrease=[4,8,12,16].includes(nextLevel)||([6,14].includes(nextLevel)&&player.className==="Fighter")||(nextLevel===10&&player.className==="Rogue");
    const nextSlotCounts=slotsAtLevel(player.className,nextLevel);
    return {nextLevel,className:player.className,hpIncrease:Math.max(1,AVERAGE_HP[player.className]+Math.floor((Number(player.abilities.constitution||10)-10)/2)),newSpellCount:0,preparedCount:magic?.prepared?.length||0,cantripCount:magic?.cantrips?.length||0,usesSpellbook:player.className==="Wizard",availableSpells:[],availableCantrips:[],spellSummaries:SPELL_SUMMARIES,expertiseChoices:[],subclassChoices:nextLevel===3?[CLASS_SUBCLASSES[player.className]]:[],subclassDescription:`The free 2024 rules subclass used by this tester is ${CLASS_SUBCLASSES[player.className]}.`,abilityIncrease:isAbilityIncrease,primaryAbility:PRIMARY_ABILITIES[player.className],currentSpellbook:magic?.spellbook?.length?magic.spellbook:(magic?.prepared||[]),currentPrepared:magic?.prepared||[],currentAbilities:player.abilities,invocationChoices:[],currentInvocations:magic?.invocations||magic?.metamagic||[],invocationCount:(magic?.invocations||magic?.metamagic||[]).length,choiceFeatureLabel:player.className==="Warlock"?"Eldritch Invocations":player.className==="Sorcerer"?"Metamagic options":"Class choices",progressionMode:"core",featureNotes:[`${feature}.`,"This feature is recorded. Its combat effect is not automated until it appears as a button or resource in the Combat Workshop."],nextSlots:Object.entries(nextSlotCounts).map(([level,count])=>({level:Number(level),count:Number(count),label:magic?.pactMagic?"Pact slots":"slots"}))};
  }
  const rules = WIZARD_LEVELS[nextLevel];
  const maxSpellLevel = Math.max(...Object.keys(rules.slots).map(Number));
  return {
    nextLevel, className:"Wizard", hpIncrease:Math.max(1,4+Math.floor((Number(player.abilities.constitution||10)-10)/2)),
    newSpellCount:2, preparedCount:rules.prepared, cantripCount:rules.cantrips, usesSpellbook:true,
    availableSpells:WIZARD_SPELLS.filter((spell)=>spell.level<=maxSpellLevel && !(player.spellcasting?.spellbook||[]).includes(spell.name)).map((spell)=>({...spell,description:SPELL_SUMMARIES[spell.name]})),
    availableCantrips:nextLevel===4 ? WIZARD_CANTRIPS.filter((spell)=>!(player.spellcasting?.cantrips||[]).includes(spell)) : [],
    spellSummaries:SPELL_SUMMARIES,
    expertiseChoices:nextLevel===2 ? player.skills.filter((skill)=>["Arcana","History","Investigation","Medicine","Nature","Religion"].includes(skill)) : [],
    subclassChoices:nextLevel===3 ? ["Evoker"] : [], subclassDescription:"Evoker specialises in destructive Evocation magic and gains Potent Cantrip at this level.", abilityIncrease:nextLevel===4, primaryAbility:"intelligence",
    currentSpellbook:player.spellcasting?.spellbook||[], currentPrepared:player.spellcasting?.prepared||[], currentAbilities:player.abilities, invocationChoices:[], currentInvocations:[], invocationCount:0, featureNotes:[], nextSlots:Object.entries(rules.slots).map(([level,count])=>({level:Number(level),count,label:"slots"})),
  };
}

export function levelUpPlayer(db, playerId, input) {
  const options = getLevelUpOptions(db, playerId);
  const player = getPlayer(db, playerId);
  if (!options || !player) throw new Error("This class or level is not yet available in the Combat Workshop level-up tester.");
  if (player.className === "Sorcerer" && options.nextLevel <= 5) {
    const chosenSpells=[...new Set((Array.isArray(input.newSpells)?input.newSpells:[]).map(String))];
    if(chosenSpells.length!==options.newSpellCount||chosenSpells.some((name)=>!options.availableSpells.some((spell)=>spell.name===name))) throw new Error(`Choose exactly ${options.newSpellCount} eligible new Sorcerer spells.`);
    const spellcasting=structuredClone(player.spellcasting); spellcasting.prepared=[...spellcasting.prepared,...chosenSpells]; spellcasting.spellbook=[];
    if(options.availableCantrips.length){const cantrip=String(input.newCantrip||"");if(!options.availableCantrips.includes(cantrip))throw new Error("Choose one new Sorcerer cantrip.");spellcasting.cantrips.push(cantrip);}
    const metamagic=[...new Set((Array.isArray(input.invocations)?input.invocations:options.currentInvocations).map(String))]; const allowed=[...options.currentInvocations,...options.invocationChoices.map((item)=>item.name)];
    if(metamagic.length!==options.invocationCount||metamagic.some((name)=>!allowed.includes(name)))throw new Error(`Choose exactly ${options.invocationCount} Metamagic options.`);
    spellcasting.metamagic=metamagic; const rules=SORCERER_LEVELS[options.nextLevel]; spellcasting.slots=Object.fromEntries(Object.entries(rules.slots).map(([level,max])=>[level,{current:max,max}])); spellcasting.sorceryPoints={current:rules.points,max:rules.points};
    const abilities=structuredClone(player.abilities); if(options.abilityIncrease){const ability=String(input.ability||"");if(!Object.hasOwn(abilities,ability)||Number(abilities[ability])>18)throw new Error("Choose one ability of 18 or lower for the +2 increase.");abilities[ability]=Number(abilities[ability])+2;}
    const subclass=options.subclassChoices.length?String(input.subclass||""):player.subclass;if(options.subclassChoices.length&&!options.subclassChoices.includes(subclass))throw new Error("Choose an available Sorcerer subclass.");
    const maxHp=player.maxHp+options.hpIncrease;db.prepare("UPDATE players SET level=?,max_hp=?,hp=?,abilities_json=?,spellcasting_json=?,subclass=? WHERE id=?").run(options.nextLevel,maxHp,maxHp,JSON.stringify(abilities),JSON.stringify(spellcasting),subclass,player.id);
    finishPendingLevelUp(db,player,options.nextLevel);addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"system",speaker:"Level Up",text:`${player.name} advances to Sorcerer level ${options.nextLevel}.`});return getPlayer(db,player.id);
  }
  if (!options || !player) throw new Error("Level-up testing is currently available for Wizards of levels 1–4 in the Combat Workshop.");
  if (player.className === "Warlock" && options.nextLevel <= 5) {
    const chosenSpells=[...new Set((Array.isArray(input.newSpells)?input.newSpells:[]).map(String))];
    if(chosenSpells.length!==1||chosenSpells.some((name)=>!options.availableSpells.some((spell)=>spell.name===name))) throw new Error("Choose exactly one eligible new Warlock spell.");
    const spellcasting=structuredClone(player.spellcasting); spellcasting.prepared=[...spellcasting.prepared,...chosenSpells]; spellcasting.spellbook=[];
    if(options.availableCantrips.length){const cantrip=String(input.newCantrip||"");if(!options.availableCantrips.includes(cantrip))throw new Error("Choose one new Warlock cantrip.");spellcasting.cantrips.push(cantrip);}
    const invocations=[...new Set((Array.isArray(input.invocations)?input.invocations:options.currentInvocations).map(String))]; const allowed=[...options.currentInvocations,...options.invocationChoices.map((item)=>item.name)];
    if(invocations.length!==options.invocationCount||invocations.some((name)=>!allowed.includes(name)))throw new Error(`Choose exactly ${options.invocationCount} Eldritch Invocations.`);
    spellcasting.invocations=invocations; const rules=WARLOCK_LEVELS[options.nextLevel]; spellcasting.slots={ [rules.slotLevel]:{current:rules.slots,max:rules.slots} };
    const abilities=structuredClone(player.abilities); if(options.abilityIncrease){const ability=String(input.ability||"");if(!Object.hasOwn(abilities,ability)||Number(abilities[ability])>18)throw new Error("Choose one ability of 18 or lower for the +2 increase.");abilities[ability]=Number(abilities[ability])+2;}
    const subclass=options.subclassChoices.length?String(input.subclass||""):player.subclass;if(options.subclassChoices.length&&!options.subclassChoices.includes(subclass))throw new Error("Choose an available Warlock patron.");
    const maxHp=player.maxHp+options.hpIncrease;db.prepare("UPDATE players SET level=?,max_hp=?,hp=?,abilities_json=?,spellcasting_json=?,subclass=? WHERE id=?").run(options.nextLevel,maxHp,maxHp,JSON.stringify(abilities),JSON.stringify(spellcasting),subclass,player.id);
    finishPendingLevelUp(db,player,options.nextLevel);addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"system",speaker:"Level Up",text:`${player.name} advances to Warlock level ${options.nextLevel}.`});return getPlayer(db,player.id);
  }
  if (options.progressionMode === "core") {
    const abilities=structuredClone(player.abilities);
    if(options.abilityIncrease){const ability=String(input.ability||"");if(!Object.hasOwn(abilities,ability)||Number(abilities[ability])>18)throw new Error("Choose one ability of 18 or lower for the +2 increase.");abilities[ability]=Number(abilities[ability])+2;}
    const subclass=options.subclassChoices.length?String(input.subclass||""):player.subclass;if(options.subclassChoices.length&&!options.subclassChoices.includes(subclass))throw new Error(`Choose the available ${player.className} subclass.`);
    const maxHp=player.maxHp+options.hpIncrease;
    const spellcasting=player.spellcasting?structuredClone(player.spellcasting):null;
    if(spellcasting){
      const slotCounts=slotsAtLevel(player.className,options.nextLevel);
      spellcasting.slots=Object.fromEntries(Object.entries(slotCounts).map(([level,max])=>[level,{current:Number(max),max:Number(max)}]));
      if(player.className==="Sorcerer"){
        const points=SORCERER_LEVELS[options.nextLevel]?.points||0;
        spellcasting.sorceryPoints={current:points,max:points};
      }
    }
    db.prepare("UPDATE players SET level=?,max_hp=?,hp=?,abilities_json=?,spellcasting_json=?,subclass=? WHERE id=?").run(options.nextLevel,maxHp,maxHp,JSON.stringify(abilities),JSON.stringify(spellcasting),subclass,player.id);
    finishPendingLevelUp(db,player,options.nextLevel);
    addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"system",speaker:"Level Up",text:`${player.name} advances to ${player.className} level ${options.nextLevel}. ${CLASS_LEVEL_FEATURES[player.className]?.[options.nextLevel]||"Class progression recorded"}.`});
    return getPlayer(db,player.id);
  }
  const chosenSpells = [...new Set((Array.isArray(input.newSpells)?input.newSpells:[]).map(String))];
  if (chosenSpells.length !== 2 || chosenSpells.some((name)=>!options.availableSpells.some((spell)=>spell.name===name))) throw new Error("Choose exactly two eligible new Wizard spells.");
  const spellcasting = structuredClone(player.spellcasting);
  spellcasting.spellbook = [...spellcasting.spellbook, ...chosenSpells];
  if (options.availableCantrips.length) {
    const cantrip = String(input.newCantrip || "");
    if (!options.availableCantrips.includes(cantrip)) throw new Error("Choose one new Wizard cantrip.");
    spellcasting.cantrips.push(cantrip);
  }
  const prepared = [...new Set((Array.isArray(input.prepared)?input.prepared:[]).map(String))];
  if (prepared.length !== options.preparedCount || prepared.some((name)=>!spellcasting.spellbook.includes(name))) throw new Error(`Prepare exactly ${options.preparedCount} spells from the updated spellbook.`);
  spellcasting.prepared = prepared;
  spellcasting.slots = Object.fromEntries(Object.entries(WIZARD_LEVELS[options.nextLevel].slots).map(([level,max])=>[level,{current:max,max}]));
  const abilities = structuredClone(player.abilities);
  if (options.abilityIncrease) {
    const ability = String(input.ability || "");
    if (!Object.hasOwn(abilities, ability) || Number(abilities[ability]) > 18) throw new Error("Choose one ability of 18 or lower for the +2 increase.");
    abilities[ability] = Number(abilities[ability]) + 2;
  }
  const expertise = [...(player.expertise||[])];
  if (options.expertiseChoices.length) {
    const skill = String(input.expertise || "");
    if (!options.expertiseChoices.includes(skill)) throw new Error("Choose one proficient Wizard knowledge skill for Scholar expertise.");
    expertise.push(skill);
  }
  const subclass = options.subclassChoices.length ? String(input.subclass||"") : player.subclass;
  if (options.subclassChoices.length && !options.subclassChoices.includes(subclass)) throw new Error("Choose an available Wizard subclass.");
  const maxHp = player.maxHp + options.hpIncrease;
  db.prepare("UPDATE players SET level=?, max_hp=?, hp=?, abilities_json=?, spellcasting_json=?, expertise_json=?, subclass=? WHERE id=?").run(options.nextLevel,maxHp,maxHp,JSON.stringify(abilities),JSON.stringify(spellcasting),JSON.stringify(expertise),subclass,player.id);
  finishPendingLevelUp(db,player,options.nextLevel);
  addEvent(db,{partyId:player.partyId,visibility:"public",playerId:player.id,kind:"system",speaker:"Level Up",text:`${player.name} advances to Wizard level ${options.nextLevel}. Hit points, spell slots, prepared spells, and level features have been updated.`});
  return getPlayer(db, player.id);
}

function finishPendingLevelUp(db,player,newLevel){
  const pending=getPartyState(db,player.partyId,"pendingLevelUps")||{};
  if(Number(pending[player.id]||0)<=newLevel){delete pending[player.id];setPartyState(db,player.partyId,"pendingLevelUps",pending);}
}

export function deletePlayer(db, playerId) {
  const player = getPlayer(db, playerId);
  if (!player) return false;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM sessions WHERE player_id = ?").run(playerId);
    db.prepare("DELETE FROM events WHERE player_id = ?").run(playerId);
    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function loginPlayer(db, playerId) {
  const row = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId);
  if (!row) return null;
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString());
  db.prepare("INSERT INTO sessions (token_hash, player_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(tokenHash, playerId, expires.toISOString(), now.toISOString());
  return { token, player: mapPlayer(row, db) };
}

export function getPlayerByToken(db, token) {
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = db.prepare("SELECT p.* FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token_hash = ? AND s.expires_at > ?").get(tokenHash, new Date().toISOString());
  return row ? mapPlayer(row, db) : null;
}

export function createWorld(db, input) {
  const name = String(input.name || "").trim().slice(0, 50);
  if (!name) throw new Error("Give the world a name.");
  const world = { id: `world-${randomUUID()}`, name, description: String(input.description || "").trim().slice(0, 180) };
  db.prepare("INSERT INTO worlds (id, name, description, created_at) VALUES (?, ?, ?, ?)").run(world.id, world.name, world.description, new Date().toISOString());
  seedAdventures(db, world.id);
  const party = createParty(db, { worldId: world.id, name: "The First Company" });
  return { ...world, party };
}

export function createParty(db, input) {
  const world = db.prepare("SELECT * FROM worlds WHERE id = ?").get(String(input.worldId || ""));
  if (!world) throw new Error("Choose a world first.");
  const name = String(input.name || "").trim().slice(0, 50);
  if (!name) throw new Error("Give the party a name.");
  const firstAdventure = db.prepare("SELECT id FROM adventures WHERE world_id = ? ORDER BY min_level, created_at LIMIT 1").get(world.id)?.id;
  const party = { id: `party-${randomUUID()}`, worldId: world.id, name, activeAdventureId: firstAdventure || null };
  db.prepare("INSERT INTO parties (id, world_id, name, active_adventure_id, created_at) VALUES (?, ?, ?, ?, ?)").run(party.id, party.worldId, party.name, party.activeAdventureId, new Date().toISOString());
  if (firstAdventure) seedPartyState(db, party.id, firstAdventure);
  return party;
}

export function buildLobby(db) {
  const worlds = db.prepare("SELECT * FROM worlds ORDER BY created_at, name").all().map((world) => {
    const parties = db.prepare("SELECT * FROM parties WHERE world_id = ? ORDER BY created_at, name").all(world.id).map((party) => {
      const characters = listPlayers(db, party.id);
      const averageLevel = characters.length ? characters.reduce((sum, item) => sum + item.level, 0) / characters.length : 1;
      return { id: party.id, worldId: party.world_id, name: party.name, activeAdventureId: party.active_adventure_id, averageLevel, characters };
    });
    const adventures = db.prepare("SELECT a.* FROM adventures a WHERE a.world_id = ? ORDER BY a.min_level, a.created_at").all(world.id).map((item) => mapAdventure(item));
    return { id: world.id, name: world.name, description: world.description, series:{id:CAMPAIGN_SERIES.id,title:CAMPAIGN_SERIES.title,premise:CAMPAIGN_SERIES.publicPremise,episodeCount:Object.keys(SERIES_EPISODES).length}, parties, adventures };
  });
  return { worlds };
}

export function selectAdventure(db, partyId, adventureId) {
  const adventure = db.prepare("SELECT a.* FROM adventures a JOIN parties p ON p.world_id = a.world_id WHERE p.id = ? AND a.id = ?").get(partyId, adventureId);
  if (!adventure) throw new Error("That adventure does not belong to this world.");
  const previousAdventureId = db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(partyId)?.active_adventure_id;
  const enteringWorkshop = String(adventureId).endsWith("combat-workshop") && !String(previousAdventureId || "").endsWith("combat-workshop");
  const leavingWorkshop = String(previousAdventureId || "").endsWith("combat-workshop") && !String(adventureId).endsWith("combat-workshop");
  if (enteringWorkshop) setPartyState(db, partyId, "workshopReturnResources", listPlayers(db, partyId).map((player) => ({ id:player.id, hp:player.hp, spellcasting:player.spellcasting })));
  if (previousAdventureId) {
    setPartyState(db, partyId, `dm:${previousAdventureId}`, getPartyState(db, partyId, "dm") || initialStateForAdventure(previousAdventureId));
    setPartyState(db, partyId, `knownLocations:${previousAdventureId}`, getKnownLocations(db, partyId));
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE party_adventures SET status = 'paused' WHERE party_id = ? AND status = 'active'").run(partyId);
  db.prepare("INSERT INTO party_adventures (party_id, adventure_id, status, started_at) VALUES (?, ?, 'active', ?) ON CONFLICT(party_id, adventure_id) DO UPDATE SET status = 'active', started_at = COALESCE(party_adventures.started_at, excluded.started_at)").run(partyId, adventureId, now);
  db.prepare("UPDATE parties SET active_adventure_id = ? WHERE id = ?").run(adventureId, partyId);
  setPartyState(db, partyId, "dm", adventureStateWithSeries(db,partyId,adventureId,getPartyState(db,partyId,`dm:${adventureId}`)));
  setPartyState(db, partyId, "knownLocations", getPartyState(db, partyId, `knownLocations:${adventureId}`) || []);
  setPartyState(db, partyId, "combat", null);
  if (String(adventureId).endsWith("combat-workshop")) {
    db.prepare("UPDATE players SET hp = max_hp WHERE party_id = ?").run(partyId);
    for (const player of listPlayers(db, partyId)) {
      restorePlayerSpellSlots(db, player.id);
      const potion = db.prepare("SELECT quantity FROM inventory_items WHERE player_id = ? AND name = 'Potion of Healing' AND source_adventure_id = ?").get(player.id, adventureId);
      if (Number(potion?.quantity || 0) < 2) addInventoryItem(db, player.id, { name:"Potion of Healing", quantity:2-Number(potion?.quantity || 0), notes:"Combat Workshop test supply; restored when the fight resets.", sourceAdventureId:adventureId });
    }
  }
  if (leavingWorkshop) {
    for (const saved of getPartyState(db, partyId, "workshopReturnResources") || []) {
      db.prepare("UPDATE players SET hp = MAX(0, MIN(max_hp, ?)), spellcasting_json = ? WHERE id = ? AND party_id = ?").run(Number(saved.hp || 0), JSON.stringify(saved.spellcasting || null), saved.id, partyId);
    }
    db.prepare("DELETE FROM inventory_items WHERE source_adventure_id = ? AND player_id IN (SELECT id FROM players WHERE party_id = ?)").run(previousAdventureId, partyId);
  }
  if (!String(adventureId).endsWith("combat-workshop")) rememberKnownLocation(db, partyId, { name: adventure.opening_scene, summary: `The party began ${adventure.title} here.` });
  const eventCount = db.prepare("SELECT COUNT(*) AS count FROM events WHERE party_id = ? AND adventure_id = ?").get(partyId, adventureId).count;
  if (!eventCount){
    addOpeningEvents(db,partyId,adventure);
    const established=campaignSeriesState(db,partyId).establishedConnections.at(-1);
    if(established&&!String(adventureId).endsWith("combat-workshop"))addEvent(db,{partyId,adventureId,visibility:"public",kind:"system",speaker:`Previously on ${CAMPAIGN_SERIES.title}`,text:established});
  }
  addEvent(db, { partyId, visibility: "public", kind: "system", speaker: "Campaign", text: `The company turns to a new adventure: ${adventure.title}.` });
  return mapAdventure(adventure, "active");
}

function mapAdventure(row, status = "active") {
  const episode=seriesEpisodeForAdventure(row.id);
  return { id: row.id, worldId: row.world_id, title: row.title, synopsis: row.synopsis, minLevel: row.min_level, maxLevel: row.max_level, milestoneLevel: row.milestone_level, chapter: row.chapter, scene: row.opening_scene, status, seriesId:episode?CAMPAIGN_SERIES.id:null, seriesTitle:episode?CAMPAIGN_SERIES.title:null, episodeNumber:episode?.number||null, seriesHook:episode?.hook||null };
}

export function getActiveAdventure(db, partyId) {
  const row = db.prepare("SELECT a.*, COALESCE(pa.status, 'active') AS status FROM parties p JOIN adventures a ON a.id = p.active_adventure_id LEFT JOIN party_adventures pa ON pa.party_id = p.id AND pa.adventure_id = a.id WHERE p.id = ?").get(partyId);
  return row ? mapAdventure(row, row.status) : null;
}

export function completeActiveAdventure(db, partyId) {
  const adventure = getActiveAdventure(db, partyId);
  if (!adventure) return null;
  const status = db.prepare("SELECT status FROM party_adventures WHERE party_id = ? AND adventure_id = ?").get(partyId, adventure.id)?.status;
  if (status === "complete") return { adventure, leveled: [] };
  const before = listPlayers(db, partyId);
  const eligible = before.filter((player) => player.level < adventure.milestoneLevel);
  const leveled = eligible.map((player) => player.name);
  const pendingLevelUps=getPartyState(db,partyId,"pendingLevelUps")||{};
  for(const player of eligible)pendingLevelUps[player.id]=Math.min(20,adventure.milestoneLevel);
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE party_adventures SET status = 'complete', completed_at = ? WHERE party_id = ? AND adventure_id = ?").run(now, partyId, adventure.id);
    setPartyState(db,partyId,"pendingLevelUps",pendingLevelUps);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  addEvent(db, { partyId, visibility: "public", kind: "system", speaker: "Milestone", text: leveled.length ? `${adventure.title} is complete. ${leveled.join(", ")} can now complete their level-ups to level ${adventure.milestoneLevel} on the Character sheet.` : `${adventure.title} is complete.` });
  const episode=seriesEpisodeForAdventure(adventure.id);
  if(episode){
    setPartyState(db,partyId,"campaignSeries",campaignSeriesState(db,partyId));
    addEvent(db,{partyId,visibility:"public",kind:"system",speaker:"The Hollow Road",text:episode.completionDiscovery});
    addEvent(db,{partyId,visibility:"dm",kind:"system",speaker:"DM Ledger",text:`Campaign series episode ${episode.number} completed. Carry this connection forward: ${episode.completionDiscovery}`});
  }
  return { adventure, leveled };
}

export function getParty(db, partyId) {
  const row = db.prepare("SELECT p.*, w.name AS world_name FROM parties p JOIN worlds w ON w.id = p.world_id WHERE p.id = ?").get(partyId);
  return row ? { id: row.id, worldId: row.world_id, worldName: row.world_name, name: row.name, activeAdventureId: row.active_adventure_id } : null;
}

export function addEvent(db, event) {
  const adventureId = event.adventureId || db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(event.partyId)?.active_adventure_id || null;
  const result = db.prepare("INSERT INTO events (party_id, adventure_id, visibility, player_id, kind, speaker, text, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(event.partyId, adventureId, event.visibility, event.playerId || null, event.kind, event.speaker, event.text, JSON.stringify(event.payload || {}), new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function listVisibleEvents(db, player) {
  const adventureId = db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(player.partyId)?.active_adventure_id;
  return db.prepare("SELECT id, visibility, player_id, kind, speaker, text, payload_json, created_at FROM events WHERE party_id = ? AND adventure_id = ? AND (visibility = 'public' OR (visibility = 'player' AND player_id = ?)) ORDER BY id ASC LIMIT 250").all(player.partyId, adventureId, player.id).map((row) => ({ id: row.id, visibility: row.visibility, playerId: row.player_id, kind: row.kind, speaker: row.speaker, text: row.text, payload:JSON.parse(row.payload_json || "{}"), createdAt: row.created_at }));
}

export function listRecentEventsForDm(db, partyId, limit = 36) {
  const safeLimit = Math.max(1, Math.min(80, Number(limit) || 36));
  const adventureId = db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(partyId)?.active_adventure_id;
  return db.prepare("SELECT id, visibility, player_id, kind, speaker, text, created_at FROM (SELECT id, visibility, player_id, kind, speaker, text, created_at FROM events WHERE party_id = ? AND adventure_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC").all(partyId, adventureId, safeLimit).map((row) => ({ id:row.id, visibility:row.visibility, playerId:row.player_id, kind:row.kind, speaker:row.speaker, text:row.text, createdAt:row.created_at }));
}

export function getPartyState(db, partyId, key) {
  const row = db.prepare("SELECT value_json FROM party_state WHERE party_id = ? AND key = ?").get(partyId, key);
  return row ? JSON.parse(row.value_json) : null;
}

export function setPartyState(db, partyId, key, value) {
  db.prepare("INSERT INTO party_state (party_id, key, value_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(party_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at").run(partyId, key, JSON.stringify(value), new Date().toISOString());
}

export function getGuidanceMode(db, partyId) {
  const mode = String(getPartyState(db, partyId, "guidanceMode") || "guided");
  return ["guided","standard","classic"].includes(mode) ? mode : "guided";
}

export function setGuidanceMode(db, partyId, mode) {
  const next = ["guided","standard","classic"].includes(String(mode)) ? String(mode) : "guided";
  setPartyState(db, partyId, "guidanceMode", next);
  return next;
}

export function getPlayerGuidance(db, playerId, partyId) {
  const guidance = getPartyState(db, partyId, `guidance:${playerId}`);
  return Array.isArray(guidance) ? guidance : [];
}

export function setPlayerGuidance(db, playerId, partyId, suggestions) {
  const safe = (Array.isArray(suggestions) ? suggestions : []).slice(0,3).map((item) => ({
    label:String(item?.label || "Try another approach").trim().slice(0,48),
    text:String(item?.text || "").trim().slice(0,220),
    mode:["act","speak","ask"].includes(String(item?.mode)) ? String(item.mode) : "act",
    reason:String(item?.reason || "").trim().slice(0,160),
  })).filter((item) => item.text);
  setPartyState(db, partyId, `guidance:${playerId}`, safe);
  return safe;
}

export function getKnownLocations(db, partyId) {
  const locations = getPartyState(db, partyId, "knownLocations");
  const saved = Array.isArray(locations) ? locations : [];
  const party = db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(partyId);
  return enrichKnownLocations(party?.active_adventure_id, getPartyState(db, partyId, "dm") || {}, saved);
}

export function rememberKnownLocation(db, partyId, location) {
  const name = String(location?.name || "").trim().slice(0, 80);
  if (!name) return getKnownLocations(db, partyId);
  const party = db.prepare("SELECT active_adventure_id FROM parties WHERE id = ?").get(partyId);
  if (!locationIsRevealed(party?.active_adventure_id, getPartyState(db, partyId, "dm") || {}, name)) return getKnownLocations(db, partyId);
  const summary = String(location?.summary || "A place known to the party.").trim().slice(0, 240);
  const locations = getKnownLocations(db, partyId);
  const existing = locations.find((item) => String(item.name).toLowerCase() === name.toLowerCase());
  if (existing) existing.summary = summary || existing.summary;
  else locations.push({ id: `place-${randomUUID()}`, name, summary, firstSeen: new Date().toISOString() });
  setPartyState(db, partyId, "knownLocations", locations.slice(-40));
  return locations;
}

export function getPartySpotlight(db, partyId) {
  const players = listPlayers(db, partyId);
  if (!players.length) return { playerId: null, name: "No adventurer", position: 0, total: 0 };
  const saved = getPartyState(db, partyId, "spotlight");
  const index = Math.max(0, players.findIndex((player) => player.id === saved?.playerId));
  return { playerId: players[index].id, name: players[index].name, position: index + 1, total: players.length };
}

export function advancePartySpotlight(db, partyId, actingPlayerId = null) {
  const players = listPlayers(db, partyId);
  if (!players.length) return getPartySpotlight(db, partyId);
  const current = getPartySpotlight(db, partyId);
  if (actingPlayerId && current.playerId !== actingPlayerId) return current;
  const index = players.findIndex((player) => player.id === current.playerId);
  const next = players[(index + 1) % players.length];
  setPartyState(db, partyId, "spotlight", { playerId: next.id });
  return getPartySpotlight(db, partyId);
}

export function setPartySpotlight(db, partyId, playerId) {
  const player = listPlayers(db, partyId).find((item) => item.id === playerId);
  if (!player) return getPartySpotlight(db, partyId);
  setPartyState(db, partyId, "spotlight", { playerId:player.id });
  return getPartySpotlight(db, partyId);
}

export function resetPartyStory(db, partyId) {
  const party = db.prepare("SELECT * FROM parties WHERE id = ?").get(partyId);
  if (!party) throw new Error("That party was not found.");
  const adventure = party.active_adventure_id ? db.prepare("SELECT * FROM adventures WHERE id = ?").get(party.active_adventure_id) : null;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM events WHERE party_id = ? AND adventure_id = ?").run(partyId, party.active_adventure_id);
    db.prepare("DELETE FROM party_state WHERE party_id = ? AND (key IN ('dm', 'knownLocations', 'combat', 'pendingLevelUps', 'cotton') OR key LIKE 'pendingCheck:%' OR key LIKE 'guidance:%' OR key LIKE 'turnTraces:%' OR key LIKE 'turnRevision:%' OR key LIKE 'npcConversation:%' OR key LIKE 'sceneEntry:%')").run(partyId);
    const structuredAdventureId = adventureDefinition(party.active_adventure_id)?.id || String(party.active_adventure_id || "");
    db.prepare("DELETE FROM party_state WHERE party_id = ? AND key IN (?, ?)").run(partyId, `world:${structuredAdventureId}`, `interactions:${party.active_adventure_id}`);
    if(adventure)db.prepare("UPDATE party_adventures SET status='active',completed_at=NULL WHERE party_id=? AND adventure_id=?").run(partyId,adventure.id);
    db.prepare("UPDATE players SET hp = max_hp WHERE party_id = ?").run(partyId);
    if (adventure) db.prepare("DELETE FROM inventory_items WHERE source_adventure_id = ? AND player_id IN (SELECT id FROM players WHERE party_id = ?)").run(adventure.id, partyId);
    setPartyState(db, partyId, "dm", initialStateForAdventure(adventure?.id));
    const firstPlayer = listPlayers(db, partyId)[0];
    setPartyState(db, partyId, "spotlight", { playerId: firstPlayer?.id || null });
    if (adventure) rememberKnownLocation(db, partyId, { name: adventure.opening_scene, summary: `The party began ${adventure.title} here.` });
    addOpeningEvents(db, partyId, adventure);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, knownLocations: getKnownLocations(db, partyId) };
}

export function countDmEvents(db, partyId = null) {
  return partyId ? db.prepare("SELECT COUNT(*) AS count FROM events WHERE party_id = ? AND visibility = 'dm'").get(partyId).count : db.prepare("SELECT COUNT(*) AS count FROM events WHERE visibility = 'dm'").get().count;
}
