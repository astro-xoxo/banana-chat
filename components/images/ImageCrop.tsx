'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crop as CropIcon, RotateCcw, Check } from 'lucide-react'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropProps {
  imageSrc: string
  onCropComplete: (croppedImageFile: File) => void
  onCancel?: () => void
}

// 이미지에서 중앙 기준으로 정사각형 크롭 설정
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export default function ImageCrop({ imageSrc, onCropComplete, onCancel }: ImageCropProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [isLoading, setIsLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 1))
    console.log('이미지 로드 완료:', { width, height })
  }

  const getCroppedImg = useCallback(async (): Promise<File | null> => {
    const image = imgRef.current
    const canvas = previewCanvasRef.current
    const crop = completedCrop

    if (!image || !canvas || !crop) {
      console.error('크롭 요소가 준비되지 않음:', { image: !!image, canvas: !!canvas, crop: !!crop })
      return null
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Canvas 2D context를 가져올 수 없음')
      return null
    }

    try {
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height

      // 캔버스 크기를 크롭된 영역 크기로 설정
      canvas.width = crop.width * scaleX
      canvas.height = crop.height * scaleY

      // 고해상도 디스플레이를 위한 스케일링
      const pixelRatio = window.devicePixelRatio || 1
      canvas.width = crop.width * scaleX * pixelRatio
      canvas.height = crop.height * scaleY * pixelRatio
      
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      ctx.imageSmoothingQuality = 'high'

      // 크롭된 이미지 그리기
      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY
      )

      // Blob으로 변환
      return new Promise<File>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const timestamp = Date.now()
              const file = new File([blob], `cropped-image-${timestamp}.jpg`, { 
                type: 'image/jpeg',
                lastModified: timestamp 
              })
              console.log('크롭된 이미지 생성 완료:', {
                width: canvas.width / pixelRatio,
                height: canvas.height / pixelRatio,
                size: `${(file.size / 1024 / 1024).toFixed(2)}MB`
              })
              resolve(file)
            } else {
              reject(new Error('Canvas blob 생성 실패'))
            }
          },
          'image/jpeg',
          0.9 // 90% 품질
        )
      })
    } catch (error) {
      console.error('이미지 크롭 처리 중 오류:', error)
      return null
    }
  }, [completedCrop])

  const handleCropComplete = async () => {
    if (!completedCrop?.width || !completedCrop?.height) {
      alert('크롭 영역을 선택해주세요.')
      return
    }

    setIsLoading(true)
    
    try {
      const croppedFile = await getCroppedImg()
      if (croppedFile) {
        onCropComplete(croppedFile)
      } else {
        alert('이미지 크롭에 실패했습니다. 다시 시도해주세요.')
      }
    } catch (error) {
      console.error('크롭 완료 처리 중 오류:', error)
      alert('이미지 처리 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const resetCrop = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current
      setCrop(centerAspectCrop(width, height, 1))
    }
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>
          이미지 크롭
        </CardTitle>
        <p className="text-sm text-muted">
          프로필 이미지로 사용할 정사각형 영역을 선택하세요
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 크롭 영역 - 고정 높이 컨테이너 */}
        <div className="flex justify-center items-center bg-surface rounded-lg p-4" style={{ height: '280px' }}>
          <div className="relative w-full h-full flex items-center justify-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1} // 정사각형 비율 고정
              minWidth={50}
              minHeight={50}
              circularCrop={false}
              className="max-w-full max-h-full"
              style={{ maxHeight: '100%' }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="크롭할 이미지"
                className="max-w-full object-contain"
                style={{ maxHeight: '250px', width: 'auto', height: 'auto' }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>
        </div>

        {/* 숨겨진 미리보기 캔버스 */}
        <canvas
          ref={previewCanvasRef}
          style={{
            display: 'none',
          }}
        />

        {/* 컨트롤 버튼들 */}
        <div className="flex justify-center gap-2 sm:gap-4">
          <Button
            variant="outline"
            onClick={resetCrop}
            disabled={isLoading}
            className="flex items-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-xs"
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </Button>
          
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="min-h-button-sm px-3 sm:px-4 py-2 text-xs"
            >
              취소
            </Button>
          )}
          
          <Button
            onClick={handleCropComplete}
            disabled={isLoading || !completedCrop}
            className="bg-primary hover:bg-primary/90 text-inverse flex items-center gap-2 min-h-button-sm px-3 sm:px-4 py-2 text-xs"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-inverse border-t-transparent rounded-full animate-spin" />
                처리중...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                크롭
              </>
            )}
          </Button>
        </div>

        {/* 사용 안내 */}
        <div className="text-center">
          <p className="text-sm text-muted">
            💡 <strong>사용법:</strong> 이미지 위의 선택 영역을 드래그하여 크기와 위치를 조정하세요
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
