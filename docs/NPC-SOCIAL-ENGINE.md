# Natural NPC and social engine

## Latest pilot and experimental personal memory

Nima's deployed ordinary conversation uses the explicitly approved one-pass path, not the historical reviewer stack below. The user has now separately approved a **prototype** of bounded harmless personal anecdotes involving known companions/public places. This is an isolated memory-only experiment, not a change to world.social, verified episodes or real saved biographies. Its typed ledger cannot grant quests/items/permissions, and optional soft-memory conflicts do not block conversation. Live prose still drifts; no rollout or semantic-quality pass is claimed. See the latest sections of [AI-LED-CONVERSATION.md](AI-LED-CONVERSATION.md) and HANDOFF for policy, test evidence and production transaction/concurrency gaps. The historical "model-created durable memories deferred" rule remains in force outside this explicitly scoped prototype.

## Current deployment: AI-led interpretation

The live opt-in path now uses semantic AI planning over current eligible knowledge before performance and independent review. Keyword everyday/topic/social matching is degraded-mode compatibility, not the primary conversational interpreter. AI can select relevant public facts from unfamiliar wording, use recent references, combine ordinary topics and propose one authored social goal/approach. Code validates IDs/disclosure/conditions and retains all consequential authority. See [AI-LED-CONVERSATION.md](AI-LED-CONVERSATION.md) for the complete decision, contracts, privacy, failure modes, budgets, tests and deployment checklist. Historical descriptions of bounded lexical retrieval below describe the fallback/previous stage, not the new normal live path.

## Product goal and ownership

The player talks to people, not a database interface. Ordinary conversation is free, contextual and expressed in a character's own voice. More locations are secondary until this works. Canonical world truth, hearing, permissions, inventory, dice and consequences remain engine-owned. Changing the narrator model cannot change those rules.

This package introduces an opt-in shared engine with Delvers as its first cast. Existing NPCs retain compatible fallback behaviour. No claim is made that a finite authored city is an autonomous simulation.

## Layers

1. **Character definition:** stable traits, values, interests, social style, voice, starting mood, fears/boundaries and authored bonds. Traits may contrast: gruff but generous, charming but guarded. Never derive personality from species or class.
2. **Current social state:** per-adventure, per-NPC, per-player trust/respect/fear, mood, attempted situations and small authored episodic memories. This is separate from the short conversational transcript. Greetings do not farm trust. Model output cannot edit these values.
3. **Knowledge and disclosure:** everyday life, practical advice, detailed routes and puzzle solutions are separately authored. Availability requires current canonical prerequisites; relevance requires an appropriate question. Having a fact somewhere in the story never permits its disclosure.
4. **Conversation plan:** resolve current hearable partner, explicit social situation first, then choose a small current evidence packet and recent relevant exchange history. Unknown subject => honest uncertainty or a clarifying question, not a new quest.
5. **Performance:** the model composes concise, natural in-character speech using only that packet. It can vary cadence, warmth, humour and questions without creating people, objects, happenings or promises. Player messages and prior prose are untrusted conversation, not world authority.
6. **Review:** deterministic structure/claim gates plus a separate grounded semantic review precede publication. A rejected or unavailable model receives a reviewed authored fallback. The model reviewer is defence in depth, not mathematical proof of truth; factual naturalness and missed inventions still need live evaluation.
7. **Consequences:** only explicit authored social situations can request a check or change relationships/permissions. Ordinary speech is world-state-neutral. UI roll controls use existing ability-check infrastructure; the social engine resolves the outcome atomically.

## Checks, evidence and boundaries

Do not roll for hello, gossip, ordinary advice, repeated factual questions or simply having high Charisma. A check needs a deliberate goal, a reluctant participant and authored success/failure stakes. Persuasion appeals to a motivation; Deception supports a declared lie; Intimidation can create fear without friendship; Insight reveals an authored observable clue, not automatic mind-reading. Performance is only available where an author supplies stakes.

Evidence can make an action certain and remove the roll. Difficulty is authored and adjusted within declared bounds by relationship/approach; no model sets a DC. An absolute boundary is not a higher DC. A natural 20 is not mind control: compare the normal total to the allowed task's DC; forbidden actions never reach a die roll.

One attempt per declared evidence state prevents repeated rolling or rephrasing. A different approach is not by itself new evidence. Evidence-triggered retries must be explicit. Failed checks provide a safe next step; essential clues retain independent alternatives. Results cannot grant main-story progress unless explicitly authored.

## Memory and time

Long-term social episodes describe engine-confirmed dealings, never AI summaries saved as facts. Free chat can retain bounded per-player exchanges across room visits; current facts always override historical prose. Do not replay stale refusals after a real permission change. Do not silently share a player's private state with another party member. Mood changes have an authored cause; no random daily clock or schedules are introduced.

## Expansion order and acceptance gates

