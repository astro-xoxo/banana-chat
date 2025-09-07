// Mock 이미지 생성 서비스
// Phase 1에서 ComfyUI 대신 사용할 임시 서비스

import { MOCK_PROFILE_IMAGES, PRESET_ID_TO_IMAGE_KEY } from '../mockData'

// 이미지 생성 서비스 인터페이스
export interface ImageGenerationService {
  generateProfile(params: GenerateProfileParams): Promise<ProfileResult>
  healthCheck(): Promise<boolean>
}

// 프로필 생성 요청 파라미터
export interface GenerateProfileParams {
  user_image_url?: string
  preset_id: string
  chatbot_name?: string
  user_id?: string
}

// 프로필 생성 결과 (설계 문서 기준 응답 구조)
export interface ProfileResult {
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
  is_mock?: boolean
}

// Mock 이미지 생성 서비스 구현
export class MockImageService implements ImageGenerationService {
  private readonly mockDelay: number = 2000 // 2초 대기 (실제 API 호출 시뮬레이션)
  
  async generateProfile(params: GenerateProfileParams): Promise<ProfileResult> {
    console.log('🚧 Mock 이미지 서비스 시작:', params)
    
    try {
      // 실제 API 호출 시뮬레이션 (로딩 시간)
      const startTime = Date.now()
      await new Promise(resolve => setTimeout(resolve, this.mockDelay))
      const endTime = Date.now()
      
      // 프리셋 ID에 따른 이미지 선택
      const imageKey = PRESET_ID_TO_IMAGE_KEY[params.preset_id]
      const mockImage = MOCK_PROFILE_IMAGES[imageKey]
      
      if (!mockImage) {
        throw new Error(`프리셋 ${params.preset_id}에 해당하는 Mock 이미지를 찾을 수 없습니다`)
      }
      
      // 실제 API 응답과 동일한 구조 (설계 문서 기준)
      const result: ProfileResult = {
        success: true,
        profile_image_url: mockImage.url,
        generation_job_id: `mock_${Date.now()}_${params.preset_id}`,
        processing_time: endTime - startTime,
        style_info: {
          preset_used: params.preset_id,
          gender: mockImage.gender as 'female' | 'male',
          relationship: mockImage.relationshipType as 'lover' | 'friend' | 'some' | 'family'
        },
        is_mock: true
      }
      
      console.log('✅ Mock 이미지 생성 완료:', result)
      return result
      
    } catch (error) {
      // Phase 3-3: Mock 이미지 생성 실패 상세 로깅 개선
      console.error('🚨 Mock 이미지 생성 실패 - 상세 분석:', {
        // 기본 에러 정보
        error: error instanceof Error ? error.message : error,
        error_name: error instanceof Error ? error.name : 'Unknown',
        error_stack: error instanceof Error ? error.stack?.substring(0, 500) + '...' : undefined,
        
        // 요청 컨텍스트
        request_context: {
          preset_id: params.preset_id,
          chatbot_name: params.chatbot_name,
          user_id: params.user_id?.substring(0, 8) + '...' || 'anonymous',
          has_user_image_url: !!params.user_image_url,
          user_image_url_preview: params.user_image_url?.substring(0, 50) + '...' || 'none'
        },
        
        // Mock 서비스 상태
        mock_service_state: {
          mock_delay: this.mockDelay,
          available_presets: Object.keys(PRESET_ID_TO_IMAGE_KEY),
          available_images: Object.keys(MOCK_PROFILE_IMAGES),
          requested_preset_exists: !!PRESET_ID_TO_IMAGE_KEY[params.preset_id],
          image_key: PRESET_ID_TO_IMAGE_KEY[params.preset_id] || 'not_found',
          mock_image_exists: !!(PRESET_ID_TO_IMAGE_KEY[params.preset_id] && MOCK_PROFILE_IMAGES[PRESET_ID_TO_IMAGE_KEY[params.preset_id]])
        },
        
        // 에러 패턴 분석
        error_analysis: {
          is_preset_not_found: !PRESET_ID_TO_IMAGE_KEY[params.preset_id],
          is_image_not_found: PRESET_ID_TO_IMAGE_KEY[params.preset_id] && !MOCK_PROFILE_IMAGES[PRESET_ID_TO_IMAGE_KEY[params.preset_id]],
          is_data_structure_error: error instanceof Error && error.message.includes('property'),
          is_timeout_simulation_error: error instanceof Error && error.message.includes('timeout'),
          is_memory_error: error instanceof Error && error.message.includes('memory')
        },
        
        // 디버깅 정보
        debug_info: {
          timestamp: new Date().toISOString(),
          mock_mode: true,
          service_type: 'MockImageService',
          memory_usage: process.memoryUsage ? {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          } : 'unavailable'
        },
        
        // 복구 정보
        recovery_info: {
          fallback_preset: '1', // 기본 프리셋
          available_alternatives: Object.keys(PRESET_ID_TO_IMAGE_KEY).slice(0, 3),
          can_use_fallback: !!MOCK_PROFILE_IMAGES[PRESET_ID_TO_IMAGE_KEY['1']]
        }
      })
      
      let errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
      
      // Phase 3-3: Mock 서비스 특화 에러 메시지 개선
      if (!PRESET_ID_TO_IMAGE_KEY[params.preset_id]) {
        errorMessage = `프리셋 ${params.preset_id}에 해당하는 Mock 이미지를 찾을 수 없습니다. 사용 가능한 프리셋: ${Object.keys(PRESET_ID_TO_IMAGE_KEY).join(', ')}`
      } else if (PRESET_ID_TO_IMAGE_KEY[params.preset_id] && !MOCK_PROFILE_IMAGES[PRESET_ID_TO_IMAGE_KEY[params.preset_id]]) {
        errorMessage = `프리셋 ${params.preset_id}의 이미지 파일이 존재하지 않습니다. 관리자에게 문의하세요.`
      } else if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Mock 서비스 시뮬레이션 중 시간 초과가 발생했습니다.'
        } else if (error.message.includes('memory')) {
          errorMessage = 'Mock 서비스에서 메모리 부족 오류가 발생했습니다.'
        } else if (error.message.includes('property')) {
          errorMessage = 'Mock 이미지 데이터 구조에 문제가 있습니다.'
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        is_mock: true,
        // Phase 3-3: 에러 응답에 디버깅 정보 포함 (개발 환경에서만)
        ...(process.env.NODE_ENV === 'development' && {
          debug_context: {
            preset_id: params.preset_id,
            available_presets: Object.keys(PRESET_ID_TO_IMAGE_KEY),
            error_type: error instanceof Error ? error.name : 'Unknown'
          }
        })
      }
    }
  }
  
  // 서비스 상태 체크 (Mock 서비스는 항상 정상)
  async healthCheck(): Promise<boolean> {
    console.log('🔍 Mock 이미지 서비스 상태 체크')
    return true
  }
  
  // Mock 이미지 목록 반환
  getAvailableImages() {
    return Object.entries(MOCK_PROFILE_IMAGES).map(([key, config]) => ({
      key,
      ...config
    }))
  }
  
  // 특정 프리셋 ID의 이미지 정보 반환
  getImageByPresetId(presetId: string) {
    const imageKey = PRESET_ID_TO_IMAGE_KEY[presetId]
    return imageKey ? MOCK_PROFILE_IMAGES[imageKey] : null
  }
}

export default MockImageService
