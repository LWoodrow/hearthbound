# Additional residents of Eldervale

Additive cast for The Roads of Eldervale. Established characters retain their identities, portraits, workplaces, introductions and task authority. Existing routes, main-story chapters and saves are unchanged.

| Region | Resident | Species | Usual workplace | Conversation and inspectable craft |
| --- | --- | --- | --- | --- |
| City | Sable Voss | Tiefling | Public worktable | Journals, travel, stitching |
| Rivergate | Torra Coppervein | Dwarf | Warehouse counter | Barrels, hoops and staves |
| Rivergate | Varek Embercoil | Dragonborn | Coach Stand | Harness safety and stitching |
| Willowford | Pip Underbough | Halfling | Square waypost | Neighbours and basket weaving |
| Willowford | Nim Brindle | Gnome | Smithy with Ada | Fittings and hinge samples |
| Stonecross | Ruka Fenreed | Orc | Reedbank Path | Reed weaving and bank care |
| Stonecross | Korrin Stonewake | Goliath | Ferryman's Hut | Historical water-height records |
| Mosswood | Lethiel Fernwake | Elf | Marked trail with Rowan | Plants and fern sketches |
| Greyfen | Seren Dawnmere | Aasimar | Register table with Iona | Decorative borders and illumination |
| Signal Hill | Borin Slate | Dwarf | Lookout with Perrin | Wind indicators and ribbons |

Ten residents cover all nine non-human adventurer species, with men and women. Heritage informs appearance/background, not behaviour stereotypes, hostile factions, free services or implied powers. Each has individual interests, a one-time welcome, local NPC/scenery features and a public biography. New welcome IDs work on re-entry in existing saves without resets.

Public directories describe ordinary roles/usual workplaces, not live off-scene whereabouts. Map NPC names require visits; portrait biographies require visible speech history. Use Speak and a name when several people share a scene. A selected partner remains available for nearby follow-ups. General hello keeps that partner, or lets the first present person in stable authored cast order acknowledge it; original hosts retain first place. Substantive ambiguous questions do not choose a new partner silently.

Conversation uses existing bounded facts and the prose model. Offline greeting/identification and all craft observations work deterministically; richer small talk remains model-dependent. No new purchases, gifts, tools, healing, prophecy, forecasts, quests, rewards or transport privileges are implemented. Existing permission/repair/report contacts remain authoritative.

## Reviewed portraits

No new raster art was generated for this package. Reuse the already approved species artwork through explicit independent NPC IDs in `shared/portrait-catalogue.mjs`. All referenced sheets were visually inspected against authored species, gender and appearance. Existing player choices and NPC faces remain unchanged. These shared faces remain available to players; bespoke NPC-only art is a future choice.

| NPC ID | Existing approved source portrait |
| --- | --- |
| sable | tiefling-female-v1 |
| torra | dwarf-female-v1 |
| varek | dragonborn-male-v1 |
| pip | halfling-male-v1 |
| nim | gnome-male-v1 |
| ruka | orc-female-v1 |
| korrin | goliath-male-v1 |
| lethiel | mystic (preferred original female elf) |
| seren | aasimar-female-v1 |
| borin | dwarf-male-v1 |

Paired sheets use exact half-sheet crops; the original elf uses the existing eight-cell crop. Small event portraits and enlarged biography views share one helper. Build checks verify all NPC/player assets are real PNGs copied intact into production.

## Shared lesson and testing

Register-border samples exposed an observation tie: a shorter internal ID and the full feature label scored identically. Longer complete authored phrases now beat shorter exact overlaps, independent of feature order. Additional regressions cover unrelated bell diagrams and gate hinge samples; no Greyfen-specific executor branch was added.

Regressions cover additive cast/location preservation, unmodified backing modules, old saves, local presence, gender/species-correct crops at all UI sizes, profile disclosure, offline inspection, targeted/follow-up dialogue, shared-scene greetings, once-only welcomes and unchanged quests, inventory and position. Human conversational and mobile visual review remains the quality gate.
