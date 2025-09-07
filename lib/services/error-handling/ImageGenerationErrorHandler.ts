/**
 * Image Generation Error Handler
 * 
 * Comprehensive error handling system for image generation with classification,
 * user-friendly messages, retry mechanisms, and error reporting.
 */

export type ImageGenerationErrorCode = 
  | 'QUOTA_EXCEEDED'
  | 'SERVER_ERROR'
  | 'GENERATION_FAILED'
  | 'INAPPROPRIATE_CONTENT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INSUFFICIENT_CREDITS'
  | 'MAINTENANCE_MODE'
  | 'UNKNOWN_ERROR';

export interface ImageGenerationError {
  code: ImageGenerationErrorCode;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryable: boolean;
  retryDelay?: number;
  maxRetries?: number;
  context?: Record<string, any>;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorHandlingResult {
  success: boolean;
  error?: ImageGenerationError;
  shouldRetry?: boolean;
  retryAfter?: number;
  fallbackOptions?: FallbackOption[];
}

export interface FallbackOption {
  type: 'retry' | 'alternative_prompt' | 'different_style' | 'manual_refresh' | 'contact_support';
  label: string;
  description: string;
  action: () => Promise<void> | void;
  available: boolean;
}

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  useExponentialBackoff: boolean;
  originalError: Error;
  messageId: string;
  userId: string;
}

