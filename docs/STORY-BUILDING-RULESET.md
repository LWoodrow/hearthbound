# Story-building ruleset

Use this ruleset when creating or revising any Hearthbound, Hysteria, Unmasked, Hunters, Forsaken, or Classified story. It turns the lessons from The Lantern Below into reusable authoring requirements.

The core principle is simple: **author truth and meaningful outcomes; let the model perform character voice and prose.** A story must remain logically playable with the prose model switched off.

## 1. Build the story around player freedom

Define:

- One dramatic question the adventure will answer.
- A player promise describing the intended experience.
- Fixed truths that cannot change during play.
- A short sequence of dramatic acts, each with a purpose and pressure.
- Several approaches: observation, conversation, practical action, class abilities, and—where appropriate—combat.

Do not write a single expected command sequence. Players should be able to phrase intentions naturally, investigate in different orders, talk before acting, revisit people, and abandon an approach without breaking continuity.

## 2. Locations are playable scenes, not names

Every location needs:

- A stable identifier and player-facing name.
- Natural aliases: `inn`, `tavern`, `taproom`, `inside the inn`.
- A grounded description containing only immediately visible information.
- Explicit exits and the objects or requirements controlling them.
- Visible features with stable identifiers.
- Authored occupants: named NPCs plus relevant ordinary groups.
- Map coordinates and a spoiler-safe map label.
- Optional one-time entry beats for important NPCs or visible events.

An entry beat should invite play without solving it. Good: an innkeeper offers food, drink, or privacy. Bad: the innkeeper immediately reveals the missing surveyor, secret letter, and pantry route.

Never put an undiscovered clue in map decoration, room labels, recaps, guidance, art captions, or accessibility text.

Keep mechanically eligible interactions separate from player-visible guidance. A hidden interaction target may remain executable when the player names it naturally, but guidance may expose it only after its subject is visible, known, explicitly offered, or deliberately marked discoverable.

Resolve references through an intent-typed scene pool: movement searches current exits, speech searches present NPCs, observation searches visible local entities before carried items, and object use searches visible operable objects plus carried instruments. A generic scene inspection (for example, “look around”) describes the complete current surface before fuzzy reference matching; include visible portable items so a required item never has to be guessed. Do not rank absent story entities beside local visible ones.

Every accepted mutation must produce revision-linked canonical transition events. Guidance, maps, recaps, and narration payloads consume that accepted revision; prose never creates a parallel transition.

An authored interaction that names an instrument must validate actual canonical ownership or carried inventory before applying its effects. Merely typing an instrument's name never establishes possession.

Recorded NPC offers are commitments to one exact authored transition. Natural acceptance such as “lead the way,” “show us,” or “take us there” executes that transition before freeform NPC dialogue; state-neutral prose cannot promise an escort on its own.

Repeated object operations are idempotent. Opening an already-open door reports its current state without requesting a check, and a visible exit is advertised only when the same canonical route can be traversed by the movement resolver.

## 3. Features must answer ordinary questions

A visible feature should define enough information for common interactions:

- `observation`: what inspection reveals without changing it.
- `contents`: what is visibly on or inside an open surface/container.
- `portable`: whether it may enter inventory.
- Object state: discovered, open, locked, used, depleted, or altered.

Looking, inspecting, reading, opening, taking, using, and moving are different actions. Finding supplies does not use them. Inspecting a letter does not open it. A route drawn on paper represents a destination; it does not place that destination in the current room.

## 4. Important NPCs need bounded conversational lives

Every important NPC needs:

- Name, role, appearance, locations, goals, and voice.
- What they know and what they must not know.
- Ordinary public facts for free conversation.
- Conditional facts, each unlocked by explicit canonical state.
- A sharing policy: politeness, trust, evidence, leverage, fear, duty, etc.
- Optional one-time scene-entry lines.
- Authored interactions for any conversation that changes state.
- A bounded response to natural requests for work, trouble, help, rumours, or direction when the NPC is an intended story contact.

The model may use the NPC's voice, visible scene, currently permitted facts, and bounded recent conversation. It may produce harmless small talk. It must answer beyond its knowledge with uncertainty, refusal, or ignorance in character.

Ordinary conversation changes no canonical state. A clue, permission, relationship change, item transfer, movement, accusation, or clock change requires an authored interaction. Repeated conversation after a completed plot interaction should become natural follow-up dialogue rather than replaying the scripted outcome.

Author every state-changing social interaction with the ordinary ways people actually ask for it, including polite modal forms (for example, "could we have..."), requests for an escort ("take/show/lead us"), and follow-through language ("follow them"). The player must not need to discover a command-shaped verb after an NPC has understood the same request in natural conversation.

Free NPC dialogue must never promise, offer, agree, or imply a canonical outcome that has not been recorded. In particular, an NPC cannot say they will grant access, provide an item, disclose a clue, or lead the party somewhere while the corresponding permission, transfer, disclosure, or movement remains false. Route the utterance to an authored interaction or have the NPC respond without claiming the outcome.

