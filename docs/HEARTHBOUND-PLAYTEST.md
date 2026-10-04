# Hearthbound structured-engine playtest

Status: ready for the first focused browser playtest on the story-engine guardrail branch.

Current continuation preview (2026-10-04): port **4322**, existing AI-preview save and configured llama.cpp model. Do not use the older disposable 4321 instructions to replace this save. Refresh the preview after the app update; restarting the adventure is optional, not required for the aftermath.

Closing/input retest: an unmatched first turn must not narrate entry; polite quiet-seat requests must reach the authored room; `pickup key` must select only the unique visible key; closed unlocked doors must explain opening. Nearby Say aloud should reach Mara through the open adjacent connection, while Party only and remote physical actions cannot. After rescue, escort Mara back through explored/open rooms to Tamsin, check current NPC presence, stay and talk, complete both earned levels without leaving Adventure, then explicitly choose Briarwatch. Check backtracking, cancelled level choices, a closed return threshold and a second low-level party member. Neither escort nor levelling may re-award completion or respawn encounters. The hearth respite is flavour, not a mechanical Long Rest.

## Safe test instance

Rivergate hub retest (4322 preview; existing save retained): return through the public roads to Rivergate Market. Known map should show the illustrated local hub with seven charted places and no unvisited resident metadata. Visit each business via the square; docks and warehouse also share a direct lane. Speak with the six portrait-bearing residents, ask Elin about work, inspect receiver marks at the docks OR the manifest at Records Office, then arrange the correction at the docks and report to Elin. Alternatively ask Harlan for exchange permission after Elin's request and exchange the sealed deliveries at the docks. Inspection/permission must not move cargo; speech must not perform physical correction; repeats/backtracking must retain the chosen outcome. Check the road noticeboard at the Blue Heron: Briarwatch rumours must not bypass main-story gates. Visit the Coach Stand, board its City service after exploring the connecting road; Willowford service still requires visited stops and the repaired crossing. Retest blockers with pending checks/combat/fallen party members. No purchases, lodging/healing or new campaign levels are implemented.

Square/portrait retest (existing 4322 save; refresh, no reset): use Act with `any people around here in the square`, `who is here` and `is anyone nearby`; expect authored villagers/farm workers, no invented named NPC or movement. Say aloud `hello`; expect a villager acknowledgement, not Use Act. Private Party only must not receive that reply. Visit all six residents and check distinct permanent dialogue portraits; unencountered residents must not be disclosed in portrait metadata. Empty-scene greetings may receive no reply without being invalid.

Willowford movement/conversation follow-up: from The Willow Cup try `goto village square`, `head back to village square` or `travel to village square`; each must follow the actual square exit. From the inn, direct movement to the smithy or undiscovered sluice still fails; Say aloud and observation never move you. Ask Merrin who lives locally or whom to visit: she may name the authored residents and usual workplaces, but not claim their current off-scene whereabouts, invent new townsfolk, reveal the repair solution or grant permission. Repeat with another resident. Introducing Ada must not mark the smithy visited.

Briarwatch departure retest: at the opening approach road, road beyond the barrier or East Well, Known map → Explore the public roads should be enabled unless combat, any party member's pending check or a fallen member blocks travel. Depart, visit the region and return to City → Resume saved main adventure. Confirm the same Briarwatch scene, clue stage, danger clock, inventory and HP resume. Tower/vault departures must stay blocked with a Briarwatch-specific reason beside the button. Your saved Lantern location must not affect the result. Hollow Star currently explains that regional detours are not yet available in that chapter.

Willowford follow-up (2026-10-04, existing 4322 preview; no restart/reset required):

