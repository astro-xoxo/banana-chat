const { createClient } = require('@supabase/supabase-js')

// Supabase 클라이언트 생성
const supabaseUrl = 'https://tcvtwqjphkqeqpawdfvu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdnR3cWpwaGtxZXFwYXdkZnZ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzIzNDEwMSwiZXhwIjoyMDcyODEwMTAxfQ.0XQuW0jT324m_WUtIQJKRSbr4p3su6W-OhBLAGRumMA'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applySchema() {
  console.log('🔧 Banana Chat 스키마 적용 시작...')

  try {
    // 1. anonymous_sessions 테이블 확인/생성
    console.log('📊 anonymous_sessions 테이블 생성 중...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('anonymous_sessions')
      .select('id')
      .limit(1)

    if (sessionsError && sessionsError.code === '42P01') {
      console.log('⚠️ anonymous_sessions 테이블이 없습니다. SQL Editor에서 직접 생성이 필요합니다.')
    } else if (!sessionsError) {
      console.log('✅ anonymous_sessions 테이블 존재 확인')
    }

    // 2. chatbots 테이블 확인
    console.log('📊 chatbots 테이블 확인 중...')
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id')
      .limit(1)

    if (chatbotsError && chatbotsError.code === '42P01') {
      console.log('⚠️ chatbots 테이블이 없습니다. SQL Editor에서 직접 생성이 필요합니다.')
    } else if (!chatbotsError) {
      console.log('✅ chatbots 테이블 존재 확인')
    }

    // 3. Storage 버킷 생성
    console.log('🗄️ Storage 버킷 생성 중...')
    
    // user-uploads 버킷
    const { data: userUploads, error: userUploadsError } = await supabase.storage.createBucket('user-uploads', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    })
    
    if (userUploadsError) {
      if (userUploadsError.message.includes('already exists')) {
        console.log('ℹ️ user-uploads 버킷이 이미 존재합니다')
      } else {
        console.error('❌ user-uploads 버킷 생성 실패:', userUploadsError)
      }
    } else {
      console.log('✅ user-uploads 버킷 생성 완료')
    }

    // generated-images 버킷
    const { data: generatedImages, error: generatedImagesError } = await supabase.storage.createBucket('generated-images', {
      public: true,
      fileSizeLimit: 20971520, // 20MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    })
    
    if (generatedImagesError) {
      if (generatedImagesError.message.includes('already exists')) {
        console.log('ℹ️ generated-images 버킷이 이미 존재합니다')
      } else {
        console.error('❌ generated-images 버킷 생성 실패:', generatedImagesError)
      }
    } else {
      console.log('✅ generated-images 버킷 생성 완료')
    }

    // temp-files 버킷
    const { data: tempFiles, error: tempFilesError } = await supabase.storage.createBucket('temp-files', {
      public: false,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    })
    
    if (tempFilesError) {
      if (tempFilesError.message.includes('already exists')) {
        console.log('ℹ️ temp-files 버킷이 이미 존재합니다')
      } else {
        console.error('❌ temp-files 버킷 생성 실패:', tempFilesError)
      }
    } else {
      console.log('✅ temp-files 버킷 생성 완료')
    }

    console.log('\n📝 테이블 생성이 필요한 경우:')
    console.log('1. Supabase 대시보드 → SQL Editor')
    console.log('2. database/schema.sql 파일 내용을 복사하여 실행')
    console.log('\n🎉 Storage 버킷 설정 완료!')

  } catch (error) {
    console.error('❌ 스키마 적용 실패:', error)
  }
}

// 실행
applySchema()