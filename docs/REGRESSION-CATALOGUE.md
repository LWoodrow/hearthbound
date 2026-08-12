# Hearthbound regression catalogue

This is the minimum behaviour every adventure must preserve. The automated tests cover the engine rules; the short manual list checks the complete browser experience.

## Global engine rules

- Looking, listening, asking, or speaking never moves a character or operates an object.
- Movement only crosses an exit from the character's current location. A player cannot skip rooms.
- Locked, closed, hidden, and prerequisite-gated routes remain blocked until their recorded conditions are met.
- Successful actions update authoritative world state before narration is produced.
- Repeating an already completed action gives a stable response; it does not recreate rewards, reopen story stages, or duplicate locations.
- Opening a container reveals it but never automatically takes its contents.
- Items enter inventory only after an explicit pickup, and unique items can be acquired only once.
- Party companions, including Cotton, are never inventory items.
- Searching for traps or immediate hazards uses Wisdom (Perception).
- Studying mechanisms, construction, evidence, runes, or locks uses Intelligence (Investigation).
- Forcing or breaking a substantial obstacle uses Strength (Athletics).
- Failed checks preserve uncertainty and do not prove that a hidden danger is absent.
- Speech is party conversation unless an audible NPC or enemy is present and able to hear it.
- Player maps show visited or explicitly discovered places only; hidden rooms and routes remain absent.
- Combat initiative, turns, damage, resources, and defeat are resolved by the combat system rather than improvised narration.

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

1. Restart The Lantern Below and look through the windows. The party must remain outside.
2. Enter the front door, then deliberately seek a private room. Confirm the taproom and private room are separate.
3. Try to go directly to the pantry or cellar. The game must refuse the skipped route without inventing travel.
4. Search for traps, inspect a mechanism, and force a heavy obstruction. Confirm Perception, Investigation, and Athletics respectively.
5. Open a locked container. Confirm its item is not added until explicitly taken and cannot be taken twice.
6. Use a matching key on a door. It should unlock and open once; crossing it should advance to the adjacent location.
7. Repeat an already completed instruction such as opening the same door or continuing down the same passage. State and inventory must not duplicate or loop backward.
8. Try to pick up Cotton. The game must treat him as a companion, never an item.
9. Open Known map after each move. Only visited locations should appear and the latest location should be correct.
