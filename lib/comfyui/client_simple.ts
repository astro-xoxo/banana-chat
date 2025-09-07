// ComfyUI 서버 연동 클라이언트 (단순화 버전)
import { optimizeImageUrlForComfyUI } from '@/lib/utils/imageHelpers'
import { buildComfyUIUrl, normalizeUrl, getUrlEnvironmentInfo, COMFYUI_ENDPOINTS } from '@/lib/utils/urlHelpers'

export interface ComfyUIRequest {
  user_image_url: string    // 사용자 이미지 URL
  preset_id: string         // "1" ~ "8"
  user_id: string          // 사용자 ID
  chatbot_name?: string     // 캐릭터 이름
}

export interface ComfyUIResponse {
  success: boolean
  profile_image_url?: string
  generation_job_id?: string
  processing_time?: number
  style_info?: {
    preset_used: string
    gender: 'female' | 'male'
    relationship: 'lover' | 'friend' | 'some' | 'family'
  }
  error?: string
  error_code?: string
}

// 프리셋 매핑 인터페이스
export interface PresetMapping {
  gender: 'female' | 'male'
  relationship: 'lover' | 'friend' | 'some' | 'family'
  style: string
}

// ComfyUI 프리셋 매핑 테이블 (기준 문서에 맞춰 수정)
export const PRESET_MAPPING: Record<string, PresetMapping> = {
  '1': { gender: 'female', relationship: 'lover', style: 'romantic' },
  '2': { gender: 'female', relationship: 'friend', style: 'friendly' },
  '3': { gender: 'female', relationship: 'some', style: 'mysterious' },
  '4': { gender: 'female', relationship: 'family', style: 'gentle' },
  '5': { gender: 'male', relationship: 'lover', style: 'romantic' },
  '6': { gender: 'male', relationship: 'friend', style: 'friendly' },
  '7': { gender: 'male', relationship: 'some', style: 'charming' },
  '8': { gender: 'male', relationship: 'family', style: 'gentle' }
}

// 프리셋 매핑 로직: gender + relationshipType → ComfyUI preset_id (단순화)
export function getSimplePresetId(gender: 'male' | 'female', relationshipType: string): string {
  console.log('단순화된 프리셋 매핑 시작:', { gender, relationshipType })

  // 입력값이 없으면 기본값 반환
  if (!gender || !relationshipType) {
    console.warn('gender 또는 relationshipType 누락, 기본값 사용')
    return '1' // 기본: 여성 연인
  }

  // 성별×관계 직접 매핑 (단순화된 조합)
  const mapping: Record<string, string> = {
    'female-lover': '1',   // 여성 + 연인
    'female-friend': '2',  // 여성 + 친구
    'female-some': '3',    // 여성 + 썸
    'female-family': '4',  // 여성 + 가족
    'male-lover': '5',     // 남성 + 연인
    'male-friend': '6',    // 남성 + 친구
    'male-some': '7',      // 남성 + 썸
    'male-family': '8'     // 남성 + 가족
  }

  const mappingKey = `${gender}-${relationshipType}`
  const presetId = mapping[mappingKey] || '1' // 기본값: 여성 연인

  console.log('단순화된 매핑 결과:', {
    mappingKey,
    presetId,
    description: PRESET_MAPPING[presetId] || 'unknown'
  })

  return presetId
}

