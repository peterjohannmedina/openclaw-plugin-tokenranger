# openclaw-plugin-tokenranger

**TokenRanger** is a community plugin for [OpenClaw](https://openclaw.ai) that compresses session context through a local SLM (via [Ollama](https://ollama.com)) before sending to cloud LLMs — reducing input token costs by **50–80%**.

---

## Table of contents

- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Install](#install)
- [Configuration](#configuration)
- [Commands](#commands)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)
- [Performance](#performance)
- [Graceful degradation](#graceful-degradation)
- [Contributing](#contributing)

---

## How it works

```
User message → OpenClaw gateway
  → before_agent_start hook
  → Turn 1? Skip (full fidelity for first message)
  → Turn 2+: strip code blocks, send history to localhost:8100/compress
  → FastAPI sidecar runs LangChain LCEL chain (Ollama)
  → Compressed summary returned as prependContext
  → Cloud LLM receives compressed context instead of full history
```

Inference strategy is auto-selected based on GPU availability:

| Strategy | Trigger | Model | Approach |
|---|---|---|---|
| `full` | GPU available | `mistral:7b` | Deep semantic summarization |
| `light` | CPU only | `phi3.5:3b` | Extractive bullet points |
| `passthrough` | Ollama unreachable | — | Truncate to last 20 lines, no compression |

---

## Requirements

- **OpenClaw** ≥ 2026.2.0 ([install guide](https://docs.openclaw.ai/getting-started))
- **Ollama** installed and running locally ([ollama.com](https://ollama.com))
- **Python** 3.10+ (for the FastAPI compression sidecar)

---

## Install

### 1. Install the plugin

```bash
openclaw plugins install openclaw-plugin-tokenranger
```

> To pin an exact version (recommended for production):
> ```bash
> openclaw plugins install openclaw-plugin-tokenranger@1.0.0 --pin
> ```

### 2. Run first-time setup

```bash
openclaw tokenranger setup
```

`setup` does the following automatically:

- Pulls the required Ollama models (`mistral:7b` + `phi3.5:3b`)
- Creates a Python virtualenv and installs FastAPI/LangChain deps
- Registers the TokenRanger sidecar as a system service:
  - **Linux**: `systemd` user unit (`tokenranger.service`)
  - **macOS**: `launchd` agent (`com.peterjohannmedina.tokenranger.plist`)
- Starts the sidecar on `localhost:8100`

### 3. Restart the gateway

```bash
openclaw gateway restart
```

### 4. Verify

```bash
openclaw tokenranger
```

You should see your current settings and sidecar status (reachable/unreachable).

### Manual sidecar start (if needed)

If the system service didn't register, you can start the sidecar directly:

```bash
# Linux / macOS
~/.openclaw/extensions/tokenranger/service/start.sh
```

---

## Configuration

After install, configure under `plugins.entries.tokenranger.config` in your `openclaw.json`
(edit via `openclaw config set plugins.entries.tokenranger.config.<key> <value>`):

| Key | Default | Description |
|---|---|---|
| `serviceUrl` | `http://127.0.0.1:8100` | TokenRanger FastAPI sidecar URL |
| `timeoutMs` | `10000` | Max wait per request before fallthrough |
| `minPromptLength` | `500` | Min chars of history before compressing |
| `ollamaUrl` | `http://127.0.0.1:11434` | Ollama API base URL |
| `preferredModel` | `mistral:7b` | Model used in `full` GPU strategy |
| `compressionStrategy` | `auto` | `auto` / `full` / `light` / `passthrough` |
| `inferenceMode` | `auto` | `auto` / `cpu` / `gpu` / `remote` |

**Example** — force CPU-only light mode:

```bash
openclaw config set plugins.entries.tokenranger.config.compressionStrategy light
openclaw config set plugins.entries.tokenranger.config.inferenceMode cpu
openclaw gateway restart
```

---

## Commands

| Command | Description |
|---|---|
| `/tokenranger` | Show current settings and sidecar health |
| `/tokenranger mode gpu` | Force GPU (full) compression strategy |
| `/tokenranger mode cpu` | Force CPU (light) compression strategy |
| `/tokenranger mode off` | Disable compression (passthrough) |
| `/tokenranger model` | List available Ollama models |
| `/tokenranger toggle` | Enable / disable the plugin |

---

## Upgrading

TokenRanger follows [calendar versioning](https://calver.org) (`YYYY.M.D[-patch.N]`), matching the OpenClaw release cadence.

### Check for updates

```bash
openclaw plugins update tokenranger --dry-run
```

This shows the available version without applying anything.

### Apply an update

```bash
openclaw plugins update tokenranger
openclaw tokenranger setup   # re-runs sidecar setup if service files changed
openclaw gateway restart
```

> **Note:** `setup` is idempotent — it only pulls new models or reinstalls deps if
> versions have changed. It will not wipe your existing config.

### Pin to a specific version

If you want to lock to a known-good release:

```bash
openclaw plugins install openclaw-plugin-tokenranger@2026.3.1 --pin
openclaw tokenranger setup
openclaw gateway restart
```

To see all published versions:

```bash
npm view openclaw-plugin-tokenranger versions --json
```

### After major OpenClaw upgrades

Check `CHANGELOG.md` in this repo for any breaking config key renames or sidecar API changes before upgrading TokenRanger across a major OpenClaw version bump.

---

## Uninstalling

```bash
openclaw plugins uninstall tokenranger
openclaw gateway restart
```

This removes the plugin from config and deletes its install directory. The Python sidecar and system service are left in place — to fully remove:

```bash
# Linux
systemctl --user stop tokenranger && systemctl --user disable tokenranger
rm ~/.config/systemd/user/tokenranger.service

# macOS
launchctl unload ~/Library/LaunchAgents/com.peterjohannmedina.tokenranger.plist
rm ~/Library/LaunchAgents/com.peterjohannmedina.tokenranger.plist
```

---

## Performance

5-turn Discord conversation benchmark (GPU, `mistral:7b-instruct`):

| Turn | Input tokens | Compressed | Reduction | Latency |
|---|---|---|---|---|
| 2 | 732 | 125 | 82.9% | 1,086ms |
| 3 | 1,180 | 150 | 87.3% | 1,375ms |
| 4 | 1,685 | 212 | 87.4% | 1,960ms |
| 5 | 2,028 | 277 | 86.3% | 2,420ms |

**Cumulative: 5,866 → 885 tokens (84.9% reduction), ~1.6s avg/turn.**

CPU (`phi3.5:3b-mini`) benchmarks TBD.

---

## Graceful degradation

TokenRanger never breaks your chat. At every failure point there's a silent fallthrough:

- Sidecar unreachable → passthrough (message sent to cloud LLM uncompressed)
- Ollama timeout → passthrough
- Compression returns empty string → original message used
- Plugin disabled → zero overhead, standard OpenClaw routing

---

## Contributing

Issues and PRs welcome: https://github.com/peterjohannmedina/openclaw-plugin-tokenranger

For discussion, find us in the [OpenClaw Discord](https://discord.com/invite/clawd).

### Release process (maintainers)

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the full release and versioning workflow.

---

## License

MIT — see [LICENSE](./LICENSE)
