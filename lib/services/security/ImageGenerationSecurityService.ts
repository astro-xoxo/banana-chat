/**
 * ImageGenerationSecurityService - 메인 이미지 생성 보안 서비스
 * Task 012: Implement Security and Validation Systems
 */

import { createAuthenticatedServerClient } from '@/lib/supabase-server';
import { InputValidator } from './InputValidator';
import { RateLimiter, DEFAULT_RATE_LIMITS, TIER_BASED_RATE_LIMITS } from './RateLimiter';
import type {
  ImageGenerationSecurity,
  ValidationResult,
  RateLimitResult,
  ModerationResult,
  PermissionCheck,
  PermissionResult,
  SecurityEvent,
  SecurityConfig
} from './types';

export class ImageGenerationSecurityService implements ImageGenerationSecurity {
  private inputValidator: InputValidator;
  private rateLimiter: RateLimiter;
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.inputValidator = new InputValidator();
    this.rateLimiter = new RateLimiter();
    
    // 기본 보안 설정
    this.config = {
      rateLimits: DEFAULT_RATE_LIMITS,
      enableContentModeration: true,
      enableAuditLogging: true,
      strictMode: false,
      trustedIps: [],
      blockedIps: [],
      ...config
    };
  }

  /**
   * 이미지 생성 요청 검증
   */
  async validateRequest(userId: string, messageId: string): Promise<ValidationResult> {
    try {
      console.log('ImageGenerationSecurityService: 요청 검증 시작', { userId, messageId });

      const errors = [];
      const warnings = [];

      // 1. 사용자 존재 및 활성 상태 확인
      const userValidation = await this.validateUser(userId);
      if (!userValidation.isValid) {
        errors.push(...userValidation.errors);
      }

      // 2. 메시지 존재 및 소유권 확인
      const messageValidation = await this.validateMessage(messageId, userId);
      if (!messageValidation.isValid) {
        errors.push(...messageValidation.errors);
      }

      // 3. 사용자 권한 확인
      const permissionCheck = await this.checkPermissions({
        userId,
        action: 'image_generation',
        resource: messageId
      });

      if (!permissionCheck.allowed) {
        errors.push({
          field: 'permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: permissionCheck.reason || '이미지 생성 권한이 없습니다',
          severity: 'high' as const
        });
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings
      };

      // 보안 이벤트 로깅
      await this.logSecurityEvent({
        type: 'request_validation',
        userId,
        action: 'image_generation',
        resource: messageId,
        details: {
          validation_result: result,
          user_validation: userValidation.isValid,
          message_validation: messageValidation.isValid,
          permission_check: permissionCheck.allowed
        },
        severity: result.isValid ? 'info' : 'warning',
        timestamp: new Date()
      });

      console.log('ImageGenerationSecurityService: 요청 검증 완료', {
        userId,
        messageId,
        isValid: result.isValid,
        errors: errors.length,
        warnings: warnings.length
      });

      return result;

    } catch (error) {
      console.error('ImageGenerationSecurityService: 요청 검증 오류', { userId, messageId, error });
      
      return {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'VALIDATION_ERROR',
          message: '요청 검증 중 오류가 발생했습니다',
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  /**
   * 속도 제한 확인
   */
  async checkRateLimit(userId: string, action: string): Promise<RateLimitResult> {
    try {
      console.log('ImageGenerationSecurityService: 속도 제한 확인', { userId, action });

      // 사용자 등급별 제한 조회
      const userTier = await this.getUserTier(userId);
      const rateLimitConfig = this.getRateLimitConfig(action, userTier);

      if (!rateLimitConfig) {
        console.warn('ImageGenerationSecurityService: 속도 제한 설정 없음', { action, userTier });
        return {
          allowed: true,
          limit: 1000,
          remaining: 1000,
          resetTime: new Date(Date.now() + 60000)
        };
      }

      const result = await this.rateLimiter.checkRateLimit(userId, action, rateLimitConfig);

      // 제한 위반 시 보안 이벤트 로깅
      if (!result.allowed) {
        await this.logSecurityEvent({
          type: 'rate_limit_exceeded',
          userId,
          action,
          details: {
            limit: result.limit,
            current_count: result.limit - result.remaining + 1,
            reset_time: result.resetTime,
            user_tier: userTier
          },
          severity: 'warning',
          timestamp: new Date()
        });
      }

      console.log('ImageGenerationSecurityService: 속도 제한 확인 완료', {
        userId,
        action,
        allowed: result.allowed,
        remaining: result.remaining,
        userTier
      });

      return result;

    } catch (error) {
      console.error('ImageGenerationSecurityService: 속도 제한 확인 오류', { userId, action, error });
      
      // 오류 시 허용 (fail-open)
      return {
        allowed: true,
        limit: 10,
        remaining: 10,
        resetTime: new Date(Date.now() + 60000)
      };
    }
  }

  /**
   * 프롬프트 콘텐츠 조정
   */
  async moderatePrompt(prompt: string): Promise<ModerationResult> {
    try {
      console.log('ImageGenerationSecurityService: 프롬프트 조정 시작', {
        prompt_length: prompt.length
      });

      if (!this.config.enableContentModeration) {
        return {
          flagged: false,
          confidence: 0,
          categories: [],
          reasons: [],
          action: 'allow'
        };
      }

      // 부적절한 키워드 검사
      const inappropriatePatterns = [
        { pattern: /\b(nude|naked|nsfw|adult|sexual|erotic)\b/i, category: 'adult_content' },
        { pattern: /\b(violence|kill|death|blood|gore|murder)\b/i, category: 'violence' },
        { pattern: /\b(drug|cocaine|heroin|marijuana|illegal)\b/i, category: 'illegal_substances' },
        { pattern: /\b(hate|racism|discrimination|nazi|terrorist)\b/i, category: 'hate_speech' },
        { pattern: /\b(self-harm|suicide|cutting|overdose)\b/i, category: 'self_harm' }
      ];

      const flaggedCategories: string[] = [];
      const reasons: string[] = [];
      let maxConfidence = 0;

      for (const { pattern, category } of inappropriatePatterns) {
        if (pattern.test(prompt)) {
          flaggedCategories.push(category);
          reasons.push(`부적절한 콘텐츠 감지: ${category}`);
          maxConfidence = Math.max(maxConfidence, 0.8);
        }
      }

      // 스팸 패턴 검사
      const spamPatterns = [
        /(.)\1{10,}/, // 동일 문자 반복
        /\b(buy|sell|discount|offer|deal)\b.*\b(now|today|urgent)\b/i, // 상업적 스팸
        /(http|www|\.com|\.org|\.net)/i // URL 포함
      ];

      for (const pattern of spamPatterns) {
        if (pattern.test(prompt)) {
          flaggedCategories.push('spam');
          reasons.push('스팸성 콘텐츠 감지');
          maxConfidence = Math.max(maxConfidence, 0.6);
        }
      }

      const flagged = flaggedCategories.length > 0;
      let action: ModerationResult['action'] = 'allow';

      if (flagged) {
        if (maxConfidence >= 0.8) {
          action = 'block';
        } else if (maxConfidence >= 0.6) {
          action = 'review';
        } else {
          action = 'warn';
        }
      }

      const result: ModerationResult = {
        flagged,
        confidence: maxConfidence,
        categories: flaggedCategories,
        reasons,
        action
      };

      // 조정 결과 로깅
      if (flagged) {
        await this.logSecurityEvent({
          type: 'content_moderation',
          action: 'prompt_moderation',
          details: {
            prompt_length: prompt.length,
            moderation_result: result,
            prompt_sample: prompt.substring(0, 100) // 샘플만 저장
          },
          severity: action === 'block' ? 'error' : 'warning',
          timestamp: new Date()
        });
      }

      console.log('ImageGenerationSecurityService: 프롬프트 조정 완료', {
        flagged,
        confidence: maxConfidence,
        categories: flaggedCategories.length,
        action
      });

      return result;

    } catch (error) {
      console.error('ImageGenerationSecurityService: 프롬프트 조정 오류', { error });
      
      return {
        flagged: false,
        confidence: 0,
        categories: [],
        reasons: ['조정 프로세스에서 오류 발생'],
        action: 'allow'
      };
    }
  }

  /**
   * 이미지 콘텐츠 조정
   */
  async moderateImage(imageUrl: string): Promise<ModerationResult> {
    try {
      console.log('ImageGenerationSecurityService: 이미지 조정 시작', { imageUrl });

      if (!this.config.enableContentModeration) {
        return {
          flagged: false,
          confidence: 0,
          categories: [],
          reasons: [],
          action: 'allow'
        };
      }

      // 실제 구현에서는 외부 이미지 조정 API (예: Google Vision API, AWS Rekognition) 사용
      // 여기서는 기본적인 URL 검증만 수행
      
      if (!imageUrl || !this.isValidImageUrl(imageUrl)) {
        return {
          flagged: true,
          confidence: 0.9,
          categories: ['invalid_content'],
          reasons: ['유효하지 않은 이미지 URL'],
          action: 'block'
        };
      }

      // 임시: 기본적으로 허용
      const result: ModerationResult = {
        flagged: false,
        confidence: 0,
        categories: [],
        reasons: [],
        action: 'allow'
      };

      console.log('ImageGenerationSecurityService: 이미지 조정 완료', {
        imageUrl,
        flagged: result.flagged,
        action: result.action
      });

      return result;

    } catch (error) {
      console.error('ImageGenerationSecurityService: 이미지 조정 오류', { imageUrl, error });
      
      return {
        flagged: true,
        confidence: 0.5,
        categories: ['moderation_error'],
        reasons: ['이미지 조정 중 오류 발생'],
        action: 'review'
      };
    }
  }

  /**
   * 사용자 권한 확인
   */
  async checkPermissions(check: PermissionCheck): Promise<PermissionResult> {
    try {
      console.log('ImageGenerationSecurityService: 권한 확인', check);

      const { userId, action, resource } = check;

      // 사용자 정보 조회
      const user = await this.getUser(userId);
      if (!user) {
        return {
          allowed: false,
          reason: '사용자를 찾을 수 없습니다'
        };
      }

      if (!user.is_active) {
        return {
          allowed: false,
          reason: '비활성화된 사용자입니다'
        };
      }

      // 액션별 권한 확인
      switch (action) {
        case 'image_generation':
          return await this.checkImageGenerationPermission(user, resource);
        
        case 'image_download':
          return await this.checkImageDownloadPermission(user, resource);
        
        case 'style_learning':
          return await this.checkStyleLearningPermission(user);
        
        default:
          return {
            allowed: false,
            reason: `알 수 없는 액션: ${action}`
          };
      }

    } catch (error) {
      console.error('ImageGenerationSecurityService: 권한 확인 오류', { check, error });
      
      return {
        allowed: false,
        reason: '권한 확인 중 오류가 발생했습니다'
      };
    }
  }

  /**
   * 보안 이벤트 로깅
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      if (!this.config.enableAuditLogging) {
        return;
      }

      const supabase = createAuthenticatedServerClient();
      
      const { error } = await supabase
        .from('security_events')
        .insert({
          type: event.type,
          user_id: event.userId,
          action: event.action,
          resource: event.resource,
          details: event.details,
          severity: event.severity,
          timestamp: event.timestamp,
          ip_address: event.ip,
          user_agent: event.userAgent
        });

      if (error) {
        throw error;
      }

      console.log('ImageGenerationSecurityService: 보안 이벤트 로깅 완료', {
        type: event.type,
        action: event.action,
        severity: event.severity
      });

    } catch (error) {
      console.error('ImageGenerationSecurityService: 보안 이벤트 로깅 오류', { event, error });
    }
  }

  // Private 헬퍼 메서드들

  private async validateUser(userId: string): Promise<ValidationResult> {
    try {
      const user = await this.getUser(userId);
      
      if (!user) {
        return {
          isValid: false,
          errors: [{
            field: 'user_id',
            code: 'USER_NOT_FOUND',
            message: '사용자를 찾을 수 없습니다',
            severity: 'high'
          }],
          warnings: []
        };
      }

      if (!user.is_active) {
        return {
          isValid: false,
          errors: [{
            field: 'user_id',
            code: 'USER_INACTIVE',
            message: '비활성화된 사용자입니다',
            severity: 'high'
          }],
          warnings: []
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: []
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'user_id',
          code: 'USER_VALIDATION_ERROR',
          message: '사용자 검증 중 오류가 발생했습니다',
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  private async validateMessage(messageId: string, userId: string): Promise<ValidationResult> {
    try {
      const supabase = createAuthenticatedServerClient();
      
      const { data: message, error } = await supabase
        .from('chat_messages')
        .select('id, user_id, chat_session_id')
        .eq('id', messageId)
        .single();

      if (error || !message) {
        return {
          isValid: false,
          errors: [{
            field: 'message_id',
            code: 'MESSAGE_NOT_FOUND',
            message: '메시지를 찾을 수 없습니다',
            severity: 'high'
          }],
          warnings: []
        };
      }

      // 메시지 소유권 확인
      const { data: chatSession } = await supabase
        .from('chat_sessions')
        .select('user_id')
        .eq('id', message.chat_session_id)
        .single();

      if (!chatSession || chatSession.user_id !== userId) {
        return {
          isValid: false,
          errors: [{
            field: 'message_id',
            code: 'MESSAGE_ACCESS_DENIED',
            message: '메시지에 대한 접근 권한이 없습니다',
            severity: 'high'
          }],
          warnings: []
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: []
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'message_id',
          code: 'MESSAGE_VALIDATION_ERROR',
          message: '메시지 검증 중 오류가 발생했습니다',
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  private async getUser(userId: string): Promise<any> {
    const supabase = createAuthenticatedServerClient();
    
    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active, subscription_tier, created_at')
      .eq('id', userId)
      .single();

    return user;
  }

  private async getUserTier(userId: string): Promise<string> {
    try {
      const user = await this.getUser(userId);
      return user?.subscription_tier || 'free';
    } catch (error) {
      console.warn('ImageGenerationSecurityService: 사용자 등급 조회 실패', { userId, error });
      return 'free';
    }
  }

  private getRateLimitConfig(action: string, userTier: string): any {
    const tierLimits = TIER_BASED_RATE_LIMITS[userTier as keyof typeof TIER_BASED_RATE_LIMITS];
    if (tierLimits && tierLimits[action as keyof typeof tierLimits]) {
      return tierLimits[action as keyof typeof tierLimits];
    }
    return this.config.rateLimits[action as keyof typeof this.config.rateLimits];
  }

  private async checkImageGenerationPermission(user: any, messageId?: string): Promise<PermissionResult> {
    // 기본적으로 활성 사용자는 이미지 생성 가능
    return {
      allowed: true
    };
  }

  private async checkImageDownloadPermission(user: any, imageId?: string): Promise<PermissionResult> {
    // 기본적으로 활성 사용자는 이미지 다운로드 가능
    return {
      allowed: true
    };
  }

  private async checkStyleLearningPermission(user: any): Promise<PermissionResult> {
    // 프리미엄 사용자만 스타일 학습 가능
    if (user.subscription_tier === 'free') {
      return {
        allowed: false,
        reason: '스타일 학습 기능은 프리미엄 사용자만 이용할 수 있습니다',
        requiredRole: 'premium'
      };
    }

    return {
      allowed: true
    };
  }

  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validProtocols = ['http:', 'https:'];
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      return validProtocols.includes(urlObj.protocol) &&
             validExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    this.rateLimiter.destroy();
  }
}

// 기본 인스턴스 생성 함수
export function createImageGenerationSecurityService(config?: Partial<SecurityConfig>): ImageGenerationSecurityService {
  return new ImageGenerationSecurityService(config);
}

// 싱글톤 인스턴스 (선택적)
let defaultInstance: ImageGenerationSecurityService | null = null;

export function getImageGenerationSecurityService(config?: Partial<SecurityConfig>): ImageGenerationSecurityService {
  if (!defaultInstance) {
    defaultInstance = new ImageGenerationSecurityService(config);
  }
  return defaultInstance;
}
