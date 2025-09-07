/**
 * 채팅 이미지 생성 API (Profile Image와 동일한 동기식 시스템)
 * user-uploads 버킷의 이미지를 사용하여 chat-images 버킷에 저장
 * Profile Image와 동일한 callComfyUIServer() 직접 호출 방식
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase-server'
import { ImageGenerationQuotaService } from '@/lib/services/quota/ImageGenerationQuotaService'
import { callComfyUIServer } from '@/lib/comfyui/client'
import { validateImageUrlAccessibility, convertToPublicImageUrl } from '@/lib/utils/imageHelpers'

interface ChatImageGenerationRequest {
  user_uploads_url: string  // user-uploads 버킷의 이미지 URL
  prompt: string           // 채팅 이미지 생성 프롬프트
  session_id: string       // 채팅 세션 ID
  chatbot_id?: string      // 연관된 챗봇 ID
  style?: string           // 이미지 스타일 (기본: 'anime')
  aspectRatio?: string     // 종횡비 (기본: '16:9')
  quality?: string         // 품질 (기본: 'hd')
}

interface ChatImageGenerationResponse {
  success: boolean
  chat_image_url?: string   // chat-images 버킷의 Public URL
  generation_job_id?: string
  processing_time?: number
  error?: string
}

export async function POST(request: NextRequest) {
  console.log('=== 채팅 이미지 생성 API 시작 (동기식 - Profile Image와 동일) ===')
  
  try {
    // 1. 요청 데이터 파싱
    const body = await request.json()
    const { 
      user_uploads_url, 
      prompt, 
      session_id, 
      chatbot_id,
      style = 'anime',
      aspectRatio = '16:9',
      quality = 'hd'
    }: ChatImageGenerationRequest = body

    console.log('요청 데이터:', {
      prompt: prompt?.substring(0, 50) + '...',
      session_id,
      chatbot_id,
      style,
      aspectRatio,
      quality,
      user_uploads_url: user_uploads_url ? user_uploads_url.substring(0, 50) + '...' : 'null'
    })

    // 2. 입력 검증
    if (!user_uploads_url || !prompt || !session_id) {
      console.error('필수 파라미터 누락:', { 
        user_uploads_url: !!user_uploads_url, 
        prompt: !!prompt,
        session_id: !!session_id
      })
      return NextResponse.json(
        { 
          success: false,
          error: '필수 파라미터가 누락되었습니다. (user_uploads_url, prompt, session_id 필수)' 
        }, 
        { status: 400 }
      )
    }

    // user-uploads 버킷 URL 검증
    if (!user_uploads_url.includes('/user-uploads/')) {
      console.error('유효하지 않은 user-uploads URL:', user_uploads_url)
      return NextResponse.json(
        { 
          success: false,
          error: 'user_uploads_url은 user-uploads 버킷의 이미지 URL이어야 합니다.' 
        }, 
        { status: 400 }
      )
    }

    // 3. 사용자 인증 확인
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.error('인증되지 않은 요청')
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.' 
        }, 
        { status: 401 }
      )
    }

    const userId = session.user.id
    console.log('인증된 사용자:', userId)

    // 4. 이미지 생성 쿼터 확인 (ImageGenerationQuotaService 사용)
    console.log('이미지 생성 쿼터 확인 중...')
    const quotaService = new ImageGenerationQuotaService()
    const quotaCheck = await quotaService.checkImageGenerationQuota(userId)

    if (!quotaCheck.canGenerate) {
      console.error('이미지 생성 쿼터 부족:', {
        userId,
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
        resetTime: quotaCheck.resetTime
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: `일일 이미지 생성 제한에 도달했습니다. (${quotaCheck.remaining}/${quotaCheck.limit})`,
          remaining: quotaCheck.remaining,
          resetTime: quotaCheck.resetTime
        }, 
        { status: 429 }
      )
    }

    console.log('쿼터 확인 완료 - 생성 가능:', `${quotaCheck.remaining}/${quotaCheck.limit}`)

    // 5. 이미지 URL 접근성 확인 (Profile Image와 동일)
    console.log('사용자 이미지 URL 접근성 확인 중...')
    
    // Public URL로 변환 (필요시)
    const publicImageUrl = convertToPublicImageUrl(user_uploads_url)
    
    const isAccessible = await validateImageUrlAccessibility(publicImageUrl)
    
    if (!isAccessible) {
      console.error('이미지 URL 접근 불가:', {
        originalUrl: user_uploads_url.substring(0, 50) + '...',
        publicUrl: publicImageUrl.substring(0, 50) + '...'
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: '업로드된 이미지에 접근할 수 없습니다. 이미지가 올바르게 업로드되었는지 확인해주세요.' 
        }, 
        { status: 400 }
      )
    }

    console.log('이미지 URL 접근 가능 확인')

    // 6. ComfyUI 서버에 동기식 호출 (Profile Image와 동일한 방식)
    console.log('ComfyUI 서버에 채팅 이미지 생성 요청 중...')
    const startTime = Date.now()

    // Profile Image와 동일한 방식으로 callComfyUIServer 사용
    const comfyUIResponse = await callComfyUIServer(
      publicImageUrl, 
      'chat_1',  // 채팅 이미지용 고정 프리셋
      userId,
      {
        chatbotName: `채팅 이미지: ${prompt.substring(0, 20)}...`,
        timeout: 120000,  // 2분 타임아웃
        retries: 2,
        customPrompt: prompt, // 채팅 이미지용 커스텀 프롬프트
        metadata: {
          session_id: session_id,
          chatbot_id: chatbot_id,
          style: style,
          aspectRatio: aspectRatio,
          quality: quality
        }
      }
    )

    const processingTime = Date.now() - startTime

    if (!comfyUIResponse.success) {
      console.error('ComfyUI 채팅 이미지 생성 실패:', comfyUIResponse.error)
      return NextResponse.json({
        success: false,
        error: comfyUIResponse.error || '채팅 이미지 생성에 실패했습니다.'
      }, { status: 500 })
    }

    if (!comfyUIResponse.chat_image_url) {
      console.error('ComfyUI에서 chat_image_url을 반환하지 않음')
      return NextResponse.json({
        success: false,
        error: '생성된 채팅 이미지 URL을 받지 못했습니다.'
      }, { status: 500 })
    }

    console.log('ComfyUI 채팅 이미지 생성 성공:', {
      chat_image_url: comfyUIResponse.chat_image_url.substring(0, 50) + '...',
      generation_job_id: comfyUIResponse.generation_job_id,
      processing_time: processingTime
    })

    // 7. 이미지 생성 성공 후 쿼터 차감 (Profile Image와 동일)
    console.log('이미지 생성 쿼터 차감 중...')
    const consumeResult = await quotaService.consumeImageGenerationQuota(userId)
    
    if (!consumeResult.success) {
      console.error('쿼터 차감 실패:', consumeResult.error)
      // 쿼터 차감 실패는 경고만 하고 계속 진행
    } else {
      console.log('이미지 생성 쿼터 차감 완료:', `${consumeResult.remaining}/${consumeResult.limit}`)
    }

    // 8. 성공 응답 반환 (Profile Image와 유사한 구조)
    console.log('=== 채팅 이미지 생성 완료 ===')

    const response: ChatImageGenerationResponse = {
      success: true,
      chat_image_url: comfyUIResponse.chat_image_url, // chat-images 버킷 URL
      generation_job_id: comfyUIResponse.generation_job_id,
      processing_time: processingTime
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('채팅 이미지 생성 API 예외 발생:', error)
    
    let errorMessage = '서버 오류가 발생했습니다.'
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'ComfyUI 서버 연결이 시간 초과되었습니다.'
      } else if (error.message.includes('fetch')) {
        errorMessage = 'ComfyUI 서버에 연결할 수 없습니다.'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      }, 
      { status: 500 }
    )
  }
}

// GET 요청: 채팅 이미지 생성 가능 여부 확인
export async function GET(request: NextRequest) {
  try {
    const { client: supabase } = await createAuthenticatedServerClient(request)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.' 
        }, 
        { status: 401 }
      )
    }

    // ImageGenerationQuotaService로 쿼터 상태 조회
    const quotaService = new ImageGenerationQuotaService()
    const quotaCheck = await quotaService.checkImageGenerationQuota(session.user.id)

    return NextResponse.json({
      success: true,
      can_generate: quotaCheck.canGenerate,
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      reset_time: quotaCheck.resetTime,
      synchronous: true, // 동기식 처리 활성화
      direct_call: true  // 직접 호출 방식
    })

  } catch (error) {
    console.error('채팅 이미지 생성 상태 확인 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '상태 확인 중 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    )
  }
}
