// ComfyUI 프리셋 매핑 시스템
import { Client } from 'pg'

export interface ConceptMapping {
  id: string
  name: string
  description: string
  relationship_type: 'lover' | 'friend' | 'some' | 'family'
  gender?: 'male' | 'female'
  system_prompt?: string
}

export interface SpeechPresetMapping {
  id: string
  name: string
  description: string
  system_prompt?: string
  gender?: 'male' | 'female'
  gender_prompt?: string
  base_preset_id?: string
}

export interface PresetMappingResult {
  preset_id: string
  concept: ConceptMapping
  speechPreset: SpeechPresetMapping
  combinedPrompt: string
}

/**
 * 컨셉 ID와 말투 프리셋 ID를 ComfyUI 프리셋 ID (1-8)로 매핑 (V2 - 성별별 지원)
 * 
 * @param conceptId 컨셉 ID
 * @param speechPresetId 말투 프리셋 ID  
 * @param explicitGender 명시적 성별 (optional)
 * @returns 매핑 결과 (성별별 프롬프트 포함)
 */
export async function mapConceptToPresetIdV2(
  conceptId: string,
  speechPresetId: string,
  explicitGender?: 'male' | 'female'
): Promise<PresetMappingResult> {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('DB 연결 성공 - V2 프리셋 매핑 조회 시작')

    // 컨셉 정보 조회
    const conceptResult = await client.query(
      'SELECT id, name, description, relationship_type, system_prompt FROM concepts WHERE id = $1 AND is_active = true',
      [conceptId]
    )

    // 말투 프리셋 정보 조회 (성별 정보 포함)
    const speechResult = await client.query(
      'SELECT id, name, description, system_prompt, gender, gender_prompt, base_preset_id FROM speech_presets WHERE id = $1 AND is_active = true',
      [speechPresetId]
    )

    if (conceptResult.rows.length === 0) {
      throw new Error(`컨셉을 찾을 수 없습니다: ${conceptId}`)
    }

    if (speechResult.rows.length === 0) {
      throw new Error(`말투 프리셋을 찾을 수 없습니다: ${speechPresetId}`)
    }

    const concept = conceptResult.rows[0] as ConceptMapping
    const speechPreset = speechResult.rows[0] as SpeechPresetMapping

    console.log('V2 매핑 조회 성공:', {
      concept: concept.name,
      relationship: concept.relationship_type,
      speech: speechPreset.name,
      speechGender: speechPreset.gender,
      explicitGender
    })

    // 성별 결정 우선순위
    let effectiveGender: 'male' | 'female'
    
    // 1. 명시적 성별이 있으면 우선 사용
    if (explicitGender) {
      effectiveGender = explicitGender
      console.log('명시적 성별 사용:', effectiveGender)
    }
    // 2. 말투 프리셋에 성별 정보가 있으면 사용
    else if (speechPreset.gender) {
      effectiveGender = speechPreset.gender
      console.log('말투 프리셋 성별 사용:', effectiveGender)
    }
    // 3. 기존 성별 추정 로직 사용
    else {
      effectiveGender = inferGenderFromConcept(concept)
      console.log('성별 추정 결과 사용:', effectiveGender)
    }

    concept.gender = effectiveGender

    // ComfyUI 프리셋 ID 매핑
    const presetId = mapToComfyUIPreset(effectiveGender, concept.relationship_type)

    // V2 프롬프트 결합 (성별별 특성 포함)
    const combinedPrompt = combinePromptsV2(concept, speechPreset, effectiveGender)

    console.log('V2 프리셋 매핑 완료:', {
      conceptId,
      speechPresetId,
      mappedPresetId: presetId,
      effectiveGender,
      relationship: concept.relationship_type,
      hasGenderPrompt: !!speechPreset.gender_prompt
    })

    return {
      preset_id: presetId,
      concept,
      speechPreset,
      combinedPrompt
    }

  } catch (error) {
    console.error('V2 프리셋 매핑 오류:', error)
    throw new Error(`V2 프리셋 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await client.end()
  }
}

/**
 * V2 프롬프트 결합 함수 (성별별 특성 포함)
 */
function combinePromptsV2(
  concept: ConceptMapping, 
  speechPreset: SpeechPresetMapping,
  gender: 'male' | 'female'
): string {
  const conceptPrompt = concept.system_prompt || `${concept.name} 캐릭터`
  const speechPrompt = speechPreset.system_prompt || `${speechPreset.name} 말투`
  const genderPrompt = speechPreset.gender_prompt || getDefaultGenderPrompt(gender)
  
  // V2 프롬프트 결합 전략 (성별별 특성 강화)
  const combinedPrompt = `
당신은 ${concept.name} 성격을 가진 AI 캐릭터입니다.

성격 특성:
${conceptPrompt}

말투 및 대화 스타일:
${speechPrompt}

성별별 말투 특성:
${genderPrompt}

관계 설정: ${concept.relationship_type}
이 모든 설정에 맞게 자연스럽고 일관성 있는 대화를 해주세요. 특히 성별에 따른 말투 차이를 자연스럽게 표현해주세요.
`.trim()

  console.log('V2 프롬프트 결합 완료:', {
    conceptLength: conceptPrompt.length,
    speechLength: speechPrompt.length,
    genderLength: genderPrompt.length,
    combinedLength: combinedPrompt.length,
    gender
  })

  return combinedPrompt
}

/**
 * 기본 성별별 프롬프트 제공
 */
function getDefaultGenderPrompt(gender: 'male' | 'female'): string {
  const prompts = {
    male: '남성적인 말투와 어조를 사용하여 대화하세요. 더 직설적이고 간결한 표현을 선호하며, 감정 표현이 절제되어 있고 단호한 톤을 사용합니다. "그래", "맞아", "좋네" 등의 간결한 표현을 자주 사용하고, 문장 끝에 "다", "네", "지" 등을 사용합니다.',
    female: '여성적인 말투와 어조를 사용하여 대화하세요. 감정 표현이 더 풍부하고 섬세하며, 공감적이고 따뜻한 대화를 선호합니다. "정말?", "와~", "그래요?" 등의 표현을 자주 사용하고, 문장 끝에 "요", "네요", "어요" 등을 사용하여 부드러운 톤을 유지합니다.'
  }
  
  return prompts[gender]
}

/**
 * 컨셉 ID와 말투 프리셋 ID를 ComfyUI 프리셋 ID (1-8)로 매핑 (기존 V1)
 */
export async function mapConceptToPresetId(
  conceptId: string,
  speechPresetId: string
): Promise<PresetMappingResult> {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('DB 연결 성공 - 프리셋 매핑 조회 시작')

    // 컨셉 정보 조회
    const conceptResult = await client.query(
      'SELECT id, name, description, relationship_type, system_prompt FROM concepts WHERE id = $1 AND is_active = true',
      [conceptId]
    )

    // 말투 프리셋 정보 조회
    const speechResult = await client.query(
      'SELECT id, name, description, system_prompt FROM speech_presets WHERE id = $1 AND is_active = true',
      [speechPresetId]
    )

    if (conceptResult.rows.length === 0) {
      throw new Error(`컨셉을 찾을 수 없습니다: ${conceptId}`)
    }

    if (speechResult.rows.length === 0) {
      throw new Error(`말투 프리셋을 찾을 수 없습니다: ${speechPresetId}`)
    }

    const concept = conceptResult.rows[0] as ConceptMapping
    const speechPreset = speechResult.rows[0] as SpeechPresetMapping

    console.log('매핑 조회 성공:', {
      concept: concept.name,
      relationship: concept.relationship_type,
      speech: speechPreset.name
    })

    // 성별 추정 (컨셉명이나 설명에서 성별 키워드 찾기)
    const gender = inferGenderFromConcept(concept)
    concept.gender = gender

    // ComfyUI 프리셋 ID 매핑 (성별 × 관계 타입)
    const presetId = mapToComfyUIPreset(gender, concept.relationship_type)

    // 프롬프트 결합
    const combinedPrompt = combinePrompts(concept, speechPreset)

    console.log('프리셋 매핑 완료:', {
      conceptId,
      speechPresetId,
      mappedPresetId: presetId,
      gender,
      relationship: concept.relationship_type
    })

    return {
      preset_id: presetId,
      concept,
      speechPreset,
      combinedPrompt
    }

  } catch (error) {
    console.error('프리셋 매핑 오류:', error)
    throw new Error(`프리셋 매핑 실패: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    await client.end()
  }
}

