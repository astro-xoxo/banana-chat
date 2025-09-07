import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNanoBananaService } from '@/lib/services/nanoBananaService'
import { getMessageToPromptService } from '@/lib/services/message-to-prompt'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ChatImageGenerationRequest {
  // 익명 세션 정보
  session_id: string
  
  // 챗봇 정보
  chatbot_id: string
  
  // 채팅 메시지 정보
  chat_session_id?: string
  chat_message_id?: string
  message_content: string // 이미지를 생성할 메시지 내용
  
  // 이미지 생성 설정 (선택사항)
  aspect_ratio?: 'SQUARE' | 'LANDSCAPE' | 'PORTRAIT'
}

interface ChatImageGenerationResponse {
  success: boolean
  image_url?: string
  generation_time_ms?: number
  error?: string
  metadata?: any
  analysis_result?: any // 메시지 분석 결과 (디버깅용)
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatImageGenerationResponse>> {
  console.log('🍌 NanoBanana 채팅 이미지 생성 API 시작 (메시지 분석 기반)')
  
  try {
    // 1. 요청 데이터 파싱
    const body: ChatImageGenerationRequest = await request.json()
    const { 
      session_id, 
      chatbot_id, 
      chat_session_id,
      chat_message_id,
      message_content, 
      aspect_ratio = 'LANDSCAPE' 
    } = body
    
    console.log('📋 채팅 이미지 생성 요청:', {
      session_id,
      chatbot_id,
      chat_session_id,
      message_content: message_content.substring(0, 100) + '...',
      aspect_ratio
    })

    // 2. 입력값 검증
    if (!session_id || !chatbot_id || !message_content) {
      return NextResponse.json({
        success: false,
        error: '필수 입력값이 누락되었습니다 (session_id, chatbot_id, message_content)'
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

    // 4. 챗봇 정보 조회 (이미지 생성에 필요한 컨텍스트)
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

    // 5. 메시지 분석 시스템으로 키워드 추출 및 프롬프트 생성
    console.log('🔍 메시지 분석 시작')
    const messageToPromptService = getMessageToPromptService()
    
    const analysisResult = await messageToPromptService.convert({
      message_id: chat_message_id || `temp-${Date.now()}`,
      session_id,
      content: message_content,
      gender: chatbot.gender,
      chat_history: [], // TODO: 이전 채팅 기록 추가 가능
      user_preferences: {
        preferred_style: 'natural',
        art_style: 'realistic'
      }
    }, {
      quality_level: 'high',
      template_id: 'general'
    })

    if (!analysisResult.success) {
      console.error('❌ 메시지 분석 실패:', analysisResult.error)
      return NextResponse.json({
        success: false,
        error: `메시지 분석 실패: ${analysisResult.error?.message || '알 수 없는 오류'}`
      }, { status: 500 })
    }

    console.log('✅ 메시지 분석 완료:', {
      keywords: analysisResult.prompt?.source_keywords,
      quality_score: analysisResult.prompt?.quality_score,
      prompt_preview: analysisResult.prompt?.positive_prompt.substring(0, 100) + '...'
    })

    // 6. ComfyUI 프롬프트를 Gemini API에 맞게 조정
    const geminiPrompt = adaptPromptForGemini(
      analysisResult.prompt!.positive_prompt,
      chatbot,
      analysisResult.prompt!.source_keywords
    )

    console.log('🔄 Gemini 프롬프트 변환 완료:', geminiPrompt.substring(0, 150) + '...')

    // 7. NanoBanana 서비스로 채팅 이미지 생성
    const nanoBananaService = createNanoBananaService()
    
    // NanoBanana 서비스의 generateChatImageWithPrompt 메서드를 직접 프롬프트로 호출
    const imageResult = await nanoBananaService.generateChatImageWithPrompt(
      geminiPrompt,
      aspect_ratio
    )
    
    if (!imageResult.success) {
      console.error('❌ 채팅 이미지 생성 실패:', imageResult.error)
      return NextResponse.json({
        success: false,
        error: `이미지 생성 실패: ${imageResult.error}`
      }, { status: 500 })
    }

    // 8. 생성된 이미지 추적 정보 저장
    if (imageResult.profile_image_url) {
      const { data: imageTrack, error: imageTrackError } = await supabase
        .from('generated_images')
        .insert({
          session_id,
          chatbot_id,
          chat_message_id,
          image_type: 'chat',
          original_prompt: message_content,
          processed_prompt: geminiPrompt,
          image_url: imageResult.profile_image_url,
          generation_status: 'completed',
          generation_time_ms: imageResult.generation_time_ms
        })
        .select('id')
        .single()

      if (imageTrackError) {
        console.warn('⚠️ 이미지 추적 정보 저장 실패:', imageTrackError)
      }
    }

    // 9. 채팅 메시지에 이미지 URL 업데이트 (chat_message_id가 있는 경우)
    if (chat_message_id && imageResult.profile_image_url) {
      const { error: messageUpdateError } = await supabase
        .from('chat_messages')
        .update({
          image_url: imageResult.profile_image_url,
          image_generation_prompt: geminiPrompt
        })
        .eq('id', chat_message_id)
        .eq('session_id', session_id)

      if (messageUpdateError) {
        console.warn('⚠️ 채팅 메시지 이미지 URL 업데이트 실패:', messageUpdateError)
      }
    }

    // 10. 세션 활동 시간 업데이트
    await supabase
      .from('anonymous_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', session_id)

    console.log('🎉 채팅 이미지 생성 완료:', {
      image_url: imageResult.profile_image_url,
      generation_time: imageResult.generation_time_ms,
      analysis_quality: analysisResult.prompt?.quality_score
    })

    return NextResponse.json({
      success: true,
      image_url: imageResult.profile_image_url,
      generation_time_ms: imageResult.generation_time_ms,
      analysis_result: {
        keywords: analysisResult.prompt?.source_keywords,
        quality_score: analysisResult.prompt?.quality_score,
        original_prompt: analysisResult.prompt?.positive_prompt,
        adapted_prompt: geminiPrompt
      },
      metadata: {
        service: 'nanobanana',
        chatbot_name: chatbot.name,
        analysis_engine: 'message-to-prompt',
        ...imageResult.metadata
      }
    })

  } catch (error) {
    console.error('❌ 채팅 이미지 생성 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '채팅 이미지 생성 중 예상치 못한 오류가 발생했습니다'
    }, { status: 500 })
  }
}

// ComfyUI 프롬프트를 Gemini API에 맞게 조정하는 함수
function adaptPromptForGemini(
  comfyUIPrompt: string,
  chatbot: any,
  keywords: any
): string {
  // 1. ComfyUI 특유의 태그들 제거 (<lora:xxx>, (quality tags) 등)
  let cleanPrompt = comfyUIPrompt
    .replace(/<[^>]*>/g, '') // HTML-like tags 제거
    .replace(/\([^)]*\)/g, '') // 괄호 안의 가중치 제거
    .replace(/\[[^\]]*\]/g, '') // 대괄호 태그 제거
    .replace(/,\s*,/g, ',') // 연속된 콤마 정리
    .replace(/^\s*,|,\s*$/g, '') // 시작/끝 콤마 제거
    .trim()

  // 2. 챗봇 컨텍스트 정보 추가
  let contextualPrompt = `A ${chatbot.age}-year-old ${chatbot.gender === 'female' ? 'woman' : 'man'} named ${chatbot.name}, `
  
  // 3. 추출된 키워드 기반 상황 설명 추가
  if (keywords?.situations && keywords.situations.length > 0) {
    contextualPrompt += `${keywords.situations.join(', ')}, `
  }
  
  if (keywords?.actions && keywords.actions.length > 0) {
    contextualPrompt += `${keywords.actions.join(', ')}, `
  }

  // 4. 정리된 프롬프트와 컨텍스트 결합
  contextualPrompt += cleanPrompt

  // 5. Gemini에 적합한 기본 품질 태그 추가
  contextualPrompt += ', high quality, natural lighting, detailed, photorealistic, East Asian features'

  // 6. 감정 정보 추가 (있는 경우)
  if (keywords?.emotions && keywords.emotions.length > 0) {
    contextualPrompt += `, ${keywords.emotions.join(', ')} expression`
  }

  return contextualPrompt
}