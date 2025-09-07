/**
 * 에러 로깅 및 모니터링 유틸리티
 * 구조화된 에러 로그와 성능 모니터링을 제공
 */

export interface ErrorLogEntry {
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  context?: {
    user_id?: string;
    session_id?: string;
    chatbot_id?: string;
    api_endpoint?: string;
    user_agent?: string;
    ip_address?: string;
    error_code?: string;
    stack_trace?: string;
    request_id?: string;
  };
  performance?: {
    duration_ms?: number;
    memory_usage?: number;
    api_calls?: number;
  };
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  api_response_time: number;
  database_query_time: number;
  memory_usage: number;
  error_count: number;
  request_count: number;
  success_rate: number;
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorQueue: ErrorLogEntry[] = [];
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private isEnabled: boolean = true;

  private constructor() {
    // 주기적으로 에러 로그 플러시 (개발 환경에서는 즉시 출력)
    if (typeof window !== 'undefined') {
      setInterval(() => this.flushLogs(), 30000); // 30초마다
    }
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * 에러 로깅
   */
  logError(
    category: string,
    message: string,
    error?: Error,
    context?: ErrorLogEntry['context'],
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      category,
      message,
      context: {
        ...context,
        stack_trace: error?.stack,
        error_code: (error as any)?.code,
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        request_id: this.generateRequestId()
      },
      metadata
    };

    this.addToQueue(logEntry);

    // 콘솔에도 출력 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${category}] ${message}`, {
        error,
        context,
        metadata
      });
    }
  }

  /**
   * 경고 로깅
   */
  logWarning(
    category: string,
    message: string,
    context?: ErrorLogEntry['context'],
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warning',
      category,
      message,
      context,
      metadata
    };

    this.addToQueue(logEntry);

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[${category}] ${message}`, { context, metadata });
    }
  }

  /**
   * 정보 로깅
   */
  logInfo(
    category: string,
    message: string,
    context?: ErrorLogEntry['context'],
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      category,
      message,
      context,
      metadata
    };

    this.addToQueue(logEntry);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${category}] ${message}`, { context, metadata });
    }
  }

  /**
   * 성능 메트릭 기록
   */
  recordPerformance(
    operation: string,
    duration: number,
    success: boolean,
    additionalMetrics?: Partial<PerformanceMetrics>
  ): void {
    const existing = this.performanceMetrics.get(operation) || {
      api_response_time: 0,
      database_query_time: 0,
      memory_usage: 0,
      error_count: 0,
      request_count: 0,
      success_rate: 0
    };

    const updated: PerformanceMetrics = {
      ...existing,
      ...additionalMetrics,
      api_response_time: (existing.api_response_time + duration) / 2, // 평균 계산
      request_count: existing.request_count + 1,
      error_count: success ? existing.error_count : existing.error_count + 1
    };

    updated.success_rate = ((updated.request_count - updated.error_count) / updated.request_count) * 100;

    this.performanceMetrics.set(operation, updated);

    // 성능 이슈 감지 및 경고
    if (duration > 10000) { // 10초 이상
      this.logWarning('PERFORMANCE', `Slow operation detected: ${operation}`, {
        api_endpoint: operation
      }, {
        duration_ms: duration,
        threshold_ms: 10000
      });
    }

    if (updated.success_rate < 90) { // 성공률 90% 미만
      this.logWarning('RELIABILITY', `Low success rate for operation: ${operation}`, {
        api_endpoint: operation
      }, {
        success_rate: updated.success_rate,
        error_count: updated.error_count,
        total_requests: updated.request_count
      });
    }
  }

  /**
   * 사용자 행동 로깅
   */
  logUserAction(
    action: string,
    user_id: string,
    context?: {
      session_id?: string;
      chatbot_id?: string;
      page?: string;
      feature?: string;
    },
    metadata?: Record<string, any>
  ): void {
    this.logInfo('USER_ACTION', action, {
      user_id,
      ...context
    }, metadata);
  }

  /**
   * API 호출 로깅
   */
  logApiCall(
    endpoint: string,
    method: string,
    status: number,
    duration: number,
    context?: ErrorLogEntry['context']
  ): void {
    const isSuccess = status >= 200 && status < 300;
    const level = isSuccess ? 'info' : (status >= 500 ? 'error' : 'warning');

    const logEntry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: 'API_CALL',
      message: `${method} ${endpoint} - ${status}`,
      context: {
        ...context,
        api_endpoint: endpoint
      },
      performance: {
        duration_ms: duration
      },
      metadata: {
        method,
        status,
        success: isSuccess
      }
    };

    this.addToQueue(logEntry);
    this.recordPerformance(endpoint, duration, isSuccess);
  }

  /**
   * 할당량 사용 로깅
   */
  logQuotaUsage(
    user_id: string,
    quota_type: string,
    used_count: number,
    limit_count: number,
    action: 'consumed' | 'rollback' | 'reset'
  ): void {
    const level = used_count >= limit_count ? 'warning' : 'info';
    
    this.logInfo('QUOTA_USAGE', `Quota ${action}: ${used_count}/${limit_count}`, {
      user_id
    }, {
      quota_type,
      used_count,
      limit_count,
      action,
      usage_percentage: (used_count / limit_count) * 100
    });
  }

  /**
   * 데이터베이스 연결 상태 로깅
   */
  logDatabaseHealth(
    operation: string,
    success: boolean,
    duration: number,
    error?: Error
  ): void {
    if (success) {
      this.logInfo('DATABASE', `${operation} completed successfully`, undefined, {
        duration_ms: duration
      });
    } else {
      this.logError('DATABASE', `${operation} failed`, error, undefined, {
        duration_ms: duration,
        operation
      });
    }

    this.recordPerformance(`db_${operation}`, duration, success, {
      database_query_time: duration
    });
  }

  /**
   * 큐에 로그 추가
   */
  private addToQueue(logEntry: ErrorLogEntry): void {
    this.errorQueue.push(logEntry);

    // 큐 크기 제한 (메모리 보호)
    if (this.errorQueue.length > 1000) {
      this.errorQueue = this.errorQueue.slice(-500); // 최근 500개만 유지
    }
  }

  /**
   * 로그 플러시 (실제 환경에서는 외부 로깅 서비스로 전송)
   */
  private flushLogs(): void {
    if (this.errorQueue.length === 0) return;

    // 개발 환경에서는 콘솔에 요약 출력
    if (process.env.NODE_ENV === 'development') {
      const errorCount = this.errorQueue.filter(log => log.level === 'error').length;
      const warningCount = this.errorQueue.filter(log => log.level === 'warning').length;
      
      if (errorCount > 0 || warningCount > 0) {
        console.log(`🔍 로그 요약: 에러 ${errorCount}개, 경고 ${warningCount}개`);
      }
    }

    // 실제 환경에서는 여기서 외부 로깅 서비스(예: Sentry, LogRocket)로 전송
    // await this.sendToLoggingService(this.errorQueue);

    this.errorQueue = [];
  }

  /**
   * 성능 메트릭 가져오기
   */
  getPerformanceMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * 에러 통계 가져오기
   */
  getErrorStats(): {
    total_errors: number;
    errors_by_category: Record<string, number>;
    recent_errors: ErrorLogEntry[];
  } {
    const recentErrors = this.errorQueue.filter(log => log.level === 'error');
    const errorsByCategory: Record<string, number> = {};

    recentErrors.forEach(error => {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
    });

    return {
      total_errors: recentErrors.length,
      errors_by_category: errorsByCategory,
      recent_errors: recentErrors.slice(-10) // 최근 10개
    };
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 로깅 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }
}

