# Changelog

All notable changes to `openclaw-plugin-tokenranger` are documented here.

Format: `## [version] — YYYY-MM-DD`  
Versions follow [CalVer](https://calver.org): `YYYY.M.D` (patch releases: `YYYY.M.D-patch.N`).

---

## [1.0.0] — 2026-02-28

Initial release. Extracted from [openclaw/openclaw#27918](https://github.com/openclaw/openclaw/pull/27918) and repackaged as a standalone community plugin per maintainer guidance.

### Features

- `before_agent_start` hook intercepts context before every cloud LLM call (skips turn 1)
- FastAPI sidecar on `localhost:8100` — LangChain LCEL compression chain via Ollama
- GPU-aware inference routing: `full` (mistral:7b) / `light` (phi3.5:3b) / `passthrough`
- `openclaw tokenranger setup` CLI command: model pull, venv, pip deps, systemd/launchd service
- `/tokenranger` slash command: status, mode override, model list, toggle
- Graceful fallthrough at every failure point — never blocks a message
- Config keys: `serviceUrl`, `timeoutMs`, `minPromptLength`, `ollamaUrl`, `preferredModel`, `compressionStrategy`, `inferenceMode`
