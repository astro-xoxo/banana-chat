// ComfyUI 서버 연동 서비스
// Phase 2에서 Mock 대신 사용할 실제 이미지 생성 서비스

import { ImageGenerationService, GenerateProfileParams, ProfileResult } from './mockImageService'
import { buildComfyUIUrl, COMFYUI_ENDPOINTS, normalizeEnvUrl } from '@/lib/utils/urlHelpers'

// 실제 ComfyUI 서비스 구현
export class ComfyUIService implements ImageGenerationService {
  private readonly serverUrl: string
  private readonly timeout: number = 60000 // 1분 타임아웃 (실제 처리시간 몇 초 고려)
  
  constructor() {
    const rawUrl = process.env.COMFYUI_SERVER_URL || 'https://hawk-amusing-socially.ngrok-free.app'
    this.serverUrl = normalizeEnvUrl(rawUrl)
    console.log('ComfyUI 서비스 초기화 - 정규화된 URL:', this.serverUrl)
  }
  
  async generateProfile(params: GenerateProfileParams): Promise<ProfileResult> {
    console.log('🚀 ComfyUI 서비스 시작:', params)
    
    try {
      const startTime = Date.now()
      
      // ComfyUI 서버에 이미지 생성 요청 (URL 정규화 적용)
      const apiUrl = buildComfyUIUrl(COMFYUI_ENDPOINTS.GENERATE_PROFILE)
      console.log('ComfyUI API 요청 URL:', apiUrl)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'AI-Face-Chat-Client/1.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          user_image_url: params.user_image_url,
          preset_id: params.preset_id,
          chatbot_name: params.chatbot_name,
          user_id: params.user_id
        }),
        signal: AbortSignal.timeout(this.timeout)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('ComfyUI 서버 오류 응답:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        throw new Error(`ComfyUI 서버 응답 오류: ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      const endTime = Date.now()
      const processingTime = endTime - startTime
      
      console.log(`ComfyUI 응답 수신 (${processingTime}ms):`, {
        success: result.success,
        hasProfileImageUrl: !!result.profile_image_url,
        hasImageData: !!result.image_data,
        jobId: result.generation_job_id
      })
      
      // 성공 응답 처리
      if (result.success) {
        return {
          success: true,
          profile_image_url: result.profile_image_url,
          generation_time: `${(processingTime / 1000).toFixed(1)}s`,
          preset_id: params.preset_id,
          style_description: result.style_description || `AI 생성 캐릭터 (프리셋 ${params.preset_id})`,
          is_mock: false,
          metadata: {
            server_url: this.serverUrl,
            server_response: {
              generation_job_id: result.generation_job_id,
              processing_time: processingTime,
              style_info: result.style_info
            },
            created_at: new Date().toISOString(),
            original_request: params
          }
        }
      } else {
        throw new Error(result.error || '알 수 없는 서버 오류')
      }
      
    } catch (error) {
      console.error('❌ ComfyUI 서비스 실패:', error)
      
      let errorMessage = '이미지 생성 중 오류가 발생했습니다'
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.'
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
        error: errorMessage,
        is_mock: false,
        metadata: {
          server_url: this.serverUrl,
          error_at: new Date().toISOString(),
          original_request: params
        }
      }
    }
  }
  
  // ComfyUI 서버 상태 체크 (빠른 응답 체크)
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🔍 ComfyUI 서버 상태 체크')
      
      const startTime = Date.now()
      const healthUrl = buildComfyUIUrl(COMFYUI_ENDPOINTS.HEALTH)
      console.log('ComfyUI Health Check URL:', healthUrl)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'AI-Face-Chat-Client/1.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(10000) // 10초 타임아웃
      })
      
      const latency = Date.now() - startTime
      const isHealthy = response.ok
      
      if (isHealthy) {
        const healthData = await response.json()
        console.log(`✅ ComfyUI 서버 정상 (${latency}ms):`, {
          status: healthData.status,
          version: healthData.version,
          uptime: healthData.uptime,
          system: healthData.system
        })
      } else {
        console.log(`❌ ComfyUI 서버 오류 (${latency}ms): ${response.status}`)
      }
      
      return isHealthy
      
    } catch (error) {
      console.error('❌ ComfyUI 서버 연결 실패:', error)
      return false
    }
  }
  
  // 서버 정보 반환
  getServerInfo() {
    return {
      url: this.serverUrl,
      timeout: this.timeout,
      environment: process.env.NODE_ENV || 'development',
      expected_response_time: '몇 초 이내',
      max_concurrent_requests: 5
    }
  }
  
  // 프리셋 목록 조회
  async getPresets(): Promise<any> {
    try {
      console.log('🔍 ComfyUI 서버 프리셋 목록 조회')
      
      const presetsUrl = buildComfyUIUrl('/api/presets')
      console.log('ComfyUI Presets URL:', presetsUrl)
      
      const response = await fetch(presetsUrl, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'AI-Face-Chat-Client/1.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(10000)
      })
      
      if (!response.ok) {
        throw new Error(`프리셋 조회 실패: ${response.status}`)
      }
      
      const presets = await response.json()
      console.log('✅ ComfyUI 서버 프리셋 조회 성공:', presets.total_count + '개')
      
      return presets
      
    } catch (error) {
      console.error('❌ ComfyUI 서버 프리셋 조회 실패:', error)
      throw error
    }
  }
}

export default ComfyUIService
