// 캐릭터 프로필 관리 시스템
// 데이터베이스 연동하여 캐릭터 생성 및 관리

import { createClient } from '@supabase/supabase-js'
import { generateSystemPrompt, type CharacterProfile, type Concept, type SpeechPreset } from './promptGenerator'

// Supabase 클라이언트 (서버 사이드)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 캐릭터 생성 요청 파라미터
export interface CreateCharacterRequest {
  userId: string
  conceptId: string
  speechPresetId: string
  basicInfo: {
    name: string
    age?: number
    gender: 'male' | 'female'
    profileImageUrl: string
    personalityNotes?: string
  }
}

// 캐릭터 생성 결과
export interface CreateCharacterResult {
  success: boolean
  chatbot?: {
    id: string
    name: string
    profile_image_url: string
    system_prompt: string
    personality_description: string
    relationship_type: string
    gender: string
    concept_id: string
    speech_preset_id: string
  }
  error?: string
  validation_warnings?: string[]
}

// 메인 캐릭터 생성 함수
export async function createCharacterProfile(
  request: CreateCharacterRequest
): Promise<CreateCharacterResult> {
  console.log('🎭 캐릭터 프로필 생성 시작:', request.basicInfo.name)
  
  try {
    // 1. 컨셉과 말투 데이터 조회
    const [conceptData, speechData] = await Promise.all([
      supabase
        .from('concepts')
        .select('*')
        .eq('id', request.conceptId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('speech_presets')
        .select('*')
        .eq('id', request.speechPresetId)
        .eq('is_active', true)
        .single()
    ])

    if (conceptData.error) {
      console.error('컨셉 데이터 조회 오류:', conceptData.error)
      return {
        success: false,
        error: `컨셉 데이터를 불러올 수 없습니다: ${conceptData.error.message}`
      }
    }

    if (speechData.error) {
      console.error('말투 데이터 조회 오류:', speechData.error)
      return {
        success: false,
        error: `말투 데이터를 불러올 수 없습니다: ${speechData.error.message}`
      }
    }

    console.log('프리셋 데이터 조회 완료:', {
      concept: conceptData.data.name,
      speech: speechData.data.name
    })

    // 2. 캐릭터 프로필 구성
    const characterProfile: CharacterProfile = {
      concept: conceptData.data,
      speechPreset: speechData.data,
      userPreferences: {
        name: request.basicInfo.name,
        age: request.basicInfo.age,
        gender: request.basicInfo.gender,
        personalityNotes: request.basicInfo.personalityNotes
      }
    }

    // 3. 시스템 프롬프트 생성
    const systemPrompt = generateSystemPrompt(characterProfile)
    console.log('시스템 프롬프트 생성 완료 (길이:', systemPrompt.length, ')')

    // 4. 개성 설명 생성
    const personalityDescription = generatePersonalityDescription(
      conceptData.data, 
      speechData.data, 
      request.basicInfo.gender
    )

    // 5. 챗봇 데이터 저장
    const chatbotData = {
      user_id: request.userId,
      name: request.basicInfo.name,
      age: request.basicInfo.age,
      gender: request.basicInfo.gender,
      profile_image_url: request.basicInfo.profileImageUrl,
      speech_preset_id: request.speechPresetId,
      concept_id: request.conceptId,
      relationship_type: conceptData.data.relationship_type,
      system_prompt: systemPrompt,
      personality_description: personalityDescription,
      personality_notes: request.basicInfo.personalityNotes,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('챗봇 데이터 저장 중...')
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .insert(chatbotData)
      .select()
      .single()

    if (chatbotError) {
      console.error('챗봇 저장 오류:', chatbotError)
      return {
        success: false,
        error: `챗봇 저장에 실패했습니다: ${chatbotError.message}`
      }
    }

    console.log('✅ 캐릭터 프로필 생성 완료:', chatbot.id)

    return {
      success: true,
      chatbot: chatbot
    }

  } catch (error) {
    console.error('캐릭터 프로필 생성 중 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }
  }
}

// 개성 설명 생성 함수
function generatePersonalityDescription(
  concept: Concept,
  speechPreset: SpeechPreset,
  gender: 'male' | 'female'
): string {
  const genderText = gender === 'male' ? '남성' : '여성'
  
  return `${genderText} ${concept.relationship_type} 캐릭터로, ${concept.description}한 성격을 가지고 있습니다. ${speechPreset.description}를 사용하여 대화하며, "${concept.name}" 컨셉과 "${speechPreset.name}" 스타일이 조화롭게 어우러진 독특한 매력을 가지고 있습니다.`
}

// 활성 컨셉 목록 조회
export async function getActiveConcepts(): Promise<Concept[]> {
  const { data, error } = await supabase
    .from('concepts')
    .select('*')
    .eq('is_active', true)
    .order('relationship_type', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('컨셉 목록 조회 오류:', error)
    return []
  }

  return data || []
}

// 관계별 컨셉 조회
export async function getConceptsByRelationship(relationshipType: string): Promise<Concept[]> {
  const { data, error } = await supabase
    .from('concepts')
    .select('*')
    .eq('relationship_type', relationshipType)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('관계별 컨셉 조회 오류:', error)
    return []
  }

  return data || []
}

// 활성 말투 프리셋 목록 조회
export async function getActiveSpeechPresets(): Promise<SpeechPreset[]> {
  const { data, error } = await supabase
    .from('speech_presets')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('말투 프리셋 목록 조회 오류:', error)
    return []
  }

  return data || []
}

// 사용자 챗봇 목록 조회
export async function getUserChatbots(userId: string) {
  const { data, error } = await supabase
    .from('chatbots')
    .select(`
      *,
      concepts:concept_id (
        id,
        name,
        relationship_type,
        description
      ),
      speech_presets:speech_preset_id (
        id,
        name,
        description
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('사용자 챗봇 목록 조회 오류:', error)
    return []
  }

  return data || []
}

// 특정 챗봇 상세 조회
export async function getChatbotDetails(chatbotId: string, userId: string) {
  const { data, error } = await supabase
    .from('chatbots')
    .select(`
      *,
      concepts:concept_id (
        id,
        name,
        relationship_type,
        description,
        system_prompt,
        image_prompt_context
      ),
      speech_presets:speech_preset_id (
        id,
        name,
        description,
        system_prompt,
        personality_traits
      )
    `)
    .eq('id', chatbotId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('챗봇 상세 조회 오류:', error)
    return null
  }

  return data
}

// 챗봇 시스템 프롬프트 업데이트
export async function updateChatbotSystemPrompt(
  chatbotId: string, 
  userId: string,
  conceptId?: string,
  speechPresetId?: string
) {
  try {
    // 현재 챗봇 정보 조회
    const chatbot = await getChatbotDetails(chatbotId, userId)
    if (!chatbot) {
      throw new Error('챗봇을 찾을 수 없습니다.')
    }

    // 새로운 컨셉이나 말투가 제공된 경우 업데이트
    const newConceptId = conceptId || chatbot.concept_id
    const newSpeechPresetId = speechPresetId || chatbot.speech_preset_id

    if (newConceptId !== chatbot.concept_id || newSpeechPresetId !== chatbot.speech_preset_id) {
      // 새로운 프리셋 데이터 조회
      const [conceptData, speechData] = await Promise.all([
        supabase.from('concepts').select('*').eq('id', newConceptId).single(),
        supabase.from('speech_presets').select('*').eq('id', newSpeechPresetId).single()
      ])

      if (conceptData.error || speechData.error) {
        throw new Error('새로운 프리셋 데이터를 불러올 수 없습니다.')
      }

      // 새로운 시스템 프롬프트 생성
      const characterProfile: CharacterProfile = {
        concept: conceptData.data,
        speechPreset: speechData.data,
        userPreferences: {
          name: chatbot.name,
          age: chatbot.age,
          gender: chatbot.gender
        }
      }

      const newSystemPrompt = generateSystemPrompt(characterProfile)
      const newPersonalityDescription = generatePersonalityDescription(
        conceptData.data, 
        speechData.data, 
        chatbot.gender
      )

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('chatbots')
        .update({
          concept_id: newConceptId,
          speech_preset_id: newSpeechPresetId,
          system_prompt: newSystemPrompt,
          personality_description: newPersonalityDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatbotId)
        .eq('user_id', userId)

      if (updateError) {
        throw new Error(`업데이트 실패: ${updateError.message}`)
      }

      console.log('챗봇 시스템 프롬프트 업데이트 완료:', chatbotId)
    }

    return { success: true }

  } catch (error) {
    console.error('챗봇 시스템 프롬프트 업데이트 오류:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }
  }
}

// 챗봇 삭제 (비활성화)
export async function deactivateChatbot(chatbotId: string, userId: string) {
  const { error } = await supabase
    .from('chatbots')
    .update({ 
      is_active: false, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', chatbotId)
    .eq('user_id', userId)

  if (error) {
    console.error('챗봇 비활성화 오류:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// 관계 타입 통계 조회
export async function getRelationshipTypeStats(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('chatbots')
    .select('relationship_type')
    .eq('is_active', true)

  if (error) {
    console.error('관계 타입 통계 조회 오류:', error)
    return {}
  }

  const stats: Record<string, number> = {}
  data?.forEach(item => {
    stats[item.relationship_type] = (stats[item.relationship_type] || 0) + 1
  })

  return stats
}

export default createCharacterProfile
