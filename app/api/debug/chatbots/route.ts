import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 챗봇 데이터 디버깅 API 호출')
    
    // 최근 활성 챗봇들 조회
    const { data: chatbots, error } = await supabase
      .from('chatbots')
      .select('id, name, user_uploaded_image_url, session_id, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('❌ 챗봇 조회 실패:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    const debugInfo = {
      success: true,
      total_chatbots: chatbots?.length || 0,
      chatbots: chatbots?.map(bot => ({
        id: bot.id,
        name: bot.name,
        session_id: bot.session_id,
        has_user_image: !!bot.user_uploaded_image_url,
        user_image_url_length: bot.user_uploaded_image_url?.length || 0,
        user_image_url_preview: bot.user_uploaded_image_url?.substring(0, 100) || null,
        created_at: bot.created_at
      })) || []
    }

    console.log('📊 챗봇 디버그 정보:', debugInfo)

    return NextResponse.json(debugInfo)

  } catch (error) {
    console.error('❌ 챗봇 디버깅 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}