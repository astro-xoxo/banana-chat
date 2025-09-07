// 쿼터 검증 로직 클래스
// Single Responsibility Principle: 검증 로직만 담당

import { QuotaInfo, QuotaType, QuotaValidationResult } from '@/types/quota'

/**
 * 쿼터 검증 인터페이스
 * Interface Segregation Principle: 클라이언트가 필요한 메서드만 의존
 */
export interface IQuotaValidator {
  canConsume(quota: QuotaInfo): boolean
  shouldAutoReset(quota: QuotaInfo): boolean
  isValidQuotaType(type: string): boolean
  validateQuotaData(quota: QuotaInfo): QuotaValidationResult
}

/**
 * 쿼터 검증 로직 구현 클래스
 * 
 * SOLID 원칙 적용:
 * - Single Responsibility: 쿼터 관련 검증 로직만 담당
 * - Interface Segregation: 명확한 인터페이스 분리
 * - Dependency Inversion: 인터페이스 기반 설계
 */
export class QuotaValidator implements IQuotaValidator {
  /**
   * 쿼터 소진 가능 여부 확인
   * @param quota 확인할 쿼터 정보
   * @returns 소진 가능 여부
   */
  canConsume(quota: QuotaInfo): boolean {
    // 기본 조건: 사용량이 한도 미만
    if (quota.used_count >= quota.limit_count) {
      return false
    }

    // 음수 값 검증
    if (quota.used_count < 0 || quota.limit_count <= 0) {
      return false
    }

    return true
  }

  /**
   * 자동 리셋이 필요한지 확인
   * @param quota 확인할 쿼터 정보
   * @returns 자동 리셋 필요 여부
   */
  shouldAutoReset(quota: QuotaInfo): boolean {
    // next_reset_at이 설정되지 않았으면 리셋 불필요
    if (!quota.next_reset_at) {
      return false
    }

    // 현재 시간이 리셋 시점 이후인지 확인
    const now = new Date()
    return now >= quota.next_reset_at
  }

  /**
   * 유효한 쿼터 타입인지 확인
   * @param type 확인할 타입 문자열
   * @returns 유효한 쿼터 타입 여부
   */
  isValidQuotaType(type: string): boolean {
    return Object.values(QuotaType).includes(type as QuotaType)
  }

  /**
   * 쿼터 데이터 종합 검증
   * @param quota 검증할 쿼터 정보
   * @returns 상세 검증 결과
   */
  validateQuotaData(quota: QuotaInfo): QuotaValidationResult {
    const errors: string[] = []

    // 필수 필드 검증
    if (!quota.id || typeof quota.id !== 'string') {
      errors.push('Invalid quota ID')
    }

    if (!quota.user_id || typeof quota.user_id !== 'string') {
      errors.push('Invalid user ID')
    }

    if (!this.isValidQuotaType(quota.quota_type)) {
      errors.push('Invalid quota type')
    }

    // 숫자 필드 검증
    if (typeof quota.used_count !== 'number' || quota.used_count < 0) {
      errors.push('Invalid used count')
    }

    if (typeof quota.limit_count !== 'number' || quota.limit_count <= 0) {
      errors.push('Invalid limit count')
    }

    // 사용량이 한도를 초과하는지 확인
    if (quota.used_count > quota.limit_count) {
      errors.push('Used count exceeds limit')
    }

    // 날짜 필드 검증
    if (quota.next_reset_at && !(quota.next_reset_at instanceof Date)) {
      errors.push('Invalid next reset date')
    }

    if (quota.last_reset_at && !(quota.last_reset_at instanceof Date)) {
      errors.push('Invalid last reset date')
    }

    // 날짜 논리 검증
    if (quota.last_reset_at && quota.next_reset_at) {
      if (quota.last_reset_at > quota.next_reset_at) {
        errors.push('Last reset date cannot be after next reset date')
      }
    }

    const canConsume = errors.length === 0 && this.canConsume(quota)

    return {
      canConsume,
      reason: errors.length > 0 ? errors.join(', ') : undefined,
      resetAvailableAt: quota.next_reset_at || undefined
    }
  }

  /**
   * 쿼터 타입별 특수 검증 규칙
   */

