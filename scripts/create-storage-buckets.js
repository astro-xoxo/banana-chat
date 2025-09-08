#!/usr/bin/env node

/**
 * Supabase Storage 버킷 생성 스크립트
 * 사용자 이미지 업로드를 위한 user-uploads 버킷 생성
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase 클라이언트 생성 (Service Role Key 필요)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createStorageBuckets() {
  console.log('🍌 Supabase Storage 버킷 생성 시작...');
  
  try {
    // 1. user-uploads 버킷 생성
    console.log('📁 user-uploads 버킷 생성 중...');
    
    const { data: userUploadsBucket, error: userUploadsError } = await supabase.storage
      .createBucket('user-uploads', {
        public: true, // 공개 접근 허용
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        fileSizeLimit: 10 * 1024 * 1024, // 10MB 제한
      });

    if (userUploadsError) {
      if (userUploadsError.message.includes('already exists')) {
        console.log('ℹ️ user-uploads 버킷이 이미 존재합니다');
      } else {
        console.error('❌ user-uploads 버킷 생성 실패:', userUploadsError);
      }
    } else {
      console.log('✅ user-uploads 버킷 생성 성공:', userUploadsBucket);
    }

    // 2. generated-images 버킷 확인/생성
    console.log('📁 generated-images 버킷 확인 중...');
    
    const { data: generatedImagesBucket, error: generatedImagesError } = await supabase.storage
      .createBucket('generated-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        fileSizeLimit: 20 * 1024 * 1024, // 20MB 제한
      });

    if (generatedImagesError) {
      if (generatedImagesError.message.includes('already exists')) {
        console.log('ℹ️ generated-images 버킷이 이미 존재합니다');
      } else {
        console.error('❌ generated-images 버킷 생성 실패:', generatedImagesError);
      }
    } else {
      console.log('✅ generated-images 버킷 생성 성공:', generatedImagesBucket);
    }

    // 3. 생성된 버킷 목록 확인
    console.log('📋 현재 Storage 버킷 목록:');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ 버킷 목록 조회 실패:', listError);
    } else {
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (공개: ${bucket.public ? 'Yes' : 'No'})`);
      });
    }

    console.log('🎉 Storage 버킷 생성 작업 완료!');
    
  } catch (error) {
    console.error('❌ Storage 버킷 생성 중 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
createStorageBuckets();