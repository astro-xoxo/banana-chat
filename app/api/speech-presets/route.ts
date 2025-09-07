import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

// 컨셉과 말투의 매핑 함수
function getSpeechPresetByConcept(relationshipType: string, conceptName: string): string {
  const mapping = {
    'family': {
      '병간호/돌봄': '따뜻한 돌봄 말투',
      '가족 식사': '정겨운 어머니 말투',
      '갈등/다툼': '서운한 가족 말투',
      '전통/명절': '정중한 전통 말투'
    },
    'friend': {
      '여행': '신나는 모험 말투',
      '운동': '에너지 넘치는 운동 말투',
      '새친구': '친근한 첫만남 말투',
      '고민 상담': '공감하는 조언 말투'
    },
    'lover': {
      '여행': '로맨틱한 연인 말투',
      '일상 데이트': '편안한 애인 말투',
      '싸움 후 화해': '미안한 연인 말투',
      '첫 데이트': '설레는 연인 말투'
    },
    'some': {
      '데이트 같은 만남': '애매한 썸 말투',
      '밀당 중': '은근한 밀당 말투',
      '고백 직전': '떨리는 고백 전 말투',
      '썸 시작': '호기심 가득한 탐색 말투'
    }
  } as const

  return mapping[relationshipType as keyof typeof mapping]?.[conceptName as keyof typeof mapping[keyof typeof mapping]] || '친근한 첫만남 말투'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const conceptId = searchParams.get('conceptId')
  const gender = searchParams.get('gender') // 새로운 성별 파라미터

  console.log('말투 조회 요청:', { conceptId, gender })

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

    if (conceptId) {
      // 특정 컨셉에 해당하는 말투 조회 (1:1 매핑)
      const conceptQuery = `
        SELECT relationship_type, name 
        FROM concepts 
        WHERE id = $1 AND is_active = true
      `
      const conceptResult = await client.query(conceptQuery, [conceptId])
      
      if (conceptResult.rows.length === 0) {
        return NextResponse.json({ error: 'Concept not found' }, { status: 404 })
      }

      const concept = conceptResult.rows[0]
      console.log('컨셉 정보:', concept)

      // 컨셉별 매핑된 말투 이름 찾기
      const speechPresetName = getSpeechPresetByConcept(concept.relationship_type, concept.name)
      console.log('매핑된 말투 이름:', speechPresetName)

      // 해당 말투 조회 (성별 고려)
      let speechQuery = `
        SELECT id, name, description, system_prompt, personality_traits, gender, gender_prompt, created_at
        FROM speech_presets 
        WHERE name LIKE $1 AND is_active = true
      `
      let queryParams = [`%${speechPresetName}%`]
      
      // 성별 파라미터가 있으면 성별별 말투 우선 조회
      if (gender && ['male', 'female'].includes(gender)) {
        speechQuery += ` AND gender = $2 ORDER BY gender`
        queryParams.push(gender)
        console.log('성별별 말투 조회:', gender)
      } else {
        // 성별 파라미터가 없으면 기존 방식 (성별별 말투 우선, 없으면 일반)
        speechQuery += ` ORDER BY CASE WHEN gender IS NOT NULL THEN 1 ELSE 2 END, name`
        console.log('기본 말투 조회 (성별별 우선)')
      }

      const speechResult = await client.query(speechQuery, queryParams)

      console.log('말투 조회 결과:', speechResult.rows)
      return NextResponse.json(speechResult.rows)
    } else {
      // 모든 말투 조회 (성별 필터링 지원)
      let query = `
        SELECT id, name, description, system_prompt, personality_traits, gender, gender_prompt, created_at
        FROM speech_presets 
        WHERE is_active = true
      `
      let queryParams: string[] = []

      // 성별 필터링 적용
      if (gender && gender !== 'all') {
        if (['male', 'female'].includes(gender)) {
          query += ` AND gender = $1`
          queryParams.push(gender)
          console.log('성별 필터 적용:', gender)
        } else {
          console.log('유효하지 않은 성별 파라미터:', gender)
          return NextResponse.json(
            { error: '유효하지 않은 성별입니다. male, female, all만 허용됩니다.' },
            { status: 400 }
          )
        }
      } else {
        console.log('모든 성별 말투 조회')
      }

      query += ` ORDER BY name ASC`
      
      const result = await client.query(query, queryParams)
      
      console.log(`말투 조회 결과: ${result.rows.length}개 (성별: ${gender || 'all'})`)
      
      return NextResponse.json({
        success: true,
        filter: { gender: gender || 'all' },
        count: result.rows.length,
        data: result.rows
      })
    }

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch speech presets' },
      { status: 500 }
    )
  } finally {
    await client.end()
  }
}
