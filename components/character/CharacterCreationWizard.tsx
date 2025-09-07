'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ChevronLeft, ChevronRight, Sparkles, User, MessageCircle, Heart, Users, Upload, Image as ImageIcon, Crop, Check, AlertCircle, Loader2 } from 'lucide-react'
import ImageUpload from '@/components/images/ImageUpload'
import ImageCrop from '@/components/images/ImageCrop'
import AgeInput from './AgeInput'
import RelationshipInput from './RelationshipInput'
import ConceptInput from './ConceptInput'
import { uploadImageToSupabase } from '@/lib/storage/upload'
import { createSupabaseClient } from '@/lib/supabase-client'

// 타입 정의
interface CharacterCreationWizardProps {
  processedImageFile?: File | null
  onComplete: (
    age: number,
    gender: 'male' | 'female',
    relationship: string,
    concept: string,
    name: string,
    imageUrl: string
  ) => void
  onBack: () => void
  onStepChange?: (step: number) => void // 단계 변경 콜백 추가
}

interface CharacterData {
  uploadedFile: File | null
  croppedFile: File | null
  imageUrl: string
  gender: 'male' | 'female' | ''  // 빈 문자열 추가로 초기 상태 허용
  age: number
  relationship: string
  concept: string
  name: string
}

export default function CharacterCreationWizard({
  processedImageFile,
  onComplete,
  onBack,
  onStepChange
}: CharacterCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  
  // 초기 단계 상태 전달
  useEffect(() => {
    onStepChange?.(currentStep)
  }, [])
  
  const [characterData, setCharacterData] = useState<CharacterData>({
    uploadedFile: processedImageFile || null,
    croppedFile: null,
    imageUrl: '',
    gender: '',  // 초기값을 빈 문자열로 변경 (성별 미선택 상태)
    age: 0,  // 초기값을 0으로 변경하여 placeholder만 표시
    relationship: '',
    concept: '',
    name: ''
  })

  // 7단계 설정
  const steps = [
    { 
      id: 'upload', 
      title: '캐릭터 생성', 
      icon: <Upload className="w-5 h-5" />,
      description: '프로필 이미지를 선택해주세요'
    },
    { 
      id: 'crop', 
      title: '이미지 편집', 
      icon: <Crop className="w-5 h-5" />,
      description: '이미지를 적절한 크기로 조정해주세요'
    },
    { 
      id: 'gender', 
      title: '성별 선택', 
      icon: <Users className="w-5 h-5" />,
      description: 'AI 캐릭터의 성별을 선택해주세요'
    },
    { 
      id: 'age', 
      title: '나이 입력', 
      icon: <User className="w-5 h-5" />,
      description: '캐릭터의 나이를 입력해주세요'
    },
    { 
      id: 'relationship', 
      title: '관계 설정', 
      icon: <Heart className="w-5 h-5" />,
      description: '상대가 나에게 어떤 관계인지 설정해주세요'
    },
    { 
      id: 'concept', 
      title: '컨셉 입력', 
      icon: <Sparkles className="w-5 h-5" />,
      description: '대화 상황이나 컨셉을 입력해주세요'
    },
    { 
      id: 'name', 
      title: '이름 입력', 
      icon: <MessageCircle className="w-5 h-5" />,
      description: 'AI 캐릭터의 이름을 입력해주세요'
    }
  ]

  // processedImageFile이 있으면 crop 단계부터 시작
  useEffect(() => {
    if (processedImageFile) {
      setCharacterData(prev => ({ ...prev, uploadedFile: processedImageFile }))
      const url = URL.createObjectURL(processedImageFile)
      setImagePreviewUrl(url)
      setCurrentStep(1) // crop 단계로 시작
      onStepChange?.(1)
    }
  }, [processedImageFile])

  const handleImageSelect = (file: File) => {
    setCharacterData(prev => ({ ...prev, uploadedFile: file }))
    const url = URL.createObjectURL(file)
    setImagePreviewUrl(url)
    setCurrentStep(1) // 자동으로 crop 단계로 이동
    onStepChange?.(1)
  }

  const handleCropComplete = (croppedFile: File) => {
    setCharacterData(prev => ({ ...prev, croppedFile }))
    // 이전 미리보기 URL 정리
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    const newUrl = URL.createObjectURL(croppedFile)
    setImagePreviewUrl(newUrl)
    // 자동 이동 제거 - 사용자가 '다음' 버튼으로 수동 이동
  }
  
  const handleRecrop = () => {
    // 크롭된 파일과 미리보기 URL 초기화하여 크롭 컴포넌트로 돌아가기
    setCharacterData(prev => ({ ...prev, croppedFile: null }))
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    // 원본 이미지 URL로 복원
    if (characterData.uploadedFile) {
      const originalUrl = URL.createObjectURL(characterData.uploadedFile)
      setImagePreviewUrl(originalUrl)
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const newStep = currentStep + 1
      setCurrentStep(newStep)
      onStepChange?.(newStep)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1
      setCurrentStep(newStep)
      onStepChange?.(newStep)
    }
  }

  const handleComplete = async () => {
    if (!characterData.croppedFile) return

    setIsUploading(true)
    try {
      // Supabase에 이미지 업로드
      const supabase = createSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('인증 세션이 없습니다')
      }

      const uploadResult = await uploadImageToSupabase(
        characterData.croppedFile,
        session.user.id,
        {
          bucket: 'user-uploads',
          folder: 'user-uploads'
        }
      )

      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error('이미지 업로드에 실패했습니다')
      }

      // 완료 콜백 호출
      onComplete(
        characterData.age,
        characterData.gender,
        characterData.relationship,
        characterData.concept,
        characterData.name,
        uploadResult.publicUrl
      )
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsUploading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!characterData.uploadedFile
      case 1: return !!characterData.croppedFile
      case 2: return !!characterData.gender
      case 3: return characterData.age > 0 && characterData.age >= 10 && characterData.age <= 100  // 0보다 큰 값이면서 범위 내
      case 4: return characterData.relationship.length > 0 && characterData.relationship.length <= 20
      case 5: return characterData.concept.length > 0 && characterData.concept.length <= 20
      case 6: return characterData.name.length > 0 && characterData.name.length <= 10
      default: return false
    }
  }

  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="w-full max-w-4xl mx-auto bg-background rounded-3xl border border-border shadow-card animate-slide-up">
      <div className="p-6 border-b border-border">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-bold text-foreground">
              {currentStep + 1}단계: {steps[currentStep].title}
            </h2>
            <div className="bg-surface rounded-2xl px-3 py-1 border border-border text-sm flex items-center space-x-1 text-foreground">
              <span>
                {currentStep + 1}/{steps.length}
              </span>
            </div>
          </div>
          
          {/* 프로그레스 바 */}
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="min-h-[300px] md:min-h-[400px]">
          {/* 1단계: 이미지 업로드 */}
          {currentStep === 0 && (
            <div className="flex justify-center">
              <ImageUpload
                onImageSelect={handleImageSelect}
                disabled={false}
              />
            </div>
          )}

          {/* 2단계: 이미지 크롭 또는 크롭 결과 확인 */}
          {currentStep === 1 && imagePreviewUrl && (
            <div className="space-y-6">
              {/* 크롭된 이미지가 있으면 결과 표시, 없으면 크롭 컴포넌트 */}
              {characterData.croppedFile ? (
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-surface border border-border">
                      <img 
                        src={imagePreviewUrl} 
                        alt="크롭된 이미지" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">크롭 완료!</h3>
                    <p className="text-muted mb-4">크롭된 이미지를 확인하세요. 마음에 들지 않으면 다시 크롭할 수 있습니다.</p>
                    <Button
                      variant="outline"
                      onClick={handleRecrop}
                      className="min-h-button-sm px-3 sm:px-4 py-2 text-xs"
                    >
                      다시 크롭
                    </Button>
                  </div>
                </div>
              ) : (
                <ImageCrop
                  imageSrc={imagePreviewUrl}
                  onCropComplete={handleCropComplete}
                  onCancel={() => setCurrentStep(0)}
                />
              )}
            </div>
          )}

          {/* 3단계: 성별 선택 */}
          {currentStep === 2 && (
            <div className="max-w-lg mx-auto space-y-8 animate-slide-up">
              <div className="text-center">
                <h3 className="text-3xl font-bold text-foreground mb-3">성별을 선택해주세요</h3>
                <p className="text-muted">AI 캐릭터의 성별을 선택하세요</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() => setCharacterData(prev => ({ ...prev, gender: 'female' }))}
                  className={`group relative h-24 rounded-3xl transition-all duration-300 overflow-hidden ${
                    characterData.gender === 'female' 
                      ? 'bg-primary text-inverse shadow-hover scale-105' 
                      : 'bg-surface border border-border hover:border-primary/50 hover:scale-102 shadow-sm hover:shadow-hover'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex flex-col items-center justify-center h-full">
                    <User className={`w-8 h-8 mb-2 ${characterData.gender === 'female' ? 'text-inverse' : 'text-muted'}`} />
                    <span className={`text-xl font-semibold ${characterData.gender === 'female' ? 'text-inverse' : 'text-muted'}`}>
                      여성
                    </span>
                  </div>
                  {characterData.gender === 'female' && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Check className="w-4 h-4 text-inverse" />
                      </div>
                    </div>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setCharacterData(prev => ({ ...prev, gender: 'male' }))}
                  className={`group relative h-24 rounded-3xl transition-all duration-300 overflow-hidden ${
                    characterData.gender === 'male' 
                      ? 'bg-primary text-inverse shadow-hover scale-105' 
                      : 'bg-surface border border-border hover:border-primary/50 hover:scale-102 shadow-sm hover:shadow-hover'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex flex-col items-center justify-center h-full">
                    <User className={`w-8 h-8 mb-2 ${characterData.gender === 'male' ? 'text-inverse' : 'text-muted'}`} />
                    <span className={`text-xl font-semibold ${characterData.gender === 'male' ? 'text-inverse' : 'text-muted'}`}>
                      남성
                    </span>
                  </div>
                  {characterData.gender === 'male' && (
                    <div className="absolute top-2 right-2">
                      <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <Check className="w-4 h-4 text-inverse" />
                      </div>
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 4단계: 나이 입력 */}
          {currentStep === 3 && (
            <div className="max-w-md mx-auto">
              <AgeInput
                value={characterData.age}
                onChange={(age) => setCharacterData(prev => ({ ...prev, age }))}
              />
            </div>
          )}

          {/* 5단계: 관계 입력 */}
          {currentStep === 4 && (
            <div className="max-w-md mx-auto">
              <RelationshipInput
                value={characterData.relationship}
                onChange={(relationship) => 
                  setCharacterData(prev => ({ ...prev, relationship }))
                }
              />
            </div>
          )}

          {/* 6단계: 컨셉 입력 */}
          {currentStep === 5 && (
            <div className="max-w-md mx-auto">
              <ConceptInput
                value={characterData.concept}
                onChange={(concept) => 
                  setCharacterData(prev => ({ ...prev, concept }))
                }
              />
            </div>
          )}

          {/* 7단계: 이름 입력 */}
          {currentStep === 6 && (
            <div className="max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="name-input" className="text-base font-medium text-foreground">
                  캐릭터 이름 *
                </Label>
                <Input
                  id="name-input"
                  type="text"
                  value={characterData.name}
                  onChange={(e) => setCharacterData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 지은, 민수, Sarah 등"
                  maxLength={10}
                  className="w-full min-h-input px-4 py-3 border border-border rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm text-foreground shadow-sm transition-all duration-200 text-center"
                />
                <div className="flex justify-between text-xs text-muted">
                  <span>최대 10자까지 입력 가능</span>
                  <span>{characterData.name.length}/10</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 네비게이션 버튼 - 모바일 최적화 */}
        <div className="flex flex-row justify-between items-center gap-3 sm:gap-6 pt-8 border-t border-border">
          <Button
            onClick={currentStep === 0 ? onBack : handlePrevious}
            variant="outline"
            className="min-h-button-sm px-3 sm:px-4 py-2 flex items-center gap-2 text-muted hover:text-foreground group flex-shrink-0 font-medium"
            title={currentStep === 0 ? '이전 화면으로' : '이전 단계로'}
          >
            <ChevronLeft className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
            <span className="text-xs">
              {currentStep === 0 ? '이전' : '이전'}
            </span>
          </Button>
          
          {/* 중복되는 점 인디케이터 제거 - 상단 프로그레스 바가 동일한 역할 */}
          <div className="flex-1"></div>
          
          {currentStep === steps.length - 1 ? (
            <Button
              onClick={handleComplete}
              disabled={!canProceed() || isUploading}
              className="bg-primary text-inverse hover:bg-primary/90 min-h-button-sm px-3 sm:px-4 py-2 font-medium shadow-sm hover:shadow-hover transition-all duration-200 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-inverse disabled:hover:bg-secondary disabled:shadow-none flex items-center gap-2 flex-shrink-0"
              title={isUploading ? '생성 중...' : '캐릭터 생성 완료'}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">생성 중...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-xs">생성</span>
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-primary text-inverse hover:bg-primary/90 min-h-button-sm px-3 sm:px-4 py-2 font-medium shadow-sm hover:shadow-hover transition-all duration-200 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-inverse disabled:hover:bg-secondary disabled:shadow-none flex items-center gap-2 group flex-shrink-0"
              title="다음 단계로"
            >
              <span className="text-xs">다음</span>
              <ChevronRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}