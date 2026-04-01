/**
 * Enhanced Compression Strategy Registry
 * Pattern from harness-ranger: semantic matching for compression strategies
 */

export interface CompressionStrategy {
  id: string;
  name: string;
  description: string;
  tags: string[];
  minPromptLength: number;
  targetReduction: number;
  costTokens: number;
  model: string;
  category: 'aggressive' | 'balanced' | 'conservative' | 'passthrough';
  permission: 'user' | 'admin' | 'auto';
}

export class CompressionStrategyRegistry {
  private strategies: Map<string, CompressionStrategy> = new Map();
  private config: any;

  constructor(config: any = {}) {
    this.config = config;
    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default compression strategies
   */
  private initializeDefaultStrategies() {
    this.registerStrategy({
      id: 'auto',
      name: 'Auto',
      description: 'Automatically select strategy based on GPU availability',
      tags: ['auto', 'adaptive', 'smart'],
      minPromptLength: 500,
      targetReduction: 60,
      costTokens: 10,
      model: 'auto',
      category: 'balanced',
      permission: 'user'
    });

    this.registerStrategy({
      id: 'full',
      name: 'Full Compression',
      description: 'Aggressive compression using larger SLM (GPU-accelerated)',
      tags: ['aggressive', 'gpu', 'max-reduction'],
      minPromptLength: 1000,
      targetReduction: 80,
      costTokens: 50,
      model: 'mistral:7b',
      category: 'aggressive',
      permission: 'user'
    });

    this.registerStrategy({
      id: 'light',
      name: 'Light Compression',
      description: 'Fast compression using small SLM (CPU-friendly)',
      tags: ['fast', 'cpu', 'balanced'],
      minPromptLength: 500,
      targetReduction: 50,
      costTokens: 5,
      model: 'phi3.5:3b',
      category: 'conservative',
      permission: 'user'
    });

    this.registerStrategy({
      id: 'passthrough',
      name: 'Passthrough',
      description: 'No compression, direct pass to cloud LLM',
      tags: ['none', 'bypass', 'direct'],
      minPromptLength: 0,
      targetReduction: 0,
      costTokens: 0,
      model: 'none',
      category: 'passthrough',
      permission: 'admin'
    });
  }

  /**
   * Register a custom compression strategy
   */
  registerStrategy(strategy: CompressionStrategy) {
    this.strategies.set(strategy.id, strategy);
    return strategy.id;
  }

  /**
   * Find strategies matching a query using semantic matching
   * Pattern from harness-ranger tool registry
   */
  findStrategies(query: string, context: any = {}): Array<CompressionStrategy & { score: number }> {
    const results: Array<CompressionStrategy & { score: number }> = [];
    const tokens = this.tokenizeQuery(query);

    for (const [id, strategy] of this.strategies) {
      const score = this.scoreMatch(tokens, strategy, context);

      if (score > (this.config.semanticMatchingThreshold || 0.3)) {
        results.push({ ...strategy, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Tokenize query for semantic matching
   */
  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  /**
   * Score a strategy against query tokens
   */
  private scoreMatch(tokens: string[], strategy: CompressionStrategy, context: any): number {
    let score = 0;

    // Name matching
    const nameLower = strategy.name.toLowerCase();
    for (const token of tokens) {
      if (nameLower.includes(token)) {
        score += 0.4;
      }
    }

    // Description matching
    const descLower = strategy.description.toLowerCase();
    for (const token of tokens) {
      if (descLower.includes(token)) {
        score += 0.2;
      }
    }

    // Tag matching
    for (const tag of strategy.tags) {
      for (const token of tokens) {
        if (tag.toLowerCase().includes(token)) {
          score += 0.3;
        }
      }
    }

    // Context-based boosting
    if (context.hasGPU && strategy.category === 'aggressive') {
      score += 0.2;
    }
    if (!context.hasGPU && strategy.category === 'conservative') {
      score += 0.2;
    }
    if (context.urgentCompression && strategy.id === 'light') {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get strategy by ID
   */
  getStrategy(id: string): CompressionStrategy | undefined {
    return this.strategies.get(id);
  }

  /**
   * Get all strategies
   */
  getAllStrategies(): CompressionStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get strategy count
   */
  getStrategyCount(): number {
    return this.strategies.size;
  }
}
