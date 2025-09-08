'use client'

import { useAnonymousSession } from '@/components/auth/AnonymousProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Chatbot } from '@/types/database'

export default function DashboardPage() {
  console.log('DashboardPage 컴포넌트 시작')
  
  const { session, isLoading, isReady } = useAnonymousSession()
  const router = useRouter()
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // 사용자 세션별 챗봇 데이터 로드
  useEffect(() => {
    if (session?.sessionId && isReady) {
      console.log('Dashboard: 익명 사용자 데이터 로드, 세션:', session.sessionId)
      loadChatbots()
    }
  }, [session, isReady])

  const loadChatbots = async () => {
    if (!session) return
    
    setIsLoadingData(true)
    try {
      const { createSupabaseClient } = await import('@/lib/supabase-client')
      const supabase = createSupabaseClient()
      
      // 익명 세션 ID로 챗봇 조회
      const { data: chatbotsData, error } = await supabase
        .from('chatbots')
        .select('*')
        .eq('session_id', session.sessionId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('챗봇 데이터 로드 오류:', error)
      } else {
        setChatbots(chatbotsData || [])
        console.log('챗봇 데이터 로드 완료:', chatbotsData?.length || 0, '개')
      }
    } catch (error) {
      console.error('챗봇 데이터 로드 중 오류:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleCreateChatbot = () => {
    router.push('/create')
  }

  const handleChatbotClick = (chatbotId: string) => {
    router.push(`/chat/${chatbotId}`)
  }

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-foreground rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-foreground text-sm font-medium">초기화 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-warning rounded-xl flex items-center justify-center">
                <span className="text-inverse font-bold text-sm">B</span>
              </div>
              <h1 className="text-lg font-bold text-foreground">Banana Chat</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-xs text-muted bg-surface-hover px-3 py-2 rounded-xl">
                세션: {session?.sessionId.slice(0, 8)}...
              </div>
              <button
                onClick={() => router.push('/')}
                className="text-sm text-muted hover:text-foreground transition-colors py-2 px-3 rounded-xl hover:bg-surface"
              >
                홈으로
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* 웰컴 메시지 */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              당신의 이상형과 다양한 상황에서 채팅을 해보세요.
            </h2>
            <p className="text-muted">
              나만의 캐릭터를 Nano Banana 로 만들고 채팅해보세요.
            </p>
          </div>

          {/* 새 챗봇 생성 버튼 */}
          <div className="mb-8">
            <button
              onClick={handleCreateChatbot}
              className="w-full bg-warning hover:bg-warning/90 text-inverse font-medium py-4 px-6 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <span className="text-xl">+</span>
              <span>새로운 AI 캐릭터 만들기</span>
            </button>
          </div>

          {/* 챗봇 목록 */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-foreground">내 AI 캐릭터들</h3>
            
            {isLoadingData ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-muted border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-muted">로딩 중...</p>
              </div>
            ) : chatbots.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-3xl">
                <div className="w-16 h-16 bg-interactive-hover rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🤖</span>
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-2">아직 AI 캐릭터가 없어요</h4>
                <p className="text-muted mb-4">첫 번째 AI 캐릭터를 만들어보세요!</p>
                <button
                  onClick={handleCreateChatbot}
                  className="bg-warning hover:bg-warning/90 text-inverse font-medium py-2 px-4 rounded-xl transition-colors"
                >
                  지금 만들기
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {chatbots.map((chatbot) => (
                  <div
                    key={chatbot.id}
                    className="bg-surface border border-border rounded-3xl p-6 hover:shadow-hover transition-all duration-200 cursor-pointer"
                    onClick={() => handleChatbotClick(chatbot.id)}
                  >
                    <div className="flex items-start space-x-4">
                      {chatbot.profile_image_url ? (
                        <img
                          src={chatbot.profile_image_url}
                          alt={chatbot.name}
                          className="w-12 h-12 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-interactive-hover rounded-2xl flex items-center justify-center">
                          <span className="text-xl">🤖</span>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{chatbot.name}</h4>
                        <p className="text-sm text-muted line-clamp-2 mt-1">
                          {chatbot.personality}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}