// 쿼터 비즈니스 로직 서비스
// SOLID 원칙을 준수하는 메인 서비스 클래스

import { 
  QuotaInfo, 
  QuotaType, 
  QuotaDisplay, 
  QuotaConsumeResult, 
  QUOTA_CONFIGS,
  QuotaError 
} from '@/types/quota'
import { IQuotaRepository } from './QuotaRepository'
import { IQuotaValidator } from './QuotaValidator'
import { QuotaResetStrategy } from './strategies/QuotaResetStrategy'
import { Hour24ResetStrategy } from './strategies/Hour24ResetStrategy'
import { NoResetStrategy } from './strategies/NoResetStrategy'

/**
 * 쿼터 서비스 인터페이스
 * Interface Segregation Principle: 필요한 메서드만 정의
 */
export interface IQuotaService {
  getUserQuotas(userId: string): Promise<QuotaDisplay[]>
  consumeQuota(userId: string, quotaType: QuotaType, amount?: number): Promise<QuotaConsumeResult>
  checkQuotaAvailability(userId: string, quotaType: QuotaType): Promise<QuotaDisplay>
  resetQuotaIfNeeded(quota: QuotaInfo): Promise<QuotaInfo>
}

/**
 * 쿼터 관리 메인 서비스 클래스
 * 
 * SOLID 원칙 적용:
 * - Single Responsibility: 쿼터 비즈니스 로직만 담당
 * - Open/Closed: 새로운 쿼터 타입이나 전략 추가 시 기존 코드 수정 없이 확장
 * - Liskov Substitution: 인터페이스 구현체들이 상호 교체 가능
 * - Interface Segregation: 필요한 인터페이스만 의존
 * - Dependency Inversion: 구체 클래스가 아닌 추상화에 의존
 */
export class QuotaService implements IQuotaService {
  constructor(
    private repository: IQuotaRepository,
    private validator: IQuotaValidator
  ) {
    console.log('[QuotaService] Service initialized with repository and validator')
  }

  /**
   * 사용자의 모든 쿼터 정보 조회 (누락된 쿼터 자동 생성 포함)
   * @param userId 사용자 ID
   * @returns 사용자의 모든 쿼터 표시 정보
   */
  async getUserQuotas(userId: string): Promise<QuotaDisplay[]> {
    try {
      console.log(`[QuotaService] Getting quotas for user: ${userId}`)

      // 기존 쿼터 조회
      let quotas = await this.repository.findByUserId(userId)
      console.log(`[QuotaService] Found ${quotas.length} existing quotas`)

      // 누락된 쿼터 타입 확인 및 생성
      const existingTypes = quotas.map(q => q.quota_type)
      const missingTypes = Object.values(QuotaType).filter(
        type => !existingTypes.includes(type)
      )

      if (missingTypes.length > 0) {
        console.log(`[QuotaService] Creating ${missingTypes.length} missing quota types:`, missingTypes)
        
        for (const type of missingTypes) {
          try {
            const config = QUOTA_CONFIGS[type]
            const newQuota = await this.repository.createQuota({
              user_id: userId,
              quota_type: type,
              used_count: 0,
              limit_count: config.defaultLimit,
              last_reset_at: null,
              next_reset_at: null
            })
            quotas.push(newQuota)
            console.log(`[QuotaService] Created missing quota: ${type}`)
          } catch (error) {
            console.error(`[QuotaService] Failed to create quota ${type}:`, error)
          }
        }
      }

      // 자동 리셋 체크 및 UI 모델 변환
      const displayQuotas = await Promise.all(
        quotas.map(async quota => {
          const resetQuota = await this.resetQuotaIfNeeded(quota)
          return this.toDisplayModel(resetQuota)
        })
      )

      console.log(`[QuotaService] Returning ${displayQuotas.length} quotas for user: ${userId}`)
      return displayQuotas

    } catch (error) {
      console.error('[QuotaService] Error in getUserQuotas:', error)
      
      if (error instanceof QuotaError) {
        throw error
      }
      
      throw new QuotaError(
        'Failed to get user quotas',
        'DB_ERROR'
      )
    }
  }





