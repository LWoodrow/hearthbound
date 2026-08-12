import { addEvent, addInventoryItem, getActiveAdventure, getPartyState, getPlayer, listPlayers, removeInventoryItem, restorePlayerSpellSlots, setPartySpotlight, setPartyState, setPlayerGuidance, setPlayerHp, spendPlayerSpellSlot } from "./database.mjs";
import { COTTON_ID, cottonCombatant, cottonLevel } from "./cotton.mjs";

const WEAPONS = {
  "greatsword":{ name:"Greatsword", ability:"strength", dice:[2,6], range:"melee" },
  "greataxe":{ name:"Greataxe", ability:"strength", dice:[1,12], range:"melee" },
  "flail":{ name:"Flail", ability:"strength", dice:[1,8], range:"melee" },
  "longsword":{ name:"Longsword", ability:"strength", dice:[1,8], range:"melee" },
  "shortsword":{ name:"Shortsword", ability:"dexterity", dice:[1,6], range:"melee" },
  "scimitar":{ name:"Scimitar", ability:"dexterity", dice:[1,6], range:"melee" },
  "mace":{ name:"Mace", ability:"strength", dice:[1,6], range:"melee" },
  "spear":{ name:"Spear", ability:"strength", dice:[1,6], range:"melee" },
  "sickle":{ name:"Sickle", ability:"strength", dice:[1,4], range:"melee" },
  "dagger":{ name:"Dagger", ability:"finesse", dice:[1,4], range:"melee" },
  "handaxe":{ name:"Handaxe", ability:"strength", dice:[1,6], range:"melee" },
  "javelin":{ name:"Javelin", ability:"strength", dice:[1,6], range:"ranged" },
  "longbow":{ name:"Longbow", ability:"dexterity", dice:[1,8], range:"ranged" },
  "shortbow":{ name:"Shortbow", ability:"dexterity", dice:[1,6], range:"ranged" },
};

const WORKSHOP_OPPONENTS = [
  { id:"training-dummy", name:"Animated training dummy", label:"Training dummy", summary:"AC 10 · Does not attack · Practice attacks and damage", ac:10, hp:20, initiativeModifier:-2, attackBonus:null, damageDice:[0,1], damageModifier:0 },
  { id:"goblin-skirmisher", name:"Goblin skirmisher", label:"Goblin skirmisher", summary:"Quick, lightly built opponent for a level 1 character", ac:15, hp:7, initiativeModifier:2, attackBonus:4, damageDice:[1,6], damageModifier:2 },
  { id:"orc-bruiser", name:"Orc bruiser", label:"Orc bruiser", summary:"Hard-hitting opponent for testing defense and healing", ac:13, hp:15, initiativeModifier:1, attackBonus:5, damageDice:[1,12], damageModifier:3 },
  { id:"ogre-veteran", name:"Ogre veteran", label:"Ogre veteran", summary:"Durable stress test intended for a party", ac:11, hp:35, initiativeModifier:-1, attackBonus:6, damageDice:[2,8], damageModifier:4 },
];

const COMBAT_SPELLS = {
  "magic missile":{ name:"Magic Missile", level:1, kind:"automatic", dice:[3,4], modifier:3, damageType:"Force" },
  "burning hands":{ name:"Burning Hands", level:1, kind:"save", save:"dexterity", dice:[3,6], modifier:0, damageType:"Fire" },
  "thunderwave":{ name:"Thunderwave", level:1, kind:"save", save:"constitution", dice:[2,8], modifier:0, damageType:"Thunder" },
  "ray of frost":{ name:"Ray of Frost", level:0, kind:"attack", dice:[1,8], modifier:0, damageType:"Cold" },
  "fire bolt":{ name:"Fire Bolt", level:0, kind:"attack", dice:[1,10], modifier:0, damageType:"Fire" },
  "produce flame":{ name:"Produce Flame", level:0, kind:"attack", dice:[1,8], modifier:0, damageType:"Fire" },
  "sorcerous burst":{ name:"Sorcerous Burst", level:0, kind:"attack", dice:[1,8], modifier:0, damageType:"variable" },
  "eldritch blast":{ name:"Eldritch Blast", level:0, kind:"attack", dice:[1,10], modifier:0, damageType:"Force" },
  "shatter":{ name:"Shatter", level:2, kind:"save", save:"constitution", dice:[3,8], modifier:0, damageType:"Thunder" },
  "fireball":{ name:"Fireball", level:3, kind:"save", save:"dexterity", dice:[8,6], modifier:0, damageType:"Fire" },
  "lightning bolt":{ name:"Lightning Bolt", level:3, kind:"save", save:"dexterity", dice:[8,6], modifier:0, damageType:"Lightning" },
};

const abilityModifier = (score) => Math.floor((Number(score || 10) - 10) / 2);
const proficiencyBonus = (level) => 2 + Math.floor((Math.max(1, Number(level || 1)) - 1) / 4);
const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
const signed = (value) => value >= 0 ? `+${value}` : String(value);