// 싱글톤 인스턴스 내보내기
export const errorLogger = ErrorLogger.getInstance();

// 편의 함수들
export const logError = (category: string, message: string, error?: Error, context?: ErrorLogEntry['context']) => 
  errorLogger.logError(category, message, error, context);

export const logWarning = (category: string, message: string, context?: ErrorLogEntry['context']) => 
  errorLogger.logWarning(category, message, context);

export const logInfo = (category: string, message: string, context?: ErrorLogEntry['context']) => 
  errorLogger.logInfo(category, message, context);

export const logApiCall = (endpoint: string, method: string, status: number, duration: number, context?: ErrorLogEntry['context']) => 
  errorLogger.logApiCall(endpoint, method, status, duration, context);

export const logUserAction = (action: string, user_id: string, context?: any) => 
  errorLogger.logUserAction(action, user_id, context);

export const logQuotaUsage = (user_id: string, quota_type: string, used_count: number, limit_count: number, action: 'consumed' | 'rollback' | 'reset') => 
  errorLogger.logQuotaUsage(user_id, quota_type, used_count, limit_count, action);

export const logDatabaseHealth = (operation: string, success: boolean, duration: number, error?: Error) => 
  errorLogger.logDatabaseHealth(operation, success, duration, error);

// React Hook (클라이언트 사이드에서 사용)
export const useErrorLogger = () => {
  return {
    logError,
    logWarning,
    logInfo,
    logApiCall,
    logUserAction,
    getErrorStats: () => errorLogger.getErrorStats(),
    getPerformanceMetrics: () => errorLogger.getPerformanceMetrics()
  };
};
