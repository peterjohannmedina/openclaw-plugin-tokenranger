# HarnessRanger v0.3.1 — ClawBaby Quick Reference

## Installation (One-Liner)
```bash
openclaw plugins install @synchronic1/harness-ranger@0.3.1 && openclaw gateway restart
```

## Success Indicator
```
[plugins] [harness-ranger] Initialized (maxTurns=12, budget=4000, compact=16, threshold=0.6)
```

## If It Fails

### Error: "Class constructor cannot be invoked without 'new'"
```bash
npm cache clean --force && rm -rf ~/.openclaw/extensions/@synchronic1-harness-ranger-* && openclaw plugins install @synchronic1/harness-ranger@0.3.1 && openclaw gateway restart
```

### Error: "missing openclaw.hooks"
```bash
rm -rf ~/.openclaw/extensions/harness-ranger && openclaw plugins install @synchronic1/harness-ranger@0.3.1 && openclaw gateway restart
```

### Error: "plugin not found"
```bash
# Restore backup config
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json
# Reinstall
openclaw plugins install @synchronic1/harness-ranger@0.3.1 && openclaw gateway restart
```

## What It Does

- **Tool Registry:** Semantic matching for tool discovery
- **Permission Context:** Access control + deny-list management
- **Session Management:** Token budgeting + auto-compaction
- **Streaming:** Structured response pipeline

## Configuration (defaults fine)

```json
{
  "maxContextTurns": 12,           // Turns to keep in context
  "maxBudgetTokens": 4000,         // Token budget per session
  "compactAfterTurns": 16,         // When to compact
  "semanticMatchingThreshold": 0.6 // Tool matching sensitivity (0.0-1.0)
}
```

## Key Fixes v0.1 → v0.3.1

1. **Plugin Export:** Class → Object definition
2. **Hook Names:** `beforeToolExecution` → `before_tool_execution`
3. **Hook Registration:** Constructor → `register(api)` function
4. **Manifest:** Added `"hooks": []` to prevent hook pack confusion
5. **Config Schema:** Simplified, added UI hints, strict validation

## Support

- **NPM:** https://www.npmjs.com/package/@synchronic1/harness-ranger
- **GitHub:** https://github.com/synchronic1/enhanced-harness-plugin
- **Full Docs:** HARNESS_RANGER_ISSUES_AND_SOLUTIONS.md (this folder)

## Version Status

- ✅ v0.3.1: Production ready (CURRENT)
- ✅ v0.3.0: Works on vm104 (has pvet630 cache issue)
- ❌ v0.2.0: Has hook pack confusion
- ❌ v0.1.x: Has class constructor error

**For ClawBaby: Use v0.3.1**
