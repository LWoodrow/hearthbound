# Story-engine convergence roadmap

Status: Active plan on `codex/story-engine-guardrails`

## Convergence result (2026-08-13)

Implementation status: **Phases 0–9 complete; Phase 10 harness complete and the live paired comparison remains. Overall convergence: 96%.**

- Phase 2: schema-v2 canonical world state, revisions, discoveries, resources, clocks, knowledge, and outcome log are implemented. Legacy DM fields are derived projections; compatibility adapters run only before a schema-v2 save exists.
- Phases 3–4: validated authored interactions, atomic effects, idempotency, literal intent roles, reference confidence, representations, instrument matching, and prerequisite diagnostics are implemented without adventure-ID checks in the executor.
- Phases 5–6: The Lantern Below opening, Tamsin alternate lead, cellar, spindle, guardian alternatives, rescue, and completion are represented as authored interactions. Existing prototype compatibility rules remain isolated in `dm.mjs` for pre-v2 test saves and are no longer consulted once canonical state exists.
- Phase 7: 14 classified incidents and 28 paraphrases, invariant tests, mutation tests, model-off resolution, and failure-layer traces are versioned and green.
- Phase 8: The Impossible Fossil Hysteria pilot proves evidence progression, exposure, consumables, containment, and irreversible aftermath through the shared executor.
- Phase 9: The Clockmaker's Alibi Unmasked pilot proves immutable culprit/timeline truth, evidence provenance and custody, suspect-specific knowledge, contradictions, multiple evidence gates, and deterministic accusation validation.
- Phase 10: versioned Qwen/Gemma profiles, identical prompt-packet tests, and a reusable scoring harness cover faithfulness, forbidden invention, repetition, and latency. Qwen and Gemma 4 12B are installed locally. Gemma is active on the disposable playtest instance; a real paired run over identical saved packets is still required before changing the default narrator.

Verified gates: 145/145 automated tests pass, the production build passes, and all three registered adventure definitions validate. The reusable authoring requirements are consolidated in [`STORY-BUILDING-RULESET.md`](STORY-BUILDING-RULESET.md). No commit or push was made.

Purpose: replace adventure-specific phrase patches with one executable story model, one authoritative campaign state, traceable transitions, and reusable validation. Hearthbound is the migration case, Hysteria is the first clean reuse proof, Unmasked is the stricter evidence-logic proof, and Classified later extends that evidence model with time, resources, counter-intelligence, and controlled deception.

Delivery guardrail: every systemic lesson discovered during implementation or human playtesting must update [`STORY-BUILDING-RULESET.md`](STORY-BUILDING-RULESET.md) in the same work package, or the handoff must identify the existing rule that already covers it. A phase cannot be marked complete while the executable schema, regressions, AI contract, authoring ruleset, and status summary disagree.

This roadmap does not require adopting LangGraph, Ink, SillyTavern, or Holmes. It adopts their useful patterns: explicit state and transitions, checkpointed history, modular context, bounded character knowledge, and precomputed evidence timelines.
## Prototype data policy

All current characters, campaigns, in-flight stories, saves, generated scenes, and other play records are test data. They may be reset or deleted when doing so produces a cleaner canonical-state design, safer schema change, or more reliable test baseline.

- Do not build compatibility layers solely to preserve prototype play data.
- Preserve authored adventure definitions, source code, regression fixtures, and intentional design documents.
- Prefer a deliberate clean reset over silently repairing ambiguous or contradictory prototype state.
- Before a material reset, identify the exact database or generated-data target and keep the operation scoped to application test data.
- After a reset, record what was removed and recreate only the minimal fixtures needed for verification.
- Save migrations are required only when they teach or prove a mechanism needed for a future supported release.

## Target turn pipeline

Every player turn should eventually follow the same path:

1. Parse the player's literal intent without changing state.
2. Resolve referenced people, places, objects, clues, representations, and instruments against the current authoritative scene.
3. Find the matching authored affordance or generic world rule.
4. Validate location, visibility, prerequisites, resources, action scope, and repeatability.
5. Apply one atomic state transition or create one pending check.
6. Append a canonical outcome event containing the accepted facts and state delta.
7. Derive map, recap, guidance, and model context from the new state and outcome log.
8. Ask the model only to narrate the accepted public outcome.

Narration never becomes evidence that a transition occurred.

## Failure categories used during delivery

Every captured failure receives one primary owner:

- `story-definition`: a truth, clue, source, consequence, or resolution is missing or contradictory.
- `story-binding`: correct authored data cannot yet be executed by the generic runtime.
- `intent-reference`: the verb, target, instrument, destination, or represented object was resolved incorrectly.
- `engine-semantics`: a generic rule for movement, observation, inventory, checks, combat, or repetition is wrong.
- `state-persistence`: accepted state was stored, restored, migrated, or projected incorrectly.
- `context-visibility`: the model received stale, irrelevant, private, or premature facts.
- `narration`: state and context were correct but the prose misstated them.
- `ux-guidance`: the system was correct but the available action or refusal was unclear.

If a failure cannot be classified from the trace, diagnostics are incomplete and the next action is not another wording patch.

## Delivery phases

### Phase 0 - Preserve the current evidence

Goal: make the existing work and failures reproducible before changing the architecture.

Progress: replay fixture schema and the first classified corpus are implemented. All 14 incidents retain their original wording plus two paraphrases (42 inputs total). Generic world-action cases execute directly; story-binding and cross-turn cases retain explicit integration expectations until the interaction executor exists.

Deliverables:

1. Commit the current story-engine guardrail work as a recoverable checkpoint after review.
2. Convert every transcript reported so far into a named replay fixture.
3. Record initial state, exact input, expected intent, required state changes, forbidden state changes, and expected player-visible facts.
4. Tag each case with one failure category and one invariant.
5. Keep the original wording and add paraphrases separately; do not weaken a case to match current behaviour.

Exit gate:

- The kitchen/location contradiction, moved letter, seal inspection leak, separate warmth/ink actions, map-versus-destination confusion, Cotton threat invention, corridor invention, duplicate actions, and stale-location answer are represented as reproducible cases.

### Phase 1 - Add a canonical turn trace

Goal: identify the owning layer of a failure without reading scattered logs or guessing from narration.

Progress: the server records a bounded per-adventure trace for action requests and resolved checks. It includes literal intent roles, visible entity candidates, before/after hashes, a monotonic accepted-state revision, selected resolver and affordance, candidate affordances with failed prerequisites, pending checks, public facts, changed state paths, prompt-packet IDs, and rejected model proposals. The opt-in playtest export exposes only public state and aggregate candidate/rejection counts; story restart clears traces and their revision counter.

Phase assessment: complete. Every integration-only replay now declares the exact trace evidence needed to confirm its owning layer. Completed traces capture the final narration and label a stale-location contradiction independently of the accepted canonical state transition. Redacted exports retain this public diagnosis without exposing hidden proposals or state.

For each turn record:

- Turn and adventure identifiers
- State version and hash before resolution
- Parsed intent: mode, verb, target, instrument, destination, audience, and explicit quantity
- Entity candidates and the reason one was selected or rejected
- Candidate affordances and failed prerequisites
- Selected rule or authored interaction identifier
- Pending check, if any
- Atomic state delta
- Canonical public outcome facts
- Rejected AI proposals
- Prompt-packet identifier and model profile
- State version and hash after resolution

Expose a redacted copy action in the opt-in playtest panel. Hidden truths and other players' private information must never enter the browser trace.

Exit gate:

- Each existing replay failure can be assigned to a layer from one trace.
- A narration-only error is visibly distinguishable from a failed or missing state transition.

### Phase 2 - Establish one canonical campaign state

Goal: remove disagreements among `dm.currentLocationKey`, structured world state, clue stage, known locations, interaction state, recaps, and narration.

Deliverables:

1. Declare structured world state plus the canonical outcome log as the source of truth.
2. Give every state mutation a schema version and monotonic revision.
3. Derive current location, previous location, visited/revealed routes, map visibility, visible features, and recap facts from that state.
4. Represent discoveries as stable identifiers rather than prose fragments.
5. Convert legacy `clueStage` into a derived compatibility projection during migration.
6. Reset incompatible prototype saves by default. Add migration and repair rules only for unambiguous state or when the migration mechanism is itself a future release requirement; emit warnings rather than silent guesses.
7. Assert after every accepted turn that location, object state, discoveries, known map, and recap agree.

Exit gate:

- No accepted action needs to update both legacy DM location and structured location independently.
- Restart, reload, forward travel, backtracking, and completed interactions preserve the same canonical state.

### Phase 3 - Define executable authored interactions

Goal: make the adventure package operate the engine instead of merely describing intended story behaviour.

Add a generic interaction/affordance schema with fields such as:

- Stable interaction identifier
- Allowed modes and intent verbs
- Targets, instruments, representations, destinations, and aliases
- Location and visibility requirements
- Required and forbidden state predicates
- Optional check specification and visible stakes
- Success, failure, and repeat outcomes
- Atomic state effects
- Exact discoveries revealed and facts permitted for narration
- Facts and transitions forbidden at this step
- Idempotency key
- Guidance generated from currently available affordances

The schema must support composition. Warming an object and offering ink are two interactions unless the player explicitly requests both in one compound action.

Exit gate:

- The validator rejects unknown references, impossible prerequisites, effects on nonexistent state, unreachable required interactions, duplicate idempotency keys, and essential clues without recovery routes.
- The generic resolver can execute fixtures without checking an adventure ID.

### Phase 4 - Build generic intent and reference resolution

Goal: accept natural paraphrases without adding story-specific regular expressions.

Deliverables:

1. Parse literal action scope into typed roles: verb, target, instrument, source, destination, audience, and quantity.
2. Resolve entities only from visible scene state, inventory, known representations, and authorised knowledge.
3. Distinguish a physical object from a representation of it: a drawn line may refer to the pantry without placing pantry shelves in the current room.
4. Apply the least consequential interpretation when wording is ambiguous.
5. Require explicit compound intent before performing multiple consequential actions.
6. Use deterministic aliases and token matching first; use a bounded model classifier only to select among supplied candidates, never to invent one.
7. Store confidence and rejected candidates in the trace.

Exit gate:

- Paraphrases such as `sneak through`, `slip into`, and `enter via` select the same adjacent movement rule.
- `warm the moth` cannot consume ink.
- `study the route to the pantry` examines a representation; it neither moves the party nor requires the pantry to be physically present.

### Phase 5 - Migrate The Lantern Below opening slice

Goal: replace the highest-failure sequence with data-driven interactions before migrating the whole adventure.

Scope:

1. Outside observation and public entrance
2. Private-room request and entry
3. Sealed-letter inspection and deliberate opening
4. Finding lamp and ink without using them
5. Warming the moth
6. Offering ink
7. Reading/studying/following the drawn route
8. Tamsin's independent pantry lead and permission route
9. Kitchen and pantry navigation
10. Physical discovery of the cellar hatch

For every migrated interaction, remove or disable the equivalent Lantern-specific branch in `dm.mjs`. Do not leave two active implementations.

Exit gate:

- The opening and alternate Tamsin route pass with varied wording.
- No new Hearthbound noun or verb is added to central engine conditionals.
- The engine produces canonical outcomes before any narrator call.

### Phase 6 - Migrate the remainder of Hearthbound

Goal: complete the reference adventure using the same generic mechanisms.

Migrate in order:

1. Cellar evidence and survey trail
2. Keyed door and passage traversal
3. Mothglass investigation and spindle operation
4. Passage persistence and backtracking
5. Guardian alternatives: light, ink, warding, and combat
6. Mara conversation, rescue, aftermath, and completion
7. Cross-episode carryover into Ashes of Briarwatch

Remove hard-coded stage narration and guidance as their executable equivalents land. Retain only universe-level generic rules and content data.

Exit gate:

- Both documented Hearthbound journeys pass using at least two character classes and a two-human-player party.
- Restart and reload pass after the cellar and after the spindle.
- Search confirms no Lantern clue nouns remain in the generic resolution path, except compatibility migrations or clearly isolated content adapters scheduled for removal.

### Phase 7 - Build replay, paraphrase, and invariant evaluation

Goal: prevent a successful transcript from hiding fragile phrase matching.

Deliverables:

1. A local JSONL or equivalent fixture corpus versioned with the repository.
2. Hand-written paraphrase sets for every important transition.
3. Property/invariant tests for action scope, adjacency, visibility, idempotency, secrecy, inventory conservation, and monotonic completion.
4. Randomised valid action ordering where the story permits it.
5. Mutation tests that deliberately remove a clue source, reference, or prerequisite and expect validation failure.
6. A report grouped by failure category rather than only pass/fail totals.

Exit gate:

- Equivalent phrasings yield equivalent state deltas.
- Model-off tests prove all required story progress is mechanically resolvable.
- Model-on tests evaluate narration accuracy and style separately from transition correctness.

### Phase 8 - Author Hysteria as the clean reuse proof

Goal: prove a new universe can be built without modifying the shared resolver.