  /**
   * 쿼터 소진 처리 (Public API용)
   * @param userId 사용자 ID
   * @param quotaType 소진할 쿼터 타입
   * @param amount 소진할 양 (기본값: 1)
   * @returns 소진 결과
   */
  async consumeQuota(userId: string, quotaType: QuotaType, amount: number = 1): Promise<QuotaConsumeResult> {
    try {
      console.log(`[QuotaService] Public consumeQuota called for user: ${userId}, type: ${quotaType}, amount: ${amount}`)

      // 쿼터 조회 (없으면 생성)
      let quota = await this.repository.findByUserIdAndType(userId, quotaType)
      
      if (!quota) {
        console.log(`[QuotaService] Creating missing quota for type: ${quotaType}`)
        const config = QUOTA_CONFIGS[quotaType]
        quota = await this.repository.createQuota({
          user_id: userId,
          quota_type: quotaType,
          used_count: 0,
          limit_count: config.defaultLimit,
          last_reset_at: null,
          next_reset_at: null
        })
      }

      // 자동 리셋 체크
      const resetQuota = await this.resetQuotaIfNeeded(quota)

      // 소진 가능 여부 검증
      if (resetQuota.used_count + amount > resetQuota.limit_count) {
        const display = this.toDisplayModel(resetQuota)
        const message = this.generateQuotaExhaustedMessage(resetQuota)
        
        console.log(`[QuotaService] Quota exhausted for user: ${userId}, type: ${quotaType}, current: ${resetQuota.used_count}, limit: ${resetQuota.limit_count}, requested: ${amount}`)
        return { 
          success: false, 
          quota: display, 
          message,
          remaining: resetQuota.limit_count - resetQuota.used_count
        }
      }

      // 쿼터 소진 처리
      const consumedQuota = await this.consumeQuotaInternal(resetQuota, amount)
      const display = this.toDisplayModel(consumedQuota)

      console.log(`[QuotaService] Successfully consumed ${amount} quota for user: ${userId}, type: ${quotaType}`)
      return { 
        success: true, 
        quota: display,
        remaining: consumedQuota.limit_count - consumedQuota.used_count
      }

    } catch (error) {
      console.error('[QuotaService] Error in consumeQuota:', error)
      
      if (error instanceof QuotaError) {
        throw error
      }
      
      throw new QuotaError(
        'Failed to consume quota',
        'DB_ERROR'
      )
    }
  }

  /**
   * 쿼터 사용 가능 여부만 확인 (소진하지 않음)
   * @param userId 사용자 ID
   * @param quotaType 확인할 쿼터 타입
   * @returns 쿼터 표시 정보
   */
  async checkQuotaAvailability(userId: string, quotaType: QuotaType): Promise<QuotaDisplay> {
    try {
      console.log(`[QuotaService] Checking availability for user: ${userId}, type: ${quotaType}`)

      let quota = await this.repository.findByUserIdAndType(userId, quotaType)
      
      if (!quota) {
        const config = QUOTA_CONFIGS[quotaType]
        quota = await this.repository.createQuota({
          user_id: userId,
          quota_type: quotaType,
          used_count: 0,
          limit_count: config.defaultLimit,
          last_reset_at: null,
          next_reset_at: null
        })
      }

      const resetQuota = await this.resetQuotaIfNeeded(quota)
      return this.toDisplayModel(resetQuota)

    } catch (error) {
      console.error('[QuotaService] Error in checkQuotaAvailability:', error)
      
      if (error instanceof QuotaError) {
        throw error
      }
      
      throw new QuotaError(
        'Failed to check quota availability',
        'DB_ERROR'
      )
    }
  }

  /**
   * 필요한 경우 쿼터 자동 리셋 수행
   * @param quota 확인할 쿼터 정보
   * @returns 리셋 후 쿼터 정보
   */
  async resetQuotaIfNeeded(quota: QuotaInfo): Promise<QuotaInfo> {
    try {
      const strategy = this.getResetStrategy(quota.quota_type)
      const resetInfo = strategy.executeReset(quota)

      if (!resetInfo.shouldReset) {
        return quota
      }

      console.log(`[QuotaService] Auto-resetting quota: ${quota.id}, type: ${quota.quota_type}`)

      const resetQuota: QuotaInfo = {
        ...quota,
        used_count: resetInfo.newUsedCount,
        last_reset_at: resetInfo.newLastResetAt,
        next_reset_at: resetInfo.newNextResetAt
      }

      await this.repository.updateQuota(resetQuota)
      
      console.log(`[QuotaService] Successfully reset quota: ${quota.id}`)
      return resetQuota

    } catch (error) {
      console.error('[QuotaService] Error in resetQuotaIfNeeded:', error)
      
      // 리셋 실패 시 원본 쿼터 반환 (서비스 중단 방지)
      return quota
    }
  }

