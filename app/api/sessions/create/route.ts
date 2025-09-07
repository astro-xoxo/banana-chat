import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SessionCreateRequest {
  session_id: string
  created_at?: string
  last_activity?: string
}

interface SessionCreateResponse {
  success: boolean
  session_id?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<SessionCreateResponse>> {
  console.log('🆕 익명 세션 DB 저장 API 시작')
  
  try {
    // 1. 요청 데이터 파싱
    const body: SessionCreateRequest = await request.json()
    const { session_id, created_at, last_activity } = body
    
    console.log('📝 세션 저장 요청:', {
      session_id,
      created_at,
      last_activity
    })

    // 2. 입력값 검증
    if (!session_id) {
      return NextResponse.json({
        success: false,
        error: 'session_id가 필요합니다'
      }, { status: 400 })
    }

    // 3. UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(session_id)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 session_id 형식입니다'
      }, { status: 400 })
    }

    // 4. 이미 존재하는 세션인지 확인
    const { data: existingSession, error: checkError } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id')
      .eq('session_id', session_id)
      .single()

    if (existingSession) {
      console.log('ℹ️ 이미 존재하는 세션:', session_id)
      
      // 기존 세션의 last_activity만 업데이트
      const { error: updateError } = await supabase
        .from('anonymous_sessions')
        .update({ 
          last_activity: last_activity || new Date().toISOString() 
        })
        .eq('session_id', session_id)

      if (updateError) {
        console.error('❌ 세션 업데이트 실패:', updateError)
        return NextResponse.json({
          success: false,
          error: '세션 업데이트에 실패했습니다'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        session_id: existingSession.session_id
      })
    }

    // 5. 새 세션 DB에 저장
    const currentTime = new Date().toISOString()
    const { data: newSession, error: insertError } = await supabase
      .from('anonymous_sessions')
      .insert({
        session_id,
        created_at: created_at || currentTime,
        last_activity: last_activity || currentTime,
        is_active: true
      })
      .select('id, session_id')
      .single()

    if (insertError || !newSession) {
      console.error('❌ 세션 DB 저장 실패:', insertError)
      return NextResponse.json({
        success: false,
        error: '세션 저장에 실패했습니다'
      }, { status: 500 })
    }

    console.log('✅ 새 익명 세션 DB 저장 완료:', {
      session_id: newSession.session_id,
      db_id: newSession.id
    })

    return NextResponse.json({
      success: true,
      session_id: newSession.session_id
    })

  } catch (error) {
    console.error('❌ 익명 세션 저장 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '세션 저장 중 예상치 못한 오류가 발생했습니다'
    }, { status: 500 })
  }
}

// 세션 정보 조회용 GET 메서드
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const session_id = searchParams.get('session_id')

  if (!session_id) {
    return NextResponse.json({
      success: false,
      error: 'session_id 파라미터가 필요합니다'
    }, { status: 400 })
  }

  try {
    const { data: sessionData, error } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id, created_at, last_activity, is_active')
      .eq('session_id', session_id)
      .single()

    if (error || !sessionData) {
      return NextResponse.json({
        success: false,
        error: '세션을 찾을 수 없습니다'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      session: sessionData
    })

  } catch (error) {
    console.error('❌ 세션 조회 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '세션 조회 중 오류가 발생했습니다'
    }, { status: 500 })
  }
}