/**
 * Structured Logger
 * Task 014: Monitoring and Logging Systems - Logging Infrastructure
 * 
 * Features:
 * - JSON format structured logs
 * - Traceable request IDs (correlation ID)
 * - User privacy protection (PII masking)
 * - Log level filtering (DEBUG, INFO, WARN, ERROR)
 * - Context-aware logging for image generation
 */

interface LogContext {
  userId?: string;
  sessionId?: string;
  messageId?: string;
  correlationId?: string;
  requestId?: string;
  operation?: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

interface LogEvent {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  service: 'image-generation' | 'chat' | 'auth' | 'quota' | 'system';
  operation: string;
  message: string;
  duration?: number;
  
  // Context information
  userId?: string;
  sessionId?: string;
  messageId?: string;
  correlationId?: string;
  requestId?: string;
  
  // Technical details
  statusCode?: number;
  errorCode?: string;
  retryCount?: number;
  
  // Performance metrics
  processingTime?: number;
  networkLatency?: number;
  cacheHit?: boolean;
  queueLength?: number;
  
  // Business metrics
  quotaUsed?: number;
  quotaRemaining?: number;
  subscriptionType?: string;
  
  // Security and compliance
  sensitive?: boolean;
  
  // Additional metadata
  metadata?: Record<string, any>;
  
  // Stack trace for errors
  stack?: string;
  
  // Environment info
  environment?: string;
  version?: string;
}

interface ImageGenerationContext extends LogContext {
  presetId?: string;
  promptLength?: number;
  qualityLevel?: string;
  hasStyleOverride?: boolean;
  cacheKey?: string;
  priority?: string;
}

interface QuotaUsageEvent {
  userId: string;
  quotaType: 'image_generation' | 'chat_messages' | 'api_calls';
  action: 'check' | 'consume' | 'reset' | 'upgrade';
  usedCount: number;
  limitCount: number;
  remainingCount: number;
  isLimitExceeded: boolean;
  subscriptionType: string;
  correlationId?: string;
}

/**
 * PII Masker
 * Handles masking of personally identifiable information
 */
class PIIMasker {
  private readonly emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private readonly phoneRegex = /\b\d{3}-?\d{3}-?\d{4}\b/g;
  private readonly ipRegex = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
  
  /**
   * 사용자 ID 마스킹
   */
  maskUserId(userId?: string): string | undefined {
    if (!userId) return undefined;
    if (userId.length <= 8) return userId.slice(0, 4) + '****';
    return userId.slice(0, 4) + '****' + userId.slice(-4);
  }

  /**
   * 이메일 주소 마스킹
   */
  maskEmail(email: string): string {
    return email.replace(/(.{2})(.*)(@.*)/, '$1****$3');
  }

