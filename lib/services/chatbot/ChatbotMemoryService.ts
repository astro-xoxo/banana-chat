// Task 008: AI 챗봇 장기기억 시스템 구현
// 사용자 정보 기반 시스템 프롬프트 생성 및 관리

import { createSupabaseServiceClient } from '@/lib/supabase-server'

export interface ChatbotMemoryData {
  name: string
  gender: 'male' | 'female'
  age: number
  relationship: string
  concept: string
}

/**
 * 나이 그룹을 한국어로 반환
 */
function getAgeGroupKorean(age: number): string {
  if (age <= 12) return '아동'
  if (age <= 19) return '청소년'
  if (age <= 29) return '20대'
  if (age <= 39) return '30대'
  if (age <= 49) return '40대'
  if (age <= 59) return '50대'
  if (age <= 69) return '60대'
  return '시니어'
}

/**
 * 나이와 관계에 따른 말투 가이드 생성
 */
function generateSpeechStyleGuide(age: number, relationship: string): string {
  // 나이대별 기본 말투
  let baseStyle = ''
  if (age <= 19) {
    baseStyle = '젊고 활발한 말투를 사용하세요. 이모티콘이나 줄임말을 적절히 활용하세요.'
  } else if (age <= 29) {
    baseStyle = '자연스럽고 친근한 말투를 사용하세요. 현대적이고 세련된 표현을 활용하세요.'
  } else if (age <= 39) {
    baseStyle = '안정적이고 성숙한 말투를 사용하세요. 경험을 바탕으로 한 조언도 할 수 있습니다.'
  } else if (age <= 49) {
    baseStyle = '깊이 있고 신중한 말투를 사용하세요. 인생 경험을 녹여낸 대화를 하세요.'
  } else {
    baseStyle = '지혜롭고 따뜻한 말투를 사용하세요. 인생의 깊이가 느껴지는 대화를 하세요.'
  }

  // 관계별 세부 조정
  let relationshipStyle = ''
  if (relationship.includes('연인') || relationship.includes('lover')) {
    relationshipStyle = '애정 표현을 자연스럽게 하고, 로맨틱하고 다정한 톤을 유지하세요.'
  } else if (relationship.includes('친구') || relationship.includes('friend')) {
    relationshipStyle = '편안하고 친근한 톤으로 대화하며, 때로는 장난스럽기도 하세요.'
  } else if (relationship.includes('썸') || relationship.includes('some')) {
    relationshipStyle = '약간의 설렘과 호기심을 담아 대화하되, 적절한 거리감을 유지하세요.'
  } else if (relationship.includes('가족') || relationship.includes('family')) {
    relationshipStyle = '따뜻하고 보호적인 톤으로 대화하며, 가족애가 느껴지도록 하세요.'
  } else {
    relationshipStyle = '정중하면서도 친근한 톤으로 대화하세요.'
  }

  return `${baseStyle}\n${relationshipStyle}`
}

/**
 * 시스템 프롬프트 생성 함수
 */
export function generateSystemPrompt(data: ChatbotMemoryData): string {
  const genderKorean = data.gender === 'male' ? '남성' : '여성'
  const ageGroup = getAgeGroupKorean(data.age)
  
  return `
당신은 ${data.name}라는 이름의 ${data.age}세 ${genderKorean} AI 캐릭터입니다.

## 기본 설정
- 나이: ${data.age}세 (${ageGroup})
- 성별: ${genderKorean}
- 사용자와의 관계: ${data.relationship}
- 상황/컨셉: ${data.concept}

## 대화 규칙
1. 설정된 나이에 맞는 말투와 사고방식을 유지하세요.
2. 사용자와의 관계(${data.relationship})를 항상 고려하여 대화하세요.
3. 설정된 상황/컨셉(${data.concept})에 맞는 맥락을 유지하세요.
4. 자연스럽고 일관성 있는 캐릭터를 연기하세요.
5. 한국어로 대화하며, 나이와 관계에 맞는 존댓말/반말을 사용하세요.

## 말투 가이드
${generateSpeechStyleGuide(data.age, data.relationship)}

당신의 정체성과 설정을 절대 잊지 마시고, 일관성 있는 캐릭터로 대화해주세요.
`.trim()
}

/**
 * 챗봇 메모리 서비스 클래스
 */
export class ChatbotMemoryService {
  private supabase = createSupabaseServiceClient()