function weaponForItem(item) {
  const normalized = String(item?.name || "").toLowerCase().replace(/s$/, "");
  return WEAPONS[normalized] || Object.entries(WEAPONS).find(([key]) => normalized.includes(key))?.[1] || null;
}

export function availableAttacks(player) {
  const seen = new Set();
  const attacks = [];
  for (const item of player.inventory || []) {
    const weapon = weaponForItem(item);
    if (!weapon || seen.has(weapon.name)) continue;
    seen.add(weapon.name);
    const strength = abilityModifier(player.abilities?.strength);
    const dexterity = abilityModifier(player.abilities?.dexterity);
    const ability = weapon.ability === "finesse" ? (dexterity > strength ? "dexterity" : "strength") : weapon.ability;
    const modifier = ability === "dexterity" ? dexterity : strength;
    attacks.push({ ...weapon, ability, attackBonus:modifier + proficiencyBonus(player.level), damageModifier:modifier, damage:`${weapon.dice[0]}d${weapon.dice[1]}${modifier ? signed(modifier) : ""}` });
  }
  if (!attacks.length) {
    const modifier = abilityModifier(player.abilities?.strength);
    attacks.push({ name:"Unarmed Strike", ability:"strength", dice:[0,1], range:"melee", attackBonus:modifier + proficiencyBonus(player.level), damageModifier:modifier, damage:String(Math.max(1, 1 + modifier)) });
  }
  return attacks.sort((a,b) => (b.dice[0] * (b.dice[1] + 1) / 2 + b.damageModifier) - (a.dice[0] * (a.dice[1] + 1) / 2 + a.damageModifier));
}

function currentTurn(combat) { return combat?.order?.[combat.turnIndex] || null; }
function livingPlayers(db, partyId) { return listPlayers(db, partyId).filter((player) => player.hp > 0); }

function saveCombat(db, partyId, combat) {
  combat.updatedAt = new Date().toISOString();
  setPartyState(db, partyId, "combat", combat);
  const turn = currentTurn(combat);
  if (combat.active && turn?.type === "player") setPartySpotlight(db, partyId, turn.id);
  return combat;
}

function healthDescription(enemy) {
  if (enemy.hp <= 0) return "Defeated";
  const ratio = enemy.hp / enemy.maxHp;
  if (ratio >= .76) return "Unhurt";
  if (ratio >= .51) return "Hurt";
  if (ratio >= .26) return "Bloodied";
  return "Near defeat";
}

function runCottonTurn(db, combat) {
  const party = listPlayers(db, combat.partyId);
  const level = cottonLevel(db, combat.partyId);
  const wounded = [...party].filter((member)=>member.hp>0 && member.hp<member.maxHp).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
  if (wounded && wounded.hp / wounded.maxHp <= .45 && Number(combat.cottonHealsUsed || 0) < 2) {
    const healing = Math.max(4, 4 + level * 2);
    const nextHp = setPlayerHp(db, wounded.id, wounded.hp + healing);
    combat.cottonHealsUsed = Number(combat.cottonHealsUsed || 0) + 1;
    addEvent(db,{partyId:combat.partyId,visibility:"public",kind:"narration",speaker:"Cotton",text:`Cotton administers Aggressive Kneading to ${wounded.name} with the bedside manner of an angry baker. ${wounded.name} recovers ${nextHp-wounded.hp} Hit Points.`});
    return;
  }
  const enemy = combat.enemies.find((item)=>item.hp>0);
  if (!enemy) return;
  const unseenBeans = combat.round % 3 === 0;
  const attackBonus = 4 + Math.ceil(level / 4);
  const natural = rollDie(20);
  const total = natural + attackBonus;
  const hit = natural !== 1 && (natural === 20 || total >= enemy.ac);
  if (!hit) {
    addEvent(db,{partyId:combat.partyId,visibility:"public",kind:"roll",speaker:"Combat",text:`Cotton deploys ${unseenBeans ? "Unseen Beans" : "Toe Beans"}: ${natural} ${signed(attackBonus)} = ${total} against AC ${enemy.ac}—the attack misses. Cotton behaves as if this was intentional.`});
    return;
  }
  const diceCount = 1 + Math.floor((level - 1) / 5);
  const dieSides = unseenBeans ? 4 : 6;
  const damage = Array.from({length:diceCount},()=>rollDie(dieSides)).reduce((sum,value)=>sum+value,0) + Math.max(1,Math.ceil(level/4));
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (unseenBeans && enemy.hp > 0) combat.enemyDisadvantageUntilRound = combat.round + 1;
  addEvent(db,{partyId:combat.partyId,visibility:"public",kind:"roll",speaker:"Combat",text:`Cotton uses ${unseenBeans ? "Unseen Beans, raking the enemy's eyes" : "Toe Beans"} for ${damage} damage. ${enemy.name} is ${healthDescription(enemy).toLowerCase()}.`});
  if (enemy.hp <= 0) {
    const actingPlayer = party[0];
    if (actingPlayer) finishGuardianVictory(db, actingPlayer, combat, "cotton");
  }
}

