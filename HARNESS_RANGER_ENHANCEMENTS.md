# Harness-Ranger Pattern Enhancements for TokenRanger

This document describes how advanced patterns from `@synchronic1/harness-ranger` have been applied to enhance the TokenRanger plugin.

## Overview

The harness-ranger plugin implements sophisticated patterns from Claude Code porting workspace. These patterns have been adapted for TokenRanger to create a more intelligent, permission-aware, and metrics-driven compression system.

## Key Enhancements

### 1. **Compression Strategy Registry** (from harness-ranger's Tool Registry)

**File:** `src/compression-registry.ts`

**Pattern Applied:** Semantic matching for strategy discovery

**Features:**
- Semantic search for compression strategies
- Tag-based matching with scoring algorithm
- Context-aware strategy boosting (GPU availability, urgency)
- Extensible strategy registration system

**Usage:**
```typescript
const registry = new CompressionStrategyRegistry(config);

// Find strategies semantically
const strategies = registry.findStrategies("fast cpu compression", { hasGPU: false });
// Returns strategies sorted by relevance score

// Register custom strategy
registry.registerStrategy({
  id: 'ultra-aggressive',
  name: 'Ultra Aggressive',
  tags: ['max-compression', 'slow', 'gpu-required'],
  targetReduction: 90,
  // ...
});
```

**Benefits:**
- Intelligent strategy selection based on natural language queries
- Automatic adaptation to hardware capabilities
- Easy extension with custom strategies

---

### 2. **Compression Permission Context** (from harness-ranger's Permission Context)

**File:** `src/compression-permission.ts`

**Pattern Applied:** Permission-aware execution with rate limiting

**Features:**
- User context validation (prevents permission bypass)
- Rate limiting per user (default: 100 compressions/hour)
- Strategy allowlist/denylist support
- Token threshold requiring approval
- Admin-only mode for sensitive deployments

**Usage:**
```typescript
const permissionContext = new CompressionPermissionContext({
  maxCompressionRequestsPerHour: 50,
  requireApprovalAboveTokens: 50000,
  deniedStrategies: ['passthrough']
});

const check = permissionContext.canCompress(user, 'full', 10000);
if (!check.allowed) {
  console.log(`Denied: ${check.reason}`);
  // Handle: rate limit, approval required, etc.
}
```

**Benefits:**
- Prevents abuse through rate limiting
- Fine-grained control over who can compress what
- Audit trail of permission checks
- Prevents cost overruns from excessive compression

---

### 3. **Enhanced Context Manager** (from harness-ranger's Session Manager)

**File:** `src/enhanced-context-manager.ts`

**Pattern Applied:** Intelligent token-aware session management

**Features:**
- Compression effectiveness tracking per session
- Smart decision-making (skip if recent compression was ineffective)
- Adaptive strategy recommendation based on历史history
- Aggregate metrics across all sessions
- Automatic cleanup of old metrics

**Usage:**
```typescript
const contextManager = new EnhancedContextManager(config);

// Intelligent compression decision
if (contextManager.shouldCompress(sessionId, 5000)) {
  // Recommend best strategy based on history
  const strategy = contextManager.recommendStrategy(sessionId, { hasGPU: true });
  
  // Perform compression...
  
  // Record results for future decisions
  contextManager.recordCompression(
    sessionId,
    strategy,
    5000, // original tokens
    1200, // compressed tokens
    250,  // latency ms
    'mistral:7b'
  );
}

// Get performance metrics
const metrics = contextManager.getAggregateMetrics();
console.log(`Saved ${metrics.totalTokensSaved} tokens across ${metrics.totalSessions} sessions`);
```

**Benefits:**
- Learns from compression history
- Avoids ineffective compressions
- Prevents over-compression (respects cooldown)
- Provides ROI visibility

---

## Integration with Existing TokenRanger

### Step 1: Update index.ts to use enhanced components

```typescript
import { CompressionStrategyRegistry } from './src/compression-registry.js';
import { CompressionPermissionContext } from './src/compression-permission.js';
import { EnhancedContextManager } from './src/enhanced-context-manager.js';

const tokenRangerPlugin = {
  id: "tokenranger",
  name: "TokenRanger",
  description: "...",
  configSchema: tokenRangerConfigSchema,

  register(api: OpenClawPluginApi) {
    let cfg: TokenRangerConfig = parseConfig(api.pluginConfig);
    
    // NEW: Initialize enhanced components
    const strategyRegistry = new CompressionStrategyRegistry(cfg);
    const permissionContext = new CompressionPermissionContext({
      maxCompressionRequestsPerHour: cfg.maxRequestsPerHour || 100,
      requireApprovalAboveTokens: cfg.approvalTokenThreshold || 50000
    });
    const contextManager = new EnhancedContextManager(cfg);
    
    // ...existing compression logic with enhancements
  }
};
```

### Step 2: Enhance the compression hook

