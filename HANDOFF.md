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
| Unassigned | — | Select the next item from `BACKLOG.md` | Ready | — |

Workers must add a row before beginning substantial work and remove or archive it in the handoff log when finished.

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

