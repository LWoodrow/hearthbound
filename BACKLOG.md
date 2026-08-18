# Hearthbound backlog and work plan

This document records agreed future work. It is a planning document; an item being listed here does not mean it is already implemented.

## Delivery order

1. Create a private GitHub safety baseline and recoverable first release
2. Preserve reported playtest failures as classified replay fixtures
3. Add canonical turn traces and one authoritative campaign-state model
4. Add executable authored interactions plus generic intent and reference resolution
5. Migrate and validate The Lantern Below, removing equivalent hard-coded story branches as each slice lands
6. Validate Ashes of Briarwatch and the connected high-fantasy campaign arc
7. Build the replay, paraphrase, invariant, and authoring-validation toolchain
8. Prove reuse with the first Hysteria pilot without universe-specific central-engine conditions
9. Prove fair-play evidence and bounded suspect knowledge with an Unmasked pilot
10. Complete the rules matrix and missing combat/class automation
11. Complete exploration, conversation, spotlight, and initiative behaviour
12. Improve maps, avatars, scene art, narration voices, and iPad presentation
13. Add modular content packs and weighted generation tables
14. Research and design each further universe, then implement it only after the shared engine is stable
15. Evaluate Gemma 4 12B Unified as a local narration model after the story-engine contract is stable; compare prose quality, continuity, invention rate, latency, and hardware requirements against the current model

The detailed migration sequence, stop/go gates, and convergence measures are in [`docs/STORY-ENGINE-ROADMAP.md`](docs/STORY-ENGINE-ROADMAP.md). New and revised stories must follow [`docs/STORY-BUILDING-RULESET.md`](docs/STORY-BUILDING-RULESET.md), which consolidates the proven rules for scenes, occupants, NPC conversation, clues, interactions, maps, and testing. This roadmap is the active authority for story-engine ordering. In particular, new sentence-specific Hearthbound patches should not take priority over turn tracing, canonical state, executable interactions, and replay fixtures unless they block diagnosis or corrupt saved state.

Current story-engine package: convergence phases 0-9 and the phase-10 evaluation harness are implemented. The shared engine now has schema-v2 canonical state, executable authored interactions, generic intent/reference handling, traces, replay and mutation coverage, a Hysteria reuse pilot, and an Unmasked fair-play case pilot. The immediate gate is real browser playtesting of Hearthbound with varied natural language, removal of the remaining pre-v2 compatibility paths, and an identical-packet Qwen-versus-Gemma evaluation before selecting the default narrator.

Current characters, campaigns, in-flight stories, saves, and generated play records are disposable prototype data. Architecture work may reset them instead of adding compatibility complexity. Authored content, source code, regression fixtures, and design decisions remain protected; any reset must still be explicitly scoped and reported after it is performed.

The story-definition and executable-interaction foundation for items 4 and 5 is complete: The Lantern Below has one canonical playable-story package containing fixed truths, a four-act dramatic spine, NPC goals and bounded knowledge, multiple discovery sources for every essential clue, fail-forward consequences, and explicit improvisation boundaries. A reusable NPC conversation layer now projects only the present character's voice, currently permitted facts, visible scene, and bounded recent conversation to the prose model; ordinary conversation cannot mutate canonical state, while explicit authored outcomes still record clues, permission, and movement. The adventure validator rejects a future essential clue that has fewer than two authored sources. Remaining Hearthbound work is browser validation of conversational quality and the complete and alternate routes, removal of obsolete compatibility handlers, and expansion of consecutive-turn usefulness tests whenever a real playtest exposes a mismatch.

Maintenance guardrail: every systemic playtest or implementation lesson must update the story-building ruleset in the same work package, or the handoff must name the existing rule that already covered it. Do not close a story-engine item while its implementation, validation, tests, authoring rules, AI authority contract, and roadmap status disagree.

### AI prompt infrastructure

Completed in the story-engine guardrail branch:

- Versioned local model profiles, with Qwen 3 14B remaining the default and Gemma 4 12B available only as an explicit evaluation candidate
- Named, token-budgeted prompt packets for freeform action adjudication and resolved-check narration
- Deterministic priority: engine contract, authored adventure data, campaign authority, and the current action are retained before optional recent history
- An opt-in authenticated prompt inspector that shows section names, token estimates, inclusion decisions, and hashes while redacting all hidden and player-private content
- Regression coverage proving a model-profile switch does not change the authoritative facts in a prompt packet

