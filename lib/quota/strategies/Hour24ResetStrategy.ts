import { QuotaInfo } from '@/types/quota'
import { QuotaResetStrategy, ResetExecutionResult } from './QuotaResetStrategy'

/**
 * 24시간 주기 쿼터 리셋 전략
 * 매일 자정(00:00)에 쿼터를 초기화하는 전략
 */
export class Hour24ResetStrategy extends QuotaResetStrategy {
  shouldReset(quota: QuotaInfo): boolean {
    if (!quota.last_reset_at) return true

    const lastReset = new Date(quota.last_reset_at)
    const now = new Date()
    
    // 날짜가 다르면 리셋 필요
    const lastResetDate = lastReset.toDateString()
    const currentDate = now.toDateString()
    
    const shouldResetValue = lastResetDate !== currentDate
    console.log(`[Hour24ResetStrategy] shouldReset check:`, {
      quotaType: quota.quota_type,
      lastResetDate,
      currentDate,
      shouldReset: shouldResetValue
    })
    
    return shouldResetValue
  }

  reset(quota: QuotaInfo): QuotaInfo {
    const now = new Date()
    console.log(`[Hour24ResetStrategy] Resetting quota:`, {
      quotaType: quota.quota_type,
      previousUsed: quota.used_count,
      resetTime: now.toISOString()
    })

    return {
      ...quota,
      used_count: 0,
      last_reset_at: now
    }
  }

  executeReset(quota: QuotaInfo): ResetExecutionResult {
    const shouldResetValue = this.shouldReset(quota)
    
    if (shouldResetValue) {
      const now = new Date()
      return {
        shouldReset: true,
        newUsedCount: 0,
        newLastResetAt: now,
        newNextResetAt: this.getNextResetTime(now)
      }
    }
    
    return {
      shouldReset: false,
      newUsedCount: quota.used_count,
      newLastResetAt: quota.last_reset_at,
      newNextResetAt: quota.next_reset_at
    }
  }

  getResetTimeOnExhaustion(quota: QuotaInfo): Date | null {
    // 24시간 후 자정에 리셋
    const now = new Date()
    return this.getNextResetTime(now)
  }

  private getNextResetTime(from: Date): Date {
    // 다음날 자정 계산
    const nextReset = new Date(from)
    nextReset.setDate(nextReset.getDate() + 1)
    nextReset.setHours(0, 0, 0, 0)
    return nextReset
  }

  getStrategyName(): string {
    return 'Hour24ResetStrategy'
  }
}