Use the impossible-fossil pilot already outlined in the backlog. It must exercise:

- Multiple evidence sources and competing hypotheses
- A changing but authoritative map
- Exposure/stress with explicit causes and effects
- Preparation and consumable inventory
- Non-combat containment or escape
- Irreversible aftermath state

Exit gate:

- Hysteria requires new content schemas or generic mechanics only when the concept is genuinely new.
- No conditional keyed to `hysteria`, its adventure ID, fossil nouns, or exact player sentences is added to the central turn resolver.
- Hearthbound replay fixtures remain green.

### Phase 9 - Build Unmasked's fair-play case model

Goal: prove the architecture supports stricter mystery truth and character knowledge.

Add an immutable case dossier containing:

- Culprit, motive, method, opportunity, and ground-truth timeline
- Evidence with provenance and custody
- Suspect locations and actions by time interval
- Each suspect's observations, beliefs, secrets, deliberate lies, and permitted disclosures
- Contradictions and deductions supported by evidence identifiers
- Accusation requirements and wrong-accusation consequences

NPC context is a projection of this dossier. Retrieval may select relevant memories but cannot create, edit, or reconcile the underlying timeline.

Exit gate:

- Every suspect's statement is compatible with their recorded knowledge and intended lies.
- The culprit and timeline cannot drift during play.
- The case can be solved through multiple fair evidence routes without a privileged script.

### Phase 10 - Evaluate narration models

Goal: choose a prose model only after mechanics, state, and story authority are stable.

Run Qwen and Gemma against identical saved narrator packets and score:

- Faithfulness to canonical outcome facts
- Forbidden invention rate
- Continuity and repetition
- Voice and atmosphere
- Suggestion usefulness
- Latency, memory use, and hardware cost

Exit gate:

- A model change cannot alter state transitions or prompt authority sections.
- Selection is based on a versioned evaluation corpus rather than one attractive response.

### Post-convergence pilot - Classified counter-intelligence

Goal: extend the proven Unmasked dossier into a time- and resource-bounded espionage operation without giving the narrator control of hidden truth.

The first pilot uses a seeded, immutable conspiracy dossier; suspect-specific knowledge projections; evidence provenance; operational budget; daily action limits; surveillance exposure; controlled leaks; interrogation pressure; and multiple valid resolutions including arrest, recruitment, and deception. The model renders authorised transcripts, analyst reports, suspect dialogue, and noir presentation only.

Exit gate:

- A fixed seed produces identical truth and mechanical outcomes with the narration model on or off.
- No model output can create evidence, alter suspect knowledge, spend resources, advance time, change the mole, or validate an accusation.
- Controlled leaks can be traced through recorded recipients and enemy reactions without inference being promoted to fact.
- The pilot adds generic time/resource/knowledge mechanics where required, never Classified noun checks in the central resolver.

The detailed Classified concept, adapted from the supplied local Python/Ollama prototype, is recorded in `BACKLOG.md`.

## Work-package order

The immediate sequence is:

1. Phase 0: catalogue the existing transcript fixtures.
2. Phase 1A: server-side canonical turn trace.
3. Phase 1B: redacted playtest copy/export.
4. Phase 2A: canonical-state declaration and invariants.
5. Phase 2B: legacy state migration.
6. Phase 3A: interaction schema and validator.
7. Phase 3B: generic interaction executor.
8. Phase 4: intent and reference resolver.
9. Phase 5: Lantern opening migration.
10. Phase 6: remaining Lantern migration and playtest gate.
11. Phase 7: evaluation corpus expansion.
12. Phase 8: Hysteria pilot.
13. Phase 9: Unmasked case pilot.
14. Phase 10: model evaluation.
15. Post-convergence: Classified counter-intelligence pilot.

Each work package should end with tests, a diff review, and a short count of adventure-specific branches added and removed. A package that increases central adventure-specific branching requires explicit justification.

## Measures of convergence

Track these after each phase:

- Number of adventure-specific conditions in central engine files
- Number of canonical state stores updated per accepted turn
- Percentage of required progress available with the model disabled
- Replay fixtures passing across their paraphrase sets
- Unclassified failures
- Narration contradictions per test journey
- Hidden-fact leaks
- Duplicate or non-idempotent transitions
- New-universe interactions implemented without engine changes

The roadmap is complete when story authors add content chiefly by defining truths, entities, evidence, affordances, consequences, and voice—not by adding conditionals to the shared engine.