1. Reach Willowford through Market and Ferry. Known map now shows the illustrated village before the regional atlas. Confirm seven public places, no sluice marker and no unvisited NPC names.
2. Visit the Willow Cup, smithy, shrine and landing via the square. Speak aloud to the present resident. Decoration must not imply purchases, free equipment, healing or extra destinations.
3. Visit Thorn Orchard and investigate the irrigation channel, or investigate the feeder at Willow Landing. Both reveal the same sluice/footpath. It is reachable from the orchard, not remotely from the landing.
4. At the sluice, attempt a repair before examining the blockage. It must remain unresolved. Examine it, then either clear the storm debris or visit Sister Fen to explicitly request overflow permission and return to use the lever. Repeat the chosen action and try the alternative after resolution; the first consequence must remain stable.
5. Return to Bessa and report the restored water. Check the current orchard description, NPC conversation and map task state. The main adventure, inventory and levels must remain unchanged. Testing the other branch requires a separate test party/save, not resetting your existing campaign.
6. Visit the coach yard. Its carriage controls appear in the regional atlas below the local plate. Ride to City, then back to Willowford. Unvisited connecting places and an unrepaired Stonecross crossing must block transport. City alone permits resuming the paused main adventure.
7. Check marker labels, zoom/scroll, destination dropdowns and touch targets on desktop and tablet. The artwork is fixed; earlier markers/routes must not reposition as the sluice is revealed.

Regional atlas retest (2026-10-04): open Known map and inspect the illustrated map, selectable markers, destination dropdown and zoom at desktop and iPad widths. At the Lantern frontage or public taproom choose Explore the public roads. Visit Market → Ferry → Willowford → Mosswood → Signal Hill → Greyfen → City (or reverse the loop). Check each NPC greeting, local Say aloud conversation and backtracking position. Repair the ferry mooring and share a traveller story with Iona; revisit to check persistent state and no duplicate rewards. Return to City and resume the exact paused main-story room. A saved completed Lantern must stay complete; no inventory, HP, class resource or level reward changes occur simply through detours. Dungeon departures, active combat, any party member's pending check and fallen members must block departure. Visible later chapter markers are not shortcuts. New NPCs have names but no unreviewed portrait assignments. The larger campaign extension and richer local encounters remain future content work.

Run `npm run build`, then `npm run playtest`. The test instance uses:

- Port `4321`, leaving the normal application on `4173` and the menu preview on `4318` untouched
- `data/hearthbound-playtest.sqlite`, separate from the family campaign database
- Qwen through the normal active model profile
- The opt-in Hearthbound checklist and redacted prompt inspector

The playtest database is deliberately disposable and is excluded from Git with the rest of `data/`.

## First journey

Use natural wording rather than copying these sentences exactly when possible. The checklist should recognise real state changes, not particular prose.

1. From outside, look through the taproom windows. Confirm the party remains outside.
2. Enter the Crooked Lantern through the front door.
3. Ask for or enter a quiet private room.
4. Inspect the sealed letter without opening it. Confirm the seal stays intact and later clues remain unknown.
5. Deliberately open the letter and read it.
6. Find fresh ink and a safe flame. Confirm finding them does not automatically warm the seal or apply ink.
7. Warm the silver-moth seal and offer the awakened ink-mite fresh ink.
8. Follow the drawn route through the kitchen to the pantry.
9. Search the pantry shelves, then open and descend through the revealed cellar route.
10. Follow Mara's survey marks into the cellar passage. Try one premature destination or vague “continue deeper” action and confirm it cannot invent a room.
11. Use the recorded key on its matching door, then cross the threshold. Repeat the open action and confirm it does not duplicate state.
12. In the Mothglass chamber, inspect the lantern mechanism before operating it. Resolve the requested Investigation check.
13. Operate the counterweighted lantern, enter the revealed passage, and continue to the collapsed alcove.
14. Resolve the guardian and rescue Mara. Confirm completion occurs only after the deterministic requirements are met.

## What to watch

