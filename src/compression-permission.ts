/**
 * Compression Permission Context
 * Pattern from harness-ranger: permission-aware compression execution
 */

export interface CompressionPermissionConfig {
  maxCompressionRequestsPerHour?: number;
  allowedStrategies?: string[];
  deniedStrategies?: string[];
  requireApprovalAboveTokens?: number;
  adminOnly?: boolean;
}

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  constraints?: any;
}

export class CompressionPermissionContext {
  private config: CompressionPermissionConfig;
  private checkCount: number = 0;
  private requestHistory: Map<string, number[]> = new Map();
  private deniedStrategies: Set<string>;

  constructor(config: CompressionPermissionConfig = {}) {
    this.config = {
      maxCompressionRequestsPerHour: config.maxCompressionRequestsPerHour || 100,
      requireApprovalAboveTokens: config.requireApprovalAboveTokens || 50000,
      adminOnly: config.adminOnly || false,
      ...config
    };

    this.deniedStrategies = new Set(config.deniedStrategies || []);
  }

  /**
   * Check if compression can be executed in given context
   * Pattern from harness-ranger permission context
   */
  canCompress(user: any, strategy: string, tokenCount: number): PermissionCheck {
    this.checkCount++;

    // Check user context (prevent permission bypass)
    if (!user || !user.id) {
      return {
        allowed: false,
        reason: 'User context required for compression',
        constraints: { requiredUser: true }
      };
    }

    // Check admin-only mode
    if (this.config.adminOnly && !user.isAdmin) {
      return {
        allowed: false,
        reason: 'Compression restricted to administrators',
        constraints: { adminRequired: true }
      };
    }

    // Check if strategy is denied
    if (this.deniedStrategies.has(strategy)) {
      return {
        allowed: false,
        reason: `Compression strategy '${strategy}' is denied`,
        constraints: { deniedStrategy: strategy }
      };
    }

    // Check rate limiting
    const rateLimit = this.checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return rateLimit;
    }

    // Check token threshold requiring approval
    if (this.config.requireApprovalAboveTokens && 
        tokenCount > this.config.requireApprovalAboveTokens && 
        !user.approved) {
      return {
        allowed: false,
        reason: `Compression of ${tokenCount} tokens requires approval`,
        constraints: { 
          requiresApproval: true,
          tokenThreshold: this.config.requireApprovalAboveTokens
        }
      };
    }

    // Check allowed strategies whitelist
    if (this.config.allowedStrategies && 
        !this.config.allowedStrategies.includes(strategy)) {
      return {
        allowed: false,
        reason: `Strategy '${strategy}' not in allowlist`,
        constraints: { 
          allowedStrategies: this.config.allowedStrategies 
        }
      };
    }

    return {
      allowed: true,
      constraints: {}
    };
  }

  /**
   * Check rate limit for user
   */
  private checkRateLimit(userId: string): PermissionCheck {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    // Get request history for user
    const history = this.requestHistory.get(userId) || [];
    
    // Filter to last hour
    const recentRequests = history.filter(timestamp => timestamp > hourAgo);

    // Check limit
    if (recentRequests.length >= (this.config.maxCompressionRequestsPerHour || 100)) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${recentRequests.length} compressions in last hour`,
        constraints: {
          rateLimit: this.config.maxCompressionRequestsPerHour,
          currentCount: recentRequests.length
        }
      };
    }

    // Record this request
    recentRequests.push(now);
    this.requestHistory.set(userId, recentRequests);

    return { allowed: true };
  }

  /**
   * Record a compression execution
   */
  recordCompression(userId: string, strategy: string, tokenCount: number) {
    const now = Date.now();
    const history = this.requestHistory.get(userId) || [];
    history.push(now);
    this.requestHistory.set(userId, history);
  }

  /**
   * Get permission check count
   */
  getCheckCount(): number {
    return this.checkCount;
  }

  /**
   * Get user's compression history count
   */
  getUserCompressionCount(userId: string, since: number = Date.now() - 3600000): number {
    const history = this.requestHistory.get(userId) || [];
    return history.filter(timestamp => timestamp > since).length;
  }

  /**
   * Reset rate limits (admin function)
   */
  resetRateLimits() {
    this.requestHistory.clear();
  }
}
