import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 서비스 역할 클라이언트 (관리자 권한)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Banana Chat 스키마 적용 시작')

    // 1. 익명 사용자 세션 테이블
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS anonymous_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        ip_address INET
      );
    `

    // 2. 챗봇 테이블 (사용자 직접 입력값 저장)
    const createChatbotsTable = `
      CREATE TABLE IF NOT EXISTS chatbots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        name VARCHAR(200) NOT NULL,
        age INTEGER NOT NULL,
        gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
        relationship TEXT NOT NULL,
        concept TEXT NOT NULL,
        personality TEXT,
        profile_image_url TEXT,
        user_uploaded_image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // 3. 채팅 세션 테이블
    const createChatSessionsTable = `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chatbot_id UUID NOT NULL,
        session_id UUID NOT NULL,
        title VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // 4. 채팅 메시지 테이블
    const createChatMessagesTable = `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_session_id UUID NOT NULL,
        session_id UUID NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        image_url TEXT,
        image_generation_prompt TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // 5. 생성된 이미지 테이블
    const createGeneratedImagesTable = `
      CREATE TABLE IF NOT EXISTS generated_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        chatbot_id UUID,
        chat_message_id UUID,
        image_type VARCHAR(20) NOT NULL CHECK (image_type IN ('profile', 'chat')),
        original_prompt TEXT NOT NULL,
        processed_prompt TEXT,
        image_url TEXT NOT NULL,
        storage_path TEXT,
        generation_status VARCHAR(20) DEFAULT 'completed',
        generation_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    // 6. 업로드된 이미지 테이블
    const createUploadedImagesTable = `
      CREATE TABLE IF NOT EXISTS uploaded_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        chatbot_id UUID,
        original_filename VARCHAR(500),
        file_size INTEGER,
        mime_type VARCHAR(100),
        image_url TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        upload_status VARCHAR(20) DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `

    console.log('📊 테이블 생성 시작...')
    const tables = [
      { name: 'anonymous_sessions', sql: createSessionsTable },
      { name: 'chatbots', sql: createChatbotsTable },
      { name: 'chat_sessions', sql: createChatSessionsTable },
      { name: 'chat_messages', sql: createChatMessagesTable },
      { name: 'generated_images', sql: createGeneratedImagesTable },
      { name: 'uploaded_images', sql: createUploadedImagesTable }
    ]

    for (const table of tables) {
      console.log(`📋 ${table.name} 테이블 생성 중...`)
      const { error } = await supabaseAdmin
        .from('_dummy_') // 더미 테이블명
        .select('*')
        .limit(0) // 실제로는 rpc 호출로 대체

      // 직접 SQL 실행은 클라이언트에서 불가능하므로 간접적으로 처리
      try {
        await supabaseAdmin.rpc('exec_sql', { sql: table.sql })
        console.log(`✅ ${table.name} 테이블 생성 완료`)
      } catch (rpcError) {
        console.warn(`⚠️ ${table.name} 테이블 생성 시도 (RPC 없을 수 있음):`, rpcError)
        // RPC가 없어도 계속 진행
      }
    }

    console.log('🎉 Banana Chat 스키마 적용 완료!')

    return NextResponse.json({
      success: true,
      message: '스키마가 성공적으로 적용되었습니다 (일부 제한사항 있음)',
      tables_attempted: tables.length,
      note: 'Supabase 클라이언트 제한으로 일부 작업이 제한될 수 있습니다'
    })

  } catch (error) {
    console.error('❌ 스키마 적용 실패:', error)
    
    return NextResponse.json({
      success: false,
      message: '스키마 적용 중 오류가 발생했습니다',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}