function finishDefeat(db, combat) {
  if (!combat.cottonNoMeowUsed) {
    const fallen = listPlayers(db, combat.partyId).sort((a,b)=>b.maxHp-a.maxHp)[0];
    if (fallen) {
      const restored = Math.max(1, Math.ceil(fallen.maxHp * .35));
      setPlayerHp(db, fallen.id, restored);
      combat.cottonNoMeowUsed = true;
      addEvent(db,{partyId:combat.partyId,visibility:"public",kind:"narration",speaker:"Cotton",text:`Cotton invokes No Meow without making a sound. ${fallen.name} wakes with ${restored} Hit Points while Cotton looks irritated by the inconvenience.`});
      return;
    }
  }
  combat.active = false;
  combat.outcome = "defeat";
  combat.pendingRoll = null;
  for (const player of listPlayers(db, combat.partyId)) if (player.hp <= 0) setPlayerHp(db, player.id, 1);
  const text = combat.workshop
    ? "The training opponent wins the exercise. The workshop's safety wards stabilize each fallen adventurer at 1 Hit Point; reset the fight to restore Hit Points, spell slots, and test consumables."
    : "The last adventurer falls and the ink-dark guardian drives the company back from the collapse. After a grim interval, the party regains consciousness with 1 Hit Point each; the guardian still bars the way, and the encounter can be attempted again after regrouping.";
  addEvent(db, { partyId:combat.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text });
  setPartyState(db, combat.partyId, "combat", combat);
}

function runEnemyTurn(db, combat, enemy) {
  const targets = livingPlayers(db, combat.partyId);
  if (!targets.length) return finishDefeat(db, combat);
  if ((combat.order || []).some((member)=>member.id === COTTON_ID) && !(combat.enemiesThatTriedCotton || []).includes(enemy.id)) {
    combat.enemiesThatTriedCotton = [...(combat.enemiesThatTriedCotton || []), enemy.id];
    addEvent(db,{partyId:combat.partyId,visibility:"public",kind:"roll",speaker:"Combat",text:`${enemy.name} turns its attack on Cotton. Cotton is already somewhere else; the blow cannot touch him. He does not acknowledge it.`});
    return;
  }
  const target = targets.sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
  if (enemy.attackBonus === null) {
    addEvent(db, { partyId:combat.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`The ${enemy.name.toLowerCase()} remains still; it is designed only to receive attacks.` });
    return;
  }
  const first = rollDie(20);
  const second = rollDie(20);
  const dodging = combat.dodgingPlayerIds?.includes(target.id) || Number(combat.enemyDisadvantageUntilRound || 0) >= Number(combat.round || 1);
  const natural = dodging ? Math.min(first, second) : first;
  const total = natural + enemy.attackBonus;
  const hit = natural !== 1 && (natural === 20 || total >= target.armorClass);
  let text = `${enemy.name} lashes at ${target.name}: ${natural} ${signed(enemy.attackBonus)} = ${total} against AC ${target.armorClass}`;
  if (dodging) text += ` with Disadvantage (${first}, ${second})`;
  if (hit) {
    const damageRolls = Array.from({ length:Math.max(1, Number(enemy.damageDice[0] || 1)) }, () => rollDie(enemy.damageDice[1]));
    const damage = Math.max(1, damageRolls.reduce((sum,value)=>sum+value,0) + enemy.damageModifier);
    const nextHp = setPlayerHp(db, target.id, target.hp - damage);
    text += `—hit for ${damage} damage. ${target.name} has ${nextHp}/${target.maxHp} HP.`;
  } else text += "—miss.";
  addEvent(db, { partyId:combat.partyId, visibility:"public", kind:"roll", speaker:"Combat", text });
  combat.dodgingPlayerIds = (combat.dodgingPlayerIds || []).filter((id) => id !== target.id);
}

