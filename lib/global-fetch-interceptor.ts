/**
 * AI Face Chat Lite - Task 2: Global Fetch Interceptor
 * 작성일: 2025-07-17
 * 목적: 모든 fetch() 호출에 자동 Authorization 헤더 주입
 */

import { createClient } from '@supabase/supabase-js'

/**
 * 원본 fetch 함수 백업 (클라이언트 사이드에서만)
 */
const originalFetch = typeof window !== 'undefined' ? window.fetch : null

/**
 * Supabase 클라이언트 싱글톤
 */
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * 현재 인증 토큰 가져오기 (localStorage 직접 접근)
 */
const getCurrentAuthToken = async (): Promise<string | null> => {
  try {
    console.log('🔍 Global Interceptor: 토큰 가져오기 시작')
    
    // Task 6: Google OAuth 지원을 위한 다중 토큰 소스 확인
    const tokenSources = [
      'sb-thnboxxfxahwkawzgcjj-auth-token', // Supabase 기본
      'supabase.auth.token',                // Supabase 대체
      'google-oauth-token',                 // Google OAuth 전용 (가능)
      'auth-token',                         // 일반 토큰
      '__Secure-sb-thnboxxfxahwkawzgcjj-auth-token' // Secure 쿠키 백업
    ]
    
    for (const source of tokenSources) {
      try {
        const authData = localStorage.getItem(source)
        if (authData) {
          console.log(`🔍 Global Interceptor: ${source}에서 토큰 발견`)
          
          let token = null
          
          // JSON 형태인지 확인
          if (authData.startsWith('{')) {
            const parsedData = JSON.parse(authData)
            token = parsedData.access_token || parsedData.accessToken || parsedData.token
          } else if (authData.startsWith('eyJ')) {
            // 직접 JWT 토큰
            token = authData
          }
          
          if (token) {
            console.log('✅ Global Interceptor: 토큰 발견:', {
              source,
              hasToken: !!token,
              tokenPreview: token.substring(0, 20) + '...'
            })
            return token
          }
        }
      } catch (error) {
        console.log(`🔍 Global Interceptor: ${source} 파싱 실패:`, error)
      }
    }
    
    // sessionStorage 확인 (Google OAuth 콜백 시 임시 저장 가능)
    try {
      const sessionToken = sessionStorage.getItem('sb-thnboxxfxahwkawzgcjj-auth-token')
      if (sessionToken) {
        console.log('🔍 Global Interceptor: sessionStorage에서 토큰 발견')
        const parsed = JSON.parse(sessionToken)
        const token = parsed.access_token || parsed.accessToken || parsed.token
        if (token) {
          console.log('✅ Global Interceptor: sessionStorage JWT 토큰 사용')
          return token
        }
      }
    } catch (error) {
      console.log('🔍 Global Interceptor: sessionStorage 확인 실패:', error)
    }
    
    console.log('⚠️ Global Interceptor: localStorage에 토큰 없음, Supabase 획백 시도...')
    
    // 획백: Supabase 세션에서 가져오기
    const supabase = getSupabaseClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Global Interceptor: 세션 오류:', error)
      return null
    }
    
    const token = session?.access_token || null
    console.log('✅ Global Interceptor: Supabase 획백 결과:', {
      hasSession: !!session,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
      userEmail: session?.user?.email || 'none',
      authProvider: session?.user?.app_metadata?.provider || 'unknown'
    })
    
    return token
  } catch (error) {
    console.warn('🔍 Global Interceptor: 토큰 가져오기 실패:', error)
    return null
  }
}

/**
 * API 경로인지 확인
 */
const isApiPath = (url: string): boolean => {
  // 상대 경로 또는 같은 도메인의 /api/ 경로인지 확인
  return url.startsWith('/api/') || 
         url.includes('/api/') || 
         (typeof window !== 'undefined' && url.startsWith('http') && url.includes(window.location.origin + '/api/'))
}

/**
 * 외부 API인지 확인 (Supabase, Google 등)
 */
const isExternalApi = (url: string): boolean => {
  if (url.startsWith('/')) return false // 상대 경로는 내부 API
  
  const externalDomains = [
    'supabase.co',
    'googleapis.com',
    'google.com',
    'vercel.app'
  ]
  
  return externalDomains.some(domain => url.includes(domain))
}

/**
 * Global Fetch Interceptor
 */
const interceptedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  // 서버 사이드에서는 원본 fetch 사용
  if (typeof window === 'undefined' || !originalFetch) {
    // 전역 fetch나 Node.js fetch 사용
    return globalThis.fetch(input, init)
  }
  
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const isInternal = isApiPath(url)
  const isExternal = isExternalApi(url)
  
  console.log('🌐 Global Interceptor: 요청 분석:', {
    url: url.substring(0, 50) + '...',
    isInternal,
    isExternal,
    method: init?.method || 'GET'
  })

  // 내부 API 호출인 경우에만 Authorization 헤더 추가
  if (isInternal) {
    console.log('🔐 Global Interceptor: 내부 API 감지, 인증 헤더 추가 중...')
    
    try {
      const authToken = await getCurrentAuthToken()
      
      if (authToken) {
        // 기존 헤더와 Authorization 헤더 병합
        const enhancedInit = {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
            'Authorization': `Bearer ${authToken}`,
            'X-Global-Interceptor': 'enabled',
            'X-Auth-Source': 'global-fetch-interceptor'
          }
        }
        
        console.log('✅ Global Interceptor: Authorization 헤더 추가됨:', {
          hasToken: !!authToken,
          tokenPreview: authToken.substring(0, 20) + '...',
          url: url.substring(0, 30) + '...',
          method: enhancedInit.method || 'GET',
          headers: Object.keys(enhancedInit.headers || {})
        })
        
        console.log('🚀 Global Interceptor: 실제 fetch 실행 중...')
        
        const response = await originalFetch(input, enhancedInit)
        
        console.log('📡 Global Interceptor: 응답 수신:', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        })
        
        return response
      } else {
        console.warn('⚠️ Global Interceptor: 인증 토큰 없음, 원본 요청 전송')
        return originalFetch(input, init)
      }
    } catch (error) {
      console.error('❌ Global Interceptor: 인증 헤더 추가 실패:', error)
      return originalFetch(input, init)
    }
  } else {
    // 외부 API나 기타 요청은 그대로 통과
    console.log('🌍 Global Interceptor: 외부/기타 요청, 원본 전송')
    return originalFetch(input, init)
  }
}

/**
 * Global Fetch Interceptor 활성화
 */
export const enableGlobalFetchInterceptor = () => {
  if (typeof window === 'undefined') {
    console.warn('⚠️ Global Interceptor: 서버 환경에서는 활성화 불가')
    return
  }
  
  if (window.fetch === interceptedFetch) {
    console.log('✅ Global Interceptor: 이미 활성화됨')
    return
  }
  
  if (!originalFetch) {
    console.warn('⚠️ Global Interceptor: 원본 fetch 함수를 찾을 수 없음')
    return
  }
  
  // fetch 함수를 intercept된 버전으로 교체
  window.fetch = interceptedFetch
  
  console.log('🚀 Global Interceptor: 활성화 완료!')
  console.log('📋 Global Interceptor: 이제 모든 /api/ 호출에 자동 Authorization 헤더 추가됨')
}

/**
 * Global Fetch Interceptor 비활성화 (롤백용)
 */
export const disableGlobalFetchInterceptor = () => {
  if (typeof window === 'undefined') {
    console.warn('⚠️ Global Interceptor: 서버 환경에서는 비활성화 불가')
    return
  }
  
  if (originalFetch) {
    window.fetch = originalFetch
    console.log('🔄 Global Interceptor: 비활성화됨 (원본 fetch 복원)')
  }
}

/**
 * 테스트 함수
 */
export const testGlobalInterceptor = async () => {
  console.log('🧪 Global Interceptor: 테스트 시작')
  
  try {
    // 1. 내부 API 테스트 (자동 헤더 추가됨)
    console.log('🔍 테스트 1: 내부 API 호출')
    const response1 = await fetch('/api/users')
    console.log('내부 API 응답:', {
      status: response1.status,
      ok: response1.ok,
      statusText: response1.statusText
    })
    
    // 2. 외부 API 테스트 (헤더 추가 안됨)
    console.log('🔍 테스트 2: 외부 API 호출')
    const response2 = await fetch('https://httpbin.org/headers')
    console.log('외부 API 응답:', {
      status: response2.status,
      ok: response2.ok
    })
    
    console.log('✅ Global Interceptor: 테스트 완료')
    return true
  } catch (error) {
    console.error('❌ Global Interceptor: 테스트 실패:', error)
    return false
  }
}

export default {
  enable: enableGlobalFetchInterceptor,
  disable: disableGlobalFetchInterceptor,
  test: testGlobalInterceptor
}
