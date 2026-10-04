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
- If a visible trail or marking leads to an exit, record its local feature ID in that exit's `leadsFrom` list. The engine can then resolve natural references to the signpost without adding command-specific phrases; the signpost must remain visible before it can guide movement.
- Visible features with stable identifiers.
- Authored occupants: named NPCs plus relevant ordinary groups. Declare anonymous background people in location `occupants`; presence questions project these and current named NPCs, not a public directory's assumed whereabouts. Optional `ambientGreeting` requires occupants and supplies a bounded, state-neutral acknowledgement after named/hearable NPC dialogue gets first refusal. Empty scenes answer honestly without directing legitimate speech to Act.
- Map coordinates and a spoiler-safe map label.
- Optional one-time entry beats for important NPCs or visible events.

An entry beat should invite play without solving it. Good: an innkeeper offers food, drink, or privacy. Bad: the innkeeper immediately reveals the missing surveyor, secret letter, and pantry route.

Never put an undiscovered clue in map decoration, room labels, recaps, guidance, art captions, or accessibility text.

Keep mechanically eligible interactions separate from player-visible guidance. A hidden interaction target may remain executable when the player names it naturally, but guidance may expose it only after its subject is visible, known, explicitly offered, or deliberately marked discoverable.

Resolve references through an intent-typed scene pool: movement searches current exits, speech searches present NPCs, observation searches visible local entities before carried items, and object use searches visible operable objects plus carried instruments. A generic scene inspection (for example, “look around”) describes the complete current surface before fuzzy reference matching; include visible portable items so a required item never has to be guessed. Do not rank absent story entities beside local visible ones.

For observation requests, distinguish the thing being sought from the player's purpose: “look for items to open the door” searches the current scene for available items; “to open the door” does not nominate an opened door as the inspection target. An unspecified search may report only canonically visible portable items and cannot invent or reveal a hidden item. An explicitly named, visible item takes precedence over a weak token overlap with local scenery.

Every accepted mutation must produce revision-linked canonical transition events. Guidance, maps, recaps, and narration payloads consume that accepted revision; prose never creates a parallel transition.

An authored interaction that names an instrument must validate actual canonical ownership or carried inventory before applying its effects. Merely typing an instrument's name never establishes possession.

Recorded NPC offers are commitments to one exact authored transition. Natural acceptance such as “lead the way,” “show us,” or “take us there” executes that transition before freeform NPC dialogue; state-neutral prose cannot promise an escort on its own.

Short exact nouns are valid scene references (key, ink, map), not reasons to guess a distant entity. Resolve them in the intent-typed local pool; ask when two local items fit. Do not silently correct misspellings into consequential actions. Transitive `move/shift/remove` requests manipulate a thing; directional `move to/through` requests navigate.

Normalize unambiguous command shorthand such as joined `goto` in a shared lexical action layer, retaining the original literal text for traces. Do not normalize entity names, guess destinations, fuzzy-correct nouns, change Speak into Act, or relax adjacency/prerequisites. Ordinary and authored action matching must use the same normalization; regress it across multiple story definitions.

Residents may have an explicitly authored public community directory: neighbours' names, ordinary roles and usual workplaces are reasonable local knowledge, not secret plot facts. Keep that separate from live whereabouts, physical presence, visited status, quest solutions and granted permission. Populate permitted conversation facts from this directory; never let a model invent the rest of a town to answer a question. Map visits and actual occupants remain canonical.

Social affordances can opt into polite noun-fragment requests with `request: { implicit:true, subjects:[...] }`. The author declares the subject and transition; the engine accepts only one eligible matching request. Questions can instead establish a recorded offer. Observation and unrelated small talk cannot be converted into consent.

Repeated object operations are idempotent. Opening an already-open door reports its current state without requesting a check, and a visible exit is advertised only when the same canonical route can be traversed by the movement resolver.

## 3. Features must answer ordinary questions

