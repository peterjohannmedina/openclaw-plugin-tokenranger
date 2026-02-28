# openclaw-plugin-tokenranger

**TokenRanger** is a community plugin for [OpenClaw](https://openclaw.ai) that compresses session context through a local SLM (via [Ollama](https://ollama.com)) before sending to cloud LLMs — reducing input token costs by **50–80%**.

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
| `full` | GPU available | mistral:7b | Deep semantic summarization |
| `light` | CPU only | phi3.5:3b | Extractive bullet points |
| `passthrough` | Ollama unreachable | — | Truncate to last 20 lines |

## Measured results

5-turn Discord conversation benchmark (GPU-full, mistral:7b-instruct):

| Turn | Input tokens | Compressed | Reduction | Latency |
|---|---|---|---|---|
| 2 | 732 | 125 | 82.9% | 1,086ms |
| 3 | 1,180 | 150 | 87.3% | 1,375ms |
| 4 | 1,685 | 212 | 87.4% | 1,960ms |
| 5 | 2,028 | 277 | 86.3% | 2,420ms |

Cumulative: 5,866 → 885 tokens (**84.9% reduction**), 1.6s avg/turn.

## Requirements

- OpenClaw ≥ 2026.2.0
- [Ollama](https://ollama.com) installed and running locally
- Python 3.10+ (for the FastAPI compression sidecar)

## Install

```bash
openclaw plugins install openclaw-plugin-tokenranger
openclaw tokenranger setup
openclaw gateway restart
```

`setup` handles: Ollama model pull, Python venv creation, pip deps, and system service registration (systemd on Linux, launchd on macOS).

## Configuration

In `openclaw.json` under `plugins.entries.tokenranger.config`:

| Key | Default | Description |
|---|---|---|
| `serviceUrl` | `http://127.0.0.1:8100` | TokenRanger FastAPI service URL |
| `timeoutMs` | `10000` | Max wait before falling through |
| `minPromptLength` | `500` | Min history length before compressing |
| `ollamaUrl` | `http://127.0.0.1:11434` | Ollama API URL |
| `preferredModel` | `mistral:7b` | Model for full-GPU compression |
| `compressionStrategy` | `auto` | `auto` / `full` / `light` / `passthrough` |
| `inferenceMode` | `auto` | `auto` / `cpu` / `gpu` / `remote` |

## Commands

```
/tokenranger              — show current settings
/tokenranger mode gpu     — force GPU compression
/tokenranger mode cpu     — force CPU (light) compression
/tokenranger model        — list available Ollama models
/tokenranger toggle       — enable/disable plugin
```

## Graceful degradation

TokenRanger never breaks your chat. If the sidecar is down, Ollama is unreachable, or the request times out, it falls through silently and your message goes to the cloud LLM unmodified.

## License

MIT