When one important NPC is the clear conversational partner, natural statements and questions about work, trouble, help, or local problems must reach that NPC without requiring the player to repeat the NPC's name. Thanks plus a substantive question is still a question; acknowledgement must not discard the rest of the utterance.

Once an NPC answers, they remain the active conversational partner for the player's next nearby spoken reply while the canonical location and world revision remain unchanged. A short answer such as a name, “yes,” or “no” must not fall through to generic Dungeon Master speech merely because it omits the NPC's name. Movement or another canonical transition invalidates that continuity.

## 5. Clues are facts with several fair routes

Every essential clue needs:

- A stable identifier.
- One fixed fact.
- A clear statement of what learning it unlocks.
- At least two independent authored sources.
- The location, NPC if relevant, methods, prerequisites, and exact outcome for each source.
- Fail-forward consequences that preserve another route.

Alternate sources reveal the same truth; they do not create competing realities. A failed search may cost time, trust, safety, or supplies, but cannot remove, relocate, or disprove an essential clue.

Separate the discovery stages. For example:

1. Establish that a sealed letter exists.
2. Inspect its exterior without revealing its contents.
3. Open it and learn its instructions.
4. Warm the creature without spending ink.
5. Offer ink and create the route.
6. Study the route without moving.
7. Travel through established adjacent rooms.
8. Investigate the physical destination to reveal the next route.

## 6. Meaningful actions are executable interactions

Every consequential authored interaction needs:

- Stable ID and idempotency key.
- Allowed input modes: Act, Speak, or both.
- Natural verbs, targets, aliases, instruments, and representations.
- Current-location and visibility requirements.
- Required and forbidden state predicates.
- Optional check and visible stakes.
- Atomic effects on canonical state.
- Player-safe outcome facts.
- A blocked response explaining an unmet prerequisite.
- A repeat policy.

Aliases must cover the object before and after a transition, as well as the visible whole containing the operated part. After opening a letter, for example, "instructions", "note", and "parchment" still identify it; "warm the letter" can identify the mite held within the opened letter when that is the authored instruction.

Completion remains idempotent even when an interaction's own effect invalidates its original prerequisite. Reopening an opened object, rereading an already-read note, or including an already-completed step in a compound request returns the stable repeat outcome and allows valid later steps to continue; it must not become a false prerequisite failure.

Every player-facing description of a mutable feature must be projected from canonical state. If a seal is broken, a container opens, a creature wakes, or an item is picked up, room lists, surface contents, recaps, prompts, and direct observations must stop presenting the earlier state. Feature presentations are authored as conditional variants rather than patched strings in individual replies.

Repeat outcomes must preserve useful information. Rereading a note quotes or accurately restates its actionable instructions; it must not merely report that the text was read before. Likewise, an explicit transfer verb such as `take` or `pick up` must transfer an authored portable item or clearly refuse it—it must never silently collapse into inspection.

Support explicit compound actions when their dependencies can be resolved safely in order. `Open the letter, warm the moth, and give it ink` may execute three authored interactions. If a prerequisite fails, stop safely; never send the failed action to the model to invent a result.

Avoid target aliases made only from a shared NPC name. `Tamsin about Mara` must also require `Mara`, `Vey`, or `surveyor`; otherwise `ask Tamsin about a room` may select the wrong topic.

Consequential matching must require a complete authored phrase or a strong, unambiguous target match. A single low-information overlap can never advance the story: `some drinks` must not match `some privacy`, and `cheap room` must not match an unrelated clue merely because both contain `room`. Add natural complete aliases to the story package instead of weakening the global threshold.

When two valid interactions can match one compound request, give the causally earlier story transition explicit priority. For example, `walk to the pantry shelves and inspect them` first follows the revealed route, then investigates the now-physical shelves. Priority belongs in authored interaction data; it must not be hidden in handler order.

Spoken words may cause only an explicitly authored `Speak` interaction or a bounded NPC reply. Quoting a physical commandâ€”`open the letter`, `warm the moth`, `pull the lever`â€”does not perform it. An unmatched spoken utterance is state-neutral and never falls through to physical-action or model-directed mutation.

## 7. Movement and maps use the same truth

- Movement can enter only an established adjacent location.
- Natural destination aliases must resolve to that same location.
- Entering through an authored interaction and entering through ordinary movement must both update current location, visited locations, map, recap, and model context.
- A represented or mentioned destination is not automatically visited.
- Hidden and unrevealed locations never appear on the map.
- Backtracking stays available unless an authored consequence removes it.
- A revealed multi-room route that players can reasonably traverse in one declaration should be an authored journey interaction. Record every intermediate visited location and opened physical threshold, and stop if any genuine physical prerequisite is unmet.
- Keep social permission separate from physical topology. A staff-only door may carry social consequences, but it is not physically locked unless the story authors a lock or obstruction. If permission is required by the intended scene, author both the permission route and any legitimate alternative approach.

## 8. Separate deterministic rules from model work

The engine owns location, people present, objects, inventory, clues, knowledge, checks, combat, clocks, and completion. The model owns prose, NPC performance, and harmless atmosphere.

