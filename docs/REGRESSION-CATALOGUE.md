# Hearthbound regression catalogue

This is the minimum behaviour every adventure must preserve. The automated tests cover the engine rules; the short manual list checks the complete browser experience.

## Global engine rules

- Looking, listening, asking, or speaking never moves a character or operates an object.
- Movement only crosses an exit from the character's current location. A player cannot skip rooms.
- A movement request that names no revealed connected destination stops at the current location and never falls through to AI-authored travel.
- Locked, closed, hidden, and prerequisite-gated routes remain blocked until their recorded conditions are met.
- Successful actions update authoritative world state before narration is produced.
- AI director output is untrusted input: clocks, completion, private discoveries, locations, checks, and inventory transfers are validated before anything persists.
- Danger clocks and adventure completion change only through deterministic rules, never directly from model output.
- A model-requested check becomes a real pending roll only when its ability, optional skill, ability-skill pairing, reason, and DC 5–25 are valid.
- AI-proposed inventory quantities cannot exceed the explicit quantity in the player's transfer action; repeated, unnamed, unconfirmed, or companion transfers are rejected.
- Repeating an already completed action gives a stable response; it does not recreate rewards, reopen story stages, or duplicate locations.
- A completed action remains an idempotent repeat when its own effects made the original prerequisite false; it is never reported as newly blocked.
- Mutable feature labels and contents follow canonical state everywhere: opened is never still described as sealed, awake as dormant, or carried as resting in the room.
- Rereading authored instructions repeats their useful content, and explicit pickup language never degrades into inspection.
- Compound instructions may include already-completed steps and must continue through valid remaining steps without duplicating prior effects.
- Opening a container reveals it but never automatically takes its contents.
- Items enter inventory only after an explicit pickup, and unique items can be acquired only once.
- Party companions, including Cotton, are never inventory items.
- Searching for traps or immediate hazards uses Wisdom (Perception).
- Studying mechanisms, construction, evidence, runes, or locks uses Intelligence (Investigation).
- Forcing or breaking a substantial obstacle uses Strength (Athletics).
- Failed checks preserve uncertainty and do not prove that a hidden danger is absent.
- Speech is party conversation unless an audible NPC or enemy is present and able to hear it.
- Natural questions or statements about work, trouble, help, rumours, or direction reach the clear sole NPC conversational partner; an initial thanks must not swallow a substantive follow-up question.
- Player maps show visited or explicitly discovered places only; hidden rooms and routes remain absent.
- Combat initiative, turns, damage, resources, and defeat are resolved by the combat system rather than improvised narration.
- The player recap is compiled from authoritative room state, accepted public facts, player actions, rolls, inventory, and known locations; unsupported narration and DM-only notes never become recap facts.
- Narration style examples influence prose only and never enter director adjudication or become campaign people, places, objects, or outcomes.
- Turn traces assess final narration separately from canonical state. A stale-location sentence can fail narration validation while the accepted movement and stored location remain correct.

## Adventure-definition rules

- Every adventure has one valid start location and a reachable location graph.
- Every exit has a real destination and an optional real door or gate object.
- Every feature, object, container, and item belongs to a real location.
- Container contents name real items; keyed objects name real items.
- Scene and milestone requirements refer to authoritative state.
- Story stages cannot jump over required intermediate stages.
- The adventure validator must pass before a new or changed adventure is playable.

## The Lantern Below reference route

The authoritative route is:

1. Outside the Crooked Lantern
2. Public taproom
3. Private back room
4. Kitchen
5. Pantry
6. Cellar
7. Cellar passage
8. Mothglass chamber
9. Ancient passage
10. Collapsed survey alcove

The private room, kitchen, and pantry are separate locations. The letter cannot appear outside or in the taproom. The cellar cannot be reached until the pantry route is found and opened. Later doors and mechanisms retain their open, locked, and completed state.

## Manual browser smoke test

For the full structured-engine journey and isolated test-server instructions, use `docs/HEARTHBOUND-PLAYTEST.md`.

1. Restart The Lantern Below and look through the windows. The party must remain outside.
2. Enter the front door, then deliberately seek a private room. Confirm the taproom and private room are separate.
3. Try to go directly to the pantry or cellar. The game must refuse the skipped route without inventing travel.
4. Search for traps, inspect a mechanism, and force a heavy obstruction. Confirm Perception, Investigation, and Athletics respectively.
5. Open a locked container. Confirm its item is not added until explicitly taken and cannot be taken twice.
6. Use a matching key on a door. It should unlock and open once; crossing it should advance to the adjacent location.
7. Repeat an already completed instruction such as opening the same door or continuing down the same passage. State and inventory must not duplicate or loop backward.
8. Try to pick up Cotton. The game must treat him as a companion, never an item.
9. Open Known map after each move. Only visited locations should appear and the latest location should be correct.
10. Expand Previously in this adventure. Confirm the current location, visible features, recorded items, actions, and rolls agree with the game; no hidden note or unsupported narration should appear as an established outcome.
