'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TableTestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testTablesAndCreate = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const supabaseUrl = 'https://thnboxxfxahwkawzgcjj.supabase.co'
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobmJveHhmeGFod2thd3pnY2pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMDg2NDIsImV4cCI6MjA2Mjc4NDY0Mn0.vCWeqm7nV3v1MfNLjJWUtME_JYkMM4IfZ8dLk_sVTqM'

      const supabase = createClient(supabaseUrl, supabaseAnonKey)

      console.log('✅ Supabase 클라이언트 생성 완료')

      const tableTests = [
        'users',
        'speech_presets', 
        'concepts',
        'chatbots',
        'chat_sessions',
        'chat_messages',
        'user_quotas'
      ]

      const results = {
        existing: [],
        missing: [],
        errors: []
      }

      // 각 테이블 존재 여부 확인
      for (const tableName of tableTests) {
        try {
          console.log(`Testing table: ${tableName}`)
          
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)

          if (error) {
            if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
              console.log(`❌ Table ${tableName} does not exist`)
              results.missing.push(tableName)
            } else {
              console.log(`⚠️ Table ${tableName} access error:`, error.message)
              results.errors.push(`${tableName}: ${error.message}`)
            }
          } else {
            console.log(`✅ Table ${tableName} exists`)
            results.existing.push(tableName)
          }
        } catch (err: any) {
          console.error(`Exception testing table ${tableName}:`, err)
          results.errors.push(`${tableName}: ${err.message}`)
        }
      }

      setResult({
        ...results,
        success: true,
        message: 'Table existence check completed',
        needsManualCreation: results.missing.length > 0
      })

      console.log('🎉 테이블 존재 여부 확인 완료!')

    } catch (error: any) {
      console.error('❌ 테이블 테스트 실패:', error)
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
            🔍 데이터베이스 테이블 확인
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              현재 Supabase 데이터베이스에 어떤 테이블이 존재하는지 확인합니다:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>👤 users</li>
              <li>💬 speech_presets</li>
              <li>🎭 concepts</li>
              <li>🤖 chatbots</li>
              <li>📝 chat_sessions</li>
              <li>💭 chat_messages</li>
              <li>📊 user_quotas</li>
            </ul>
          </div>

          <button
            onClick={testTablesAndCreate}
            disabled={isLoading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors mb-6"
          >
            {isLoading ? '🔄 테이블 확인 중...' : '🔍 테이블 존재 여부 확인'}
          </button>

          {/* 결과 표시 */}
          {result && (
            <div className={`border rounded-lg p-4 mb-4 ${result.needsManualCreation ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
              <h3 className={`font-semibold mb-2 ${result.needsManualCreation ? 'text-yellow-800' : 'text-green-800'}`}>
                {result.needsManualCreation ? '⚠️ 테이블 생성 필요' : '✅ 테이블 확인 완료'}
              </h3>
              <div className="text-sm space-y-2">
                {result.existing.length > 0 && (
                  <div>
                    <p className="font-medium text-green-700">✅ 존재하는 테이블 ({result.existing.length}개):</p>
                    <p className="text-green-600 ml-4">{result.existing.join(', ')}</p>
                  </div>
                )}
                
                {result.missing.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700">❌ 누락된 테이블 ({result.missing.length}개):</p>
                    <p className="text-red-600 ml-4">{result.missing.join(', ')}</p>
                  </div>
                )}
                
                {result.errors.length > 0 && (
                  <div>
                    <p className="font-medium text-orange-700">⚠️ 오류 발생:</p>
                    <ul className="ml-4 text-xs text-orange-600">
                      {result.errors.map((error: string, index: number) => (
                        <li key={index}>{error}</li>
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

          {/* 가이드 */}
          {result && result.needsManualCreation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-blue-800 font-semibold mb-2">📋 수동 생성 가이드</h3>
              <div className="text-sm text-blue-700 space-y-2">
                <p>누락된 테이블이 있습니다. 다음 단계를 따라 수동으로 생성하세요:</p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>Supabase 대시보드에 로그인</li>
                  <li>SQL Editor 로 이동</li>
                  <li><code>/database/schema.sql</code> 파일의 SQL 실행</li>
                  <li>완료 후 다시 이 페이지에서 확인</li>
                </ol>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 mt-6">
            <p>💡 모든 테이블이 확인되면 <a href="/admin/simple-seed" className="text-blue-600 hover:underline">시드 데이터 삽입</a>을 진행하세요.</p>
            <p>📄 SQL 스크립트: <code>database/schema.sql</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}
