// 쿼터 조회 API 엔드포인트
// GET /api/quota - 사용자의 모든 쿼터 정보 조회

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAuthenticatedServerClient } from '@/lib/supabase-server'
import { QuotaService } from '@/lib/quota/QuotaService'
import { QuotaRepository } from '@/lib/quota/QuotaRepository'
import { QuotaValidator } from '@/lib/quota/QuotaValidator'
import { QuotaError } from '@/types/quota'

/**
 * 사용자 쿼터 정보 조회
 * 
 * @returns {QuotaDisplay[]} 사용자의 모든 쿼터 정보
 * 
 * 응답 예시:
 * {
 *   "quotas": [
 *     {
 *       "type": "profile_image_generation",
 *       "used": 0,
 *       "limit": 1,
 *       "canUse": true,
 *       "nextResetAt": null,
 *       "resetInHours": null,
 *       "percentage": 0
 *     },
 *     {
 *       "type": "chat_messages", 
 *       "used": 5,
 *       "limit": 50,
 *       "canUse": true,
 *       "nextResetAt": null,
 *       "resetInHours": null,
 *       "percentage": 10
 *     },
 *     {
 *       "type": "chat_image_generation",
 *       "used": 3,
 *       "limit": 5,
 *       "canUse": true,
 *       "nextResetAt": "2025-07-08T10:30:00.000Z",
 *       "resetInHours": 15,
 *       "percentage": 60
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[GET /api/quota] 🔍 Processing quota request')

    // 1. Supabase 서버 클라이언트로 사용자 인증 확인
    const { client: supabaseServer, authToken } = await createAuthenticatedServerClient(request)
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser()

    if (authError || !user) {
      console.log('[GET /api/quota] 🚨 인증 실패:', authError?.message || 'No user')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = user.id
    console.log('[GET /api/quota] ✅ 인증된 사용자:', user.email, userId)

    // 2. Service Role Key를 사용한 관리자 클라이언트 생성 (RLS 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    console.log('[GET /api/quota] 🔍 Supabase URL:', supabaseUrl)
    console.log('[GET /api/quota] 🔍 Service Key available:', !!supabaseServiceKey)
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      }
    })

    console.log(`[GET /api/quota] 🔍 Using service role client for user: ${userId}`)

    // 3. 의존성 주입으로 서비스 생성
    const repository = new QuotaRepository(supabase)
    const validator = new QuotaValidator()
    const quotaService = new QuotaService(repository, validator)

    // 4. 사용자 쿼터 조회 (누락된 쿼터 자동 생성 포함)
    console.log('[GET /api/quota] 🔍 Calling quotaService.getUserQuotas...')
    const quotas = await quotaService.getUserQuotas(userId)

    console.log(`[GET /api/quota] ✅ Successfully retrieved ${quotas.length} quotas for user: ${userId}`)
    console.log(`[GET /api/quota] 🔍 Quotas data:`, quotas)

    return NextResponse.json({ 
      quotas 
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('[GET /api/quota] 🚨 Unexpected error:', error)

    // QuotaError 타입별 처리
    if (error instanceof QuotaError) {
      const statusCode = error.code === 'USER_NOT_FOUND' ? 404 :
                        error.code === 'DB_ERROR' ? 500 : 400

      return NextResponse.json(
        { 
          error: error.message,
          code: error.code
        }, 
        { status: statusCode }
      )
    }

    // 일반적인 서버 오류
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching quotas'
      }, 
      { status: 500 }
    )
  }
}

/**
 * OPTIONS 요청 처리 (CORS)
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