When complete observation phrases overlap, the longer complete authored label outranks a shorter incidental label or internal ID, independent of feature order. Inspecting register-border samples must not inspect the nearby register instead. This neither invents features nor changes inspection into operation.

A visible feature should define enough information for common interactions:

- `observation`: what inspection reveals without changing it.
- `contents`: what is visibly on or inside an open surface/container.
- `portable`: whether it may enter inventory.
- Object state: discovered, open, locked, used, depleted, or altered.

Looking, inspecting, reading, opening, taking, using, and moving are different actions. Finding supplies does not use them. Inspecting a letter does not open it. A route drawn on paper represents a destination; it does not place that destination in the current room.

Observing a mechanism may reveal how to operate it, but must not set an object's `open` or `locked` state or change location. Author deliberate operation as a separate interaction. Ordinary compound actions execute their explicit steps in order; a take followed by inspection transfers the item first, while a failed first step stops the sequence.

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

Expand established casts additively: do not silently change existing identities, species, portraits or task authority to diversify them. Give additions individual occupations, interests and bounded facts, not species-based behaviour stereotypes. Update public directories without claiming off-scene presence, and review portrait morphology/crops against each authored identity.

A general hello retains a selected conversational partner, or receives acknowledgement from the first present resident in stable authored cast order. Adding a second resident must not make a previously answered greeting go unanswered. Ambiguous substantive questions still need a partner; greetings do not justify guessing consequential requests.

Free NPC factual conversation is bounded to current authored fact selections, rendered verbatim by the engine, rather than arbitrary prose with a citation list. Author clear player-facing facts and conditional replacements for completed work. The model can help select relevant fact identifiers, but cannot add setting claims, services or transactions. Identity, greeting, thanks and capability refusals are bounded rules replies; authored presentations provide richer reviewed character voice. Unknown questions receive honest uncertainty. Selection relevance and naturalness still require human playtest.

Reading scenery and visiting places belong to shared observation/movement families, not per-board or per-town player-phrase patches. Explicit authored reading interactions still control discoveries. Thanks plus a substantive question must retain the question. A known absent addressee cannot be silently replaced by a sole nearby resident or remembered partner.

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

For stateful encounters, author encounters with a stable id, local location, initially false resolvedFlag, enemy stats, opening and victoryText. An ambush gives the enemy the first initiative turn, not an automatic hit or extra turn. lightRepels supplies an explicit light alternative; other authored interactions may resolve that encounter's flag and spend their declared resources. Resolution is saved once and must never resurrect on backtracking. Workshop fights remain separate from story milestones.

Use conditional entryBeats for one-time NPC introductions and urgent nearby voices. audibleFrom must name adjacent locations with an open, eligible connection, and callResponse must state its canonical prerequisites. Hearing an NPC does not move the party or resolve their danger.

Say-aloud conversation uses the same hearing boundaries as calls. Heard-only NPCs answer from authored call responses, not visual scene assumptions; party-only speech never reaches them. Conditional NPC `presence` variants use canonical requirements and known locations, so an escorted person cannot remain listed in the old room. Directly addressing one NPC must not become ambiguous merely because the sentence mentions someone else.

Every quest needs a spoiler-safe invitation and actionable handoff: the player should learn that the sealed message exists before being expected to ask about it. Completion milestones must agree with campaign completion. Use aftermath for stable closing dialogue and the next adventure's real slug for the onward lead; do not reveal the campaign's hidden culprit.

