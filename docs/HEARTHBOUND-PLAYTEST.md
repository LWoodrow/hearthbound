# Hearthbound structured-engine playtest

Status: ready for the first focused browser playtest on the story-engine guardrail branch.

## Safe test instance

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
