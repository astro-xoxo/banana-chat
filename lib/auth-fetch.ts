/**
 * AI Face Chat Lite - Stage 3: 인증 시스템 안정화
 * 작성일: 2025-07-16
 * 목적: 토큰 전달 시스템 안정화 및 자동 갱신 로직 구현
 */

import { createSupabaseClient } from '@/lib/supabase-client'

/**
 * Stage 3: 토큰 갱신 함수 (싱글톤 클라이언트 사용)
 */
const refreshAuthToken = async (): Promise<string | null> => {
  try {
    console.log('🔄 Stage 3: 토큰 갱신 시도 중...')
    
    // Task 5: 싱글톤 클라이언트 사용 (Multiple GoTrueClient 방지)
    const supabase = createSupabaseClient()
    const { data: { session }, error } = await supabase.auth.refreshSession()
    
    if (error) {
      console.error('❌ Stage 3: 토큰 갱신 실패:', error.message)
      return null
    }
    
    if (!session?.access_token) {
      console.error('❌ Stage 3: 갱신된 세션에 토큰 없음')
      return null
    }
    
    console.log('✅ Stage 3: 토큰 갱신 성공')
    return session.access_token
    
  } catch (error) {
    console.error('❌ Stage 3: 토큰 갱신 중 예외 발생:', error)
    return null
  }
}

/**
 * Stage 3: 토큰 만료 확인 함수
 */
const isTokenExpired = (token: string): boolean => {
  try {
    // JWT 토큰의 payload 부분 파싱
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentTime = Math.floor(Date.now() / 1000)
    
    // 토큰이 5분 이내에 만료되면 갱신 필요
    const bufferTime = 5 * 60 // 5분
    const isExpiringSoon = payload.exp - currentTime < bufferTime
    
    if (isExpiringSoon) {
      console.log('⏰ Stage 3: 토큰이 곧 만료됨, 갱신 필요')
    }
    
    return isExpiringSoon
  } catch (error) {
    console.error('❌ Stage 3: 토큰 만료 확인 실패, 갱신 시도:', error)
    return true // 파싱 실패 시 갱신 시도
  }
}

/**
 * Stage 3: 재시도 로직이 포함된 인증된 fetch 함수
 */
export const authenticatedFetch = async (
  url: string, 
  options: RequestInit = {},
  maxRetries: number = 2
): Promise<Response> => {
  const isProduction = typeof window !== 'undefined' && 
    (window.location.hostname === 'ai-face-chatbot.vercel.app' || 
     window.location.protocol === 'https:')
  const environment = isProduction ? 'production' : 'development'
  
  console.log(`🔐 Stage 3: 안정화된 인증 fetch 시작 [${environment}]:`, url)

  let lastError: Error | null = null
  
  // Stage 3: 재시도 루프
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const supabase = createSupabaseClient()
      
      // 현재 세션 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error(`❌ Stage 3: 세션 가져오기 실패 [${environment}] - 시도 ${attempt + 1}:`, sessionError.message)
        lastError = new Error(`세션 오류: ${sessionError.message}`)
        
        if (attempt < maxRetries) {
          console.log(`🔄 Stage 3: ${1000 * (attempt + 1)}ms 후 재시도...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
          continue
        }
        throw lastError
      }

      let accessToken = session?.access_token

      if (!accessToken) {
        console.error(`❌ Stage 3: 액세스 토큰 없음 [${environment}] - 시도 ${attempt + 1}`)
        lastError = new Error('인증 토큰이 없습니다. 다시 로그인해주세요.')
        
        if (attempt < maxRetries) {
          console.log('🔄 Stage 3: 토큰 갱신 시도 중...')
          accessToken = await refreshAuthToken()
          
          if (!accessToken) {
            console.log(`🔄 Stage 3: ${2000 * (attempt + 1)}ms 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)))
            continue
          }
        } else {
          throw lastError
        }
      }

      // Stage 3: 토큰 만료 확인 및 자동 갱신
      if (accessToken && isTokenExpired(accessToken)) {
        console.log('🔄 Stage 3: 토큰 자동 갱신 중...')
        const refreshedToken = await refreshAuthToken()
        
        if (refreshedToken) {
          accessToken = refreshedToken
        } else {
          console.warn('⚠️ Stage 3: 토큰 자동 갱신 실패, 기존 토큰으로 계속 진행')
        }
      }

      console.log(`✅ Stage 3: 유효한 토큰 확보 [${environment}] - 시도 ${attempt + 1}`)

      // Stage 3: 개선된 헤더 설정
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Request-Attempt': String(attempt + 1),
        'X-Max-Retries': String(maxRetries),
        ...(isProduction && {
          'X-Client-Environment': 'production',
          'X-Client-Origin': window.location.origin,
          'X-Client-Timestamp': new Date().toISOString()
        }),
        ...options.headers
      }

      console.log(`📡 Stage 3: API 요청 전송 [${environment}] - 시도 ${attempt + 1}:`, {
        url: url.substring(0, 50) + '...',
        method: options.method || 'GET',
        hasAuthHeader: !!headers.Authorization,
        attempt: attempt + 1,
        maxRetries
      })

      // 실제 API 요청
      const response = await fetch(url, {
        ...options,
        headers
      })

      console.log(`📡 Stage 3: API 응답 수신 [${environment}] - 시도 ${attempt + 1}:`, {
        status: response.status,
        statusText: response.statusText,
        success: response.ok
      })
      
      // Stage 3: 401 오류 시 토큰 갱신 후 재시도
      if (response.status === 401 && attempt < maxRetries) {
        console.warn(`⚠️ Stage 3: 401 인증 실패 [${environment}] - 시도 ${attempt + 1}, 토큰 갱신 후 재시도`)
        
        const refreshedToken = await refreshAuthToken()
        if (refreshedToken) {
          console.log('🔄 Stage 3: 토큰 갱신 성공, 재시도 중...')
          await new Promise(resolve => setTimeout(resolve, 500)) // 짧은 대기
          continue
        } else {
          console.error('❌ Stage 3: 토큰 갱신 실패, 로그인 필요')
          lastError = new Error('인증 만료: 다시 로그인해주세요.')
          break
        }
      }

      // Stage 3: 네트워크 오류 시 재시도
      if (!response.ok && response.status >= 500 && attempt < maxRetries) {
        console.warn(`⚠️ Stage 3: 서버 오류 ${response.status} [${environment}] - 시도 ${attempt + 1}, 재시도 중`)
        lastError = new Error(`서버 오류: ${response.status} ${response.statusText}`)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        continue
      }

      console.log(`✅ Stage 3: API 요청 완료 [${environment}] - 시도 ${attempt + 1}/${maxRetries + 1}`)
      return response

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Stage 3: 인증 fetch 시도 ${attempt + 1} 실패 [${environment}]:`, {
        error: errorMessage,
        url: url.substring(0, 50) + '...',
        method: options.method || 'GET',
        attempt: attempt + 1,
        maxRetries
      })
      
      lastError = error instanceof Error ? error : new Error(errorMessage)
      
      // Stage 3: 네트워크 오류 등에 대한 재시도
      if (attempt < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000) // 지수 백오프 (최대 5초)
        console.log(`🔄 Stage 3: ${retryDelay}ms 후 재시도... (${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
    }
  }

  // 모든 재시도 실패
  console.error(`❌ Stage 3: 모든 재시도 실패 [${environment}]:`, lastError?.message)
  throw lastError || new Error('모든 인증 시도가 실패했습니다.')
}

