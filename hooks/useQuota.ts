// 쿼터 상태 관리 커스텀 Hook
// 클라이언트 사이드 직접 연동 방식 (대시보드와 동일한 패턴)

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { getQuotaClientService } from '@/lib/quota/QuotaClientService'
import { QuotaDisplay, QuotaType } from '@/types/quota'

interface UseQuotaReturn {
  quotas: QuotaDisplay[]
  loading: boolean
  error: string | null
  refreshQuotas: () => Promise<void>
  consumeQuota: (type: QuotaType) => Promise<{ success: boolean; message?: string }>
  syncAfterAction: () => Promise<void>
}

/**
 * 쿼터 상태 관리 Hook (클라이언트 사이드 방식)
 * 
 * 기능:
 * - 사용자 쿼터 직접 조회 (대시보드와 동일한 방식)
 * - 1분마다 자동 갱신 (24시간 타이머 체크)
 * - 쿼터 소진 처리
 * - 에러 상태 관리
 */
export const useQuota = (): UseQuotaReturn => {
  const { user } = useAuth()
  const [quotas, setQuotas] = useState<QuotaDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const quotaService = getQuotaClientService()

  /**
   * 쿼터 정보 조회 (클라이언트 사이드 직접 호출)
   */
  const fetchQuotas = useCallback(async (silent: boolean = false) => {
    if (!user?.id) {
      console.log('[useQuota] No user ID available')
      if (!silent) setLoading(false)
      return
    }

    try {
      setError(null)
      if (!silent) {
        console.log(`[useQuota] Fetching quotas for user: ${user.id}`)
      }
      
      const quotaData = await quotaService.getUserQuotas(user.id)
      setQuotas(quotaData)
      
      if (!silent) {
        console.log('[useQuota] Successfully fetched quotas:', quotaData.length)
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('[useQuota] Failed to fetch quotas:', err)
      
      // 에러 발생 시 빈 배열로 초기화 (UI 깨짐 방지)
      setQuotas([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id, quotaService])

  /**
   * 쿼터 소진 처리 (API 기반 통합)
   */
  const consumeQuota = useCallback(async (type: QuotaType) => {
    if (!user?.id) {
      return { 
        success: false, 
        message: '사용자 인증이 필요합니다.' 
      }
    }

    try {
      console.log(`[useQuota] Consuming quota via API: ${type}`)
      
      const result = await quotaService.consumeQuota(user.id, type)

      if (result.success) {
        // 성공 시 즉시 쿼터 상태 갱신 (동기화 문제 해결)
        console.log(`[useQuota] Quota consumed successfully, refreshing state: ${type}`)
        await fetchQuotas(true) // silent 갱신
      } else {
        console.log(`[useQuota] Failed to consume quota: ${type}`, result.message)
      }

      return result
      
    } catch (err) {
      console.error('[useQuota] Error consuming quota via API:', err)
      return { 
        success: false, 
        message: '쿼터 처리 중 오류가 발생했습니다.' 
      }
    }
  }, [user?.id, quotaService, fetchQuotas])

  /**
   * 액션 후 즉시 동기화 (채팅 후 호출용)
   */
  const syncAfterAction = useCallback(async () => {
    console.log('[useQuota] Syncing quotas after action (e.g., chat sent)')
    await fetchQuotas(true) // silent 갱신
  }, [fetchQuotas])

  /**
   * 수동 갱신
   */
  const refreshQuotas = useCallback(async () => {
    console.log('[useQuota] Manual quota refresh requested')
    setLoading(true)
    await fetchQuotas(false)
  }, [fetchQuotas])

  /**
   * 컴포넌트 마운트 시 및 주기적 갱신 + 실시간 동기화
   */
  useEffect(() => {
    if (user?.id) {
      console.log('[useQuota] User authenticated, initializing quota system')
      
      // 사용자 로그인 시 즉시 조회
      fetchQuotas(false)
      
      // 1분마다 자동 갱신 (시간 기반 리셋 업데이트)
      const interval = setInterval(() => {
        console.log('[useQuota] Auto-refreshing quotas for time-based reset check')
        fetchQuotas(true) // silent 갱신
      }, 60000) // 60초
      
      // 전역 이벤트 리스너 등록 (채팅 전송 후 동기화)
      const handleQuotaSync = () => {
        console.log('[useQuota] Global quota sync event received')
        fetchQuotas(true)
      }
      
      window.addEventListener('quota-sync', handleQuotaSync)
      
      return () => {
        clearInterval(interval)
        window.removeEventListener('quota-sync', handleQuotaSync)
        console.log('[useQuota] Cleanup: interval and event listeners removed')
      }
    }
  }, [user?.id, fetchQuotas])

  return { 
    quotas, 
    loading, 
    error, 
    refreshQuotas, 
    consumeQuota,
    syncAfterAction // Phase 4 완료: 액션 후 즉시 동기화
  }
}
