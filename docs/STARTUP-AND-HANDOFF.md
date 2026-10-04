# Local startup and project handoff

## Start Hearthbound on Windows

From the repository folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Hearthbound.ps1
```

The launcher:

1. Finds Node.js and the built web application.
2. Starts or restarts the Hearthbound web service and opens the game library even when AI is unavailable.
3. Preserves local Ollama startup for existing configurations during migration.
4. The backend optionally starts the saved local llama.cpp configuration if auto-start is enabled. Remote servers are managed on their own host.

It is safe to run the launcher again when the services are already active. Use `-NoBrowser` to leave the browser closed. `-SkipModelWarmup` remains accepted for old shortcuts; startup now follows the saved auto-start setting instead of a warm-up request. Server output is written to `data/logs/`.

## First setup on another Windows PC

1. Install Node.js 22 or newer.
2. Clone this repository and run `npm install` followed by `npm run build`.
3. Copy `.env.example` to `.env`.
4. Run `Start-Hearthbound.ps1` and open **AI connection** in the game library on the host computer at `http://127.0.0.1:4173`.
5. Choose llama.cpp on this computer, or an existing server by URL. Save the connection after testing it.

The `.env` file, `data/ai-settings.json`, model files, server logs, and `data/campaign.sqlite` are machine-local and are not stored on GitHub. Resetting an adventure does not reset AI settings.

## Set up local llama.cpp

Download a Windows llama.cpp release matching the PC's hardware from the official release page and extract it. In AI connection, choose llama.cpp and **On this computer**, then enter the absolute path to `llama-server.exe` and your models folder (default: `data/models`). **Refresh model library** lists complete single-file GGUFs, including files up to two subfolders deep. Choose a model in the dropdown and **Load selected model**. With a managed server running, choose another GGUF and use **Switch & load selected model**; Hearthbound only stops its own server. Paths containing spaces are supported. A manual file path is available for a model outside the library.

**Download a model** accepts public Hugging Face `blob` or `resolve` links for a single GGUF. Check the model card/license and hardware requirements first. Progress is polled every three seconds; cancel removes the current partial file. Files are streamed to a unique `.part`, header/size checked, and published without overwriting an existing model. Completed downloads appear in the dropdown. Downloads do not resume across app termination; abandoned `.part` files are ignored and can be removed manually. The first version has a 64 GB per-file limit and requires 256 MB spare space beyond a known download size. Header checks do not guarantee model/template compatibility; test the loaded model before play. Private/gated files, split shards and llama.cpp installation remain manual. Settings changes and app restart are blocked during an active download/load.

Use `http://127.0.0.1:8080`, a model alias such as `hearthbound`, and a context size matching the intended prompt budget (8192 initially). GPU layers default to 99; lower this for limited VRAM or use 0 for CPU. **Save & start local AI** launches without a visible terminal and logs to `data/logs/llamacpp.log`. **Test connection** verifies model discovery plus a schema-constrained JSON answer. Enable auto-start once this succeeds. **Stop local AI** stops only a process started by this Hearthbound service; external processes cannot be stopped here.

## Connect to another computer

Choose **An existing server**, enter its root URL (a trailing `/v1` is normalized), and supply an API key if required. **Find models** lists the model aliases advertised by that server. Select one, match the configured context capacity, test and save. All AI requests originate on the Hearthbound backend; browsers never receive the saved key. Changing provider or server URL clears the saved key unless a replacement is entered. Settings can be managed only through a loopback host address, independently of character login; iPads continue to play using the selected server.

For a remote llama.cpp host, configure its network listening address and model alias on that machine. Use LAN/private VPN access, or authenticated HTTPS when using an internet hostname. **Find models** fills the server model dropdown. Ordinary single-model llama.cpp advertises its loaded model; router configurations may expose more. This cannot scan or download into a remote machine's disk: manage its GGUF files there. Hardware setup and router management are outside this package.

API health/model discovery, schema-constrained completion and thinking-template controls follow the [official llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). Context allocation is a server launch option, rather than an Ollama request option.

## Handing work to another conversation or contributor

Before changing code, read `AGENTS.md`, `HANDOFF.md`, `BACKLOG.md`, and the relevant files in `docs/`. Work on a separate branch or worktree, add the active scope to `HANDOFF.md`, and update it again when the work stops or changes direction.

GitHub is the source for code and project documentation. The host PC remains the source for its private campaign database, `.env` configuration, and Ollama installation. Do not run two Hearthbound servers against the same SQLite database or share a live runtime between worktrees.
