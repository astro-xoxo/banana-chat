import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authenticateUser } from '@/lib/auth-server'

// 서버 사이드 Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { chatbot_id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('메시지 히스토리 조회:', {
      chatbot_id: params.chatbot_id,
      session_id: sessionId,
      page,
      limit
    })

    // 입력값 검증
    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 🔐 사용자 인증 확인 (하드코딩 제거)
    const authenticatedUser = await authenticateUser(request);
    if (!authenticatedUser) {
      console.error('메시지 히스토리: 사용자 인증 실패');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log('메시지 히스토리: 사용자 인증 성공:', authenticatedUser.email);

    // 챗봇 소유권 확인 (실제 인증된 사용자 ID 사용)
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('id', params.chatbot_id)
      .eq('user_id', authenticatedUser.id)
      .single()

    if (chatbotError || !chatbot) {
      console.error('챗봇 조회 오류:', chatbotError)
      return NextResponse.json(
        { error: 'chatbot_not_found' },
        { status: 404 }
      )
    }

    // 메시지 히스토리 조회 (실제 스키마에 맞게)
    const offset = (page - 1) * limit
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        role,
        created_at,
        session_id
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (messagesError) {
      console.error('메시지 조회 오류:', messagesError)
      return NextResponse.json(
        { error: '메시지 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 응답 형식 변환 및 검증
    const formattedMessages = (messages || []).map(msg => {
      // ✅ 필수 필드 검증
      if (!msg.id || !msg.content || !msg.role || !msg.created_at) {
        console.warn('불완전한 메시지 데이터:', msg);
        return null;
      }
      
      return {
        id: msg.id,
        content: msg.content,
        role: msg.role, // 'user' 또는 'assistant'
        created_at: msg.created_at,
        session_id: msg.session_id,
        message: msg.content, // API 호환성을 위한 별칭
        sender_type: msg.role === 'user' ? 'user' : 'bot' // 클라이언트 호환성
      };
    }).filter(msg => msg !== null).reverse(); // 시간순으로 다시 정렬

    console.log(`✅ 메시지 히스토리 조회 완료: ${formattedMessages.length}개 (요청: ${messages?.length || 0}개)`);

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        has_more: (messages?.length || 0) === limit,
        total_returned: formattedMessages.length
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ 메시지 히스토리 API 오류:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      chatbot_id: params.chatbot_id,
      request_url: request.url
    });
    
    // 에러 타입별 처리
    if (error instanceof Error) {
      if (error.message.includes('Invalid input')) {
        return NextResponse.json(
          { error: '잘못된 요청 형식입니다.' },
          { status: 400 }
        );
      } else if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: '요청 시간이 초과되었습니다.' },
          { status: 408 }
        );
      }
    }
    
    return NextResponse.json(
      { 
        error: '서버 오류가 발생했습니다.',
        error_id: Date.now().toString() // 에러 추적용 ID
      },
      { status: 500 }
    );
  }
}
