// ComfyUI 서버 연동 클라이언트 (Phase 2: 프리셋 매핑 시스템 통합)
import { mapConceptToPresetId, getSimplePresetMapping, validatePresetId, type PresetMappingResult } from './preset-mapper'
import { fileLogger, logComfyUIRequest, logComfyUIResponse } from '@/lib/fileLogger'

export interface ComfyUIRequest {
  user_image_url?: string   // user-uploads 버킷의 이미지 URL (선택적 - 메시지 기반 생성 시 null)
  preset_id: string         // "1" ~ "8" 또는 "message_based"
  user_id: string          // 사용자 ID
  environment?: string      // 환경 설정
  chatbot_name?: string     // 캐릭터 이름
  custom_prompt?: string    // 메시지 기반 생성용 커스텀 프롬프트
  negative_prompt?: string  // 네거티브 프롬프트
  metadata?: any           // 추가 메타데이터
}

export interface ComfyUIResponse {
  success: boolean
  profile_image_url?: string // profile-images 버킷의 Public URL
  chat_image_url?: string    // chat-images 버킷의 Public URL
  generation_job_id?: string
  error?: string
  processing_time?: number
  metadata?: {
    generation_job_id?: string
    character_type?: string
    server_version?: string
  }
}

export interface PresetMapping {
  gender: 'male' | 'female'
  relationship: 'lover' | 'friend' | 'some' | 'family'
  style?: string
  prompt_context?: string
}

// 8가지 ComfyUI 프리셋 매핑 (성별 × 관계) + 메시지 기반 생성
export const PRESET_MAPPING: Record<string, PresetMapping> = {
  '1': { 
    gender: 'female', 
    relationship: 'lover',
    style: 'romantic',
    prompt_context: 'beautiful romantic girlfriend, warm smile, loving eyes'
  },
  '2': { 
    gender: 'female', 
    relationship: 'friend',
    style: 'friendly',
    prompt_context: 'cheerful female friend, bright smile, casual friendly'
  },
  '3': { 
    gender: 'female', 
    relationship: 'some',
    style: 'mysterious',
    prompt_context: 'attractive female, subtle smile, mysterious charm'
  },
  '4': { 
    gender: 'female', 
    relationship: 'family',
    style: 'gentle',
    prompt_context: 'gentle family member, warm expression, caring look'
  },
  '5': { 
    gender: 'male', 
    relationship: 'lover',
    style: 'romantic',
    prompt_context: 'handsome romantic boyfriend, gentle smile, loving gaze'
  },
  '6': { 
    gender: 'male', 
    relationship: 'friend',
    style: 'friendly',
    prompt_context: 'cool male friend, casual smile, friendly attitude'
  },
  '7': { 
    gender: 'male', 
    relationship: 'some',
    style: 'charming',
    prompt_context: 'charming attractive male, confident smile, mysterious appeal'
  },
  '8': { 
    gender: 'male', 
    relationship: 'family',
    style: 'gentle',
    prompt_context: 'gentle family member, warm expression, caring look'
  },
  'message_based': {
    gender: 'neutral',
    relationship: 'contextual',
    style: 'dynamic',
    prompt_context: 'context-aware generation based on message content'
  }
}

/**
 * ComfyUI 서버 호출 (메시지 기반 생성 및 채팅 이미지 지원)
 */