Next work after the current guardrails are exercised in play:

1. Add recurring-NPC example exchanges as versioned style assets, never as campaign facts. The first universe-level Hearthbound voice asset is complete.
2. Extend authoritative recaps with authored objective milestones as each adventure moves fully onto the structured state engine. The initial state/ledger recap is complete and never calls a prose model.
3. Add a reproducible Qwen-versus-Gemma narration evaluation fixture using identical saved prompt packets.
4. Consider semantic retrieval only for optional flavour and previously established public history; retrieval results must never unlock routes, clues, inventory, clocks, or completion.

### Hearthbound playtest gate

The first structured-engine browser playtest is ready on the guardrail branch. It uses an isolated database and port, a thirteen-checkpoint Lantern journey, deterministic recap data, redacted prompt diagnostics, and a restart path that clears the active adventure's structured rooms, objects, interactions, pending checks, guidance, and Cotton timing without clearing another adventure's saved state.

Before moving the shared engine into Hysteria work:

1. Complete the full journey in `docs/HEARTHBOUND-PLAYTEST.md` using varied natural wording.
2. Verify restart after reaching at least the cellar and again after opening the spindle passage.
3. Capture any mismatch with Copy test status, the exact player wording, the visible response, and the expected result.
4. Fix and regress every state, secrecy, repetition, map, recap, inventory, or check mismatch found.
5. Repeat the route with at least two character classes and once with two human player characters before declaring the Hearthbound engine gate stable.
6. Complete the alternate-route playtest: learn about Mara from Tamsin, reach the pantry with Tamsin's cooperation, find the hatch through physical evidence rather than the ink-mite's exact route, and resolve the guardian without default combat.
7. Confirm a failed investigation changes cost or available approach without deleting an essential clue or forcing a restart.

### Player experience and tablet flow

These items are informed by current playtesting and a review of TableForge's public product flow. They are interaction patterns, not a visual redesign or a change to Hearthbound's established universe palettes.

1. **Canonical Adventure Journal**
   - Replace the large diagnostic checklist in the normal player view with a compact journal showing the current objective, earned milestones, open leads, party condition, and unresolved rewards.
   - Derive every entry from canonical state and accepted outcomes. Narration and model memory cannot create or complete journal entries.
   - Keep the full checklist and trace inspector available only in the disposable playtest mode.

2. **Suggestions as separate editable controls**
   - Render optional actions beside the input as buttons/cards that populate the input for review; selecting one must never execute it automatically.
   - Never embed suggestions or serialized guidance inside Dungeon Master narration.
   - Generate suggestions only from currently available authored affordances and visible facts.

3. **Resume latest campaign**
   - Put the most recently played campaign first, with its current scene, canonical objective, last accepted public outcome, party status, and a single Continue action.
   - Use the deterministic recap projection rather than asking a prose model to reconstruct the session.

4. **Explicit local-AI availability and retry state**
   - Show when Ollama or the selected narrator is loading, slow, unavailable, or has returned an invalid response.
   - Preserve the submitted turn for safe retry and never replace a failed narrator call with invented generic story progression.
   - Distinguish a narration-service problem from an engine refusal or required player choice.

5. **iPad-first play tabs**
   - Keep narration and the action composer primary.
   - Place Map, Journal, Character, and Inventory in stable tabs or drawers on tablet/mobile rather than keeping every panel visible.
   - Preserve scroll position, prevent layout jumps when selections change, and keep critical current-location/turn status visible.

Recommended order: finish the Hearthbound story-engine playtest gate first, then implement suggestions/output separation and AI retry state before the Journal, resume card, and tablet information architecture.

## Private GitHub safety baseline

This comes before further substantial changes so the working application has a recoverable history and later batches can be reviewed or rolled back cleanly.

1. Audit the repository before its first commit.
2. Keep runtime databases, saved campaigns, generated media, model files, secrets, temporary files, and purchased reference books out of Git.
3. Create a private GitHub repository and connect this local repository to it.
4. Commit the current application as the prototype baseline and tag the known starting point.
5. Add a short backup and restore guide, then verify a clean checkout can install, test, and start.
6. Use one small branch and one bounded outcome for each later work batch.

