import { QuotaInfo } from '@/types/quota'
import { QuotaResetStrategy, ResetExecutionResult } from './QuotaResetStrategy'

/**
 * 리셋하지 않는 쿼터 전략
 * 누적형 쿼터나 영구적인 제한에 사용
 */
export class NoResetStrategy extends QuotaResetStrategy {
  shouldReset(quota: QuotaInfo): boolean {
    // 절대 리셋하지 않음
    console.log(`[NoResetStrategy] shouldReset: false for quota ${quota.quota_type}`)
    return false
  }

  reset(quota: QuotaInfo): QuotaInfo {
    // 리셋하지 않으므로 원본 그대로 반환
    console.log(`[NoResetStrategy] No reset performed for quota ${quota.quota_type}`)
    return quota
  }

  executeReset(quota: QuotaInfo): ResetExecutionResult {
    // 절대 리셋하지 않음
    return {
      shouldReset: false,
      newUsedCount: quota.used_count,
      newLastResetAt: quota.last_reset_at,
      newNextResetAt: quota.next_reset_at
    }
  }

  getResetTimeOnExhaustion(quota: QuotaInfo): Date | null {
    // 리셋하지 않으므로 null 반환
    return null
  }

  getStrategyName(): string {
    return 'NoResetStrategy'
  }
}
