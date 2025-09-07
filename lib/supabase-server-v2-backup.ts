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
 * Request에서 Supabase 인증 토큰을 추출하는 함수
 */
export const extractAuthTokenFromRequest = (request: NextRequest): string | null => {
  console.log('🔍 Phase 2: 토큰 추출 시작')

  // 1. Authorization 헤더에서 Bearer 토큰 확인
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7)
    console.log('✅ Phase 2: Authorization 헤더에서 Bearer 토큰 발견')
    return bearerToken
  }

  // 2. 쿠키에서 Supabase 토큰 추출
  const cookieHeader = request.headers.get('cookie')
  const cookies = parseCookies(cookieHeader)

  // Supabase 쿠키 패턴들 확인
  const possibleTokenKeys = [
    'sb-thnboxxfxahwkawzgcjj-auth-token',
    'supabase-auth-token',
    'sb-auth-token',
    'supabase.auth.token'
  ]

  for (const key of possibleTokenKeys) {
    const token = cookies[key]
    if (token) {
      console.log(`✅ Phase 2: 쿠키에서 토큰 발견 (${key})`)
      
      // JSON 형태의 토큰인 경우 파싱
      try {
        const parsedToken = JSON.parse(token)
        if (parsedToken.access_token) {
          return parsedToken.access_token
        }
      } catch {
        // JSON이 아닌 경우 그대로 반환
        return token
      }
    }
  }

  console.log('❌ Phase 2: 인증 토큰을 찾을 수 없음')
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
 * Request 기반 인증된 Supabase 클라이언트 생성
 */
export const createAuthenticatedServerClient = (request: NextRequest) => {
  const { supabaseUrl, supabaseAnonKey } = validateEnvironment()
  
  // 기본 클라이언트 생성
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Request에서 토큰 추출
  const authToken = extractAuthTokenFromRequest(request)
  
  if (authToken) {
    console.log('🔄 Phase 2: 수동 세션 설정 시도')
    
    // 수동으로 세션 설정
    client.auth.setSession({
      access_token: authToken,
      refresh_token: '', // API 호출에는 access_token만 필요
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer'
    }).catch(error => {
      console.warn('⚠️ Phase 2: 수동 세션 설정 실패 (정상적일 수 있음):', error.message)
    })
  }

  return { client, authToken }
}