  /**
   * 프로필 이미지 생성 쿼터 검증
   * @param quota 프로필 이미지 쿼터
   * @returns 검증 결과
   */
  validateProfileImageQuota(quota: QuotaInfo): QuotaValidationResult {
    if (quota.quota_type !== QuotaType.PROFILE_IMAGE_GENERATION) {
      return {
        canConsume: false,
        reason: 'Not a profile image quota'
      }
    }

    // 평생 1회 제한 확인
    if (quota.limit_count !== 1) {
      return {
        canConsume: false,
        reason: 'Profile image quota must have limit of 1'
      }
    }

    // 리셋 시점이 설정되어 있으면 안됨
    if (quota.next_reset_at !== null) {
      return {
        canConsume: false,
        reason: 'Profile image quota should not have reset time'
      }
    }

    return this.validateQuotaData(quota)
  }

  /**
   * 채팅 메시지 쿼터 검증
   * @param quota 채팅 메시지 쿼터
   * @returns 검증 결과
   */
  validateChatMessageQuota(quota: QuotaInfo): QuotaValidationResult {
    if (quota.quota_type !== QuotaType.CHAT_MESSAGES) {
      return {
        canConsume: false,
        reason: 'Not a chat message quota'
      }
    }

    // 기본 한도 확인 (50개)
    if (quota.limit_count !== 50) {
      return {
        canConsume: false,
        reason: 'Chat message quota must have limit of 50'
      }
    }

    return this.validateQuotaData(quota)
  }

  /**
   * 챗봇 생성 쿼터 검증
   * @param quota 챗봇 생성 쿼터
   * @returns 검증 결과
   */
  validateChatbotCreationQuota(quota: QuotaInfo): QuotaValidationResult {
    if (quota.quota_type !== QuotaType.CHATBOT_CREATION) {
      return {
        canConsume: false,
        reason: 'Not a chatbot creation quota'
      }
    }

    // 기본 한도 확인 (3개)
    if (quota.limit_count !== 3) {
      return {
        canConsume: false,
        reason: 'Chatbot creation quota must have limit of 3'
      }
    }

    return this.validateQuotaData(quota)
  }

  /**
   * 쿼터 타입에 따른 자동 검증
   * @param quota 검증할 쿼터
   * @returns 타입별 검증 결과
   */
  validateByType(quota: QuotaInfo): QuotaValidationResult {
    switch (quota.quota_type) {
      case QuotaType.PROFILE_IMAGE_GENERATION:
        return this.validateProfileImageQuota(quota)
      
      case QuotaType.CHAT_MESSAGES:
        return this.validateChatMessageQuota(quota)
      
      case QuotaType.CHATBOT_CREATION:
        return this.validateChatbotCreationQuota(quota)
      
      default:
        return {
          canConsume: false,
          reason: 'Unknown quota type'
        }
    }
  }

  /**
   * 디버깅용 검증 정보
   * @param quota 확인할 쿼터
   * @returns 검증 관련 상세 정보
   */
  getValidationDebugInfo(quota: QuotaInfo): Record<string, any> {
    const validation = this.validateQuotaData(quota)
    const typeValidation = this.validateByType(quota)

    return {
      quota: {
        id: quota.id,
        type: quota.quota_type,
        used: quota.used_count,
        limit: quota.limit_count,
        nextResetAt: quota.next_reset_at
      },
      validation: {
        canConsume: validation.canConsume,
        reason: validation.reason,
        shouldAutoReset: this.shouldAutoReset(quota)
      },
      typeValidation: {
        canConsume: typeValidation.canConsume,
        reason: typeValidation.reason
      },
      checks: {
        validType: this.isValidQuotaType(quota.quota_type),
        withinLimit: quota.used_count < quota.limit_count,
        positiveValues: quota.used_count >= 0 && quota.limit_count > 0,
        validDates: this.validateDates(quota)
      }
    }
  }

  /**
   * 날짜 필드 유효성 검증
   * @param quota 쿼터 정보
   * @returns 날짜 유효성 검증 결과
   */
  private validateDates(quota: QuotaInfo): boolean {
    if (quota.next_reset_at && !(quota.next_reset_at instanceof Date)) {
      return false
    }
    
    if (quota.last_reset_at && !(quota.last_reset_at instanceof Date)) {
      return false
    }

    if (quota.last_reset_at && quota.next_reset_at) {
      return quota.last_reset_at <= quota.next_reset_at
    }

    return true
  }
}