/**
 * 성별 추정 로직 (컨셉 데이터 기반)
 */
function inferGenderFromConcept(concept: ConceptMapping): 'male' | 'female' {
  const name = concept.name?.toLowerCase() || ''
  const description = concept.description?.toLowerCase() || ''
  const systemPrompt = concept.system_prompt?.toLowerCase() || ''
  
  const fullText = `${name} ${description} ${systemPrompt}`

  // 남성 키워드 확인
  const maleKeywords = [
    '남성', '남자', '오빠', '형', '아버지', '아빠', '남친', '보이프렌드',
    'male', 'man', 'boy', 'father', 'dad', 'boyfriend', 'brother',
    '그', '그가', '그는', '그의', 'he', 'his', 'him'
  ]

  // 여성 키워드 확인  
  const femaleKeywords = [
    '여성', '여자', '언니', '누나', '어머니', '엄마', '여친', '걸프렌드',
    'female', 'woman', 'girl', 'mother', 'mom', 'girlfriend', 'sister',
    '그녀', '그녀가', '그녀는', '그녀의', 'she', 'her'
  ]

  // 키워드 매칭
  const maleMatches = maleKeywords.filter(keyword => fullText.includes(keyword)).length
  const femaleMatches = femaleKeywords.filter(keyword => fullText.includes(keyword)).length

  console.log('성별 추정:', {
    concept: concept.name,
    maleMatches,
    femaleMatches,
    inferred: maleMatches > femaleMatches ? 'male' : 'female'
  })

  // 남성 키워드가 더 많으면 남성, 아니면 여성 (기본값)
  return maleMatches > femaleMatches ? 'male' : 'female'
}

