import { NextRequest, NextResponse } from 'next/server'
import { checkTransitionReadiness, getTransitionStatus } from '@/lib/services/imageGenerationFactory'

export async function GET(request: NextRequest) {
  console.log('=== ComfyUI 전환 준비 상태 확인 ===')
  
  try {
    // 현재 전환 상태 확인
    const transitionStatus = getTransitionStatus()
    
    // 전환 준비 완료 여부 확인
    const readinessCheck = await checkTransitionReadiness()
    
    const result = {
      timestamp: new Date().toISOString(),
      title: 'ComfyUI 전환 준비 상태 확인',
      current_state: {
        mode: transitionStatus.current_mode,
        is_mock: transitionStatus.is_mock,
        environment: transitionStatus.environment,
        comfyui_server_configured: transitionStatus.comfyui_server_url !== 'not_configured',
        comfyui_server_url: transitionStatus.comfyui_server_url
      },
      transition_readiness: {
        environment_configured: readinessCheck.environment_configured,
        mock_mode_disabled: readinessCheck.mock_mode_disabled,
        service_healthy: readinessCheck.service_healthy,
        service_type: readinessCheck.service_type,
        ready_for_transition: readinessCheck.ready_for_transition
      },
      service_details: readinessCheck.details.service_status,
      recommendations: readinessCheck.details.recommendations,
      next_steps: []
    }
    
    // 다음 단계 권장사항 생성
    if (result.transition_readiness.ready_for_transition) {
      result.next_steps.push('✅ ComfyUI 전환 준비 완료')
      result.next_steps.push('🔧 NEXT_PUBLIC_ENABLE_MOCK=false로 변경하여 ComfyUI 모드 활성화')
      result.next_steps.push('🧪 실제 이미지 생성 테스트 권장')
    } else {
      if (!result.transition_readiness.environment_configured) {
        result.next_steps.push('⚠️ COMFYUI_SERVER_URL 환경 변수 설정 필요')
      }
      if (!result.transition_readiness.service_healthy) {
        result.next_steps.push('⚠️ ComfyUI 서버 상태 확인 및 복구 필요')
      }
      if (result.transition_readiness.mock_mode_disabled) {
        result.next_steps.push('⚠️ Mock 모드 비활성화 전 ComfyUI 서버 검증 필요')
      }
    }
    
    console.log('ComfyUI 전환 상태 확인 완료:', {
      ready: result.transition_readiness.ready_for_transition,
      service: result.transition_readiness.service_type,
      configured: result.current_state.comfyui_server_configured
    })
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('ComfyUI 전환 상태 확인 실패:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
