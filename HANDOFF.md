# Hearthbound handoff

This is the shared operational record for humans and AI collaborators. Update it whenever work starts, changes direction, reaches a natural break point, or is handed to another worker.

## Current status

- Integrated branch: `main`
- Latest verified integration at creation: `590337b` (`Merge story engine guardrails`)
- Automated verification: 156 tests passing; production build passing
- Adventure validation: passing at the last completed engine slice
- Runtime servers: do not assume a port or process is active; inspect before testing
- Local AI models: machine-specific Ollama installations are not stored in Git

## Current priority

Improve player freedom and reliable conversational interpretation without weakening canonical state authority. Human play transcripts are the primary discovery tool; automated replays preserve confirmed failures and prevent regressions.

### Definition of done

- Natural player wording resolves to the correct generic intent and visible entity.
- Valid conversations do not accidentally trigger plot transitions.
- Valid actions commit one canonical state transition shared by narration, location, inventory, map, and recap.
- Invalid or ambiguous actions fail safely without inventing world facts.
- The same platform rule works across Hearthbound, Hysteria, and Unmasked where their mechanics overlap.
- Every confirmed failure has a categorized regression test.

## Active work

| Owner | Branch/worktree | Scope | Status | Files affected |
| --- | --- | --- | --- | --- |
| Codex | `codex/conversation-commitments` | Preserve deterministic NPC offers, commit natural actions canonically, and narrate movement as a bounded physical transition | Ready for human retest; intentionally not tested by Codex | `server/world-state.mjs`, `server/intent-resolver.mjs`, `server/interaction-engine.mjs`, `server/dm.mjs`, `server/database.mjs`, `HANDOFF.md` |
| Unassigned | — | Select the next item from `BACKLOG.md` | Ready | — |

Workers must add a row before beginning substantial work and remove or archive it in the handoff log when finished.

## Queued human playtest findings

