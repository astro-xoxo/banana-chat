'use client'

import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import type { Chatbot, QuotaInfo } from '@/types/database'
import { useErrorLogger } from '@/lib/errorLogger'
import { usePerformanceMonitor } from '@/lib/performanceMonitor'
import { QuotaGrid } from '@/components/quota/QuotaGrid'
import { QuotaRefreshButton } from '@/components/quota/QuotaRefreshButton'

export default function DashboardPage() {
  console.log('DashboardPage 컴포넌트 시작')
  
  const { user, logout, isLoading } = useAuth()
  console.log('Dashboard useAuth 호출 완료:', { hasUser: !!user, isLoading })
  
  const router = useRouter()
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const hasRedirected = useRef(false)

  // 인증되지 않은 사용자 리다이렉트 (간소화) (ref로 중복 리다이렉트 방지)
  useEffect(() => {
    console.log('Dashboard 리다이렉트 체크:', {
      isLoading,
      hasUser: !!user,
      shouldRedirect: !isLoading && !user
    })
    
    if (!isLoading && !user && !hasRedirected.current) {
      console.log('Dashboard: 로그인 페이지로 리다이렉트 실행')
      hasRedirected.current = true
      router.push('/login')
    }
  }, [user, isLoading])

  // 챗봇 데이터 로드
  useEffect(() => {
    if (user) {
      console.log('Dashboard: 사용자 데이터 로드')
      loadChatbots()
    }
  }, [user])

  const loadChatbots = async () => {
    if (!user) return
    
    setIsLoadingData(true)
    try {
      const { createSupabaseClient } = await import('@/lib/supabase-client')
      const supabase = createSupabaseClient()
      
      const { data: chatbotsData, error } = await supabase
        .from('chatbots')
        .select('*')
        .eq('user_id', user.id)
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

  const handleSignOut = async () => {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-foreground rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-foreground text-sm font-medium">로딩 중...</p>
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
              <div className="w-9 h-9 bg-primary rounded-2xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-foreground truncate">
                <span className="hidden sm:inline">AI Face Chat Lite</span>
                <span className="sm:hidden text-xs">AI Chat</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-interactive-hover flex items-center justify-center">
                  <span className="text-foreground text-xs font-medium">
                    {(user.user_metadata?.name || user.email || '').charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm text-foreground font-semibold truncate max-w-32">
                  {user.user_metadata?.name || user.email}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-interactive-hover text-foreground hover:bg-interactive-active px-2 sm:px-3 py-2 min-h-button-sm rounded-2xl border border-border shadow-sm hover:shadow-hover transition-all duration-200 flex items-center justify-center font-medium"
                title="로그아웃"
              >
                <span className="hidden sm:inline text-sm">로그아웃</span>
                <span className="sm:hidden flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 환영 메시지 */}
          <div className="mb-8">
            <div className="bg-surface rounded-3xl p-6 border border-border">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 leading-tight">
                안녕하세요, <span className="text-success">{user.user_metadata?.name || '사용자'}</span>님! 👋
              </h2>
              <div className="flex items-center justify-between">
                <p className="text-muted text-sm leading-normal">
                  AI 캐릭터와 특별한 대화를 시작해보세요.
                </p>
                <button
                  onClick={() => router.push('/create')}
                  className="text-foreground hover:text-foreground/80 text-sm font-medium underline underline-offset-4 decoration-primary decoration-1 hover:decoration-2 transition-all duration-200 flex items-center whitespace-nowrap ml-4"
                  title="새 캐릭터 만들기"
                >
                  바로 대화시작
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* 이용 현황 - 실시간 API 연동 */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">이용 현황</h3>
              <QuotaRefreshButton />
            </div>
            <QuotaGrid showRefreshButton={false} />
          </div>

          {/* 챗봇 목록 */}
          <div className="bg-surface rounded-3xl p-6 border border-border mb-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                <span className="hidden xs:inline">내 AI 캐릭터</span>
                <span className="xs:hidden">AI 캐릭터</span>
              </h3>
              <button
                onClick={() => router.push('/create')}
                className="bg-primary text-inverse hover:bg-primary/90 px-3 sm:px-4 py-2 min-h-button-sm rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center font-medium"
                title="새 캐릭터 만들기"
              >
                <span className="mr-1 sm:mr-2">✨</span>
                <span className="hidden sm:inline whitespace-nowrap text-xs">새 캐릭터 만들기</span>
                <span className="sm:hidden text-xs">생성</span>
              </button>
            </div>

            {isLoadingData ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-interactive-hover rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
                  <div className="w-6 h-6 border-4 border-foreground border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-foreground text-sm font-medium">로딩 중...</p>
              </div>
            ) : chatbots.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-interactive-hover rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border">
                  <span className="text-2xl">🤖</span>
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">
                  아직 생성된 AI 캐릭터가 없습니다
                </h4>
                <p className="text-muted mb-6 text-sm leading-normal">
                  첫 번째 AI 캐릭터를 만들어 대화를 시작해보세요!
                </p>
                <button
                  onClick={() => router.push('/create')}
                  className="bg-primary text-inverse hover:bg-primary/90 min-h-button px-6 py-3 rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center mx-auto font-medium"
                >
                  <span className="mr-2">✨</span>
                  <span className="text-sm">첫 캐릭터 만들기</span>
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 챗봇 카드들이 여기에 표시됩니다 */}
                {chatbots.map((chatbot, index) => {
                  // 관계 타입에 따른 색상 결정
                  const getRelationshipColor = (relationship: string) => {
                    const lowerRelationship = relationship?.toLowerCase() || '';
                    if (lowerRelationship.includes('연인') || lowerRelationship.includes('남자친구') || lowerRelationship.includes('여자친구') || lowerRelationship.includes('애인')) {
                      return 'lover';
                    } else if (lowerRelationship.includes('친구')) {
                      return 'friend';
                    } else if (lowerRelationship.includes('썸') || lowerRelationship.includes('호감')) {
                      return 'some';
                    } else if (lowerRelationship.includes('가족') || lowerRelationship.includes('형') || lowerRelationship.includes('누나') || lowerRelationship.includes('언니') || lowerRelationship.includes('동생')) {
                      return 'family';
                    } else {
                      return 'default';
                    }
                  };
                  
                  const relationshipColor = getRelationshipColor(chatbot.relationship_type);
                  
                  return (
                    <div
                      key={chatbot.id}
                      className={`group bg-surface border border-border rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:bg-primary hover:border-primary hover:shadow-lg relationship-${relationshipColor}`}
                      onClick={() => router.push(`/chat/${chatbot.id}`)}
                    >
                      <div className="relative mb-4">
                        <div className="w-full h-40 bg-surface rounded-2xl mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform duration-300">
                          {chatbot.profile_image_url ? (
                            <img
                              src={chatbot.profile_image_url}
                              alt={chatbot.name}
                              className="w-full h-full object-cover profile-image-mobile"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-6xl">🤖</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <h4 className="font-bold text-foreground group-hover:text-white text-lg mb-2">{chatbot.name}</h4>
                      <p className="text-muted group-hover:text-white/80 text-sm capitalize font-medium">
                        {chatbot.relationship_type} • {chatbot.gender === 'male' ? '남성' : '여성'}
                      </p>
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-8 h-8 bg-background/80 rounded-full flex items-center justify-center border border-border">
                          <span className="text-foreground text-sm">→</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 안내 정보 */}
          <div className="bg-surface rounded-3xl p-6 border border-border">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center mr-3">
                <span className="text-lg">💡</span>
              </div>
              <h4 className="text-base font-bold text-foreground">이용 안내</h4>
            </div>
            <ul className="text-foreground space-y-2 leading-normal">
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span className="text-sm">프로필 이미지는 평생 1회만 생성할 수 있습니다</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span className="text-sm">채팅 메시지는 24시간마다 10회로 리셋됩니다</span>
              </li>
              <li className="flex items-start">
                <span className="text-primary mr-2 mt-1 text-xs">•</span>
                <span className="text-sm">베타 서비스 기간 동안 무료로 이용 가능합니다</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
