/**
 * 테스트 계정 생성 API 엔드포인트
 * 개발 환경에서만 사용
 */

import { createSupabaseServiceClient } from '@/lib/supabase-client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 개발 환경에서만 허용
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const supabase = createSupabaseServiceClient()
    
    // 테스트 계정 생성
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@test.com',
      password: 'testpassword',
      email_confirm: true,
      user_metadata: {
        name: 'Test User'
      }
    })

    if (authError) {
      console.error('테스트 계정 생성 오류:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (authData.user) {
      // 사용자 프로필도 생성
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: 'test@test.com',
          name: 'Test User',
          profile_image_used: false,
          daily_chat_count: 0,
          quota_reset_time: null
        })

      if (profileError) {
        console.error('테스트 프로필 생성 오류:', profileError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Test account created',
      user: authData.user 
    })

  } catch (error) {
    console.error('테스트 계정 생성 실패:', error)
    return NextResponse.json({ error: 'Failed to create test account' }, { status: 500 })
  }
}
