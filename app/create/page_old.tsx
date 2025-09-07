'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase-client'
import { authenticatedFetch } from '@/lib/auth-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Clock, Loader2, Home, MessageSquare, RotateCcw, ArrowLeft } from 'lucide-react'
import CharacterCreationWizard from '@/components/character/CharacterCreationWizard'
import ProfileThumbnail from '@/components/ui/ProfileThumbnail'

type CreateStep = 'character' | 'processing' | 'complete' | 'error'

interface ProcessingState {
  stage: 'uploading' | 'generating' | 'saving' | 'complete'
  message: string
  progress: number
}

export default function CreatePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<CreateStep>('character')
  const [wizardStep, setWizardStep] = useState<number>(0) // 7단계 위자드의 현재 단계

  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [chatbotName, setChatbotName] = useState<string>('')
  const [processingState, setProcessingState] = useState<ProcessingState>({
    stage: 'uploading',
    message: '처리 중...',
    progress: 0
  })
  const [generatedChatbotId, setGeneratedChatbotId] = useState<string | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [user, setUser] = useState<any>(null)

  // 사용자 인증 확인
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      
      // 프로필 이미지 쿼터 확인
      const { data: userData } = await supabase
        .from('users')
        .select('profile_image_used')
        .eq('id', session.user.id)
        .single()
      
      if (userData?.profile_image_used) {
        setCurrentStep('error')
        setErrorMessage('프로필 이미지 생성 쿼터를 이미 사용하셨습니다. (1회 제한)')
      }
    }
    
    checkUser()
  }, [router])
  
  const handleCharacterCreationComplete = async (
    age: number,
    gender: 'male' | 'female',
    relationship: string,
    concept: string,
    name: string,
    imageUrl: string
  ) => {
    console.log('캐릭터 생성 완료:', { age, gender, relationship, concept, name })
    
    setChatbotName(name)
    setUploadedImageUrl(imageUrl)
    
    // AI 이미지 생성 시작
    await startAIGeneration({
      age,
      gender,
      relationship,
      concept,
      name,
      imageUrl
    })
  }
    
  const startAIGeneration = async (characterData: {
    age: number
    gender: 'male' | 'female'
    relationship: string
    concept: string
    name: string
    imageUrl: string
  }) => {
    if (!user) return
    
    setCurrentStep('processing')
    
    try {
      // 1단계: AI 이미지 생성
      setProcessingState({
        stage: 'generating',
        message: 'AI가 당신의 캐릭터를 생성하고 있습니다... (최대 2분)',
        progress: 30
      })

      // Supabase 클라이언트를 사용한 인증 확인
      const supabase = createSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('인증 세션이 만료되었습니다. 다시 로그인해주세요.')
      }

      // 타임아웃 설정 (4분)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error('AI 이미지 생성 요청 타임아웃 (4분 초과)')
        controller.abort()
      }, 240000)
      
      console.log('🚀 새로운 캐릭터 생성 API 요청 시작:', {
        endpoint: '/api/generate/profile',
        characterData,
        timeout: '240초 (4분)'
      })

      // 프로필 이미지 생성 API 호출
      const response = await authenticatedFetch('/api/generate/profile', {
        method: 'POST',
        body: JSON.stringify({
          chatbot_name: characterData.name,
          age: characterData.age,
          gender: characterData.gender,
          relationship: characterData.relationship,
          concept: characterData.concept,
          user_uploads_url: characterData.imageUrl,
          relationship_type: characterData.relationship
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      // 응답 상태 먼저 확인
      if (!response.ok) {
        console.error('🚨 HTTP 오류 응답:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })
        throw new Error(`HTTP 오류: ${response.status} ${response.statusText}`)
      }

      // 응답 데이터 파싱
      const result = await response.json()
      
      console.log('🎯 캐릭터 생성 API 응답:', {
        status: response.status,
        statusText: response.statusText,
        result: result
      })

      // 서버 응답에서 success 필드 확인
      if (!result.success) {
        throw new Error(result.error || '캐릭터 생성에 실패했습니다.')
      }

      // 2단계: 완료
      setProcessingState({
        stage: 'complete',
        message: 'AI 캐릭터 생성이 완료되었습니다!',
        progress: 100
      })

      setGeneratedChatbotId(result.chatbot_id)
      setProfileImageUrl(result.profile_image_url)
      
      console.log('🔍 상태 업데이트 완료:', {
        generatedChatbotId: result.chatbot_id,
        profileImageUrl: result.profile_image_url
      })
      
      // 잠시 대기 후 완료 단계로 이동
      setTimeout(() => {
        setCurrentStep('complete')
      }, 1000)

    } catch (error) {
      console.error('🚨 AI 생성 과정 중 오류:', error)
      
      setCurrentStep('error')
      
      let userFriendlyMessage = '알 수 없는 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          userFriendlyMessage = 'AI 캐릭터 생성 시간이 초과되었습니다. (4분 초과) 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          userFriendlyMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인하시거나 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('인증')) {
          userFriendlyMessage = '인증에 문제가 발생했습니다. 다시 로그인해주세요.'
        } else {
          userFriendlyMessage = error.message
        }
      }
      
      setErrorMessage(userFriendlyMessage)
    }
  }

  const getStepProgress = () => {
    switch (currentStep) {
      case 'character': return Math.round(((wizardStep + 1) / 7) * 100) // 실제 7단계 진행률
      case 'processing': return 100 // 7단계 완료 후 처리 중
      case 'complete': return 100
      case 'error': return wizardStep > 0 ? Math.round(((wizardStep + 1) / 7) * 100) : 0
      default: return 0
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'character': return '1-7단계: 캐릭터 생성'
      case 'processing': return '처리 중: AI 생성'
      case 'complete': return '완료!'
      case 'error': return '오류 발생'
      default: return 'AI 캐릭터 생성'
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
      {/* 헤더 - 대시보드/채팅 페이지와 동일한 스타일 */}
      <header className="bg-surface/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="relative flex items-center justify-center" style={{ minHeight: '36px' }}>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              AI 캐릭터 만들기
            </h1>
            <Button
              onClick={() => router.push('/dashboard')}
              variant="outline"
              className="absolute right-0 min-h-button-sm px-2 sm:px-3 py-2 text-xs font-medium flex items-center gap-1 border-border hover:bg-surface"
              title="대시보드로 이동"
            >
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">대시보드</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-4xl py-6">


        {/* 단계별 컨텐츠 */}
        <div className="min-h-[400px]">
          {currentStep === 'character' && (
            <CharacterCreationWizard
              onComplete={handleCharacterCreationComplete}
              onBack={() => router.push('/dashboard')}
              onStepChange={setWizardStep}
            />
          )}

          {currentStep === 'processing' && (
            <Card className="text-center py-12">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="relative mx-auto">
                    <div className="w-16 h-16 mx-auto bg-surface rounded-full flex items-center justify-center border border-border">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                    
                    {/* 프로필 이미지 생성 전용 프로그레스 바 */}
                    <div className="w-40 mx-auto mt-4">
                      <div className="h-2 bg-surface rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-300 animate-pulse"
                          style={{ width: `${Math.min(processingState.progress, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      AI 마법이 일어나고 있어요! ✨
                    </h3>
                    <p className="text-sm text-muted mb-4">
                      {processingState.message}
                    </p>
                    <div className="text-sm text-muted">
                      잠시만 기다려주세요. 곧 놀라운 결과를 보여드릴게요!
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'complete' && (
            <Card className="text-center py-12">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {profileImageUrl ? (
                    <div className="mx-auto">
                      <ProfileThumbnail 
                        imageUrl={profileImageUrl}
                        alt={`생성된 ${chatbotName} 캐릭터 프로필`}
                        size="lg"
                        className="mx-auto"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-xl font-bold text-success mb-2">
                      AI 캐릭터 생성 완료! 🎉
                    </h3>
                    <p className="text-base text-muted mb-6 leading-normal">
                      <strong>{chatbotName}</strong> 캐릭터가 성공적으로 생성되었습니다.<br />
                      이제 채팅을 시작할 수 있어요!
                    </p>
                  </div>
                  
                  <div className="flex flex-row gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard')}
                      className="flex items-center justify-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-sm font-medium"
                      title="대시보드로 이동"
                    >
                      <Home className="w-4 h-4" />
                      <span className="hidden sm:inline">대시보드로</span>
                    </Button>
                    
                    <Button
                      onClick={() => router.push(`/chat/${generatedChatbotId}`)}
                      className="bg-primary text-inverse hover:bg-primary/90 flex items-center justify-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-sm font-medium shadow-sm hover:shadow-hover transition-all duration-200"
                      title="채팅 시작하기"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="hidden sm:inline">지금 채팅하기</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'error' && (
            <Card className="text-center py-12">
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="w-16 h-16 mx-auto bg-error/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-error" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-error mb-2">
                      문제가 발생했습니다
                    </h3>
                    <p className="text-base text-muted mb-6 leading-normal">
                      {errorMessage}
                    </p>
                  </div>
                  
                  <div className="flex flex-row gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard')}
                      className="flex items-center justify-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-sm font-medium"
                      title="대시보드로 돌아가기"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">대시보드로 돌아가기</span>
                    </Button>
                    
                    {!errorMessage.includes('쿼터') && (
                      <Button
                        onClick={() => {
                          setCurrentStep('character')
                          setErrorMessage('')
                          setUploadedImageUrl(null)
                          setProfileImageUrl(null)
                        }}
                        className="bg-primary text-inverse hover:bg-primary/90 flex items-center justify-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-sm font-medium shadow-sm hover:shadow-hover transition-all duration-200"
                        title="다시 시도하기"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">다시 시도</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}