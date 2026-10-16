# AI-led NPC conversation: deployment design

## Decision

### Current update: AI input/output assessment and bounded conversation tools

Human play exposed a gap: an apology was incorrectly mapped to food, generated speech failed validation, and the old prepared fallback then printed the selected food text without checking relevance. That fallback is no longer allowed on the live assessed path. The input/output assessment described here supersedes the older prepared-fallback publication behaviour below.

Before exposing the knowledge catalogue, AI assesses the conversational act using current public scene, personality and bounded eligible history. It chooses a strict internal capability:

| Capability | Behaviour |
| --- | --- |
| `respond_social` | Draft a relevant acknowledgement/reassurance/humour/companionship response without a knowledge lookup |
| `read_knowledge` | Retrieve current scene or resident knowledge through the existing prerequisite/disclosure-checked catalogue |
| `consider_social_goal` | Propose an existing social situation, with code retaining all rules/consequence authority |
| `clarify` | Draft a relevant clarification question without forcing a factual topic |

This is **MCP-inspired, in-process tool orchestration**, not an installed/exposed MCP server, external connector or unconstrained agent. The model requests an enumerated capability; code dispatches the existing scoped reader/adjudicator. Unknown tool names, extra arguments, rule effects and fabricated capabilities are rejected. There is no generic code executor, file access, arbitrary NPC lookup or world-write tool.

Pure social speech needs no new fact and may return an empty citation list. The input assessor sees no food/quest catalogue to distract it into inventing a topic. Its social draft goes directly to independent outgoing assessment; it does not bypass review. Factual questions retain semantic knowledge selection and a generated reply. A current-scene entry is built from the visible description/features, not raw default or hidden room contents. A non-consequential input assessment cannot start a check merely because the later planner proposes one.

The outgoing AI assessor sees the actual newest speech, history, personality, current evidence, proposed reply and cited IDs. It checks grounding, **conversational relevance**, voice and absence of consequences. True facts can still be a bad answer; a citation does not approve a topic change. It may accept a non-factual acknowledgement with no citation. An apology does not establish offence, and ordinary speech does not update mood or relationships.

After an invalid/rejected draft there is at most **one AI repair**, followed by another independent outgoing assessment. The selected evidence is optional context, not an obligation to recite it. A repair may set aside irrelevant food facts and offer a natural uncited acknowledgement. No generated repair is trusted just because it is a repair. If assessment/repair fails or the model is unavailable, the live path displays a neutral **service notice**, not an unchecked factual line spoken by the NPC. Failed notices do not enter that NPC's natural conversation memory. Legacy offline authored behaviour remains compatible, but the live rejected-output path never copies selected facts as fallback.

The model menu now distinguishes the chosen input capability, accepted AI speech, an AI-repaired reply and a reply withheld from publication. Exact apology, paraphrased conversational repair, humour/companionship, wrong incoming food selection, output rejection/repair, double rejection, outage, tool/schema misuse and unchanged state are regression-tested through real dispatch or injected orchestration. This is a reusable conversational boundary, not an apology phrase matcher or fixed reassuring sentence.

Live social turns normally use two model calls: input assessment/draft then independent outgoing assessment. Knowledge turns normally use four: input, selection, performance, review. Repair can add two calls, with no unbounded loop. Input timeout is 60 seconds; selection remains 75 seconds, generation/review 45 seconds per stage. This improves the architecture, not a guarantee of low latency; the theoretical six-call timeout ceiling is 315 seconds. Do not hide rejection or timeout as a successful conversation.

Use `scripts/evaluate-conversation-assessment.mjs --live` from the configured checkout for the exact user apology with seeded transcript context and an in-memory test save. `--faulty-lookup` deliberately injects the wrong food lookup/draft and uses the real model to assess, repair and reassess it. It does not touch real saves, settings, model selection or ports. The older `evaluate-nima-conversation` script remains an isolated semantic-stage evaluator, not the current end-to-end acceptance harness.

Release evidence: 401 automated tests pass, with production build/typecheck, 36 portrait checks and all four adventure validations. On configured Tiel-Coder-35B-A3B-UD-IQ4_XS, the exact apology selected `respond_social` and produced an accepted natural reassurance in 48.0 seconds (29.6 input/draft, 18.4 output assessment), with unchanged in-memory canonical state. A deliberately injected wrong food lookup/draft was rejected, repaired, rejected again and safely withheld in 46.4 seconds. The reviewer marked relevance true but grounding false on the injected run, so this is evidence of safe withholding, not perfect semantic classification or a successful live repair. Scripted tests establish accepted repair execution; the live runs establish the actual apology path and refusal to publish failed drafts. No universal conversation-quality or latency guarantee is claimed.

Use the model to understand conversation, not merely decorate a keyword-selected answer. Keep authored world truth and deterministic game consequences. The first rollout covers every existing `conversation.natural` resident: the nine Delvers contacts, including Nima. Other residents retain their compatible dialogue until their knowledge/disclosure data is reviewed.

This supersedes keyword categories as the normal interpretation path. It does not remove the last-resort offline matcher, erase character lore, grant models world-write access, or claim that the whole city now has complete lives.

