const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://tcvtwqjphkqeqpawdfvu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnR3cWpwaGtxZXFwYXdkZnZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIzNDEwMSwiZXhwIjoyMDcyODEwMTAxfQ.0XQuW0jT324m_WUtIQJKRSbr4p3su6W-OhBLAGRumMA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTableStructure() {
  console.log('🔍 anonymous_sessions 테이블 구조 확인...\n')
  
  try {
    // 1. 샘플 데이터 조회로 컬럼 구조 파악
    const { data, error } = await supabase
      .from('anonymous_sessions')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ 테이블 구조 조회 실패:', error)
    } else {
      console.log('✅ 테이블 컬럼 구조:')
      if (data && data.length > 0) {
        Object.keys(data[0]).forEach(column => {
          console.log(`   - ${column}: ${typeof data[0][column]}`)
        })
        console.log('\n📋 샘플 데이터:', data[0])
      } else {
        console.log('   (빈 테이블 - 컬럼 구조를 확인할 수 없음)')
      }
    }

    // 2. INSERT 테스트 시도
    console.log('\n🧪 INSERT 테스트 시도...')
    const testSessionId = 'test-' + Date.now()
    const { data: insertData, error: insertError } = await supabase
      .from('anonymous_sessions')
      .insert({
        session_id: testSessionId,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })
      .select()
    
    if (insertError) {
      console.error('❌ INSERT 테스트 실패:', insertError)
      console.error('   상세:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      })
    } else {
      console.log('✅ INSERT 테스트 성공:', insertData)
      
      // 테스트 데이터 정리
      await supabase
        .from('anonymous_sessions')
        .delete()
        .eq('session_id', testSessionId)
      console.log('🗑️ 테스트 데이터 정리 완료')
    }

  } catch (error) {
    console.error('❌ 테이블 구조 확인 중 오류:', error)
  }
}

checkTableStructure()
  .then(() => console.log('\n✅ 테이블 구조 확인 완료'))
  .catch(err => console.error('❌ 실행 실패:', err))