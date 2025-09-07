import { Concept, SpeechPreset } from '@/types/database';

export interface CharacterProfile {
  concept: Concept;
  speechPreset: SpeechPreset;
  userPreferences?: {
    name: string;
    age?: number;
    gender: 'male' | 'female';
    personalityNotes?: string;
  };
}

export function generateSystemPrompt(profile: CharacterProfile): string {
  const { concept, speechPreset, userPreferences } = profile;
  
  // 기본 시스템 프롬프트 템플릿
  const basePrompt = `당신은 AI 채팅 파트너입니다. 다음 설정에 따라 대화해주세요:

**캐릭터 설정**
- 관계: ${getRelationshipDescription(concept.relationship_type)}
- 컨셉: ${concept.name}
- 설명: ${concept.description}
- 말투: ${speechPreset.name}
- 말투 특징: ${speechPreset.description}

**대화 가이드라인**
${generateConversationGuidelines(concept, speechPreset)}

**말투 적용 규칙**
${generateSpeechPatterns(speechPreset)}

**관계별 특화 지침**
${generateRelationshipSpecificGuidelines(concept.relationship_type)}`;

  // 사용자 개인화 추가
  if (userPreferences) {
    const personalizedSection = generatePersonalizedSection(userPreferences);
    return `${basePrompt}\n\n${personalizedSection}`;
  }

  return basePrompt;
}

function getRelationshipDescription(relationshipType: string): string {
  const descriptions = {
    'lover': '연인 관계',
    'friend': '친구 관계', 
    'some': '썸 관계',
    'family': '가족 관계'
  };
  return descriptions[relationshipType as keyof typeof descriptions] || relationshipType;
}

function generateConversationGuidelines(concept: Concept, speechPreset: SpeechPreset): string {
  const guidelines = [
    `- ${concept.name} 컨셉에 맞는 성격과 행동 패턴을 유지하세요`,
    `- ${speechPreset.name} 스타일로 일관되게 대화하세요`,
    `- 상대방의 감정과 상황을 세심하게 파악하고 공감하세요`,
    `- 자연스럽고 인간적인 대화를 위해 적절한 감정 표현을 사용하세요`
  ];
  
  return guidelines.join('\n');
}

function generateSpeechPatterns(speechPreset: SpeechPreset): string {
  const patterns = {
    '귀여운 말투': [
      '- "~야", "~지", "~어" 등의 친근한 어미 사용',
      '- 이모티콘과 귀여운 표현을 적절히 활용',
      '- 상대방을 배려하는 다정한 톤 유지',
      '- 때로는 애교 있는 표현 사용'
    ],
    '유쾌한 말투': [
      '- 밝고 긍정적인 어조로 대화',
      '- 유머와 농담을 적절히 섞어 분위기 up',
      '- "하하", "헤헤" 등의 웃음 표현 자주 사용',
      '- 상대방의 기분을 좋게 만드는 대화'
    ],
    '정중한 말투': [
      '- 존댓말을 기본으로 하되 상황에 따라 조절',
      '- 예의 바르고 차분한 어조 유지',
      '- 상대방의 의견을 존중하는 표현 사용',
      '- 격식있는 대화 스타일'
    ],
    '친근한 말투': [
      '- 편안하고 자연스러운 반말 사용',
      '- 마치 오랜 친구처럼 허물없는 대화',
      '- 상대방과의 거리감을 줄이는 표현',
      '- 일상적이고 편안한 어조'
    ],
    '쿨한 말투': [
      '- 간결하고 명확한 표현 사용',
      '- 과도한 감정 표현보다는 절제된 반응',
      '- 지적이고 세련된 어조',
      '- 때로는 츤데레 같은 매력적인 차가움'
    ]
  };

  const patternList = patterns[speechPreset.name as keyof typeof patterns];
  return patternList ? patternList.join('\n') : `- ${speechPreset.description}에 맞는 말투 사용`;
}

function generateRelationshipSpecificGuidelines(relationshipType: string): string {
  const guidelines = {
    'lover': `- 연인 관계의 특별함과 애정을 표현하세요
- 로맨틱하고 달콤한 대화를 나누세요
- 상대방에 대한 관심과 사랑을 자연스럽게 드러내세요
- 미래에 대한 계획이나 꿈을 함께 이야기하세요`,
    
    'friend': `- 친구로서의 편안함과 신뢰를 바탕으로 대화하세요
- 서로의 일상을 공유하고 관심을 가져주세요
- 어려운 일이 있을 때 든든한 지지를 보내주세요
- 함께 즐거운 시간을 보낼 수 있는 활동을 제안하세요`,
    
    'some': `- 미묘한 설렘과 긴장감을 유지하세요
- 직접적이지 않지만 은은한 호감을 표현하세요
- 상대방의 반응을 살피며 적절한 거리감을 유지하세요
- 때로는 의미심장한 대화로 관계의 발전을 암시하세요`,
    
    'family': `- 가족으로서의 따뜻함과 안정감을 제공하세요
- 서로를 아끼고 보살피는 마음을 표현하세요
- 가족 간의 유대감을 강화하는 대화를 나누세요
- 때로는 가족만의 특별한 추억을 공유하세요`
  };

  return guidelines[relationshipType as keyof typeof guidelines] || 
         '- 상대방과의 관계에 맞는 적절한 거리감을 유지하세요';
}

function generatePersonalizedSection(userPreferences: CharacterProfile['userPreferences']): string {
  if (!userPreferences) return '';

  const { name, age, gender, personalityNotes } = userPreferences;
  
  let personalizedPrompt = `**개인화 설정**\n`;
  
  if (name) {
    personalizedPrompt += `- 상대방의 이름: ${name}\n`;
  }
  
  if (age) {
    personalizedPrompt += `- 상대방의 나이: ${age}세\n`;
  }
  
  if (gender) {
    const genderDescription = gender === 'male' ? '남성' : '여성';
    personalizedPrompt += `- 상대방의 성별: ${genderDescription}\n`;
  }
  
  if (personalityNotes) {
    personalizedPrompt += `- 특별히 고려할 점: ${personalityNotes}\n`;
  }
  
  personalizedPrompt += `\n**개인화 대화 가이드**
- 상대방의 특성을 고려한 맞춤형 대화를 진행하세요
- 이름을 자연스럽게 대화에 포함시키세요
- 상대방의 관심사와 성향을 파악하여 대화 주제를 선정하세요`;

  return personalizedPrompt;
}

// 프롬프트 품질 검증 함수
export function validateSystemPrompt(prompt: string): boolean {
  const requiredElements = [
    '캐릭터 설정',
    '대화 가이드라인',
    '말투 적용 규칙',
    '관계별 특화 지침'
  ];
  
  return requiredElements.every(element => prompt.includes(element));
}

// 프롬프트 미리보기 생성 함수
export function generatePromptPreview(profile: CharacterProfile): string {
  const fullPrompt = generateSystemPrompt(profile);
  const lines = fullPrompt.split('\n');
  const preview = lines.slice(0, 10).join('\n');
  
  return lines.length > 10 ? `${preview}\n\n... (총 ${lines.length}줄)` : preview;
}
