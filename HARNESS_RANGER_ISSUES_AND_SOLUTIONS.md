# HarnessRanger Plugin — Issues & Solutions for ClawBaby Deployment

**Date:** Wed 2026-04-01  
**Final Version:** v0.3.1  
**Tested On:** vm104 (CaClaw), pvet630 (OpenClaw v2026.4.1)  
**Status:** ✅ Production Ready for ClawBaby

---

## Executive Summary

HarnessRanger went through **3 major issues** that required architectural changes and deep analysis of OpenClaw's plugin system. All issues have been resolved in v0.3.1, which is now ready for deployment on ClawBaby.

---

## Issue #1: OpenClaw v2026.3.28+ Plugin Discovery Failure

### Problem
- **Error:** `plugins: plugin: plugin manifest requires configSchema`
- **Impact:** `openclaw plugins install` command rejected the plugin
- **Root Cause:** OpenClaw's validator was strict about configSchema format and placement

### What Didn't Work (v0.1.0-0.1.8)
- Had configSchema in both `package.json` and `openclaw.plugin.json`
- Both manifests had correct structure
- Yet OpenClaw validator kept rejecting with cryptic error message
- **Root Issue:** The validator was looking for something specific we weren't providing

### Solution Applied
**v0.2.0:**
- Synced version numbers across all files (package.json = openclaw.plugin.json = 0.2.0)
- Ensured configSchema had `"required": []` array
- Still had issues with plugin discovery

**v0.3.0 (Opus Major Refactor):**
- **Fundamental fix:** Changed entire plugin architecture
- Plugin was being exported as a **class** (wrong):
  ```javascript
  // WRONG - v0.1.x pattern
  class EnhancedHarnessPlugin { ... }
  export default EnhancedHarnessPlugin;
  ```
- OpenClaw expects a **plugin definition object** (correct):
  ```javascript
  // CORRECT - v0.3.0 pattern
  const harnessRangerPlugin = {
    id: 'harness-ranger',
    name: 'HarnessRanger',
    register(api) { ... }
  }
  export default harnessRangerPlugin;
  ```

**Impact:** This fundamental architectural change made the plugin discoverable by OpenClaw's loader.

---

## Issue #2: Class Constructor Error on pvet630

### Problem
- **Error:** `TypeError: Class constructor EnhancedHarnessPlugin cannot be invoked without 'new'`
- **Impact:** Plugin failed to initialize despite successful download
- **Affected:** pvet630 (but not vm104)

### Root Cause Analysis
**Investigation revealed:**
- Published v0.3.0 tarball was **correct** (object-based code)
- pvet630 was loading from **old cache** with hash suffix path:
  ```
  /home/rm/.openclaw/extensions/@synchronic1-harness-ranger-e9c6287983/index.js
  ↑ Hash suffix indicates cached old version
  ```
- vm104 installed cleanly to:
  ```
  /home/rm/.openclaw/extensions/harness-ranger/
  ↑ Clean path, no hash suffix
  ```

### Solution Applied
```bash
# Step 1: Remove cached old installation
rm -rf ~/.openclaw/extensions/@synchronic1-harness-ranger-*

# Step 2: Clear npm cache
npm cache clean --force

# Step 3: Reinstall from fresh cache
openclaw plugins install @synchronic1/harness-ranger@0.3.0

# Step 4: Restart gateway
openclaw gateway restart
```

**Why this worked:** Removed the old class-based version and forced npm/OpenClaw to download fresh object-based code.

**Learning:** Hash-suffixed plugin directories indicate cache issues; always clean before troubleshooting.

---

## Issue #3: Hook Pack Installation Confusion (v0.3.0)

### Problem
- **Error:** `Also not a valid hook pack: Error: package.json missing openclaw.hooks`
- **Error:** `plugin already exists: /home/rm/.openclaw/extensions/harness-ranger (delete it first)`
- **Impact:** pvet630 second install attempt failed with conflicting errors
- **Root Cause:** OpenClaw installer misidentified plugin as hook pack

### Technical Analysis

**Hook Pack vs Plugin Detection:**
- OpenClaw has TWO extension types:
  1. **Plugins:** `"openclaw": { "extensions": [...] }`
  2. **Hook Packs:** `"openclaw": { "hooks": [...] }`

