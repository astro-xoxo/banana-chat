#!/usr/bin/env node

/**
 * Supabase Storage 버킷 권한 수정 스크립트
 * user-uploads 버킷을 공개 상태로 변경하여 이미지 접근 허용
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase 클라이언트 생성 (Service Role Key 필요)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStoragePermissions() {
  console.log('🔧 Supabase Storage 권한 수정 시작...');
  
  try {
    // 1. 현재 버킷 상태 확인
    console.log('📋 현재 Storage 버킷 목록:');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ 버킷 목록 조회 실패:', listError);
      return;
    }

    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (공개: ${bucket.public ? 'Yes' : 'No'})`);
    });

    // 2. user-uploads 버킷 공개 정책 업데이트
    console.log('\n🔓 user-uploads 버킷 공개 권한 설정 중...');
    
    const { data: updateData, error: updateError } = await supabase.storage
      .updateBucket('user-uploads', {
        public: true
      });

    if (updateError) {
      console.error('❌ user-uploads 버킷 권한 수정 실패:', updateError);
      
      // RLS 정책으로 시도
      console.log('🔄 RLS 정책을 통한 권한 설정 시도...');
      
      // SELECT 정책 생성 (공개 읽기 허용)
      const { error: policyError1 } = await supabase.rpc('create_storage_policy', {
        bucket_name: 'user-uploads',
        policy_name: 'Public read access',
        policy_sql: `
          CREATE POLICY "Public read access" ON storage.objects 
          FOR SELECT USING (bucket_id = 'user-uploads');
        `
      }).catch(e => ({ error: e }));

      if (policyError1) {
        console.log('ℹ️ 정책 생성 실패 (이미 존재할 수 있음):', policyError1.message);
      }

    } else {
      console.log('✅ user-uploads 버킷 공개 권한 설정 성공:', updateData);
    }

    // 3. 수정 후 상태 재확인
    console.log('\n📋 수정 후 Storage 버킷 목록:');
    const { data: updatedBuckets, error: listError2 } = await supabase.storage.listBuckets();
    
    if (listError2) {
      console.error('❌ 버킷 목록 재조회 실패:', listError2);
    } else {
      updatedBuckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (공개: ${bucket.public ? 'Yes' : 'No'})`);
      });
    }

    // 4. 테스트 이미지 업로드 및 접근 테스트
    console.log('\n🧪 이미지 접근 테스트 시작...');
    
    // 간단한 테스트 이미지 생성 (1x1 투명 PNG)
    const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    
    const testFileName = `test-access-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(testFileName, testImageData, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ 테스트 이미지 업로드 실패:', uploadError);
    } else {
      console.log('✅ 테스트 이미지 업로드 성공:', uploadData.path);

      // 공개 URL 가져오기
      const { data: publicUrlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(testFileName);

      console.log('🔗 공개 URL:', publicUrlData.publicUrl);

      // HTTP 접근 테스트
      try {
        const response = await fetch(publicUrlData.publicUrl);
        console.log(`🌐 HTTP 접근 테스트: ${response.status} ${response.ok ? '✅' : '❌'}`);
        
        if (response.ok) {
          console.log('✅ Storage 권한 수정 성공! 이미지 접근이 가능합니다.');
        } else {
          console.error('❌ Storage 접근 여전히 실패:', await response.text());
        }
      } catch (fetchError) {
        console.error('❌ HTTP 접근 테스트 실패:', fetchError.message);
      }

      // 테스트 파일 삭제
      await supabase.storage.from('user-uploads').remove([testFileName]);
      console.log('🗑️ 테스트 파일 정리 완료');
    }

    console.log('\n🎉 Storage 권한 수정 작업 완료!');
    
  } catch (error) {
    console.error('❌ Storage 권한 수정 중 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
fixStoragePermissions();