function advanceTurn(db, combat) {
  if (!combat.active) return combat;
  combat.pendingRoll = null;
  let guard = 0;
  while (guard < combat.order.length * 2) {
    const previous = combat.turnIndex;
    combat.turnIndex = (combat.turnIndex + 1) % combat.order.length;
    if (combat.turnIndex <= previous) combat.round += 1;
    const turn = currentTurn(combat);
    guard += 1;
    if (turn.type === "enemy") {
      const enemy = combat.enemies.find((item) => item.id === turn.id);
      if (!enemy || enemy.hp <= 0) continue;
      runEnemyTurn(db, combat, enemy);
      if (!combat.active) return combat;
      continue;
    }
    if (turn.type === "companion" || turn.id === COTTON_ID) {
      runCottonTurn(db, combat);
      if (!combat.active) return combat;
      continue;
    }
    const player = listPlayers(db, combat.partyId).find((item) => item.id === turn.id);
    if (!player || player.hp <= 0) continue;
    setPartySpotlight(db, combat.partyId, player.id);
    addEvent(db, { partyId:combat.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Round ${combat.round}: ${player.name}'s turn.` });
    return combat;
  }
  return combat;
}

function beginAttack(db, player, combat, requestedWeapon = "") {
  const turn = currentTurn(combat);
  if (turn?.type !== "player" || turn.id !== player.id) {
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`It is ${turn?.name || "another combatant"}'s turn.` });
    return saveCombat(db, player.partyId, combat);
  }
  if (combat.pendingRoll) return combat;
  const attacks = availableAttacks(player);
  const weapon = attacks.find((item) => item.name.toLowerCase() === String(requestedWeapon).toLowerCase()) || attacks[0];
  const enemy = combat.enemies.find((item) => item.hp > 0);
  if (!enemy) return combat;
  combat.pendingRoll = { kind:"attack", playerId:player.id, targetId:enemy.id, weapon };
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} squares up to attack the ${enemy.name} with ${weapon.name.toLowerCase()}. Roll d20 ${signed(weapon.attackBonus)} for the attack.` });
  return saveCombat(db, player.partyId, combat);
}

function availableCombatSpells(player) {
  if (!player.spellcasting) return [];
  const names = [...(player.spellcasting.cantrips || []), ...(player.spellcasting.prepared || [])];
  const spellAbility = abilityModifier(player.abilities?.[player.spellcasting.ability]);
  const attackBonus = spellAbility + proficiencyBonus(player.level);
  const saveDc = 8 + attackBonus;
  const slotEntries=Object.entries(player.spellcasting.slots||{}).sort(([a],[b])=>Number(b)-Number(a));
  const pactSlot=player.spellcasting.pactMagic?slotEntries[0]:null;
  return names.map((name) => COMBAT_SPELLS[String(name).toLowerCase()]).filter(Boolean).map((base) => {
    const spell={...base,dice:[...base.dice]};
    const cantripScale=1+(player.level>=5?1:0)+(player.level>=11?1:0)+(player.level>=17?1:0);
    const eldritch=spell.name==="Eldritch Blast";
    if(spell.level===0&&!eldritch) spell.dice[0]*=cantripScale;
    if(eldritch&&player.spellcasting.invocations?.includes("Agonizing Blast")) spell.modifier=spellAbility;
    const normalSlot=player.spellcasting.slots?.[String(spell.level)]||player.spellcasting.slots?.[spell.level];
    const available=spell.level===0||(pactSlot?Number(pactSlot[0])>=spell.level&&Number(pactSlot[1].current)>0:Number(normalSlot?.current||0)>0);
    return {...spell,attackBonus,saveDc,available,slotLevel:pactSlot?Number(pactSlot[0]):spell.level,beams:eldritch?cantripScale:1};
  });
}

export function beginCombatSpell(db, player, spellName) {
  const combat = getPartyState(db, player.partyId, "combat");
  if (!combat?.active || currentTurn(combat)?.id !== player.id || combat.pendingRoll) return null;
  const spell = availableCombatSpells(player).find((item) => item.name.toLowerCase() === String(spellName).toLowerCase());
  if (!spell) return null;
  if (spell.level > 0 && !spendPlayerSpellSlot(db, player.id, spell.slotLevel)) return null;
  const enemy = combat.enemies.find((item) => item.hp > 0);
  if (!enemy) return null;
  const weapon = { name:spell.name, attackBonus:spell.attackBonus, dice:spell.dice, damageModifier:spell.modifier, damageType:spell.damageType };
  if (spell.kind === "attack") {
    combat.pendingRoll = { kind:"attack", playerId:player.id, targetId:enemy.id, weapon, source:"spell", remainingBeams:spell.beams, totalBeams:spell.beams, beamNumber:1 };
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} casts ${spell.name}.${spell.beams>1?` It creates ${spell.beams} separate beams; resolve beam 1 first.`:""} Roll d20 ${signed(spell.attackBonus)} for the spell attack.` });
  } else {
    let damageMultiplier = 1;
    let resolution = "its darts strike automatically";
    if (spell.kind === "save") {
      const saveModifier = Number(enemy.saves?.[spell.save] || 0);
      const natural = rollDie(20);
      const saved = natural + saveModifier >= spell.saveDc;
      damageMultiplier = saved ? .5 : 1;
      resolution = `the ${enemy.name.toLowerCase()} rolls ${natural}${saveModifier?signed(saveModifier):""} against ${spell.save} save DC ${spell.saveDc} and ${saved?"succeeds, taking half damage":"fails"}`;
    }
    combat.pendingRoll = { kind:"damage", playerId:player.id, targetId:enemy.id, weapon, source:"spell", diceCount:spell.dice[0], dieSides:spell.dice[1], modifier:spell.modifier, critical:false, damageMultiplier };
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} casts ${spell.name}; ${resolution}. Roll ${spell.dice[0]}d${spell.dice[1]}${spell.modifier ? signed(spell.modifier) : ""} damage.` });
  }
  return saveCombat(db, player.partyId, combat);
}

export function beginCombatPotion(db, player) {
  const combat = getPartyState(db, player.partyId, "combat");
  if (!combat?.active || currentTurn(combat)?.id !== player.id || combat.pendingRoll || (combat.bonusActionUsedPlayerIds || []).includes(player.id)) return null;
  if (!removeInventoryItem(db, player.id, "Potion of Healing", 1)) return null;
  combat.bonusActionUsedPlayerIds = [...new Set([...(combat.bonusActionUsedPlayerIds || []), player.id])];
  combat.pendingRoll = { kind:"healing", playerId:player.id, targetId:player.id, weapon:{ name:"Potion of Healing" }, diceCount:2, dieSides:4, modifier:2 };
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} drinks a Potion of Healing as a Bonus Action. Roll 2d4 + 2 Hit Points; ${player.name} can still take an action this turn.` });
  return saveCombat(db, player.partyId, combat);
}

