// 할당량 소진 전용 API 엔드포인트
// POST /api/quota/consume - 할당량 차감 처리

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { QuotaService } from '@/lib/quota/QuotaService'
import { QuotaRepository } from '@/lib/quota/QuotaRepository'
import { QuotaError } from '@/types/quota'
import { QuotaType } from '@/types/quota'
import { extractUserFromRequest, createUnauthorizedResponse } from '@/lib/auth-utils'

interface ConsumeQuotaRequest {
  quota_type: QuotaType
  amount?: number // 기본값: 1
}

interface ConsumeQuotaResponse {
  success: boolean
  message: string
  quota_info?: {
    used: number
    limit: number
    remaining: number
    can_use: boolean
    next_reset_at?: string
    reset_in_hours?: number
  }
  error_code?: string
}

/**
 * 할당량 소진 처리
 * 
 * @body {ConsumeQuotaRequest} 소진할 할당량 정보
 * @returns {ConsumeQuotaResponse} 소진 결과 및 현재 할당량 상태
 */
export async function POST(request: NextRequest): Promise<NextResponse<ConsumeQuotaResponse>> {
  try {
    console.log('[POST /api/quota/consume] Processing quota consumption request')

    // 요청 본문 파싱
    const body: ConsumeQuotaRequest = await request.json()
    const { quota_type, amount = 1 } = body

    // 입력 검증
    if (!quota_type) {
      return NextResponse.json({
        success: false,
        message: 'quota_type is required',
        error_code: 'MISSING_QUOTA_TYPE'
      }, { status: 400 })
    }

    if (amount <= 0 || amount > 10) {
      return NextResponse.json({
        success: false,
        message: 'Amount must be between 1 and 10',
        error_code: 'INVALID_AMOUNT'
      }, { status: 400 })
    }

    // Task 4: 통합 인증 유틸리티 사용
    const authResult = await extractUserFromRequest(request)
    
    if (!authResult.success || !authResult.userId) {
      console.log('[POST /api/quota/consume] 🚨 인증 실패 - 사용자 ID 없음')
      const unauthorizedResponse = createUnauthorizedResponse(authResult)
      return NextResponse.json(unauthorizedResponse, { status: 401 })
    }

    const userId = authResult.userId
    console.log(`[POST /api/quota/consume] ✅ 인증 성공 (소스: ${authResult.source}):`, userId)
    
    // 2. Service Role Key를 사용한 관리자 클라이언트 생성 (RLS 우회)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    console.log('[POST /api/quota/consume] 🔍 Supabase URL:', supabaseUrl)
    console.log('[POST /api/quota/consume] 🔍 Service Key available:', !!supabaseServiceKey)
    
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

    console.log(`[POST /api/quota/consume] 🔍 Using service role client for user: ${userId}`)
    console.log(`[POST /api/quota/consume] 🔍 Processing for user: ${userId}, type: ${quota_type}, amount: ${amount}`)

    // Task 6: 사용자 ID 검증 - 데이터베이스에 실제로 존재하는지 확인
    console.log(`[POST /api/quota/consume] 🔍 Task 6: 사용자 ID 검증 시작 - ${userId}`)
    
    try {
      const { data: userExists, error: userCheckError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();
        
      if (userCheckError || !userExists) {
        console.error(`[POST /api/quota/consume] 🚨 Task 6: 사용자 ID 존재하지 않음:`, {
          userId,
          error: userCheckError?.message,
          code: userCheckError?.code
        });
        
        return NextResponse.json({
          success: false,
          message: `User not found in database: ${userId}`,
          error_code: 'USER_NOT_FOUND'
        }, { status: 404 });
      }
      
      console.log(`[POST /api/quota/consume] ✅ Task 6: 사용자 ID 검증 성공:`, {
        userId: userExists.id,
        email: userExists.email
      });
    } catch (verificationError) {
      console.error(`[POST /api/quota/consume] 🚨 Task 6: 사용자 검증 중 오류:`, verificationError);
      return NextResponse.json({
        success: false,
        message: 'User verification failed',
        error_code: 'VERIFICATION_ERROR'
      }, { status: 500 });
    }

    // 의존성 주입으로 서비스 생성
    const repository = new QuotaRepository(supabase)
    const quotaService = new QuotaService(repository)

    // 할당량 소진 처리 (트랜잭션 처리 포함)
    const result = await quotaService.consumeQuota(userId, quota_type, amount)

    if (!result.success) {
      console.log(`[POST /api/quota/consume] Consumption failed: ${result.message}`)
      
      // 할당량 초과 등의 비즈니스 로직 오류
      return NextResponse.json({
        success: false,
        message: result.message,
        error_code: result.remaining === 0 ? 'QUOTA_EXCEEDED' : 'CONSUMPTION_FAILED'
      }, { 
        status: result.remaining === 0 ? 429 : 400  // 429 for quota exceeded, 400 for other failures
      })
    }

    // 성공 시 현재 할당량 상태 조회
    const currentQuotas = await quotaService.getUserQuotas(userId)
    const targetQuota = currentQuotas.find(q => q.type === quota_type)

    if (!targetQuota) {
      console.error(`[POST /api/quota/consume] Target quota not found after consumption: ${quota_type}`)
      return NextResponse.json({
        success: false,
        message: 'Quota state inconsistent after consumption',
        error_code: 'STATE_INCONSISTENT'
      }, { status: 500 })
    }

    console.log(`[POST /api/quota/consume] Successfully consumed quota: ${quota_type} (${targetQuota.used}/${targetQuota.limit})`)

    return NextResponse.json({
      success: true,
      message: `Successfully consumed ${amount} ${quota_type} quota`,
      quota_info: {
        used: targetQuota.used,
        limit: targetQuota.limit,
        remaining: targetQuota.limit - targetQuota.used,
        can_use: targetQuota.canUse,
        next_reset_at: targetQuota.nextResetAt || undefined,
        reset_in_hours: targetQuota.resetInHours || undefined
      }
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('[POST /api/quota/consume] Unexpected error:', error)

    // QuotaError 타입별 처리
    if (error instanceof QuotaError) {
      const statusCode = error.code === 'USER_NOT_FOUND' ? 404 :
                        error.code === 'QUOTA_EXCEEDED' ? 429 :
                        error.code === 'DB_ERROR' ? 500 : 400

      return NextResponse.json({
        success: false,
        message: error.message,
        error_code: error.code
      }, { status: statusCode })
    }

    // 일반적인 서버 오류
    return NextResponse.json({
      success: false,
      message: 'Internal server error occurred while consuming quota',
      error_code: 'INTERNAL_ERROR'
    }, { status: 500 })
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