**What Happened:**
- v0.3.0 had only `extensions` field
- OpenClaw installer checked for hooks field
- When it didn't find `hooks`, installer assumed it was invalid hook pack
- Error message: "missing openclaw.hooks" (misleading — it's not supposed to be a hook pack!)

### Solution Applied (v0.3.1)
```json
{
  "openclaw": {
    "extensions": ["./index.js"],
    "hooks": []              // ← Added empty array
  }
}
```

**Why this works:**
- Empty `hooks: []` signals: "This is a plugin, not a hook pack"
- OpenClaw installer now correctly identifies as plugin-only
- No more hook pack detection error

**Key Learning:** OpenClaw expects both fields when using extensions; even an empty hooks array clarifies intent.

---

## Issue #4: Hook Registration Naming Convention (v0.1.x - v0.2.x)

### Problem
- **Initial Design:** Used `beforeToolExecution` and `afterToolExecution` hook names
- **Reality:** OpenClaw uses different hook naming convention
- **Impact:** Hooks would never fire because OpenClaw doesn't recognize those names

### Root Cause
Early versions misunderstood OpenClaw's event bus API:
```javascript
// WRONG - used invalid hook names
hooks: {
  "beforeToolExecution": "beforeToolExecution",
  "afterToolExecution": "afterToolExecution"
}

// AND registered in wrong place (in constructor)
class EnhancedHarnessPlugin {
  constructor() {
    // Can't register hooks here - no api object
  }
}
```

### Solution Applied (v0.3.0)
```javascript
// CORRECT - use OpenClaw event names and register via api
register(api) {
  api.on('before_tool_execution', async (event, ctx) => {
    // Hook fires here with correct event structure
  });
  
  api.on('after_tool_execution', async (event, ctx) => {
    // Hook fires here
  });
}
```

**What Changed:**
1. Hook names: `beforeToolExecution` → `before_tool_execution` (snake_case)
2. Registration point: Constructor → `register(api)` function
3. API access: Class methods → `api` parameter in register function

---

## Issue #5: Manifest Structure (configSchema)

### Problem
- **Initial:** configSchema in both package.json AND openclaw.plugin.json with redundancy
- **Confusing:** Some fields duplicated, some only in one place
- **Risk:** Version mismatches between files

### Solution Applied (v0.3.0)
**Simplified structure:**

**package.json:**
```json
{
  "openclaw": {
    "extensions": ["./index.js"],
    "hooks": []
  }
}
```

**openclaw.plugin.json:**
```json
{
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": { ... }
  },
  "uiHints": { ... }
}
```

**Why this works:**
- `package.json` identifies entry point and type (plugin vs hook)
- `openclaw.plugin.json` contains full metadata and config schema
- No duplication, no version confusion
- `additionalProperties: false` enables strict schema validation

---

## Complete Version History & Progression

| Version | Key Change | Status | Issue |
|---------|-----------|--------|-------|
| 0.1.0   | Initial release | ❌ Fails | Class-based export |
| 0.1.1-0.1.8 | Incremental fixes | ❌ Fails | Plugin not discoverable |
| 0.2.0   | Version sync fix | ⚠️ Partially Works | Still class-based |
| 0.3.0   | **Opus Major Refactor** | ✅ Works on vm104 | Pvet630 cache issue |
| 0.3.1   | Hook pack clarification | ✅ **Production Ready** | **None** |

---

## Deployment Checklist for ClawBaby

### Pre-Installation
- [ ] ClawBaby has Node 20+ installed
- [ ] npm is available (`npm --version`)
- [ ] OpenClaw gateway running (`openclaw gateway status`)
- [ ] No existing harness-ranger installation (`ls ~/.openclaw/extensions/harness-ranger`)

### Installation
```bash
# 1. Clean cache (if upgrading from older version)
npm cache clean --force
rm -rf ~/.openclaw/extensions/harness-ranger
rm -rf ~/.openclaw/extensions/@synchronic1-harness-ranger-*

# 2. Install v0.3.1
openclaw plugins install @synchronic1/harness-ranger@0.3.1

# 3. Restart gateway
openclaw gateway restart

# 4. Verify
openclaw logs --follow | grep "harness-ranger"
```

### Success Verification
✅ Should see:
```
[plugins] [harness-ranger] Initialized (maxTurns=12, budget=4000, compact=16, threshold=0.6)
```

❌ Should NOT see:
- `TypeError: Class constructor`
- `missing openclaw.hooks`
- `plugin not found`

---

## Architecture Decisions & Trade-offs

### Decision 1: Object vs Class Export
- **Chosen:** Object definition with `register(api)`
- **Reason:** OpenClaw plugin loader expects this pattern
- **Trade-off:** Not using ES6 class inheritance, but cleaner plugin boundary

### Decision 2: Empty hooks Array
- **Chosen:** `"hooks": []` in package.json
- **Reason:** Disambiguates from hook packs
- **Trade-off:** Slight redundancy, but prevents installer confusion

### Decision 3: Separate Manifests
- **Chosen:** `package.json` + `openclaw.plugin.json`
- **Reason:** npm package vs OpenClaw plugin metadata are different concerns
- **Trade-off:** Two files to maintain, but clearer separation

### Decision 4: Strict Schema Validation
- **Chosen:** `additionalProperties: false` in configSchema
- **Reason:** Catch config errors early
- **Trade-off:** More restrictive, but safer in production

---

## Known Limitations & Future Work

### v0.3.1 (Current)
- ✅ Plugin discovery and installation
- ✅ Hook registration and firing
- ✅ Session management (basic)
- ✅ Permission context (basic)
- ✅ Tool registry with semantic matching

### v0.4 (Planned)
- [ ] Unit tests (0% coverage currently)
- [ ] Installation validation tests
- [ ] Configuration profile examples

### v0.5+ (Future)
- [ ] Rate limiting (TODO since v0.1)
- [ ] Session eviction (LRU) for 1000+ sessions
- [ ] Persistent session storage
- [ ] Distributed state for multi-instance

---

## Troubleshooting Guide for ClawBaby

### Symptom: "Class constructor cannot be invoked without 'new'"
**Cause:** Cached old version  
**Fix:**
```bash
npm cache clean --force
rm -rf ~/.openclaw/extensions/@synchronic1-harness-ranger-*
openclaw plugins install @synchronic1/harness-ranger@0.3.1
openclaw gateway restart
```

### Symptom: "missing openclaw.hooks"
**Cause:** Old v0.3.0 installed (before hooks fix)  
**Fix:**
```bash
rm -rf ~/.openclaw/extensions/harness-ranger
openclaw plugins install @synchronic1/harness-ranger@0.3.1
```

### Symptom: "plugin not found: harness-ranger"
**Cause:** Stale config entries  
**Fix:**
```bash
# Edit ~/.openclaw/openclaw.json
# Remove harness-ranger from plugins.allow if present
# Reinstall: openclaw plugins install @synchronic1/harness-ranger@0.3.1
```

### Symptom: Gateway won't restart after install
**Cause:** Config file corruption  
**Fix:**
```bash
# Restore backup
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
openclaw gateway restart
# Then reinstall
openclaw plugins install @synchronic1/harness-ranger@0.3.1
```

---

## Key Learnings for Plugin Development

### 1. OpenClaw Plugin Contract is Strict
- Must export object with `id`, `name`, `register(api)`
- Cannot use class-based pattern (despite ES6 class syntax being available)
- Hook names must match exactly (snake_case, not camelCase)

### 2. Manifest Metadata Matters
- `package.json` drives npm/discovery
- `openclaw.plugin.json` drives OpenClaw loader
- Both must be in sync but serve different purposes
- Empty arrays (like `hooks: []`) clarify intent

### 3. Cache Issues Are Real
- npm and OpenClaw both cache packages
- Hash-suffixed directory paths indicate stale cache
- Always `npm cache clean --force` when upgrading
- Backup old installations before reinstalling

### 4. Error Messages Can Be Misleading
- "missing openclaw.hooks" doesn't mean you need hooks
- "plugin not found" may mean stale config, not missing plugin
- Always check actual error source (logs, manifest, cache)

### 5. Configuration Schema Validation
- `additionalProperties: false` catches typos early
- `required: []` array is important (even if empty)
- Schema validation happens BEFORE register() is called
- Invalid schema will prevent initialization

---

## Links & References

**NPM Package:** https://www.npmjs.com/package/@synchronic1/harness-ranger  
**GitHub Repo:** https://github.com/synchronic1/enhanced-harness-plugin  
**OpenClaw Docs:** https://docs.openclaw.ai  

**Key Files:**
- `index.js` — Plugin definition object with register(api)
- `package.json` — npm metadata with openclaw.extensions/hooks
- `openclaw.plugin.json` — OpenClaw manifest with configSchema
- `src/` — Subsystem implementations (tool-registry, permission-context, session-manager, streaming-responses)

---

## Conclusion

HarnessRanger v0.3.1 represents a complete architectural overhaul to align with OpenClaw's strict plugin contract. The journey from class-based export → plugin definition object revealed deep insights about OpenClaw's design philosophy:

1. **Plugin loader expects objects, not classes** — Clean factory pattern
2. **Hook naming is important** — Event bus uses snake_case conventions
3. **Manifests serve different purposes** — package.json for npm, openclaw.plugin.json for loader
4. **Schema validation is early** — configSchema checked before register() runs
5. **Cache can hide issues** — Always clean when troubleshooting

**For ClawBaby deployment, v0.3.1 is battle-tested on vm104 and pvet630. No further architectural changes anticipated.**

---

**Status:** ✅ Production Ready  
**Version:** v0.3.1  
**Last Updated:** 2026-04-01 14:24 PDT  
**Next Review:** After ClawBaby deployment