The purchased library at `C:\Users\Lee\Desktop\CTHULU` is private reference material outside the application repository and must never be uploaded to GitHub.

## Separate game universes

Each universe gets its own campaign continuity, characters, rules profile, terminology, visual theme, UI colours, equipment, maps, and hidden state. Content does not cross between universes unless an explicit future crossover mode is designed.

- High fantasy - **Hearthbound**
- Cosmic horror - **Hysteria**
- Murder mystery - **Unmasked**
- Gothic horror - **Forsaken**
- Modern supernatural - **Hunters** (stable internal identifier: `supernatural`)
- Espionage - **Classified**

## Classified: Cold War counter-intelligence design

Status: backlog design only. Build after Hearthbound has established the shared engine, Hysteria has proved cross-universe reuse, and Unmasked has proved immutable evidence, provenance, timelines, and bounded suspect knowledge.

### Premise and identity

- Bureaucratic Cold War noir in a fictional rain-slicked divided city inspired by the 1970s, without depending on a real intelligence service or historical conspiracy.
- The player directs a counter-intelligence unit from an underground headquarters.
- A senior department head is leaking a deep-cover roster. The player must identify, contain, turn, or expose the mole before the roster-transfer clock expires.
- Each new operation may select a different valid conspiracy package: mole, handler, motive, channel, dead drop, compromised assets, cover story, and intended exfiltration route.
- Randomisation selects from prevalidated combinations. It must not assemble an impossible case or allow the model to change the culprit during play.

### Strict gameplay loop

1. **Briefing:** review overnight intercepts, current threats, available staff, budget, political pressure, and time remaining.
2. **Planning:** assign a bounded number of operations, targets, agents, equipment, and cover arrangements.
3. **Operations:** deterministically spend time and budget, resolve exposure and counter-surveillance risks, and create raw observations.
4. **Analysis:** compare records, build links, test hypotheses, identify contradictions, and decide whether evidence justifies escalation.
5. **Interrogation or deception:** question a suspect, confront them with selected evidence, attempt to recruit them, or feed controlled information.
6. **Resolution:** arrest, surveil, turn, deceive, protect the roster, or allow another day to pass. The engine evaluates the decision against canonical truth.

Time advances through declared operations rather than every conversational exchange. The player cannot perform unlimited surveillance or interrogation during one day.

### Authoritative operation dossier

Every playable operation records immutable ground truth before play:

- Mole, handler, motive, recruitment history, access level, objectives, and escape threshold
- Exact day-by-day ground-truth timeline, including meetings, communications, file access, payments, dead drops, and cover activity
- Suspect roles, routines, relationships, vulnerabilities, secrets, authorised access, and innocent explanations
- What each person observed, believes, suspects, remembers, conceals, and is deliberately lying about at each point in time
- Communication channels, code systems, dead-drop locations, surveillance vulnerabilities, and counter-surveillance behaviour
- Evidence identifiers, provenance, reliability, custody, ambiguity, and the deductions each item can legitimately support
- Enemy reactions to leaked or fabricated information
- Roster-transfer clock, political-pressure clock, operational budget, personnel availability, exposure risk, and collateral consequences
- Valid endings: correct arrest, recruited double agent, successful deception operation, mole escape, wrongful accusation, burned investigation, or partial containment

The complete dossier is never sent to a model. Each operation receives only the smallest authorised projection required for its role.

### Core mechanics

#### Surveillance and wiretaps

- Bugging an office, tapping a line, tailing a suspect, opening mail, and monitoring file access are distinct operations with costs, durations, legal/political risks, and detection chances.
- The engine first determines who was present, what objectively occurred, what the equipment could capture, gaps or noise, and whether surveillance was detected.
- The model may render a transcript from those supplied observations. It cannot insert a code word, meeting, confession, or suspicious act that the engine did not authorise.
- Innocent intercepts may reveal genuine personal or bureaucratic secrets, not artificially spotless filler; these can explain suspicious behaviour without changing the conspiracy.

#### Reconnaissance and imagery

- Field photography, static observation, document photography, and aerial or satellite reconnaissance produce structured observations with time, place, visibility, identity confidence, and chain of custody.
- An image-analyst voice turns those observations into a clinical report but cannot identify an obscured person or object beyond the recorded confidence.
- Later evidence may corroborate or overturn an analyst's tentative interpretation while the original observation remains unchanged.

