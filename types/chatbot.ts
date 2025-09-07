// 챗봇 데이터베이스 타입 정의
export interface ChatbotData {
  id: string
  user_id: string
  name: string
  age?: number // 10-100
  gender?: 'male' | 'female' | 'other'
  relationship_type?: string // max 20 chars
  personality_description?: string // 기존: 프리셋 설명, 신규: max 20 chars (상황/컨셉)
  profile_image_url?: string
  user_uploaded_image_url?: string
  speech_preset_id?: string
  concept_id?: string
  system_prompt: string
  is_active?: boolean
  input_method?: 'preset' | 'direct' // 입력 방식 구분
  created_at: string
  updated_at: string
}

// 프로필 생성 요청 타입
export interface CreateChatbotRequest {
  name: string
  age: number // 10-100
  gender: 'male' | 'female'
  relationship: string // max 20 chars
  concept: string // max 20 chars  
  profileImageUrl: string
  inputMethod?: 'direct' // 새로운 직접 입력 방식
}

// 프로필 생성 응답 타입
export interface CreateChatbotResponse {
  success: boolean
  chatbotId?: string
  profileImageUrl?: string
  error?: string
}