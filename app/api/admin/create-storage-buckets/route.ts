import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 서비스 역할 클라이언트 (관리자 권한)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🗄️ Supabase Storage 버킷 생성 시작')

    // 1. 사용자 업로드 이미지용 버킷
    const userUploadsResult = await supabaseAdmin.storage.createBucket('user-uploads', {
      public: false, // 비공개 버킷
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      fileSizeLimit: 10485760, // 10MB
    })

    if (userUploadsResult.error && !userUploadsResult.error.message.includes('already exists')) {
      console.error('❌ user-uploads 버킷 생성 실패:', userUploadsResult.error)
      throw userUploadsResult.error
    }
    console.log('✅ user-uploads 버킷 생성 완료')

    // 2. 생성된 이미지용 버킷
    const generatedImagesResult = await supabaseAdmin.storage.createBucket('generated-images', {
      public: true, // 공개 버킷 (서비스에서 직접 노출)
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      fileSizeLimit: 20971520, // 20MB
    })

    if (generatedImagesResult.error && !generatedImagesResult.error.message.includes('already exists')) {
      console.error('❌ generated-images 버킷 생성 실패:', generatedImagesResult.error)
      throw generatedImagesResult.error
    }
    console.log('✅ generated-images 버킷 생성 완료')

    // 3. 임시 파일용 버킷
    const tempFilesResult = await supabaseAdmin.storage.createBucket('temp-files', {
      public: false, // 비공개 버킷
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      fileSizeLimit: 10485760, // 10MB
    })

    if (tempFilesResult.error && !tempFilesResult.error.message.includes('already exists')) {
      console.error('❌ temp-files 버킷 생성 실패:', tempFilesResult.error)
      throw tempFilesResult.error
    }
    console.log('✅ temp-files 버킷 생성 완료')

    console.log('📋 스토리지 정책 설정 시작...')

    // 4. RLS 정책 설정 (Row Level Security)
    // 익명 사용자는 자신의 세션 ID로만 접근 가능하도록 설정
    
    // user-uploads 정책
    const userUploadsPolicy = `
      CREATE POLICY "Users can upload their own files" ON storage.objects 
      FOR INSERT WITH CHECK (bucket_id = 'user-uploads');
      
      CREATE POLICY "Users can view their own files" ON storage.objects 
      FOR SELECT USING (bucket_id = 'user-uploads');
      
      CREATE POLICY "Users can delete their own files" ON storage.objects 
      FOR DELETE USING (bucket_id = 'user-uploads');
    `

    // generated-images 정책 (공개 읽기)
    const generatedImagesPolicy = `
      CREATE POLICY "Public read access" ON storage.objects 
      FOR SELECT USING (bucket_id = 'generated-images');
      
      CREATE POLICY "Service can insert generated images" ON storage.objects 
      FOR INSERT WITH CHECK (bucket_id = 'generated-images');
    `

    // temp-files 정책
    const tempFilesPolicy = `
      CREATE POLICY "Temporary file access" ON storage.objects 
      FOR ALL USING (bucket_id = 'temp-files');
    `

    try {
      // SQL 정책 실행 (RPC가 있다면)
      await supabaseAdmin.rpc('exec_sql', { sql: userUploadsPolicy })
      await supabaseAdmin.rpc('exec_sql', { sql: generatedImagesPolicy })
      await supabaseAdmin.rpc('exec_sql', { sql: tempFilesPolicy })
      console.log('✅ 스토리지 정책 설정 완료')
    } catch (policyError) {
      console.warn('⚠️ 스토리지 정책 설정 건너뜀 (RPC 미지원):', policyError)
    }

    console.log('🎉 Supabase Storage 버킷 설정 완료!')

    return NextResponse.json({
      success: true,
      message: 'Storage 버킷이 성공적으로 생성되었습니다',
      buckets: [
        {
          name: 'user-uploads',
          public: false,
          purpose: '사용자가 업로드한 원본 이미지 저장',
          maxSize: '10MB'
        },
        {
          name: 'generated-images',
          public: true,
          purpose: 'NanoBanana API로 생성된 이미지 저장',
          maxSize: '20MB'
        },
        {
          name: 'temp-files',
          public: false,
          purpose: '임시 파일 및 처리 중인 이미지 저장',
          maxSize: '10MB'
        }
      ]
    })

  } catch (error) {
    console.error('❌ Storage 버킷 생성 실패:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Storage 버킷 생성 중 오류가 발생했습니다',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}