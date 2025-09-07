import { NextResponse } from 'next/server'
import { Client } from 'pg'

/**
 * 성별별 말투 프리셋 조회 API
 * GET /api/speech-presets/gender/[gender]
 * 
 * @param gender - 'male' 또는 'female'
 * @returns 해당 성별의 활성화된 말투 프리셋 목록
 */
export async function GET(
  request: Request,
  { params }: { params: { gender: string } }
) {
  const { gender } = params

  console.log('성별별 말투 조회 요청:', { gender })

  // 유효한 성별인지 검증
  if (!['male', 'female'].includes(gender)) {
    console.error('유효하지 않은 성별:', gender)
    return NextResponse.json(
      { 
        error: '유효하지 않은 성별입니다. male 또는 female만 허용됩니다.',
        provided: gender,
        allowed: ['male', 'female']
      },
      { status: 400 }
    )
  }

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
    console.log('DB 연결 성공 - 성별별 말투 조회')

    const query = `
      SELECT 
        id,
        name,
        description,
        system_prompt,
        personality_traits,
        gender,
        gender_prompt,
        base_preset_id,
        is_active,
        created_at,
        updated_at
      FROM speech_presets 
      WHERE gender = $1 AND is_active = true 
      ORDER BY name
    `

    console.log('실행 쿼리:', query, '파라미터:', [gender])

    const result = await client.query(query, [gender])

    console.log(`성별별 말투 조회 결과: ${result.rows.length}개 찾음`)
    
    // 결과 데이터 로깅 (처음 3개만)
    if (result.rows.length > 0) {
      console.log('조회 결과 샘플:', result.rows.slice(0, 3).map(row => ({
        id: row.id,
        name: row.name,
        gender: row.gender
      })))
    }

    await client.end()

    return NextResponse.json({
      success: true,
      gender: gender,
      count: result.rows.length,
      data: result.rows
    })

  } catch (error) {
    console.error('성별별 말투 조회 오류:', error)
    
    try {
      await client.end()
    } catch (endError) {
      console.error('DB 연결 종료 오류:', endError)
    }

    return NextResponse.json(
      { 
        error: '말투 조회에 실패했습니다',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        gender: gender
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS 요청 처리 (CORS 지원)
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}