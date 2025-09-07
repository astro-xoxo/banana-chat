/**
 * AI Face Chat Lite - Phase 2: Next.js App Router 호환 Supabase 서버 클라이언트
 * 작성일: 2025-07-14
 * 목적: Request 기반 직접 쿠키 파싱으로 인증 문제 완전 해결
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * 쿠키 문자열을 파싱하는 유틸리티 함수
 */
export const parseCookies = (cookieHeader: string | null): Record<string, string> => {
  const cookies: Record<string, string> = {}
  
  if (!cookieHeader) {
    console.log('🍪 Phase 2: 쿠키 헤더 없음')
    return cookies
  }

  try {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=')
      if (name && rest.length > 0) {
        cookies[name] = decodeURIComponent(rest.join('='))
      }
    })
    
    console.log('🍪 Phase 2: 쿠키 파싱 성공:', {
      총쿠키수: Object.keys(cookies).length,
      쿠키이름목록: Object.keys(cookies).slice(0, 5) // 처음 5개만 로깅
    })
  } catch (error) {
    console.error('❌ Phase 2: 쿠키 파싱 실패:', error)
  }

  return cookies
}

/**
 * Request에서 Supabase 인증 토큰을 추출하는 함수 (Phase 3: 프로덕션 최적화)
 */
export const extractAuthTokenFromRequest = (request: NextRequest): string | null => {
  const isProduction = process.env.VERCEL_ENV === 'production'
  const environment = isProduction ? 'production' : 'development'
  
  console.log(`🔍 Phase 3: 토큰 추출 시작 [${environment}]`)
  
  // Phase 3: 프로덕션 환경 전용 디버깅
  if (isProduction) {
    console.log('🔍 Phase 3: 프로덕션 환경 상세 분석:', {
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      domain: request.headers.get('host'),
      protocol: request.headers.get('x-forwarded-proto') || 'unknown',
      userAgent: request.headers.get('user-agent')?.substring(0, 50) + '...',
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      hasForwardedFor: !!request.headers.get('x-forwarded-for'),
      timestamp: new Date().toISOString()
    })
  }

  // 1. Authorization 헤더에서 Bearer 토큰 확인
  const authHeader = request.headers.get('authorization')
  console.log(`🔍 Phase 3: Authorization 헤더 [${environment}]:`, authHeader ? 'Bearer ' + authHeader.substring(7, 37) + '...' : '없음')
  
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7)
    console.log(`✅ Phase 3: Authorization 헤더에서 Bearer 토큰 발견 [${environment}]:`, bearerToken.substring(0, 20) + '...')
    return bearerToken
  }

  // 2. 쿠키에서 Supabase 토큰 추출 (Phase 3: 프로덕션 환경 강화)
  const cookieHeader = request.headers.get('cookie')
  
  if (isProduction) {
    console.log('🔍 Phase 3: 프로덕션 쿠키 상세 분석:', {
      hasCookieHeader: !!cookieHeader,
      cookieLength: cookieHeader?.length || 0,
      cookieCount: cookieHeader?.split(';').length || 0,
      cookiePreview: cookieHeader?.substring(0, 100) + '...' || 'none',
      hasSecureCookies: cookieHeader?.includes('Secure') || false,
      hasSameSite: cookieHeader?.includes('SameSite') || false,
      hasHttpOnly: cookieHeader?.includes('HttpOnly') || false
    })
  } else {
    console.log(`🔍 Phase 3: 쿠키 헤더 상태 [${environment}]:`, cookieHeader ? '존재함 (길이: ' + cookieHeader.length + ')' : '없음')
  }
  
  const cookies = parseCookies(cookieHeader)

  // Phase 3: 프로덕션 환경용 확장된 Supabase 쿠키 패턴
  const possibleTokenKeys = [
    'sb-thnboxxfxahwkawzgcjj-auth-token',
    'supabase-auth-token',
    'sb-auth-token',
    'supabase.auth.token',
    // Phase 3: 프로덕션 환경 추가 패턴
    'sb-thnboxxfxahwkawzgcjj-auth-token.0',
    'sb-thnboxxfxahwkawzgcjj-auth-token.1',
    '__Secure-sb-thnboxxfxahwkawzgcjj-auth-token',
    'supabase-auth-token-secure'
  ]

  // Phase 3: 프로덕션 환경에서 더 상세한 쿠키 토큰 검색
  for (const key of possibleTokenKeys) {
    const token = cookies[key]
    if (token) {
      const keyType = isProduction ? 'production' : 'development'
      console.log(`✅ Phase 3: 쿠키에서 토큰 발견 [${keyType}] (${key}):`, token.substring(0, 20) + '...')
      
      // JSON 형태의 토큰인 경우 파싱
      try {
        const parsedToken = JSON.parse(token)
        if (parsedToken.access_token) {
          console.log(`✅ Phase 3: JSON 토큰 파싱 성공 [${environment}]:`, parsedToken.access_token.substring(0, 20) + '...')
          return parsedToken.access_token
        }
      } catch (parseError) {
        // Phase 3: 프로덕션 환경에서 파싱 오류 상세 로깅
        if (isProduction) {
          console.log(`⚠️ Phase 3: JSON 파싱 실패, 원본 토큰 사용 [production] (${key}):`, {
            tokenLength: token.length,
            tokenStart: token.substring(0, 10),
            parseError: parseError instanceof Error ? parseError.message : 'unknown'
          })
        }
        // JSON이 아닌 경우 그대로 반환
        return token
      }
    }
  }

  // Phase 3: 프로덕션 환경에서 추가 쿠키 패턴 스캔
  if (isProduction) {
    console.log('🔍 Phase 3: 프로덕션 전체 쿠키 패턴 스캔:')
    Object.keys(cookies).forEach(key => {
      if (key.includes('supabase') || key.includes('auth') || key.includes('token') || key.includes('sb-')) {
        console.log(`  - 발견된 인증 관련 쿠키: ${key} (길이: ${cookies[key].length})`)
      }
    })
  }

  console.log(`❌ Phase 3: 인증 토큰을 찾을 수 없음 [${environment}]`)
  return null
}

