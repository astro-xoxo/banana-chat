'use client'

import { useAnonymousSession } from '@/components/auth/AnonymousProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { session, isLoading, isReady } = useAnonymousSession()
  const router = useRouter()

  // 자동 리디렉션 제거 - 사용자가 선택할 수 있도록 함
  // useEffect(() => {
  //   if (isReady && session) {
  //     router.push('/dashboard')
  //   }
  // }, [session, isReady, router])

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted text-sm">초기화 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-warning rounded-2xl flex items-center justify-center">
                <span className="text-inverse font-bold text-lg">B</span>
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">
                <span className="hidden sm:inline">Banana Chat</span>
                <span className="sm:hidden text-xs">Banana</span>
              </h1>
            </div>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-warning text-inverse hover:bg-warning/90 px-3 sm:px-4 py-2 min-h-button-sm rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center font-medium text-sm"
            >
              시작하기
            </button>
          </div>
        </div>
      </header>

      {/* 메인 섹션 */}
      <main className="container mx-auto px-4 py-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* 히어로 섹션 */}
          <div className="mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 leading-tight">
              당신의 이상형과 다양한 상황에서 <span style={{ color: '#FF7A59' }}>채팅을 해보세요.</span>
            </h2>
            <p className="text-muted text-sm leading-normal mb-6 max-w-2xl mx-auto">
              Nano Banana 로 당신이 꿈꾸던 이상형을 만들고 다양한 상황에서 생동감 있는 비쥬얼 채팅을 진행 할 수 있습니다.
            </p>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-warning text-inverse hover:bg-warning/90 px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 font-medium text-sm"
            >
              바로 시작하기 →
            </button>
          </div>

          {/* 주요 기능 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">즉시 시작</h3>
              <p className="text-sm text-muted leading-normal">
                <span className="font-medium text-warning">회원가입이나 로그인 없이</span> 브라우저만으로
                바로 AI 캐릭터와 대화를 시작할 수 있습니다.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI 이미지 생성</h3>
              <p className="text-sm text-muted leading-normal">
                <span className="font-medium text-warning">NanoBanana AI</span>를 사용해
                나만의 캐릭터 프로필과 대화 중 이미지를 생성할 수 있습니다.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">자유로운 채팅</h3>
              <p className="text-sm text-muted leading-normal">
                <span className="font-medium text-warning">제한 없이 무료로</span><br className="hidden sm:block" />
                <span className="sm:hidden"> </span>AI와 자연스러운 대화를 나누세요.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-surface py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="text-muted text-sm">
            <p>&copy; 2025 Banana Chat. All rights reserved.</p>
            <p className="mt-2 text-xs">개인정보처리방침 | 이용약관</p>
          </div>
        </div>
      </footer>
    </div>
  )
}