/**
 * AI Face Chat Lite - Task 4: 통합 인증 유틸리티
 * 작성일: 2025-07-17
 * 목적: 모든 API에서 동일한 인증 로직 사용
 */

import { NextRequest } from 'next/server'

/**
 * 인증 결과 타입
 */
interface AuthResult {
  success: boolean
  userId: string | null
  source: 'authorization_header' | 'cookie' | 'none'
  debugInfo?: {
    hasAuthHeader: boolean
    cookieCount: number
    tokenPartsCount?: number
    payloadFields?: string[]
  }
}

/**
 * Task 4: 통합 사용자 인증 함수
 * Authorization 헤더와 쿠키에서 사용자 ID 추출
 * Google OAuth와 일반 로그인 모두 지원
 */
export async function extractUserFromRequest(request: NextRequest): Promise<AuthResult> {
  let userId: string | null = null
  let source: AuthResult['source'] = 'none'
  const debugInfo: AuthResult['debugInfo'] = {
    hasAuthHeader: !!request.headers.get('authorization'),
    cookieCount: Array.from(request.cookies).length
  }

  console.log('[extractUserFromRequest] 🔍 인증 처리 시작')
  console.log('[extractUserFromRequest] 📊 Task 6: 상세 디버깅 활성화')

  // 1. Authorization 헤더 우선 확인 (Global Fetch Interceptor 지원)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.replace('Bearer ', '')
      console.log('[extractUserFromRequest] 🔍 Authorization 헤더 토큰 처리 중')
      
      // JWT 토큰 디코딩하여 사용자 ID 추출
      const tokenParts = token.split('.')
      debugInfo.tokenPartsCount = tokenParts.length
      
      if (tokenParts.length === 3) {
        // Base64 URL 디코딩 개선 (Google OAuth 토큰 지원)
        const base64Payload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')
        const paddedPayload = base64Payload + '='.repeat((4 - base64Payload.length % 4) % 4)
        
        try {
          const payload = JSON.parse(atob(paddedPayload))
          debugInfo.payloadFields = Object.keys(payload)
          
          console.log('[extractUserFromRequest] 🔍 JWT payload 전체 분석:', {
            sub: payload.sub,
            user_id: payload.user_id,
            email: payload.email,
            iss: payload.iss,
            aud: payload.aud,
            session_id: payload.session_id,
            iat: payload.iat,
            exp: payload.exp,
            // Task 6: Google OAuth 특화 필드들
            given_name: payload.given_name,
            family_name: payload.family_name,
            picture: payload.picture,
            email_verified: payload.email_verified,
            // 전체 payload 구조 (처음 3개 속성만)
            first_3_keys: Object.keys(payload).slice(0, 3),
            total_fields: Object.keys(payload).length
          })
          
          // Task 5: 사용자 ID 불일치 분석
          const possibleUserIds = {
            sub: payload.sub,
            user_id: payload.user_id,
            id: payload.id,
            session_id: payload.session_id
          }
          
          console.log('[extractUserFromRequest] 🔍 가능한 사용자 ID들:', possibleUserIds)
          
          // 다양한 사용자 ID 필드 확인 (Google OAuth vs 일반 로그인)
          userId = payload.sub || payload.user_id || payload.id || null
          
          if (userId) {
            console.log('[extractUserFromRequest] ✅ Authorization 헤더에서 사용자 ID 추출:', userId)
            console.log('[extractUserFromRequest] 🔍 사용된 필드:', 
              payload.sub ? 'sub' : payload.user_id ? 'user_id' : 'id')
            source = 'authorization_header'
          } else {
            console.log('[extractUserFromRequest] ⚠️ JWT payload에서 사용자 ID 찾을 수 없음')
          }
        } catch (payloadError) {
          console.log('[extractUserFromRequest] 🚨 JWT payload 파싱 실패:', payloadError)
        }
      } else {
        console.log('[extractUserFromRequest] ⚠️ 유효하지 않은 JWT 토큰 (부분 수:', tokenParts.length, ')')
      }
    } catch (e) {
      console.log('[extractUserFromRequest] 🚨 Authorization 헤더 처리 실패:', e)
    }
  }

  // 2. 쿠키에서 사용자 ID 추출 (fallback)
  if (!userId) {
    console.log('[extractUserFromRequest] 🔍 쿠키 fallback 인증 시도')
    const cookieStore = request.cookies
    
    // 가능한 모든 Supabase 인증 쿠키 확인
    const cookieNames = [
      'sb-thnboxxfxahwkawzgcjj-auth-token',
      'sb-auth-token',
      'supabase-auth-token',
      'sb-thnboxxfxahwkawzgcjj-auth-token-code-verifier',
      '__Secure-sb-thnboxxfxahwkawzgcjj-auth-token'
    ]
    
    for (const cookieName of cookieNames) {
      const userCookie = cookieStore.get(cookieName)
      if (userCookie?.value) {
        try {
          const authData = JSON.parse(userCookie.value)
          
          // Task 5: 쿠키 데이터 상세 분석
          console.log(`[extractUserFromRequest] 🔍 쿠키 ${cookieName} 데이터 분석:`, {
            hasUser: !!authData?.user,
            userId: authData?.user?.id,
            userEmail: authData?.user?.email,
            directSub: authData?.sub,
            directId: authData?.id,
            accessToken: authData?.access_token ? 'present' : 'missing'
          })
          
          // 다양한 구조에서 사용자 ID 추출
          const cookieUserId = authData?.user?.id || authData?.sub || authData?.id || null
          
          if (cookieUserId && !userId) {  // Authorization 헤더가 없을 때만 쿠키 사용
            userId = cookieUserId
            console.log(`[extractUserFromRequest] ✅ 쿠키 ${cookieName}에서 사용자 ID 추출:`, userId)
            source = 'cookie'
            break
          } else if (cookieUserId) {
            console.log(`[extractUserFromRequest] 🔍 쿠키 ${cookieName}에서 다른 사용자 ID 발견:`, cookieUserId)
            console.log(`[extractUserFromRequest] ⚠️ Authorization 헤더 ID (${userId})와 쿠키 ID (${cookieUserId}) 불일치`)
          }
        } catch (e) {
          console.log(`[extractUserFromRequest] 🔍 쿠키 ${cookieName} 파싱 실패:`, e)
        }
      }
    }
    
    if (!userId) {
      console.log('[extractUserFromRequest] ⚠️ 모든 쿠키에서 사용자 ID 찾을 수 없음')
      
      // 디버깅을 위해 사용 가능한 모든 쿠키 로그
      const allCookies = Array.from(cookieStore).map(([name, value]) => ({ name, hasValue: !!value?.value }))
      console.log('[extractUserFromRequest] 🔍 사용 가능한 쿠키:', allCookies)
    }
  }

  const result: AuthResult = {
    success: !!userId,
    userId,
    source,
    debugInfo
  }

  console.log('[extractUserFromRequest] 🎯 최종 인증 결과:', {
    success: result.success,
    userId: result.userId,
    source: result.source
  })

  return result
}

/**
 * 인증 실패 응답 생성
 */
export function createUnauthorizedResponse(authResult: AuthResult) {
  console.log('[createUnauthorizedResponse] 🚨 인증 실패 응답 생성')
  
  return {
    success: false,
    message: 'Authentication required. Please login again.',
    error_code: 'UNAUTHORIZED',
    debug_info: authResult.debugInfo
  }
}
