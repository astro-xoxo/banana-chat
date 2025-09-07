// 이미지 생성 서비스 팩토리
// 환경 변수에 따라 Mock 또는 실제 서비스 자동 선택

import { ImageGenerationService } from './mockImageService'
import MockImageService from './mockImageService'
import ComfyUIService from './comfyUIService'

// 서비스 상태 정보
export interface ServiceStatus {
  service_type: 'mock' | 'comfyui'
  status: 'healthy' | 'unhealthy' | 'error'
  is_mock: boolean
  timestamp: string
  error?: string
  server_info?: any
}

// 이미지 생성 서비스 팩토리
export function createImageGenerationService(): ImageGenerationService {
  // 환경 변수에서 Mock 모드 확인
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  if (isMockMode) {
    console.log('🚧 Mock 모드 활성화: 임시 이미지 서비스 사용')
    return new MockImageService()
  }
  
  console.log('🚀 운영 모드 활성화: 실제 ComfyUI 서비스 사용')
  return new ComfyUIService()
}

// 서비스 상태 확인
export async function validateImageService(): Promise<ServiceStatus> {
  const service = createImageGenerationService()
  const isMock = service instanceof MockImageService
  
  try {
    const isHealthy = await service.healthCheck()
    
    const status: ServiceStatus = {
      service_type: isMock ? 'mock' : 'comfyui',
      status: isHealthy ? 'healthy' : 'unhealthy',
      is_mock: isMock,
      timestamp: new Date().toISOString()
    }
    
    // ComfyUI 서비스인 경우 서버 정보 추가
    if (!isMock && 'getServerInfo' in service) {
      status.server_info = service.getServerInfo()
    }
    
    return status
    
  } catch (error) {
    return {
      service_type: isMock ? 'mock' : 'comfyui',
      status: 'error',
      is_mock: isMock,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  }
}

// 전환 상태 확인
export function getTransitionStatus() {
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  return {
    current_mode: isMockMode ? 'mock' : 'production',
    is_mock: isMockMode,
    environment: process.env.NODE_ENV || 'development',
    comfyui_server_url: process.env.COMFYUI_SERVER_URL || 'not_configured',
    transition_ready: !isMockMode && !!process.env.COMFYUI_SERVER_URL,
    mock_version: '1.0',
    last_check: new Date().toISOString()
  }
}

// Phase 1 → Phase 2 전환 준비 상태 확인
export async function checkTransitionReadiness() {
  console.log('🔄 전환 준비 상태 확인 중...')
  
  const status = getTransitionStatus()
  const serviceStatus = await validateImageService()
  
  const readiness = {
    // 기본 설정
    environment_configured: !!process.env.COMFYUI_SERVER_URL,
    mock_mode_disabled: process.env.NEXT_PUBLIC_ENABLE_MOCK !== 'true',
    
    // 서비스 상태
    service_healthy: serviceStatus.status === 'healthy',
    service_type: serviceStatus.service_type,
    
    // 전환 가능성
    ready_for_transition: false,
    
    // 상세 정보
    details: {
      current_status: status,
      service_status: serviceStatus,
      recommendations: []
    }
  }
  
  // 전환 준비 완료 여부 계산
  readiness.ready_for_transition = 
    readiness.environment_configured && 
    readiness.service_healthy && 
    !readiness.mock_mode_disabled
  
  // 권장사항 생성
  if (!readiness.environment_configured) {
    readiness.details.recommendations.push('COMFYUI_SERVER_URL 환경 변수 설정 필요')
  }
  
  if (!readiness.service_healthy) {
    readiness.details.recommendations.push('ComfyUI 서버 상태 확인 필요')
  }
  
  if (readiness.mock_mode_disabled) {
    readiness.details.recommendations.push('Mock 모드 비활성화 전 실제 서비스 검증 필요')
  }
  
  console.log('📊 전환 준비 상태:', readiness)
  return readiness
}

// 기본 서비스 생성 (편의 함수)
export const imageService = createImageGenerationService()

export default createImageGenerationService
