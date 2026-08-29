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
- Optional Ollama AI with a playable built-in demo DM when the configured model is unavailable

## Start locally

1. Install Node.js 22 or newer and Ollama.
2. Copy `.env.example` to `.env` and select an installed Ollama model.
3. Run `npm install`, then `npm run build`.
4. Run `Start-Hearthbound.ps1` or use the **Hearthbound D&D** desktop shortcut. The launcher starts Ollama and the campaign server if needed, verifies and warms the configured model, prints the usable addresses, and opens the game. It is safe to run again when Hearthbound is already active.
5. Open `http://<PC-address>:4173` from another device on the same network.

Campaign data is saved in `data/campaign.sqlite`. Back up that file while the server is stopped, or copy the database together with its `-wal` and `-shm` files while it is running.

See [Local startup and project handoff](docs/STARTUP-AND-HANDOFF.md) for launcher options, first-time setup, logs, and the contributor workflow.

## iPad microphone requirement

Typing and narration playback work over an ordinary local HTTP address. Safari requires HTTPS before it will offer microphone access. Set `HTTPS_KEY` and `HTTPS_CERT` in `.env`, and install/trust the corresponding local certificate authority on each iPad before using hold-to-talk.

Each iPad must tap **Narration off** once to enable spoken playback. This deliberate tap satisfies Safari's audio permission rules. In one physical room, leave narration enabled on only one iPad to prevent echo; players in other rooms can enable it on their own devices.

## Local AI contract

The configured Ollama model is used twice for each action:

1. A hidden director sees DM state and determines perceivable facts, private observations, and sealed campaign changes.
2. A narrator receives only perceivable facts and turns them into player-facing prose.

The narrator does not receive hidden doors, traps, enemy statistics, NPC motives, or future events. If Ollama or the configured model is unavailable, the opening scene remains playable through a deterministic demo DM.

Set `DND_MODEL` to an exact installed Ollama tag. The chosen model is local configuration and is not stored in Git; `.env.example` provides the documented default.

## Current prototype boundary

This slice validates the family play loop, isolated worlds and parties, adventure selection, secrecy model, persistence, dice, iPad layout, narration, and speech-capture path. It does not yet implement the full SRD 5.2.1 character builder, automatic milestone awarding, combat engine, spell catalogue, inventory management, encounter maps, or generated server-side character voices.
