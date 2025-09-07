import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function POST() {
  try {
    // Service Role Key로 관리자 권한 클라이언트 생성
    const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzIwODY0MiwiZXhwIjoyMDYyNzg0NjQyfQ.P9NFo3iY8EcxIqoUaZ5I4iHvtjh9X4OY_f7vbZ2-dB0'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('✅ Supabase 관리자 클라이언트 생성 완료')

    // Day 1 스키마 SQL 파일 읽기
    const schemaPath = join(process.cwd(), 'supabase', 'migrations', '20250701084800_day1_schema.sql')
    const schemaSQL = readFileSync(schemaPath, 'utf8')

    console.log('📄 스키마 파일 읽기 완료:', schemaPath)

    // SQL을 여러 부분으로 나누어 실행
    const sqlStatements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

    console.log(`📊 총 ${sqlStatements.length}개의 SQL 구문 발견`)

    const results = {
      totalStatements: sqlStatements.length,
      successCount: 0,
      errorCount: 0,
      errors: []
    }

    // 각 SQL 구문을 개별적으로 실행
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i] + ';'
      
      try {
        console.log(`🔄 구문 ${i + 1}/${sqlStatements.length} 실행 중...`)
        
        // Supabase RPC를 통한 SQL 실행
        const { data, error } = await supabase.rpc('exec', {
          sql: statement
        })

        if (error) {
          console.error(`❌ 구문 ${i + 1} 실행 실패:`, error.message)
          results.errors.push(`Statement ${i + 1}: ${error.message}`)
          results.errorCount++
        } else {
          console.log(`✅ 구문 ${i + 1} 실행 성공`)
          results.successCount++
        }
      } catch (err: any) {
        console.error(`💥 구문 ${i + 1} 실행 중 예외:`, err.message)
        results.errors.push(`Statement ${i + 1}: ${err.message}`)
        results.errorCount++
      }
    }

    // 테이블 생성 확인
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['users', 'speech_presets', 'concepts', 'chatbots', 'chat_sessions', 'chat_messages', 'user_quotas'])

    if (!tablesError) {
      console.log('📋 생성된 테이블:', tables?.map(t => t.table_name).join(', '))
    }

    return NextResponse.json({
      success: true,
      message: 'Day 1 스키마 적용 완료',
      results,
      createdTables: tables?.map(t => t.table_name) || []
    })

  } catch (error: any) {
    console.error('❌ 스키마 적용 실패:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Day 1 Schema Application API",
    usage: "POST to apply the schema from migration file"
  })
}
