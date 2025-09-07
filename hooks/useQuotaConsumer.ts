// 쿼터 소진 헬퍼 Hook
// 사용자 확인 및 쿼터 상태 체크 로직

import { useCallback } from 'react'
import { QuotaType, QuotaDisplay } from '@/types/quota'
import { useQuota } from './useQuota'

interface UseQuotaConsumerReturn {
  consumeWithConfirm: (type: QuotaType, action: string) => Promise<boolean>
  canConsume: (type: QuotaType) => boolean
  getQuotaStatus: (type: QuotaType) => QuotaDisplay | null
  getTimeRemaining: (type: QuotaType) => string | null
}

/**
 * 쿼터 소진 헬퍼 Hook
 * 
 * 기능:
 * - 쿼터 소진 전 사용자 확인
 * - 쿼터 사용 가능 여부 체크
 * - 쿼터 상태 정보 조회
 * - 충전 시간 정보 제공
 */
export const useQuotaConsumer = (): UseQuotaConsumerReturn => {
  const { quotas, consumeQuota } = useQuota()

  /**
   * 확인 후 쿼터 소진
   */
  const consumeWithConfirm = useCallback(async (
    type: QuotaType, 
    action: string
  ): Promise<boolean> => {
    const quota = quotas.find(q => q.type === type)
    
    // 쿼터 정보가 없거나 사용 불가능한 경우
    if (!quota || !quota.canUse) {
      const message = quota?.resetInHours 
        ? `쿼터가 소진되었습니다. ${quota.resetInHours}시간 후 자동 충전됩니다.`
        : '쿼터가 소진되었습니다.'
      
      alert(message)
      return false
    }

    // 마지막 쿼터인 경우 확인 요청
    if (quota.used === quota.limit - 1) {
      const confirmed = confirm(
        `${action}을 실행하면 쿼터가 모두 소진됩니다. 계속하시겠습니까?\n\n` +
        `소진 후 24시간 뒤 자동으로 충전됩니다.`
      )
      if (!confirmed) return false
    }

    // 쿼터 소진 실행
    const result = await consumeQuota(type)
    
    if (!result.success) {
      alert(result.message || '쿼터 소진에 실패했습니다.')
      return false
    }

    return true
  }, [quotas, consumeQuota])

  /**
   * 쿼터 사용 가능 여부 확인
   */
  const canConsume = useCallback((type: QuotaType): boolean => {
    const quota = quotas.find(q => q.type === type)
    return quota?.canUse || false
  }, [quotas])

  /**
   * 쿼터 상태 정보 조회
   */
  const getQuotaStatus = useCallback((type: QuotaType): QuotaDisplay | null => {
    return quotas.find(q => q.type === type) || null
  }, [quotas])

  /**
   * 충전 시간 정보 조회
   */
  const getTimeRemaining = useCallback((type: QuotaType): string | null => {
    const quota = quotas.find(q => q.type === type)
    
    if (!quota || quota.canUse) {
      return null
    }
    
    if (quota.resetInHours && quota.resetInHours > 0) {
      return quota.resetInHours > 1 
        ? `${quota.resetInHours}시간 후 충전`
        : '1시간 미만'
    }
    
    return '소진됨'
  }, [quotas])

  return {
    consumeWithConfirm,
    canConsume,
    getQuotaStatus,
    getTimeRemaining
  }
}