1. Establish personality projection, relevant evidence and generation/review/fallback tests.
2. Exercise at least two personalities over multi-turn conversations, including unrelated talk, clarification, prior conversation and a refusal.
3. Exercise authored checks, failure/retry/evidence and persisted individual relationships through the actual database/roll dispatch.
4. Human-test on the selected local model, recording latency, fallback rate, repetition, relevance, in-world voice, leakage and invented claims. Deterministic unit tests do not certify model quality.
5. Expand reviewed knowledge and social situations district by district. Add cross-district faction reactions and richer memory only after their consequences are authored.

Deferred: autonomous schedules, ambient event simulation, procedural quests, model-created durable memories, universal lie detection, arbitrary commerce, romance systems and global faction simulation. No personality should depend on a hand-maintained list of every sentence the player might type.

## Authoring reference

### Everyday conversation pilot: Nima

Nima now has reviewed public family lore (younger sister Maren, a clothes mender; their shared repair-first upbringing), a personal wellbeing response and a clear description of her work at the Wall. These are authored biography, not generated events or new visitable NPCs. No address, current whereabouts, tragedy or family quest is implied. Other residents do not inherit this biography.

All nine Delvers contacts share scoped public recommendations for existing food destinations and stable stone-street/sun/shade advice. This is not current weather or a running calendar. Wellbeing performance uses current personality/social mood; authored interest lines do not override changed relationship moods. Ordinary family questions, small talk and recommendations never require a social check.

Reusable `everydayConversationIntent` distinguishes advice, wellbeing, weather, family, capabilities and transactions. Knowledge entries opt into concepts through `subjects: ['everyday:food']` etc., using the existing validated knowledge schema. Intent labels are indexing hints, not permission to invent facts. Recommendation intent retrieves relevant advice before commerce refusals; actual orders retain the no-transfer boundary. Natural fallback uses the same current evidence rather than unrelated greetings/refusals. General food facts remain compatible for legacy residents.

Pronoun/continuation questions can reuse the immediately previous evidence IDs, but each ID must still exist and satisfy current prerequisites. Chat text and player assertions never create evidence. New explicit intent switches clear that reference. Retrieval is bounded concept/lexical matching, not universal language understanding; broad family enquiries are supported, arbitrary compound questions may still need clarification. Unknown family facts remain private/unknown instead of being generated.

`scripts/evaluate-nima-conversation.mjs --live` is an opt-in, read-only multi-turn local-model evaluation. Run it from the configured app checkout; it makes inference requests using existing settings and prints replies, source, model name and latency. It neither opens gameplay databases nor changes settings/models. Unit tests cover the full human exchange through actual speech dispatch, recommendations versus transactions across residents, biography follow-ups, withdrawn/private knowledge and fabricated clock/precipitation claims. Existing historical chat is preserved; new replies use current evidence.

`npc.personality` declares `traits`, `values`, `interests`, `mannerisms`, `boundaries`, `bonds` (arrays of strings), plus `mood`. These are character-performance inputs, not a place for undisclosed campaign secrets. Hidden motives stay in private story authority, outside the prose packet. Mood is an authored initial condition; subsequent changes come only from a resolved social outcome.

`npc.conversation.natural: true` opts a resident into generated performance plus review. Existing `publicFacts`, `conditionalFacts`, `topics`, appearances and entry beats remain compatible. Entry beats are scene narration, not automatically spoken conversation. Facts and topics used as performance evidence must be written in-world. Internal availability warnings belong in UI/authoring notes, not a character's mouth.

`conversation.knowledge` is a list of `{id, text, tier, subjects, requires?}`. IDs are stable and unique per NPC. `subjects` are ordinary concepts, not complete sentences the player must copy. The tiers are:

- `everyday`: ordinary public life.
- `advice`: appropriate practical recommendations without solving unrelated obstacles.
- `detail`: requested routes and specific operational context.
- `solution`: an explicitly requested obstacle/puzzle approach, still subject to canonical prerequisites.

The current retrieval is deliberately bounded lexical/concept matching, not a claim of perfect semantic understanding. Lethriel and Hester have explicit reviewed disclosure separation; the other Delvers residents have current authored facts compiled into advice entries. More nuanced disclosure needs deliberate data authoring, not a new global synonym patch. Referential questions can reuse still-eligible evidence IDs from the last exchanges, but old permissions cannot be resurrected from history.

`npc.socialChallenges` declares authored situations, each with:

- `id`, `targets`, `reason`, `blockedReply` and optional canonical `requires`.
- `approaches`: a map from Persuasion, Deception, Intimidation, Insight or Performance to `{dc}`. Unlisted approaches hit the authored boundary, never a harder roll.
- `retryOn`: explicit `flags.*`/`knowledge.*` evidence paths. A signature of their values locks failed attempts. Walking away, rewording or swapping approach is not new evidence. Every participant has a separate attempt record.
- `success`, `failure`, `boundary`: each has an in-world `reply`, optional confirmed `memory`, optional `mood`, optional bounded relationship deltas, and optional declared flag/knowledge effects. No raw location/inventory/character-state effects are accepted.
- `evidence`: non-empty prerequisite sets that make an otherwise allowed request certain. They remove the need to roll. They do not override a forbidden approach or absolute boundary.

