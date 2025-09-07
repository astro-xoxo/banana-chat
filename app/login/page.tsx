'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

export default function LoginPage() {
  const { login, user, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasRedirected = useRef(false)

  // URL에서 에러 메시지 확인
  useEffect(() => {
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')
    
    if (errorParam) {
      if (messageParam) {
        setError(decodeURIComponent(messageParam))
      } else {
        switch (errorParam) {
          case 'oauth_error':
            setError('Google 로그인 중 오류가 발생했습니다.')
            break
          case 'callback_error':
            setError('로그인 처리 중 오류가 발생했습니다.')
            break
          case 'no_code':
            setError('인증 과정에서 문제가 발생했습니다.')
            break
          default:
            setError('로그인 중 오류가 발생했습니다.')
        }
      }
    }
  }, [searchParams])

  // 로그인된 사용자는 대시보드로 리다이렉트 (ref로 중복 리다이렉트 방지)
  useEffect(() => {
    if (!isLoading && user && !hasRedirected.current) {
      console.log('Login Page: 로그인된 사용자 감지, 대시보드로 이동')
      hasRedirected.current = true
      router.push('/dashboard')
    }
  }, [user, isLoading])

  const handleGoogleLogin = async () => {
    try {
      setIsSigningIn(true)
      setError(null)
      
      await login()
      
      // Google OAuth는 페이지 리다이렉트가 일어나므로 여기서 setIsSigningIn(false) 불필요
    } catch (error) {
      console.error('Google Login error:', error)
      setError('Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      setIsSigningIn(false)
    }
  }

  const handleTestLogin = () => {
    // 테스트 로그인 페이지로 이동
    router.push('/simple-login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-muted">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* 로고 및 제목 */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-foreground rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <span className="text-inverse font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">AI Face Chat Lite</h1>
          <p className="text-sm text-muted">AI 캐릭터와 특별한 대화를 시작하세요</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-surface rounded-3xl p-8 shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-6 text-center">
            로그인
          </h2>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-error-light border border-error rounded-2xl p-4 mb-6">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full min-h-button bg-background border border-border hover:border-foreground text-foreground font-medium py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 mb-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-hover"
          >
            {isSigningIn ? (
              <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm">Google 계정으로 로그인</span>
              </>
            )}
          </button>

          {/* 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface text-muted">또는</span>
            </div>
          </div>

          {/* 테스트 로그인 버튼 */}
          <button
            onClick={handleTestLogin}
            className="w-full min-h-button bg-interactive-hover hover:bg-interactive-active text-foreground font-medium py-3 px-6 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-hover"
          >
            <span className="text-sm">테스트 계정으로 로그인</span>
          </button>

          {/* 서비스 정보 */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted leading-normal">
              로그인하면 서비스 이용약관과 개인정보처리방침에 동의하게 됩니다.
            </p>
          </div>
        </div>

        {/* 하단 링크 */}
        <div className="text-center mt-6">
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
