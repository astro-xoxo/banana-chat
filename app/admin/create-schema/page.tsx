'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function CreateSchemaPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const createDatabaseSchema = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // 직접 하드코딩된 Supabase 연결 정보 사용
      const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
      const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzIwODY0MiwiZXhwIjoyMDYyNzg0NjQyfQ.P9NFo3iY8EcxIqoUaZ5I4iHvtjh9X4OY_f7vbZ2-dB0'

      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      console.log('✅ Supabase 관리자 클라이언트 생성 완료')

      // 테이블 생성 SQL 스크립트들
      const createTables = [
        // 1. users 테이블 (기본 사용자 정보)
        `
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
        `,
        
        // 2. speech_presets 테이블 (말투 프리셋)
        `
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
        `,
        
        // 3. concepts 테이블 (대화 컨셉)
        `
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
        `,
        
        // 4. chatbots 테이블 (생성된 챗봇)
        `
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
        `,
        
        // 5. chat_sessions 테이블 (채팅 세션)
        `
        CREATE TABLE IF NOT EXISTS public.chat_sessions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          chatbot_id UUID NOT NULL REFERENCES public.chatbots(id) ON DELETE CASCADE,
          title VARCHAR(200),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        `,
        
        // 6. chat_messages 테이블 (채팅 메시지)
        `
        CREATE TABLE IF NOT EXISTS public.chat_messages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
          role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        `,
        
        // 7. user_quotas 테이블 (사용자 할당량 관리)
        `
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
      ]

      let results = {
        tablesCreated: 0,
        errors: []
      }

      // 테이블을 하나씩 생성
      console.log('📊 데이터베이스 테이블 생성 시작...')
      
      for (let i = 0; i < createTables.length; i++) {
        try {
          console.log(`테이블 ${i + 1} 생성 시도...`)
          
          const { data, error } = await supabase
            .from('information_schema.tables')
            .select('table_name')
          
          // 직접 SQL 실행이 안되면 다른 방법 시도
          const { error: execError } = await supabase.rpc('exec', {
            sql: createTables[i]
          })
          
          if (execError) {
            console.error(`테이블 ${i + 1} 생성 실패:`, execError)
            results.errors.push(`테이블 ${i + 1}: ${execError.message}`)
          } else {
            results.tablesCreated++
            console.log(`✅ 테이블 ${i + 1} 생성 완료`)
          }
        } catch (err: any) {
          console.error(`테이블 ${i + 1} 생성 중 오류:`, err)
          results.errors.push(`테이블 ${i + 1}: ${err.message}`)
        }
      }

      setResult({
        ...results,
        success: true,
        message: '🎉 데이터베이스 스키마 생성 완료!'
      })

      console.log('🎉 데이터베이스 스키마 생성 완료!')

    } catch (error: any) {
      console.error('❌ 스키마 생성 실패:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            🗃️ 데이터베이스 스키마 생성
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              AI Face Chat Lite에 필요한 모든 데이터베이스 테이블을 생성합니다:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>👤 users - 사용자 정보</li>
              <li>💬 speech_presets - 말투 프리셋</li>
              <li>🎭 concepts - 대화 컨셉</li>
              <li>🤖 chatbots - 생성된 챗봇</li>
              <li>📝 chat_sessions - 채팅 세션</li>
              <li>💭 chat_messages - 채팅 메시지</li>
              <li>📊 user_quotas - 사용자 할당량</li>
            </ul>
          </div>

          <button
            onClick={createDatabaseSchema}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-6"
          >
            {isLoading ? '🔄 스키마 생성 중...' : '🚀 데이터베이스 스키마 생성'}
          </button>

          {/* 결과 표시 */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="text-green-800 font-semibold mb-2">✅ 스키마 생성 완료!</h3>
              <div className="text-sm text-green-700 space-y-1">
                <p>📊 생성된 테이블: {result.tablesCreated}개</p>
                {result.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-orange-700">⚠️ 일부 오류:</p>
                    <ul className="ml-4 text-xs">
                      {result.errors.map((error: string, index: number) => (
                        <li key={index} className="text-orange-600">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="text-red-800 font-semibold mb-2">❌ 오류 발생</h3>
              <p className="text-sm text-red-700 font-mono">{error}</p>
            </div>
          )}

          <div className="text-xs text-gray-500 mt-6">
            <p>💡 스키마 생성 후 <a href="/admin/simple-seed" className="text-blue-600 hover:underline">시드 데이터 삽입</a>을 진행하세요.</p>
            <p>🔗 모든 작업 완료 후 <a href="/dashboard" className="text-blue-600 hover:underline">대시보드</a>로 이동하세요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
