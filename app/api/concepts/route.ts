import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export async function GET(request: NextRequest) {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    const { searchParams } = new URL(request.url)
    const relationshipType = searchParams.get('relationship_type')

    if (!relationshipType) {
      return NextResponse.json(
        { error: 'relationship_type parameter is required' },
        { status: 400 }
      )
    }

    await client.connect()

    const query = `
      SELECT id, name, description, relationship_type, created_at
      FROM concepts 
      WHERE relationship_type = $1 AND is_active = true
      ORDER BY name ASC
    `

    const result = await client.query(query, [relationshipType])

    return NextResponse.json(result.rows)

  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch concepts' },
      { status: 500 }
    )
  } finally {
    await client.end()
  }
}
