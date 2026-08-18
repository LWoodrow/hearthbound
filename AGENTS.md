# Hearthbound collaboration rules

These instructions apply to every person or AI working in this repository.

1. Read `HANDOFF.md`, `BACKLOG.md`, and the relevant documents under `docs/` before changing code.
2. Treat GitHub `main` as the integrated source of truth. Start each work package from an up-to-date `main` on a dedicated branch; use the `codex/` prefix for Codex branches.
3. Use a separate clone or Git worktree per active worker. Never let multiple workers edit the same checkout, database, or running development server.
4. Record active work in `HANDOFF.md` before substantial changes. On completion, update its status, verification results, decisions, known limitations, and next action.
5. Do not overwrite or discard another worker's unmerged changes. Inspect the working tree first and coordinate overlapping files through the handoff table.
6. Canonical world state belongs to deterministic code. Language models may interpret input and narrate validated outcomes, but must not invent or mutate authoritative facts.
7. Prefer reusable engine and interpretation fixes over transcript-specific wording or adventure-specific runtime patches.
8. Add a regression test for every confirmed human-play failure that is fixed. Run `npm test`, `npm run build`, and `npm run validate:adventures` before handoff when the affected scope permits.
9. Do not commit secrets, local model data, generated databases, test saves, build output, or machine-specific configuration.
10. Keep commits scoped and descriptive. Do not merge or push unless the user has authorized it.

