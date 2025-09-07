/**
 * 사용자 이미지 업로드 API
 * 사용자가 업로드한 이미지를 user-uploads 버킷에 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { uploadUserImage } from '@/lib/storage/supabase-storage'

export async function POST(request: NextRequest) {
  try {
    // 세션 확인
    const supabase = createSupabaseServiceClient()
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }

    // Bearer 토큰에서 사용자 정보 확인 (간단한 구현)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // FormData에서 이미지 파일 가져오기
    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // 파일 형식 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, WebP allowed' 
      }, { status: 400 })
    }

    // 파일 크기 검증 (10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 10MB' 
      }, { status: 400 })
    }

    // 파일을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)
    
    // 파일 형식 결정
    const fileFormat = file.type === 'image/jpeg' ? 'jpg' : 
                      file.type === 'image/png' ? 'png' : 'webp'

    // user-uploads 버킷에 업로드
    console.log(`사용자 이미지 업로드 요청: user_id=${user.id}, size=${imageBuffer.length}`)
    
    const uploadResult = await uploadUserImage(imageBuffer, user.id, fileFormat)
    
    if (!uploadResult.success) {
      console.error('사용자 이미지 업로드 실패:', uploadResult.error)
      return NextResponse.json({ 
        error: 'Upload failed',
        details: uploadResult.error 
      }, { status: 500 })
    }

    console.log('사용자 이미지 업로드 성공:', uploadResult.url)

    // 성공 응답
    return NextResponse.json({
      success: true,
      image_url: uploadResult.url,
      filename: uploadResult.filename,
      bucket: 'user-uploads',
      size: uploadResult.size,
      upload_time: new Date().toISOString()
    })

  } catch (error) {
    console.error('사용자 이미지 업로드 API 오류:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// OPTIONS 메서드 지원 (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
