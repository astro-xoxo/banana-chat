const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.thnboxxfxahwkawzgcjj',
  password: '3exoqpCdDIBHoO2U',
  ssl: { rejectUnauthorized: false }
});

async function getDetailedMessages() {
  try {
    await client.connect();
    
    const userId = '1b240d41-e800-4afc-b29e-9b064f03ce93';

    // 더 자세한 쿼리로 3개 채팅방 확인
    const query = `
      SELECT 
        cs.id as session_id,
        cb.name as chatbot_name,
        cs.created_at as session_created,
        (
          SELECT content 
          FROM chat_messages 
          WHERE session_id = cs.id 
            AND role = 'assistant' 
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_ai_message
      FROM chat_sessions cs
      JOIN chatbots cb ON cs.chatbot_id = cb.id
      WHERE cs.user_id = $1
      ORDER BY cs.created_at DESC
      LIMIT 3;
    `;

    const result = await client.query(query, [userId]);
    
    console.log('=== test@test.com 사용자의 최근 3개 채팅방 ===\n');
    
    result.rows.forEach((row, index) => {
      console.log(`[채팅방 ${index + 1}] ${row.chatbot_name}`);
      console.log(`세션 생성: ${new Date(row.session_created).toLocaleString('ko-KR')}`);
      console.log(`마지막 AI 메시지:\n${row.last_ai_message}\n`);
      
      // 향상된 ComfyUI 프롬프트 변환
      const prompt = enhancedPromptConversion(row.last_ai_message, row.chatbot_name);
      console.log('--- ComfyUI 프롬프트 ---');
      console.log(`Positive: ${prompt.positive}\n`);
      console.log(`Negative: ${prompt.negative}\n`);
      console.log('='.repeat(100) + '\n');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

function enhancedPromptConversion(message, characterName) {
  // 메시지에서 감정과 상황 추출
  const elements = {
    emotions: [],
    actions: [],
    atmosphere: [],
    appearance: []
  };
  
  // 부끄러움/수줍음
  if (message.includes('부끄') || message.includes('수줍') || message.includes('💕')) {
    elements.emotions.push('blushing', 'shy expression', 'embarrassed');
    elements.appearance.push('pink cheeks', 'averted gaze');
  }
  
  // 당황함
  if (message.includes('당황') || message.includes('어...') || message.includes('으...')) {
    elements.emotions.push('flustered', 'surprised');
    elements.actions.push('fidgeting');
  }
  
  // 사랑/애정
  if (message.includes('자기') || message.includes('사랑') || message.includes('❤')) {
    elements.emotions.push('loving expression', 'tender smile');
    elements.atmosphere.push('romantic mood');
  }
  
  // 걱정/조심스러움
  if (message.includes('조심') || message.includes('걱정')) {
    elements.emotions.push('concerned', 'careful expression');
    elements.actions.push('gentle touch', 'cautious gesture');
  }
  
  // 귓속말
  if (message.includes('귓속말') || message.includes('속삭')) {
    elements.actions.push('whispering', 'leaning close');
    elements.atmosphere.push('intimate atmosphere');
  }
  
  // 기본 프롬프트 구성
  let positive = `1girl, ${characterName}, anime style character, `;
  
  // 요소들 추가
  if (elements.emotions.length > 0) {
    positive += elements.emotions.join(', ') + ', ';
  }
  if (elements.actions.length > 0) {
    positive += elements.actions.join(', ') + ', ';
  }
  if (elements.atmosphere.length > 0) {
    positive += elements.atmosphere.join(', ') + ', ';
  }
  if (elements.appearance.length > 0) {
    positive += elements.appearance.join(', ') + ', ';
  }
  
  // 품질 태그
  positive += 'detailed face, beautiful detailed eyes, perfect lighting, high quality, masterpiece, best quality, 4k, detailed illustration, professional artwork';
  
  const negative = 'low quality, worst quality, bad anatomy, bad hands, missing fingers, extra digits, fewer digits, blurry, cropped, watermark, text, error, jpeg artifacts, ugly, duplicate, morbid, mutilated';
  
  return { positive, negative };
}

// 실행
getDetailedMessages();