/**
 * 환경변수 검증 함수
 */
export const validateEnvironment = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('🔍 Phase 2: 환경변수 검증:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  })

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 환경변수가 누락됨')
  }

  return { supabaseUrl, supabaseAnonKey }
}

/**
 * 서버 환경변수 검증 (Service Role 키용)
 */
export const validateServerEnvironment = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('🔍 Phase 2: 서버 환경변수 검증:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  })

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('서버 Supabase 환경변수가 누락됨')
  }

  return { supabaseUrl, supabaseServiceKey }
}

/**
 * Request 기반 인증된 Supabase 클라이언트 생성 (Phase 3: 프로덕션 최적화)
 */
export const createAuthenticatedServerClient = async (request: NextRequest) => {
  const { supabaseUrl, supabaseAnonKey } = validateEnvironment()
  const isProduction = process.env.VERCEL_ENV === 'production'
  
  console.log(`🔧 Phase 3: Supabase 클라이언트 생성 [수준{isProduction ? 'production' : 'development'}]`)
  
  // Phase 3: 프로덕션 환경 전용 설정
  const clientConfig = {
    auth: {
      autoRefreshToken: !isProduction, // 프로덕션에서는 비활성화
      persistSession: false,
      detectSessionInUrl: false, // Vercel 환경에서 URL 세션 감지 비활성화
      storageKey: isProduction ? 'sb-thnboxxfxahwkawzgcjj-auth-token' : undefined,
      ...(isProduction && {
        // 프로덕션 환경에서 HTTPS/Secure 쿠키 지원
        flowType: 'pkce',
        debug: false
      })
    },
    // Phase 3: 프로덕션 환경 전용 전역 설정
    ...(isProduction && {
      global: {
        headers: {
          'X-Client-Info': 'ai-face-chatbot@1.0.0',
          'User-Agent': 'ai-face-chatbot-production'
        }
      }
    })
  }
  
  if (isProduction) {
    console.log('🔧 Phase 3: 프로덕션 Supabase 설정:', {
      autoRefreshToken: clientConfig.auth.autoRefreshToken,
      persistSession: clientConfig.auth.persistSession,
      detectSessionInUrl: clientConfig.auth.detectSessionInUrl,
      storageKey: clientConfig.auth.storageKey
    })
  }
  
  // 클라이언트 생성
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, clientConfig)

  // Request에서 토큰 추출
  const authToken = extractAuthTokenFromRequest(request)
  
  if (authToken) {
    console.log(`🔄 Phase 3: 수동 세션 설정 시도 [수준{isProduction ? 'production' : 'development'}]`)
    
    try {
      // Phase 3: 프로덕션 환경에 최적화된 세션 데이터
      const sessionData = {
        access_token: authToken,
        refresh_token: authToken, // 임시로 같은 토큰 사용
        expires_in: isProduction ? 7200 : 3600, // 프로덕션에서는 더 긴 만료 시간
        expires_at: Math.floor(Date.now() / 1000) + (isProduction ? 7200 : 3600),
        token_type: 'bearer' as const,
        user: null // 사용자 정보는 별도로 조회
      }
      
      if (isProduction) {
        console.log('🔄 Phase 3: 프로덕션 세션 데이터:', {
          tokenLength: authToken.length,
          expiresIn: sessionData.expires_in,
          expiresAt: new Date(sessionData.expires_at * 1000).toISOString()
        })
      }
      
      // 동기적으로 세션 설정 시도
      const setSessionResult = await client.auth.setSession(sessionData)
      
      if (setSessionResult.error) {
        const errorMessage = setSessionResult.error.message
        console.warn(`⚠️ Phase 3: setSession 오류 [수준{isProduction ? 'production' : 'development'}]:`, {
          error: errorMessage,
          errorName: setSessionResult.error.name,
          tokenValid: authToken.length > 0
        })
        
        // Phase 3: 프로덕션 환경에서 세션 설정 실패 시 대안 방법
        if (isProduction && errorMessage.includes('session')) {
          console.log('🔄 Phase 3: 프로덕션 대안 인증 방법 준비')
          // 대안 방법은 verifyTokenDirectly에서 처리
        }
      } else {
        console.log(`✅ Phase 3: 세션 설정 성공 [수준{isProduction ? 'production' : 'development'}]`)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error
      console.warn(`⚠️ Phase 3: 수동 세션 설정 예외 [수준{isProduction ? 'production' : 'development'}]:`, {
        error: errorMessage,
        errorType: error instanceof Error ? error.name : 'unknown',
        tokenLength: authToken.length
      })
    }
  }

  return { client, authToken }
}

