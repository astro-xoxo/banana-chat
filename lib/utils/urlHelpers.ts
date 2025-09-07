/**
 * URL 정규화 및 구성 헬퍼 함수들
 * ComfyUI 서버 URL 이중 슬래시 문제 해결
 */

/**
 * 베이스 URL과 엔드포인트를 안전하게 결합하는 함수
 * 이중 슬래시(//api/...) 문제를 방지
 * 
 * @param baseUrl - 베이스 URL (예: "https://example.com/" 또는 "http://localhost:8000")
 * @param endpoint - 엔드포인트 (예: "/api/generate/profile" 또는 "health")
 * @returns 정규화된 완전한 URL
 */
export function normalizeUrl(baseUrl: string, endpoint: string): string {
  if (!baseUrl || !endpoint) {
    throw new Error('baseUrl과 endpoint는 필수 매개변수입니다.')
  }

  // 베이스 URL 정규화: 끝의 슬래시들 제거
  const cleanBase = baseUrl.replace(/\/+$/, '')
  
  // 엔드포인트 정규화: 시작에 정확히 하나의 슬래시만 보장
  const cleanEndpoint = endpoint.replace(/^\/+/, '/').replace(/^(?!\/)/, '/')
  
  const result = cleanBase + cleanEndpoint
  
  console.log('URL 정규화:', {
    original: { baseUrl, endpoint },
    cleaned: { cleanBase, cleanEndpoint },
    result
  })
  
  return result
}

/**
 * ComfyUI 서버 특화 URL 구성 함수
 * 환경별 차이를 자동으로 처리
 * 
 * @param endpoint - API 엔드포인트
 * @returns 완전한 ComfyUI 서버 URL
 */
export function buildComfyUIUrl(endpoint: string): string {
  const baseUrl = process.env.COMFYUI_SERVER_URL
  
  if (!baseUrl) {
    throw new Error('COMFYUI_SERVER_URL 환경변수가 설정되지 않았습니다.')
  }
  
  return normalizeUrl(baseUrl, endpoint)
}

/**
 * URL 유효성 검증 함수
 * 
 * @param url - 검증할 URL
 * @returns 유효한 URL인지 여부
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 환경별 URL 정보를 반환하는 함수
 * 디버깅 및 로깅용
 * 
 * @returns 현재 환경의 URL 설정 정보
 */
export function getUrlEnvironmentInfo() {
  const comfyuiUrl = process.env.COMFYUI_SERVER_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const nodeEnv = process.env.NODE_ENV
  
  return {
    environment: nodeEnv,
    comfyui_server: comfyuiUrl,
    app_url: appUrl,
    comfyui_has_trailing_slash: comfyuiUrl?.endsWith('/') || false,
    comfyui_is_valid: comfyuiUrl ? isValidUrl(comfyuiUrl) : false
  }
}

/**
 * ComfyUI 서버 엔드포인트 목록
 * 중앙 집중식 관리
 */
export const COMFYUI_ENDPOINTS = {
  HEALTH: '/health',
  GENERATE_PROFILE: '/api/generate/profile',
  GENERATE_CHAT_IMAGE: '/generate-chat-image',
  STATUS: '/status'
} as const

/**
 * 환경변수에서 trailing slash 제거 및 정규화
 * 
 * @param url - 정규화할 URL
 * @returns 정규화된 URL
 */
export function normalizeEnvUrl(url: string): string {
  if (!url) return url
  
  // 프로토콜 확인
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`잘못된 URL 형식: ${url}. http:// 또는 https://로 시작해야 합니다.`)
  }
  
  // 끝의 슬래시 제거
  return url.replace(/\/+$/, '')
}
