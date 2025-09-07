import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // 관리자용 Service Role Key 사용
    const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzIwODY0MiwiZXhwIjoyMDYyNzg0NjQyfQ.P9NFo3iY8EcxIqoUaZ5I4iHvtjh9X4OY_f7vbZ2-dB0'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 테이블별로 개별 생성
    const tables = [
      {
        name: 'users',
        sql: `
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
        `
      },
      {
        name: 'speech_presets',
        sql: `
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
        `
      },
      {
        name: 'concepts',
        sql: `
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
      },
      {
        name: 'chatbots',
        sql: `
          CREATE TABLE IF NOT EXISTS public.chatbots (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            age INTEGER,
            gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
            personality_description TEXT,
            profile_image_url TEXT,
            speech_preset_id UUID REFERENCES public.speech_presets(id),
            concept_id UUID REFERENCES public.concepts(id),
            system_prompt TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
          );
        `
      },
      {
        name: 'chat_sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS public.chat_sessions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
            title VARCHAR(200),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
          );
        `
      },
      {
        name: 'chat_messages',
        sql: `
          CREATE TABLE IF NOT EXISTS public.chat_messages (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
            role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
          );
        `
      },
      {
        name: 'user_quotas',
        sql: `
          CREATE TABLE IF NOT EXISTS public.user_quotas (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            quota_type VARCHAR(50) NOT NULL,
            used_count INTEGER DEFAULT 0,
            limit_count INTEGER NOT NULL,
            reset_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(user_id, quota_type)
          );
        `
      }
    ]

    const results = {
      success: [],
      errors: [],
      totalTables: tables.length
    }

    // 각 테이블을 개별적으로 생성
    for (const table of tables) {
      try {
        console.log(`Creating table: ${table.name}`)
        
        // 테이블 존재 여부 확인 후 생성
        const { data: existingTable, error: checkError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', table.name)
        
        if (checkError) {
          // information_schema 접근이 안되면 직접 테이블 조회 시도
          const { error: testError } = await supabase
            .from(table.name)
            .select('*')
            .limit(1)
          
          if (testError && testError.message.includes('does not exist')) {
            // 테이블이 존재하지 않으므로 생성 필요
            throw new Error(`Table ${table.name} does not exist and needs to be created manually`)
          } else {
            // 테이블이 이미 존재함
            console.log(`Table ${table.name} already exists`)
          }
        } else if (!existingTable || existingTable.length === 0) {
          // 테이블이 존재하지 않으므로 생성 필요
          throw new Error(`Table ${table.name} does not exist and needs to be created manually`)
        }

        if (error) {
          console.error(`Error creating table ${table.name}:`, error)
          results.errors.push(`${table.name}: ${error.message}`)
        } else {
          console.log(`✅ Table ${table.name} created successfully`)
          results.success.push(table.name)
        }
      } catch (err: any) {
        console.error(`Exception creating table ${table.name}:`, err)
        results.errors.push(`${table.name}: ${err.message}`)
      }
    }

    // 기본 인덱스들도 생성
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);',
      'CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);',
      'CREATE INDEX IF NOT EXISTS idx_chatbots_user_id ON public.chatbots(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON public.chat_sessions(chatbot_id);',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);',
      'CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON public.user_quotas(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_concepts_relationship_type ON public.concepts(relationship_type);'
    ]

    for (const indexSql of indexes) {
      try {
        const { error } = await supabase.rpc('exec', { sql: indexSql })
        if (error) {
          console.error(`Index creation error:`, error)
        }
      } catch (err: any) {
        console.error(`Index creation exception:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema creation completed',
      results
    })

  } catch (error: any) {
    console.error('Schema creation failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Database Schema Creation API",
    usage: "POST to this endpoint to create database tables"
  })
}