// 레거시 지원을 위한 기존 함수 (deprecated)
export function getSimplePresetIdLegacy(conceptId?: string, speechPresetId?: string): string {
  console.log('레거시 프리셋 매핑 (deprecated):', { conceptId, speechPresetId })
  console.warn('⚠️ getSimplePresetIdLegacy는 deprecated입니다. getSimplePresetId(gender, relationshipType)를 사용하세요.')

  // 입력값이 없으면 기본값 반환
  if (!conceptId || !speechPresetId) {
    console.warn('concept_id 또는 speech_preset_id 누락, 기본값 사용')
    return '1' // 기본: 여성 연인
  }

  // relationship_type 매핑 (하드코딩된 매핑 - DB 조회 없이)
  const relationshipMapping: Record<string, string> = {
    // Some (썸) 관련 concept_id들
    'a036e2cb-99b1-4e8a-91c7-0d38b73091c8': 'some', // 썸 시작
    '03954e7d-80db-4e58-b9e5-a6b86e0f0f85': 'some', // 밀당 중  
    'e35ce2fc-7740-418a-88f8-4f0adc2c09e3': 'some', // 데이트 같은 만남
    '714ed105-edf8-4952-bc5f-ddf509ad77e3': 'some', // 고백 직전
    '74469e6e-21d9-4983-ba4d-952b45a13d4f': 'some', // 일상 데이트 (테스트 데이터)
    
    // Lover (연인) 관련 concept_id들
    'f48739df-4fc8-4670-9e23-4746bec4e80c': 'lover', // 첫 데이트
    
    // Friend (친구) 관련 - 추정값들
    'friend-concept-1': 'friend',
    'friend-concept-2': 'friend',
    
    // Family (가족) 관련 - 추정값들  
    'family-concept-1': 'family',
    'family-concept-2': 'family'
  }

  // 성별 매핑 (speech_preset_id에서 추정)
  const genderMapping: Record<string, string> = {
    // Female 관련 speech_preset_id들 (추정)
    'bb634914-7b4e-4968-99b3-7ce421205311': 'female', // 편안한 애인 말투 (테스트 데이터)
    '9808b89c-80de-480d-975e-5f1a021094de': 'female', // 따뜻한 돌봄 말투
    '1e54befd-9257-499b-b2ce-9865dbb8e64d': 'female', // 정겨운 어머니 말투  
    '43c46539-a712-4153-af67-91a5502816fb': 'female', // 서운한 가족 말투
    
    // Male 관련 speech_preset_id들 (추정)
    '3de2890d-c372-4789-b400-f2d6eddbf788': 'male', // 정중한 전통 말투
    '8b20c64b-c8a3-4d15-af78-5feba9d72107': 'male', // 신나는 모험 말투
    'male-speech-preset-1': 'male',
    'male-speech-preset-2': 'male'
  }

  // 관계 타입 결정
  const relationshipType = relationshipMapping[conceptId] || 'some' // 기본값: some
  
  // 성별 결정
  const gender = genderMapping[speechPresetId] || 'female' // 기본값: female

  console.log('레거시 매핑 결과:', { 
    conceptId: conceptId.substring(0, 8) + '...',
    speechPresetId: speechPresetId.substring(0, 8) + '...',
    relationshipType, 
    gender 
  })

  // 새로운 단순화된 매핑 함수 호출
  return getSimplePresetId(gender as 'male' | 'female', relationshipType)
}

/**
 * ngrok 서버 워밍업 함수 (URL 정규화 적용)
 */
export async function warmupNgrokServer(): Promise<{
  success: boolean
  message: string
  responseTime?: number
}> {
  try {
    const startTime = Date.now()
    const healthUrl = buildComfyUIUrl(COMFYUI_ENDPOINTS.HEALTH)
    console.log('워밍업 요청 URL:', healthUrl)
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'AI-Face-Chat-Bot/2.0 (Warmup-Request)',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    })
    
    const responseTime = Date.now() - startTime
    
    if (response.ok) {
      return {
        success: true,
        message: `서버 워밍업 성공 (${response.status})`,
        responseTime
      }
    } else {
      return {
        success: false,
        message: `서버 응답 실패 (${response.status}: ${response.statusText})`,
        responseTime
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `워밍업 요청 실패: ${error instanceof Error ? error.message : error}`
    }
  }
}

/**
 * ComfyUI 서버 호출 (단순화된 버전)
 */