function startInkGuardianCombat(db, player) {
  const party = listPlayers(db, player.partyId).filter((item) => item.hp > 0);
  const enemy = { id:"ink-dark-guardian", name:"Ink-dark guardian", ac:12, hp:10, maxHp:10, initiativeModifier:1, attackBonus:3, damageDice:[1,6], damageModifier:1 };
  const order = [
    ...party.map((item) => ({ id:item.id, name:item.name, type:"player", initiative:rollDie(20) + abilityModifier(item.abilities?.dexterity), initiativeModifier:abilityModifier(item.abilities?.dexterity) })),
    cottonCombatant(db, player.partyId),
    { id:enemy.id, name:enemy.name, type:"enemy", initiative:rollDie(20) + enemy.initiativeModifier, initiativeModifier:enemy.initiativeModifier },
  ].sort((a,b) => b.initiative - a.initiative || b.initiativeModifier - a.initiativeModifier || (a.type === "player" ? -1 : 1));
  const combat = { active:true, encounterId:"lantern-ink-guardian", partyId:player.partyId, round:1, turnIndex:0, order, enemies:[enemy], pendingRoll:null, dodgingPlayerIds:[], cottonHealsUsed:0, cottonNoMeowUsed:false, enemiesThatTriedCotton:[], outcome:null };
  setPlayerGuidance(db, player.id, player.partyId, []);
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Combat begins. Initiative: ${order.map((item) => `${item.name} ${item.initiative}`).join(", ")}.` });
  const first = currentTurn(combat);
  if (first.type === "companion") {
    runCottonTurn(db, combat);
    if (combat.active) advanceTurn(db, combat);
  } else if (first.type === "enemy") {
    runEnemyTurn(db, combat, enemy);
    if (combat.active) advanceTurn(db, combat);
  } else {
    setPartySpotlight(db, player.partyId, first.id);
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Round 1: ${first.name}'s turn.` });
  }
  saveCombat(db, player.partyId, combat);
  if (combat.active && currentTurn(combat)?.id === player.id) beginAttack(db, player, combat);
  return { source:"rules", combat:true };
}

export function startWorkshopCombat(db, player, opponentId, participantMode = "solo") {
  const opponent = WORKSHOP_OPPONENTS.find((item) => item.id === opponentId) || WORKSHOP_OPPONENTS[0];
  const allPlayers = listPlayers(db, player.partyId);
  for (const member of allPlayers) setPlayerHp(db, member.id, member.maxHp);
  const participants = participantMode === "party" ? allPlayers : allPlayers.filter((member) => member.id === player.id);
  const enemy = { ...opponent, maxHp:opponent.hp };
  const order = [
    ...participants.map((item) => ({ id:item.id, name:item.name, type:"player", initiative:rollDie(20) + abilityModifier(item.abilities?.dexterity), initiativeModifier:abilityModifier(item.abilities?.dexterity) })),
    ...(participantMode === "party" ? [cottonCombatant(db, player.partyId)] : []),
    { id:enemy.id, name:enemy.name, type:"enemy", initiative:rollDie(20) + enemy.initiativeModifier, initiativeModifier:enemy.initiativeModifier },
  ].sort((a,b) => b.initiative - a.initiative || b.initiativeModifier - a.initiativeModifier || (a.type === "player" ? -1 : 1));
  const combat = { active:true, encounterId:`workshop-${enemy.id}`, workshop:true, partyId:player.partyId, round:1, turnIndex:0, order, enemies:[enemy], pendingRoll:null, dodgingPlayerIds:[], bonusActionUsedPlayerIds:[], cottonHealsUsed:0, cottonNoMeowUsed:false, enemiesThatTriedCotton:[], outcome:null };
  for (const member of allPlayers) setPlayerGuidance(db, member.id, player.partyId, []);
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Workshop", text:`Test fight begins: ${participantMode === "party" ? "the party" : player.name} versus ${enemy.name}. All participating characters begin at full hit points. Initiative: ${order.map((item) => `${item.name} ${item.initiative}`).join(", ")}.` });
  const first = currentTurn(combat);
  if (first.type === "companion") {
    runCottonTurn(db, combat);
    if (combat.active) advanceTurn(db, combat);
  } else if (first.type === "enemy") {
    runEnemyTurn(db, combat, enemy);
    if (combat.active) advanceTurn(db, combat);
  } else {
    setPartySpotlight(db, player.partyId, first.id);
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Round 1: ${first.name}'s turn.` });
  }
  return saveCombat(db, player.partyId, combat);
}

