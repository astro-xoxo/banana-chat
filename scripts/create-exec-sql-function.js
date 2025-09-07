const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://tcvtwqjphkqeqpawdfvu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnR3cWpwaGtxZXFwYXdkZnZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIzNDEwMSwiZXhwIjoyMDcyODEwMTAxfQ.0XQuW0jT324m_WUtIQJKRSbr4p3su6W-OhBLAGRumMA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createExecSqlFunction() {
  console.log('🔧 exec_sql RPC 함수 생성 시작...')

  // REST API로 직접 함수 생성 시도
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

-- 권한 부여
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
`

  try {
    console.log('📋 REST API를 통한 함수 생성 시도...')
    
    // curl 명령어로 직접 실행
    const { spawn } = require('child_process')
    
    const curlCommand = [
      '-X', 'POST',
      'https://tcvtwqjphkqeqpawdfvu.supabase.co/rest/v1/rpc/exec',
      '-H', `Authorization: Bearer ${supabaseServiceKey}`,
      '-H', `apikey: ${supabaseServiceKey}`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ query: createFunctionSQL })
    ]

    console.log('🚀 curl 명령어 실행 중...')
    
    const curl = spawn('curl', curlCommand)
    
    let output = ''
    let errorOutput = ''
    
    curl.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    curl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    curl.on('close', (code) => {
      console.log('📤 curl 실행 완료, 코드:', code)
      console.log('📋 응답:', output)
      if (errorOutput) {
        console.log('⚠️ 오류:', errorOutput)
      }
      
      // Admin API로 스키마 재실행
      console.log('\n🔄 이제 Admin API로 스키마 적용을 재시도합니다...')
      retrySchemaApplication()
    })
    
  } catch (error) {
    console.error('❌ 함수 생성 실패:', error)
  }
}

async function retrySchemaApplication() {
  try {
    console.log('🔄 Admin API로 스키마 적용 재시도...')
    
    const { spawn } = require('child_process')
    
    const curlCommand = [
      '-X', 'POST',
      'http://localhost:3000/api/admin/apply-banana-schema',
      '-H', 'Content-Type: application/json',
      '-d', '{}'
    ]
    
    const curl = spawn('curl', curlCommand)
    
    let output = ''
    
    curl.stdout.on('data', (data) => {
      output += data.toString()
    })
    
    curl.on('close', (code) => {
      console.log('📋 Admin API 재실행 결과:', output)
      
      if (output.includes('"success":true')) {
        console.log('✅ 스키마 적용 성공!')
        console.log('🎉 이제 Supabase 대시보드에서 테이블들을 확인할 수 있습니다!')
      } else {
        console.log('⚠️ 여전히 문제가 있을 수 있습니다. Supabase 대시보드에서 수동으로 확인해주세요.')
      }
    })
    
  } catch (error) {
    console.error('❌ Admin API 재실행 실패:', error)
  }
}

// 실행
createExecSqlFunction()