// Supabase Storage 이미지 업로드 및 관리
import { createSupabaseClient } from '@/lib/supabase-client'

export interface UploadResult {
  success: boolean
  publicUrl?: string
  filePath?: string
  error?: string
}

export interface StorageOptions {
  bucket?: 'images' | 'user-uploads'
  folder?: 'profiles' | 'chats' | 'temp' | 'user-uploads'
  quality?: number
  maxWidth?: number
  maxHeight?: number
}

/**
 * Supabase Storage에 이미지 업로드
 */
export async function uploadImageToSupabase(
  file: File,
  userId: string,
  options: StorageOptions = {}
): Promise<UploadResult> {
  const {
    bucket = 'images',
    folder = 'profiles',
    quality = 0.9,
    maxWidth = 1024,
    maxHeight = 1024
  } = options

  try {
    console.log('이미지 업로드 시작:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      bucket,
      folder,
      userId
    })

    const supabase = createSupabaseClient()
    
    // 파일 이름 생성 (타임스탬프 + 원본 확장자)
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    
    // 버킷과 폴더에 따른 파일 경로 설정
    let fileName: string
    let filePath: string
    
    if (bucket === 'user-uploads') {
      // 사용자 업로드: user-uploads 버킷의 userId 폴더
      fileName = `upload_${timestamp}_${randomId}.${fileExt}`
      filePath = `${userId}/${fileName}`
    } else {
      // ComfyUI 생성 이미지: images 버킷의 폴더 구조
      if (folder === 'profiles') {
        fileName = `profile_${timestamp}_${randomId}.${fileExt}`
      } else if (folder === 'chats') {
        const sessionId = Math.random().toString(36).substring(2, 10)
        fileName = `chat_${sessionId}_${timestamp}_${randomId}.${fileExt}`
      } else if (folder === 'temp') {
        fileName = `temp_${timestamp}_${randomId}.${fileExt}`
      } else {
        fileName = `${folder}_${timestamp}_${randomId}.${fileExt}`
      }
      filePath = `${folder}/${userId}/${fileName}`
    }

    // 파일 크기 및 형식 검증
    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSizeBytes) {
      return {
        success: false,
        error: '파일 크기는 10MB 이하여야 합니다.'
      }
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'JPG, PNG, WebP 파일만 업로드 가능합니다.'
      }
    }

    // 이미지 최적화 (필요한 경우)
    let uploadFile = file
    if (file.size > 2 * 1024 * 1024) { // 2MB 이상인 경우 압축
      uploadFile = await compressImage(file, { quality, maxWidth, maxHeight })
      console.log('이미지 압축 완료:', {
        originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        compressedSize: `${(uploadFile.size / 1024 / 1024).toFixed(2)}MB`
      })
    }

    // Supabase Storage 업로드
    const { data, error } = await supabase.storage
      .from(bucket) // 동적 버킷 이름
      .upload(filePath, uploadFile, {
        contentType: uploadFile.type,
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Supabase Storage 업로드 오류:', error)
      return {
        success: false,
        error: `업로드 실패: ${error.message}`
      }
    }

    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    console.log('업로드 성공:', {
      filePath: data.path,
      publicUrl,
      fullPath: data.fullPath
    })

    return {
      success: true,
      publicUrl,
      filePath: data.path
    }

  } catch (error) {
    console.error('이미지 업로드 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    }
  }
}

/**
 * 이미지 압축 함수
 */
async function compressImage(
  file: File,
  options: { quality: number; maxWidth: number; maxHeight: number }
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      try {
        // 비율 유지하면서 최대 크기 계산
        let { width, height } = img
        const ratio = Math.min(options.maxWidth / width, options.maxHeight / height)
        
        if (ratio < 1) {
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // 고품질 렌더링 설정
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              reject(new Error('이미지 압축 실패'))
            }
          },
          'image/jpeg',
          options.quality
        )
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => reject(new Error('이미지 로드 실패'))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 특정 사용자의 업로드된 이미지 목록 조회 (버킷 및 폴더별)
 */
export async function getUserImages(
  userId: string, 
  bucket: 'images' | 'user-uploads' = 'images',
  folder: 'profiles' | 'chats' | 'temp' | 'user-uploads' = 'profiles'
) {
  try {
    const supabase = createSupabaseClient()
    
    let folderPath: string
    if (bucket === 'user-uploads') {
      folderPath = userId // user-uploads 버킷은 userId 폴더만
    } else {
      folderPath = `${folder}/${userId}` // images 버킷은 폴더/userId 구조
    }
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folderPath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('이미지 목록 조회 오류:', error)
      return { success: false, error: error.message }
    }

    const imageUrls = data?.map(file => {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(`${folderPath}/${file.name}`)
      
      return {
        name: file.name,
        url: publicUrl,
        createdAt: file.created_at,
        size: file.metadata?.size,
        bucket: bucket,
        folder: folder
      }
    })

    return { success: true, images: imageUrls }
  } catch (error) {
    console.error('이미지 목록 조회 중 예외 발생:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    }
  }
}

/**
 * 이미지 삭제 (버킷 및 폴더 구조 지원)
 */
export async function deleteImage(
  userId: string, 
  fileName: string, 
  bucket: 'images' | 'user-uploads' = 'images',
  folder: 'profiles' | 'chats' | 'temp' | 'user-uploads' = 'profiles'
) {
  try {
    const supabase = createSupabaseClient()
    
    let filePath: string
    if (bucket === 'user-uploads') {
      filePath = `${userId}/${fileName}` // user-uploads 버킷
    } else {
      filePath = `${folder}/${userId}/${fileName}` // images 버킷
    }
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) {
      console.error('이미지 삭제 오류:', error)
      return { success: false, error: error.message }
    }

    console.log('이미지 삭제 완료:', filePath)
    return { success: true }
  } catch (error) {
    console.error('이미지 삭제 중 예외 발생:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '알 수 없는 오류' 
    }
  }
}
