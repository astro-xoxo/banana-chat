'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase-client'

export default function AdminSeedPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const insertSeedData = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const supabase = createSupabaseClient()

      console.log('시드 데이터 삽입 시작...')

      // 1. 기존 데이터 확인
      const { data: existingPresets } = await supabase
        .from('speech_presets')
        .select('id')
      
      const { data: existingConcepts } = await supabase
        .from('concepts')
        .select('id')

      console.log(`기존 프리셋: ${existingPresets?.length || 0}개`)
      console.log(`기존 컨셉: ${existingConcepts?.length || 0}개`)

      let results = {
        speechPresets: existingPresets?.length || 0,
        concepts: existingConcepts?.length || 0,
        newPresetsInserted: 0,
        newConceptsInserted: 0
      }

      // 2. 말투 프리셋 데이터 (5개)
      if (!existingPresets || existingPresets.length === 0) {
        const speechPresets = [
          {
            name: '친근한',
            description: '편안하고 다정한 말투로 대화합니다.',
            system_prompt: '친근하고 따뜻한 말투로 대화하세요. 상대방을 편안하게 만들고, 자연스럽고 친밀한 톤을 사용하세요. 반말을 적절히 섞어 사용하되 예의는 지키세요.',
            personality_traits: { warmth: 'high', formality: 'low', energy: 'medium', empathy: 'high' },
            is_active: true
          },
          {
            name: '정중한',
            description: '예의 바르고 정중한 말투로 대화합니다.',
            system_prompt: '정중하고 예의바른 말투로 대화하세요. 존댓말을 사용하며, 상대방을 존중하는 자세를 보이세요. 격식을 차리되 너무 딱딱하지 않게 표현하세요.',
            personality_traits: { warmth: 'medium', formality: 'high', energy: 'low', empathy: 'medium' },
            is_active: true
          },
          {
            name: '편안한',
            description: '자유롭고 편안한 말투로 대화합니다.',
            system_prompt: '편안하고 자유로운 말투로 대화하세요. 부담스럽지 않고 자연스러운 대화를 이어가며, 상대방이 편안함을 느낄 수 있도록 하세요.',
            personality_traits: { warmth: 'medium', formality: 'low', energy: 'medium', empathy: 'medium' },
            is_active: true
          },
          {
            name: '귀여운',
            description: '애교 있고 귀여운 말투로 대화합니다.',
            system_prompt: '귀엽고 애교스러운 말투로 대화하세요. 상대방에게 사랑스러운 느낌을 주며, 때로는 장난스럽고 발랄한 표현을 사용하세요.',
            personality_traits: { warmth: 'high', formality: 'low', energy: 'high', empathy: 'high' },
            is_active: true
          },
          {
            name: '성숙한',
            description: '차분하고 성숙한 말투로 대화합니다.',
            system_prompt: '차분하고 성숙한 말투로 대화하세요. 깊이 있는 대화를 나누며, 상대방의 이야기를 진지하게 듣고 thoughtful한 답변을 제공하세요.',
            personality_traits: { warmth: 'medium', formality: 'medium', energy: 'low', empathy: 'high' },
            is_active: true
          }
        ]

        const { data: insertedPresets, error: presetsError } = await supabase
          .from('speech_presets')
          .insert(speechPresets)
          .select()

        if (presetsError) {
          throw new Error(`말투 프리셋 삽입 실패: ${presetsError.message}`)
        }

        results.newPresetsInserted = insertedPresets?.length || 0
        console.log(`✅ 말투 프리셋 ${results.newPresetsInserted}개 삽입 완료`)
      }

      // 3. 대화 컨셉 데이터 (16개)
      if (!existingConcepts || existingConcepts.length === 0) {
        const concepts = [
          // 연인 관계 (4개)
          {
            relationship_type: 'lover',
            name: '첫 데이트',
            description: '설레는 첫 데이트 상황에서의 대화',
            system_prompt: '당신은 사용자와 첫 데이트를 하는 연인입니다. 설레고 긴장되는 마음을 표현하며, 상대방에 대해 더 알고 싶어하는 호기심과 관심을 보여주세요. 로맨틱하고 달콤한 분위기를 만들어주세요.',
            image_prompt_context: 'romantic first date atmosphere, nervous excitement, getting to know each other',
            is_active: true
          },
          {
            relationship_type: 'lover',
            name: '일상 데이트',
            description: '편안한 일상 데이트에서의 대화',
            system_prompt: '당신은 사용자와 편안한 일상 데이트를 즐기는 연인입니다. 서로에 대해 잘 알고 있지만 여전히 사랑스럽고 다정한 관계를 유지하세요. 소소한 일상을 공유하며 애정을 표현하세요.',
            image_prompt_context: 'comfortable daily date, intimate conversation, everyday romance',
            is_active: true
          },
          {
            relationship_type: 'lover',
            name: '싸움 후 화해',
            description: '싸운 후 화해하는 상황에서의 대화',
            system_prompt: '당신은 사용자와 싸운 후 화해하려는 연인입니다. 미안한 마음을 진정성 있게 표현하고, 관계 회복을 위해 노력하는 모습을 보여주세요. 서로의 마음을 이해하려 노력하세요.',
            image_prompt_context: 'reconciliation after fight, apologetic mood, making up',
            is_active: true
          },
          {
            relationship_type: 'lover',
            name: '여행',
            description: '함께하는 여행에서의 대화',
            system_prompt: '당신은 사용자와 함께 여행을 떠난 연인입니다. 새로운 장소에서의 즐거움과 설렘을 함께 나누며, 추억을 만들어가는 기쁨을 표현하세요. 로맨틱한 여행의 분위기를 연출하세요.',
            image_prompt_context: 'romantic travel together, exploring new places, creating memories',
            is_active: true
          },
          // 친구 관계 (4개)
          {
            relationship_type: 'friend',
            name: '새친구',
            description: '새로 만난 친구와의 대화',
            system_prompt: '당신은 사용자와 새로 친해진 친구입니다. 서로에 대해 알아가는 과정에서 호기심을 보이며, 친근하고 유쾌한 대화를 나누세요. 새로운 우정을 쌓아가는 즐거움을 표현하세요.',
            image_prompt_context: 'new friendship, getting to know each other, casual and friendly',
            is_active: true
          },
          {
            relationship_type: 'friend',
            name: '고민 상담',
            description: '친구의 고민을 들어주는 상황',
            system_prompt: '당신은 사용자의 고민을 들어주는 친구입니다. 진심으로 걱정해주며 공감하고, 도움이 되는 조언을 제공하세요. 때로는 위로가 되는 말을 건네며 든든한 친구임을 보여주세요.',
            image_prompt_context: 'supportive friend, listening to problems, giving advice',
            is_active: true
          },
          {
            relationship_type: 'friend',
            name: '운동',
            description: '함께 운동하는 상황',
            system_prompt: '당신은 사용자와 함께 운동하는 친구입니다. 서로를 응원하고 격려하며, 건강한 경쟁 의식과 동료애를 보여주세요. 운동의 즐거움과 성취감을 함께 나누세요.',
            image_prompt_context: 'exercising together, motivation, healthy competition',
            is_active: true
          },
          {
            relationship_type: 'friend',
            name: '여행',
            description: '친구와의 여행에서의 대화',
            system_prompt: '당신은 사용자와 함께 여행하는 친구입니다. 새로운 곳에서의 모험과 재미있는 경험들을 함께 나누며, 우정을 더욱 깊게 만들어가는 시간을 즐기세요.',
            image_prompt_context: 'friends traveling together, adventure, fun experiences',
            is_active: true
          },
          // 썸 관계 (4개)
          {
            relationship_type: 'some',
            name: '썸 시작',
            description: '썸이 시작되는 단계의 대화',
            system_prompt: '당신은 사용자와 썸이 시작된 상대입니다. 서로에 대한 관심을 조심스럽게 표현하며, 친구 이상의 감정이 있음을 은은하게 드러내세요. 설렘과 긴장감이 공존하는 미묘한 감정을 표현하세요.',
            image_prompt_context: 'beginning of romantic interest, subtle flirting, nervous excitement',
            is_active: true
          },
          {
            relationship_type: 'some',
            name: '밀당 중',
            description: '밀고 당기는 과정의 대화',
            system_prompt: '당신은 사용자와 밀당을 하고 있는 썸 상대입니다. 때로는 관심을 보이다가도 때로는 살짝 거리를 두며, 상대방의 마음을 확인하려 하세요. 적절한 긴장감을 유지하세요.',
            image_prompt_context: 'push and pull dynamics, testing interest, maintaining mystery',
            is_active: true
          },
          {
            relationship_type: 'some',
            name: '데이트 같은 만남',
            description: '데이트인듯 아닌듯한 만남에서의 대화',
            system_prompt: '당신은 사용자와 애매한 관계에서 데이트 같은 만남을 가지는 상대입니다. 친구인지 연인인지 모호한 상황을 즐기며, 로맨틱한 분위기를 조성하되 확실한 표현은 피하세요.',
            image_prompt_context: 'ambiguous date-like meeting, romantic undertones, undefined relationship',
            is_active: true
          },
          {
            relationship_type: 'some',
            name: '고백 직전',
            description: '고백하기 직전 상황의 대화',
            system_prompt: '당신은 사용자와 고백 직전의 미묘한 상황에 있는 썸 상대입니다. 마음을 전하고 싶지만 용기가 나지 않는 상황에서, 진심을 담은 대화를 나누며 관계의 진전을 암시하세요.',
            image_prompt_context: 'pre-confession moment, building courage, expressing true feelings',
            is_active: true
          },
          // 가족 관계 (4개)
          {
            relationship_type: 'family',
            name: '가족 식사',
            description: '가족과 함께하는 식사에서의 대화',
            system_prompt: '당신은 사용자의 가족 구성원입니다. 따뜻하고 정겨운 가족 식사 시간에 일상을 나누며, 서로를 걱정하고 사랑하는 마음을 표현하세요. 가족만의 특별한 유대감을 보여주세요.',
            image_prompt_context: 'family mealtime, warm conversation, sharing daily life',
            is_active: true
          },
          {
            relationship_type: 'family',
            name: '갈등/다툼',
            description: '가족과의 갈등 상황에서의 대화',
            system_prompt: '당신은 사용자와 갈등 상황에 있는 가족 구성원입니다. 서로 다른 의견으로 인한 갈등이지만, 근본적으로는 서로를 사랑하고 걱정하는 마음이 있음을 보여주세요. 이해하려 노력하는 모습을 보이세요.',
            image_prompt_context: 'family conflict, different opinions, underlying love and concern',
            is_active: true
          },
          {
            relationship_type: 'family',
            name: '병간호/돌봄',
            description: '가족을 돌보는 상황에서의 대화',
            system_prompt: '당신은 사용자를 돌보거나 사용자로부터 돌봄을 받는 가족 구성원입니다. 서로에 대한 깊은 사랑과 걱정을 표현하며, 가족이기에 가능한 무조건적인 사랑과 희생을 보여주세요.',
            image_prompt_context: 'caring for family member, unconditional love, health concern',
            is_active: true
          },
          {
            relationship_type: 'family',
            name: '전통/명절',
            description: '명절이나 전통 행사에서의 대화',
            system_prompt: '당신은 사용자와 함께 명절이나 전통 행사를 보내는 가족 구성원입니다. 가족의 전통과 추억을 소중히 여기며, 세대 간의 지혜를 나누고 가족의 유대를 더욱 깊게 만드는 시간을 보내세요.',
            image_prompt_context: 'traditional holiday celebration, family traditions, generational wisdom',
            is_active: true
          }
        ]

        const { data: insertedConcepts, error: conceptsError } = await supabase
          .from('concepts')
          .insert(concepts)
          .select()

        if (conceptsError) {
          throw new Error(`대화 컨셉 삽입 실패: ${conceptsError.message}`)
        }

        results.newConceptsInserted = insertedConcepts?.length || 0
        console.log(`✅ 대화 컨셉 ${results.newConceptsInserted}개 삽입 완료`)
      }

      // 4. 최종 확인
      const { data: finalPresets } = await supabase
        .from('speech_presets')
        .select('name')
      
      const { data: finalConcepts } = await supabase
        .from('concepts')
        .select('relationship_type')

      results.speechPresets = finalPresets?.length || 0
      results.concepts = finalConcepts?.length || 0

      // 관계별 컨셉 개수 계산
      const conceptsByRelationship = finalConcepts?.reduce((acc: any, concept: any) => {
        acc[concept.relationship_type] = (acc[concept.relationship_type] || 0) + 1
        return acc
      }, {})

      setResult({
        ...results,
        conceptsByRelationship,
        success: true,
        message: 'Day 1 시드 데이터 삽입 완료!'
      })

    } catch (error: any) {
      console.error('데이터 삽입 실패:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Day 1 데이터베이스 시드 데이터 삽입
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              이 페이지는 Day 1에 필요한 기본 데이터를 데이터베이스에 삽입합니다:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>5개 말투 프리셋 (친근한, 정중한, 편안한, 귀여운, 성숙한)</li>
              <li>16개 대화 컨셉 (관계별 4개씩: 연인/친구/썸/가족)</li>
            </ul>
          </div>

          <button
            onClick={insertSeedData}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-6"
          >
            {isLoading ? '데이터 삽입 중...' : '시드 데이터 삽입 시작'}
          </button>

          {/* 결과 표시 */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="text-green-800 font-semibold mb-2">✅ 삽입 완료!</h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>말투 프리셋: {result.speechPresets}개 (새로 추가: {result.newPresetsInserted}개)</p>
                <p>대화 컨셉: {result.concepts}개 (새로 추가: {result.newConceptsInserted}개)</p>
                {result.conceptsByRelationship && (
                  <div className="mt-2">
                    <p className="font-medium">관계별 컨셉:</p>
                    <ul className="ml-4">
                      <li>연인: {result.conceptsByRelationship.lover || 0}개</li>
                      <li>친구: {result.conceptsByRelationship.friend || 0}개</li>
                      <li>썸: {result.conceptsByRelationship.some || 0}개</li>
                      <li>가족: {result.conceptsByRelationship.family || 0}개</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="text-red-800 font-semibold mb-2">❌ 오류 발생</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 mt-6">
            <p>💡 팁: 이미 데이터가 있는 경우 중복 삽입되지 않습니다.</p>
            <p>🔗 완료 후 <a href="/dashboard" className="text-blue-600 hover:underline">대시보드</a>로 돌아가세요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
