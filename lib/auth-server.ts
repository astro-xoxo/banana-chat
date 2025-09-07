/**
 * AI Face Chat Lite - 서버 사이드 인증 헬퍼
 * 작성일: 2025-07-05
 * 목적: API 라우트에서 사용자 인증 상태 확인 (설계 문서 기준 - @supabase/ssr 사용)
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 서버 사이드 Supabase 클라이언트 생성 (@supabase/ssr 사용)
 * 설계 문서에 따른 권장 방식
 */
function createSupabaseServerClient() {
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // SSR 환경에서 쿠키 설정이 실패할 수 있음 (정상)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // SSR 환경에서 쿠키 제거가 실패할 수 있음 (정상)
          }
        },
      },
    }
  )
}

/**
 * 서버 사이드에서 현재 로그인한 사용자 정보를 가져오는 함수
 * @supabase/ssr 패키지를 사용한 표준 방식
 */
export async function getCurrentUserServer() {
  try {
    console.log('Server auth: 사용자 인증 시작 (@supabase/ssr)')
    
    const supabase = createSupabaseServerClient()
    
    // 디버깅을 위해 모든 쿠키 출력
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    console.log('Server auth: 사용 가능한 쿠키들:', allCookies.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      length: c.value?.length || 0
    })))
    
    // Supabase SSR을 통한 세션 및 사용자 정보 조회
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.log('Server auth: 세션 조회 오류:', sessionError.message)
      return null
    }
    
    if (!session || !session.user) {
      console.log('Server auth: 세션 또는 사용자 정보 없음')
      return null
    }
    
    console.log('Server auth: 사용자 인증 성공:', session.user.email)
    return {
      id: session.user.id,
      email: session.user.email || '',
      user: session.user,
      session: session
    }
    
  } catch (error) {
    console.error('Server auth: getCurrentUserServer 실패:', error)
    return null
  }
}

/**
 * Authorization 헤더에서 Bearer 토큰을 추출해서 사용자 인증
 * 클라이언트에서 명시적으로 토큰을 전달하는 경우 사용 (fallback)
 */
export async function getCurrentUserFromHeader(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      console.log('🍪 Server auth: Authorization 헤더 없음')
      return null
    }
    
    const token = authorization.replace('Bearer ', '')
    console.log('🍪 Server auth: Authorization 헤더에서 토큰 추출 성공 (length:', token.length + ')')
    
    // 기본 Supabase 클라이언트로 토큰 검증
    const { createClient } = require('@supabase/supabase-js')
    const simpleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // 토큰으로 사용자 정보 조회
    const { data: { user }, error } = await simpleSupabase.auth.getUser(token)
    
    if (error || !user) {
      console.log('🍪 Server auth: 헤더 토큰으로 사용자 조회 실패:', error?.message)
      return null
    }
    
    console.log('🍪 Server auth: 헤더 토큰으로 사용자 인증 성공:', user.email)
    return {
      id: user.id,
      email: user.email || '',
      user: user
    }
  } catch (error) {
    console.error('🍪 Server auth: getCurrentUserFromHeader 실패:', error)
    return null
  }
}

/**
 * 통합된 사용자 인증 함수
 * 설계 문서에 따른 우선순위: 1. SSR 쿠키 방식, 2. Authorization 헤더 (fallback)
 */
export async function authenticateUser(request?: Request) {
  console.log('🍪 Server auth: 통합 인증 프로세스 시작')
  
  // 디버깅: 요청 정보 출력
  if (request) {
    console.log('🍪 Request 정보:', {
      url: request.url,
      method: request.method,
      hasAuthHeader: request.headers.has('authorization'),
      authHeaderValue: request.headers.get('authorization')?.substring(0, 20) + '...'
    })
  }
  
  // 1. @supabase/ssr 방식으로 쿠키에서 세션 확인 (권장 방식)
  console.log('🍪 1단계: SSR 쿠키 방식 시도...')
  const userFromCookie = await getCurrentUserServer()
  if (userFromCookie) {
    console.log('✅ Server auth: SSR 쿠키 방식으로 인증 성공')
    return userFromCookie
  }
  
  // 2. Authorization 헤더 확인 (fallback)
  if (request) {
    console.log('🍪 2단계: Authorization 헤더 방식 fallback 시도...')
    const userFromHeader = await getCurrentUserFromHeader(request)
    if (userFromHeader) {
      console.log('✅ Server auth: Authorization 헤더 방식으로 인증 성공')
      return userFromHeader
    }
  } else {
    console.log('🍪 2단계 건너뛰기: request 객체 없음')
  }
  
  console.log('❌ Server auth: 모든 인증 방법 실패')
  return null
}

/**
 * 서버 컴포넌트에서 직접 사용할 수 있는 Supabase 클라이언트 생성 함수
 */
export function getSupabaseServerClient() {
  return createSupabaseServerClient()
}
