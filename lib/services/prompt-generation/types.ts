// 프롬프트 생성 시스템 타입 정의

// 사용자 입력 데이터
export interface UserInputData {
  age: number
  gender: 'male' | 'female'
  relationship: string
  concept: string
}

// ComfyUI 프롬프트 형식
export interface ComfyUIPrompt {
  positive_prompt: string
  negative_prompt: string
  user_context: UserContext
}

// 사용자 컨텍스트 정보
export interface UserContext {
  age: number
  gender: 'male' | 'female'
  relationship: string
  concept: string
}

// 고정 프롬프트 타입
export interface FixedPrompts {
  positive: string
  negative: string
}

// 나이 그룹 타입
export type AgeGroup = 'young' | 'young adult' | 'middle-aged' | 'mature'

// 프롬프트 생성 옵션
export interface PromptGenerationOptions {
  includeContext?: boolean
  translateToEnglish?: boolean
  validateContent?: boolean
}