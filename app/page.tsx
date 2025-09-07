'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted text-sm">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 - 모바일 최적화 */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-primary rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">
                <span className="hidden sm:inline">AI Face Chat Lite</span>
                <span className="sm:hidden text-xs">AI Chat</span>
              </h1>
            </div>
            
            <button
              onClick={() => router.push('/login')}
              className="bg-black text-white hover:bg-black/90 px-3 sm:px-4 py-2 min-h-button-sm rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center font-medium text-sm"
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
              당신만의 AI 캐릭터와<br className="xs:hidden" />
              <span className="xs:inline"> </span><span style={{ color: '#10B981' }}>특별한 대화</span>를 나누세요
            </h2>
            <p className="text-muted text-sm leading-normal mb-6 max-w-2xl mx-auto">
              당신의 얼굴을 AI로 합성하여 만든 맞춤형 캐릭터와 함께<br className="hidden sm:block" />
              <span className="sm:hidden"> </span><span className="font-medium text-foreground">연인, 친구, 썸, 가족</span>의 관계로 다양한 대화를 경험해보세요.
            </p>
            
            <button
              onClick={() => router.push('/login')}
              className="bg-primary text-inverse hover:bg-primary/90 px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 font-medium text-sm"
            >
              무료로 시작하기 →
            </button>
          </div>

          {/* 주요 기능 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎭</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI 얼굴 합성</h3>
              <p className="text-sm text-muted leading-normal">
                당신의 사진을 업로드하면 AI가 <span className="font-medium text-primary">8가지 스타일</span>의
                맞춤형 캐릭터 이미지를 생성합니다.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">관계별 맞춤 대화</h3>
              <p className="text-sm text-muted leading-normal">
                <span className="font-medium text-secondary">연인, 친구, 썸, 가족</span> 등 4가지 관계와
                <span className="font-medium text-primary">16가지 상황별</span> 대화를 경험할 수 있습니다.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎨</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">다양한 말투</h3>
              <p className="text-sm text-muted leading-normal">
                <span className="font-medium text-success">친근한, 정중한, 편안한, 귀여운, 성숙한</span><br className="hidden sm:block" />
                <span className="sm:hidden"> </span>5가지 말투로 개성 있는 대화를 나누세요.
              </p>
            </div>
          </div>

          {/* CTA 섹션 */}
          <div className="bg-surface rounded-3xl text-foreground mb-8 p-6 border border-border">
            <div className="text-center">
              <h3 className="text-xl font-bold mb-2">
                지금 바로 시작해보세요! ✨
              </h3>
              <p className="text-muted mb-6 text-sm leading-normal">
                <span className="font-medium">베타 서비스 기간</span> 동안 무료로 이용 가능합니다.<br className="hidden sm:block" />
                <span className="sm:hidden"> </span>나만의 AI 캐릭터와 특별한 대화를 경험해보세요.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="bg-background text-foreground border border-border px-6 py-3 rounded-2xl text-sm font-medium hover:bg-surface hover:border-border-strong transition-colors shadow-sm"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="whitespace-nowrap">Google 계정으로 시작하기</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-surface py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="bg-surface border border-border rounded-3xl mb-6 p-6">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center mr-3">
                <span className="text-lg">💡</span>
              </div>
              <h4 className="text-base font-bold text-foreground">이용 안내</h4>
            </div>
            <ul className="text-foreground space-y-2 leading-normal text-left text-sm">
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span>프로필 이미지는 평생 1회만 생성할 수 있습니다</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span>채팅 메시지는 24시간마다 10회로 리셋됩니다</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span>베타 서비스 기간 동안 무료로 이용 가능합니다</span>
              </li>
            </ul>
          </div>
          
          <div className="text-muted text-sm">
            <p>&copy; 2025 AI Face Chat Lite. All rights reserved.</p>
            <p className="mt-2 text-xs">베타 서비스 | 개인정보처리방침 | 이용약관</p>
          </div>
        </div>
      </footer>
    </div>
  )
}