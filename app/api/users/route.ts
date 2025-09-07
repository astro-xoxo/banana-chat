/**
 * AI Face Chat Lite - Users API
 * Day 1: 기본 사용자 정보 및 쿼터 관리
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    
    // 사용자 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    // 사용자 정보 조회
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' }, 
        { status: 500 }
      )
    }

    // 사용자 할당량 정보 조회
    const { data: quotaData, error: quotaError } = await supabase
      .from('user_quotas')
      .select('*')
      .eq('user_id', session.user.id)
      .single()

    if (quotaError && quotaError.code !== 'PGRST116') { // PGRST116: no rows returned
      return NextResponse.json(
        { error: 'Failed to fetch user quota' }, 
        { status: 500 }
      )
    }

    // 할당량 데이터가 없으면 기본값 생성
    let quota = quotaData
    if (!quota) {
      const { data: newQuota, error: createQuotaError } = await supabase
        .from('user_quotas')
        .insert([{
          user_id: session.user.id,
          profile_image_used: false,
          daily_chat_count: 0,
          quota_reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }])
        .select()
        .single()

      if (createQuotaError) {
        return NextResponse.json(
          { error: 'Failed to create user quota' }, 
          { status: 500 }
        )
      }

      quota = newQuota
    }

    // 24시간 리셋 로직
    const now = new Date()
    const resetTime = new Date(quota.quota_reset_time)
    
    if (now >= resetTime) {
      // 할당량 리셋
      const { data: updatedQuota, error: updateError } = await supabase
        .from('user_quotas')
        .update({
          daily_chat_count: 0,
          quota_reset_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('user_id', session.user.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to reset quota' }, 
          { status: 500 }
        )
      }

      quota = updatedQuota
    }

    // 응답 데이터 구성
    const responseData = {
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        created_at: userProfile.created_at
      },
      quota: {
        profileImageUsed: quota.profile_image_used,
        dailyChatCount: quota.daily_chat_count,
        quotaResetTime: quota.quota_reset_time,
        chatQuotaRemaining: Math.max(0, 10 - quota.daily_chat_count)
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    
    // 사용자 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const { name } = await request.json()

    // 사용자 프로필 업데이트
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ name })
      .eq('id', session.user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update user profile' }, 
        { status: 500 }
      )
    }

    return NextResponse.json(updatedUser)

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