  /**
   * 챗봇 메모리 데이터 저장
   */
  async saveMemoryData(chatbotId: string, memoryData: ChatbotMemoryData): Promise<void> {
    console.log('Task 008: 챗봇 메모리 데이터 저장 시작:', {
      chatbotId: chatbotId.substring(0, 8) + '...',
      memoryData: {
        name: memoryData.name,
        gender: memoryData.gender,
        age: memoryData.age,
        relationship: memoryData.relationship,
        concept: memoryData.concept
      }
    })

    const systemPrompt = generateSystemPrompt(memoryData)
    
    const { error } = await this.supabase
      .from('chatbots')
      .update({
        age: memoryData.age,
        relationship_type: memoryData.relationship,
        personality_description: memoryData.concept,
        system_prompt: systemPrompt,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatbotId)

    if (error) {
      console.error('Task 008: 챗봇 메모리 데이터 저장 실패:', error)
      throw new Error(`챗봇 메모리 저장 실패: ${error.message}`)
    }

    console.log('Task 008: 챗봇 메모리 데이터 저장 완료:', {
      chatbotId: chatbotId.substring(0, 8) + '...',
      systemPromptLength: systemPrompt.length
    })
  }

  /**
   * 챗봇 메모리 데이터 조회
   */
  async getMemoryData(chatbotId: string): Promise<ChatbotMemoryData | null> {
    console.log('Task 008: 챗봇 메모리 데이터 조회 시작:', {
      chatbotId: chatbotId.substring(0, 8) + '...'
    })

    const { data, error } = await this.supabase
      .from('chatbots')
      .select('name, gender, age, relationship_type, personality_description')
      .eq('id', chatbotId)
      .single()
    
    if (error) {
      console.error('Task 008: 챗봇 메모리 데이터 조회 실패:', error)
      return null
    }

    if (!data) {
      console.warn('Task 008: 챗봇 데이터를 찾을 수 없음:', { chatbotId })
      return null
    }

    const memoryData: ChatbotMemoryData = {
      name: data.name,
      gender: data.gender,
      age: data.age,
      relationship: data.relationship_type,
      concept: data.personality_description
    }

    console.log('Task 008: 챗봇 메모리 데이터 조회 완료:', {
      chatbotId: chatbotId.substring(0, 8) + '...',
      hasData: true,
      age: memoryData.age,
      relationship: memoryData.relationship
    })

    return memoryData
  }

  /**
   * 챗봇 시스템 프롬프트 조회
   */
  async getSystemPrompt(chatbotId: string): Promise<string | null> {
    console.log('Task 008: 챗봇 시스템 프롬프트 조회 시작:', {
      chatbotId: chatbotId.substring(0, 8) + '...'
    })

    const { data, error } = await this.supabase
      .from('chatbots')
      .select('system_prompt')
      .eq('id', chatbotId)
      .single()
    
    if (error) {
      console.error('Task 008: 시스템 프롬프트 조회 실패:', error)
      return null
    }

    console.log('Task 008: 시스템 프롬프트 조회 완료:', {
      chatbotId: chatbotId.substring(0, 8) + '...',
      hasPrompt: !!data?.system_prompt,
      promptLength: data?.system_prompt?.length || 0
    })

    return data?.system_prompt || null
  }

  /**
   * 메모리 데이터 유효성 검사
   */
  validateMemoryData(data: Partial<ChatbotMemoryData>): {
    isValid: boolean
    errors: string[]
    normalizedData?: ChatbotMemoryData
  } {
    const errors: string[] = []

    // 필수 필드 검증
    if (!data.name || typeof data.name !== 'string') {
      errors.push('이름이 필요합니다.')
    }

    if (!data.gender || !['male', 'female'].includes(data.gender)) {
      errors.push('유효한 성별이 필요합니다. (male 또는 female)')
    }

    if (!data.age || typeof data.age !== 'number' || data.age < 1 || data.age > 100) {
      errors.push('유효한 나이가 필요합니다. (1-100세)')
    }

    if (!data.relationship || typeof data.relationship !== 'string') {
      errors.push('관계 정보가 필요합니다.')
    }

    if (!data.concept || typeof data.concept !== 'string') {
      errors.push('컨셉 정보가 필요합니다.')
    }

    if (errors.length > 0) {
      return { isValid: false, errors }
    }

    // 정규화된 데이터 생성
    const normalizedData: ChatbotMemoryData = {
      name: data.name!.trim(),
      gender: data.gender! as 'male' | 'female',
      age: Math.round(data.age!),
      relationship: data.relationship!.trim(),
      concept: data.concept!.trim()
    }

    return {
      isValid: true,
      errors: [],
      normalizedData
    }
  }
}