export function resetWorkshopCombat(db, player) {
  const adventure = getActiveAdventure(db, player.partyId);
  for (const member of listPlayers(db, player.partyId)) {
    setPlayerHp(db, member.id, member.maxHp);
    restorePlayerSpellSlots(db, member.id);
    const refreshed = getPlayer(db, member.id);
    const current = refreshed.inventory.find((item) => item.name === "Potion of Healing" && item.sourceAdventureId === adventure?.id)?.quantity || 0;
    if (current < 2) addInventoryItem(db, member.id, { name:"Potion of Healing", quantity:2-current, notes:"Combat Workshop test supply; restored when the fight resets.", sourceAdventureId:adventure?.id });
  }
  setPartyState(db, player.partyId, "combat", null);
  setPartySpotlight(db, player.partyId, player.id);
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Workshop", text:"The test fight resets. Hit points, spell slots, and two test Potions of Healing are restored; temporary combat state is cleared." });
  return { ok:true };
}

export function workshopOptions() {
  return WORKSHOP_OPPONENTS.map(({ id,label,summary }) => ({ id,label,summary }));
}

function finishGuardianVictory(db, player, combat, method) {
  if (combat.workshop) {
    combat.active = false;
    combat.outcome = "victory";
    combat.pendingRoll = null;
    const enemy = combat.enemies[0];
    const victor = method === "cotton" ? "Cotton's contemptuous intervention" : `${player.name}'s attack`;
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Workshop", text:`${victor} completes the exercise. The ${enemy.name.toLowerCase()} is defeated after ${combat.round} round${combat.round === 1 ? "" : "s"}; no story progress, experience, or permanent rewards are awarded.` });
    return saveCombat(db, player.partyId, combat);
  }
  combat.active = false;
  combat.outcome = "victory";
  combat.pendingRoll = null;
  const dmState = getPartyState(db, player.partyId, "dm") || {};
  setPartyState(db, player.partyId, "dm", { ...dmState, clueStage:Math.max(9, Number(dmState.clueStage || 0)) });
  setPlayerGuidance(db, player.id, player.partyId, [{ label:"Clear the stones", text:"Carefully clear the loose stones to free Mara.", mode:"act", reason:"The guardian no longer blocks the rescue." }]);
    const text = method === "light"
    ? `${player.name} keeps the lantern's light fixed on the ink-dark guardian. It thins to a stain, recoils into a crack in the stone, and abandons the approach to Mara; the way to the loose stones is clear.`
    : method === "cotton"
      ? `Cotton touches the ink-dark guardian with one immaculate paw. Its shape forgets how to exist and gutters into a harmless stain; Cotton washes the paw with pointed disgust while the way to Mara becomes clear.`
    : `${player.name}'s blow breaks the ink-dark guardian's shape apart. It gutters across the floor like spilled ink and goes still; the way to Mara and the loose stones is clear.`;
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text });
  return saveCombat(db, player.partyId, combat);
}

