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
    const conceptId = params.id

    // UUID 형식 검증
    if (!conceptId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conceptId)) {
      return NextResponse.json(
        { error: 'Valid concept ID is required' },
        { status: 400 }
      )
    }

    await client.connect()

    const query = `
      SELECT id, name, description, relationship_type, created_at, is_active
      FROM concepts 
      WHERE id = $1 AND is_active = true
    `

    const result = await client.query(query, [conceptId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Concept not found or inactive' },
        { status: 404 }
      )
    }

    console.log(`✅ Concept retrieved successfully: ${result.rows[0].name}`)
    return NextResponse.json(result.rows[0])

  } catch (error) {
    console.error('❌ Database error in /api/concepts/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch concept' },
      { status: 500 }
    )
  } finally {
    await client.end()
  }
}
