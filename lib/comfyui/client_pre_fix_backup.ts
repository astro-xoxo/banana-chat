// ComfyUI 서버 연동 클라이언트 (3개 분리 버킷 구조)
export interface ComfyUIRequest {
  user_uploads_url: string  // user-uploads 버킷의 이미지 URL로 변경
  preset_id: string // '1' ~ '8'
  user_id: string // 사용자 ID 추가
  environment?: string
  chatbot_name?: string
}

export interface ComfyUIResponse {
  success: boolean
  profile_image_url?: string // profile-images 버킷의 Public URL (프로필 생성)
  chat_image_url?: string    // chat-images 버킷의 Public URL (채팅 이미지)
  generation_job_id?: string
  error?: string
  processing_time?: number
}

export interface PresetMapping {
  gender: 'male' | 'female'
  relationship: 'lover' | 'friend' | 'some' | 'family'
  style?: string
  prompt_context?: string
}

// 8가지 프리셋 매핑 (성별 × 관계)
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
  }
}

/**
 * ComfyUI 서버 호출 (Phase 2 개선: 타임아웃 조정, 재시도 로직 강화)
 */
export async function callComfyUIServer(
  userUploadsUrl: string,  // user-uploads 버킷의 이미지 URL로 변경
  presetId: string,
  userId: string,
  options: {
    timeout?: number
    retries?: number
    chatbotName?: string
  } = {}
): Promise<ComfyUIResponse> {
  const {
    timeout = 60000, // 1분 타임아웃 (실제 처리시간 몇 초 고려)
    retries = 3,     // 재시도 횟수 증가 (빠른 처리로 더 많은 재시도 가능)
    chatbotName = 'AI 캐릭터'
  } = options

  const comfyuiServerUrl = process.env.COMFYUI_SERVER_URL
  
  if (!comfyuiServerUrl) {
    return {
      success: false,
      error: 'ComfyUI 서버 설정이 누락되었습니다. 환경변수를 확인해주세요.'
    }
  }

  console.log('ComfyUI 서버 요청 시작:', {
    server_url: comfyuiServerUrl,
    preset_id: presetId,
    user_id: userId.substring(0, 8) + '...',
    timeout: timeout + 'ms',
    retries,
    chatbot_name: chatbotName
  })

  // 실제 API 요청 구조 (계획서 3-2 참고)
  const requestPayload: ComfyUIRequest = {
    user_uploads_url: userUploadsUrl,  // user-uploads 버킷 URL
    preset_id: presetId,               // "1" ~ "8"
    user_id: userId,                   // 사용자 UUID
    chatbot_name: chatbotName          // 캐릭터 이름
  }

  const makeRequest = async (attempt: number = 1): Promise<ComfyUIResponse> => {
    try {
      console.log(`ComfyUI 요청 시도 ${attempt}/${retries + 1}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(`${comfyuiServerUrl}/api/generate/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true', // ngrok 경고 우회
          'User-Agent': 'AI-Face-Chat-Client/1.0'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`ComfyUI 서버 오류: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      const processingTime = Date.now() - (performance.now() || 0)
      
      console.log('ComfyUI 서버 응답:', {
        success: result.success,
        hasProfileImageUrl: !!result.profile_image_url,
        hasChatImageUrl: !!result.chat_image_url,
        jobId: result.generation_job_id,
        processingTime
      })

      // ComfyUI 서비스 응답 처리 개선
      if (result.success) {
        // 성공 응답 처리
        if (!result.profile_image_url && !result.chat_image_url) {
          // 이미지 URL이 없는 경우 대체 처리
          console.warn('ComfyUI 서버에서 이미지 URL을 반환하지 않음. Raw 응답:', result)
          
          // Base64 데이터나 바이너리 데이터 확인
          if (result.image_data || result.image_base64) {
            // 대체 이미지 처리 로직 필요
            console.log('이미지 데이터를 받았지만 URL이 없음 - 처리 로직 추가 필요')
          } else {
            throw new Error('생성된 이미지 URL을 받지 못했습니다.')
          }
        }
        
        return result
      } else {
        // 실패 응답 처리
        throw new Error(result.error || 'ComfyUI 서버에서 처리 실패')
      }

    } catch (error) {
      console.error(`ComfyUI 요청 시도 ${attempt} 실패:`, error)
      
      // 재시도 가능한 오류인지 확인
      const isRetryable = 
        error instanceof TypeError || // 네트워크 오류
        (error instanceof Error && error.message.includes('timeout')) || // 타임아웃
        (error instanceof Error && error.message.includes('500')) // 서버 내부 오류
      
      if (isRetryable && attempt <= retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 지수 백오프 (최대 5초)
        console.log(`${delay}ms 후 재시도...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return makeRequest(attempt + 1)
      }

      // 최종 실패
      throw error
    }
  }

  try {
    return await makeRequest()
  } catch (error) {
    console.error('ComfyUI 최종 요청 실패:', error)
    
    let errorMessage = '이미지 생성에 실패했습니다.'
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      } else if (error.message.includes('500')) {
        errorMessage = 'ComfyUI 서버에 일시적인 문제가 발생했습니다.'
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
 * ComfyUI 서버 응답에서 이미지 처리 및 profile-images 버킷에 저장
 */
export async function processComfyUIResponse(
  response: any, 
  userId: string
): Promise<string> {
  console.log('ComfyUI 응답 이미지 처리 시작:', {
    hasProfileImageUrl: !!response.profile_image_url,
    hasImageData: !!response.image_data,
    hasImageBase64: !!response.image_base64,
    responseKeys: Object.keys(response)
  })
  
  // Case 1: 이미지 URL 직접 제공 (가장 일반적)
  if (response.profile_image_url) {
    console.log('이미지 URL 직접 제공:', response.profile_image_url.substring(0, 50) + '...')
    
    // ComfyUI 서버에서 제공한 URL이 이미 profile-images 버킷인 경우 그대로 사용
    if (response.profile_image_url.includes('/profile-images/')) {
      return response.profile_image_url
    }
    
    // 외부 URL인 경우 profile-images 버킷에 복사
    return await copyImageToProfileBucket(response.profile_image_url, userId)
  }
  
  // Case 2: Base64 이미지 데이터 제공
  if (response.image_data || response.image_base64) {
    const base64Data = response.image_data || response.image_base64
    console.log('Base64 이미지 데이터 처리 시작')
    return await saveBase64ToProfileBucket(base64Data, userId)
  }
  
  // Case 3: 바이너리 응답
  if (response instanceof ArrayBuffer) {
    console.log('바이너리 이미지 데이터 처리 시작')
    return await saveBinaryToProfileBucket(response, userId)
  }
  
  throw new Error('ComfyUI 서버에서 유효한 이미지를 받지 못했습니다.')
}

/**
 * 외부 URL을 profile-images 버킷에 복사
 */
export async function copyImageToProfileBucket(
  imageUrl: string, 
  userId: string
): Promise<string> {
  try {
    console.log('외부 이미지 다운로드 시작:', imageUrl.substring(0, 50) + '...')
    
    // 외부 이미지 다운로드
    const response = await fetch(imageUrl, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AI-Face-Chat-Client/1.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status}`)
    }
    
    const imageBlob = await response.blob()
    console.log('이미지 다운로드 완료:', {
      size: `${(imageBlob.size / 1024).toFixed(1)}KB`,
      type: imageBlob.type
    })
    
    return await uploadBlobToProfileBucket(imageBlob, userId)
    
  } catch (error) {
    console.error('외부 이미지 복사 실패:', error)
    throw new Error('이미지 다운로드 중 오류가 발생했습니다.')
  }
}

/**
 * Base64 데이터를 profile-images 버킷에 저장
 */
export async function saveBase64ToProfileBucket(
  base64Data: string, 
  userId: string
): Promise<string> {
  try {
    // Base64 데이터를 Blob으로 변환
    const base64String = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
    const binaryString = atob(base64String)
    const bytes = new Uint8Array(binaryString.length)
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    const imageBlob = new Blob([bytes], { type: 'image/jpeg' })
    console.log('Base64 데이터 변환 완료:', {
      originalLength: base64Data.length,
      blobSize: `${(imageBlob.size / 1024).toFixed(1)}KB`
    })
    
    return await uploadBlobToProfileBucket(imageBlob, userId)
    
  } catch (error) {
    console.error('Base64 이미지 처리 실패:', error)
    throw new Error('Base64 이미지 변환 중 오류가 발생했습니다.')
  }
}

/**
 * 바이너리 데이터를 profile-images 버킷에 저장
 */
export async function saveBinaryToProfileBucket(
  binaryData: ArrayBuffer, 
  userId: string
): Promise<string> {
  try {
    const imageBlob = new Blob([binaryData], { type: 'image/jpeg' })
    console.log('바이너리 데이터 변환 완료:', {
      originalSize: binaryData.byteLength,
      blobSize: `${(imageBlob.size / 1024).toFixed(1)}KB`
    })
    
    return await uploadBlobToProfileBucket(imageBlob, userId)
    
  } catch (error) {
    console.error('바이너리 이미지 처리 실패:', error)
    throw new Error('바이너리 이미지 변환 중 오류가 발생했습니다.')
  }
}

/**
 * Blob을 profile-images 버킷에 업로드
 */
async function uploadBlobToProfileBucket(
  imageBlob: Blob, 
  userId: string
): Promise<string> {
  const { createSupabaseServiceClient } = await import('@/lib/supabase-server')
  const supabase = createSupabaseServiceClient()
  
  // profile-images 버킷에 저장
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 10)
  const fileName = `profile_${timestamp}_${randomId}.jpg`
  const filePath = `${userId}/${fileName}`
  
  console.log('profile-images 버킷 업로드 시작:', {
    filePath,
    fileSize: `${(imageBlob.size / 1024).toFixed(1)}KB`,
    fileType: imageBlob.type
  })
  
  const { data, error } = await supabase.storage
    .from('profile-images')
    .upload(filePath, imageBlob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    })
    
  if (error) {
    console.error('profile-images 버킷 업로드 실패:', error)
    throw new Error('프로필 이미지 저장에 실패했습니다.')
  }
  
  // Public URL 반환
  const { data: { publicUrl } } = supabase.storage
    .from('profile-images')
    .getPublicUrl(filePath)
    
  console.log('profile-images 버킷 업로드 완료:', {
    filePath: data.path,
    publicUrl: publicUrl.substring(0, 50) + '...'
  })
    
  return publicUrl
}