- **Deferred to the next grouped engine update; do not patch or independently replay yet:** after reading Mara's opened instructions, `follow the letter's instructions` is classified as movement because `follow` is treated as a navigation verb. The interpreter should resolve the reference to the established instructions and either execute their explicit authored steps or ask which required step the player intends, without attempting a location transition.
- **Deferred narration overreach:** after `warm silver moth`, the result correctly wakes the ink-mite but then volunteers that the fresh inkwell remains untouched until deliberately offered. Although ink is already an established fact, this unnecessarily recommends the next action. Action narration should report the immediate result and changed state without prompting the next authored step unless guidance was requested or enabled through the guidance controls.
- **Implemented; awaiting human retest:** the Private Back Room remains the authored letter room and the pantry remains elsewhere through the taproom and kitchen. Natural transfer wording such as `add ink to inkmite` now resolves to the authored ink-transfer interaction, which commits `flags.mapDrawn` and `pantry-destination` before success narration. `follow the route to the pantry shelves` can then execute the existing authored multi-room route. No independent replay or automated test was run at the user's request.
- **Human retest confirmed the canonical route fix:** `add ink to inkmite` committed the route and `follow the line on the paper` successfully moved the party through the taproom and kitchen to the pantry shelves.
- **Deferred story-presentation disclosure:** the ink-mite result currently names the destination as pantry shelves before the party follows the trail. The player should initially know only that a traceable line or trail has formed and leaves a route to follow; the pantry destination should become known when the party follows it. Preserve the working canonical transition while separating `route drawn` from `destination discovered` in narration and, if necessary, story state.
- **Deferred action-scope/state issue:** after the cellar hatch is discovered, `open the cellar door` appears to make the Cellar the latest known/current location. Opening an entrance must change only the entrance's open state; entering or descending must require a separate player action unless the player explicitly combines both intentions.
- **Deferred unsupported narration/state contradiction:** the cellar-door result invents Nigel's trembling hands and says the door slams shut. The engine must not assign unchosen emotion to a player character or introduce an unauthorised closing/locking consequence after canonical state accepted an open action.
- **Deferred map projection/layout issue:** the narrated route explicitly passes through a working kitchen, but the map shows five places without a distinct kitchen. Labels resembling cellar/storage features (`storage`, `old tools`, `barrels`, `stairs down`) overlap the taproom/private-room region, and the pantry/cellar geometry is visually disconnected from the route. The map must project the same canonical location graph and feature ownership used by movement, without omitted intermediate rooms or cross-room feature leakage.
- **Human transcript confirms split current-location authority:** after the cellar-door transition, the map/latest-location projection indicates Cellar, while `look around` describes the Pantry and its pantry features. Narration, map, recap, inspection, and movement must read one committed `currentLocation`; no legacy `dm.currentLocationKey`, known-location order, or schema-v2 world projection may independently override it.
- **Implemented; awaiting human retest:** `go through concealed cellar hatch` successfully commits Cellar. Generic successful movement now narrates passage through the authored exit and arrival using the destination's bounded description instead of printing `The party moves to Cellar.` Authored per-exit narration continues to take precedence when supplied.
- **Implemented; awaiting human retest:** from the Cellar, `go down the stairs` previously matched the only stairs reference and incorrectly moved up to the Pantry. Vertical exits can now declare `up` or `down`; when a location has directional routes, explicit `up/down/ascend/descend` wording must agree with the authored direction. An impossible direction no longer silently reverses the player's movement.
- **Follow-up fix; awaiting human retest:** the first direction patch prevented the canonical move (the map correctly remained in Cellar) but returned the command as unhandled, allowing later narration to falsely claim movement to Pantry. A vertical direction mismatch is now a handled authoritative rejection that states the available direction and current location, preventing any model or legacy narration from inventing a transition beside unchanged state.

## Problem categories

| Category | Typical symptom | Correct layer to change |
| --- | --- | --- |
| Interpretation | “Go into the pub” differs from “go into the tavern”; questions are treated as object actions | Intent and entity resolution |
| Authority/state | Narration says the party moved or used an item but stored state disagrees | Canonical transition and transaction handling |
| Affordance/navigation | A visible or represented destination cannot be followed through an authored route | Generic interaction and graph rules |
| Conversation | Ordinary dialogue triggers a private room, clue, or other plot beat | Speech routing and NPC interaction policy |
| Content contract | Required clue routes, appearances, alternatives, or prerequisites were never authored | Adventure schema and validation |
| Model output | Reasoning tokens, malformed structured guidance, or unsupported prose reaches the player | Model-output boundary and sanitization |
| Presentation | UI displays stale state, unclear controls, or inconsistent universe identity | Client projection and interface code |

## Decisions and guardrails

- Code owns immutable truth, current location, inventory, discoveries, prerequisites, and consequences.
- The language model receives only the bounded facts needed for the current interaction.
- Model prose cannot directly update canonical state.
- Story content describes facts and permitted interactions; it must not compensate for missing platform behaviour.
- Fix the underlying failure class before adding synonyms or special-case story wording.
- Important NPCs may initiate scenes, but initiation must be state-neutral unless an authored transition is explicitly accepted.
- Human transcripts are evidence. Reduce each failure to the smallest reusable regression before changing behaviour.
- Keep the living authoring contract aligned with engine behaviour in `docs/STORY-BUILDING-RULESET.md` and `docs/AI-STORY-CONTRACT.md`.

## Standard workflow

1. Update local `main` from GitHub.
2. Create a dedicated clone/worktree and branch for the work package.
3. Add the assignment to **Active work** above.
4. Reproduce and categorize the problem before editing.
5. Add or update a regression test that represents the human wording and expected canonical outcome.
6. Implement the smallest platform-level correction.
7. Run the verification appropriate to the scope.
8. Update this file, relevant roadmap/backlog entries, and any affected authoring contract.
9. Commit the branch and merge only with user authorization.

## Verification

Run from the repository root:

```powershell
npm test
npm run build
npm run validate:adventures
```

For human testing, record:

- branch and commit;
- selected Ollama model;
- whether saves were reset;
- complete player/DM transcript;
- expected versus observed canonical location, inventory, discoveries, and next route.

## Known considerations

- Test characters, saves, and in-flight stories are disposable unless the user explicitly marks them for preservation.
- Ollama models and their loaded state are local runtime dependencies, not repository assets.
- Separate workers should use separate ports and databases as well as separate worktrees.
- A model comparison is meaningful only when prompt packet, canonical state, player inputs, and evaluation criteria are held constant.

## Next actions

1. Review `BACKLOG.md` and select the highest-value engine or interpretation failure class.
2. Continue human Hearthbound testing against a clean save and capture full transcripts.
3. Turn newly confirmed failures into generic regressions before implementing fixes.
4. Apply reusable platform improvements to Hysteria and Unmasked after Hearthbound reaches the agreed test threshold.

## Handoff log

| Date | Worker | Branch/commit | Completed | Verification | Next step |
| --- | --- | --- | --- | --- | --- |
| 2026-08-18 | Codex | `main` / pending documentation commit | Added shared collaboration rules and operational handoff structure | Documentation-only change | Select next backlog item in a dedicated branch/worktree |

