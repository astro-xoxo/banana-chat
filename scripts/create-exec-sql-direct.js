const { Client } = require('pg')

async function createExecSqlFunctionDirect() {
  console.log('🔧 PostgreSQL 직접 연결로 exec_sql 함수 생성...')

  // 연결 정보 (CLAUDE.md에서 제공된 정보)
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.tcvtwqjphkqeqpawdfvu',
    password: 'Dkstifhdf1!',
    ssl: { rejectUnauthorized: false }
  })

  try {
    console.log('🔌 PostgreSQL 연결 시도...')
    await client.connect()
    console.log('✅ PostgreSQL 연결 성공!')

    // 1. exec_sql 함수 생성
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`

    console.log('📋 exec_sql 함수 생성 중...')
    await client.query(createFunctionSQL)
    console.log('✅ exec_sql 함수 생성 완료!')

    // 2. 권한 부여
    const grantPermissions = `
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
`

    console.log('🔐 권한 부여 중...')
    await client.query(grantPermissions)
    console.log('✅ 권한 부여 완료!')

    // 3. 함수 생성 확인
    const checkFunction = `
SELECT routine_name, routine_type, security_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name = 'exec_sql';
`

    console.log('🔍 함수 생성 확인 중...')
    const result = await client.query(checkFunction)
    
    if (result.rows.length > 0) {
      console.log('✅ exec_sql 함수 확인됨:', result.rows[0])
      
      // 이제 실제 테이블 생성 SQL 실행
      console.log('\n🚀 이제 실제 테이블 생성을 시작합니다...')
      await createBananaChatTables(client)
      
    } else {
      console.log('❌ exec_sql 함수가 생성되지 않았습니다.')
    }

  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    
    // 연결 문제인 경우 대안 제공
    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 연결 실패 시 대안:')
      console.log('1. Supabase 대시보드 → SQL Editor')
      console.log('2. 다음 SQL을 직접 실행:')
      console.log('\n' + getAllTablesSQL())
    }
  } finally {
    await client.end()
    console.log('🔌 PostgreSQL 연결 종료')
  }
}

async function createBananaChatTables(client) {
  const allTablesSQL = getAllTablesSQL()
  
  try {
    console.log('📊 Banana Chat 테이블 생성 중...')
    await client.query(allTablesSQL)
    console.log('🎉 모든 테이블이 성공적으로 생성되었습니다!')
    
    // 테이블 생성 확인
    const checkTables = `
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('anonymous_sessions', 'chatbots', 'chat_sessions', 'chat_messages', 'generated_images', 'uploaded_images')
ORDER BY table_name;
`
    
    const result = await client.query(checkTables)
    console.log('✅ 생성된 테이블들:', result.rows.map(row => row.table_name))
    
  } catch (error) {
    console.error('❌ 테이블 생성 실패:', error.message)
  }
}

function getAllTablesSQL() {
  return `
-- Banana Chat 스키마 생성
-- 익명 사용자 세션 기반 채팅 서비스

-- 1. 익명 사용자 세션 테이블
CREATE TABLE IF NOT EXISTS anonymous_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- 2. 챗봇 테이블 (사용자가 직접 입력한 값 저장)
CREATE TABLE IF NOT EXISTS chatbots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 1 AND age <= 150),
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    relationship TEXT NOT NULL,
    concept TEXT NOT NULL,
    personality TEXT, -- 프롬프트에서 자동 생성되는 성격
    profile_image_url TEXT, -- NanoBanana API로 생성된 프로필 이미지
    user_uploaded_image_url TEXT, -- 사용자가 업로드한 참고 이미지
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 채팅 세션 테이블
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chatbot_id UUID NOT NULL,
    session_id UUID NOT NULL,
    title VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_session_id UUID NOT NULL,
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    image_url TEXT, -- NanoBanana API로 생성된 채팅 이미지
    image_generation_prompt TEXT, -- 이미지 생성에 사용된 프롬프트
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 생성된 이미지 추적 테이블
CREATE TABLE IF NOT EXISTS generated_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    chatbot_id UUID,
    chat_message_id UUID,
    image_type VARCHAR(20) NOT NULL CHECK (image_type IN ('profile', 'chat')),
    original_prompt TEXT NOT NULL,
    processed_prompt TEXT, -- NanoBanana API에 실제로 전송된 프롬프트
    image_url TEXT NOT NULL,
    storage_path TEXT, -- Supabase Storage 경로
    generation_status VARCHAR(20) DEFAULT 'completed',
    generation_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 업로드된 이미지 관리 테이블
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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_anonymous_sessions_session_id ON anonymous_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbots_session_id ON chatbots(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chatbot_id ON chat_sessions(chatbot_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_session_id ON chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_images_session_id ON generated_images(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_images_session_id ON uploaded_images(session_id);
`
}

// 실행
createExecSqlFunctionDirect()