Completion awards rewards once but need not close the world. A `playable` aftermath authors conditional closing scenes, local action cards and an optional next-adventure slug. Preserve exploration and conversation, allow a safe escort/homecoming, and suppress new entry encounters after completion. Earned levels remain available without a mandatory escort or level-up. Keep level choices in the Adventure view and return to the scene after confirmation; continuation requires an explicit choice and server-side eligibility checks.

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
- Map rooms use the adventure's authored coordinates; furniture and labels must be positioned relative to their own room rather than fixed canvas coordinates. Check the complete discovered map for room overlap and sufficient canvas height.
- Treat the known map as a field sketch, not an exact battle grid. Use shared material fills, restrained architectural marks, and readable room labels; visual stamps must stay clipped to their room and may not imply an actionable clue absent from the visible scene. Keep route lines and the current-position marker visually distinct from decorative marks.
- Backtracking stays available unless an authored consequence removes it.
- A revealed multi-room route that players can reasonably traverse in one declaration should be an authored journey interaction. Record every intermediate visited location and opened physical threshold, and stop if any genuine physical prerequisite is unmet.
- A return/escort `journey` lists adjacent authored rooms from the current location. Every destination must already be explored and every threshold discovered, open and unlocked; reject atomically otherwise. Journey narration does not implicitly open a closed door or create a route.
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

Interpret the player's literal turn once against that surface before attempting authored or ordinary world actions. Both paths must share the primary intent and room-local reference; an observation's purpose clause (for example, "look for items to open a door") is not an additional attempted action. A weak shared word is not enough to redirect an exact physical target to another exit. On a schema-v2 save, derive room and stage projections from canonical state, never from an older DM snapshot. If no structured action resolves, leave the scene unchanged rather than asking a model to invent a world consequence. NPC wording that promises an escort must have a recorded, currently valid authored offer.

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
  identity, role, appearance, portraitId, locations
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

## 12. Visual identity and maps

- Large cities retain one stable regional parent across their city overview, district charts and underground survey. Compose additive content without mutating original location records or accumulating shared atlas actions. Public district charts may reveal names and streets, but not unvisited residents or undiscovered underground rooms. A fixed crop of a city illustration is a district view, not a separately illustrated plate; state this honestly in art documentation.
- New entrances require a real authored connection, deliberate movement, any declared briefing and a safe physical return. A named future cellar, excavation or ore lift is not an exit until its destination exists. Sealed depth boundaries must not imply generated or infinitely playable corridors. Observation, evidence, mechanism operation, combat victory and report-back remain separate consequences, and descriptions must follow the resulting flags.