  /**
   * 쿼터 소진 처리 (내부 메서드)
   * @param quota 소진할 쿼터 정보
   * @param amount 소진할 양 (기본값: 1)
   * @returns 소진 후 쿼터 정보
   */
  private async consumeQuotaInternal(quota: QuotaInfo, amount: number = 1): Promise<QuotaInfo> {
    console.log(`[QuotaService] consumeQuotaInternal 시작:`, {
      quotaId: quota.id,
      quotaType: quota.quota_type,
      currentUsed: quota.used_count,
      amount: amount
    })
    
    const newUsedCount = quota.used_count + amount
    const strategy = this.getResetStrategy(quota.quota_type)
    
    // 소진 후 다음 리셋 시점 결정
    const nextResetAt = newUsedCount >= quota.limit_count 
      ? strategy.getResetTimeOnExhaustion(quota)
      : quota.next_reset_at
  
    const updatedQuota: QuotaInfo = {
      ...quota,
      used_count: newUsedCount,
      next_reset_at: nextResetAt
    }
    
    console.log(`[QuotaService] updateQuota 호출 전:`, {
      updatedQuota: updatedQuota,
      newUsedCount: newUsedCount
    })
    
    await this.repository.updateQuota(updatedQuota)
    
    console.log(`[QuotaService] Quota consumed: ${quota.quota_type}, new count: ${newUsedCount}/${quota.limit_count}`)
    return updatedQuota
  }
  /**
   * 쿼터 타입에 따른 리셋 전략 반환
   * @param quotaType 쿼터 타입
   * @returns 해당 타입의 리셋 전략
   */
  private getResetStrategy(quotaType: QuotaType): QuotaResetStrategy {
    const config = QUOTA_CONFIGS[quotaType]
    
    switch (config.resetStrategy) {
      case '24hours':
        return new Hour24ResetStrategy()
      
      case 'none':
        return new NoResetStrategy()
      
      default:
        console.warn(`[QuotaService] Unknown reset strategy: ${config.resetStrategy}, using NoResetStrategy`)
        return new NoResetStrategy()
    }
  }

  /**
   * QuotaInfo를 QuotaDisplay 모델로 변환
   * @param quota 변환할 쿼터 정보
   * @returns UI 친화적 쿼터 표시 정보
   */
  private toDisplayModel(quota: QuotaInfo): QuotaDisplay {
    const resetInHours = quota.next_reset_at 
      ? Math.ceil((quota.next_reset_at.getTime() - Date.now()) / (1000 * 60 * 60))
      : null

    const percentage = quota.limit_count > 0 
      ? (quota.used_count / quota.limit_count) * 100
      : 0

    return {
      type: quota.quota_type,
      used: quota.used_count,
      limit: quota.limit_count,
      canUse: quota.used_count < quota.limit_count,
      nextResetAt: quota.next_reset_at,
      resetInHours: resetInHours && resetInHours > 0 ? resetInHours : null,
      percentage: Math.min(100, percentage)
    }
  }

  /**
   * 쿼터 소진 시 사용자 메시지 생성
   * @param quota 소진된 쿼터 정보
   * @returns 사용자 친화적 메시지
   */
  private generateQuotaExhaustedMessage(quota: QuotaInfo): string {
    const config = QUOTA_CONFIGS[quota.quota_type]
    
    if (config.resetStrategy === 'none') {
      return `${config.description} - 더 이상 사용할 수 없습니다.`
    }
    
    if (quota.next_reset_at) {
      const hoursRemaining = Math.ceil(
        (quota.next_reset_at.getTime() - Date.now()) / (1000 * 60 * 60)
      )
      
      if (hoursRemaining <= 0) {
        return '곧 자동 충전됩니다. 잠시 후 다시 시도해주세요.'
      }
      
      return `쿼터가 소진되었습니다. ${hoursRemaining}시간 후 자동 충전됩니다.`
    }
    
    return '쿼터가 소진되었습니다.'
  }

  /**
   * 디버깅용 서비스 상태 정보
   * @param userId 특정 사용자 ID (선택적)
   * @returns 서비스 상태 정보
   */
  async getDebugInfo(userId?: string): Promise<Record<string, any>> {
    try {
      const quotas = userId ? await this.repository.findByUserId(userId) : []
      
      return {
        service: 'QuotaService',
        userId: userId || 'not specified',
        quotaCount: quotas.length,
        quotaTypes: quotas.map(q => q.quota_type),
        strategies: {
          '24hours': new Hour24ResetStrategy().getStrategyName(),
          'none': new NoResetStrategy().getStrategyName()
        },
        configs: Object.keys(QUOTA_CONFIGS),
        repositoryInfo: await this.repository.getDebugInfo(userId)
      }
    } catch (error) {
      return {
        service: 'QuotaService',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