## Ownership and turn sequence

| Stage | Responsibility | Allowed output |
| --- | --- | --- |
| Listener | Code resolves actual presence/hearing and selected partner | One current NPC, or honest ambiguity |
| Catalogue | Code filters that NPC's current knowledge and prerequisites | Eligible IDs; public text; guarded subject labels |
| Interpretation | AI reads meaning, recent conversation and available knowledge | Up to three goals, selected knowledge IDs, optionally one authored social goal/approach |
| Validation | Code checks structure, IDs, size and disclosure classes | An accepted proposal, never invented facts |
| Social adjudication | Code checks stakes, approaches, current evidence, retry locks and party blockers | Real check or authored automatic/refusal outcome |
| Performance | AI answers in character from the selected evidence | Proposed speech with evidence citations |
| Review/publication | Independent AI review plus code's structure/claim/context checks | Accepted speech or safe prepared fallback |

No model output is executed as code. No output field can supply a flag, item, route, relationship delta, DC or resolved die roll. Context is checked again after asynchronous inference; moving or changing canonical state while a response is being prepared discards stale prose instead of publishing it in the new scene.

## What the model can understand

Interpretation is semantic and contextual. There are no new expression-specific rules for stomach noises, finding one's feet, a sister's occupation or a hesitant request for working drafts. The model receives the question and can choose whichever reviewed knowledge answers it. Examples used in tests include:

- “My stomach is making more noise than the expedition bell. Any bright ideas?” => advice about existing food destinations, not a purchase.
- “Who helped make you the person standing here?” => potentially Nima's public upbringing/family, without requiring the word *family*.
- “Does she take after you?” => use the previous conversation to identify the sister, then answer only from current family evidence.
- A question about both work and food => separate goals and relevant evidence for each.
- A paraphrased request for unpublished drafts => propose the existing Lethriel social situation, not a new check invented by the model.

These examples are evaluation cases, not production string mappings. Scripted test transports prove the routing and safety boundary; only live model evaluation demonstrates semantic performance. An abstract question may legitimately warrant clarification rather than the author's preferred interpretation.

## Knowledge is data, not a response script

Keep individual identity, history, relationships, interests, voice and boundaries authored. Nima's sister Maren is a stable fact; a generated reply may describe their shared repair-first upbringing in different words. The model cannot invent another relative, address, tragedy, visitable location or family quest because the player asks an unsupported question.

Public neighbourhood advice can be shared across residents. Personal biographies cannot. Knowledge entries retain `{id, text, tier, subjects, requires?}`. Existing `everyday:food` hints remain compatible metadata and offline fallback support, but the live planner reads meanings and text without routing through those tags. `subjects` on guarded detail/solution entries should describe the topic well enough to select it without revealing the answer itself.

The planner never receives the entire adventure or raw rule effects. Current prerequisites are evaluated first. Everyday/advice entries supply their full public text. Detail/solution entries supply IDs, subject labels and tier only; their text is loaded into performance only after an appropriate validated plan selects them. Locked private facts do not appear even by label. Topic greetings/local news/personal material are additional available knowledge, not a mandatory line to play before every answer.

## Plan contract

The strict JSON plan has exactly:

```json
{
  "goals": [{"kind": "advice", "evidenceIds": ["delvers-food"]}],
  "challengeId": "",
  "approach": ""
}
```

Goal kinds are `chat`, `advice`, `detail`, `solution`, `transaction`, `social-check`, `clarification`. These are broad operational meanings, not per-sentence branches. A plan contains one to three goals, at most three IDs per goal and six total references. Every selected ID must exist in the current catalogue. The requested generation schema dynamically enumerates those IDs and the NPC's actual challenge IDs; residents without authored checks are not offered the social-check kind or an approach. This prevents the ambiguous word “social” from inviting a model to treat ordinary family chat as a consequential action. Detail requires a detail/solution goal; solution text requires a solution goal. This checks structural consistency, not mathematical proof that the model correctly understood the player's intent. Independent relevance review remains essential before speech is shown.

A social plan names one current authored challenge and one standard approach. Code then applies the same fixed DC, allowed/forbidden approaches, prerequisites, evidence bypass, actor-specific retry signature, party blockers and atomic persistence used previously. An AI interpretation of ordinary explanation suppresses the old keyword social matcher rather than accidentally requesting a roll. Essential authored interactions and actual physical commands retain their existing engine authority. Multiple simultaneous consequential goals are not supported: one social outcome takes precedence, and ordinary follow-up may be needed for other subjects.

## History and privacy

History is capped at the last six exchanges in prompts and eight persisted exchanges per player/NPC/adventure. Player speech, prior generated replies and knowledge text are labelled untrusted data, not instructions or new authority. Earlier replies whose cited knowledge has been withdrawn are replaced with an unavailable-history marker before semantic planning/performance. Current eligible knowledge, not a past promise or player assertion, supplies truth.

