# Hearthbound

Hearthbound is a private family D&D prototype hosted by one Windows PC. Every human joins as a player character from an iPad; the PC keeps the campaign database and acts as the Dungeon Master.

## What works now

- Persistent characters with one-tap selection on trusted family devices
- Multiple worlds, each with separate parties, characters, adventures, story history, and hidden DM state
- Level-rated adventures with milestone targets and persistent character levels
- Character deletion with an explicit confirmation
- A detailed 2024-style level-one character builder covering species, class, background, alignment, standard-array abilities, skills, equipment approach, appearance, and backstory
- A shared campaign scene and live story ledger
- Typed **Act**, **Speak**, and **Ask DM** inputs
- Server-controlled, permanently recorded dice rolls
- Public narration and character-private observations
- DM-only state that is never returned by the player API
- Spoken narration through each participating iPad
- Hold-to-talk recording with an optional local Whisper-compatible transcription service
- Library-level AI connection settings for local llama.cpp, remote llama.cpp URLs, and existing Ollama servers; deterministic fallback when AI is unavailable

## Start locally

1. Install Node.js 22 or newer.
2. Copy `.env.example` to `.env`.
3. Run `npm install`, then `npm run build`.
4. Run `Start-Hearthbound.ps1`. In the game library, open **AI connection** on the host PC. Choose local llama.cpp and enter the executable/GGUF paths, or enter an existing AI server URL. Use **Test connection** and **Save settings**. The app opens even before AI is configured.
5. Open `http://<PC-address>:4173` from another device on the same network.

Campaign data is saved in `data/campaign.sqlite`. Back up that file while the server is stopped, or copy the database together with its `-wal` and `-shm` files while it is running.

See [Local startup and project handoff](docs/STARTUP-AND-HANDOFF.md) for launcher options, first-time setup, logs, and the contributor workflow.

## iPad microphone requirement

Typing and narration playback work over an ordinary local HTTP address. Safari requires HTTPS before it will offer microphone access. Set `HTTPS_KEY` and `HTTPS_CERT` in `.env`, and install/trust the corresponding local certificate authority on each iPad before using hold-to-talk.

Each iPad must tap **Narration off** once to enable spoken playback. This deliberate tap satisfies Safari's audio permission rules. In one physical room, leave narration enabled on only one iPad to prevent echo; players in other rooms can enable it on their own devices.

## Local AI contract

The configured AI server uses the shared structured-response adapter for interpretation, narration, NPC conversation, character suggestions, and Cotton. Model-driven actions use bounded director and narrator packets:

1. A hidden director proposes structured interpretation; deterministic code validates any supported consequence against canonical state.
2. A narrator receives the accepted perceivable facts and turns them into player-facing prose.

The narrator does not receive hidden doors, traps, enemy statistics, NPC motives, or future events. If the AI server is unavailable, deterministic fallback remains available.

AI settings are saved privately in `data/ai-settings.json`, independently of adventure saves, and override environment defaults. Keys stay on the backend. Existing `.env` Ollama configuration remains usable until changed in Settings. Local startup uses a preinstalled `llama-server.exe` and a GGUF model; downloads and hardware installation remain manual.

## Current prototype boundary

This slice validates the family play loop, isolated worlds and parties, adventure selection, secrecy model, persistence, dice, iPad layout, narration, and speech-capture path. It does not yet implement the full SRD 5.2.1 character builder, automatic milestone awarding, combat engine, spell catalogue, inventory management, encounter maps, or generated server-side character voices.
