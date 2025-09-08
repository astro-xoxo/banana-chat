'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon, Crop, Check } from 'lucide-react'

// 동적으로 cropperjs를 클라이언트 사이드에서만 로드
let CropperClass: any = null
let cssLoaded = false

interface ImageUploadWithCropProps {
  onImageSelect: (file: File) => void
  uploadType?: 'profile' | 'user-upload'
  requireCrop?: boolean
  className?: string
}

export default function ImageUploadWithCrop({
  onImageSelect,
  uploadType = 'profile',
  requireCrop = true,
  className = ''
}: ImageUploadWithCropProps) {
  console.log('🎨 ImageUploadWithCrop 컴포넌트 렌더링됨', { uploadType, requireCrop })
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [cropMode, setCropMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [croppedFile, setCroppedFile] = useState<File | null>(null)
  const [cropperReady, setCropperReady] = useState(false)
  
  const imageRef = useRef<HTMLImageElement>(null)
  const cropperInstanceRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cropper 라이브러리 동적 로드
  const loadCropper = useCallback(async () => {
    if (typeof window === 'undefined') return null
    
    if (!CropperClass) {
      try {
        console.log('📦 Cropper.js 라이브러리 로드 시작...')
        
        // CSS 먼저 로드 (중복 방지)
        if (!cssLoaded) {
          const existingLink = document.querySelector('link[href*="cropperjs"]')
          if (!existingLink) {
            const cssLink = document.createElement('link')
            cssLink.rel = 'stylesheet'
            cssLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css'
            cssLink.onload = () => {
              console.log('✅ Cropper.js CSS 로드 완료')
              cssLoaded = true
            }
            cssLink.onerror = () => {
              console.error('❌ Cropper.js CSS 로드 실패')
            }
            document.head.appendChild(cssLink)
          }
        }
        
        // JS 모듈 로드
        const cropperModule = await import('cropperjs')
        CropperClass = cropperModule.default
        console.log('✅ Cropper.js 모듈 로드 완료:', CropperClass)
        
        return CropperClass
      } catch (error) {
        console.error('❌ Cropper.js 로드 실패:', error)
        return null
      }
    }
    
    return CropperClass
  }, [])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('📁 파일 선택:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    })

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 선택 가능합니다.')
      return
    }

    setSelectedFile(file)
    
    // 이미지 미리보기 URL 생성
    const imageUrl = URL.createObjectURL(file)
    setPreviewUrl(imageUrl)
    
    if (requireCrop) {
      setCropMode(true)
      setCropperReady(false)
    } else {
      // 크롭이 필요하지 않은 경우 바로 콜백 호출
      onImageSelect(file)
    }
  }, [requireCrop, onImageSelect])

  // 크롭 모드 초기화
  useEffect(() => {
    if (cropMode && imageRef.current && previewUrl) {
      initializeCropper()
    }
    
    return () => {
      if (cropperInstanceRef.current) {
        try {
          cropperInstanceRef.current.destroy()
          cropperInstanceRef.current = null
          console.log('🧹 Cropper 인스턴스 정리 완료')
        } catch (error) {
          console.error('❌ Cropper 정리 실패:', error)
        }
      }
    }
  }, [cropMode, previewUrl])

  // Cropper 초기화
  const initializeCropper = useCallback(async () => {
    if (!imageRef.current || !previewUrl) return
    
    try {
      console.log('🔧 Cropper 초기화 시작...')
      
      // 기존 인스턴스 정리
      if (cropperInstanceRef.current) {
        cropperInstanceRef.current.destroy()
        cropperInstanceRef.current = null
      }
      
      // Cropper 라이브러리 로드
      const CropperConstructor = await loadCropper()
      if (!CropperConstructor) {
        throw new Error('Cropper 라이브러리 로드 실패')
      }

      // 이미지 로드 대기
      const imageElement = imageRef.current
      if (imageElement.complete) {
        createCropperInstance(CropperConstructor, imageElement)
      } else {
        imageElement.onload = () => {
          createCropperInstance(CropperConstructor, imageElement)
        }
      }
      
    } catch (error) {
      console.error('❌ Cropper 초기화 실패:', error)
      alert('크롭 기능을 초기화할 수 없습니다. 페이지를 새로고침해주세요.')
    }
  }, [previewUrl, loadCropper])

  // Cropper 인스턴스 생성
  const createCropperInstance = useCallback((CropperConstructor: any, imageElement: HTMLImageElement) => {
    try {
      console.log('🎯 Cropper 인스턴스 생성...')
      
      cropperInstanceRef.current = new CropperConstructor(imageElement, {
        aspectRatio: 1, // 정사각형 크롭
        viewMode: 2, // 크롭 영역을 캔버스 영역으로 제한
        dragMode: 'move',
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready() {
          console.log('✅ Cropper 준비 완료')
          setCropperReady(true)
        },
        crop(event: any) {
          console.log('🖼️ 크롭 영역 변경:', event.detail)
        }
      })
      
    } catch (error) {
      console.error('❌ Cropper 인스턴스 생성 실패:', error)
      alert('크롭 기능 초기화에 실패했습니다.')
    }
  }, [])

  // 크롭 완료 처리
  const handleCropComplete = useCallback(async () => {
    if (!cropperInstanceRef.current || !selectedFile) {
      console.error('❌ 크롭 인스턴스 또는 원본 파일이 없음')
      return
    }

    try {
      setLoading(true)
      console.log('✂️ 크롭 처리 시작...')
      
      // 크롭된 캔버스 생성
      const canvas = cropperInstanceRef.current.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      })
      
      if (!canvas) {
        throw new Error('크롭된 캔버스를 생성할 수 없습니다')
      }
      
      // 캔버스를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('캔버스를 Blob으로 변환 실패'))
          }
        }, 'image/jpeg', 0.9)
      })
      
      // Blob을 File로 변환
      const timestamp = Date.now()
      const fileExtension = selectedFile.name.split('.').pop() || 'jpg'
      const fileName = `cropped_${timestamp}.${fileExtension}`
      
      const croppedFile = new File([blob], fileName, {
        type: 'image/jpeg',
        lastModified: timestamp,
      })
      
      console.log('✅ 크롭 완료:', {
        originalSize: `${(selectedFile.size / 1024).toFixed(2)}KB`,
        croppedSize: `${(croppedFile.size / 1024).toFixed(2)}KB`,
        fileName
      })
      
      setCroppedFile(croppedFile)
      
      // 🔄 크롭된 이미지로 미리보기 URL 업데이트
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl) // 기존 URL 메모리 정리
      }
      const croppedPreviewUrl = URL.createObjectURL(croppedFile)
      setPreviewUrl(croppedPreviewUrl)
      console.log('🖼️ 크롭된 이미지 미리보기 URL 생성됨:', croppedPreviewUrl.substring(0, 50) + '...')
      
      // 부모 컴포넌트에 크롭된 파일 전달
      onImageSelect(croppedFile)
      
      // 크롭 모드 종료
      setCropMode(false)
      setCropperReady(false)
      
    } catch (error) {
      console.error('❌ 크롭 처리 실패:', error)
      alert('이미지 크롭 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }, [selectedFile, onImageSelect, previewUrl])

  // 크롭 취소
  const handleCropCancel = useCallback(() => {
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy()
      cropperInstanceRef.current = null
    }
    
    setCropMode(false)
    setCropperReady(false)
    setSelectedFile(null)
    setPreviewUrl('')
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    console.log('↩️ 크롭 취소됨')
  }, [])

  // 파일 선택 초기화
  const handleReset = useCallback(() => {
    if (cropperInstanceRef.current) {
      cropperInstanceRef.current.destroy()
      cropperInstanceRef.current = null
    }
    
    setSelectedFile(null)
    setPreviewUrl('')
    setCropMode(false)
    setCroppedFile(null)
    setCropperReady(false)
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    console.log('🔄 파일 선택 초기화됨')
  }, [previewUrl])

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardContent className="p-6">
        {!selectedFile && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                이미지 업로드
              </h3>
              <p className="text-sm text-muted mb-4">
                {requireCrop ? '얼굴 크롭을 위한' : ''} 이미지를 선택해주세요
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="cursor-pointer"
                onClick={() => {
                  console.log('🖱️ 이미지 선택 버튼 클릭됨')
                  fileInputRef.current?.click()
                }}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                이미지 선택
              </Button>
            </div>
          </div>
        )}

        {selectedFile && !cropMode && (
          <div className="space-y-4">
            <div className="text-center">
              <img
                src={previewUrl}
                alt="업로드된 이미지"
                className="max-w-full h-40 object-contain mx-auto rounded-lg"
              />
              <div className="mt-2 text-sm text-muted">
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)}KB)
              </div>
              {croppedFile && (
                <div className="text-xs text-success mt-1">
                  ✅ 크롭 완료
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                다시 선택
              </Button>
            </div>
          </div>
        )}

        {cropMode && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-foreground mb-2">
                얼굴 영역 크롭
              </h3>
              <p className="text-sm text-muted mb-4">
                크롭할 영역을 조정하고 완료 버튼을 누르세요
              </p>
            </div>
            
            <div className="crop-container max-h-80 overflow-hidden rounded-lg">
              <img
                ref={imageRef}
                src={previewUrl}
                alt="크롭할 이미지"
                className="max-w-full"
                style={{ display: 'block' }}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCropCancel}
                disabled={loading}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                취소
              </Button>
              <Button
                type="button"
                onClick={handleCropComplete}
                disabled={!cropperReady || loading}
                className="flex-1 bg-warning hover:bg-warning/90 text-inverse"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    처리 중...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    크롭 완료
                  </>
                )}
              </Button>
            </div>
            
            {!cropperReady && (
              <div className="text-center text-sm text-muted">
                크롭 도구를 로딩 중...
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}