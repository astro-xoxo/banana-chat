/**
 * AI Face Chat Lite - 사용자 프로필 API 엔드포인트
 * 작성일: 2025-07-02
 * 목적: 클라이언트에서 프로필 생성 시 RLS 정책 우회
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'

interface UserProfileRequest {
  id: string
  email: string
  name: string | null
  profile_image_used: boolean
  daily_chat_count: number
  quota_reset_time: string | null
}

/**
 * POST /api/users/profile - 새 사용자 프로필 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body: UserProfileRequest = await request.json()
    
    // 필수 필드 검증
    if (!body.id || !body.email) {
      return NextResponse.json(
        { error: 'ID와 이메일은 필수입니다' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()
    
    // 기존 프로필 확인
    const { data: existingProfile, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', body.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('기존 프로필 조회 오류:', selectError)
      return NextResponse.json(
        { error: '프로필 조회 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

    if (existingProfile) {
      return NextResponse.json(existingProfile)
    }

    // 새 프로필 생성
    const newProfile = {
      id: body.id,
      email: body.email,
      name: body.name,
      profile_image_used: body.profile_image_used,
      daily_chat_count: body.daily_chat_count,
      quota_reset_time: body.quota_reset_time,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: createdProfile, error: insertError } = await supabase
      .from('users')
      .insert([newProfile])
      .select()
      .single()

    if (insertError) {
      console.error('프로필 생성 오류:', insertError)
      return NextResponse.json(
        { error: '프로필 생성 중 오류가 발생했습니다' },
        { status: 500 }
      )
    }

    console.log('API를 통한 프로필 생성 완료:', createdProfile.email)
    return NextResponse.json(createdProfile)
    
  } catch (error) {
    console.error('사용자 프로필 생성 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/users/profile - 사용자 프로필 조회 (테스트용)
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