/**
 * 성별과 관계 타입을 ComfyUI 프리셋 ID (1-8)로 매핑
 */
function mapToComfyUIPreset(
  gender: 'male' | 'female',
  relationshipType: 'lover' | 'friend' | 'some' | 'family'
): string {
  // ComfyUI 프리셋 매핑 규칙:
  // 1-4: 여성 (lover, friend, some, family)
  // 5-8: 남성 (lover, friend, some, family)
  
  const relationshipOrder = {
    'lover': 0,
    'friend': 1, 
    'some': 2,
    'family': 3
  }

  const baseOffset = gender === 'female' ? 1 : 5
  const relationshipOffset = relationshipOrder[relationshipType] || 1 // 기본값: friend
  
  const presetId = (baseOffset + relationshipOffset).toString()
  
  console.log('ComfyUI 프리셋 매핑:', {
    gender,
    relationshipType,
    baseOffset,
    relationshipOffset,
    finalPresetId: presetId
  })

  return presetId
}

/**
 * 컨셉과 말투 프리셋의 시스템 프롬프트를 결합
 */
function combinePrompts(concept: ConceptMapping, speechPreset: SpeechPresetMapping): string {
  const conceptPrompt = concept.system_prompt || `${concept.name} 캐릭터`
  const speechPrompt = speechPreset.system_prompt || `${speechPreset.name} 말투`
  
  // 프롬프트 결합 전략
  const combinedPrompt = `
당신은 ${concept.name} 성격을 가진 AI 캐릭터입니다.

성격 특성:
${conceptPrompt}

말투 및 대화 스타일:
${speechPrompt}

관계 설정: ${concept.relationship_type}
이 설정에 맞게 자연스럽고 일관성 있는 대화를 해주세요.
`.trim()

  console.log('프롬프트 결합 완료:', {
    conceptLength: conceptPrompt.length,
    speechLength: speechPrompt.length,
    combinedLength: combinedPrompt.length
  })

  return combinedPrompt
}

/**
 * 간단한 프리셋 매핑 (DB 조회 없이 사용할 수 있는 대체 함수)
 */
export function getSimplePresetMapping(
  conceptId: string,
  speechPresetId: string
): string {
  // 실제 서비스에서는 캐시된 매핑 테이블 사용
  const fallbackMapping: Record<string, string> = {
    // 예시 매핑 (실제 UUID는 DB에서 확인 후 업데이트)
    'fb417dcc-9c68-4a70-97dc-beca68181daf': '1', // 여성 연인 
    'default': '1' // 기본값
  }

  const mappedPreset = fallbackMapping[conceptId] || fallbackMapping['default']
  
  console.log('간단 프리셋 매핑:', {
    conceptId: conceptId.substring(0, 8) + '...',
    speechPresetId: speechPresetId.substring(0, 8) + '...',
    mappedPreset
  })

  return mappedPreset
}

/**
 * 프리셋 유효성 검증 (message_based 포함)
 */
export function validatePresetId(presetId: string): boolean {
  return /^[1-8]$/.test(presetId) || presetId === 'message_based'
}

/**
 * 디버깅용 모든 컨셉과 말투 프리셋 조회
 */
export async function getAllPresetsForDebugging(): Promise<{
  concepts: ConceptMapping[]
  speechPresets: SpeechPresetMapping[]
}> {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const conceptsResult = await client.query(
      'SELECT id, name, description, relationship_type, system_prompt FROM concepts WHERE is_active = true ORDER BY name'
    )

    const speechPresetsResult = await client.query(
      'SELECT id, name, description, system_prompt, gender, gender_prompt, base_preset_id FROM speech_presets WHERE is_active = true ORDER BY gender, name'
    )

    return {
      concepts: conceptsResult.rows as ConceptMapping[],
      speechPresets: speechPresetsResult.rows as SpeechPresetMapping[]
    }

  } finally {
    await client.end()
  }
}
