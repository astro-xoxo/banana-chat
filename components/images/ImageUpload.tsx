'use client'

import { useCallback, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  maxSize?: number
  acceptedTypes?: string[]
  disabled?: boolean
  uploadType?: 'user-upload' | 'profile' | 'chat' // 3개 분리 버킷 타입 추가
}

export default function ImageUpload({
  onImageSelect,
  maxSize = 10 * 1024 * 1024, // 10MB
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'],
  disabled = false,
  uploadType = 'user-upload' // 기본값은 사용자 업로드
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return '파일 크기는 10MB 이하여야 합니다.'
    }
    if (!acceptedTypes.includes(file.type)) {
      return 'JPG, PNG, WebP 파일만 업로드 가능합니다.'
    }
    return null
  }

  const handleFileSelect = (file: File) => {
    setError(null)
    
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)
      onImageSelect(file)
      console.log(`이미지 선택 완료 (${uploadType}):`, file.name, `${(file.size / 1024 / 1024).toFixed(2)}MB`)
    } catch (err) {
      console.error('이미지 프리뷰 생성 실패:', err)
      setError('이미지 프리뷰 생성에 실패했습니다.')
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const clearImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }
    setPreview(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
            ${isDragActive ? 'border-warning bg-warning/10 scale-105' : 'border-border hover:border-muted'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'border-error bg-surface' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={!disabled && !preview ? handleButtonClick : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleInputChange}
            disabled={disabled}
            style={{ display: 'none' }}
          />
          
          {preview ? (
            <div className="space-y-4">
              <div className="relative">
                <img 
                  src={preview} 
                  alt="업로드된 이미지 미리보기" 
                  className="max-w-full max-h-48 mx-auto rounded-lg shadow-md"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearImage()
                  }}
                  className="absolute top-2 right-2 p-1 bg-error text-inverse rounded-full hover:bg-error/90 transition-colors"
                  aria-label="이미지 제거"
                >
                  <X size={16} />
                </button>
              </div>
              <Button 
                variant="outline" 
                onClick={(e) => { 
                  e.stopPropagation()
                  clearImage()
                }}
                className="w-full"
              >
                다른 이미지 선택
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                {error ? (
                  <div className="text-error">
                    <X size={48} />
                  </div>
                ) : isDragActive ? (
                  <div className="text-warning animate-bounce">
                    <Upload size={48} />
                  </div>
                ) : (
                  <div className="text-muted">
                    <ImageIcon size={48} />
                  </div>
                )}
              </div>
              
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 leading-tight">
                  {error ? error : isDragActive ? '이미지를 여기에 놓으세요' : '이미지를 업로드하세요'}
                </h2>
                {!error && (
                  <p className="text-sm text-muted mt-2">
                    JPG, PNG, WebP 파일 (최대 10MB)<br />
                    드래그 앤 드롭 또는 클릭하여 선택
                  </p>
                )}
              </div>
              
              {!error && (
                <div className="flex justify-center">
                  <button
                    className="bg-primary text-inverse hover:bg-primary/90 px-3 sm:px-4 py-2 min-h-button-sm rounded-2xl shadow-sm hover:shadow-hover transition-all duration-200 flex items-center font-medium"
                    onClick={handleButtonClick}
                    disabled={disabled}
                  >
                    <Upload className="mr-1 sm:mr-2" size={16} />
                    <span className="text-xs">파일 선택</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-surface border border-error rounded-md">
            <p className="text-sm text-error font-medium">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearImage}
              className="mt-2 text-error border-error hover:bg-surface"
            >
              다시 시도
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
