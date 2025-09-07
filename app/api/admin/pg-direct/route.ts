import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export async function POST() {
  try {
    // 실제 패스워드를 사용한 PostgreSQL 직접 연결
    const connectionString = 'postgresql://postgres.thnboxxfxahwkawzgcjj:rywkvnwk112!@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres'
    
    console.log('🔗 PostgreSQL 직접 연결 시도...')
    
    const client = new Client({ connectionString })
    await client.connect()
    
    console.log('✅ PostgreSQL 연결 성공!')

    // 스키마 SQL 정의 (Day 1에 필요한 기본 테이블만)
    const schemas = [
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
      )`,
      
      // 4. chatbots 테이블
      `CREATE TABLE IF NOT EXISTS public.chatbots (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        age INTEGER,
        gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
        personality_description TEXT,
        profile_image_url TEXT,
        speech_preset_id UUID REFERENCES public.speech_presets(id),
        concept_id UUID REFERENCES public.concepts(id),
        relationship_type VARCHAR(20) CHECK (relationship_type IN ('lover', 'friend', 'some', 'family')),
        system_prompt TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`,
      
      // 5. chat_sessions 테이블
      `CREATE TABLE IF NOT EXISTS public.chat_sessions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
        title VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`,
      
      // 6. chat_messages 테이블
      `CREATE TABLE IF NOT EXISTS public.chat_messages (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      )`,
      
      // 7. user_quotas 테이블
      `CREATE TABLE IF NOT EXISTS public.user_quotas (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        quota_type VARCHAR(50) NOT NULL,
        used_count INTEGER DEFAULT 0,
        limit_count INTEGER NOT NULL,
        reset_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        UNIQUE(user_id, quota_type)
      )`
    ]

    const results = {
      totalTables: schemas.length,
      successCount: 0,
      errorCount: 0,
      errors: []
    }

    // 각 테이블을 순차적으로 생성
    for (let i = 0; i < schemas.length; i++) {
      try {
        console.log(`📊 테이블 ${i + 1}/${schemas.length} 생성 중...`)
        await client.query(schemas[i])
        results.successCount++
        console.log(`✅ 테이블 ${i + 1} 생성 성공`)
      } catch (error: any) {
        console.error(`❌ 테이블 ${i + 1} 생성 실패:`, error.message)
        results.errors.push(`Table ${i + 1}: ${error.message}`)
        results.errorCount++
      }
    }

    // 기본 인덱스 생성
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email)',
      'CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id)',
      'CREATE INDEX IF NOT EXISTS idx_chatbots_user_id ON public.chatbots(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_concepts_relationship_type ON public.concepts(relationship_type)'
    ]

    console.log('📇 인덱스 생성 시작...')
    for (const indexSql of indexes) {
      try {
        await client.query(indexSql)
        console.log('✅ 인덱스 생성 성공')
      } catch (error: any) {
        console.log('⚠️ 인덱스 생성 스킵:', error.message)
      }
    }

    // 연결 종료
    await client.end()
    console.log('🔌 데이터베이스 연결 종료')

    // 생성된 테이블 확인
    const testClient = new Client({ connectionString })
    await testClient.connect()
    
    const tableCheck = await testClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'speech_presets', 'concepts', 'chatbots', 'chat_sessions', 'chat_messages', 'user_quotas')
      ORDER BY table_name
    `)
    
    await testClient.end()

    return NextResponse.json({
      success: true,
      message: '🎉 Day 1 스키마 생성 완료!',
      results,
      createdTables: tableCheck.rows.map(row => row.table_name),
      totalCreatedTables: tableCheck.rows.length
    })

  } catch (error: any) {
    console.error('❌ 스키마 생성 실패:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "PostgreSQL Direct Connection Schema Creator",
    usage: "POST to create Day 1 schema with direct database connection"
  })
}
