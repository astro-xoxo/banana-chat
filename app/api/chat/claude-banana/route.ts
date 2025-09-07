import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateClaudeResponse } from '@/lib/claude'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ChatRequest {
  // 익명 세션 정보
  session_id: string
  
  // 챗봇 정보
  chatbot_id: string
  
  // 채팅 세션 정보 (선택사항 - 새 대화인 경우 자동 생성)
  chat_session_id?: string
  
  // 사용자 메시지
  message: string
  
  // 이미지 생성 요청 (선택사항)
  generate_image?: boolean
}

interface ChatResponse {
  success: boolean
  
  // 응답 데이터
  chat_session_id?: string
  user_message_id?: string
  assistant_message_id?: string
  assistant_response?: string
  
  // 이미지 생성 결과 (요청한 경우)
  generated_image_url?: string
  image_generation_time_ms?: number
  
  // 오류 정보
  error?: string
  
  // 메타데이터
  response_time_ms?: number
  tokens_used?: number
  metadata?: any
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  console.log('🍌 Claude Banana 채팅 API 시작')
  const startTime = Date.now()
  
  try {
    // 1. 요청 데이터 파싱
    const body: ChatRequest = await request.json()
    const { session_id, chatbot_id, chat_session_id, message, generate_image = false } = body
    
    console.log('💬 채팅 요청:', {
      session_id,
      chatbot_id,
      chat_session_id,
      message: message.substring(0, 100) + '...',
      generate_image
    })

    // 2. 입력값 검증
    if (!session_id || !chatbot_id || !message) {
      return NextResponse.json({
        success: false,
        error: '필수 입력값이 누락되었습니다 (session_id, chatbot_id, message)'
      }, { status: 400 })
    }

    // 3. 세션 유효성 확인
    const { data: sessionData, error: sessionError } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id')
      .eq('session_id', session_id)
      .single()

    if (sessionError || !sessionData) {
      console.error('❌ 세션 조회 실패:', sessionError)
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 세션입니다'
      }, { status: 401 })
    }

    // 4. 챗봇 정보 조회 (시스템 프롬프트 생성용)
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name, age, gender, relationship, concept, personality')
      .eq('id', chatbot_id)
      .eq('session_id', session_id)
      .eq('is_active', true)
      .single()

    if (chatbotError || !chatbot) {
      console.error('❌ 챗봇 조회 실패:', chatbotError)
      return NextResponse.json({
        success: false,
        error: '해당 챗봇을 찾을 수 없습니다'
      }, { status: 404 })
    }

    // 5. 채팅 세션 생성 또는 조회
    let finalChatSessionId = chat_session_id
    
    if (!finalChatSessionId) {
      // 새 채팅 세션 생성
      const { data: newSession, error: sessionCreateError } = await supabase
        .from('chat_sessions')
        .insert({
          chatbot_id,
          session_id,
          title: message.substring(0, 100) // 첫 메시지를 제목으로 사용
        })
        .select('id')
        .single()

      if (sessionCreateError || !newSession) {
        console.error('❌ 채팅 세션 생성 실패:', sessionCreateError)
        return NextResponse.json({
          success: false,
          error: '채팅 세션 생성에 실패했습니다'
        }, { status: 500 })
      }

      finalChatSessionId = newSession.id
    } else {
      // 기존 채팅 세션 유효성 확인
      const { data: existingSession, error: sessionCheckError } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', finalChatSessionId)
        .eq('session_id', session_id)
        .single()

      if (sessionCheckError || !existingSession) {
        return NextResponse.json({
          success: false,
          error: '유효하지 않은 채팅 세션입니다'
        }, { status: 404 })
      }
    }

    // 6. 사용자 메시지 저장
    const { data: userMessage, error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        chat_session_id: finalChatSessionId,
        session_id,
        role: 'user',
        content: message
      })
      .select('id')
      .single()

    if (userMessageError || !userMessage) {
      console.error('❌ 사용자 메시지 저장 실패:', userMessageError)
      return NextResponse.json({
        success: false,
        error: '메시지 저장에 실패했습니다'
      }, { status: 500 })
    }

    // 7. 이전 대화 기록 조회 (최근 10개)
    const { data: chatHistory, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('chat_session_id', finalChatSessionId)
      .order('created_at', { ascending: true })
      .limit(10)

    if (historyError) {
      console.warn('⚠️ 대화 기록 조회 실패:', historyError)
    }

    // 8. Claude API로 응답 생성
    console.log('🤖 Claude API 응답 생성 시작')
    
    // 시스템 프롬프트 생성 (챗봇 정보 기반)
    const systemPrompt = createSystemPrompt(chatbot)
    
    // 대화 컨텍스트 구성
    const messages = []
    
    // 시스템 메시지 추가
    messages.push({
      role: 'system' as const,
      content: systemPrompt
    })
    
    // 대화 기록 추가 (사용자 메시지 제외 - 마지막에 추가할 예정)
    if (chatHistory && chatHistory.length > 0) {
      const historyWithoutLast = chatHistory.slice(0, -1) // 방금 저장한 사용자 메시지 제외
      for (const msg of historyWithoutLast) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })
      }
    }
    
    // 현재 사용자 메시지 추가
    messages.push({
      role: 'user' as const,
      content: message
    })

    // Claude API 호출
    const claudeResponse = await generateClaudeResponse(messages)
    
    if (!claudeResponse.success || !claudeResponse.response) {
      console.error('❌ Claude API 응답 실패:', claudeResponse.error)
      return NextResponse.json({
        success: false,
        error: `AI 응답 생성에 실패했습니다: ${claudeResponse.error}`
      }, { status: 500 })
    }

    // 9. 어시스턴트 메시지 저장
    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('chat_messages')
      .insert({
        chat_session_id: finalChatSessionId,
        session_id,
        role: 'assistant',
        content: claudeResponse.response,
        tokens_used: claudeResponse.tokensUsed || 0
      })
      .select('id')
      .single()

    if (assistantMessageError || !assistantMessage) {
      console.error('❌ 어시스턴트 메시지 저장 실패:', assistantMessageError)
      return NextResponse.json({
        success: false,
        error: '응답 저장에 실패했습니다'
      }, { status: 500 })
    }

    // 10. 이미지 생성 (요청한 경우)
    let generatedImageUrl: string | undefined
    let imageGenerationTime: number | undefined
    
    if (generate_image) {
      console.log('🎨 채팅 이미지 생성 요청')
      
      try {
        const imageResponse = await fetch('http://localhost:3000/api/generate/chat-image-nanobanana', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            session_id,
            chatbot_id,
            chat_session_id: finalChatSessionId,
            chat_message_id: assistantMessage.id,
            message_content: message,
            aspect_ratio: 'LANDSCAPE'
          })
        })

        if (imageResponse.ok) {
          const imageResult = await imageResponse.json()
          if (imageResult.success) {
            generatedImageUrl = imageResult.image_url
            imageGenerationTime = imageResult.generation_time_ms
            console.log('✅ 채팅 이미지 생성 완료')
          } else {
            console.warn('⚠️ 채팅 이미지 생성 실패:', imageResult.error)
          }
        }
      } catch (imageError) {
        console.warn('⚠️ 채팅 이미지 생성 요청 실패:', imageError)
      }
    }

    // 11. 채팅 세션 마지막 메시지 시간 업데이트
    await supabase
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', finalChatSessionId)

    // 12. 세션 활동 시간 업데이트
    await supabase
      .from('anonymous_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', session_id)

    const responseTime = Date.now() - startTime

    console.log('🎉 채팅 완료:', {
      chat_session_id: finalChatSessionId,
      response_time: responseTime,
      tokens_used: claudeResponse.tokensUsed,
      image_generated: !!generatedImageUrl
    })

    return NextResponse.json({
      success: true,
      chat_session_id: finalChatSessionId,
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessage.id,
      assistant_response: claudeResponse.response,
      generated_image_url: generatedImageUrl,
      image_generation_time_ms: imageGenerationTime,
      response_time_ms: responseTime,
      tokens_used: claudeResponse.tokensUsed,
      metadata: {
        service: 'claude-banana',
        chatbot_name: chatbot.name,
        system_prompt_generated: true
      }
    })

  } catch (error) {
    console.error('❌ Claude Banana 채팅 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '채팅 처리 중 예상치 못한 오류가 발생했습니다',
      response_time_ms: Date.now() - startTime
    }, { status: 500 })
  }
}

// 챗봇 정보를 기반으로 시스템 프롬프트 생성
function createSystemPrompt(chatbot: any): string {
  const systemPrompt = `${chatbot.personality}

추가 컨텍스트:
- 당신의 이름: ${chatbot.name}
- 나이: ${chatbot.age}세
- 성별: ${chatbot.gender === 'female' ? '여성' : '남성'}
- 사용자와의 관계: ${chatbot.relationship}
- 컨셉/특성: ${chatbot.concept}

대화 지침:
1. 위에 설정된 성격과 말투를 일관성 있게 유지하세요
2. 나이와 성별에 맞는 자연스러운 언어를 사용하세요  
3. 사용자와의 관계를 고려한 적절한 친밀도로 대화하세요
4. 설정된 컨셉과 특성을 대화에 자연스럽게 반영하세요
5. 한국어로 대화하며, 자연스럽고 매력적인 응답을 제공하세요`

  return systemPrompt
}