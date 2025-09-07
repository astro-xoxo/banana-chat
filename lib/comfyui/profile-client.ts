// 프롬프트 기반 ComfyUI 클라이언트

import { ComfyUIProfileRequest, ComfyUIProfileResponse } from './types'
import { profilePromptGenerator } from '@/lib/services/prompt-generation/ProfilePromptGenerator'
import { UserInputData } from '@/lib/services/prompt-generation/types'

export class ComfyUIProfileClient {
  private readonly serverUrl: string
  private readonly timeout: number
  private readonly retries: number

  constructor(options: {
    serverUrl?: string
    timeout?: number
    retries?: number
  } = {}) {
    this.serverUrl = options.serverUrl || process.env.COMFYUI_SERVER_URL || ''
    this.timeout = options.timeout || 55000 // 55초 타임아웃
    this.retries = options.retries || 2
  }

  /**
   * 프롬프트 기반 프로필 이미지 생성
   */
  async generateProfile(
    userData: UserInputData,
    userImageUrl: string,
    userId: string,
    name: string = '나의 AI 캐릭터'
  ): Promise<ComfyUIProfileResponse> {
    try {
      console.log('프롬프트 기반 프로필 생성 시작:', {
        age: userData.age,
        gender: userData.gender,
        relationship: userData.relationship,
        concept: userData.concept,
        has_user_image: !!userImageUrl,
        user_id: userId?.substring(0, 8) + '...'
      })

      // 1. 프롬프트 생성
      const promptData = profilePromptGenerator.generateFinalPrompt(userData)
      
      console.log('프롬프트 생성 완료:', {
        positive_prompt_length: promptData.positive_prompt.length,
        negative_prompt_length: promptData.negative_prompt.length,
        user_context: promptData.user_context
      })

      // 2. 요청 페이로드 구성
      const requestPayload: ComfyUIProfileRequest = {
        positive_prompt: promptData.positive_prompt,
        negative_prompt: promptData.negative_prompt,
        user_image_url: userImageUrl,
        user_id: userId,
        name: name,
        user_context: promptData.user_context
      }

      console.log('ComfyUI 요청 페이로드:', {
        positive_prompt: promptData.positive_prompt.substring(0, 100) + '...',
        negative_prompt: promptData.negative_prompt.substring(0, 50) + '...',
        user_image_url: userImageUrl?.substring(0, 50) + '...',
        user_id: userId?.substring(0, 8) + '...',
        user_context: promptData.user_context
      })

      // 3. ComfyUI 서버 호출
      const response = await this.callComfyUIServer(requestPayload)
      
      console.log('프롬프트 기반 프로필 생성 완료:', {
        success: response.success,
        has_image_url: !!response.profile_image_url,
        processing_time: response.processing_time,
        error: response.error
      })

      // 생성된 프롬프트 정보 포함하여 반환
      return {
        ...response,
        generated_prompts: {
          positive_prompt: promptData.positive_prompt,
          negative_prompt: promptData.negative_prompt,
          user_context: promptData.user_context
        }
      }

    } catch (error) {
      console.error('프롬프트 기반 프로필 생성 실패:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '프로필 생성 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * ComfyUI 서버 실제 호출
   */
  private async callComfyUIServer(
    requestPayload: ComfyUIProfileRequest
  ): Promise<ComfyUIProfileResponse> {
    if (!this.serverUrl) {
      throw new Error('ComfyUI 서버 URL이 설정되지 않았습니다.')
    }

    const makeRequest = async (attempt: number = 1): Promise<ComfyUIProfileResponse> => {
      try {
        console.log(`ComfyUI 서버 요청 시도 ${attempt}/${this.retries + 1}`)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        // 기존 프로필 생성 엔드포인트 사용 (프롬프트 기반으로 업데이트)
        const endpoint = `${this.serverUrl.replace(/\/+$/, '')}/api/generate/profile`

        console.log('ComfyUI 프롬프트 기반 엔드포인트:', endpoint)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'User-Agent': 'AI-Face-Chat-Profile-Client/1.0',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        console.log('ComfyUI 서버 응답:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })

        if (!response.ok) {
          let errorMessage = `ComfyUI 서버 오류: ${response.status} ${response.statusText}`
          
          if (response.status === 404) {
            errorMessage = 'ComfyUI 서버에서 프로필 생성 엔드포인트를 찾을 수 없습니다.'
          } else if (response.status === 422) {
            try {
              const validationError = await response.json()
              errorMessage = `프롬프트 데이터 검증 실패: ${JSON.stringify(validationError.detail || validationError)}`
            } catch {
              errorMessage = '프롬프트 데이터 형식이 올바르지 않습니다.'
            }
          } else if (response.status === 500) {
            errorMessage = 'ComfyUI 서버 내부 오류가 발생했습니다.'
          }
          
          throw new Error(errorMessage)
        }

        const result = await response.json()
        
        console.log('ComfyUI 서버 응답 데이터:', {
          success: result.success,
          has_profile_image_url: !!result.profile_image_url,
          has_error: !!result.error,
          job_id: result.generation_job_id,
          metadata: result.metadata
        })

        if (!result.success) {
          throw new Error(result.error || 'ComfyUI 서버에서 처리 실패')
        }

        return {
          success: true,
          profile_image_url: result.profile_image_url,
          generation_job_id: result.generation_job_id,
          processing_time: result.processing_time,
          metadata: result.metadata
        }

      } catch (error) {
        console.error(`ComfyUI 요청 시도 ${attempt} 실패:`, error)
        
        // 재시도 가능한 오류 판단
        const isRetryable = 
          error instanceof TypeError || // 네트워크 오류
          (error instanceof Error && (
            error.message.includes('timeout') ||
            error.message.includes('500') ||
            error.message.includes('503') ||
            error.message.includes('fetch')
          ))
        
        if (isRetryable && attempt <= this.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          console.log(`${delay}ms 후 재시도... (${attempt}/${this.retries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return makeRequest(attempt + 1)
        }

        throw error
      }
    }

    return makeRequest()
  }

  /**
   * ComfyUI 서버 헬스 체크
   */
  async checkHealth(): Promise<{
    status: 'online' | 'offline' | 'error'
    version?: string
    responseTime?: number
    error?: string
  }> {
    if (!this.serverUrl) {
      return {
        status: 'error',
        error: 'ComfyUI 서버 URL이 설정되지 않았습니다.'
      }
    }

    try {
      const startTime = Date.now()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const response = await fetch(`${this.serverUrl}/health`, {
        method: 'GET',
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'AI-Face-Chat-Profile-HealthCheck/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        try {
          const data = await response.json()
          return {
            status: 'online',
            version: data.version || 'unknown',
            responseTime
          }
        } catch {
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
}

// 싱글톤 인스턴스 export
export const comfyUIProfileClient = new ComfyUIProfileClient()