export async function callComfyUIServer(
  userImageUrl: string,
  presetId: string,         // 직접 전달할 프리셋 ID ("1" ~ "8")
  userId: string,
  options: {
    timeout?: number
    retries?: number
    chatbotName?: string
  } = {}
): Promise<ComfyUIResponse> {
  const {
    timeout = 300000,        // 5분 타임아웃 (ComfyUI 이미지 생성 시간 고려)
    retries = 2,             // 재시도 횟수 줄임 (타임아웃이 길어서)
    chatbotName = 'AI 캐릭터'
  } = options

  const comfyuiServerUrl = process.env.COMFYUI_SERVER_URL
  
  if (!comfyuiServerUrl) {
    return {
      success: false,
      error: 'ComfyUI 서버 설정이 누락되었습니다. 환경변수를 확인해주세요.'
    }
  }

  console.log('🚀 ComfyUI 서버 요청 시작 (즉시 워밍업 방식) [v6]:', {
    server_url: comfyuiServerUrl,
    preset_id: presetId,
    user_id: userId.substring(0, 8) + '...',
    timeout: timeout + 'ms',
    retries,
    chatbot_name: chatbotName,
    url_environment: getUrlEnvironmentInfo()
  })

  // 🔥 즉시 워밍업 실행 (헬스체크 우회)
  console.log('🔥 ComfyUI 요청 직전 즉시 워밍업 실행...')
  try {
    const warmupResult = await warmupNgrokServer()
    if (warmupResult.success) {
      console.log(`✅ 즉시 워밍업 성공: ${warmupResult.message} (${warmupResult.responseTime}ms)`)
    } else {
      console.warn(`⚠️ 즉시 워밍업 실패: ${warmupResult.message} - 계속 진행`)
    }
  } catch (warmupError) {
    console.warn('⚠️ 워밍업 중 예외 발생:', warmupError instanceof Error ? warmupError.message : warmupError)
  }


  // 프리셋 ID 유효성 검증
  if (!['1', '2', '3', '4', '5', '6', '7', '8'].includes(presetId)) {
    console.warn(`유효하지 않은 프리셋 ID: ${presetId}, 기본값 사용`)
    presetId = '1' // 기본값
  }

  // 이미지 URL 최적화 (공개 접근 가능한 형태로 변환)
  const optimizedImageUrl = optimizeImageUrlForComfyUI(userImageUrl)
  
  // ComfyUI 서버 요청 페이로드 생성
  const requestPayload: ComfyUIRequest = {
    user_image_url: optimizedImageUrl,
    preset_id: presetId,
    user_id: userId,
    chatbot_name: chatbotName
  }

  console.log('ComfyUI 요청 페이로드:', {
    original_image_url: userImageUrl.substring(0, 50) + '...',
    optimized_image_url: optimizedImageUrl.substring(0, 50) + '...',
    preset_id: presetId,
    user_id: userId.substring(0, 8) + '...',
    chatbot_name: chatbotName
  })

  // 재시도 로직이 포함된 요청 함수
  const makeRequest = async (attempt: number = 1): Promise<ComfyUIResponse> => {
    try {
      console.log(`ComfyUI 요청 시도 ${attempt}/${retries + 1}`)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // ComfyUI 서버 요청 (URL 정규화로 이중 슬래시 문제 해결)
      const apiUrl = buildComfyUIUrl(COMFYUI_ENDPOINTS.GENERATE_PROFILE)
      console.log('정규화된 API URL:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Face-Chat-Bot/2.0 (Custom-API-Client)', // 터미널 테스트 성공 헤더
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
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
      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('ComfyUI 서버 응답 JSON 파싱 실패:', parseError)
        throw new Error(`서버 응답 형식 오류: ${response.status} ${response.statusText}`)
      }
      const processingTime = Date.now()
      
      console.log('ComfyUI 서버 응답 데이터:', {
        success: result.success,
        hasProfileImageUrl: !!result.profile_image_url,
        hasStyleInfo: !!result.style_info,
        hasError: !!result.error,
        jobId: result.generation_job_id,
        styleInfo: result.style_info
      })

      // 응답 검증 및 처리
      if (!result.success) {
        // Phase 3-2: ComfyUI 응답 에러 분석 개선 (Phase 2 기반)
        console.error('🔥 ComfyUI 상세 오류 분석 - 완전한 진단:', {
          // 기본 에러 정보
          error: result.error,
          error_code: result.error_code,
          
          // Phase 2에서 추가된 응답 구조 정보
          style_info: result.style_info,
          generation_job_id: result.generation_job_id,
          processing_time: result.processing_time,
          
          // 요청 컨텍스트
          request_context: {
            preset_id: presetId,
            user_id: userId.substring(0, 8) + '...',
            user_image_url: userImageUrl.substring(0, 50) + '...',
            optimized_image_url: optimizedImageUrl.substring(0, 50) + '...',
            chatbot_name: chatbotName,
            attempt_number: attempt
          },
          
          // 서버 응답 분석
          server_response_analysis: {
            response_status: response.status,
            response_status_text: response.statusText,
            response_headers: Object.fromEntries(response.headers.entries()),
            response_size: JSON.stringify(result).length,
            has_profile_image_url: !!result.profile_image_url,
            has_style_info: !!result.style_info,
            has_error_code: !!result.error_code
          },
          
          // 에러 패턴 분석
          error_patterns: {
            is_image_download_error: result.error_code === 'IMAGE_DOWNLOAD_FAILED',
            is_generation_failed: result.error_code === 'GENERATION_FAILED',
            is_invalid_preset: result.error_code === 'INVALID_PRESET',
            is_server_overload: result.error_code === 'SERVER_OVERLOAD',
            is_quota_exceeded: result.error_code === 'QUOTA_EXCEEDED',
            is_invalid_input: result.error_code === 'INVALID_INPUT',
            has_custom_error_code: !!result.error_code && !['IMAGE_DOWNLOAD_FAILED', 'GENERATION_FAILED', 'INVALID_PRESET'].includes(result.error_code)
          },
          
          // 디버깅 정보
          debug_info: {
            timestamp: new Date().toISOString(),
            server_url: comfyuiServerUrl,
            request_payload_size: JSON.stringify(requestPayload).length,
            timeout_setting: timeout,
            retries_remaining: retries - attempt + 1
          }
        })
        
        let detailedError = result.error || 'ComfyUI 서버에서 처리 실패'
        
        // Phase 3-2: 특정 에러 코드 처리 확장
        if (result.error_code) {
          console.log('ComfyUI 서버 에러 코드 처리:', result.error_code)
          
          switch (result.error_code) {
            case 'IMAGE_DOWNLOAD_FAILED':
              detailedError = '업로드된 이미지에 접근할 수 없습니다. 이미지 URL을 확인해주세요.'
              break
            case 'GENERATION_FAILED':
              detailedError = 'AI 이미지 생성에 실패했습니다. 다른 이미지를 시도해보세요.'
              break
            case 'INVALID_PRESET':
              detailedError = '잘못된 프리셋 설정입니다. 다시 시도해주세요.'
              break
            case 'SERVER_OVERLOAD':
              detailedError = 'ComfyUI 서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
              break
            case 'QUOTA_EXCEEDED':
              detailedError = '서버의 이미지 생성 한도를 초과했습니다.'
              break
            case 'INVALID_INPUT':
              detailedError = '입력된 이미지나 설정이 올바르지 않습니다. 다시 확인해주세요.'
              break
            case 'MODEL_LOADING':
              detailedError = 'AI 모델이 로딩 중입니다. 잠시 후 다시 시도해주세요.'
              break
            case 'MEMORY_ERROR':
              detailedError = '서버 메모리가 부족합니다. 잠시 후 다시 시도해주세요.'
              break
            case 'NETWORK_ERROR':
              detailedError = 'ComfyUI 서버 내부 네트워크 오류가 발생했습니다.'
              break
            default:
              detailedError = result.error || '알 수 없는 오류가 발생했습니다.'
              console.warn('처리되지 않은 ComfyUI 에러 코드:', result.error_code)
          }
        }
        
        throw new Error(detailedError)
      }

      // 이미지 URL 검증
      if (!result.profile_image_url) {
        console.warn('ComfyUI 서버에서 이미지 URL을 반환하지 않음')
        throw new Error('생성된 이미지 URL을 받지 못했습니다.')
      }
      
      // style_info가 없으면 프리셋 매핑으로 생성
      if (!result.style_info && presetId) {
        const mapping = PRESET_MAPPING[presetId]
        if (mapping) {
          result.style_info = {
            preset_used: presetId,
            gender: mapping.gender,
            relationship: mapping.relationship
          }
          console.log('style_info 자동 생성:', result.style_info)
        }
      }
      
      return {
        ...result,
        processing_time: processingTime
      }

    } catch (error) {
      // Phase 3-2: ComfyUI 요청 예외 상세 로깅 개선
      console.error(`🚨 ComfyUI 요청 시도 ${attempt} 실패 - 상세 분석:`, {
        // 기본 에러 정보
        error: error instanceof Error ? error.message : error,
        error_name: error instanceof Error ? error.name : 'Unknown',
        error_stack: error instanceof Error ? error.stack?.substring(0, 500) + '...' : undefined,
        
        // 요청 컨텍스트
        request_context: {
          attempt: attempt,
          max_retries: retries,
          preset_id: presetId,
          user_id: userId.substring(0, 8) + '...',
          user_image_url: userImageUrl.substring(0, 50) + '...',
          optimized_image_url: optimizedImageUrl.substring(0, 50) + '...',
          chatbot_name: chatbotName,
          timeout: timeout
        },
        
        // 서버 정보
        server_info: {
          url: comfyuiServerUrl,
          endpoint: '/api/generate/profile',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'AI-Face-Chat-Client/2.0'
          }
        },
        
        // 에러 패턴 분석
        error_analysis: {
          is_network_error: error instanceof TypeError,
          is_timeout_error: error instanceof Error && error.message.includes('timeout'),
          is_abort_error: error instanceof Error && error.name === 'AbortError',
          is_fetch_error: error instanceof Error && error.message.includes('fetch'),
          is_server_error: error instanceof Error && (
            error.message.includes('500') || 
            error.message.includes('503') || 
            error.message.includes('502')
          ),
          is_client_error: error instanceof Error && (
            error.message.includes('400') || 
            error.message.includes('404') || 
            error.message.includes('422')
          ),
          is_ssl_error: error instanceof Error && error.message.includes('SSL'),
          is_dns_error: error instanceof Error && error.message.includes('ENOTFOUND')
        },
        
        // 재시도 분석
        retry_analysis: {
          is_retryable: error instanceof TypeError || (error instanceof Error && (
            error.message.includes('timeout') ||
            error.message.includes('500') ||
            error.message.includes('503') ||
            error.message.includes('fetch')
          )),
          attempts_remaining: retries - attempt + 1,
          will_retry: attempt <= retries,
          next_delay: attempt <= retries ? Math.min(1000 * Math.pow(2, attempt - 1), 10000) : 0
        },
        
        // 시스템 상태
        system_state: {
          timestamp: new Date().toISOString(),
          memory_usage: process.memoryUsage ? {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          } : 'unavailable'
        }
      })
      
      // 재시도 가능한 오류 판단 (400/503 에러 추가)
      const isRetryable = 
        error instanceof TypeError || // 네트워크 오류
        (error instanceof Error && (
          error.message.includes('timeout') || // 타임아웃
          error.message.includes('500') ||     // 서버 내부 오류
          error.message.includes('503') ||     // 서비스 불가
          error.message.includes('400') ||     // 400 Bad Request (ngrok 관련)
          error.message.includes('fetch')      // fetch 오류
        ))
      
      if (isRetryable && attempt <= retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // 지수 백오프 (최대 10초)
        console.log(`🔄 재시도 ${attempt}/${retries} - ${delay}ms 후 재시도... (${error instanceof Error ? error.message : error})`)
        
        // 재시도 전 추가 워밍업 (400/503 에러의 경우)
        if (error instanceof Error && (error.message.includes('400') || error.message.includes('503'))) {
          console.log('🔥 400/503 에러로 인한 긴급 워밍업 시도...')
          try {
            const emergencyWarmup = await warmupNgrokServer()
            if (emergencyWarmup.success) {
              console.log(`✅ 긴급 워밍업 성공: ${emergencyWarmup.message}`)
            } else {
              console.warn(`⚠️ 긴급 워밍업 실패: ${emergencyWarmup.message}`)
            }
          } catch (warmupError) {
            console.warn('⚠️ 긴급 워밍업 중 예외:', warmupError)
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return makeRequest(attempt + 1)
      }

      // 최종 실패
      throw error
    }
  }

  // 실제 요청 실행
  try {
    const result = await makeRequest()
    
    console.log('ComfyUI 요청 최종 성공:', {
      success: result.success,
      hasProfileImage: !!result.profile_image_url,
      jobId: result.generation_job_id
    })
    
    return result

  } catch (error) {
    // Phase 3-2: ComfyUI 최종 요청 실패 상세 로깅 개선
    console.error('🚨 ComfyUI 최종 요청 실패 - 완전한 분석:', {
      // 기본 에러 정보
      error: error instanceof Error ? error.message : error,
      error_name: error instanceof Error ? error.name : 'Unknown',
      error_stack: error instanceof Error ? error.stack?.substring(0, 500) + '...' : undefined,
      
      // 요청 전체 컨텍스트
      request_summary: {
        user_id: userId.substring(0, 8) + '...',
        preset_id: presetId,
        user_image_url: userImageUrl.substring(0, 50) + '...',
        optimized_image_url: optimizedImageUrl.substring(0, 50) + '...',
        chatbot_name: chatbotName,
        timeout: timeout,
        retries: retries
      },
      
      // 서버 설정 정보
      server_config: {
        url: comfyuiServerUrl,
        endpoint: '/api/generate/profile',
        health_endpoint: '/health'
      },
      
      // 실패 패턴 종합 분석
      failure_analysis: {
        is_timeout: error instanceof Error && error.message.includes('timeout'),
        is_network_failure: error instanceof Error && (
          error.message.includes('Failed to fetch') || 
          error.message.includes('network') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ENOTFOUND')
        ),
        is_server_error: error instanceof Error && (
          error.message.includes('500') || 
          error.message.includes('503') || 
          error.message.includes('502')
        ),
        is_client_error: error instanceof Error && (
          error.message.includes('400') || 
          error.message.includes('404') || 
          error.message.includes('422')
        ),
        is_ssl_error: error instanceof Error && error.message.includes('SSL'),
        is_custom_comfyui_error: error instanceof Error && (
          error.message.includes('업로드된 이미지') ||
          error.message.includes('AI 이미지 생성') ||
          error.message.includes('프리셋')
        )
      },
      
      // 디버깅 정보
      debug_info: {
        timestamp: new Date().toISOString(),
        total_processing_time: Date.now(),
        memory_usage: process.memoryUsage ? {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
        } : 'unavailable'
      },
      
      // 복구 제안
      recovery_suggestions: {
        user_actions: [
          error instanceof Error && error.message.includes('timeout') ? '잠시 후 다시 시도' : null,
          error instanceof Error && error.message.includes('network') ? '네트워크 연결 확인' : null,
          error instanceof Error && error.message.includes('이미지') ? '다른 이미지로 시도' : null,
          error instanceof Error && error.message.includes('프리셋') ? '프리셋 설정 확인' : null
        ].filter(Boolean),
        admin_actions: [
          error instanceof Error && error.message.includes('500') ? 'ComfyUI 서버 상태 확인' : null,
          error instanceof Error && error.message.includes('404') ? 'API 엔드포인트 설정 확인' : null,
          error instanceof Error && error.message.includes('SSL') ? 'SSL 인증서 확인' : null
        ].filter(Boolean)
      }
    })
    
    let errorMessage = '이미지 생성에 실패했습니다.'
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = '서버 응답 시간이 초과되었습니다. ComfyUI 서버가 일시적으로 바쁜 상태일 수 있습니다.'
      } else if (error.message.includes('Failed to fetch') || error.message.includes('network')) {
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ComfyUI 서버가 연결을 거부했습니다. 서버가 실행 중인지 확인해주세요.'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'ComfyUI 서버 주소를 찾을 수 없습니다. 서버 URL을 확인해주세요.'
      } else if (error.message.includes('500')) {
        errorMessage = 'ComfyUI 서버에 일시적인 문제가 발생했습니다.'
      } else if (error.message.includes('404')) {
        errorMessage = 'ComfyUI 서버 설정에 문제가 있습니다. 관리자에게 문의해주세요.'
      } else if (error.message.includes('422')) {
        errorMessage = '요청 데이터에 문제가 있습니다. 이미지와 설정을 확인해주세요.'
      } else if (error.message.includes('SSL')) {
        errorMessage = 'SSL 연결에 문제가 있습니다. 관리자에게 문의해주세요.'
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
 * 브라우저 자동화를 통한 ngrok 경고 페이지 우회
 * 서버 측에서 실행되므로 실제로는 fetch로 시뮬레이션
 */
export async function bypassNgrokViaSimulation(): Promise<{
  success: boolean
  message: string
}> {
  const comfyuiServerUrl = process.env.COMFYUI_SERVER_URL
  
  if (!comfyuiServerUrl) {
    return {
      success: false,
      message: 'ComfyUI 서버 URL이 설정되지 않았습니다.'
    }
  }

  try {
    console.log('🌐 브라우저 시뮬레이션을 통한 ngrok 우회 시도...')
    
    // 1단계: 일반 브라우저처럼 첫 요청
    const firstResponse = await fetch(comfyuiServerUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      }
    })
    
    const firstResponseText = await firstResponse.text()
    
    // 2단계: ngrok 경고 페이지인지 확인
    if (firstResponseText.includes('Visit Site') || firstResponseText.includes('ngrok')) {
      console.log('🔍 ngrok 경고 페이지 감지됨 - 자동 우회 진행')
      
      // 3단계: "Visit Site" 클릭을 시뮬레이션 (실제 목적지 URL로 이동)
      const secondResponse = await fetch(comfyuiServerUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Referer': comfyuiServerUrl,
          'ngrok-skip-browser-warning': 'true' // 이제 추가
        }
      })
      
      const secondResponseText = await secondResponse.text()
      
      // 4단계: 여전히 경고 페이지인지 확인
      if (!secondResponseText.includes('Visit Site') && secondResponse.ok) {
        console.log('✅ 브라우저 시뮬레이션 우회 성공')
        
        // 5단계: API 엔드포인트 테스트
        const apiResponse = await fetch(`${comfyuiServerUrl}/health`, {
          method: 'GET',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'AI-Face-Chat-Bot/2.0 (Post-Browser-Visit)',
            'Accept': 'application/json'
          }
        })
        
        if (apiResponse.ok) {
          return {
            success: true,
            message: '브라우저 시뮬레이션 우회 완료 - API 접근 가능'
          }
        } else {
          return {
            success: false,
            message: '브라우저 우회 성공했으나 API 접근 실패'
          }
        }
      } else {
        return {
          success: false,
          message: '브라우저 시뮬레이션 우회 실패'
        }
      }
    } else {
      console.log('✅ ngrok 경고 페이지 없음 - 정상 접근 가능')
      return {
        success: true,
        message: 'ngrok 경고 페이지 없음 - 바로 접근 가능'
      }
    }
    
  } catch (error) {
    console.error('🚨 브라우저 시뮬레이션 우회 중 오류:', error)
    return {
      success: false,
      message: `브라우저 시뮬레이션 오류: ${error instanceof Error ? error.message : 'Unknown'}`
    }
  }
}



/**
 * ComfyUI 서버 헬스 체크
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
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10초 타임아웃
    
    const response = await fetch(`${comfyuiServerUrl}/health`, {
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AI-Face-Chat-HealthCheck/2.0 (Custom-API-Client)',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
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
