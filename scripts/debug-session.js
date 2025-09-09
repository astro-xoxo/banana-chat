const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://tcvtwqjphkqeqpawdfvu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnR3cWpwaGtxZXFwYXdkZnZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIzNDEwMSwiZXhwIjoyMDcyODEwMTAxfQ.0XQuW0jT324m_WUtIQJKRSbr4p3su6W-OhBLAGRumMA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugSession() {
  // 테스트용 UUID 생성
  const testSessionId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  
  console.log('🔍 세션 디버깅 시작...\n')
  console.log('테스트 세션 ID:', testSessionId)
  
  // 1. 기존 세션 조회 테스트
  console.log('\n1️⃣ 기존 세션 조회 테스트')
  try {
    const { data: existingSessions, error: selectError } = await supabase
      .from('anonymous_sessions')
      .select('*')
      .eq('session_id', testSessionId)
    
    if (selectError) {
      console.log('❌ 조회 오류:', selectError)
    } else {
      console.log('✅ 조회 성공:', existingSessions?.length || 0, '개 발견')
    }
  } catch (err) {
    console.log('❌ 조회 예외:', err.message)
  }
  
  // 2. 새 세션 생성 테스트
  console.log('\n2️⃣ 새 세션 생성 테스트')
  try {
    const { data: newSession, error: insertError } = await supabase
      .from('anonymous_sessions')
      .insert({
        session_id: testSessionId,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        user_agent: 'TEST_AGENT',
        ip_address: '127.0.0.1'
      })
      .select()
    
    if (insertError) {
      console.log('❌ 생성 오류:', insertError)
    } else {
      console.log('✅ 생성 성공:', newSession)
    }
  } catch (err) {
    console.log('❌ 생성 예외:', err.message)
  }
  
  // 3. 세션 권한 확인 테스트
  console.log('\n3️⃣ 세션 권한 확인')
  try {
    const { data: allSessions, error: permError } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id, created_at')
      .limit(3)
    
    if (permError) {
      console.log('❌ 권한 오류:', permError)
    } else {
      console.log('✅ 권한 확인:', allSessions?.length || 0, '개 조회 가능')
    }
  } catch (err) {
    console.log('❌ 권한 예외:', err.message)
  }
  
  // 4. 테스트 세션 정리
  console.log('\n4️⃣ 테스트 세션 정리')
  try {
    const { error: deleteError } = await supabase
      .from('anonymous_sessions')
      .delete()
      .eq('session_id', testSessionId)
    
    if (deleteError) {
      console.log('⚠️ 정리 오류:', deleteError)
    } else {
      console.log('✅ 정리 완료')
    }
  } catch (err) {
    console.log('⚠️ 정리 예외:', err.message)
  }
}

debugSession()
  .then(() => console.log('\n✅ 세션 디버깅 완료'))
  .catch(err => console.error('❌ 세션 디버깅 실패:', err))