'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, ArrowRight, Upload } from 'lucide-react'
import ImageUpload from './ImageUpload'
import ImageCrop from './ImageCrop'

interface ImageProcessorProps {
  onImageProcessed: (file: File) => void
  onCancel?: () => void
  disabled?: boolean
}

type ProcessStep = 'upload' | 'crop' | 'complete'

export default function ImageProcessor({ 
  onImageProcessed, 
  onCancel, 
  disabled = false 
}: ImageProcessorProps) {
  const [currentStep, setCurrentStep] = useState<ProcessStep>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const handleImageSelect = (file: File) => {
    console.log('이미지 선택됨:', file.name)
    setUploadedFile(file)
    
    // 이미지 미리보기 URL 생성
    const previewUrl = URL.createObjectURL(file)
    setImagePreviewUrl(previewUrl)
    
    // 자동으로 크롭 단계로 이동
    setTimeout(() => {
      setCurrentStep('crop')
    }, 300)
  }

  const handleCropComplete = (croppedFile: File) => {
    console.log('크롭 완료:', croppedFile.name)
    
    // 기존 미리보기 URL 정리
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
    }
    
    setCurrentStep('complete')
    onImageProcessed(croppedFile)
  }

  const handleBack = () => {
    if (currentStep === 'crop') {
      setCurrentStep('upload')
      setUploadedFile(null)
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
        setImagePreviewUrl(null)
      }
    }
  }

  const getStepProgress = () => {
    switch (currentStep) {
      case 'upload': return 0
      case 'crop': return 50
      case 'complete': return 100
      default: return 0
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return '1단계: 이미지 업로드'
      case 'crop': return '2단계: 이미지 크롭'
      case 'complete': return '완료!'
      default: return '이미지 처리'
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 진행 상황 표시 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{getStepTitle()}</h3>
              <span className="text-sm text-gray-500">
                {getStepProgress()}% 완료
              </span>
            </div>
            
            <Progress value={getStepProgress()} className="w-full" />
            
            <div className="flex justify-between text-sm">
              <span className={currentStep === 'upload' ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                업로드
              </span>
              <span className={currentStep === 'crop' ? 'text-yellow-600 font-medium' : 'text-gray-500'}>
                크롭
              </span>
              <span className={currentStep === 'complete' ? 'text-green-600 font-medium' : 'text-gray-500'}>
                완료
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 컨텐츠 영역 */}
      <div className="min-h-[400px]">
        {currentStep === 'upload' && (
          <div className="space-y-4">
            <ImageUpload 
              onImageSelect={handleImageSelect}
              disabled={disabled}
            />
            {onCancel && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={onCancel}>
                  취소
                </Button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'crop' && imagePreviewUrl && (
          <div className="space-y-4">
            <ImageCrop
              imageSrc={imagePreviewUrl}
              onCropComplete={handleCropComplete}
              onCancel={handleBack}
            />
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                이전 단계
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'complete' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-600">
                  이미지 처리 완료!
                </h3>
                <p className="text-gray-600">
                  이미지가 성공적으로 처리되었습니다.<br />
                  이제 AI 캐릭터 생성을 계속 진행할 수 있습니다.
                </p>
                
                <div className="flex justify-center gap-4 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep('upload')
                      setUploadedFile(null)
                      if (imagePreviewUrl) {
                        URL.revokeObjectURL(imagePreviewUrl)
                        setImagePreviewUrl(null)
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    다른 이미지 선택
                  </Button>
                  
                  <Button 
                    className="bg-yellow-500 hover:bg-yellow-600 text-black flex items-center gap-2"
                    onClick={() => {
                      // 다음 단계로 진행하는 로직은 부모 컴포넌트에서 처리
                      console.log('다음 단계로 진행')
                    }}
                  >
                    다음 단계
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
