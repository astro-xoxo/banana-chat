import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface UploadRequest {
  session_id: string
  file: File
}

interface UploadResponse {
  success: boolean
  imageUrl?: string
  uploadedImageId?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  console.log('🖼️ 사용자 이미지 업로드 API 시작')
  
  try {
    // 1. FormData에서 파일과 세션 ID 추출
    const formData = await request.formData()
    const file = formData.get('file') as File
    const session_id = formData.get('session_id') as string
    
    console.log('📤 업로드 요청:', {
      session_id,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    // 2. 입력값 검증
    if (!session_id || !file) {
      return NextResponse.json({
        success: false,
        error: '필수 입력값이 누락되었습니다 (session_id, file)'
      }, { status: 400 })
    }

    // 3. 파일 타입 검증 (이미지만 허용)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: '이미지 파일만 업로드 가능합니다'
      }, { status: 400 })
    }

    // 4. 파일 크기 제한 (5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: '파일 크기는 5MB를 초과할 수 없습니다'
      }, { status: 400 })
    }

    // 5. 세션 유효성 확인 및 자동 생성 (프로필 API와 동일 로직)
    let { data: sessionData, error: sessionError } = await supabase
      .from('anonymous_sessions')
      .select('id, session_id')
      .eq('session_id', session_id)
      .single()

    // 세션이 DB에 없으면 자동으로 생성 (프로필 생성 API와 동일 로직)
    if (sessionError || !sessionData) {
      console.log('🔄 세션이 DB에 없음, 업로드 API에서 자동 생성 시도:', session_id)
      
      const { data: newSession, error: createError } = await supabase
        .from('anonymous_sessions')
        .insert({
          session_id,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .select('id, session_id')
        .single()

      if (createError || !newSession) {
        console.error('❌ 세션 자동 생성 실패:', createError)
        console.error('❌ 에러 상세:', {
          code: createError?.code,
          message: createError?.message,
          details: createError?.details,
          hint: createError?.hint,
          session_id
        })
        return NextResponse.json({
          success: false,
          error: '세션 처리 중 오류가 발생했습니다'
        }, { status: 500 })
      }

      sessionData = newSession
      console.log('✅ 세션 자동 생성 완료 (업로드 API):', session_id)
    }

    // 6. 파일을 Buffer로 변환
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 7. 고유 파일명 생성 (timestamp + random)
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `user-upload-${timestamp}-${randomStr}.${fileExtension}`

    console.log('📂 Supabase Storage 업로드 시작:', {
      bucket: 'user-uploads',
      fileName: uniqueFileName,
      bufferSize: buffer.length
    })

    // 8. Supabase Storage에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(uniqueFileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('❌ Storage 업로드 실패:', uploadError)
      return NextResponse.json({
        success: false,
        error: `파일 업로드에 실패했습니다: ${uploadError.message}`
      }, { status: 500 })
    }

    console.log('✅ Storage 업로드 완료:', uploadData)

    // 9. 업로드된 파일의 공개 URL 생성
    const { data: publicUrlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(uniqueFileName)

    const publicUrl = publicUrlData.publicUrl

    console.log('🔗 공개 URL 생성:', publicUrl)

    // 10. 데이터베이스에 업로드 정보 저장
    const { data: uploadRecord, error: dbError } = await supabase
      .from('uploaded_images')
      .insert({
        session_id,
        original_filename: file.name,
        file_size: file.size,
        mime_type: file.type,
        image_url: publicUrl,
        storage_path: uploadData.path
      })
      .select('id')
      .single()

    if (dbError || !uploadRecord) {
      console.error('❌ DB 저장 실패:', dbError)
      
      // 스토리지 파일 삭제 (롤백)
      await supabase.storage
        .from('user-uploads')
        .remove([uniqueFileName])
      
      return NextResponse.json({
        success: false,
        error: '데이터베이스 저장에 실패했습니다'
      }, { status: 500 })
    }

    console.log('🎉 사용자 이미지 업로드 완료:', {
      uploadedImageId: uploadRecord.id,
      publicUrl,
      fileName: uniqueFileName
    })

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      uploadedImageId: uploadRecord.id
    })

  } catch (error) {
    console.error('❌ 이미지 업로드 API 오류:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '이미지 업로드 중 예상치 못한 오류가 발생했습니다'
    }, { status: 500 })
  }
}
