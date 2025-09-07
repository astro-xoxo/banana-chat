// Supabase 3개 분리 버킷 설정 스크립트 (user-uploads, profile-images, chat-images)
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// 환경변수 로드
dotenv.config({ path: '.env.local' })

// 버킷 설정 정의
const BUCKET_CONFIGS = [
  {
    name: 'user-uploads',
    description: '사용자 업로드 원본 이미지',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  },
  {
    name: 'profile-images', 
    description: 'ComfyUI 생성 프로필 이미지',
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  },
  {
    name: 'chat-images',
    description: 'ComfyUI 생성 채팅 이미지', 
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  }
]

async function setupImagesBuckets() {
  console.log('=== Supabase 3개 분리 버킷 설정 시작 ===')
  console.log('버킷들: user-uploads, profile-images, chat-images')
  
  try {
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('환경변수 누락:', {
        url: !!supabaseUrl,
        serviceKey: !!supabaseServiceKey
      })
      throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
    }
    
    console.log('환경변수 확인 완료')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 1. 기존 버킷 목록 확인
    console.log('1. 기존 버킷 목록 조회...')
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('버킷 목록 조회 실패:', listError)
      return
    }
    
    console.log('기존 버킷들:', buckets?.map(b => b.name).join(', ') || '없음')
    
    // 2. 각 버킷 생성/확인
    const results = []
    
    for (const config of BUCKET_CONFIGS) {
      console.log(`\n2. ${config.name} 버킷 처리 중...`)
      
      const existingBucket = buckets?.find(bucket => bucket.name === config.name)
      
      if (existingBucket) {
        console.log(`✅ ${config.name} 버킷이 이미 존재합니다:`, existingBucket)
        results.push({
          name: config.name,
          status: 'exists',
          bucket: existingBucket
        })
      } else {
        console.log(`${config.name} 버킷 생성 중... (${config.description})`)
        
        const { data: newBucket, error: createError } = await supabase.storage.createBucket(config.name, {
          public: config.public,
          allowedMimeTypes: config.allowedMimeTypes,
          fileSizeLimit: config.fileSizeLimit
        })
        
        if (createError) {
          console.error(`${config.name} 버킷 생성 실패:`, createError)
          results.push({
            name: config.name,
            status: 'failed',
            error: createError.message
          })
          continue
        }
        
        console.log(`✅ ${config.name} 버킷 생성 성공:`, newBucket)
        results.push({
          name: config.name,
          status: 'created',
          bucket: newBucket
        })
      }
    }
    
    // 3. 각 버킷에 테스트 업로드 수행
    console.log('\n3. 각 버킷 업로드 테스트 중...')
    
    // 테스트 이미지 데이터 (1x1 PNG)
    const testImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )
    
    const testResults = []
    
    for (const config of BUCKET_CONFIGS) {
      console.log(`\n${config.name} 버킷 테스트 중...`)
      
      // 버킷별 테스트 파일명 (사용자별 폴더 구조로)
      let testFileName
      if (config.name === 'user-uploads') {
        testFileName = `test_user/upload_${Date.now()}_test.png`
      } else if (config.name === 'profile-images') {
        testFileName = `test_user/profile_${Date.now()}_test.png`
      } else if (config.name === 'chat-images') {
        testFileName = `test_user/chat_session123_${Date.now()}_test.png`
      }
      
      // 업로드 테스트
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(config.name)
        .upload(testFileName!, testImageBuffer, {
          contentType: 'image/png',
          cacheControl: '3600'
        })

      if (uploadError) {
        console.error(`${config.name} 테스트 업로드 실패:`, uploadError)
        testResults.push({
          bucket: config.name,
          success: false,
          error: uploadError.message
        })
        continue
      }

      // Public URL 생성 테스트
      const { data: { publicUrl } } = supabase.storage
        .from(config.name)
        .getPublicUrl(testFileName!)

      console.log(`✅ ${config.name} 테스트 업로드 성공:`, {
        filePath: uploadData.path,
        publicUrl
      })

      // 테스트 파일 삭제
      await supabase.storage
        .from(config.name)
        .remove([testFileName!])
      
      console.log(`✅ ${config.name} 테스트 파일 정리 완료`)
      
      testResults.push({
        bucket: config.name,
        success: true,
        publicUrl,
        filePath: uploadData.path
      })
    }
    
    // 4. 최종 상태 확인
    console.log('\n4. 최종 버킷 상태 확인...')
    
    const { data: finalBuckets } = await supabase.storage.listBuckets()
    const createdBuckets = finalBuckets?.filter(b => 
      ['user-uploads', 'profile-images', 'chat-images'].includes(b.name)
    )
    
    console.log('\n=== 설정 완료 ===')
    console.log('생성된 버킷들:')
    createdBuckets?.forEach(bucket => {
      console.log(`- ${bucket.name}: ${bucket.public ? 'Public' : 'Private'}`)
    })
    
    console.log('\n버킷 설정이 성공적으로 완료되었습니다!')
    console.log('구조:')
    console.log('- user-uploads: 사용자 업로드 원본 이미지')
    console.log('- profile-images: ComfyUI 생성 프로필 이미지')
    console.log('- chat-images: ComfyUI 생성 채팅 이미지')
    
    return {
      success: true,
      buckets: createdBuckets,
      results,
      testResults
    }

  } catch (error) {
    console.error('버킷 설정 중 오류 발생:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  setupImagesBuckets()
    .then(result => {
      if (result?.success) {
        console.log('✅ 3개 버킷 설정 스크립트 실행 완료')
        process.exit(0)
      } else {
        console.error('❌ 스크립트 실행 실패:', result?.error)
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('❌ 스크립트 예외 발생:', error)
      process.exit(1)
    })
}

export default setupImagesBuckets
