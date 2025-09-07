// 클라이언트 사이드 쿼터 서비스 (API 기반으로 리팩토링)
// 서버 API를 통한 할당량 관리로 통일

'use client'

import { QuotaDisplay, QuotaType } from '@/types/quota'
import { authenticatedFetch } from '@/lib/auth-fetch'

interface QuotaConsumption {
  success: boolean
  message?: string
}

export class QuotaClientService {
  private baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  /**
   * 현재 사용자의 모든 쿼터 정보 조회 (API 기반)
   */
  async getUserQuotas(userId: string): Promise<QuotaDisplay[]> {
    console.log(`[QuotaClientService] Fetching quotas via API for user: ${userId}`)

    try {
      const response = await authenticatedFetch(`${this.baseUrl}/api/quota`, {
        method: 'GET',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[QuotaClientService] API error:', {
          status: response.status,
          error: errorData
        })
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch quotas`)
      }

      const result = await response.json()
      const quotas: QuotaDisplay[] = result.quotas || []

      console.log(`[QuotaClientService] API에서 ${quotas.length}개 할당량 조회 성공:`, 
        quotas.map(q => `${q.type}: ${q.used}/${q.limit}`))
      
      return quotas

    } catch (error) {
      console.error('[QuotaClientService] Error fetching quotas via API:', error)
      
      // API 실패 시 기본값 반환 (UI 깨짐 방지)
      const defaultQuotas: QuotaDisplay[] = [
        { type: 'profile_image_generation', used: 0, limit: 1, canUse: true, nextResetAt: null, resetInHours: null, percentage: 0 },
        { type: 'chat_messages', used: 0, limit: 50, canUse: true, nextResetAt: null, resetInHours: null, percentage: 0 },
        { type: 'chat_image_generation', used: 0, limit: 5, canUse: true, nextResetAt: null, resetInHours: null, percentage: 0 }
      ]
      
      console.log('[QuotaClientService] API 실패로 기본값 반환')
      return defaultQuotas
    }
  }

  /**
   * 쿼터 소진 처리 (API 기반)
   */
  async consumeQuota(userId: string, quotaType: QuotaType): Promise<QuotaConsumption> {
    console.log(`[QuotaClientService] Consuming quota via API: ${quotaType} for user: ${userId}`)

    try {
      const response = await authenticatedFetch(`${this.baseUrl}/api/quota/consume`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          quota_type: quotaType,
          amount: 1
        })
      })

      const result = await response.json()

      if (!response.ok) {
        console.error('[QuotaClientService] API consume error:', {
          status: response.status,
          result
        })
        
        // 할당량 초과의 경우 친화적 메시지
        if (response.status === 429) {
          return {
            success: false,
            message: result.message || '일일 한도를 초과했습니다. 내일 다시 이용해주세요.'
          }
        }
        
        return {
          success: false,
          message: result.message || '쿼터 처리 중 오류가 발생했습니다.'
        }
      }

      console.log(`[QuotaClientService] API를 통한 할당량 소진 성공: ${quotaType}`, {
        used: result.quota_info?.used,
        limit: result.quota_info?.limit,
        remaining: result.quota_info?.remaining
      })

      return {
        success: true,
        message: result.message || `쿼터를 사용했습니다. (${result.quota_info?.used}/${result.quota_info?.limit})`
      }

    } catch (error) {
      console.error('[QuotaClientService] Error consuming quota via API:', error)
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }
    }
  }

  /**
   * 특정 쿼터 타입의 현재 상태 확인 (API 기반)
   */
  async checkQuotaAvailable(userId: string, quotaType: QuotaType): Promise<boolean> {
    try {
      const quotas = await this.getUserQuotas(userId)
      const targetQuota = quotas.find(q => q.type === quotaType)
      const available = targetQuota?.canUse ?? false
      
      console.log(`[QuotaClientService] Quota availability check: ${quotaType} = ${available}`, {
        used: targetQuota?.used,
        limit: targetQuota?.limit
      })
      
      return available
    } catch (error) {
      console.error('[QuotaClientService] Error checking quota availability via API:', error)
      return false
    }
  }
}

// 싱글톤 인스턴스
let quotaClientServiceInstance: QuotaClientService | null = null

export const getQuotaClientService = (): QuotaClientService => {
  if (!quotaClientServiceInstance) {
    quotaClientServiceInstance = new QuotaClientService()
  }
  return quotaClientServiceInstance
}