export function handleCombatAction(db, player, mode, action) {
  const dmState = getPartyState(db, player.partyId, "dm") || {};
  let combat = getPartyState(db, player.partyId, "combat");
  const words = String(action || "").toLowerCase();
  const attacks = /\b(attack|strike|hit|slash|stab|shoot|fight)\w*\b/.test(words);
  if (!combat?.active) {
    if (mode === "act" && Number(dmState.clueStage || 0) === 8 && attacks && /\b(creature|guardian|thing|monster|it)\b/.test(words)) return startInkGuardianCombat(db, player);
    return null;
  }
  if (mode === "ask") return null;
  const turn = currentTurn(combat);
  if (turn?.type !== "player" || turn.id !== player.id) {
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`It is ${turn?.name || "another combatant"}'s turn; ${player.name}'s action waits.` });
    return { source:"rules", combat:true };
  }
  if (combat.pendingRoll) {
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Complete the pending ${combat.pendingRoll.kind === "attack" ? "attack" : "damage"} roll first.` });
    return { source:"rules", combat:true };
  }
  if (/\b(light|lantern|torch)\b/.test(words) && /\b(hold|aim|shine|keep|use|train)\w*\b/.test(words)) {
    finishGuardianVictory(db, player, combat, "light");
    return { source:"rules", combat:true };
  }
  if (attacks) {
    beginAttack(db, player, combat);
    return { source:"rules", combat:true };
  }
  if (/\bcast\b/.test(words)) {
    const spell = availableCombatSpells(player).find((item) => words.includes(item.name.toLowerCase()));
    if (spell) beginCombatSpell(db, player, spell.name);
    else addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`Name one of ${player.name}'s available combat spells rather than casting an unspecified spell.` });
    return { source:"rules", combat:true };
  }
  if (/\b(?:drink|use)\b.*\bpotion\b/.test(words)) {
    if (!beginCombatPotion(db, player)) addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Combat", text:`${player.name} cannot use a Potion of Healing right now.` });
    return { source:"rules", combat:true };
  }
  if (/\b(dodge|defend|brace)\w*\b/.test(words)) {
    combat.dodgingPlayerIds = [...new Set([...(combat.dodgingPlayerIds || []), player.id])];
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`${player.name} takes the Dodge action, focusing entirely on avoiding the guardian's next attack.` });
    advanceTurn(db, combat);
    saveCombat(db, player.partyId, combat);
    return { source:"rules", combat:true };
  }
  if (combat.workshop && /\b(cast|spell|cantrip|potion|item|rage|second wind|action surge|sneak attack|smite|wild shape|bardic|channel divinity|ki|focus point)\b/.test(words)) {
    const gaps = getPartyState(db, player.partyId, "workshopGaps") || [];
    gaps.push({ playerId:player.id, playerName:player.name, action:String(action).slice(0,220), createdAt:new Date().toISOString() });
    setPartyState(db, player.partyId, "workshopGaps", gaps.slice(-30));
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"system", speaker:"Workshop", text:`Test gap recorded: “${String(action).slice(0,140)}” is not yet connected to the combat rules engine, so the workshop did not invent an automatic result or consume ${player.name}'s turn.` });
    return { source:"rules", combat:true };
  }
  addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`Combat is underway. ${player.name} can attack, Dodge, or use the lantern light against the guardian.` });
  return { source:"rules", combat:true };
}

export function beginCombatAttack(db, player, weaponName) {
  const combat = getPartyState(db, player.partyId, "combat");
  if (!combat?.active) return null;
  return beginAttack(db, player, combat, weaponName);
}

export function takeCombatDodge(db, player) {
  return handleCombatAction(db, player, "act", "dodge");
}

export function resolveCombatRoll(db, player, sides, suppliedRoll) {
  const combat = getPartyState(db, player.partyId, "combat");
  const pending = combat?.pendingRoll;
  if (!combat?.active || !pending || pending.playerId !== player.id) return null;
  if (pending.kind === "healing" && Number(sides) === Number(pending.dieSides)) {
    const rolls = [Number(suppliedRoll)];
    while (rolls.length < pending.diceCount) rolls.push(rollDie(pending.dieSides));
    const healing = rolls.reduce((sum,value) => sum + value, 0) + Number(pending.modifier || 0);
    const current = getPlayer(db, player.id);
    const nextHp = setPlayerHp(db, player.id, current.hp + healing);
    combat.pendingRoll = null;
    addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"roll", speaker:"Combat", text:`${player.name} rolls ${rolls.join(" + ")} + 2 = ${healing} healing and now has ${nextHp}/${current.maxHp} HP. The potion is consumed; ${player.name}'s action remains available.` });
    saveCombat(db, player.partyId, combat);
    return { kind:"healing", rolls, healing, hp:nextHp };
  }
  if (pending.kind === "attack" && Number(sides) === 20) {
    const enemy = combat.enemies.find((item) => item.id === pending.targetId);
    const natural = Number(suppliedRoll);
    const total = natural + pending.weapon.attackBonus;
    const critical = natural === 20;
    const hit = natural !== 1 && (critical || total >= enemy.ac);
    addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"roll", speaker:"Combat", text:`${player.name} attacks with ${pending.weapon.name}: ${natural} ${signed(pending.weapon.attackBonus)} = ${total}—${critical ? "critical hit" : hit ? "hit" : "miss"}.` });
    if (!hit) {
      if (Number(pending.remainingBeams || 1) > 1) {
        combat.pendingRoll={...pending,remainingBeams:pending.remainingBeams-1,beamNumber:pending.beamNumber+1};
        addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`The beam misses. Roll d20 ${signed(pending.weapon.attackBonus)} for beam ${pending.beamNumber+1}.`});
        saveCombat(db,player.partyId,combat);
        return {kind:"attack",natural,total,hit:false,critical:false,beamsRemaining:pending.remainingBeams-1};
      }
      advanceTurn(db, combat);
      saveCombat(db, player.partyId, combat);
      return { kind:"attack", natural, total, hit:false, critical:false };
    }
    combat.pendingRoll = { kind:"damage", playerId:player.id, targetId:enemy.id, weapon:pending.weapon, diceCount:pending.weapon.dice[0] * (critical ? 2 : 1), dieSides:pending.weapon.dice[1], modifier:pending.weapon.damageModifier, critical, remainingBeams:pending.remainingBeams, totalBeams:pending.totalBeams, beamNumber:pending.beamNumber };
    addEvent(db, { partyId:player.partyId, visibility:"public", kind:"narration", speaker:"Dungeon Master", text:`The attack connects. Roll ${combat.pendingRoll.diceCount}d${combat.pendingRoll.dieSides}${combat.pendingRoll.modifier ? signed(combat.pendingRoll.modifier) : ""} damage.` });
    saveCombat(db, player.partyId, combat);
    return { kind:"attack", natural, total, hit:true, critical };
  }
  if (pending.kind === "damage" && Number(sides) === Number(pending.dieSides)) {
    const rolls = [Number(suppliedRoll)];
    while (rolls.length < pending.diceCount) rolls.push(rollDie(pending.dieSides));
    const rawDamage = rolls.reduce((sum,value) => sum + value, 0) + Number(pending.modifier || 0);
    const damage = Math.max(1, Math.floor(rawDamage * Number(pending.damageMultiplier ?? 1)));
    const enemy = combat.enemies.find((item) => item.id === pending.targetId);
    enemy.hp = Math.max(0, enemy.hp - damage);
    addEvent(db, { partyId:player.partyId, visibility:"public", playerId:player.id, kind:"roll", speaker:"Combat", text:`${player.name} rolls ${rolls.join(" + ")}${pending.modifier ? ` ${signed(pending.modifier)}` : ""} = ${damage} ${pending.weapon.name} damage. The ${enemy.name.toLowerCase()} is ${healthDescription(enemy).toLowerCase()}.` });
    if (enemy.hp <= 0) finishGuardianVictory(db, player, combat, "damage");
    else if (Number(pending.remainingBeams || 1) > 1) {
      combat.pendingRoll={kind:"attack",playerId:player.id,targetId:enemy.id,weapon:pending.weapon,source:"spell",remainingBeams:pending.remainingBeams-1,totalBeams:pending.totalBeams,beamNumber:pending.beamNumber+1};
      addEvent(db,{partyId:player.partyId,visibility:"public",kind:"narration",speaker:"Dungeon Master",text:`Resolve beam ${pending.beamNumber+1}. Roll d20 ${signed(pending.weapon.attackBonus)} for the spell attack.`});
      saveCombat(db,player.partyId,combat);
    } else {
      advanceTurn(db, combat);
      saveCombat(db, player.partyId, combat);
    }
    return { kind:"damage", rolls, damage, enemyStatus:healthDescription(enemy) };
  }
  return null;
}

