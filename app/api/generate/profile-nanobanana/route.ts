import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNanoBananaService } from '@/lib/services/nanoBananaService'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProfileGenerationRequest {
  // 익명 세션 정보
  session_id: string
  
  // 챗봇 기본 정보
  chatbot_name: string
  age: number
  gender: 'male' | 'female'
  relationship: string
  concept: string
  
  // 업로드된 참고 이미지 (선택사항)
  user_uploaded_image_url?: string
}

interface ProfileGenerationResponse {
  success: boolean
  chatbot_id?: string
  profile_image_url?: string
  generation_time_ms?: number
  error?: string
  metadata?: any
}

export async function POST(request: NextRequest): Promise<NextResponse<ProfileGenerationResponse>> {
  console.log('🍌 NanoBanana 프로필 생성 API 시작')
  
  try {
    // 1. 요청 데이터 파싱
    const body: ProfileGenerationRequest = await request.json()
    const { session_id, chatbot_name, age, gender, relationship, concept, user_uploaded_image_url } = body
    
    console.log('📋 프로필 생성 요청:', {
      session_id,
      chatbot_name,
      age,
      gender,
      relationship: relationship.substring(0, 50) + '...',
      concept: concept.substring(0, 50) + '...',
      hasUserImage: !!user_uploaded_image_url
    })

    // 2. 입력값 검증
    if (!session_id || !chatbot_name || !age || !gender || !relationship || !concept) {
      return NextResponse.json({
        success: false,
        error: '필수 입력값이 누락되었습니다'
      }, { status: 400 })
    }

    if (age < 1 || age > 150) {
      return NextResponse.json({
        success: false,
        error: '나이는 1세~150세 사이여야 합니다'
      }, { status: 400 })
    }

    if (!['male', 'female'].includes(gender)) {
      return NextResponse.json({
        success: false,
        error: '성별은 male 또는 female이어야 합니다'
      }, { status: 400 })
    }

    // 3. 세션 유효성 확인 및 자동 생성
    let { data: sessionData, error: sessionError } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id')
      .eq('session_id', session_id)
      .single()

    // 세션이 DB에 없으면 자동으로 생성
    if (sessionError || !sessionData) {
      console.log('🔄 세션이 DB에 없음, 자동 생성 시도:', session_id)
      
      const { data: newSession, error: createError } = await supabase
        .from('anonymous_sessions')
        .insert({
          session_id,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .select('id, session_id')
        .single()

      if (createError || !newSession) {
        console.error('❌ 세션 자동 생성 실패:', createError)
        return NextResponse.json({
          success: false,
          error: '세션 처리 중 오류가 발생했습니다'
        }, { status: 500 })
      }

      sessionData = newSession
      console.log('✅ 세션 자동 생성 완료:', session_id)
    }

    // 4. 이미 같은 이름의 챗봇이 있는지 확인
    const { data: existingChatbot } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('session_id', session_id)
      .eq('name', chatbot_name)
      .eq('is_active', true)
      .single()

    if (existingChatbot) {
      return NextResponse.json({
        success: false,
        error: `"${chatbot_name}"(이)라는 이름의 챗봇이 이미 존재합니다`
      }, { status: 409 })
    }

    // 5. NanoBanana 서비스로 프로필 이미지 생성
    const nanoBananaService = createNanoBananaService()
    
    // GenerateProfileParams 형태로 변환 (기존 인터페이스 호환)
    const profileParams = {
      chatbot_name,
      preset_id: `${age}-${gender}-${relationship.substring(0, 20)}`, // 간단한 preset_id 생성
      user_image_url: user_uploaded_image_url,
      user_id: session_id
    }

    const imageResult = await nanoBananaService.generateProfile(profileParams)
    
    if (!imageResult.success) {
      console.error('❌ 이미지 생성 실패:', imageResult.error)
      return NextResponse.json({
        success: false,
        error: `이미지 생성 실패: ${imageResult.error}`
      }, { status: 500 })
    }

    // 6. 사용자 입력 정보를 기반으로 말투/성격 생성
    const personality = generatePersonalityFromUserInput(
      chatbot_name, 
      age, 
      gender, 
      relationship, 
      concept
    )

    // 7. 챗봇 데이터베이스에 저장
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .insert({
        session_id,
        name: chatbot_name,
        age,
        gender,
        relationship,
        concept,
        personality,
        profile_image_url: imageResult.profile_image_url,
        user_uploaded_image_url,
        is_active: true
      })
      .select('id')
      .single()

    if (chatbotError) {
      console.error('❌ 챗봇 저장 실패:', chatbotError)
      return NextResponse.json({
        success: false,
        error: '챗봇 정보 저장 중 오류가 발생했습니다'
      }, { status: 500 })
    }

    // 8. 생성된 이미지 추적 정보 저장
    if (imageResult.profile_image_url) {
      const { error: imageTrackError } = await supabase
        .from('generated_images')
        .insert({
          session_id,
          chatbot_id: chatbot.id,
          image_type: 'profile',
          original_prompt: concept,
          processed_prompt: imageResult.metadata?.prompt || concept,
          image_url: imageResult.profile_image_url,
          generation_status: 'completed',
          generation_time_ms: imageResult.generation_time_ms
        })

      if (imageTrackError) {
        console.warn('⚠️ 이미지 추적 정보 저장 실패:', imageTrackError)
      }
    }

    // 9. 세션 활동 시간 업데이트
    await supabase
      .from('anonymous_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_id', session_id)

    console.log('🎉 프로필 생성 완료:', {
      chatbot_id: chatbot.id,
      generation_time: imageResult.generation_time_ms
    })

    return NextResponse.json({
      success: true,
      chatbot_id: chatbot.id,
      profile_image_url: imageResult.profile_image_url,
      generation_time_ms: imageResult.generation_time_ms,
      metadata: {
        service: 'nanobanana',
        personality,
        ...imageResult.metadata
      }
    })

  } catch (error) {
    console.error('❌ 프로필 생성 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while creating the profile'
    }, { status: 500 })
  }
}

// 사용자 입력 정보를 기반으로 말투/성격 생성
function generatePersonalityFromUserInput(
  name: string,
  age: number,
  gender: string,
  relationship: string,
  concept: string
): string {
  // Generate natural personality prompt using user input information
  let personalityPrompt = `I am ${name}. I'm ${age} years old and I'm ${gender === 'female' ? 'female' : 'male'}. `
  
  // Include relationship information naturally
  personalityPrompt += `My relationship with you is: ${relationship}. `
  
  // Reflect concept information in speaking style
  personalityPrompt += `${concept} `
  
  // Add natural conversation guidance
  personalityPrompt += `Based on my personality and situation, I will communicate with a natural and consistent speaking style. I will use language appropriate for my age, gender, and our relationship, and naturally incorporate my characteristics into our conversations.`
  
  console.log('🎭 Generated personality prompt:', personalityPrompt)
  
  return personalityPrompt
}