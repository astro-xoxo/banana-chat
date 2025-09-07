// NanoBanana (Gemini) API 이미지 생성 서비스
// ComfyUI를 대체하는 새로운 이미지 생성 서비스

import { ImageGenerationService, GenerateProfileParams, ProfileResult } from './mockImageService'

// Gemini API 타입 정의 (올바른 형식)
interface GeminiImageRequest {
  contents: Array<{
    parts: Array<{
      text: string
    }>
  }>
}

interface GeminiImageResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }
    finishReason: string
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }>
  error?: {
    code: number
    message: string
    status: string
  }
}

// NanoBanana API 클라이언트
export class NanoBananaService implements ImageGenerationService {
  private readonly apiKey: string
  private readonly baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent'
  private readonly timeout: number = 60000 // 1분 타임아웃

  constructor() {
    this.apiKey = process.env.BANANA_CHAT_API_KEY || process.env.NEXT_PUBLIC_NANOBANANA_API_KEY || ''
    
    if (!this.apiKey) {
      throw new Error('NanoBanana API 키가 설정되지 않았습니다. BANANA_CHAT_API_KEY 환경변수를 확인하세요.')
    }
    
    console.log('🍌 NanoBanana 서비스 초기화 완료')
  }

  async generateProfile(params: GenerateProfileParams): Promise<ProfileResult> {
    console.log('🍌 NanoBanana 프로필 이미지 생성 시작:', params)
    
    try {
      const startTime = Date.now()
      
      // 프롬프트 생성 (사용자 입력 기반)
      const imagePrompt = this.createProfilePrompt(params)
      console.log('📝 생성된 프롬프트:', imagePrompt)
      
      // Gemini API 요청 구성 (올바른 형식)
      const requestBody: GeminiImageRequest = {
        contents: [{
          parts: [{
            text: imagePrompt
          }]
        }]
      }

      // API 호출
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BananaChat/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('🍌 NanoBanana API 오류:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(`NanoBanana API 오류: ${response.status} - ${response.statusText}`)
      }

      const result: GeminiImageResponse = await response.json()
      console.log('🍌 NanoBanana API 응답:', result)

      // 오류 체크
      if (result.error) {
        console.error('🍌 Gemini API 내부 오류:', result.error)
        throw new Error(`Gemini API 오류: ${result.error.message}`)
      }

      // 결과 처리
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('이미지 생성 결과가 없습니다')
      }

      const candidate = result.candidates[0]
      
      // 안전성 검사 실패 체크
      if (candidate.finishReason !== 'STOP') {
        console.warn('🍌 이미지 생성 중단됨:', candidate.finishReason)
        if (candidate.safetyRatings) {
          console.warn('🍌 안전성 등급:', candidate.safetyRatings)
        }
        throw new Error(`이미지 생성이 안전성 정책으로 인해 중단되었습니다: ${candidate.finishReason}`)
      }

      // 이미지 데이터 추출 (base64 형식)
      const imagePart = candidate.content.parts.find(part => part.inlineData?.mimeType.startsWith('image/'))
      if (!imagePart || !imagePart.inlineData) {
        throw new Error('생성된 이미지 데이터를 찾을 수 없습니다')
      }

      // base64 이미지를 Supabase Storage에 저장
      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const fileName = `profile-${params.user_id}-${timestamp}-${randomStr}.png`
      
      // Supabase 클라이언트 생성
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // generated-images 버킷에 저장
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(fileName, imageBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('🍌 이미지 저장 실패:', uploadError)
        throw new Error(`이미지 저장에 실패했습니다: ${uploadError.message}`)
      }

      // 공개 URL 생성
      const { data: publicUrlData } = supabase.storage
        .from('generated-images')
        .getPublicUrl(fileName)

      const imageUrl = publicUrlData.publicUrl
      const generationTime = Date.now() - startTime

      // 데이터베이스에 이미지 정보 저장
      const { error: dbError } = await supabase
        .from('generated_images')
        .insert({
          session_id: params.user_id,
          image_type: 'profile',
          original_prompt: imagePrompt,
          processed_prompt: imagePrompt,
          image_url: imageUrl,
          storage_path: uploadData.path,
          generation_time_ms: generationTime
        })

      if (dbError) {
        console.warn('🍌 이미지 DB 저장 실패 (이미지는 생성됨):', dbError)
        // DB 저장 실패해도 이미지는 생성되었으므로 계속 진행
      }

      console.log('🍌 NanoBanana 이미지 생성 및 저장 완료:', {
        imageUrl,
        generationTime,
        mimeType: imagePart.inlineData.mimeType,
        fileName
      })

      return {
        success: true,
        profile_image_url: imageUrl,
        generation_time_ms: generationTime,
        metadata: {
          service: 'nanobanana',
          prompt: imagePrompt,
          fileName: fileName,
          mimeType: imagePart.inlineData.mimeType,
          safetyRatings: candidate.safetyRatings
        }
      }

    } catch (error) {
      console.error('🍌 NanoBanana 이미지 생성 실패:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '이미지 생성 중 알 수 없는 오류가 발생했습니다',
        generation_time_ms: Date.now() - Date.now()
      }
    }
  }

  // 채팅 이미지 생성용 메서드
  async generateChatImage(
    chatbotName: string, 
    chatbotAge: number,
    chatbotGender: string,
    relationship: string,
    concept: string,
    messageContent: string
  ): Promise<ProfileResult> {
    console.log('🍌 NanoBanana 채팅 이미지 생성 시작')
    
    try {
      const startTime = Date.now()
      
      // 채팅 컨텍스트 기반 프롬프트 생성
      const imagePrompt = this.createChatImagePrompt({
        chatbotName,
        chatbotAge,
        chatbotGender,
        relationship,
        concept,
        messageContent
      })
      
      console.log('📝 채팅 이미지 프롬프트:', imagePrompt)
      
      const requestBody: GeminiImageRequest = {
        prompt: imagePrompt,
        aspectRatio: 'LANDSCAPE', // 채팅 이미지는 가로형
        personGeneration: 'ALLOW',
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      }

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BananaChat/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`NanoBanana API 오류: ${response.status}`)
      }

      const result: GeminiImageResponse = await response.json()

      if (result.error || !result.candidates?.[0]) {
        throw new Error('채팅 이미지 생성 실패')
      }

      const candidate = result.candidates[0]
      const imageUrl = candidate.image.imageUrl
      const generationTime = Date.now() - startTime

      return {
        success: true,
        profile_image_url: imageUrl,
        generation_time_ms: generationTime,
        metadata: {
          service: 'nanobanana',
          type: 'chat_image',
          prompt: imagePrompt
        }
      }

    } catch (error) {
      console.error('🍌 채팅 이미지 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '채팅 이미지 생성 실패',
        generation_time_ms: 0
      }
    }
  }

  // 프로필 이미지용 프롬프트 생성
  private createProfilePrompt(params: GenerateProfileParams): string {
    const { chatbot_name, preset_id } = params
    
    // preset_id에서 사용자 입력 정보 추출 (실제로는 데이터베이스에서 가져와야 함)
    // 여기서는 간단히 처리
    const basePrompt = `A beautiful portrait of ${chatbot_name}, high quality, professional lighting, detailed facial features, warm expression`
    
    // 아시아인 스타일 추가
    const stylePrompt = `${basePrompt}, East Asian features, natural makeup, soft lighting, studio portrait style`
    
    return stylePrompt
  }

  // 메시지 분석 결과를 기반으로 한 채팅 이미지 생성 (새로운 메서드)
  async generateChatImageWithPrompt(
    geminiPrompt: string,
    aspectRatio: 'SQUARE' | 'LANDSCAPE' | 'PORTRAIT' = 'LANDSCAPE'
  ): Promise<ProfileResult> {
    console.log('🍌 NanoBanana 분석된 프롬프트 기반 채팅 이미지 생성 시작')
    
    try {
      const startTime = Date.now()
      
      console.log('📝 분석된 프롬프트:', geminiPrompt)
      
      const requestBody: GeminiImageRequest = {
        prompt: geminiPrompt,
        aspectRatio: aspectRatio,
        personGeneration: 'ALLOW',
        safetySettings: [
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      }

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BananaChat/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`NanoBanana API 오류: ${response.status}`)
      }

      const result: GeminiImageResponse = await response.json()

      if (result.error || !result.candidates?.[0]) {
        throw new Error('분석된 프롬프트 기반 채팅 이미지 생성 실패')
      }

      const candidate = result.candidates[0]
      
      // 안전성 검사 실패 체크
      if (candidate.finishReason !== 'STOP') {
        console.warn('🍌 이미지 생성 중단됨:', candidate.finishReason)
        throw new Error(`이미지 생성이 안전성 정책으로 인해 중단되었습니다: ${candidate.finishReason}`)
      }

      const imageUrl = candidate.image.imageUrl
      const generationTime = Date.now() - startTime

      return {
        success: true,
        profile_image_url: imageUrl,
        generation_time_ms: generationTime,
        metadata: {
          service: 'nanobanana',
          type: 'chat_image_analyzed',
          prompt: geminiPrompt,
          aspectRatio,
          altText: candidate.image.altText,
          safetyRatings: candidate.safetyRatings
        }
      }

    } catch (error) {
      console.error('🍌 분석된 프롬프트 기반 채팅 이미지 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '분석된 프롬프트 기반 채팅 이미지 생성 실패',
        generation_time_ms: 0
      }
    }
  }

  // 채팅 이미지용 프롬프트 생성
  private createChatImagePrompt(context: {
    chatbotName: string
    chatbotAge: number
    chatbotGender: string
    relationship: string
    concept: string
    messageContent: string
  }): string {
    const { chatbotName, chatbotAge, chatbotGender, relationship, concept, messageContent } = context
    
    // 기본 캐릭터 설정
    let characterDesc = `${chatbotAge}-year-old ${chatbotGender === 'female' ? 'woman' : 'man'} named ${chatbotName}`
    
    // 관계 설정 반영
    let relationshipDesc = ''
    if (relationship.includes('친구')) {
      relationshipDesc = 'friendly and casual'
    } else if (relationship.includes('연인')) {
      relationshipDesc = 'romantic and intimate'
    } else if (relationship.includes('가족')) {
      relationshipDesc = 'warm and familial'
    }
    
    // 컨셉 반영
    let conceptDesc = concept ? `, ${concept} style` : ''
    
    // 메시지 내용 기반 상황 설정
    let situationDesc = 'in a comfortable indoor setting'
    if (messageContent.includes('밖') || messageContent.includes('나가')) {
      situationDesc = 'in an outdoor setting'
    } else if (messageContent.includes('카페') || messageContent.includes('커피')) {
      situationDesc = 'in a cozy cafe'
    }
    
    const fullPrompt = `A ${relationshipDesc} portrait of a ${characterDesc}${conceptDesc}, ${situationDesc}, high quality, natural lighting, expressive, East Asian features`
    
    return fullPrompt
  }
}

// 팩토리 함수
export function createNanoBananaService(): NanoBananaService {
  return new NanoBananaService()
}