The selected listener, presence checks and per-player history remain unchanged. The model cannot switch speakers, search another resident's private background or import another player's social state. Actual current weather, time, prices and distant NPC whereabouts are unknown unless explicitly authored. Stable observations about sun/shade are not a weather simulator.

## Failure behaviour and diagnostics

- Invalid JSON, unknown IDs, extra fields, wrong disclosure class, duplicate references, invented social goals and excessive output reject the interpretation.
- Model outage or interpretation rejection uses existing bounded matching/authored fallback, not world improvisation. The UI identifies that degraded understanding path.
- Invalid performance or a negative semantic review falls back. Guarded detail/solution text is deliberately excluded from the prepared fallback, so a wrongly selected spoiler cannot leak merely because review rejected the generated answer.
- A purchase request can receive advice/refusal, never a fictitious transfer. Ordinary recommendations do not receive purchase refusals on the semantic path.
- A changed scene/world revision while inference runs aborts publication/adjudication and asks the player to speak again in the current scene.
- Oversized catalogues fail closed; they are not silently truncated so that constraints disappear.

`npcDialogueStatus` records reply source separately from interpretation source/reason. The model menu shows **Understanding: AI interpreted your conversation** versus fallback matching, alongside generated/grounding-checked versus prepared/rules reply status. Private prompt traces use the existing redacted inspector. Rejected drafts and planner instructions do not enter story narration.

## Budgets, latency and scale

The initial planner permits at most 80 available entries and a 24,000-character input packet. The existing model-profile context-budget check can impose a smaller limit. Recent speech/replies are bounded individually. Interpretation uses temperature zero, at most 260 generated tokens and a 75-second timeout to accommodate cold local inference; performance and independent review retain their 45-second per-stage budgets. An empty goal list is invalid both in the generation schema and the runtime validator.

Ordinary live dialogue currently requires three sequential model calls. This is a correctness/flexibility pivot, not a speed improvement; local hardware/model speed and rejection rates must be measured. Do not conceal timeouts as successful AI understanding. Potential next optimisation is a combined interpretation/public-knowledge performance pass, retaining separate review and separate retrieval for guarded details. Do not remove independent validation just to improve a benchmark.

Large-city scale should use reviewed knowledge indexing and scoped retrieval, not an ever-growing full-world prompt. Persistent memories remain engine-confirmed episodes; the model does not write remembered facts from chat. Dynamic schedules, live weather, procedural quests, arbitrary services and unrestricted social actions remain separate designs.

## Verification and rollout

`tests/ai-conversation-planner.test.mjs` exercises injected structured interpretation through actual game/database dispatch: paraphrases, multi-goal selection, all three model stages, pronouns/history, withdrawn knowledge, mismatched disclosure classes, malicious output, rejected spoiler fallback, real social checks/failure/retry/boundaries, ordinary explanation, degraded operation, budgets and stale context. Existing NPC, combat, movement, save and adventure regressions remain required.

`scripts/evaluate-nima-conversation.mjs --live`, run from the configured app checkout, evaluates semantic paraphrases, reference resolution and a work/food question through the real configured transport and prompt budget. It prints source, goals, rejection reason, replies and latency. It does not touch gameplay databases, settings or model loading. This is opt-in because it performs inference on the configured server.

Deploy only after the full test suite, production build/typecheck/portrait checks and adventure validation pass. Merge the isolated branch to GitHub main, rebuild the usual checkout, refresh the existing 4173 process and verify its running commit. Preserve current saves, Nima position/history, art, AI configuration and unrelated local edits. Human acceptance: continue with Nima, try unfamiliar wording and change subjects naturally; inspect the model menu if a reply feels canned. Then expand individual reviewed biographies and evaluate contrasting personalities before adding more districts.

Model interpretation and semantic review can both be wrong. IDs, prerequisite filters and absence of arbitrary write fields constrain authority, but do not prove every sentence true or every social intention correctly understood. Report ambiguity, unwanted checks, repetition, hallucination, source and latency; improve the general interpretation/knowledge contract rather than adding another exact-phrase exception.

### Recorded release evidence (16 October 2026)

392 automated tests pass, with production build/typecheck, 36 portrait checks and all four adventure validations. Initial read-only live runs on configured Tiel-Coder-35B-A3B-UD-IQ4_XS exposed timeouts, empty goal lists and an invented family challenge when the original protocol used the ambiguous label `social`. Those attempts were rejected, not published as successful interpretation. The release protocol uses mandatory nonempty goals, dynamic current-ID enums and the explicit `social-check` class, absent for residents without authored checks.

The final bounded live smoke test asked “Who helped make you the person standing here?” without the word *family*. AI selected Nima's personal/family knowledge and generated a newly phrased answer about her parents' repair-first upbringing and sister Maren's clothes-mending; independent review accepted it. Stage times were 36.5 seconds interpretation, 34.5 seconds performance, 17.0 seconds review: **88 seconds total**. This records one successful final-protocol turn, not a claim of comprehensive multi-turn/model/personality quality. Earlier runs that degraded to fallback are not counted as passes. Human playtesting and latency optimisation remain the immediate next gates; --limit=1 supports a bounded read-only smoke run.
