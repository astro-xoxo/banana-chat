// Supabase Storage 3개 분리 버킷 관리 유틸리티 (user-uploads, profile-images, chat-images)
import { createClient } from '@supabase/supabase-js'

export interface BucketConfig {
  id: string
  public: boolean
  allowedMimeTypes?: string[]
  fileSizeLimit?: number
}

export interface StorageBucketResult {
  success: boolean
  bucket?: any
  error?: string
}

export interface UploadResult {
  success: boolean
  url?: string
  filename?: string
  size?: number
  bucketName?: string
  error?: string
}

// 버킷 타입 정의
export type BucketType = 'user-uploads' | 'profile-images' | 'chat-images'

// 버킷별 설정
export const BUCKET_CONFIGS: Record<BucketType, BucketConfig> = {
  'user-uploads': {
    id: 'user-uploads',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  },
  'profile-images': {
    id: 'profile-images', 
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  },
  'chat-images': {
    id: 'chat-images',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  }
}

/**
 * 서비스 클라이언트 생성 (서버에서만 사용)
 */
function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service environment variables')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * 사용자 업로드 이미지 저장 (user-uploads 버킷)
 */
export async function uploadUserImage(
  imageBuffer: Buffer, 
  userId: string, 
  fileFormat = 'jpg'
): Promise<UploadResult> {
  try {
    const supabase = createSupabaseServiceClient()
    
    // 파일명 생성
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const filename = `${userId}/upload_${timestamp}_${randomId}.${fileFormat}`
    
    console.log(`사용자 이미지 업로드 시작: ${filename} (${imageBuffer.length} bytes)`)
    
    // Content-Type 설정
    const contentType = fileFormat === 'jpg' ? 'image/jpeg' : 'image/png'
    
    // user-uploads 버킷에 업로드
    const { data, error } = await supabase.storage
      .from('user-uploads')
      .upload(filename, imageBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error('사용자 이미지 업로드 실패:', error)
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      }
    }
    
    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filename)
    
    console.log(`사용자 이미지 업로드 성공: ${publicUrl}`)
    
    return {
      success: true,
      url: publicUrl,
      filename: filename,
      size: imageBuffer.length,
      bucketName: 'user-uploads'
    }
    
  } catch (error) {
    console.error('사용자 이미지 업로드 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * ComfyUI 프로필 이미지 저장 (profile-images 버킷)
 */
export async function uploadProfileImage(
  imageBuffer: Buffer, 
  userId: string, 
  fileFormat = 'jpg'
): Promise<UploadResult> {
  try {
    const supabase = createSupabaseServiceClient()
    
    // 파일명 생성
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const filename = `${userId}/profile_${timestamp}_${randomId}.${fileFormat}`
    
    console.log(`프로필 이미지 업로드 시작: ${filename} (${imageBuffer.length} bytes)`)
    
    // Content-Type 설정
    const contentType = fileFormat === 'jpg' ? 'image/jpeg' : 'image/png'
    
    // profile-images 버킷에 업로드
    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(filename, imageBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error('프로필 이미지 업로드 실패:', error)
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      }
    }
    
    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filename)
    
    console.log(`프로필 이미지 업로드 성공: ${publicUrl}`)
    
    return {
      success: true,
      url: publicUrl,
      filename: filename,
      size: imageBuffer.length,
      bucketName: 'profile-images'
    }
    
  } catch (error) {
    console.error('프로필 이미지 업로드 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * ComfyUI 채팅 이미지 저장 (chat-images 버킷)
 */
export async function uploadChatImage(
  imageBuffer: Buffer, 
  userId: string, 
  sessionId: string,
  fileFormat = 'jpg'
): Promise<UploadResult> {
  try {
    const supabase = createSupabaseServiceClient()
    
    // 파일명 생성
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 10)
    const filename = `${userId}/chat_${sessionId}_${timestamp}_${randomId}.${fileFormat}`
    
    console.log(`채팅 이미지 업로드 시작: ${filename} (${imageBuffer.length} bytes)`)
    
    // Content-Type 설정
    const contentType = fileFormat === 'jpg' ? 'image/jpeg' : 'image/png'
    
    // chat-images 버킷에 업로드
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filename, imageBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error('채팅 이미지 업로드 실패:', error)
      return {
        success: false,
        error: `Upload failed: ${error.message}`
      }
    }
    
    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filename)
    
    console.log(`채팅 이미지 업로드 성공: ${publicUrl}`)
    
    return {
      success: true,
      url: publicUrl,
      filename: filename,
      size: imageBuffer.length,
      bucketName: 'chat-images'
    }
    
  } catch (error) {
    console.error('채팅 이미지 업로드 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 버킷 목록 조회
 */
export async function listStorageBuckets() {
  try {
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage.listBuckets()

    if (error) {
      console.error('버킷 목록 조회 실패:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      buckets: data
    }

  } catch (error) {
    console.error('버킷 목록 조회 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 버킷 정보 조회
 */
export async function getBucketInfo(bucketId: string) {
  try {
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage.getBucket(bucketId)

    if (error) {
      console.error('버킷 정보 조회 실패:', error)
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: true,
      bucket: data
    }

  } catch (error) {
    console.error('버킷 정보 조회 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 버킷 삭제
 */
export async function deleteStorageBucket(bucketId: string) {
  try {
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage.deleteBucket(bucketId)

    if (error) {
      console.error('버킷 삭제 실패:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('버킷 삭제 성공:', bucketId)
    return {
      success: true,
      data
    }

  } catch (error) {
    console.error('버킷 삭제 중 예외 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 특정 버킷에서 사용자 이미지 조회
 */
export async function getUserImages(bucketType: BucketType, userId: string) {
  try {
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage
      .from(bucketType)
      .list(userId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error(`${bucketType} 이미지 목록 조회 실패:`, error)
      return {
        success: false,
        error: error.message
      }
    }

    // Public URL들 생성
    const imagesWithUrls = data?.map(file => {
      const { data: { publicUrl } } = supabase.storage
        .from(bucketType)
        .getPublicUrl(`${userId}/${file.name}`)
      
      return {
        name: file.name,
        publicUrl,
        created_at: file.created_at,
        size: file.metadata?.size
      }
    })

    return {
      success: true,
      images: imagesWithUrls || []
    }

  } catch (error) {
    console.error(`${bucketType} 이미지 조회 중 예외 발생:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 이미지 삭제
 */
export async function deleteImage(bucketType: BucketType, filePath: string) {
  try {
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage
      .from(bucketType)
      .remove([filePath])

    if (error) {
      console.error(`${bucketType}에서 이미지 삭제 실패:`, error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log(`${bucketType}에서 이미지 삭제 성공:`, filePath)
    return {
      success: true,
      data
    }

  } catch (error) {
    console.error(`${bucketType} 이미지 삭제 중 예외 발생:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}
