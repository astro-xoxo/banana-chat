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
          <p className="text-muted text-sm">Initializing...</p>
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
              Get Started
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
              Chat with your ideal character in various situations <span style={{ color: '#FFB805' }}>anytime, anywhere.</span>
            </h2>
            <p className="text-muted text-sm leading-normal mb-6 max-w-2xl mx-auto">
              Create your dream character with NanoBanana and enjoy vivid visual chats in various situations.
            </p>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-warning text-inverse hover:bg-warning/90 px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 font-medium text-sm"
            >
              Start Now →
            </button>
          </div>

          {/* 주요 기능 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🚀</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Instant Start</h3>
              <p className="text-sm text-muted leading-normal">
                Start chatting with AI characters instantly <span className="font-medium text-warning">without registration or login</span>, using just your browser.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">AI Image Generation</h3>
              <p className="text-sm text-muted leading-normal">
                Create custom character profiles and chat images using <span className="font-medium text-warning">NanoBanana AI</span> technology.
              </p>
            </div>

            <div className="bg-surface rounded-3xl p-6 border border-border sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💬</span>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Free Unlimited Chat</h3>
              <p className="text-sm text-muted leading-normal">
                Enjoy natural conversations with AI <span className="font-medium text-warning">completely free with no limits</span>.
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
            <p className="mt-2 text-xs">Privacy Policy | Terms of Service</p>
          </div>
        </div>
      </footer>
    </div>
  )
}