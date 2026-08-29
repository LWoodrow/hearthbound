# Local startup and project handoff

## Start Hearthbound on Windows

From the repository folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Hearthbound.ps1
```

The launcher:

1. Finds Node.js and Ollama.
2. Starts Ollama when it is not already running.
3. reads `DND_MODEL` from the local `.env` file, verifies that exact model is installed, and loads it into memory.
4. Starts the Hearthbound web service when needed.
5. Waits for both services, prints the local and network addresses, and opens the game.

It is safe to run the launcher again when the services are already active. Use `-NoBrowser` to leave the browser closed or `-SkipModelWarmup` to start without loading the model immediately. Server output is written to `data/logs/`.

## First setup on another Windows PC

1. Install Node.js 22 or newer and Ollama.
2. Clone this repository and run `npm install` followed by `npm run build`.
3. Copy `.env.example` to `.env`.
4. Set `DND_MODEL` to an exact tag shown by `ollama list`, then download it with `ollama pull <model-tag>` if necessary.
5. Run `Start-Hearthbound.ps1`.

The `.env` file, installed Ollama models, server logs, and `data/campaign.sqlite` are deliberately machine-local and are not stored on GitHub.

## Handing work to another conversation or contributor

Before changing code, read `AGENTS.md`, `HANDOFF.md`, `BACKLOG.md`, and the relevant files in `docs/`. Work on a separate branch or worktree, add the active scope to `HANDOFF.md`, and update it again when the work stops or changes direction.

GitHub is the source for code and project documentation. The host PC remains the source for its private campaign database, `.env` configuration, and Ollama installation. Do not run two Hearthbound servers against the same SQLite database or share a live runtime between worktrees.
