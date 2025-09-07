const { Client } = require('pg');

const client = new Client({
  host: 'aws-0-ap-northeast-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.thnboxxfxahwkawzgcjj',
  password: '3exoqpCdDIBHoO2U',
  ssl: { rejectUnauthorized: false }
});

async function getRecentAIMessages() {
  try {
    await client.connect();
    console.log('Connected to database');

    // 최근 3개 채팅방의 마지막 AI 메시지 가져오기
    const query = `
      WITH recent_sessions AS (
        SELECT DISTINCT cs.id as session_id, cs.chatbot_id, cb.name as chatbot_name,
               MAX(cm.created_at) as last_message_time
        FROM chat_sessions cs
        JOIN chatbots cb ON cs.chatbot_id = cb.id
        JOIN chat_messages cm ON cs.id = cm.session_id
        WHERE cm.role = 'assistant'
        GROUP BY cs.id, cs.chatbot_id, cb.name
        ORDER BY MAX(cm.created_at) DESC
        LIMIT 3
      )
      SELECT rs.session_id, rs.chatbot_id, rs.chatbot_name,
             cm.content, cm.created_at
      FROM recent_sessions rs
      JOIN chat_messages cm ON rs.session_id = cm.session_id
      WHERE cm.role = 'assistant' 
        AND cm.created_at = rs.last_message_time
      ORDER BY cm.created_at DESC;
    `;

    const result = await client.query(query);
    
    console.log('\n=== 최근 3개 채팅방의 마지막 AI 메시지 ===\n');
    
    result.rows.forEach((row, index) => {
      console.log(`[채팅방 ${index + 1}]`);
      console.log(`챗봇 이름: ${row.chatbot_name}`);
      console.log(`세션 ID: ${row.session_id}`);
      console.log(`메시지 시간: ${row.created_at}`);
      console.log(`메시지 내용:\n${row.content}\n`);
      console.log('-'.repeat(80));
    });

    // ComfyUI 프롬프트로 변환
    console.log('\n=== ComfyUI 프롬프트 변환 ===\n');
    
    result.rows.forEach((row, index) => {
      const prompt = convertToComfyUIPrompt(row.content, row.chatbot_name);
      console.log(`[프롬프트 ${index + 1} - ${row.chatbot_name}]`);
      console.log(prompt);
      console.log('\n' + '='.repeat(80) + '\n');
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

function convertToComfyUIPrompt(aiMessage, chatbotName) {
  // AI 메시지에서 시각적 요소 추출
  const visualElements = [];
  
  // 감정 표현 추출
  if (aiMessage.includes('웃') || aiMessage.includes('😊') || aiMessage.includes('ㅎㅎ')) {
    visualElements.push('smiling face');
  }
  if (aiMessage.includes('걱정') || aiMessage.includes('우려')) {
    visualElements.push('concerned expression');
  }
  if (aiMessage.includes('흥분') || aiMessage.includes('기대')) {
    visualElements.push('excited expression');
  }
  
  // 행동 묘사 추출
  if (aiMessage.includes('도와') || aiMessage.includes('돕')) {
    visualElements.push('helpful gesture');
  }
  if (aiMessage.includes('생각') || aiMessage.includes('고민')) {
    visualElements.push('thoughtful pose');
  }
  
  // 환경/분위기 추출
  if (aiMessage.includes('편안') || aiMessage.includes('안심')) {
    visualElements.push('comfortable atmosphere');
  }
  if (aiMessage.includes('긴장') || aiMessage.includes('조심')) {
    visualElements.push('tense atmosphere');
  }
  
  // 기본 프롬프트 구조
  let prompt = `portrait of ${chatbotName}, anime style character, `;
  
  // 추출한 시각적 요소 추가
  if (visualElements.length > 0) {
    prompt += visualElements.join(', ') + ', ';
  }
  
  // 기본 스타일 요소
  prompt += 'high quality, detailed face, soft lighting, professional illustration, digital art';
  
  // 메시지 톤에 따른 추가 요소
  if (aiMessage.length > 200) {
    prompt += ', engaged in conversation, expressive';
  }
  if (aiMessage.includes('?')) {
    prompt += ', curious expression, questioning look';
  }
  if (aiMessage.includes('!')) {
    prompt += ', energetic, dynamic pose';
  }
  
  return prompt;
}

// 스크립트 실행
getRecentAIMessages();