#### Dossiers, hypotheses, and contradictions

- The player-facing intelligence board separates established facts, reports, assessed claims, unresolved leads, competing hypotheses, and disproved explanations.
- Evidence retains its source and reliability; repeated reports do not become multiple independent clues when they share one origin.
- Financial anomalies, travel, access logs, testimony, intercepts, and imagery are compared against the canonical timeline.
- Contradictions are engine-computed relationships between stable claims and evidence identifiers, not model opinions.

#### Interrogation and stress

- The player chooses questions and which evidence to disclose. This choice changes the suspect's knowledge of the investigation.
- A suspect receives only their personality, current knowledge, intended truths/lies, the question, disclosed evidence, and a bounded response policy.
- The engine tracks pressure, confidence, loyalty, fear, fatigue, suspicion of surveillance, and willingness to defect. The model expresses those states but cannot choose their numerical change.
- A mole constructs no new alibi during dialogue. Permitted claims and cover stories come from the prevalidated timeline; when contradicted, deterministic policy selects denial, qualification, silence, counter-accusation, flight preparation, or cooperation.
- Innocent suspects can be stressed, evasive, or dishonest about secondary secrets. Stress alone is never proof of guilt.

#### Double agents and controlled leaks

- The player can attempt recruitment, run a turned asset, compartmentalise information, plant a marked document, or transmit a deliberately false plan.
- Every fabricated intelligence package has a unique identifier and recipient set. Later enemy behaviour can be linked back to its actual exposure path.
- Enemy response is selected from authored capabilities and objectives; the narrator cannot invent a convenient reaction that confirms the player's preferred suspect.
- A turned mole remains risky: loyalty, handler suspicion, communication access, and exposure are tracked explicitly.

### AI boundary

Use the local model for atmosphere and bounded presentation:

- Render an authorised intercept transcript from structured utterance facts
- Write an imagery or document-analysis briefing from supplied observations
- Voice a suspect using only their projected knowledge and permitted claims
- Summarise the player's established intelligence board without promoting speculation to fact
- Produce period-appropriate bureaucratic wording and restrained noir narration

Do not let the model select the mole, invent evidence, determine operation success, change clocks or budget, calculate contradictions, decide what an NPC knows, or evaluate the final accusation.

The supplied `spy_game.py` concept is retained as design research, not production architecture. Its useful ideas are the phased loop, hidden ground truth, operations budget, time pressure, and partial context projection. Before reuse, replace freeform evidence-log prompting, model-authored clues, unlimited free interrogations, hard-coded guilty/innocent transcript branches, and unvalidated random combinations with the shared Storyman state, evidence, interaction, and trace systems.

### First pilot and validation gate

Build one compact operation after Unmasked's evidence model is stable:

- Five department heads, one mole, one handler, two viable communication channels, and three prevalidated conspiracy variants
- Seven in-game days with a limited daily action allowance and operational budget
- Wiretap, tail, file-access audit, imagery review, interrogation, controlled leak, recruitment attempt, and accusation
- At least three independent evidence routes to the mole and credible innocent explanations for suspicious secondary behaviour
- More than one successful ending: arrest with proof, turn the mole, or protect the roster through deception

Required validation:

1. The same seed always produces the same truth, timeline, evidence, and consequences regardless of narration model.
2. No suspect states knowledge they have not acquired and no intercept contains an unauthorised clue.
3. Equivalent player wording selects equivalent operations and costs.
4. Budget, elapsed time, staff assignments, evidence custody, stress, exposure, and clocks survive reload and cannot be duplicated.
5. A wrong accusation remains possible but follows recorded evidence and consequences; the game never changes the mole to reward the guess.
6. Turning or deceiving the mole uses the same canonical conspiracy rather than creating an alternate solution.
7. Model-off replay proves the case is mechanically playable and solvable; model-on evaluation scores faithfulness and style separately.

## Hysteria research and purchased Cthulhu reference audit

Before selecting Hysteria's rules, perform a bounded, read-only audit of `C:\Users\Lee\Desktop\CTHULU`.