/**
 * Stage 3: 개선된 인증 상태 확인 함수
 */
export const checkAuthStatus = async () => {
  try {
    const supabase = createSupabaseClient()
    
    // 세션 확인
    const { data: { session }, error } = await supabase.auth.getSession()
    
    let authStatus = {
      isAuthenticated: !!session?.access_token,
      session,
      error,
      tokenExpired: false,
      needsRefresh: false
    }
    
    // Stage 3: 토큰 만료 확인
    if (session?.access_token) {
      const expired = isTokenExpired(session.access_token)
      authStatus.tokenExpired = expired
      authStatus.needsRefresh = expired
      
      console.log('🔍 Stage 3: 인증 상태 확인:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        userEmail: session?.user?.email || 'none',
        tokenExpired: expired,
        needsRefresh: expired,
        error: error?.message || 'none'
      })
    }

    return authStatus
    
  } catch (error) {
    console.error('❌ Stage 3: 인증 상태 확인 실패:', error)
    return {
      isAuthenticated: false,
      session: null,
      error,
      tokenExpired: true,
      needsRefresh: true
    }
  }
}

/**
 * Stage 3: 토큰 수동 갱신 및 가져오기 (개선됨)
 */
export const getAuthToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  try {
    const supabase = createSupabaseClient()
    
    if (forceRefresh) {
      console.log('🔄 Stage 3: 강제 토큰 갱신 요청')
      const refreshedToken = await refreshAuthToken()
      
      if (refreshedToken) {
        console.log('✅ Stage 3: 강제 토큰 갱신 성공')
        return refreshedToken
      }
    }
    
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || null
    
    // Stage 3: 토큰 만료 확인
    if (token && isTokenExpired(token)) {
      console.log('🔄 Stage 3: 만료된 토큰 감지, 자동 갱신 중...')
      const refreshedToken = await refreshAuthToken()
      
      if (refreshedToken) {
        return refreshedToken
      } else {
        console.warn('⚠️ Stage 3: 토큰 갱신 실패, 만료된 토큰 반환')
      }
    }
    
    console.log('🎫 Stage 3: 토큰 가져오기 결과:', {
      hasToken: !!token,
      tokenPreview: token?.substring(0, 20) + '...' || 'none',
      wasRefreshed: forceRefresh
    })
    
    return token
  } catch (error) {
    console.error('❌ Stage 3: 토큰 가져오기 실패:', error)
    return null
  }
}

/**
 * Stage 3: 연결 상태 테스트 함수
 */
export const testAuthConnection = async (): Promise<boolean> => {
  try {
    console.log('🧪 Stage 3: 인증 연결 테스트 시작')
    
    const response = await authenticatedFetch('/api/users', { method: 'GET' })
    const success = response.ok
    
    console.log('🧪 Stage 3: 인증 연결 테스트 결과:', {
      success,
      status: response.status,
      statusText: response.statusText
    })
    
    return success
  } catch (error) {
    console.error('❌ Stage 3: 인증 연결 테스트 실패:', error)
    return false
  }
}