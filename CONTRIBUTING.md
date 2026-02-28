# Contributing to openclaw-plugin-tokenranger

## Development setup

```bash
git clone https://github.com/peterjohannmedina/openclaw-plugin-tokenranger
cd openclaw-plugin-tokenranger
npm install
```

To test against a live OpenClaw install, use the `--link` flag:

```bash
openclaw plugins install -l /path/to/openclaw-plugin-tokenranger
openclaw tokenranger setup
openclaw gateway restart
```

The gateway loads the plugin directly from your local directory — no publish needed during development.

## Versioning

TokenRanger uses **CalVer**: `YYYY.M.D` (e.g. `2026.3.1`).  
For same-day patch releases: `YYYY.M.D-patch.N` (e.g. `2026.3.1-patch.1`).

Versions must stay compatible with the OpenClaw `peerDependencies` range declared in `package.json`. When OpenClaw ships a breaking plugin API change, bump the range and note it in `CHANGELOG.md`.

## Release process

### 1. Update version and changelog

Edit `package.json` — bump `version` to `YYYY.M.D`.

Add a section to `CHANGELOG.md`:

```md
## [YYYY.M.D] — YYYY-MM-DD

### Changes
- …

### Fixes
- …
```

### 2. Commit and tag

```bash
git add package.json CHANGELOG.md
git commit -m "release: YYYY.M.D"
git tag vYYYY.M.D
git push origin main --tags
```

### 3. Publish to npm

```bash
npm publish --access public
```

Verify:

```bash
npm view openclaw-plugin-tokenranger version
```

### 4. Create a GitHub release

```bash
gh release create vYYYY.M.D \
  --title "openclaw-plugin-tokenranger YYYY.M.D" \
  --notes-file <(sed -n '/## \[YYYY.M.D\]/,/## \[/p' CHANGELOG.md | head -n -1)
```

### 5. Announce (optional)

Post in the [OpenClaw Discord](https://discord.com/invite/clawd) `#plugins` channel.

## Sidecar versioning

The Python FastAPI sidecar (`service/`) has its own deps in `service/requirements.txt`.  
When sidecar API contracts change (request/response shape), bump the sidecar version in `service/config.py` and document the change under a `### Sidecar` sub-section in `CHANGELOG.md`. The `setup` command detects version mismatches and re-installs automatically.

## Compatibility matrix

| TokenRanger | OpenClaw | Notes |
|---|---|---|
| 1.0.x | ≥ 2026.2.0 | Initial release |

Update this table when `peerDependencies` change.
