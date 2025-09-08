#!/usr/bin/env node

/**
 * user-uploads 버킷의 실제 파일 목록 확인 스크립트
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserImages() {
  console.log('🔍 user-uploads 버킷 파일 확인 시작...');
  
  try {
    // 1. user-uploads 버킷의 모든 파일 목록 조회
    const { data: files, error: listError } = await supabase.storage
      .from('user-uploads')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (listError) {
      console.error('❌ 파일 목록 조회 실패:', listError);
      return;
    }

    console.log(`📁 user-uploads 버킷 파일 개수: ${files.length}`);
    
    if (files.length === 0) {
      console.log('⚠️ user-uploads 버킷이 비어있습니다!');
      return;
    }

    // 2. 파일 목록 출력
    console.log('\n📄 파일 목록:');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   크기: ${file.metadata?.size || 'unknown'} bytes`);
      console.log(`   생성일: ${file.created_at}`);
      console.log(`   수정일: ${file.updated_at}`);
      
      // 공개 URL 생성 및 테스트
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(file.name);
      
      console.log(`   공개 URL: ${urlData.publicUrl}`);
      console.log('');
    });

    // 3. 데이터베이스의 챗봇 이미지 URL과 실제 파일 비교
    console.log('🔍 데이터베이스 챗봇 이미지 URL 확인...');
    
    const { data: chatbots, error: chatbotError } = await supabase
      .from('chatbots')
      .select('id, name, user_uploaded_image_url')
      .eq('is_active', true)
      .not('user_uploaded_image_url', 'is', null)
      .limit(10);

    if (chatbotError) {
      console.error('❌ 챗봇 데이터 조회 실패:', chatbotError);
      return;
    }

    console.log(`👥 이미지가 있는 챗봇 수: ${chatbots.length}`);
    
    chatbots.forEach((bot, index) => {
      console.log(`\n${index + 1}. 챗봇: ${bot.name} (ID: ${bot.id})`);
      console.log(`   이미지 URL: ${bot.user_uploaded_image_url}`);
      
      // URL에서 파일명 추출
      const urlParts = bot.user_uploaded_image_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      console.log(`   파일명: ${fileName}`);
      
      // 실제 파일 존재 여부 확인
      const fileExists = files.some(file => file.name === fileName);
      console.log(`   파일 존재: ${fileExists ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ 사용자 이미지 확인 중 오류:', error);
  }
}

checkUserImages();