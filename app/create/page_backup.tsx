'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase-client'
import { authenticatedFetch } from '@/lib/auth-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
import ImageProcessor from '@/components/images/ImageProcessor'
import CharacterCreationWizard from '@/components/character/CharacterCreationWizard'
import { uploadImageToSupabase } from '@/lib/storage/upload'
import ProfileThumbnail from '@/components/ui/ProfileThumbnail'

type CreateStep = 'image' | 'character' | 'processing' | 'complete' | 'error'

interface ProcessingState {
  stage: 'uploading' | 'generating' | 'saving' | 'complete'
  message: string
  progress: number
}

export default function CreatePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<CreateStep>('image')
  const [processedImageFile, setProcessedImageFile] = useState<File | null>(null)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [selectedConceptId, setSelectedConceptId] = useState<string>('')
  const [selectedSpeechPresetId, setSelectedSpeechPresetId] = useState<string>('')
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

  const handleImageProcessed = async (file: File) => {
    console.log('이미지 처리 완료:', file.name)
    setProcessedImageFile(file)
    setCurrentStep('character')
  }
  
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
        endpoint: '/api/chatbots/create',
        characterData,
        timeout: '240초 (4분)'
      })

      // 새로운 캐릭터 생성 API 호출
      const response = await authenticatedFetch('/api/chatbots/create', {
        method: 'POST',
        body: JSON.stringify({
          name: characterData.name,
          age: characterData.age,
          gender: characterData.gender,
          relationship: characterData.relationship,
          concept: characterData.concept,
          user_image_url: characterData.imageUrl
        }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)

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
      
      // HTTP 상태 코드도 확인
      if (!response.ok) {
        console.warn('HTTP 오류이지만 success:true인 상황:', response.status)
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
      case 'image': return 0
      case 'character': return 25
      case 'processing': return processingState.progress
      case 'complete': return 100
      case 'error': return 0
      default: return 0
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'image': return '1단계: 이미지 처리'
      case 'character': return '2단계: 캐릭터 설정'
      case 'processing': return '3단계: AI 생성 중'
      case 'complete': return '완료!'
      case 'error': return '오류 발생'
      default: return 'AI 캐릭터 생성'
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI 캐릭터 만들기
          </h1>
          <p className="text-gray-600">
            당신만의 개성 있는 AI 캐릭터를 생성해보세요
          </p>
        </div>

        {/* 진행 상황 */}
        {currentStep !== 'error' && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">{getStepTitle()}</h3>
                  <span className="text-sm text-gray-500">
                    {getStepProgress()}% 완료
                  </span>
                </div>
                
                <Progress value={getStepProgress()} className="w-full" />
                
                {currentStep === 'processing' && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      {processingState.message}
                    </p>
                    <div className="flex items-center justify-center gap-2 text-yellow-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">처리 중입니다. 잠시만 기다려주세요...</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 단계별 컨텐츠 */}
        <div className="min-h-[500px]">
          {currentStep === 'image' && (
            <ImageProcessor
              onImageProcessed={handleImageProcessed}
              onCancel={() => router.push('/dashboard')}
            />
          )}

          {currentStep === 'character' && (
            <CharacterCreationWizard
              processedImageFile={processedImageFile!}
              onComplete={handleCharacterCreationComplete}
              onBack={() => setCurrentStep('image')}
            />
          )}

          {currentStep === 'processing' && (
            <Card className="text-center py-16">
              <CardContent>
                <div className="space-y-6">
                  <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold mb-2">
                      AI 마법이 일어나고 있어요! ✨
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {processingState.message}
                    </p>
                    <div className="text-sm text-gray-500">
                      잠시만 기다려주세요. 곧 놀라운 결과를 보여드릴게요!
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'complete' && (
            <Card className="text-center py-16">
              <CardContent>
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
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-2xl font-bold text-green-600 mb-2">
                      AI 캐릭터 생성 완료! 🎉
                    </h3>
                    <p className="text-gray-600 mb-6">
                      <strong>{chatbotName}</strong> 캐릭터가 성공적으로 생성되었습니다.<br />
                      이제 채팅을 시작할 수 있어요!
                    </p>
                  </div>
                  
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard')}
                    >
                      대시보드로
                    </Button>
                    
                    <Button
                      onClick={() => router.push(`/chat/${generatedChatbotId}`)}
                      className="bg-warning hover:bg-warning/90 text-inverse shadow-sm hover:shadow-hover transition-all duration-200"
                    >
                      지금 채팅하기
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'error' && (
            <Card className="text-center py-16">
              <CardContent>
                <div className="space-y-6">
                  <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-red-600 mb-2">
                      문제가 발생했습니다
                    </h3>
                    <p className="text-gray-600 mb-6">
                      {errorMessage}
                    </p>
                  </div>
                  
                  <div className="flex gap-4 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => router.push('/dashboard')}
                    >
                      대시보드로 돌아가기
                    </Button>
                    
                    {!errorMessage.includes('쿼터') && (
                      <Button
                        onClick={() => {
                          setCurrentStep('image')
                          setErrorMessage('')
                          setProcessedImageFile(null)
                          setUploadedImageUrl(null)
                          setProfileImageUrl(null)
                        }}
                      >
                        다시 시도
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