```typescript
api.on("before_agent_start", async (ctx) => {
  const sessionId = ctx.sessionId;
  const user = ctx.user;
  const tokenCount = estimateTokens(ctx.prompt + ctx.sessionHistory);

  // NEW: Check if compression should happen
  if (!contextManager.shouldCompress(sessionId, tokenCount)) {
    return; // Skip compression based on history
  }

  // NEW: Recommend strategy based on session history
  const recommendedStrategy = contextManager.recommendStrategy(sessionId, {
    hasGPU: await detectGPU(),
    urgentCompression: tokenCount > 10000
  });

  // NEW: Check permissions
  const permissionCheck = permissionContext.canCompress(
    user,
    recommendedStrategy,
    tokenCount
  );

  if (!permissionCheck.allowed) {
    api.logger.warn(`[tokenranger] Compression denied: ${permissionCheck.reason}`);
    return;
  }

  // Perform compression with recommended strategy
  const result = await compressContext({
    prompt: ctx.prompt,
    sessionHistory: ctx.sessionHistory,
    serviceUrl: cfg.serviceUrl,
    timeoutMs: cfg.timeoutMs,
    strategyOverride: recommendedStrategy
  });

  if (result) {
    // NEW: Record compression for future intelligence
    contextManager.recordCompression(
      sessionId,
      recommendedStrategy,
      tokenCount,
      estimateTokens(result.compressedContext),
      result.latencyMs,
      result.modelUsed
    );

    permissionContext.recordCompression(user.id, recommendedStrategy, tokenCount);

    ctx.prependContext = result.compressedContext;
  }
});
```

### Step 3: Add new commands for management

```typescript
api.registerCommand("tokenranger", {
  metrics: {
    description: "Show compression metrics",
    handler: () => {
      const aggregate = contextManager.getAggregateMetrics();
      return {
        sessions: aggregate.totalSessions,
        compressions: aggregate.totalCompressions,
        tokensSaved: aggregate.totalTokensSaved,
        avgReduction: `${aggregate.averageReduction.toFixed(1)}%`,
        totalTime: `${(aggregate.totalCompressionTime / 1000).toFixed(2)}s`
      };
    }
  },
  strategies: {
    description: "List available compression strategies",
    handler: () => strategyRegistry.getAllStrategies()
  },
  permissions: {
    description: "Show permission status",
    handler: (args) => ({
      checkCount: permissionContext.getCheckCount(),
      userRequests: permissionContext.getUserCompressionCount(args.userId)
    })
  }
});
```

---

## Configuration Schema Updates

Add new config options to support enhanced features:

```json
{
  "configSchema": {
    "properties": {
      // Existing options...
      
      // NEW: Permission options
      "maxRequestsPerHour": {
        "type": "number",
        "default": 100,
        "description": "Maximum compression requests per user per hour"
      },
      "approvalTokenThreshold": {
        "type": "number",
        "default": 50000,
        "description": "Require approval for compressions above this token count"
      },
      "allowedStrategies": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Whitelist of allowed compression strategies"
      },
      
      // NEW: Context management options
      "maxHistoryPerSession": {
        "type": "number",
        "default": 50,
        "description": "Number of compression events to retain per session"
      },
      "metricsRetentionDays": {
        "type": "number",
        "default": 30,
        "description": "Days to retain compression metrics"
      },
      
      // NEW: Strategy options
      "semanticMatchingThreshold": {
        "type": "number",
        "default": 0.3,
        "description": "Threshold for semantic strategy matching"
      }
    }
  }
}
```

---

## Benefits Summary

### From Tool Registry → Compression Strategy Registry
- ✅ Semantic search for strategies
- ✅ Context-aware recommendations
- ✅ Easy extensibility

### From Permission Context → Compression Authorization
- ✅ Rate limiting prevents abuse
- ✅ Cost control through approval thresholds
- ✅ Audit trail for compliance

### From Session Manager → Enhanced Context Manager
- ✅ Learning from compression history
- ✅ Intelligent skip logic
- ✅ Performance metrics and ROI visibility

---

## Migration Path

1. **Phase 1:** Add new TypeScript files (non-breaking)
2. **Phase 2:** Wire up enhanced components in `index.ts`
3. **Phase 3:** Test with existing deployments
4. **Phase 4:** Update documentation and examples
5. **Phase 5:** Add new CLI commands for metrics

---

## Testing Recommendations

```bash
# Test semantic strategy matching
curl -X POST localhost:8100/find-strategy -d '{"query":"fast cpu compression"}'

# Test permission enforcement
curl -X POST localhost:8100/compress \
  -H "X-User-Id: test-user" \
  -d '{"prompt":"..."}' # Should hit rate limit after 100 requests

# Test metrics collection
openclaw tokenranger metrics
```

---

## Next Steps

1. Implement these files in tokenranger repo
2. Update `index.ts` to integrate new components
3. Add unit tests for each new module
4. Update README.md with new features
5. Add migration guide for existing users
6. Bump version to 2026.4.0 (new feature release)

---

*Patterns adapted from `@synchronic1/harness-ranger` v0.1.0*
