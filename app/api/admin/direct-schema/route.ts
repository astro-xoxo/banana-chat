import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // Service Role Key로 관리자 권한 클라이언트 생성
    const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzIwODY0MiwiZXhwIjoyMDYyNzg0NjQyfQ.P9NFo3iY8EcxIqoUaZ5I4iHvtjh9X4OY_f7vbZ2-dB0'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('✅ Supabase 관리자 클라이언트 생성 완료')

    // REST API를 통한 직접 SQL 실행 시도
    const statements = [
      // 1. users 테이블
      `CREATE TABLE IF NOT EXISTS public.users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(100),
        profile_image_url TEXT,
        google_id VARCHAR(255) UNIQUE,
        is_premium BOOLEAN DEFAULT false,
        profile_image_used BOOLEAN DEFAULT false,
        daily_chat_count INTEGER DEFAULT 0,
        quota_reset_time TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`,
      
      // 2. speech_presets 테이블
      `CREATE TABLE IF NOT EXISTS public.speech_presets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        personality_traits JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`,
      
      // 3. concepts 테이블
      `CREATE TABLE IF NOT EXISTS public.concepts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('lover', 'friend', 'some', 'family')),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        image_prompt_context TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`
    ]

    const results = {
      attempted: statements.length,
      success: 0,
      errors: []
    }

    // 각 테이블을 개별 생성 (REST API 직접 호출)
    for (let i = 0; i < statements.length; i++) {
      try {
        console.log(`📊 테이블 ${i + 1} 생성 시도...`)
        
        // Supabase REST API를 직접 호출
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ query: statements[i] })
        })

        if (response.ok) {
          console.log(`✅ 테이블 ${i + 1} 생성 성공`)
          results.success++
        } else {
          const errorText = await response.text()
          console.error(`❌ 테이블 ${i + 1} 생성 실패:`, errorText)
          results.errors.push(`Table ${i + 1}: ${errorText}`)
        }
      } catch (err: any) {
        console.error(`💥 테이블 ${i + 1} 생성 중 예외:`, err.message)
        results.errors.push(`Table ${i + 1}: ${err.message}`)
      }
    }

    // 생성된 테이블 확인
    try {
      const { data: tablesData } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (tablesData !== null) {
        console.log('✅ users 테이블 접근 가능')
      }
    } catch (err) {
      console.log('❌ users 테이블 접근 불가:', err)
    }

    return NextResponse.json({
      success: true,
      message: 'Schema creation attempted',
      results,
      instruction: 'Manual schema creation may be required via Supabase Dashboard SQL Editor'
    })

  } catch (error: any) {
    console.error('❌ 스키마 생성 실패:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      recommendation: 'Please use Supabase Dashboard SQL Editor to manually run the schema'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Direct Table Creation API",
    usage: "POST to create tables directly",
    manualPath: "/supabase/migrations/20250701084800_day1_schema.sql"
  })
}
