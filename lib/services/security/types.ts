/**
 * Types for Security and Validation System
 * Task 012: Implement Security and Validation Systems
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

export interface RateLimitConfig {
  windowMs: number; // 시간 윈도우 (밀리초)
  maxRequests: number; // 최대 요청 수
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (userId: string, action: string) => string;
}

export interface ModerationResult {
  flagged: boolean;
  confidence: number; // 0-1
  categories: string[];
  reasons: string[];
  action: 'allow' | 'warn' | 'block' | 'review';
}

export interface SecurityEvent {
  type: string;
  userId?: string;
  action: string;
  resource?: string;
  details: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export interface PermissionCheck {
  userId: string;
  action: string;
  resource?: string;
  context?: any;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
  requiredPermissions?: string[];
}

export interface SecurityConfig {
  rateLimits: { [action: string]: RateLimitConfig };
  enableContentModeration: boolean;
  enableAuditLogging: boolean;
  strictMode: boolean;
  trustedIps: string[];
  blockedIps: string[];
}

export interface ImageGenerationSecurity {
  validateRequest(userId: string, messageId: string): Promise<ValidationResult>;
  checkRateLimit(userId: string, action: string): Promise<RateLimitResult>;
  moderatePrompt(prompt: string): Promise<ModerationResult>;
  moderateImage(imageUrl: string): Promise<ModerationResult>;
  checkPermissions(check: PermissionCheck): Promise<PermissionResult>;
  logSecurityEvent(event: SecurityEvent): Promise<void>;
}