/**
 * 토큰 기반 직접 사용자 정보 조회 (대안 방법)
 */
export const verifyTokenDirectly = async (authToken: string): Promise<{ user: any, valid: boolean }> => {
  try {
    console.log('🔍 Phase 2: 대안 토큰 검증 시작')
    
    // Supabase의 사용자 정보 엔드포인트에 직접 요청
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      }
    })
    
    if (response.ok) {
      const user = await response.json()
      console.log('✅ Phase 2: 직접 토큰 검증 성공:', {
        userId: user.id?.substring(0, 8) + '...',
        email: user.email
      })
      return { user, valid: true }
    } else {
      console.error('❌ Phase 2: 직접 토큰 검증 실패:', response.status, response.statusText)
      return { user: null, valid: false }
    }
  } catch (error) {
    console.error('❌ Phase 2: 직접 토큰 검증 예외:', error)
    return { user: null, valid: false }
  }
}

/**
 * 서버용 Supabase 서비스 클라이언트 (관리자 권한)
 */
export const createSupabaseServiceClient = () => {
  const { supabaseUrl, supabaseServiceKey } = validateServerEnvironment()
  
  console.log('🔧 Phase 2: Supabase 서비스 클라이언트 생성')
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * 인증 상태 디버깅 헬퍼 (Phase 2)
 */
export const debugAuthState = async (client: any, context: string = 'unknown') => {
  try {
    console.log(`🔍 Phase 2: 인증 상태 상세 디버깅 시작 [${context}]`)
    
    // 1. 현재 세션 상태 확인
    const { data: { session }, error: sessionError } = await client.auth.getSession()
    
    // 2. 사용자 정보 확인 
    const { data: { user }, error: userError } = await client.auth.getUser()
    
    // 3. 토큰 유효성 검사 (가능한 경우)
    let tokenValid = false
    try {
      if (session?.access_token) {
        // JWT 토큰 기본 검증 (만료 시간 등)
        const tokenParts = session.access_token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]))
          tokenValid = payload.exp && payload.exp > Math.floor(Date.now() / 1000)
          console.log('🔍 Phase 2: 토큰 만료 시간:', new Date(payload.exp * 1000).toISOString())
        }
      }
    } catch (tokenError) {
      console.warn('⚠️ Phase 2: 토큰 검증 실패:', tokenError)
    }

    console.log(`🔍 Phase 2: 인증 상태 디버깅 [${context}]:`, {
      hasSession: !!session,
      hasUser: !!user,
      sessionError: sessionError?.message,
      userError: userError?.message,
      userId: user?.id?.substring(0, 8) + '...' || 'none',
      email: user?.email || 'none',
      authTimestamp: session?.expires_at || 'none',
      tokenValid: tokenValid,
      tokenExists: !!session?.access_token,
      environment: process.env.VERCEL_ENV || 'local'
    })

    return {
      session,
      user,
      isAuthenticated: !!(session && user && !sessionError && !userError && tokenValid)
    }
  } catch (error) {
    console.error(`❌ Phase 2: 인증 상태 확인 실패 [${context}]:`, error)
    return {
      session: null,
      user: null,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