export async function callComfyUIServer(
  userImageUrl: string | null,  // null일 경우 메시지 기반 생성
  presetId: string,             // 직접 전달할 프리셋 ID ("1" ~ "8"), "message_based", 또는 "chat_1"
  userId: string,
  options: {
    timeout?: number
    retries?: number
    chatbotName?: string
    environment?: string
    customPrompt?: string       // 메시지 기반 생성 또는 채팅 이미지용 커스텀 프롬프트
    negativePrompt?: string     // 네거티브 프롬프트
    metadata?: any             // 추가 메타데이터 (session_id, chatbot_id 등 포함)
  } = {}
): Promise<ComfyUIResponse> {
  const {
    timeout = 55000,        // 55초 타임아웃 (Vercel 60초 제한 내)
    retries = 2,
    chatbotName = 'AI 캐릭터',
    environment = process.env.NODE_ENV || 'production',
    customPrompt,
    negativePrompt,
    metadata
  } = options

  const comfyuiServerUrl = process.env.COMFYUI_SERVER_URL
  
  if (!comfyuiServerUrl) {
    return {
      success: false,
      error: 'ComfyUI 서버 설정이 누락되었습니다. 환경변수를 확인해주세요.'
    }
  }

  const isMessageBasedGeneration = presetId === 'message_based' || !userImageUrl;
  const isChatImageGeneration = presetId === 'chat_1'; // 채팅 이미지 구분

  console.log('ComfyUI 서버 요청 시작:', {
    server_url: comfyuiServerUrl,
    preset_id: presetId,
    user_id: userId.substring(0, 8) + '...',
    timeout: timeout + 'ms',
    retries,
    chatbot_name: chatbotName,
    environment,
    message_based: isMessageBasedGeneration,
    chat_image: isChatImageGeneration,
    has_custom_prompt: !!customPrompt,
    has_negative_prompt: !!negativePrompt
  })

  // 프리셋 ID 유효성 검증 (message_based, chat_1 포함)
  if (!validatePresetId(presetId) && presetId !== 'message_based' && presetId !== 'chat_1') {
    console.warn(`유효하지 않은 프리셋 ID: ${presetId}, 기본값 사용`)
    presetId = isChatImageGeneration ? 'chat_1' : (isMessageBasedGeneration ? 'message_based' : '1')
  }

  // ComfyUI 서버 요청 페이로드 생성
  const requestPayload: ComfyUIRequest = {
    preset_id: presetId,
    user_id: userId,
    environment: environment,
    chatbot_name: chatbotName
  }

  // 생성 타입에 따른 처리 구분
  if (isChatImageGeneration) {
    // 채팅 이미지 생성
    requestPayload.user_image_url = userImageUrl; // user-uploads 이미지 사용
    if (customPrompt) {
      requestPayload.custom_prompt = customPrompt;
    }
    if (negativePrompt) {
      requestPayload.negative_prompt = negativePrompt;
    }
    if (metadata) {
      requestPayload.metadata = metadata;
    }
    console.log('채팅 이미지 생성 모드 - 사용자 이미지 + 커스텀 프롬프트 사용');
  } else if (isMessageBasedGeneration) {
    // 메시지 기반 생성 (채팅 이미지 생성과 유사)
    requestPayload.user_image_url = userImageUrl; // 사용자 업로드 이미지 필수
    if (customPrompt) {
      requestPayload.custom_prompt = customPrompt;
    }
    if (negativePrompt) {
      requestPayload.negative_prompt = negativePrompt;
    }
    if (metadata) {
      requestPayload.metadata = metadata;
    }
    console.log('메시지 기반 생성 모드 - 사용자 이미지 + 커스텀 프롬프트 사용');
  } else {
    // 기존 이미지 기반 생성 (프로필)
    requestPayload.user_image_url = userImageUrl;
    console.log('이미지 기반 생성 모드 - 사용자 이미지 사용');
  }

  console.log('ComfyUI 요청 페이로드:', {
    user_image_url: userImageUrl ? userImageUrl.substring(0, 50) + '...' : null,
    preset_id: presetId,
    user_id: userId.substring(0, 8) + '...',
    environment: environment,
    chatbot_name: chatbotName,
    custom_prompt: customPrompt ? customPrompt.substring(0, 50) + '...' : undefined,
    negative_prompt: negativePrompt ? negativePrompt.substring(0, 30) + '...' : undefined,
    has_metadata: !!metadata
  })

  // 🔥 파일 로거: ComfyUI 요청 페이로드 전체 저장
  logComfyUIRequest('ComfyUI Server Request', requestPayload, {
    generation_type: isChatImageGeneration ? 'chat_image' : (isMessageBasedGeneration ? 'message_based' : 'image_based'),
    user_id: userId.substring(0, 8) + '...',
    timeout,
    retries
  })

  // 3. 재시도 로직이 포함된 요청 함수
  const makeRequest = async (attempt: number = 1): Promise<ComfyUIResponse> => {
    try {
      console.log(`ComfyUI 요청 시도 ${attempt}/${retries + 1}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // 엔드포인트 선택 (실제 ComfyUI 서버 엔드포인트 사용)
      const cleanServerUrl = comfyuiServerUrl.replace(/\/+$/, '') // 끝의 슬래시 제거
      const endpoint = isMessageBasedGeneration 
        ? `${cleanServerUrl}/generate-chat-image`  // 메시지 기반 이미지 생성
        : `${cleanServerUrl}/api/generate/profile`; // 프로필 이미지 생성

      console.log('ComfyUI 요청 엔드포인트:', endpoint);

      // ComfyUI 서버 요청
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true', // ngrok 브라우저 경고 우회
          'User-Agent': 'AI-Face-Chat-Client/2.0',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('ComfyUI 서버 응답 상태:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      })

      // 응답 상태 확인
      if (!response.ok) {
        let errorMessage = `ComfyUI 서버 오류: ${response.status} ${response.statusText}`
        
        if (response.status === 404) {
          errorMessage = 'ComfyUI 서버에서 요청한 엔드포인트를 찾을 수 없습니다.'
        } else if (response.status === 422) {
          try {
            const validationError = await response.json()
            errorMessage = `요청 데이터 검증 실패: ${JSON.stringify(validationError.detail || validationError)}`
          } catch {
            errorMessage = '요청 데이터 형식이 올바르지 않습니다.'
          }
        } else if (response.status === 500) {
          errorMessage = 'ComfyUI 서버 내부 오류가 발생했습니다.'
        } else if (response.status === 503) {
          errorMessage = 'ComfyUI 서버가 일시적으로 사용할 수 없습니다.'
        }
        
        throw new Error(errorMessage)
      }

      // 응답 데이터 파싱
      const result = await response.json()
      const processingTime = Date.now() - Date.now() // 실제 처리 시간 계산은 상위에서

      // 🔥 파일 로거: ComfyUI 응답 데이터 전체 저장
      logComfyUIResponse(endpoint, result, !!result.success, processingTime, {
        generation_type: isChatImageGeneration ? 'chat_image' : (isMessageBasedGeneration ? 'message_based' : 'image_based'),
        user_id: userId.substring(0, 8) + '...',
        attempt,
        preset_id: presetId
      })
      
      console.log('ComfyUI 서버 응답 데이터 (전체):', JSON.stringify(result, null, 2));
      console.log('ComfyUI 서버 응답 데이터:', {
        success: result.success,
        hasProfileImageUrl: !!result.profile_image_url,
        hasChatImageUrl: !!result.chat_image_url,
        hasImageUrl: !!result.image_url, // 추가: 일반적인 image_url 확인
        hasGeneratedImageUrl: !!result.generated_image_url, // 추가: 다른 가능한 필드명
        hasError: !!result.error,
        jobId: result.generation_job_id,
        metadata: result.metadata,
        generation_type: isChatImageGeneration ? 'chat_image' : (isMessageBasedGeneration ? 'message_based' : 'image_based'),
        all_keys: Object.keys(result) // 모든 응답 키 확인
      })

      // 응답 검증 및 처리
      if (!result.success) {
        throw new Error(result.error || 'ComfyUI 서버에서 처리 실패')
      }

      // 🔍 ComfyUI 응답 상세 분석 (프로덕션 디버깅용)
      console.log('🔍 ComfyUI 응답 전체 구조 분석:', {
        response_type: typeof result,
        is_object: typeof result === 'object' && result !== null,
        all_keys: result ? Object.keys(result) : 'null/undefined',
        all_values_preview: result ? Object.fromEntries(
          Object.entries(result).map(([key, value]) => [
            key, 
            typeof value === 'string' ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : value
          ])
        ) : 'null/undefined'
      });

      // 이미지 URL 검증 (다양한 필드명 지원)
      const imageUrl = result.chat_image_url || 
                      result.profile_image_url || 
                      result.image_url || 
                      result.generated_image_url ||
                      result.url ||  // 추가: 일반적인 url 필드
                      result.image ||  // 추가: image 필드
                      result.output_url ||  // 추가: output_url 필드
                      result.result_url; // 추가: result_url 필드
      
      console.log('🔍 이미지 URL 매핑 결과:', {
        found_image_url: !!imageUrl,
        final_image_url: imageUrl ? imageUrl.substring(0, 80) + '...' : 'NOT_FOUND',
        chat_image_url: result.chat_image_url || 'undefined',
        profile_image_url: result.profile_image_url || 'undefined', 
        image_url: result.image_url || 'undefined',
        generated_image_url: result.generated_image_url || 'undefined',
        url: result.url || 'undefined',
        image: result.image || 'undefined',
        output_url: result.output_url || 'undefined',
        result_url: result.result_url || 'undefined'
      });
      
      if (!imageUrl) {
        console.warn('❌ ComfyUI 서버에서 이미지 URL을 반환하지 않음')
        console.warn('📋 전체 응답 데이터:', JSON.stringify(result, null, 2));
        
        // 대안 데이터 확인
        if (result.image_data || result.image_base64) {
          console.log('📦 Base64 이미지 데이터를 받았습니다 - 추가 처리 필요')
          // TODO: Base64 데이터를 chat-images 버킷에 업로드
        } else {
          throw new Error('생성된 이미지 URL을 받지 못했습니다. 응답에서 이미지 관련 필드를 찾을 수 없습니다.')
        }
      }
      
      // 채팅 이미지와 프로필 이미지에 따른 적절한 응답 반환
      if (isMessageBasedGeneration && imageUrl) {
        // 메시지 기반 생성 성공 - 적절한 URL 반환
        return {
          ...result,
          success: true,
          chat_image_url: imageUrl, // 통일된 필드명으로 반환
          processing_time: processingTime
        }
      } else if (isChatImageGeneration && imageUrl) {
        // 채팅 이미지 생성 성공 - chat-images 버킷 URL 반환
        return {
          ...result,
          chat_image_url: imageUrl,
          processing_time: processingTime
        }
      } else if (result.profile_image_url || imageUrl) {
        // 프로필 이미지 생성 - profile-images 버킷 URL 반환
        return {
          ...result,
          profile_image_url: result.profile_image_url || imageUrl,
          processing_time: processingTime
        }
      } else {
        // 모든 응답 데이터 반환 (체크 용도)
        return {
          ...result,
          processing_time: processingTime
        }
      }

    } catch (error) {
      console.error(`ComfyUI 요청 시도 ${attempt} 실패:`, {
        error: error instanceof Error ? error.message : error,
        attempt,
        maxRetries: retries,
        generation_type: isChatImageGeneration ? 'chat_image' : (isMessageBasedGeneration ? 'message_based' : 'image_based')
      })
      
      // 재시도 가능한 오류 판단
      const isRetryable = 
        error instanceof TypeError || // 네트워크 오류
        (error instanceof Error && (
          error.message.includes('timeout') || // 타임아웃
          error.message.includes('500') ||     // 서버 내부 오류
          error.message.includes('503') ||     // 서비스 불가
          error.message.includes('fetch')      // fetch 오류
        ))
      
      if (isRetryable && attempt <= retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 지수 백오프 (최대 10초)
        console.log(`${delay}ms 후 재시도... (${attempt}/${retries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return makeRequest(attempt + 1)
      }

      // 최종 실패
      throw error
    }
  }

  // 4. 실제 요청 실행
  try {
    const result = await makeRequest()
    
    console.log('ComfyUI 요청 최종 성공:', {
      success: result.success,
      hasProfileImage: !!result.profile_image_url,
      hasChatImage: !!result.chat_image_url,
      jobId: result.generation_job_id,
      preset_id: presetId,
      generation_type: isChatImageGeneration ? 'chat_image' : (isMessageBasedGeneration ? 'message_based' : 'image_based')
    })
    
    return result

  } catch (error) {
    console.error('ComfyUI 최종 요청 실패:', error)
    
    let errorMessage = '이미지 생성에 실패했습니다.'
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = '서버 응답 시간이 초과되었습니다. ComfyUI 서버가 일시적으로 바쁜 상태일 수 있습니다.'
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      } else if (error.message.includes('500')) {
        errorMessage = 'ComfyUI 서버에 일시적인 문제가 발생했습니다.'
      } else if (error.message.includes('404')) {
        errorMessage = 'ComfyUI 서버 설정에 문제가 있습니다. 관리자에게 문의해주세요.'
      } else if (error.message.includes('422')) {
        errorMessage = '요청 데이터에 문제가 있습니다. 프롬프트와 설정을 확인해주세요.'
      } else {
        errorMessage = error.message
      }
    }

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * 이미지 URL 접근성 검증 (ComfyUI 서버에서 접근 가능한지 확인)
 */
export async function validateImageUrlAccessibility(imageUrl: string): Promise<boolean> {
  try {
    console.log('이미지 URL 접근성 확인:', imageUrl.substring(0, 50) + '...')
    
    const response = await fetch(imageUrl, {
      method: 'HEAD', // HEAD 요청으로 빠르게 확인
      headers: {
        'User-Agent': 'AI-Face-Chat-Validator/1.0'
      }
    })
    
    const isAccessible = response.ok
    
    console.log('이미지 URL 접근성 결과:', {
      url: imageUrl.substring(0, 50) + '...',
      status: response.status,
      accessible: isAccessible,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    })
    
    return isAccessible
    
  } catch (error) {
    console.error('이미지 URL 접근성 확인 실패:', error)
    return false
  }
}

/**
 * 프리셋 ID로 관계 타입 가져오기
 */
export function getRelationshipType(presetId: string): string {
  const preset = PRESET_MAPPING[presetId]
  return preset?.relationship || 'friend'
}

/**
 * 프리셋 ID로 성별 가져오기
 */
export function getGender(presetId: string): string {
  const preset = PRESET_MAPPING[presetId]
  return preset?.gender || 'female'
}

/**
 * 관계 타입 라벨링
 */
function getRelationshipLabel(relationship: string): string {
  const labels = {
    lover: '연인',
    friend: '친구', 
    some: '썸',
    family: '가족'
  }
  return labels[relationship as keyof typeof labels] || '친구'
}

/**
 * 프리셋 목록 가져오기 (UI 컴포넌트용)
 */
export function getPresetOptions() {
  return Object.entries(PRESET_MAPPING).map(([id, preset]) => ({
    id,
    label: `${preset.gender === 'female' ? '👩' : '👨'} ${getRelationshipLabel(preset.relationship)}`,
    gender: preset.gender,
    relationship: preset.relationship,
    style: preset.style,
    description: preset.prompt_context || '기본 스타일'
  }))
}

/**
 * Supabase Storage 이미지 URL을 Public URL로 변환
 */
export function convertToPublicImageUrl(supabaseUrl: string): string {
  // 이미 Public URL인 경우 그대로 반환
  if (supabaseUrl.includes('/storage/v1/object/public/')) {
    return supabaseUrl
  }
  
  // Supabase Storage URL 패턴 감지 및 변환
  const match = supabaseUrl.match(/\/storage\/v1\/object\/([^\/]+)\/(.+)/)
  if (match) {
    const bucketName = match[1]
    const filePath = match[2]
    const baseUrl = supabaseUrl.split('/storage/')[0]
    return `${baseUrl}/storage/v1/object/public/${bucketName}/${filePath}`
  }
  
  // 변환할 수 없으면 원본 URL 반환
  return supabaseUrl
}

/**
 * ComfyUI 서버 헬스 체크 (수정된 버전)
 */
export async function checkComfyUIServerHealth(): Promise<{
  status: 'online' | 'offline' | 'error'
  version?: string
  responseTime?: number
  error?: string
}> {
  const comfyuiServerUrl = process.env.COMFYUI_SERVER_URL
  
  if (!comfyuiServerUrl) {
    return {
      status: 'error',
      error: 'ComfyUI 서버 URL이 설정되지 않았습니다.'
    }
  }

  try {
    const startTime = Date.now()
    
    // AbortController 사용하여 타임아웃 처리
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
    
    const response = await fetch(`${comfyuiServerUrl}/health`, {
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AI-Face-Chat-HealthCheck/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    console.log('ComfyUI 헬스체크 응답:', {
      status: response.status,
      statusText: response.statusText,
      responseTime: responseTime + 'ms'
    })
    
    if (response.ok) {
      try {
        const data = await response.json()
        console.log('ComfyUI 서버 정보:', data)
        return {
          status: 'online',
          version: data.version || 'unknown',
          responseTime
        }
      } catch (parseError) {
        console.warn('JSON 파싱 실패, 서버는 온라인 상태:', parseError)
        return {
          status: 'online',
          version: 'unknown',
          responseTime
        }
      }
    } else {
      return {
        status: 'error',
        error: `서버 응답 오류: ${response.status} ${response.statusText}`,
        responseTime
      }
    }
    
  } catch (error) {
    console.error('ComfyUI 헬스체크 실패:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Health check timeout (10s)'
      } else {
        errorMessage = error.message
      }
    }
    
    return {
      status: 'offline',
      error: errorMessage
    }
  }
}