1. Inventory titles, editions, file types, and duplicates without copying the files into the project.
2. Separate purchased copyrighted works, genuinely open-licensed rules, public-domain source fiction, and inspiration-only material in a source register.
3. Compare investigation structure, clue handling, stress or sanity, bonds, lethality, recovery, tomes, rituals, and entity design.
4. Record original engine requirements and design lessons rather than reproducing protected prose, artwork, scenarios, maps, or stat blocks.
5. Compare the purchased references with suitable open resources before choosing Hysteria's mechanical foundation.
6. Produce a short recommendation for Hysteria's rules profile, licensing boundary, and first three test scenarios.

This research is a design task only. No Hysteria implementation begins until the shared Storyman engine and adventure schema have passed their Hearthbound regression tests.

## Story premise and beat development

Prompt and story-idea sites are useful as inspiration banks, but their output is not authoritative adventure data. A selected premise must be converted into a structured story dossier before the game can use it. This prevents the narrator from changing the culprit, monster, physical laws, room layout, or solution during play.

### Shared premise-to-adventure pipeline

1. **Premise**: one compelling situation expressed in one or two sentences.
2. **Hidden truth**: the fixed explanation known to the engine but initially concealed from players.
3. **Rules of the threat**: what it can do, cannot do, wants, notices, and how it changes the world.
4. **Evidence graph**: observations and testimony connected to deductions, with at least three independent clues for every conclusion required to finish.
5. **Competing hypotheses**: plausible alternatives supported by some evidence and contradicted by other evidence.
6. **Beat ladder**: locations, scenes, thresholds, escalation events, reversals, confrontation, and aftermath.
7. **Resolution conditions**: exact success, partial success, escape, containment, accusation, and failure states.
8. **State model**: authoritative rooms, routes, people, objects, knowledge, clocks, injuries, and completed events.
9. **Validation**: test alternate ordering, failed checks, repeated actions, premature guesses, retreat, split parties, and unexpected but valid approaches.

The prose model describes and performs permitted transitions. It does not invent a new hidden truth or advance across a locked threshold simply because a player's wording resembles a later story beat.

### Murder mystery dossier

Every murder mystery is authored from the solution backwards and records:

- Victim, culprit, motive, method, means, opportunity, and exact chronology
- Suspects, relationships, secrets, alibis, lies, and what each person actually witnessed
- Physical evidence, testimony, records, forensic evidence, and provenance
- Which clues support or contradict each suspect and hypothesis
- Red herrings that expose a genuine secondary secret rather than relying on false world facts
- At least three routes to the core deduction and recovery paths for destroyed or missed evidence
- Accusation requirements, confrontation behaviour, alternate culprits considered, and consequences of a wrong accusation
- Valid endings such as proof and arrest, exposure without arrest, negotiated confession, culprit escape, or unresolved case

Idea lists can supply locations, crimes, motives, and twists, but a playable fair mystery requires this fixed solution and evidence graph before scene prose is written.

### Cosmic horror dossier

Every cosmic-horror story additionally records:

- The single fundamental law being violated
- The fixed hidden ontology: what the phenomenon really is
- Observable anomalies and the order in which they can become knowable
- Exposure vectors, stress effects, contamination rules, and recovery limits
- What knowledge helps, what knowledge harms, and what remains impossible to understand
- Containment, escape, interruption, or survival conditions rather than assuming the entity can be killed
- The irreversible cost of success and the residue carried into the aftermath

A useful cosmic-horror beat ladder is: ordinary baseline, first anomaly, repeatable anomaly, competing explanations, personal contamination, irreversible discovery, preparation or containment, climax under altered rules, and an aftermath that leaves a restrained residue.

### Worked cosmic-horror premise: the impossible fossil

Premise: explorers discover fossilised remains of a non-Euclidean creature that cannot biologically exist according to known science.

The supplied plot-generator output is a strong concept workshop, but its six ideas should not all become simultaneous truths. The recommended coherent combination is:

- **Ontology - cross-section:** separated fossil remains are intersections of one higher-dimensional entity with ordinary space.
- **Contamination - altered perception:** prolonged measurement teaches a mind to perceive spatial relationships it cannot safely process.
- **Escalation - echo of movement:** successive observations show that the intersections are changing and converging.
- **Climax - spatial fold:** excavation removes an accidental seal and begins folding the dig site into unreachable adjacent spaces.