There is exactly one mutable story state for an active structured adventure. Legacy stages, summaries, compatibility adapters, and model narration may be migrated into it once, but after canonical state exists they cannot change a clue, flag, location, route, item, or completion state. A player-facing outcome may be narrated only from the same accepted transaction that wrote its canonical effects.

Do not call a model to answer:

- Where the party is.
- Who is visibly present.
- What an authored surface contains.
- Whether a door is open or locked.
- Whether a prerequisite is satisfied.
- What changed after an accepted interaction.

Use the model for:

- Natural NPC replies from a bounded projection.
- Narration of already validated public facts.
- Optional style and atmosphere that introduces no new facts.

Derive one scene command surface from canonical state for every turn. It contains only the current location, visible features, revealed exits, present NPCs, carried items, eligible authored interactions, and a still-valid pending offer. Guidance, diagnostics, and later reference resolution must consume this same surface; they may not keep their own stage-based or narrator-invented list of available actions.

## 9. Authoring validation checklist

Before a story can be called playable, verify:

### Story

- Fixed truths are internally consistent.
- Acts describe dramatic progression, not mandatory commands.
- Every essential clue has two independent sources.
- Every failure preserves a fair route forward.
- Improvisation permissions and prohibitions are explicit.

### Scene

- Location aliases cover natural player language.
- Exits are adjacent, visible only when appropriate, and bidirectional where expected.
- Occupants answer `who is here?` without a model call.
- Important first-entry beats invite interaction once.
- Visible features answer inspection and contents questions.
- Maps and recaps reveal no future clue.

### NPC

- Appearance, goals, voice, public facts, conditional facts, and forbidden knowledge are authored.
- The NPC can sustain ordinary conversation without advancing the plot.
- Plot-changing dialogue has an executable interaction.
- Polite, modal, escort, and follow-through phrasings reach that interaction.
- Natural work, trouble, help, rumour, and direction enquiries reach the intended story contact.
- Free conversation never promises an unrecorded state change.
- Repeat questions do not replay movement or discoveries.

### Interaction

- Natural paraphrases select the same interaction.
- Ambiguous aliases cannot select an unrelated interaction.
- Weak one-word overlap cannot select a consequential interaction.
- Act/Speak modes are explicit, and unmatched speech cannot operate the world.
- Prerequisites block safely before any model call.
- Effects are atomic and idempotent.
- Compound actions preserve dependency order.
- A completed step stays a valid repeat if its effects made its original prerequisite false.
- Compound instructions continue safely across already-completed steps without duplicating them.
- Observation never performs operation or transfer implicitly.
- A narrated success and its canonical state delta are produced by one transaction; neither can exist without the other.
- Authored multi-room journeys record their intermediate path and arrive before any chained destination interaction executes.

### Testing

- Human exploratory play covers unusual wording, social behaviour, pacing, and UX.
- Each discovered invariant becomes a fast deterministic regression.
- Paraphrase tests vary vocabulary and word order.
- Live-model tests are opt-in and measure conversational/narrative quality, not deterministic mechanics.
- The full adventure validates and remains playable with the model unavailable.

## 10. Definition template

Use this as the minimum planning shape before writing prose:

```text
Adventure
  dramatic question
  player promise
  fixed truths
  acts and pressures
  improvisation boundaries

Location
  id, name, aliases
  description, occupants, entry beats
  features, exits, map treatment

NPC
  identity, role, appearance, locations
  goals, voice, public facts
  conditional facts and requirements
  must-not-know list
  plot-changing interactions

Essential clue
  fixed fact and unlock
  source A: place/person/method/outcome
  source B: place/person/method/outcome
  fail-forward costs

Interaction
  modes, verbs, targets, instruments
  prerequisites and blocked result
  check if needed
  atomic effects, public facts, repeat policy
```

This ruleset governs authoring. [`AI-STORY-CONTRACT.md`](AI-STORY-CONTRACT.md) governs runtime authority, and [`STORY-ENGINE-ROADMAP.md`](STORY-ENGINE-ROADMAP.md) governs delivery order.

## 11. Living-ruleset guardrail

This document is a maintained product requirement, not a one-time design note.

Whenever human playtesting, a replay, or implementation work reveals a systemic story-building lesson:

1. Classify the failure using the roadmap categories.
2. Fix the owning layer rather than only the reported sentence.
3. Add or strengthen a fast deterministic regression for the invariant.
4. Update the relevant rule or checklist item in this document in the same work package.
5. If no authoring rule changes, record explicitly in the handoff that the existing rule already covered the failure and identify it.
6. Update the runtime contract when model authority changes, and update the roadmap/backlog when delivery order or completion status changes.

A story-engine slice is not complete until code, schema validation, regression coverage, this authoring ruleset, the AI contract, and roadmap status agree. Reviews should treat a missing ruleset update—or a missing explanation of why none was needed—as unfinished work.

Before claiming a phase or story complete, search recent playtest fixes for new aliases, occupants, entry beats, feature semantics, NPC disclosures, interaction prerequisites, clue routes, map visibility rules, or model boundaries that have not yet been generalized here.
