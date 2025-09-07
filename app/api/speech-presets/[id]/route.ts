import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    const speechPresetId = params.id

    // UUID 형식 검증
    if (!speechPresetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(speechPresetId)) {
      return NextResponse.json(
        { error: 'Valid speech preset ID is required' },
        { status: 400 }
      )
    }

    await client.connect()

    const query = `
      SELECT id, name, description, system_prompt, personality_traits, created_at, is_active
      FROM speech_presets 
      WHERE id = $1 AND is_active = true
    `

    const result = await client.query(query, [speechPresetId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Speech preset not found or inactive' },
        { status: 404 }
      )
    }

    console.log(`✅ Speech preset retrieved successfully: ${result.rows[0].name}`)
    return NextResponse.json(result.rows[0])

  } catch (error) {
    console.error('❌ Database error in /api/speech-presets/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch speech preset' },
      { status: 500 }
    )
  } finally {
    await client.end()
  }
}