  /**
   * IP 주소 마스킹
   */
  maskIpAddress(ip?: string): string | undefined {
    if (!ip) return undefined;
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***.***`;
    }
    return '***.***.***';
  }

  /**
   * 일반 텍스트에서 PII 마스킹
   */
  maskTextContent(text: string): string {
    return text
      .replace(this.emailRegex, (match) => this.maskEmail(match))
      .replace(this.phoneRegex, '***-***-****')
      .replace(this.ipRegex, '***.***.***.***');
  }

  /**
   * 프롬프트 내용 마스킹 (사용자 입력 보호)
   */
  maskPromptContent(prompt: string): string {
    if (prompt.length <= 20) {
      return prompt.slice(0, 10) + '...';
    }
    return prompt.slice(0, 20) + '...[' + (prompt.length - 20) + ' chars]';
  }

  /**
   * 사용자 에이전트 마스킹
   */
  maskUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    // 브라우저 정보는 유지하되 세부 버전 정보 마스킹
    return userAgent.replace(/\d+\.\d+\.\d+/g, 'x.x.x');
  }
}

/**
 * Log Transport
 * Handles the actual logging output (console, file, external service)
 */
class LogTransport {
  private readonly environment: string;
  private readonly enableFileLogging: boolean;
  private readonly enableConsoleLogging: boolean;
  private readonly logBuffer: LogEvent[] = [];
  private readonly maxBufferSize = 1000;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    this.enableConsoleLogging = this.environment === 'development' || process.env.ENABLE_CONSOLE_LOGGING === 'true';
  }

  /**
   * 로그 이벤트 전송
   */
  async send(event: LogEvent): Promise<void> {
    // 버퍼에 추가
    this.addToBuffer(event);

    // 콘솔 출력
    if (this.enableConsoleLogging) {
      this.logToConsole(event);
    }

    // 파일 로깅 (향후 구현)
    if (this.enableFileLogging) {
      await this.logToFile(event);
    }

    // 외부 로깅 서비스 (향후 구현)
    if (this.shouldSendToExternalService(event)) {
      await this.sendToExternalService(event);
    }
  }

  /**
   * 콘솔 로깅
   */
  private logToConsole(event: LogEvent): void {
    const coloredLevel = this.getColoredLevel(event.level);
    const timestamp = new Date(event.timestamp).toISOString();
    
    if (event.level === 'ERROR' && event.stack) {
      console.error(`${timestamp} ${coloredLevel} [${event.service}:${event.operation}] ${event.message}`);
      console.error('Stack trace:', event.stack);
      if (event.metadata) {
        console.error('Metadata:', JSON.stringify(event.metadata, null, 2));
      }
    } else if (event.level === 'WARN') {
      console.warn(`${timestamp} ${coloredLevel} [${event.service}:${event.operation}] ${event.message}`);
      if (event.metadata) {
        console.warn('Context:', JSON.stringify(event.metadata, null, 2));
      }
    } else if (event.level === 'DEBUG') {
      console.debug(`${timestamp} ${coloredLevel} [${event.service}:${event.operation}] ${event.message}`);
    } else {
      console.log(`${timestamp} ${coloredLevel} [${event.service}:${event.operation}] ${event.message}`);
    }
  }

  /**
   * 레벨별 색상 적용
   */
  private getColoredLevel(level: string): string {
    switch (level) {
      case 'ERROR': return '\x1b[31mERROR\x1b[0m';  // Red
      case 'WARN':  return '\x1b[33mWARN\x1b[0m';   // Yellow
      case 'INFO':  return '\x1b[32mINFO\x1b[0m';   // Green
      case 'DEBUG': return '\x1b[36mDEBUG\x1b[0m';  // Cyan
      default:      return level;
    }
  }

  /**
   * 파일 로깅 (향후 구현)
   */
  private async logToFile(event: LogEvent): Promise<void> {
    // 실제 구현에서는 파일 시스템에 로그 저장
    // 로그 로테이션, 압축 등 고려
    console.log('📄 File logging not implemented yet');
  }

  /**
   * 외부 서비스 전송 여부 결정
   */
  private shouldSendToExternalService(event: LogEvent): boolean {
    // ERROR 레벨이거나 중요한 비즈니스 이벤트는 외부 서비스로 전송
    return event.level === 'ERROR' || 
           event.operation.includes('quota_exceeded') ||
           event.operation.includes('security_alert');
  }

  /**
   * 외부 로깅 서비스 전송 (향후 구현)
   */
  private async sendToExternalService(event: LogEvent): Promise<void> {
    try {
      // DataDog, Splunk, ELK Stack 등으로 전송
      console.log('📡 External logging service not configured');
    } catch (error) {
      console.error('Failed to send log to external service:', error);
    }
  }

  /**
   * 버퍼에 로그 추가
   */
  private addToBuffer(event: LogEvent): void {
    this.logBuffer.push(event);
    
    // 버퍼 크기 관리
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // 가장 오래된 로그 제거
    }
  }

  /**
   * 버퍼된 로그 조회 (디버깅용)
   */
  getBufferedLogs(count: number = 100): LogEvent[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * 특정 조건으로 로그 검색
   */
  searchLogs(criteria: {
    level?: string;
    service?: string;
    operation?: string;
    userId?: string;
    correlationId?: string;
    since?: Date;
  }): LogEvent[] {
    return this.logBuffer.filter(event => {
      if (criteria.level && event.level !== criteria.level) return false;
      if (criteria.service && event.service !== criteria.service) return false;
      if (criteria.operation && !event.operation.includes(criteria.operation)) return false;
      if (criteria.userId && event.userId !== criteria.userId) return false;
      if (criteria.correlationId && event.correlationId !== criteria.correlationId) return false;
      if (criteria.since && new Date(event.timestamp) < criteria.since) return false;
      return true;
    });
  }
}

/**
 * Structured Logger
 * Main logging class with support for various log types
 */
export class StructuredLogger {
  private readonly transport: LogTransport;
  private readonly piiMasker: PIIMasker;
  private readonly environment: string;
  private readonly version: string;
  private readonly minLogLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  constructor() {
    this.transport = new LogTransport();
    this.piiMasker = new PIIMasker();
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.APP_VERSION || '1.0.0';
    this.minLogLevel = (process.env.LOG_LEVEL as any) || 'INFO';
  }

  /**
   * 이미지 생성 시작 로깅
   */
  logImageGenerationStart(context: ImageGenerationContext): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'image-generation',
      operation: 'generation_start',
      message: `Image generation started for preset ${context.presetId}`,
      userId: this.piiMasker.maskUserId(context.userId),
      sessionId: context.sessionId,
      messageId: context.messageId,
      correlationId: context.correlationId,
      requestId: context.requestId,
      environment: this.environment,
      version: this.version,
      metadata: {
        presetId: context.presetId,
        promptLength: context.promptLength,
        qualityLevel: context.qualityLevel,
        hasStyleOverride: context.hasStyleOverride,
        priority: context.priority,
        userAgent: this.piiMasker.maskUserAgent(context.userAgent),
        ipAddress: this.piiMasker.maskIpAddress(context.ipAddress)
      }
    };

    this.sendLog(event);
  }

  /**
   * 이미지 생성 성공 로깅
   */
  logImageGenerationSuccess(result: {
    userId?: string;
    sessionId?: string;
    messageId?: string;
    correlationId?: string;
    requestId?: string;
    processingTime: number;
    cacheHit: boolean;
    retryCount: number;
    serverProcessingTime?: number;
    networkLatency?: number;
    imageUrl?: string;
    presetId?: string;
    metadata?: any;
  }): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'image-generation',
      operation: 'generation_success',
      message: `Image generation completed successfully in ${result.processingTime}ms`,
      duration: result.processingTime,
      userId: this.piiMasker.maskUserId(result.userId),
      sessionId: result.sessionId,
      messageId: result.messageId,
      correlationId: result.correlationId,
      requestId: result.requestId,
      statusCode: 200,
      processingTime: result.processingTime,
      networkLatency: result.networkLatency,
      cacheHit: result.cacheHit,
      retryCount: result.retryCount,
      environment: this.environment,
      version: this.version,
      metadata: {
        presetId: result.presetId,
        serverProcessingTime: result.serverProcessingTime,
        imageGenerated: !!result.imageUrl,
        cacheHit: result.cacheHit,
        retryCount: result.retryCount,
        ...result.metadata
      }
    };

    this.sendLog(event);
  }

  /**
   * 이미지 생성 실패 로깅
   */
  logImageGenerationError(error: {
    userId?: string;
    sessionId?: string;
    messageId?: string;
    correlationId?: string;
    requestId?: string;
    error: Error | string;
    processingTime?: number;
    retryCount?: number;
    presetId?: string;
    errorCode?: string;
    metadata?: any;
  }): void {
    const errorMessage = error.error instanceof Error ? error.error.message : String(error.error);
    const stack = error.error instanceof Error ? error.error.stack : undefined;

    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'image-generation',
      operation: 'generation_error',
      message: `Image generation failed: ${errorMessage}`,
      duration: error.processingTime,
      userId: this.piiMasker.maskUserId(error.userId),
      sessionId: error.sessionId,
      messageId: error.messageId,
      correlationId: error.correlationId,
      requestId: error.requestId,
      statusCode: 500,
      errorCode: error.errorCode || 'GENERATION_FAILED',
      processingTime: error.processingTime,
      retryCount: error.retryCount || 0,
      stack,
      environment: this.environment,
      version: this.version,
      metadata: {
        presetId: error.presetId,
        errorType: this.categorizeError(errorMessage),
        retryCount: error.retryCount || 0,
        ...error.metadata
      }
    };

    this.sendLog(event);
  }

  /**
   * 쿼터 사용량 로깅
   */
  logQuotaUsage(quotaEvent: QuotaUsageEvent): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: quotaEvent.isLimitExceeded ? 'WARN' : 'INFO',
      service: 'quota',
      operation: `quota_${quotaEvent.action}`,
      message: `Quota ${quotaEvent.action}: ${quotaEvent.usedCount}/${quotaEvent.limitCount} (${quotaEvent.remainingCount} remaining)`,
      userId: this.piiMasker.maskUserId(quotaEvent.userId),
      correlationId: quotaEvent.correlationId,
      quotaUsed: quotaEvent.usedCount,
      quotaRemaining: quotaEvent.remainingCount,
      subscriptionType: quotaEvent.subscriptionType,
      environment: this.environment,
      version: this.version,
      metadata: {
        quotaType: quotaEvent.quotaType,
        action: quotaEvent.action,
        limitCount: quotaEvent.limitCount,
        usagePercentage: (quotaEvent.usedCount / quotaEvent.limitCount * 100).toFixed(1),
        isLimitExceeded: quotaEvent.isLimitExceeded,
        subscriptionType: quotaEvent.subscriptionType
      }
    };

    this.sendLog(event);
  }

  /**
   * 성능 메트릭 로깅
   */
  logPerformanceMetric(metric: {
    operation: string;
    duration: number;
    success: boolean;
    userId?: string;
    correlationId?: string;
    metadata?: any;
  }): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      service: 'system',
      operation: `perf_${metric.operation}`,
      message: `Performance metric: ${metric.operation} completed in ${metric.duration}ms`,
      duration: metric.duration,
      userId: this.piiMasker.maskUserId(metric.userId),
      correlationId: metric.correlationId,
      processingTime: metric.duration,
      environment: this.environment,
      version: this.version,
      metadata: {
        operation: metric.operation,
        success: metric.success,
        performanceCategory: this.categorizePerformance(metric.duration),
        ...metric.metadata
      }
    };

    this.sendLog(event);
  }

  /**
   * 보안 이벤트 로깅
   */
  logSecurityEvent(event: {
    userId?: string;
    sessionId?: string;
    operation: string;
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): void {
    const logEvent: LogEvent = {
      timestamp: new Date().toISOString(),
      level: event.severity === 'CRITICAL' || event.severity === 'HIGH' ? 'ERROR' : 'WARN',
      service: 'auth',
      operation: `security_${event.operation}`,
      message: `Security event: ${event.message}`,
      userId: this.piiMasker.maskUserId(event.userId),
      sessionId: event.sessionId,
      sensitive: true,
      environment: this.environment,
      version: this.version,
      metadata: {
        severity: event.severity,
        ipAddress: this.piiMasker.maskIpAddress(event.ipAddress),
        userAgent: this.piiMasker.maskUserAgent(event.userAgent),
        operation: event.operation,
        ...event.metadata
      }
    };

    this.sendLog(logEvent);
  }

  /**
   * 일반 로그 (개발용)
   */
  log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', service: string, operation: string, message: string, context?: LogContext, metadata?: any): void {
    const event: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      service: service as any,
      operation,
      message,
      userId: this.piiMasker.maskUserId(context?.userId),
      sessionId: context?.sessionId,
      messageId: context?.messageId,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      environment: this.environment,
      version: this.version,
      metadata
    };

    this.sendLog(event);
  }

  /**
   * 로그 전송 (레벨 필터링 적용)
   */
  private sendLog(event: LogEvent): void {
    if (!this.shouldLog(event.level)) {
      return;
    }

    this.transport.send(event).catch(error => {
      console.error('Failed to send log:', error);
    });
  }

  /**
   * 로그 레벨 필터링
   */
  private shouldLog(level: string): boolean {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.minLogLevel);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= currentLevelIndex;
  }

  /**
   * 오류 카테고리화
   */
  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('quota') || message.includes('limit')) return 'quota';
    if (message.includes('auth')) return 'authentication';
    if (message.includes('validation')) return 'validation';
    return 'unknown';
  }

  /**
   * 성능 카테고리화
   */
  private categorizePerformance(duration: number): string {
    if (duration < 1000) return 'fast';
    if (duration < 5000) return 'normal';
    if (duration < 15000) return 'slow';
    return 'very_slow';
  }

  /**
   * 버퍼된 로그 조회
   */
  getRecentLogs(count: number = 100): LogEvent[] {
    return this.transport.getBufferedLogs(count);
  }

  /**
   * 로그 검색
   */
  searchLogs(criteria: {
    level?: string;
    service?: string;
    operation?: string;
    userId?: string;
    correlationId?: string;
    since?: Date;
  }): LogEvent[] {
    return this.transport.searchLogs(criteria);
  }
}

/**
 * Singleton instance management
 */
let globalLogger: StructuredLogger | null = null;

/**
 * Get or create global logger instance
 */
export function getStructuredLogger(): StructuredLogger {
  if (!globalLogger) {
    globalLogger = new StructuredLogger();
  }
  return globalLogger;
}

/**
 * Helper functions for easy logging
 */
export const Logger = {
  info: (service: string, operation: string, message: string, context?: LogContext, metadata?: any) => {
    getStructuredLogger().log('INFO', service, operation, message, context, metadata);
  },
  warn: (service: string, operation: string, message: string, context?: LogContext, metadata?: any) => {
    getStructuredLogger().log('WARN', service, operation, message, context, metadata);
  },
  error: (service: string, operation: string, message: string, context?: LogContext, metadata?: any) => {
    getStructuredLogger().log('ERROR', service, operation, message, context, metadata);
  },
  debug: (service: string, operation: string, message: string, context?: LogContext, metadata?: any) => {
    getStructuredLogger().log('DEBUG', service, operation, message, context, metadata);
  }
};
