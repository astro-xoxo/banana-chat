/**
 * AI Face Chat Lite - Chatbots API
 * Day 1: 기본 구조만 구현, Day 2-3에서 완성
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

    // 사용자의 챗봇 목록 조회
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select(`
        id,
        name,
        profile_image_url,
        relationship_type,
        gender,
        is_active,
        created_at
      `)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (chatbotsError) {
      return NextResponse.json(
        { error: 'Failed to fetch chatbots' }, 
        { status: 500 }
      )
    }

    return NextResponse.json({ chatbots })

  } catch (error) {
    console.error('Error in chatbots API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
