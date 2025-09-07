'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createSupabaseClient } from '@/lib/supabase-client'

export default function SimpleLoginPage() {
  const { user, isLoading, login } = useAuth()
  const router = useRouter()
  
  // Supabase 클라이언트 메모이제이션
  const supabase = useMemo(() => createSupabaseClient(), [])
  
  const [email, setEmail] = useState('test@test.com')
  const [password, setPassword] = useState('testpassword')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasRedirected = useRef(false)

  // 로그인된 사용자는 대시보드로 리다이렉트 (ref로 중복 리다이렉트 방지)
  useEffect(() => {
    if (!isLoading && user && !hasRedirected.current) {
      console.log('Simple Login: 로그인된 사용자 감지, 대시보드로 이동')
      hasRedirected.current = true
      router.push('/dashboard')
    }
  }, [user, isLoading])

  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSigningIn(true)
      setError(null)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('로그인 정보가 올바르지 않습니다.')
        } else {
          setError(error.message)
        }
        return
      }

      // 성공 시 대시보드로 리다이렉트 (AuthProvider에서 자동 처리)
      console.log('로그인 성공:', data.user?.email)
      
    } catch (error: any) {
      console.error('Login error:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsSigningIn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted text-sm">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 로고 및 제목 */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-inverse font-bold text-lg">A</span>
          </div>
          <h1 className="text-lg font-bold text-foreground mb-1">테스트 로그인</h1>
          <p className="text-muted text-sm">개발 테스트용 간편 로그인</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-surface rounded-3xl p-6 shadow-sm border border-border">
          <form onSubmit={handleTestLogin}>
            {/* 에러 메시지 */}
            {error && (
              <div className="bg-error-light border border-error rounded-2xl p-4 mb-4">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-interactive-hover border border-border rounded-2xl p-4 mb-4">
              <p className="text-foreground text-sm">
                <strong>테스트 계정:</strong><br />
                이메일: test@test.com<br />
                비밀번호: testpassword
              </p>
            </div>

            {/* 이메일 입력 */}
            <div className="mb-3">
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                이메일
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-input px-4 py-3 border border-border rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm shadow-sm transition-all duration-200"
                required
              />
            </div>

            {/* 비밀번호 입력 */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-input px-4 py-3 border border-border rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm shadow-sm transition-all duration-200"
                required
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full bg-warning hover:bg-warning/90 disabled:bg-muted disabled:cursor-not-allowed text-inverse font-medium min-h-button px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 mb-4"
            >
              {isSigningIn ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">로그인 중...</span>
                </div>
              ) : (
                <span className="text-sm">테스트 로그인</span>
              )}
            </button>
          </form>

          {/* 구분선 */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-muted">또는</span>
            </div>
          </div>

          {/* Google 로그인으로 돌아가기 */}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full bg-interactive-hover hover:bg-interactive-active text-foreground font-medium min-h-button px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200"
          >
            <span className="text-sm">Google 로그인으로 돌아가기</span>
          </button>
        </div>

        {/* 하단 링크 */}
        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/')}
            className="text-muted hover:text-foreground text-sm transition-colors py-2 px-4 rounded-2xl hover:bg-surface"
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
