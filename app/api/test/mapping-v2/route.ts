import { NextResponse } from 'next/server'
import { mapConceptToPresetIdV2 } from '@/lib/comfyui/preset-mapper'

/**
 * V2 매핑 함수 테스트 API
 * GET /api/test/mapping-v2?concept_id=...&speech_preset_id=...&gender=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const conceptId = searchParams.get('concept_id')
  const speechPresetId = searchParams.get('speech_preset_id')
  const gender = searchParams.get('gender') as 'male' | 'female' | undefined

  console.log('V2 매핑 테스트 요청:', { conceptId, speechPresetId, gender })

  if (!conceptId || !speechPresetId) {
    return NextResponse.json(
      { 
        error: 'concept_id와 speech_preset_id는 필수 파라미터입니다.',
        example: '/api/test/mapping-v2?concept_id=UUID&speech_preset_id=UUID&gender=female'
      },
      { status: 400 }
    )
  }

  try {
    const startTime = Date.now()
    
    const mappingResult = await mapConceptToPresetIdV2(
      conceptId,
      speechPresetId,
      gender
    )

    const endTime = Date.now()
    const duration = endTime - startTime

    console.log('V2 매핑 테스트 성공:', {
      concept: mappingResult.concept.name,
      speech: mappingResult.speechPreset.name,
      gender: mappingResult.concept.gender,
      preset_id: mappingResult.preset_id,
      duration: `${duration}ms`
    })

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      result: {
        preset_id: mappingResult.preset_id,
        concept: {
          id: mappingResult.concept.id,
          name: mappingResult.concept.name,
          relationship_type: mappingResult.concept.relationship_type,
          effective_gender: mappingResult.concept.gender
        },
        speech_preset: {
          id: mappingResult.speechPreset.id,
          name: mappingResult.speechPreset.name,
          gender: mappingResult.speechPreset.gender,
          has_gender_prompt: !!mappingResult.speechPreset.gender_prompt
        },
        combined_prompt: {
          length: mappingResult.combinedPrompt.length,
          preview: mappingResult.combinedPrompt.substring(0, 200) + '...'
        }
      }
    })

  } catch (error) {
    console.error('V2 매핑 테스트 실패:', error)
    
    return NextResponse.json(
      { 
        error: 'V2 매핑 실패',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        concept_id: conceptId,
        speech_preset_id: speechPresetId,
        gender: gender
      },
      { status: 500 }
    )
  }
}