const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabase() {
  console.log('=== 데이터베이스 상태 확인 ===\n');
  
  const tables = ['users', 'chatbots', 'messages', 'concepts', 'speech_presets'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: 존재 (행 수: ${count || 0})`);
      }
    } catch (e) {
      console.log(`❌ ${table}: 접근 불가 - ${e.message}`);
    }
  }
  
  // Day 1에 필요한 기본 데이터 확인
  console.log('\n=== Day 1 필수 데이터 확인 ===');
  
  try {
    // concepts 테이블 데이터 확인
    const { data: concepts, count: conceptCount } = await supabase
      .from('concepts')
      .select('*', { count: 'exact' });
    
    console.log(`concepts 데이터: ${conceptCount || 0}개 (필요: 16개)`);
    
    // speech_presets 테이블 데이터 확인  
    const { data: presets, count: presetCount } = await supabase
      .from('speech_presets')
      .select('*', { count: 'exact' });
    
    console.log(`speech_presets 데이터: ${presetCount || 0}개 (필요: 5개)`);
    
    // 결론
    console.log('\n=== 결론 ===');
    if (conceptCount >= 16 && presetCount >= 5) {
      console.log('✅ Day 1 데이터베이스 설정이 완벽하게 되어있습니다.');
    } else {
      console.log('❌ Day 1 데이터베이스 설정이 불완전합니다.');
      console.log('- concepts 테이블: 16개 대화 컨셉 데이터 필요');
      console.log('- speech_presets 테이블: 5개 말투 프리셋 데이터 필요');
    }
    
  } catch (error) {
    console.log('❌ 기본 데이터 확인 실패:', error.message);
  }
}

checkDatabase().catch(console.error);
