'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAnonymousSession } from '@/components/auth/AnonymousProvider'
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import ImageUploadWithCrop from '@/components/images/ImageUploadWithCrop'

interface ChatbotFormData {
  name: string
  age: number
  gender: 'male' | 'female'
  relationship: string
  concept: string
  userImage?: File
}

type CreateStep = 'form' | 'generating' | 'complete' | 'error'

export default function CreatePage() {
  const { session } = useAnonymousSession()
  const router = useRouter()
  
  const [currentStep, setCurrentStep] = useState<CreateStep>('form')
  const [formData, setFormData] = useState<ChatbotFormData>({
    name: '',
    age: 25,
    gender: 'female',
    relationship: '',
    concept: ''
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')
  const [generatedChatbotId, setGeneratedChatbotId] = useState<string>('')
  const [profileImageUrl, setProfileImageUrl] = useState<string>('')

  // 세션이 없으면 홈으로 리디렉션
  useEffect(() => {
    if (!session) {
      router.push('/')
    }
  }, [session, router])

  if (!session) {
    return null
  }

  const handleImageSelect = (file: File) => {
    setSelectedImage(file)
    console.log('✅ 크롭된 얼굴 이미지 선택됨:', file.name, `${(file.size / 1024).toFixed(2)}KB`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.relationship || !formData.concept) {
      setError('모든 필수 항목을 입력해주세요')
      return
    }

    setCurrentStep('generating')
    setIsGenerating(true)
    setError('')

    try {
      let userImageUrl = ''
      
      // 이미지 업로드 (선택사항)
      if (selectedImage) {
        console.log('🖼️ 크롭된 이미지 업로드 시작:', {
          fileName: selectedImage.name,
          fileSize: selectedImage.size,
          fileType: selectedImage.type,
          sessionId: session.sessionId
        })
        
        const uploadFormData = new FormData()
        uploadFormData.append('file', selectedImage)
        uploadFormData.append('session_id', session.sessionId)
        
        console.log('📤 업로드 API 호출 중...')
        const uploadResponse = await fetch('/api/upload/user-image', {
          method: 'POST',
          body: uploadFormData
        })
        
        console.log('📥 업로드 응답:', {
          status: uploadResponse.status,
          ok: uploadResponse.ok,
          statusText: uploadResponse.statusText
        })
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json()
          console.log('✅ 업로드 결과:', uploadResult)
          
          if (uploadResult.success) {
            userImageUrl = uploadResult.imageUrl
            console.log('🎯 사용자 이미지 URL 설정됨:', userImageUrl)
          } else {
            console.error('❌ 업로드 실패:', uploadResult.error)
          }
        } else {
          const errorText = await uploadResponse.text()
          console.error('❌ 업로드 HTTP 오류:', {
            status: uploadResponse.status,
            error: errorText
          })
        }
      } else {
        console.log('ℹ️ 선택된 이미지가 없어서 업로드 건너뛰기')
      }

      // 챗봇 생성 (NanoBanana API 사용)
      const createResponse = await fetch('/api/generate/profile-nanobanana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: session.sessionId,
          chatbot_name: formData.name,
          age: formData.age,
          gender: formData.gender,
          relationship: formData.relationship,
          concept: formData.concept,
          user_uploaded_image_url: userImageUrl
        })
      })

      const result = await createResponse.json()

      if (result.success) {
        setGeneratedChatbotId(result.chatbot_id)
        setProfileImageUrl(result.profile_image_url || '')
        setCurrentStep('complete')
      } else {
        throw new Error(result.error || '챗봇 생성에 실패했습니다')
      }
    } catch (err) {
      console.error('챗봇 생성 오류:', err)
      setError(err instanceof Error ? err.message : '챗봇 생성 중 오류가 발생했습니다')
      setCurrentStep('error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRetry = () => {
    setCurrentStep('form')
    setError('')
  }

  if (currentStep === 'generating') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface rounded-3xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-warning rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-inverse animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            AI 캐릭터 생성 중...
          </h2>
          <p className="text-muted mb-4">
            NanoBanana AI가 당신만의 특별한 캐릭터를 만들고 있습니다
          </p>
          <div className="w-full bg-background rounded-full h-2">
            <div className="bg-warning h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface rounded-3xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-success rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            생성 완료! 🎉
          </h2>
          <p className="text-muted mb-6">
            {formData.name} 캐릭터가 성공적으로 만들어졌습니다
          </p>
          
          {profileImageUrl && (
            <div className="mb-6">
              <img 
                src={profileImageUrl} 
                alt="Generated Profile" 
                className="w-24 h-24 rounded-2xl mx-auto object-cover"
              />
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/chat/${generatedChatbotId}`)}
              className="w-full bg-warning hover:bg-warning/90 text-inverse font-medium py-3 px-4 rounded-xl transition-colors"
            >
              지금 채팅하기
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-surface-hover hover:bg-interactive-hover text-foreground font-medium py-3 px-4 rounded-xl transition-colors"
            >
              대시보드로 가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface rounded-3xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-destructive rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            생성 실패
          </h2>
          <p className="text-muted mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-warning hover:bg-warning/90 text-inverse font-medium py-3 px-4 rounded-xl transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-surface-hover hover:bg-interactive-hover text-foreground font-medium py-3 px-4 rounded-xl transition-colors"
            >
              대시보드로 돌아가기
            </button>
          </div>
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
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center justify-center w-8 h-8 bg-surface-hover rounded-xl hover:bg-interactive-hover transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-foreground" />
              </button>
              <h1 className="text-lg font-bold text-foreground">새 AI 캐릭터 만들기</h1>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 참고 이미지 업로드 (선택사항) - 얼굴 크롭 기능 포함 */}
            <div className="bg-surface rounded-3xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">참고 이미지 (선택사항)</h3>
              <p className="text-sm text-muted mb-4">
                AI가 참조할 얼굴 이미지를 업로드하세요. 업로드 후 얼굴 영역을 크롭하게 됩니다.
              </p>
              <ImageUploadWithCrop
                onImageSelect={handleImageSelect}
                uploadType="user-upload"
                requireCrop={true}
              />
              {selectedImage && (
                <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-xl">
                  <p className="text-sm text-success">
                    ✅ 얼굴 크롭 완료: {selectedImage.name}
                  </p>
                </div>
              )}
            </div>

            {/* 기본 정보 */}
            <div className="bg-surface rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">기본 정보</h3>
              
              {/* 이름 */}
              <div>
                <label className="block text-foreground font-medium mb-2">캐릭터 이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:border-warning focus:outline-none"
                  placeholder="예: 지수, 민준, 사라 등"
                  required
                />
              </div>

              {/* 나이 */}
              <div>
                <label className="block text-foreground font-medium mb-2">나이 *</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: parseInt(e.target.value) || 25})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:border-warning focus:outline-none"
                  min="18"
                  max="100"
                  required
                />
              </div>

              {/* 성별 */}
              <div>
                <label className="block text-foreground font-medium mb-2">성별 *</label>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, gender: 'female'})}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                      formData.gender === 'female' 
                        ? 'bg-warning text-inverse' 
                        : 'bg-background border border-border text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    여성
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, gender: 'male'})}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                      formData.gender === 'male' 
                        ? 'bg-warning text-inverse' 
                        : 'bg-background border border-border text-foreground hover:bg-surface-hover'
                    }`}
                  >
                    남성
                  </button>
                </div>
              </div>

              {/* 관계 */}
              <div>
                <label className="block text-foreground font-medium mb-2">나와의 관계 *</label>
                <textarea
                  value={formData.relationship}
                  onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:border-warning focus:outline-none resize-none"
                  placeholder="예: 친한 친구, 연인, 동료, 선배, 후배 등... 자세히 설명해주세요"
                  rows={3}
                  required
                />
              </div>

              {/* 컨셉/특성 */}
              <div>
                <label className="block text-foreground font-medium mb-2">캐릭터 컨셉/특성 *</label>
                <textarea
                  value={formData.concept}
                  onChange={(e) => setFormData({...formData, concept: e.target.value})}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted focus:border-warning focus:outline-none resize-none"
                  placeholder="예: 밝고 활발한 성격, 요리를 좋아하는 카페 사장, 책을 좋아하는 조용한 성격, 유머러스하고 장난기 많은 성격 등... 어떤 캐릭터인지 자세히 설명해주세요"
                  rows={4}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {/* 생성 버튼 */}
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full bg-warning hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed text-inverse font-medium py-4 px-6 rounded-2xl transition-colors"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  AI 캐릭터 생성 중...
                </span>
              ) : (
                'AI 캐릭터 생성하기'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}