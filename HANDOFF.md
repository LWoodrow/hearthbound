# Hearthbound handoff

This is the shared operational record for humans and AI collaborators. Update it whenever work starts, changes direction, reaches a natural break point, or is handed to another worker.

## Current status

- Integrated GitHub baseline: `main` at `03fb588` (`docs: add shared project handoff workflow`)
- Active development branch: `codex/conversation-commitments` at `839dca9` before this documentation update
- Latest full automated verification: 156 tests passing; production build and adventure validation passing
- Recent resolver slices received syntax checks only; human playtesting is in progress by request
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
| Codex | `codex/conversation-commitments` | Document and publish the one-click Windows startup and handoff workflow | Ready to publish; syntax checks only | `Start-Hearthbound.ps1`, `README.md`, `.env.example`, `docs/STARTUP-AND-HANDOFF.md`, `HANDOFF.md` |
| Unassigned | — | Select the next item from `BACKLOG.md` | Ready | — |

Workers must add a row before beginning substantial work and remove or archive it in the handoff log when finished.

## Queued human playtest findings

- **Deferred to the next grouped engine update; do not patch or independently replay yet:** after reading Mara's opened instructions, `follow the letter's instructions` is classified as movement because `follow` is treated as a navigation verb. The interpreter should resolve the reference to the established instructions and either execute their explicit authored steps or ask which required step the player intends, without attempting a location transition.
- **Implemented in the grouped canonical-action update; awaiting human retest:** after `warm silver moth`, narration now reports only that the ink-mite wakes and stirs. It no longer recommends the fresh ink or enumerates unchanged route state.
- **Implemented; awaiting human retest:** the Private Back Room remains the authored letter room and the pantry remains elsewhere through the taproom and kitchen. Natural transfer wording such as `add ink to inkmite` now resolves to the authored ink-transfer interaction, which commits `flags.mapDrawn` and `pantry-destination` before success narration. `follow the route to the pantry shelves` can then execute the existing authored multi-room route. No independent replay or automated test was run at the user's request.
- **Human retest confirmed the canonical route fix:** `add ink to inkmite` committed the route and `follow the line on the paper` successfully moved the party through the taproom and kitchen to the pantry shelves.
- **Implemented in the grouped canonical-action update; awaiting human retest:** offering ink now records only that a followable route was drawn. The pantry destination becomes public and canonical only when the party follows the route.
- **Implemented in the grouped canonical-action update; awaiting human retest:** a generic local reference such as `open door` resolves when exactly one visible route object can undergo the requested state change. Opening the concealed hatch changes only its open state; entering the Cellar remains a separate movement.
- **Resolved at the deterministic boundary; awaiting human retest:** because `open door` no longer falls through to model narration, it cannot invent Nigel's emotion, reveal Cellar contents, or claim that the hatch closes while canonical state remains in Pantry.
- **Deferred map projection/layout issue:** the narrated route explicitly passes through a working kitchen, but the map shows five places without a distinct kitchen. Labels resembling cellar/storage features (`storage`, `old tools`, `barrels`, `stairs down`) overlap the taproom/private-room region, and the pantry/cellar geometry is visually disconnected from the route. The map must project the same canonical location graph and feature ownership used by movement, without omitted intermediate rooms or cross-room feature leakage.
- **Human transcript confirms split current-location authority:** after the cellar-door transition, the map/latest-location projection indicates Cellar, while `look around` describes the Pantry and its pantry features. Narration, map, recap, inspection, and movement must read one committed `currentLocation`; no legacy `dm.currentLocationKey`, known-location order, or schema-v2 world projection may independently override it.
- **Implemented; awaiting human retest:** `go through concealed cellar hatch` successfully commits Cellar. Generic successful movement now narrates passage through the authored exit and arrival using the destination's bounded description instead of printing `The party moves to Cellar.` Authored per-exit narration continues to take precedence when supplied.
- **Implemented; awaiting human retest:** from the Cellar, `go down the stairs` previously matched the only stairs reference and incorrectly moved up to the Pantry. Vertical exits can now declare `up` or `down`; when a location has directional routes, explicit `up/down/ascend/descend` wording must agree with the authored direction. An impossible direction no longer silently reverses the player's movement.
- **Follow-up fix; awaiting human retest:** the first direction patch prevented the canonical move (the map correctly remained in Cellar) but returned the command as unhandled, allowing later narration to falsely claim movement to Pantry. A vertical direction mismatch is now a handled authoritative rejection that states the available direction and current location, preventing any model or legacy narration from inventing a transition beside unchanged state.
- **Implemented in the grouped canonical-action update; awaiting human retest:** an authored NPC offer remains pending with its NPC and interaction. Natural readiness wording or `follow <offering NPC>` accepts and executes that exact interaction once; unrelated speech clears it. Model prose alone still cannot create an escort route.
- **Implemented in the grouped canonical-action update; awaiting human retest:** opening Mara's letter now presents its established contents and stops without announcing that no destination was named.
- **Implemented in the grouped canonical-action update; awaiting human retest:** partial but unambiguous local object references such as `the shelves` can match `pantry shelves`; low-information words such as `some`, `room`, and `place` are excluded so this does not revive accidental plot transitions from phrases such as `some drinks`.
- **New human finding included in the grouped fix:** from Pantry, model narration for `open door` described the Cellar and its locked stone door while canonical state stayed in Pantry; the subsequent `walk to locked door` was therefore rejected. This is the confirming transcript for the generic route-object resolution and bounded-opening changes above.
- **New human finding; log only pending the next grouped update:** `investigate pantry shelves` successfully discovers and narrates the concealed cellar hatch, but the next `investigate hatch` says the hatch is not present in Pantry and omits it from the visible-feature list. Canonical object discovery and the location's visible-feature projection are out of sync after the authored interaction. A revealed route object must immediately become addressable by its id, label, and short aliases in observation and object actions, without requiring a reload or a second discovery path.
- **Same underlying reference/projection family; log only pending the grouped update:** after the player repeats the shelf investigation and successfully opens the revealed cellar hatch, `look at cellar hatch` resolves to the similarly named `cellar key` and reports that the key is absent. Observation currently searches item names before the visible local route object and accepts a weak shared-token match. Resolution must rank exact/local/visible entities above absent similarly named inventory or story items, preserve entity type, and avoid returning an absent-object message for a different candidate than the player named.
- **Implemented; awaiting human retest:** the Help / Ask DM guidance panel retained cards from earlier scenes (`Examine the seal`, `Open the letter`) after the party reached the Cellar, and clicking one submitted an impossible letter action there. Guided cards are now rebuilt from the latest schema-v2 canonical projection whenever the game view is requested, unless a check is pending. Cached narrator suggestions can no longer survive a room or clue-stage transition.
- **Implemented; awaiting human retest:** in the Private Back Room, `Examine the note for any additional visible marks or writing` selected the writing desk. Local feature matching now weights the named entity's final meaningful noun above incidental modifiers, includes item aliases when scoring its local feature, and gives the opened note a bounded authored observation.
- **Implemented; awaiting human retest:** in the Cellar, `walk to locked stone door and investigate` and `are there any markings on the stone door?` returned only its lock state. Surface-detail questions now answer their requested bounded scope and may include object state second; compound local approach-plus-observe wording remains observation because it does not cross a location boundary.
- **Implemented; awaiting human retest:** visible local features are resolved before absent items. Together with head-noun weighting, this prevents `cellar key` from stealing `look at cellar hatch` and makes a canonically discovered hatch immediately addressable through its local feature.

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

