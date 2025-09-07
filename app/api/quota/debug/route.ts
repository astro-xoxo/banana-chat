// Debug API for Vercel Environment Quota Issue
// GET /api/quota/debug - 환경별 상태 진단 및 로깅

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: 'unknown',
    debug_steps: []
  }

  try {
    // 1. 환경 감지
    debugInfo.environment = process.env.VERCEL ? 'vercel' : 'local'
    debugInfo.debug_steps.push(`✅ Environment detected: ${debugInfo.environment}`)

    // 2. 환경변수 확인 (민감정보 마스킹)
    debugInfo.env_vars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'MISSING',
      VERCEL: process.env.VERCEL || 'false',
      NODE_ENV: process.env.NODE_ENV || 'unknown'
    }
    debugInfo.debug_steps.push('✅ Environment variables checked')

    // 3. 쿠키 상태 분석
    const cookieStore = request.cookies
    const allCookies = {}
    
    // 모든 쿠키 수집 (값은 마스킹)
    cookieStore.getAll().forEach(cookie => {
      if (cookie.name.includes('auth')) {
        allCookies[cookie.name] = cookie.value ? 'PRESENT (masked)' : 'EMPTY'
      } else {
        allCookies[cookie.name] = 'NON-AUTH'
      }
    })

    debugInfo.cookies = allCookies
    debugInfo.debug_steps.push(`✅ Found ${Object.keys(allCookies).length} cookies`)

    // 4. 특정 인증 쿠키 파싱 시도
    const mainAuthCookie = cookieStore.get('sb-thnboxxfxahwkawzgcjj-auth-token')
    let userId = null
    let cookieError = null

    if (mainAuthCookie?.value) {
      try {
        const authData = JSON.parse(mainAuthCookie.value)
        userId = authData?.user?.id || null
        debugInfo.debug_steps.push(`✅ Main auth cookie parsed successfully`)
        debugInfo.debug_steps.push(`✅ User ID extracted: ${userId ? 'PRESENT' : 'NULL'}`)
      } catch (error) {
        cookieError = error.message
        debugInfo.debug_steps.push(`❌ Main auth cookie parsing failed: ${cookieError}`)
      }
    } else {
      debugInfo.debug_steps.push('❌ Main auth cookie not found')
    }

    // 5. 대체 쿠키 확인
    const altCookie = cookieStore.get('sb-auth-token')
    if (!userId && altCookie?.value) {
      try {
        const authData = JSON.parse(altCookie.value)
        userId = authData?.user?.id || null
        debugInfo.debug_steps.push(`✅ Alternative auth cookie parsed successfully`)
      } catch (error) {
        debugInfo.debug_steps.push(`❌ Alternative auth cookie parsing failed: ${error.message}`)
      }
    }

    // 6. Fallback 사용자 ID 확인
    const testUserId = '1b240d41-e800-4afc-b29e-9b064f03ce93'
    if (!userId) {
      userId = testUserId
      debugInfo.debug_steps.push(`🔧 Using fallback test user ID: ${testUserId}`)
    }

    debugInfo.user_id = userId
    debugInfo.cookie_error = cookieError

    // 7. Supabase 연결 테스트
    let dbConnectionTest = {
      connected: false,
      error: null,
      user_exists: false,
      quota_data: null
    }

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      debugInfo.debug_steps.push('✅ Supabase client created')

      // 사용자 존재 확인
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single()

      if (userError) {
        dbConnectionTest.error = userError.message
        debugInfo.debug_steps.push(`❌ User lookup failed: ${userError.message}`)
      } else {
        dbConnectionTest.user_exists = true
        debugInfo.debug_steps.push(`✅ User found: ${userData.email}`)
      }

      // 쿼터 데이터 조회
      const { data: quotaData, error: quotaError } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)

      if (quotaError) {
        dbConnectionTest.error = quotaError.message
        debugInfo.debug_steps.push(`❌ Quota lookup failed: ${quotaError.message}`)
      } else {
        dbConnectionTest.quota_data = quotaData
        dbConnectionTest.connected = true
        debugInfo.debug_steps.push(`✅ Found ${quotaData.length} quota records`)
        
        // chat_messages 쿼터 특별 확인
        const chatQuota = quotaData.find(q => q.quota_type === 'chat_messages')
        if (chatQuota) {
          debugInfo.debug_steps.push(`🔍 Chat quota: ${chatQuota.used_count}/${chatQuota.limit_count}`)
        } else {
          debugInfo.debug_steps.push(`❌ Chat quota record not found`)
        }
      }

    } catch (error) {
      dbConnectionTest.error = error.message
      debugInfo.debug_steps.push(`❌ Database connection failed: ${error.message}`)
    }

    debugInfo.db_test = dbConnectionTest

    // 8. 요청 헤더 분석
    debugInfo.request_info = {
      host: request.headers.get('host'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
      user_agent: request.headers.get('user-agent')?.substring(0, 50) + '...',
      forwarded_for: request.headers.get('x-forwarded-for'),
      vercel_id: request.headers.get('x-vercel-id')
    }
    debugInfo.debug_steps.push('✅ Request headers analyzed')

    // 9. 최종 진단 결과
    let diagnosis = 'UNKNOWN'
    if (!userId || userId === testUserId) {
      diagnosis = 'COOKIE_AUTH_ISSUE'
    } else if (!dbConnectionTest.connected) {
      diagnosis = 'DATABASE_CONNECTION_ISSUE'
    } else if (!dbConnectionTest.user_exists) {
      diagnosis = 'USER_NOT_FOUND'
    } else if (!dbConnectionTest.quota_data || dbConnectionTest.quota_data.length === 0) {
      diagnosis = 'QUOTA_DATA_MISSING'
    } else {
      diagnosis = 'HEALTHY'
    }

    debugInfo.diagnosis = diagnosis
    debugInfo.debug_steps.push(`🔍 Final diagnosis: ${diagnosis}`)

    return NextResponse.json(debugInfo, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    debugInfo.fatal_error = error.message
    debugInfo.debug_steps.push(`💥 Fatal error: ${error.message}`)
    
    return NextResponse.json(debugInfo, {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

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