- Player portraits are chosen at character creation and stored as stable avatar IDs. The same portrait must identify the character in the party roster, action history, sheet, and combat controls.
- Creation offers only the selected species' reviewed portraits, with male/female presentation filters after origin/class. Use `shared/player-portraits.mjs` for UI choices, server allowlisting and crops on every surface. Class changes must not overwrite explicit choices. Retain existing saved IDs; presentation changes neither rules nor species. New assets and their exact prompts are recorded in `docs/PLAYER-PORTRAIT-ART.md`.
- Authored NPCs choose `portraitId` from the reviewed catalogue in `shared/portrait-catalogue.mjs`. Current catalogue: `tamsin`, `mara`, `cotton`, `ink-guardian`, `merrin`, `ada`, `bessa`, `fen`, `tobin`, `cora`, `elin`, `dain`, `vera`, `osric`, `nella`, `harlan`. Standalone files and existing sprite entries share the disclosure boundary. Do not generate faces during play or assign random player portraits to unknown NPCs. Expanding the catalogue requires art and story-identity review.
- The client may receive an NPC portrait assignment only once that NPC has appeared in the player's visible event history. Portrait metadata must never reveal a future character.
- Explicitly reviewed NPC IDs may share existing species sheets through a finite crop catalogue. Keep assignments stable and independent of player selection; never choose random faces during play. One crop helper governs small portraits and enlarged biographies. Additive Eldervale residents and assignments are recorded in `docs/REGIONAL-RESIDENTS.md`.
- Map room geometry and connections come from authored, revealed locations. Route lines are a visual projection: they join room thresholds and route around other discovered rooms, but cannot imply an exit absent from canonical state. Room symbols are decorative survey marks rather than authoritative inventories.
- For a hand-authored adventure atlas, every room and route has one fixed plate position; discovery reveals plates without repacking or rerouting earlier rooms. All canonically visited intermediate rooms in a multi-room journey must appear even when the journey ends elsewhere. The current-position marker follows canonical location, not the most recently added map entry.
- Regional maps may illustrate general terrain, but names and marked routes appear only when the adventure establishes them.
- Public regional geography may be established by an authored starting chart: this means a place is known, not visited, and does not reveal its residents' identities or quest answers. Keep charted, visited, current and reachable states distinct. Illustrated terrain alone is never a traversable destination. Regional markers and travel availability come from backend state, never campaign-title matching.
- Optional detours must use an authored road graph and persistent canonical local consequences. Leave and rejoin the main story only at declared safe physical boundaries; block combat, unresolved party checks and fallen companions. Retain the exact main-story state, completion status, inventory and character resources. Entering a later main-story chapter is not the same as visiting an optional settlement and must retain its disclosure and level gates.
- Declare each chapter's safe departure locations and explanatory text as data. Resolve locality from the active chapter only, never another chapter's archived world. For legacy saves without an explicit location, use the same authored stage/location projection as ordinary movement and recap; unknown or unrevealed locations fail closed. A disabled travel control must explain its actual blocker beside the control, not rely on the cursor or instructions for a different chapter.
- A new structured sandbox may opt into `initializeOnSelection` to establish its canonical start immediately on selection and restore it on revisit. Do not apply this to legacy saves as an implicit migration or reset. New NPCs without reviewed portrait assets use names rather than random or mismatched faces.
- Settlement maps use a fixed illustrated plate plus server-projected authored places/footpaths. Public buildings may be charted on arrival without disclosing residents, quest-only places or answers. Keep a stable regional parent while exploring local subplaces; local transitions still check adjacency and revealed prerequisites. A discovered repair site must be reached physically, not by clicking through an unseen route.
- Each settlement supplies its own introduction, image accessibility description, return directions, ordered requirement-driven task stages and explicit local action IDs. Shared projections/UI must not contain another town's names, quest flags or directions. Plate-anchor percentages and fallback adventure-sketch coordinates are separate spaces: give settlements non-overlapping sketch blocks while preserving their fixed local art anchors.
- Place right-edge map labels inward without changing their authored anchors; marker labels are UI, not additional geography. Catalogue expansion for Stonecross adds reviewed `jory`, `mira`, `edda` and `bran` assets with authored public introductions.
- Separate optional local repairs and encounters from the service prerequisites they do not control. Investigation may disclose a site and advice; resolving a creature encounter must not also repair unrelated machinery. A nonviolent alternative sets the same persistent encounter-resolution flag before entry, preventing a contradictory fight or later respawn. Original damage reports may remain readable after restoration, but current greetings and observations must reflect the repaired world.
- A service's physical boarding place must agree with its map, route board and executable journey. Additional local boarding points extend actual adjacent roads, preserve existing service IDs and record every intermediate location; they never grant remote travel from a business. Disabled controls explain the exact prerequisite.
- Repeated early quest steps must remain truthful after later resolution: retain useful evidence and where the step belongs, but never insist that an already-completed delivery, repair or permission must be performed again. Pure inspection does not reverse a later physical consequence.
- Carriage/ferry convenience travel needs authored current stops and an adjacent journey, with known connecting locations and every route prerequisite satisfied. Availability in map controls and accepted textual requests must share executor validation. A service must state whether fare, time, risk or resources are implemented; do not narrate invented economic effects. Main-story gates cannot become optional transport destinations.
- Branching local tasks use explicit discovery, diagnosis, permission, mutually exclusive resolution and report-back flags. Provide independent sources for an essential local clue, project changed descriptions/NPC facts after resolution, and prevent repeats or alternate solutions overwriting the established outcome or duplicating rewards. Optional resolution must not complete or level the main adventure.
- A combat victory, environmental resolution, or ability check must commit any persistent story consequence to canonical state before it is narrated. A generic roll without an authored transition cannot clear a durable obstacle, resurrect a defeated encounter, or complete a rescue. Out-of-character status answers should be derived from current canonical state and known authored facts, not recent prose alone.
