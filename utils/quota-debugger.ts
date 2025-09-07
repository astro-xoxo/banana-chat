// Client-side diagnostic utility for quota debugging
// 브라우저 콘솔에서 실행할 수 있는 진단 도구

export class QuotaDebugger {
  private baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

  /**
   * 전체 진단 실행 (브라우저 콘솔용)
   */
  async runFullDiagnosis() {
    console.group('🔍 Quota Issue Diagnosis - Full Report')
    console.log('timestamp:', new Date().toISOString())
    console.log('current_url:', window.location.href)
    
    try {
      // 1. 환경 정보
      console.group('📍 Environment Info')
      console.log('origin:', window.location.origin)
      console.log('user_agent:', navigator.userAgent.substring(0, 100))
      console.log('cookies_enabled:', navigator.cookieEnabled)
      console.groupEnd()

      // 2. 쿠키 상태 확인
      console.group('🍪 Cookie Analysis')
      const allCookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=')
        acc[name] = value ? 'PRESENT' : 'EMPTY'
        return acc
      }, {} as Record<string, string>)
      
      console.log('all_cookies:', allCookies)
      
      const authCookies = Object.keys(allCookies).filter(name => 
        name.includes('auth') || name.includes('sb-')
      )
      console.log('auth_cookies:', authCookies)
      console.groupEnd()

      // 3. API 테스트 - 일반 quota 엔드포인트
      console.group('🔗 API Test - /api/quota')
      try {
        const quotaResponse = await fetch(`${this.baseUrl}/api/quota`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        console.log('status:', quotaResponse.status)
        console.log('headers:', Object.fromEntries(quotaResponse.headers.entries()))
        
        const quotaData = await quotaResponse.json()
        console.log('response_data:', quotaData)
        
        if (quotaData.quotas) {
          const chatQuota = quotaData.quotas.find(q => q.type === 'chat_messages')
          console.log('🎯 chat_quota_found:', chatQuota)
        }
      } catch (error) {
        console.error('❌ quota_api_error:', error.message)
      }
      console.groupEnd()

      // 4. API 테스트 - 디버그 엔드포인트
      console.group('🛠️ API Test - /api/quota/debug')
      try {
        const debugResponse = await fetch(`${this.baseUrl}/api/quota/debug`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        console.log('debug_status:', debugResponse.status)
        const debugData = await debugResponse.json()
        console.log('debug_response:', debugData)
        
        // 핵심 진단 결과 하이라이트
        console.log('🔍 DIAGNOSIS:', debugData.diagnosis)
        console.log('🔍 DEBUG_STEPS:', debugData.debug_steps)
        
        if (debugData.db_test?.quota_data) {
          const chatQuota = debugData.db_test.quota_data.find(q => q.quota_type === 'chat_messages')
          console.log('🎯 ACTUAL_DB_CHAT_QUOTA:', chatQuota)
        }
        
      } catch (error) {
        console.error('❌ debug_api_error:', error.message)
      }
      console.groupEnd()

      // 5. 네트워크 탭 권장사항
      console.group('📝 Next Steps')
      console.log('1. Open Browser DevTools → Network tab')
      console.log('2. Refresh the page or trigger quota display')
      console.log('3. Check /api/quota request/response')
      console.log('4. Compare with /api/quota/debug response')
      console.log('5. Look for cookie differences between local and production')
      console.groupEnd()

    } catch (error) {
      console.error('💥 Diagnosis failed:', error)
    }

    console.groupEnd()
    return 'Diagnosis complete - check console output above'
  }

  /**
   * 단순 쿼터 상태 확인
   */
  async checkQuotaStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/api/quota`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      console.log('Quick quota check:', {
        status: response.status,
        quotas: data.quotas?.map(q => `${q.type}: ${q.used}/${q.limit}`)
      })
      
      return data
    } catch (error) {
      console.error('Quick quota check failed:', error)
      return null
    }
  }
}

// 전역 접근을 위한 인스턴스 생성
if (typeof window !== 'undefined') {
  (window as any).quotaDebugger = new QuotaDebugger()
  console.log('🔧 Quota debugger available: window.quotaDebugger.runFullDiagnosis()')
}

export const createQuotaDebugger = () => new QuotaDebugger()