export function combatView(db, player) {
  const combat = getPartyState(db, player.partyId, "combat");
  if (!combat) return null;
  const turn = currentTurn(combat);
  return {
    active:Boolean(combat.active), encounterId:combat.encounterId, round:combat.round, outcome:combat.outcome,
    turn:turn ? { id:turn.id, name:turn.name, type:turn.type, isYou:turn.id === player.id } : null,
    order:(combat.order || []).map((item) => ({ id:item.id, name:item.name, type:item.type, initiative:item.initiative, current:item.id === turn?.id })),
    enemies:(combat.enemies || []).map((enemy) => ({ id:enemy.id, name:enemy.name, status:healthDescription(enemy), defeated:enemy.hp <= 0 })),
    pendingRoll:combat.pendingRoll?.playerId === player.id ? { kind:combat.pendingRoll.kind, weaponName:combat.pendingRoll.weapon?.name, attackBonus:combat.pendingRoll.weapon?.attackBonus, diceCount:combat.pendingRoll.diceCount, dieSides:combat.pendingRoll.dieSides, modifier:combat.pendingRoll.modifier } : null,
    attacks:combat.active && turn?.id === player.id && !combat.pendingRoll ? availableAttacks(player).map((item) => ({ name:item.name, attackBonus:item.attackBonus, damage:item.damage })) : [],
    spells:combat.active && turn?.id === player.id && !combat.pendingRoll ? availableCombatSpells(player).map((item) => { const slot=player.spellcasting?.slots?.[String(item.slotLevel)]; return { name:item.name, level:item.level, attackBonus:item.kind === "attack" ? item.attackBonus : null, damage:item.beams>1?`${item.beams} beams · ${item.dice[0]}d${item.dice[1]}${item.modifier?signed(item.modifier):""} each`:`${item.dice[0]}d${item.dice[1]}${item.modifier ? signed(item.modifier) : ""}`, available:item.available, castsRemaining:item.level===0?null:Number(slot?.current||0), castsMaximum:item.level===0?null:Number(slot?.max||0) }; }) : [],
    potionCount:(player.inventory || []).find((item) => item.name === "Potion of Healing")?.quantity || 0,
    canUsePotion:Boolean(combat.active && turn?.id === player.id && !combat.pendingRoll && !(combat.bonusActionUsedPlayerIds || []).includes(player.id) && (player.inventory || []).some((item) => item.name === "Potion of Healing")),
    canAct:Boolean(combat.active && turn?.id === player.id && !combat.pendingRoll),
  };
}

export function isCombatActive(db, partyId) { return Boolean(getPartyState(db, partyId, "combat")?.active); }
