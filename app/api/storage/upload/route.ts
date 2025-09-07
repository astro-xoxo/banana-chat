import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  console.log('=== Storage 업로드 API 시작 ===')
  
  try {
    // FormData에서 파일과 메타데이터 추출
    const formData = await request.formData()
    const file = formData.get('file') as File
    const bucket = formData.get('bucket') as string
    const filePath = formData.get('path') as string
    
    if (!file || !bucket || !filePath) {
      console.error('필수 파라미터 누락:', { file: !!file, bucket, filePath })
      return NextResponse.json(
        { 
          success: false,
          error: '필수 파라미터가 누락되었습니다. (file, bucket, path 필요)' 
        }, 
        { status: 400 }
      )
    }
    
    console.log('업로드 요청:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)}KB`,
      fileType: file.type,
      bucket,
      filePath
    })
    
    // 파일 크기 및 형식 검증
    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { 
          success: false,
          error: '파일 크기는 10MB 이하여야 합니다.' 
        }, 
        { status: 400 }
      )
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'JPG, PNG, WebP 파일만 업로드 가능합니다.' 
        }, 
        { status: 400 }
      )
    }
    
    // Supabase Storage에 업로드 (Service Role 사용)
    const supabase = createSupabaseServiceClient()
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error('Supabase Storage 업로드 오류:', error)
      return NextResponse.json(
        { 
          success: false,
          error: `업로드 실패: ${error.message}` 
        }, 
        { status: 500 }
      )
    }
    
    // Public URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)
    
    console.log('✅ Storage 업로드 성공:', {
      filePath: data.path,
      publicUrl,
      bucket
    })
    
    return NextResponse.json({
      success: true,
      publicUrl,
      filePath: data.path,
      bucket,
      metadata: {
        originalName: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Storage 업로드 API 예외 발생:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: '파일 업로드 중 서버 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    )
  }
}

// GET 요청: Storage 상태 확인
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceClient()
    
    // 각 버킷의 상태 확인
    const buckets = ['user-uploads', 'profile-images', 'chat-images']
    const bucketStatus = []
    
    for (const bucketName of buckets) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 1 })
        
        bucketStatus.push({
          bucket: bucketName,
          accessible: !error,
          error: error?.message
        })
      } catch (err) {
        bucketStatus.push({
          bucket: bucketName,
          accessible: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      storage_status: 'healthy',
      buckets: bucketStatus,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Storage 상태 확인 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Storage 상태 확인 중 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    )
  }
}