The inverse-preservation idea and the geometric-parasite idea are retained as seeds for separate episodes. Using them here would require an explicit reconciliation; otherwise the story could contradict itself about whether the fossil is a material intersection, deleted space, a conceptual infection, or a key.

#### Playable episode skeleton

1. Establish an ordinary scientific expedition, credible procedures, personnel tensions, equipment, and a safe baseline map.
2. Discover separated fossil sections in one stratum. Measurements show that their apparent separation depends on viewing angle or instrumentation.
3. Offer competing explanations: biological deformity, geological displacement, deliberate fraud, an ancient device, or an intersection with a higher-dimensional body.
4. Reveal repeatable clues, including impossible alignment, inconsistent internal/external views, moved markers, and older warnings against completing the shape.
5. Advance an observation/excavation clock. Repeated study improves useful understanding while increasing spatial disorientation and folding the site.
6. Let affected characters gain specific perceptions with costs; never use vague madness as permission for arbitrary narration.
7. Allow preparation through fixed anchors, tethers, chalk routes, observation limits, replacement of excavated rock, broken sight lines, or interruption of the alignment.
8. Resolve through resealing, breaking the observation/anchor relationship, or escaping by a correctly mapped safe route while space is folding. Killing the entity is not an assumed option.
9. Record missing space, altered memories or measurements, survivors' stress, retained samples, and any wider-series clue in the aftermath.

This structure can serve as the first cosmic-horror pilot because it tests clue progression, a changing map, exposure, non-combat danger, multiple hypotheses, inventory preparation, containment, and survival.

## Modern supernatural: four-season campaign

### Format

- Four seasons with exactly 20 playable episodes per season (80 episodes total).
- Original setting, hunters, monsters, cases, mythology, and dialogue. Existing supernatural television can inform pacing and structure, but its plots and characters are not copied.
- Most episodes are self-contained cases, while selected episodes advance a concealed season mystery and the four-season series arc.
- Recommended mix per season: 11 case episodes, 5 hybrid case/arc episodes, and 4 arc-heavy episodes, including the premiere, midpoint escalation, penultimate episode, and finale.
- The next episode unlocks only after the current episode reaches a valid aftermath state. Simply travelling away or guessing the creature does not complete it.

### Progression without experience or levels

- No experience points and no character levels.
- The principal goal is to survive, resolve or contain the current threat, and reach the episode aftermath.
- Persistent progress consists of the hunters' journal, confirmed lore, contacts, favours, safehouses, equipment, injuries/scars, relationships, unresolved consequences, and season-arc evidence.
- A known weakness learned in one case may become useful later, but similar-looking creatures can have different rules so the answer is never automatic.

### Standard episode loop

1. **Cold open**: an incident establishes the danger without revealing the creature's identity.
2. **Arrival and cover**: the party reaches the location, chooses identities or an approach, and meets witnesses or authorities.
3. **Investigation**: players examine scenes, interview people, compare timelines, and collect physical and supernatural evidence.
4. **Research and hypothesis**: evidence is organised into facts, leads, disproved ideas, and one or more possible creature dossiers.
5. **Preparation**: players choose a loadout and obtain any missing ritual components, ammunition, protective materials, or location information.
6. **Confrontation**: players test their hypothesis, survive the creature's response, and exploit or revise the suspected weakness.
7. **Resolution or escape**: the threat is destroyed, banished, contained, appeased, or survived according to its actual rules.
8. **Aftermath**: consequences are recorded, the hunter journal is updated, and a restrained season-arc tag may appear.

### Monster dossier schema

Every episode must define its threat before prose is generated:

- Public signs and behaviour
- Hidden identity and origin
- Territory, movement, and targeting rules
- Powers and immunities
- Temporary deterrents
- True weakness and exact resolution conditions
- False leads and plausible alternative hypotheses
- Required evidence and the clues that support each conclusion
- Required or useful inventory
- Escalation clock and consequences of delay
- Behaviour after a failed or partially correct confrontation
- Episode outcome and any season-arc evidence

The Dungeon Master knows the dossier. Players and the narrator receive only facts earned through play.

### Investigation guardrails

