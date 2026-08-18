# AI story-engine contract

For the author-facing requirements that produce a compatible playable story, see [`STORY-BUILDING-RULESET.md`](STORY-BUILDING-RULESET.md).

Hearthbound treats every model response as untrusted narrative input. The rules engine owns campaign truth and accepts only consequences it can validate independently.

This contract is provider-neutral. Replacing Qwen, Gemma, or another model must not change game rules, unlock routes, create inventory, complete adventures, or alter hidden state.

## Authority boundary

The rules engine owns:

- Current and previous location
- Revealed and visited routes
- Doors, locks, containers, mechanisms, and other object state
- Inventory ownership and quantities
- Required checks, modifiers, DCs, rolls, and resolved outcomes
- Combat initiative, resources, damage, conditions, and defeat
- Clue stages, revelation gates, danger clocks, milestones, and completion
- Private discoveries and player-specific knowledge

The model may:

- Turn validated public facts into concise narration
- Propose a check in the supported structured format
- Describe atmosphere that introduces no new object, route, threat, identity, or outcome
- Suggest actions based only on visible facts
- Write a private DM ledger note that has no direct state-changing authority

## Canonical playable-story package

An adventure definition owns its story as structured data rather than scattered prompt prose. The package records fixed truths, dramatic acts, NPC goals and bounded knowledge, essential clues and their independent sources, consequences, and improvisation limits.

The director receives a compact authority view assembled for the current room. It includes only NPCs and clue sources relevant there, while retaining fixed truths as hidden explanation. A listed source is a possibility, not an automatic revelation: the player's action must use one of its authored methods in the correct physical context.

Every essential clue requires at least two authored sources. A failed attempt may cost time, supplies, safety, or trust, but it cannot delete, relocate, or disprove the clue. Alternate sources converge on the same fixed fact; they do not create alternate realities.

This story package is authoritative over legacy adventure summaries and recent model narration. Retrieval, summaries, flavour assets, and model memory may help select relevant presentation, but none may alter the package's truths or unlock state.

Once a schema-v2 canonical save exists, no legacy adventure handler may mutate story progress beside it. Compatibility data may seed a one-time migration only. Every displayed success must come from the same accepted canonical transaction that records its location, flags, discoveries, inventory, resources, and clocks; narration alone is never evidence that an outcome occurred.

Input mode is part of authority. Unmatched `Speak` input is state-neutral. It may become bounded conversation or an explicitly authored social interaction, but it cannot open, use, move, take, warm, attack, or otherwise execute a physical command merely because those words were spoken aloud.

## Accepted director fields

### Public facts

The engine keeps at most three non-empty strings, normalizes whitespace, and limits their length. Missing or malformed facts become a stable no-change result.

### Locations

A model cannot create an unnamed destination. A location proposal must be explicitly named in the player's movement action and must also pass the authored route graph when one exists. Vague movement that the graph cannot resolve stops at the current location before any model call.

### Inventory

An inventory change is accepted only when:

1. The player explicitly uses a transfer verb such as take, receive, drop, or give.
2. The item is named in the player's action.
3. The completed transfer is confirmed by a public fact.
4. The operation matches the player's verb.
5. The quantity does not exceed the amount explicitly requested, defaulting to one.
6. The item is not a party companion.
7. The same proposed change has not already appeared in the response.

Looking at, finding, opening, lighting, using, or touching an item never transfers it.

### Ability checks

A proposed check must contain an ability, an optional standard skill, and a DC from 5 through 25—for example, `Wisdom (Perception) DC 12`. If a skill is present, it must use its correct governing ability. The check must also provide a player-facing reason.

An accepted proposal becomes a real pending check in the database. The model cannot narrate success first. Once the roll resolves, later model output cannot request another roll, add failure inventory, or move the party on a failed check.

Checks already covered by deterministic rules always use the engine's recorded success or failure fact. The model may rephrase that fact but cannot replace it. Freeform model adjudication is limited to a successful roll for a genuinely novel check that the validated director-check path created.

### Clocks, completion, and private facts

Model-proposed danger changes and adventure completion are always discarded. These require explicit rules-engine events. Model-proposed private discoveries are also discarded because hidden knowledge needs an authored visibility rule.

## Failure behaviour

Rejected consequences are written to the DM ledger for diagnosis without entering player-visible history or future player-safe model context. The player receives a concrete unchanged-state result instead of an invented continuation.

## Model evaluation

Model comparisons should measure prose quality only after this contract is stable. Candidate models receive identical validated scene packets and are scored for voice, continuity, repetition, invention rate, latency, and hardware cost. No candidate receives additional authority because it performs well in prose evaluation.

## Prompt packets and inspection

Action and resolved-check model calls use named prompt packets. Required sections carry the engine contract, authored adventure data, authoritative campaign state, the acting character, and the current action or resolved roll. Recent visible history is optional and is omitted first if the configured context budget is too small.

The active model is selected by a versioned profile. `qwen3-local-v1` remains the default. `gemma4-12b-eval-v1` is an inactive evaluation profile and must be selected explicitly; changing profiles changes generation configuration, not the packet's authoritative facts.

Set `DND_PROMPT_INSPECTOR=1` to expose `GET /api/debug/prompt-packets` for local diagnosis. The endpoint requires the current player's bearer token, returns only that player's packets in their party, and always redacts secret and player-private content. It exposes section names, estimated size, inclusion decisions, and content hashes so prompt assembly can be diagnosed without turning hidden adventure material into a browser payload.

## Style assets and recaps

Narration examples are versioned universe assets. They are placed only in narrator packets, marked as optional, and state explicitly that their people, places, objects, actions, and outcomes demonstrate cadence rather than campaign truth. Director adjudication never receives them.

The in-game recap is deterministic. It reads the authoritative room state, known locations, recorded inventory, player-authored actions, dice records, system events, pending check, and validated public facts attached to accepted outcomes. It does not ask a model to decide what happened, and it ignores unstructured narration when compiling established facts.