export class ImageGenerationErrorHandler {
  private errorDefinitions: Record<ImageGenerationErrorCode, Omit<ImageGenerationError, 'context' | 'timestamp'>> = {
    QUOTA_EXCEEDED: {
      code: 'QUOTA_EXCEEDED',
      message: 'Daily image generation quota exceeded',
      userMessage: '일일 이미지 생성 한도에 도달했습니다. 내일 다시 시도하거나 프리미엄으로 업그레이드하세요.',
      recoverable: false,
      retryable: false,
      severity: 'medium'
    },
    SERVER_ERROR: {
      code: 'SERVER_ERROR',
      message: 'Internal server error occurred during image generation',
      userMessage: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 5000,
      maxRetries: 3,
      severity: 'high'
    },
    GENERATION_FAILED: {
      code: 'GENERATION_FAILED',
      message: 'Image generation process failed',
      userMessage: '이미지 생성에 실패했습니다. 다른 설명으로 다시 시도해보세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 2000,
      maxRetries: 2,
      severity: 'medium'
    },
    INAPPROPRIATE_CONTENT: {
      code: 'INAPPROPRIATE_CONTENT',
      message: 'Content filtered due to inappropriate material',
      userMessage: '부적절한 콘텐츠가 감지되어 이미지 생성이 차단되었습니다. 다른 내용으로 시도해주세요.',
      recoverable: false,
      retryable: false,
      severity: 'low'
    },
    NETWORK_ERROR: {
      code: 'NETWORK_ERROR',
      message: 'Network connectivity issue',
      userMessage: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 3000,
      maxRetries: 5,
      severity: 'medium'
    },
    TIMEOUT_ERROR: {
      code: 'TIMEOUT_ERROR',
      message: 'Request timeout during image generation',
      userMessage: '이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 1000,
      maxRetries: 2,
      severity: 'medium'
    },
    AUTHENTICATION_ERROR: {
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed',
      userMessage: '인증에 실패했습니다. 다시 로그인해주세요.',
      recoverable: false,
      retryable: false,
      severity: 'high'
    },
    VALIDATION_ERROR: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      userMessage: '요청 정보가 올바르지 않습니다. 다시 시도해주세요.',
      recoverable: false,
      retryable: false,
      severity: 'low'
    },
    RATE_LIMIT_ERROR: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Rate limit exceeded',
      userMessage: '너무 많은 요청을 보내셨습니다. 잠시 후 다시 시도해주세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 10000,
      maxRetries: 1,
      severity: 'medium'
    },
    INSUFFICIENT_CREDITS: {
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits for image generation',
      userMessage: '이미지 생성을 위한 크레딧이 부족합니다. 크레딧을 구매하거나 프리미엄으로 업그레이드하세요.',
      recoverable: false,
      retryable: false,
      severity: 'medium'
    },
    MAINTENANCE_MODE: {
      code: 'MAINTENANCE_MODE',
      message: 'Service is under maintenance',
      userMessage: '현재 서비스 점검 중입니다. 잠시 후 다시 이용해주세요.',
      recoverable: true,
      retryable: true,
      retryDelay: 30000,
      maxRetries: 1,
      severity: 'medium'
    },
    UNKNOWN_ERROR: {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      userMessage: '알 수 없는 오류가 발생했습니다. 문제가 계속되면 고객지원에 문의해주세요.',
      recoverable: false,
      retryable: false,
      severity: 'high'
    }
  };

  /**
   * Handle an error and return appropriate response
   */
  async handleError(
    error: Error | string,
    context: {
      messageId?: string;
      userId?: string;
      attempt?: number;
      maxAttempts?: number;
      [key: string]: any;
    } = {}
  ): Promise<ErrorHandlingResult> {
    try {
      console.log('[ImageGenerationErrorHandler] Handling error:', error, context);

      // Classify the error
      const errorCode = this.classifyError(error);
      const errorDefinition = this.errorDefinitions[errorCode];

      // Create detailed error object
      const detailedError: ImageGenerationError = {
        ...errorDefinition,
        context,
        timestamp: new Date().toISOString()
      };

      // Log the error
      await this.logError(detailedError);

      // Generate fallback options
      const fallbackOptions = this.generateFallbackOptions(detailedError, context);

      // Determine retry behavior
      const shouldRetry = this.shouldRetry(detailedError, context);
      const retryAfter = shouldRetry ? this.calculateRetryDelay(detailedError, context) : undefined;

      return {
        success: false,
        error: detailedError,
        shouldRetry,
        retryAfter,
        fallbackOptions
      };
    } catch (handlingError) {
      console.error('[ImageGenerationErrorHandler] Error in error handling:', handlingError);
      
      // Return a safe fallback error
      return {
        success: false,
        error: {
          ...this.errorDefinitions.UNKNOWN_ERROR,
          context,
          timestamp: new Date().toISOString()
        },
        shouldRetry: false,
        fallbackOptions: []
      };
    }
  }

  /**
   * Execute retry with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryContext: RetryContext
  ): Promise<T> {
    const { attempt, maxAttempts, baseDelay, maxDelay, useExponentialBackoff } = retryContext;

    try {
      return await operation();
    } catch (error) {
      console.log(`[ImageGenerationErrorHandler] Attempt ${attempt}/${maxAttempts} failed:`, error);

      if (attempt >= maxAttempts) {
        throw error;
      }

      // Calculate delay
      let delay = baseDelay;
      if (useExponentialBackoff) {
        delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      }

      // Add jitter to prevent thundering herd
      delay += Math.random() * 1000;

      console.log(`[ImageGenerationErrorHandler] Retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));

      return this.executeWithRetry(operation, {
        ...retryContext,
        attempt: attempt + 1
      });
    }
  }

  /**
   * Get user-friendly error message with actionable suggestions
   */
  getUserFriendlyError(error: ImageGenerationError): {
    title: string;
    message: string;
    suggestions: string[];
    severity: 'info' | 'warning' | 'error';
  } {
    const suggestions: string[] = [];

    switch (error.code) {
      case 'QUOTA_EXCEEDED':
        suggestions.push('프리미엄 요금제로 업그레이드');
        suggestions.push('내일 다시 시도');
        break;
      case 'GENERATION_FAILED':
        suggestions.push('더 구체적인 설명 사용');
        suggestions.push('다른 스타일로 시도');
        suggestions.push('간단한 표현으로 변경');
        break;
      case 'NETWORK_ERROR':
        suggestions.push('인터넷 연결 확인');
        suggestions.push('Wi-Fi 재연결');
        suggestions.push('잠시 후 다시 시도');
        break;
      case 'INAPPROPRIATE_CONTENT':
        suggestions.push('적절한 내용으로 수정');
        suggestions.push('다른 표현 방식 사용');
        break;
      default:
        suggestions.push('잠시 후 다시 시도');
        suggestions.push('페이지 새로고침');
        break;
    }

    return {
      title: this.getErrorTitle(error.code),
      message: error.userMessage,
      suggestions,
      severity: this.getSeverityLevel(error.severity)
    };
  }

  /**
   * Report error to monitoring system
   */
  private async logError(error: ImageGenerationError): Promise<void> {
    try {
      // Send to server-side logging
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'image_generation_error',
          error: {
            code: error.code,
            message: error.message,
            severity: error.severity,
            context: error.context,
            timestamp: error.timestamp
          }
        })
      });

      // Also log to console for development
      console.error('[ImageGenerationError]', {
        code: error.code,
        message: error.message,
        context: error.context,
        timestamp: error.timestamp
      });
    } catch (reportError) {
      console.error('[ImageGenerationErrorHandler] Failed to report error:', reportError);
      // Don't throw - error reporting failure shouldn't break the main flow
    }
  }

  /**
   * Classify error based on error message or type
   */
  private classifyError(error: Error | string): ImageGenerationErrorCode {
    const errorMessage = typeof error === 'string' ? error : error.message.toLowerCase();

    if (errorMessage.includes('quota') || errorMessage.includes('limit exceeded')) {
      return 'QUOTA_EXCEEDED';
    }
    if (errorMessage.includes('inappropriate') || errorMessage.includes('filtered')) {
      return 'INAPPROPRIATE_CONTENT';
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    if (errorMessage.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
    if (errorMessage.includes('rate limit')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (errorMessage.includes('credits') || errorMessage.includes('payment')) {
      return 'INSUFFICIENT_CREDITS';
    }
    if (errorMessage.includes('maintenance')) {
      return 'MAINTENANCE_MODE';
    }
    if (errorMessage.includes('server error') || errorMessage.includes('500')) {
      return 'SERVER_ERROR';
    }
    if (errorMessage.includes('generation failed')) {
      return 'GENERATION_FAILED';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: ImageGenerationError, context: any): boolean {
    if (!error.retryable) {
      return false;
    }

    const currentAttempt = context.attempt || 1;
    const maxAttempts = context.maxAttempts || error.maxRetries || 1;

    return currentAttempt < maxAttempts;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(error: ImageGenerationError, context: any): number {
    const baseDelay = error.retryDelay || 3000;
    const attempt = context.attempt || 1;
    const maxDelay = 30000; // 30 seconds max

    // Exponential backoff with jitter
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter

    return exponentialDelay + jitter;
  }

  /**
   * Generate fallback options based on error type
   */
  private generateFallbackOptions(error: ImageGenerationError, context: any): FallbackOption[] {
    const options: FallbackOption[] = [];

    switch (error.code) {
      case 'GENERATION_FAILED':
        options.push({
          type: 'retry',
          label: '다시 시도',
          description: '같은 설정으로 다시 이미지를 생성합니다',
          action: () => this.triggerRetry(context),
          available: error.retryable
        });
        options.push({
          type: 'alternative_prompt',
          label: '다른 표현으로 시도',
          description: '메시지를 다르게 표현하여 이미지를 생성합니다',
          action: () => this.triggerAlternativePrompt(context),
          available: true
        });
        break;

      case 'INAPPROPRIATE_CONTENT':
        options.push({
          type: 'alternative_prompt',
          label: '내용 수정하기',
          description: '적절한 내용으로 수정하여 다시 시도합니다',
          action: () => this.triggerAlternativePrompt(context),
          available: true
        });
        break;

      case 'QUOTA_EXCEEDED':
        options.push({
          type: 'contact_support',
          label: '프리미엄 업그레이드',
          description: '더 많은 이미지 생성을 위해 프리미엄으로 업그레이드합니다',
          action: () => this.triggerUpgrade(context),
          available: true
        });
        break;

      case 'NETWORK_ERROR':
      case 'TIMEOUT_ERROR':
        options.push({
          type: 'retry',
          label: '다시 시도',
          description: '네트워크 연결을 확인하고 다시 시도합니다',
          action: () => this.triggerRetry(context),
          available: true
        });
        options.push({
          type: 'manual_refresh',
          label: '페이지 새로고침',
          description: '페이지를 새로고침하여 연결을 복구합니다',
          action: () => window.location.reload(),
          available: true
        });
        break;

      case 'SERVER_ERROR':
        options.push({
          type: 'retry',
          label: '잠시 후 다시 시도',
          description: '서버 문제가 해결될 때까지 기다린 후 다시 시도합니다',
          action: () => this.triggerDelayedRetry(context, 10000),
          available: true
        });
        break;

      default:
        options.push({
          type: 'manual_refresh',
          label: '새로고침',
          description: '페이지를 새로고침합니다',
          action: () => window.location.reload(),
          available: true
        });
        options.push({
          type: 'contact_support',
          label: '고객지원 문의',
          description: '문제가 계속되면 고객지원팀에 문의합니다',
          action: () => this.triggerSupportContact(context),
          available: true
        });
    }

    return options;
  }

  /**
   * Get error title based on error code
   */
  private getErrorTitle(code: ImageGenerationErrorCode): string {
    const titles: Record<ImageGenerationErrorCode, string> = {
      QUOTA_EXCEEDED: '일일 한도 초과',
      SERVER_ERROR: '서버 오류',
      GENERATION_FAILED: '생성 실패',
      INAPPROPRIATE_CONTENT: '콘텐츠 차단',
      NETWORK_ERROR: '네트워크 오류',
      TIMEOUT_ERROR: '시간 초과',
      AUTHENTICATION_ERROR: '인증 오류',
      VALIDATION_ERROR: '입력 오류',
      RATE_LIMIT_ERROR: '요청 한도 초과',
      INSUFFICIENT_CREDITS: '크레딧 부족',
      MAINTENANCE_MODE: '서비스 점검',
      UNKNOWN_ERROR: '알 수 없는 오류'
    };

    return titles[code] || '오류 발생';
  }

  /**
   * Convert severity to UI level
   */
  private getSeverityLevel(severity: 'low' | 'medium' | 'high' | 'critical'): 'info' | 'warning' | 'error' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high':
      case 'critical': return 'error';
      default: return 'warning';
    }
  }

  /**
   * Fallback option action handlers
   */
  private async triggerRetry(context: any): Promise<void> {
    console.log('[ImageGenerationErrorHandler] Triggering retry for:', context);
    if (context.onRetry) {
      await context.onRetry();
    }
  }

  private async triggerAlternativePrompt(context: any): Promise<void> {
    console.log('[ImageGenerationErrorHandler] Triggering alternative prompt for:', context);
    if (context.onAlternativePrompt) {
      await context.onAlternativePrompt();
    }
  }

  private async triggerDelayedRetry(context: any, delay: number): Promise<void> {
    console.log(`[ImageGenerationErrorHandler] Triggering delayed retry (${delay}ms) for:`, context);
    setTimeout(() => {
      if (context.onRetry) {
        context.onRetry();
      }
    }, delay);
  }

  private async triggerUpgrade(context: any): Promise<void> {
    console.log('[ImageGenerationErrorHandler] Triggering upgrade flow for:', context);
    if (context.onUpgrade) {
      await context.onUpgrade();
    } else {
      window.open('/upgrade', '_blank');
    }
  }

  private async triggerSupportContact(context: any): Promise<void> {
    console.log('[ImageGenerationErrorHandler] Triggering support contact for:', context);
    if (context.onContactSupport) {
      await context.onContactSupport();
    } else {
      window.open('/support', '_blank');
    }
  }

  /**
   * Static helper methods for quick error handling
   */
  static isRetryableError(error: Error | string): boolean {
    const handler = new ImageGenerationErrorHandler();
    const errorCode = handler.classifyError(error);
    return handler.errorDefinitions[errorCode].retryable;
  }

  static getQuickErrorMessage(error: Error | string): string {
    const handler = new ImageGenerationErrorHandler();
    const errorCode = handler.classifyError(error);
    return handler.errorDefinitions[errorCode].userMessage;
  }

  static async handleQuickError(error: Error | string, context: any = {}): Promise<ErrorHandlingResult> {
    const handler = new ImageGenerationErrorHandler();
    return handler.handleError(error, context);
  }
}

// Export singleton instance
export const imageGenerationErrorHandler = new ImageGenerationErrorHandler();