- The gold playtest panel advances only when recorded state satisfies a checkpoint.
- “Previously in this adventure” agrees with the map, inventory, current room, accepted outcomes, and pending roll.
- Restart returns to a genuinely fresh exterior state: no visited cellar, opened door, container, Cotton timing, pending check, or interaction state survives.
- The first sentence of narration states the concrete outcome instead of substituting atmosphere.
- Rephrasing an action does not skip a room, repeat a reward, invent an item, or reveal a later clue.
- Ask DM explains rules or visible facts but never performs the action.

## Alternate story-route journey

Restart before this journey. Its purpose is to test the authored story rather than repeat the original clue script.

1. Enter the taproom and ask Tamsin Reed about Mara Vey or whether Mara expected visitors. Confirm Tamsin knows only her authored inn-level facts.
2. Establish trust or show Mara's note, then ask what Mara investigated. Confirm Tamsin can identify the pantry interest without knowing what lies below it.
3. Ask for access to the pantry instead of sneaking in. Confirm cooperation is a valid route and the company moves through the real kitchen connection.
4. In the pantry, ignore the ink-mite route and inspect the shelves, floor draught, or scrape marks. Confirm one of these physical routes can establish the concealed hatch.
5. If a check fails, try another authored method. Confirm the hatch and story remain available and the response describes a cost or incomplete observation rather than claiming nothing exists.
6. Below the inn, use different evidence to follow Mara: survey marks, recent boot scuffs, the ink-mite, or the survey box. Confirm all successful routes converge on the same physical truth.
7. In the mothglass chamber, reason from the dust, seam, counterweight, or Mara's arrow. Confirm examination reveals operation but does not operate the spindle automatically.
8. At the guardian, try steady lantern light, spilled ink, warding ingenuity, or combat. Confirm the chosen solution changes the cost but leaves Mara's rescue achievable.
9. Speak with Mara before and after rescue. Confirm urgent immediate knowledge is available before rescue, while the wider campaign connection appears only afterward and does not identify the hidden villain or The Witness.

Capture any route that is authored here but still falls back to a generic refusal. That is now a missing story-to-engine binding, not a reason to add a new global narration rule.

Use **Copy test status** when reporting a problem. Include the copied status, the words entered, what appeared, and what was expected. It contains recent player-visible activity and checkpoint state, but no adventure bible or DM-only ledger text.

## Release gate

The Hearthbound test gate is satisfied when:

1. All first-journey checklist gates and the alternate story-route journey pass through ordinary play.
2. Restart is verified after meaningful progress.
3. Map, recap, inventory, and narration agree at the cellar, Mothglass, and rescue checkpoints.
4. No hidden fact appears early and no rejected model consequence persists.
5. The complete automated suite, adventure validator, production build, and diff check remain green.
# Portrait inspection check (2026-10-04)

## Stonecross hub test (2026-10-04)

Use preview 4322 on `codex/stonecross-hub`; no save reset is required. Follow City → Rivergate → Stonecross. Check the hut, Reed & Oar, Pikebank Boatyard, Coach Stop and Reedbank; the boathouse marker must be absent before disclosure. Ask Jory about work or read either the inn journal or boatyard damage report. Check that discovery adds the same boathouse marker without moving other anchors. At the reedbank choose baiting the feeding bowl before entering, or enter without bait for the real marsh-rat encounter. Repair the bell only after advice and rat resolution, return to Jory and report. Revisit and reread to check truthful persistent descriptions, no respawn and no duplicate rewards. Ferry repair remains separate; restore its mooring and visit connected stops to test carriage trips. Check larger portrait/background popouts for all four residents, greetings, ordinary conversation and mobile map-label readability. Neither optional task advances or levels the saved main story.

In the gameplay roster, click your portrait and Cotton's; then click an encountered NPC portrait in the story. Confirm a larger image and background appear without changing location, turn or selected tab. Escape, Close and clicking outside should dismiss it and restore focus to the portrait. Tab should remain within the popout. Check mobile layout and longer player backstories. Unencountered NPCs and private story facts must not appear. Character selection and combat action buttons must retain their original behaviour.
