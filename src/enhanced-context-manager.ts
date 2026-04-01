/**
 * Enhanced Context Manager for TokenRanger
 * Pattern from harness-ranger: intelligent token-aware session management
 */

export interface SessionMetrics {
  totalCompressions: number;
  totalTokensSaved: number;
  totalCompressionTime: number;
  averageReduction: number;
  lastCompression: number;
}

export interface CompressionHistoryEntry {
  timestamp: number;
  strategy: string;
  originalTokens: number;
  compressedTokens: number;
  reduction: number;
  latencyMs: number;
  model: string;
}

export class EnhancedContextManager {
  private sessions: Map<string, SessionMetrics> = new Map();
  private compressionHistory: Map<string, CompressionHistoryEntry[]> = new Map();
  private config: any;

  constructor(config: any = {}) {
    this.config = {
      maxHistoryPerSession: config.maxHistoryPerSession || 50,
      metricsRetentionDays: config.metricsRetentionDays || 30,
      ...config
    };
  }

  /**
   * Should this session be compressed?
   * Intelligent decision based on history and patterns
   */
  shouldCompress(sessionId: string, currentTokenCount: number): boolean {
    const metrics = this.sessions.get(sessionId);
    
    // First-time compression check
    if (!metrics) {
      return currentTokenCount > (this.config.minPromptLength || 500);
    }

    // If recent compression showed poor results, skip
    const history = this.compressionHistory.get(sessionId) || [];
    const lastCompression = history[history.length - 1];
    
    if (lastCompression) {
      // Skip if last compression was < 20% effective
      if (lastCompression.reduction < 20) {
        return false;
      }

      // Skip if last compression was < 5 min ago
      const fiveMinAgo = Date.now() - (5 * 60 * 1000);
      if (lastCompression.timestamp > fiveMinAgo) {
        return false;
      }
    }

    // Compress if we're over threshold
    return currentTokenCount > (this.config.minPromptLength || 500);
  }

  /**
   * Record a compression event
   */
  recordCompression(
    sessionId: string,
    strategy: string,
    originalTokens: number,
    compressedTokens: number,
    latencyMs: number,
    model: string
  ) {
    // Update session metrics
    const metrics = this.sessions.get(sessionId) || {
      totalCompressions: 0,
      totalTokensSaved: 0,
      totalCompressionTime: 0,
      averageReduction: 0,
      lastCompression: 0
    };

    const tokensSaved = originalTokens - compressedTokens;
    const reduction = ((tokensSaved / originalTokens) * 100);

    metrics.totalCompressions++;
    metrics.totalTokensSaved += tokensSaved;
    metrics.totalCompressionTime += latencyMs;
    metrics.averageReduction = 
      (metrics.averageReduction * (metrics.totalCompressions - 1) + reduction) / 
      metrics.totalCompressions;
    metrics.lastCompression = Date.now();

    this.sessions.set(sessionId, metrics);

    // Add to compression history
    const history = this.compressionHistory.get(sessionId) || [];
    history.push({
      timestamp: Date.now(),
      strategy,
      originalTokens,
      compressedTokens,
      reduction,
      latencyMs,
      model
    });

    // Trim history if needed
    if (history.length > this.config.maxHistoryPerSession) {
      history.shift();
    }

    this.compressionHistory.set(sessionId, history);
  }

  /**
   * Get metrics for a session
   */
  getSessionMetrics(sessionId: string): SessionMetrics | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get compression history for a session
   */
  getCompressionHistory(sessionId: string): CompressionHistoryEntry[] {
    return this.compressionHistory.get(sessionId) || [];
  }

  /**
   * Get aggregate metrics across all sessions
   */
  getAggregateMetrics(): {
    totalSessions: number;
    totalCompressions: number;
    totalTokensSaved: number;
    averageReduction: number;
    totalCompressionTime: number;
  } {
    let totalCompressions = 0;
    let totalTokensSaved = 0;
    let totalCompressionTime = 0;
    let weightedReduction = 0;

    for (const metrics of this.sessions.values()) {
      totalCompressions += metrics.totalCompressions;
      totalTokensSaved += metrics.totalTokensSaved;
      totalCompressionTime += metrics.totalCompressionTime;
      weightedReduction += metrics.averageReduction * metrics.totalCompressions;
    }

    return {
      totalSessions: this.sessions.size,
      totalCompressions,
      totalTokensSaved,
      averageReduction: totalCompressions > 0 ? weightedReduction / totalCompressions : 0,
      totalCompressionTime
    };
  }

  /**
   * Recommend strategy based on session history
   * Smart adaptive compression
   */
  recommendStrategy(sessionId: string, context: any): string {
    const history = this.compressionHistory.get(sessionId) || [];
    
    if (history.length === 0) {
      return context.hasGPU ? 'full' : 'light';
    }

    // Calculate average reduction per strategy
    const strategyPerformance = new Map<string, { avgReduction: number, count: number }>();
    
    for (const entry of history.slice(-10)) {
      const perf = strategyPerformance.get(entry.strategy) || { avgReduction: 0, count: 0 };
      perf.avgReduction = (perf.avgReduction * perf.count + entry.reduction) / (perf.count + 1);
      perf.count++;
      strategyPerformance.set(entry.strategy, perf);
    }

    // Find best-performing strategy
    let bestStrategy = 'auto';
    let bestReduction = 0;

    for (const [strategy, perf] of strategyPerformance) {
      if (perf.avgReduction > bestReduction) {
        bestReduction = perf.avgReduction;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    for (const [sessionId, metrics] of this.sessions) {
      if (metrics.lastCompression < cutoff) {
        this.sessions.delete(sessionId);
        this.compressionHistory.delete(sessionId);
      }
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
