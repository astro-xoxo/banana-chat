const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://tcvtwqjphkqeqpawdfvu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnR3cWpwaGtxZXFwYXdkZnZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIzNDEwMSwiZXhwIjoyMDcyODEwMTAxfQ.0XQuW0jT324m_WUtIQJKRSbr4p3su6W-OhBLAGRumMA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createTables() {
  console.log('🔧 Banana Chat 테이블 생성 시작...')

  try {
    // RPC 함수로 SQL 실행 시도
    const sqlCommands = [
      // 1. anonymous_sessions 테이블
      `CREATE TABLE IF NOT EXISTS anonymous_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        ip_address INET
      );`,
      
      // 2. chatbots 테이블
      `CREATE TABLE IF NOT EXISTS chatbots (
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
      );`,
      
      // 3. chat_sessions 테이블
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chatbot_id UUID NOT NULL,
        session_id UUID NOT NULL,
        title VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      
      // 4. chat_messages 테이블
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_session_id UUID NOT NULL,
        session_id UUID NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        image_url TEXT,
        image_generation_prompt TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      
      // 5. generated_images 테이블
      `CREATE TABLE IF NOT EXISTS generated_images (
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
      );`,
      
      // 6. uploaded_images 테이블
      `CREATE TABLE IF NOT EXISTS uploaded_images (
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
      );`
    ]

    // Supabase는 직접 DDL 실행을 지원하지 않으므로 SQL Editor 사용 안내
    console.log('\n⚠️ Supabase JavaScript SDK는 직접 테이블 생성을 지원하지 않습니다.')
    console.log('\n📝 다음 단계를 따라주세요:')
    console.log('1. Supabase 대시보드 (https://supabase.com/dashboard) 로그인')
    console.log('2. 프로젝트 선택 (tcvtwqjphkqeqpawdfvu)')
    console.log('3. 왼쪽 메뉴에서 "SQL Editor" 클릭')
    console.log('4. 아래 SQL을 복사하여 실행:\n')
    
    console.log('='.repeat(60))
    console.log('-- Banana Chat 스키마')
    console.log('='.repeat(60))
    
    sqlCommands.forEach((sql, index) => {
      console.log(`\n-- ${index + 1}번 테이블`)
      console.log(sql)
    })
    
    console.log('\n='.repeat(60))
    console.log('\n✅ Storage 버킷은 이미 생성 완료되었습니다!')
    console.log('   - user-uploads')
    console.log('   - generated-images')
    console.log('   - temp-files')

  } catch (error) {
    console.error('❌ 오류 발생:', error)
  }
}

// 실행
createTables()