// ComfyUI 프롬프트 기반 요청 타입 정의

export interface ComfyUIProfileRequest {
  positive_prompt: string
  negative_prompt: string
  user_image_url: string
  user_id: string
  name: string
  user_context?: {
    age: number
    gender: string
    relationship: string
    concept: string
  }
}

export interface ComfyUIProfileResponse {
  success: boolean
  profile_image_url?: string
  generation_job_id?: string
  error?: string
  processing_time?: number
  metadata?: {
    generation_job_id?: string
    character_type?: string
    server_version?: string
  }
}

// 레거시 호환성을 위한 기존 요청 타입 (유지)
export interface ComfyUILegacyRequest {
  user_image_url?: string
  preset_id: string
  user_id: string
  environment?: string
  chatbot_name?: string
  custom_prompt?: string
  negative_prompt?: string
  metadata?: any
}

// 통합 ComfyUI 요청 타입
export type ComfyUIRequest = ComfyUIProfileRequest | ComfyUILegacyRequest

// 타입 가드 함수
export function isProfileRequest(request: ComfyUIRequest): request is ComfyUIProfileRequest {
  return 'positive_prompt' in request && 'user_context' in request
}

export function isLegacyRequest(request: ComfyUIRequest): request is ComfyUILegacyRequest {
  return 'preset_id' in request && !('positive_prompt' in request)
}