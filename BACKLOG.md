# Hearthbound backlog and work plan

This document records agreed future work. It is a planning document; an item being listed here does not mean it is already implemented.

## Delivery order

1. Create a private GitHub safety baseline and recoverable first release
2. Global Storyman guardrails and regression tests
3. Adventure schema, state-machine validation, and authoring tools
4. Rebuild and validate The Lantern Below using the finished schema
5. Validate Ashes of Briarwatch and the connected high-fantasy campaign arc
6. Complete the rules matrix and missing combat/class automation
7. Complete exploration, conversation, spotlight, and initiative behaviour
8. Improve maps, avatars, scene art, narration voices, and iPad presentation
9. Add modular content packs and weighted generation tables
10. Research and design each further universe, then implement it only after the shared engine is stable

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
