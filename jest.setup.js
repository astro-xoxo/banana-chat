// Jest 테스트 환경 설정

// 환경 변수 설정 (테스트 환경용)
process.env.NODE_ENV = 'test'

// 전역 객체 모킹 (Next.js API Routes를 위한 설정)
global.Response = class Response {
  constructor(body, init) {
    this.body = body
    this.init = init || {}
    this.status = this.init.status || 200
    this.statusText = this.init.statusText || 'OK'
    this.headers = new Map(Object.entries(this.init.headers || {}))
  }
  
  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    })
  }
  
  json() {
    return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body)
  }
  
  text() {
    return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body))
  }
}

// Next.js 환경 변수 모킹 (필요한 경우)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'

// Anthropic SDK 모킹
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{
            type: 'text',
            text: JSON.stringify({
              emotions: ['행복한'],
              situations: ['공원에서'],
              actions: ['놀고있는'],
              objects: ['고양이'],
              style: ['자연스러운'],
              confidence: 0.85
            })
          }]
        })
      }
    }))
  }
})

// 콘솔 출력 제어 (테스트 시 불필요한 로그 숨김)
if (process.env.NODE_ENV === 'test') {
  // 경고 로그는 유지하되, info 로그는 숨김
  const originalConsoleInfo = console.info
  console.info = jest.fn()
  
  // 에러는 그대로 출력
  const originalConsoleError = console.error
  console.error = (...args) => {
    if (args[0]?.includes && args[0].includes('Jest')) return
    originalConsoleError.apply(console, args)
  }
}

// 전역 테스트 설정
beforeEach(() => {
  // 각 테스트 전에 실행할 설정
  jest.clearAllMocks()
})

afterEach(() => {
  // 각 테스트 후에 실행할 정리 작업
  jest.restoreAllMocks()
})