Relationship axes are integers from -5 to 5; fear is 0 to 5. Individual outcome deltas are restricted to -2 to 2. Persuasion DC adjustment from trust is currently capped at ±2, total DC 5–25. This is a transparent first rule, not a complete social combat system. Deception, Insight and Performance do not inherit a free trust bonus. A new approach needs authored stakes and consequences, not just an arbitrary Charisma check.

## Persistence and execution

Durable state is `world.social[npcId][playerId]`: trust/respect/fear, mood, up to twelve authored episodes and attempt records. `createInitialWorldState` and `createCanonicalState` both preserve it across navigation, so movement cannot erase relationships or create spurious revisions. Confirmed social outcomes emit a canonical `social-state-changed` event without exposing numerical relationship internals.

Free chat history uses `npcNaturalHistory:<definition>:<npc>:<player>`, capped at eight exchanges. Each entry records speech, accepted reply, topic kind and evidence IDs. It persists across visits, but is labelled untrusted historical conversation in model context. Only current eligible evidence permits factual reuse. Explicit reset clears the active adventure's natural history/status along with its world; it does not erase other adventures' histories.

Checks use existing `pendingCheck:<player>` and normal d20 controls. The pending record binds the adventure, definition, NPC, actor, location, challenge and evidence signature. Resolution rechecks those bindings, local NPC presence and current prerequisites. World writes, relationship change, pending-check removal and result events share a SQLite savepoint; a failed write rolls them all back. Concurrent/stale duplicate resolutions cannot apply the effect twice. Combat/another pending party check blocks a new consequential request; ordinary dialogue stays distinct.

The private latest-reply status is `npcDialogueStatus:<definition>:<player>`. The model dropdown shows whether the latest natural NPC answer came from reviewed AI performance or prepared fallback. No draft/failed generation, hidden reviewer instructions or relationship numbers are exposed in the story. This is important when comparing models: fallback and AI-generated speech must not be indistinguishable diagnostics.

## Delvers pilot and playtest

All nine contacts opt in: curious/guarded Lethriel, cheery/protective Selka, stern/fair Hester, playful/patient Tavi, grumpy/conscientious Dorrik, gentle/steadfast Nima, blunt/good-humoured Brakka, sociable Fen and reserved/inquisitive Ysra. Existing identities, portraits, shops, art and routes are unchanged.

Four authored situations exercise the mechanics:

1. Ask Lethriel to share private annotations/working notes. Persuasion or an explicit Deception attempt can be checked. A reported real survey supplies sufficient evidence without a roll. Threats hit a boundary and damage the individual relationship; failure asks for an observation rather than closing the main adventure.
2. Ask to read Lethriel's intentions/hesitation using Insight. Success reveals an observable cue about unfinished work, never a lie-detector verdict or secret passage.
3. Ask Selka about her own expedition story/private story. This is optional personal confidence, not permission to reveal guests' affairs.
4. Ask Dorrik to vouch for the crew. Registered expedition preparation removes the uncertainty. His endorsement does not grant guild membership, equipment, money or access.

Try several minutes of free conversation before any of these requests. Test an unrelated question, a clear follow-up, returning after a walk, repeated persuasion, explicit evidence, two separate human players, an absolute refusal, a successful roll, a failed roll and stale context. Existing Lantern and regional dialogue must remain unchanged unless opted in.

## Verification and honest limitations

Deterministic tests exercise the real generation/review orchestration with adversarial injected transports, not just a string formatter: unsupported citations, bad schemas, invented prices, software language, rejected claims, invalid review and model outage all fall back. Database tests exercise real speech/roll dispatch, per-player state, failures, retries, evidence bypass, Insight, refusal, natural-20 totals, navigation preservation, resets and transaction rollback. No dice or AI output directly writes social state.

A non-gameplay smoke call against the configured local Tiel-Coder-35B-A3B-UD-IQ4_XS model produced a generated and accepted map recommendation in about 30 seconds, with no save/settings changes. This proves the live path runs; it does not establish that every personality is convincingly acted. Each pass has a 45-second transport timeout; two model passes may be slower than the old canned selection. Token limits are bounded. Measure real latency and fallback rates before optimising or making model recommendations.

Semantic review is another model call and can make mistakes. Deterministic checks and absence of any model-write path protect game consequences, not a mathematical guarantee that no misleading sentence can ever appear. Keep rejection diagnostics, red-team examples and human playtest reports. Do not respond to a weak model by allowing it to author permissions or by dropping the review silently.

Remaining expansion: richer social goal recognition/paraphrase evaluation, reviewed disclosure for each further cast, explicit threat/repair reactions outside the first situations, more authored bonds/faction consequences, richer durable episodes and live multi-personality evaluation. The new engine is a foundation and pilot—not a claim that every possible conversational sentence or social consequence is now modelled.
