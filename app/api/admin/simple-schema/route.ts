import { NextRequest, NextResponse } from 'next/server'

export async function POST() {
  try {
    // Supabase SQL을 직접 실행할 수 있는 API 엔드포인트에 요청
    const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzIwODY0MiwiZXhwIjoyMDYyNzg0NjQyfQ.P9NFo3iY8EcxIqoUaZ5I4iHvtjh9X4OY_f7vbZ2-dB0'

    // 1단계: 기본 테이블 생성
    const basicTablesSQL = `
      -- 1. users 테이블
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(100),
        profile_image_url TEXT,
        google_id VARCHAR(255),
        is_premium BOOLEAN DEFAULT false,
        quota_used INTEGER DEFAULT 0,
        quota_limit INTEGER DEFAULT 10,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 2. speech_presets 테이블
      CREATE TABLE IF NOT EXISTS public.speech_presets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        personality_traits JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );

      -- 3. concepts 테이블
      CREATE TABLE IF NOT EXISTS public.concepts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        relationship_type VARCHAR(20) NOT NULL CHECK (relationship_type IN ('lover', 'friend', 'some', 'family')),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        image_prompt_context TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `

    // Supabase REST API를 통한 SQL 실행
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        sql: basicTablesSQL
      })
    })

    if (!response.ok) {
      // REST API가 실패하면 직접적인 방법 시도
      console.log('REST API failed, trying alternative method...')
      
      return NextResponse.json({
        success: false,
        error: 'SQL execution not supported via API. Please use Supabase Dashboard SQL Editor.',
        instructions: [
          '1. Supabase Dashboard (https://supabase.com/dashboard)에 로그인',
          '2. 프로젝트 thnboxxfxahwkawzgcjj 선택',
          '3. SQL Editor로 이동',
          '4. /database/01_basic_tables.sql 파일 내용 복사하여 실행',
          '5. /database/02_dependent_tables.sql 파일 내용 복사하여 실행',
          '6. /database/03_indexes.sql 파일 내용 복사하여 실행'
        ]
      })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Basic tables created successfully',
      result
    })

  } catch (error: any) {
    console.error('Table creation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      instructions: [
        '⚠️ API를 통한 테이블 생성이 실패했습니다.',
        '📋 수동으로 다음 단계를 진행하세요:',
        '',
        '1. https://supabase.com/dashboard 접속',
        '2. 프로젝트 thnboxxfxahwkawzgcjj 선택',
        '3. SQL Editor 메뉴로 이동',
        '4. 첫 번째로 /database/01_basic_tables.sql 실행',
        '5. 두 번째로 /database/02_dependent_tables.sql 실행',
        '6. 세 번째로 /database/03_indexes.sql 실행',
        '7. 완료 후 /admin/table-test 에서 확인'
      ]
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Simple Table Creation API",
    usage: "POST to create basic tables, or follow manual instructions",
    files: {
      step1: "/database/01_basic_tables.sql",
      step2: "/database/02_dependent_tables.sql", 
      step3: "/database/03_indexes.sql"
    }
  })
}