- Every conclusion required to finish an episode has at least three independent clues.
- No single failed check can permanently block the episode. Failure costs time, increases danger, damages evidence, or forces a riskier route.
- Every essential object or fact has at least two obtainable routes unless it is guaranteed at the start.
- Red herrings are explicitly tracked and can be disproved; they cannot silently replace the true solution.
- The Dungeon Master may recommend an appropriate check but cannot reveal the result, creature, weakness, hidden room, or future event before the state permits it.
- Repeated actions cannot reopen the same container, respawn an item, replay an encounter, or move the party to an earlier location.
- Rooms, thresholds, travel, NPC presence, creature presence, inventory, wounds, and completed objectives are authoritative state rather than improvised prose.

### Evidence and research UI

- **Facts**: directly established observations and testimony.
- **Leads**: places, people, records, and objects worth following.
- **Hypotheses**: player-selected possible creature types with visible supporting and conflicting evidence.
- **Disproved**: explanations ruled out by play.
- **Hunter journal**: persistent lore from earlier episodes, with source and reliability.
- The UI can show confidence such as weak, plausible, or strong without confirming the hidden answer.

### Inventory and weakness rules

- Salt, rock-salt ammunition, iron, silver, fire, accelerant, protective marks, ritual components, medicines, cameras, lights, and research tools are distinct items with tracked quantities and states.
- Items never have a universal effect. The active monster dossier defines whether an item blocks, exposes, injures, disperses, banishes, contains, or does nothing to that threat.
- Example: an ordinary salt line might form a barrier against one spirit; a rock-salt shell might disperse it temporarily; finding and burning its remains might be the only permanent resolution. Another entity may ignore all three.
- Fire requires a valid fuel/source and can create environmental danger. A shotgun requires the correct ammunition to be loaded. Rituals require their recorded components and conditions.
- The party chooses a limited carried loadout from its vehicle, safehouse, or storage. Episode-specific evidence and consumables are kept separate from persistent equipment.
- Picking up, using, losing, consuming, loading, unloading, giving, and recovering an item are explicit state changes.

### Danger and confrontation

- Investigation uses an escalation clock instead of experience rewards. Delay, failed checks, noise, split parties, and incorrect rituals can advance it.
- Monsters are normally too dangerous to defeat through ordinary attacks until the party understands enough of their rules.
- Incorrect countermeasures provide observable feedback without automatically revealing the correct weakness.
- Turn order appears only during immediate danger or combat. Outside a crisis, normal party conversation and free action are used.
- The episode cannot quietly reset its threat, room, clues, or resolved encounters after the state has advanced.

### Four-season arc outline

- **Season 1 — The rules of the dark:** the hunters learn that apparently unrelated cases share an old mark and a pattern of deliberately disturbed hauntings.
- **Season 2 — The hidden network:** recurring contacts, rival hunters, institutions, and hostile factions reveal that someone is collecting or engineering supernatural incidents.
- **Season 3 — The hunters become evidence:** earlier choices and surviving monsters are used against the party; trusted records and identities can no longer be assumed safe.
- **Season 4 — The convergence:** case clues reveal the purpose behind the four-year pattern, and the final episodes require knowledge, allies, and consequences accumulated across the whole series.

These are structural directions, not fixed plots. A season bible will define its exact mystery, antagonist, clue chain, reversals, and finale before its episodes are authored.

### Authoring and validation plan

1. Build the modern-supernatural rules profile and visual theme.
2. Implement the episode schema, monster dossier, evidence ledger, loadout, consumables, escalation clock, and completion validator.
3. Write a four-season series bible and 80 short episode cards before writing full scenes.
4. Create three playable pilots that exercise different investigation patterns: a restless dead case, a living creature case, and a curse or possession case.
5. Test success, failure, wrong-hypothesis, retreat, split-party, inventory, and repeated-action paths.
6. Revise the engine and schema from those tests.
7. Author one full 20-episode season, validate it, and only then expand the remaining seasons.

Writing all 80 complete episodes before the rules and pilots pass validation is deliberately avoided; it would reproduce the current problem of repairing every encounter individually.

## Modular content packs and weighted tables

- Named reusable tables for locations, witnesses, complications, evidence, atmospheric details, and minor encounters
- Weighted entries, conditions, exclusions, cooldowns, and once-per-story limits
- Universe-specific packs that cannot leak terminology or rules into another universe
- Seeded previews and validation reports for authors
- Generated flavour can vary, but tables never override authoritative world, room, inventory, encounter, or objective state
