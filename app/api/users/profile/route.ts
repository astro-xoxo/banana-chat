/**
 * AI Face Chat Lite - 개선된 사용자 프로필 API 엔드포인트
 * 작성일: 2025-07-16
 * 목적: AuthProvider와 호환되는 자동 프로필 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'

interface UserProfileRequest {
  user_id: string // AuthProvider에서 보내는 필드명
  email: string
  name: string
}

/**
 * POST /api/users/profile - 새 사용자 프로필 생성 (개선됨)
 */
export async function POST(request: NextRequest) {
  try {
    const body: UserProfileRequest = await request.json()
    
    console.log('🔄 프로필 생성 요청:', body)
    
    // 필수 필드 검증
    if (!body.user_id || !body.email) {
      console.error('❌ 필수 필드 누락:', body)
      return NextResponse.json(
        { error: 'user_id와 email은 필수입니다' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()
    
    // 기존 프로필 확인
    const { data: existingProfile, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', body.user_id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('❌ 기존 프로필 조회 오류:', selectError)
      return NextResponse.json(
        { error: '프로필 조회 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      console.log('ℹ️ 프로필이 이미 존재함:', existingProfile.email)
      return NextResponse.json(existingProfile, { status: 409 }) // Conflict
    }

    // 새 프로필 생성 - 기본값으로 설정
    const newProfile = {
      id: body.user_id,
      email: body.email,
      name: body.name || body.email.split('@')[0],
      profile_image_used: false,
      daily_chat_count: 0,
      quota_reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('🔄 새 프로필 생성 시도:', newProfile.email)

    const { data: createdProfile, error: insertError } = await supabase
      .from('users')
      .insert([newProfile])
      .select()
      .single()

    if (insertError) {
      console.error('❌ 프로필 생성 오류:', insertError)
      return NextResponse.json(
        { error: '프로필 생성 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

    console.log('✅ 프로필 생성 완료:', createdProfile.email)
    
    // 생성 후 기본 쿼터도 생성
    await createDefaultQuotas(supabase, body.user_id)
    
    return NextResponse.json(createdProfile, { status: 201 })
    
  } catch (error) {
    console.error('❌ 사용자 프로필 생성 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * 기본 쿼터 생성 함수
 */
async function createDefaultQuotas(supabase: any, userId: string) {
  try {
    const defaultQuotas = [
      {
        user_id: userId,
        quota_type: 'profile_image_generation',
        used_count: 0,
        limit_count: 1,
        reset_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        user_id: userId,
        quota_type: 'chat_messages',
        used_count: 0,
        limit_count: 150,
        reset_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        user_id: userId,
        quota_type: 'chat_image_generation',
        used_count: 0,
        limit_count: 25,
        reset_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    const { error: quotaError } = await supabase
      .from('user_quotas')
      .insert(defaultQuotas)

    if (quotaError) {
      console.error('⚠️ 기본 쿼터 생성 오류:', quotaError)
    } else {
      console.log('✅ 기본 쿼터 생성 완료:', userId)
    }
  } catch (error) {
    console.error('❌ 기본 쿼터 생성 실패:', error)
  }
}

/**
 * GET /api/users/profile - 사용자 프로필 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')
    
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()
    
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '프로필을 찾을 수 없습니다' },
          { status: 404 }
        )
      }
      
      console.error('프로필 조회 오류:', error)
      return NextResponse.json(
        { error: '프로필 조회 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

    return NextResponse.json(profile)
    
  } catch (error) {
    console.error('사용자 프로필 조회 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
