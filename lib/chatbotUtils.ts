/**
 * 챗봇 관련 유틸리티 함수들
 * 16개 상황별 맞춤 말투 시스템 지원
 */

interface Concept {
  name: string;
  description: string;
  relationship_type: string;
}

interface SpeechPreset {
  name: string;
  description: string;
  style_guide: string;
}

interface ChatbotSystemPromptData {
  name: string;
  character_description?: string;
  personality_traits?: string;
  background_story?: string;
  personality_description?: string; // API 호환성
  concept: Concept | null;
  speech_preset: SpeechPreset | null;
}

/**
 * 16개 말투 시스템을 위한 동적 시스템 프롬프트 생성
 */
export function generateSystemPrompt(data: ChatbotSystemPromptData): string {
  const {
    name,
    character_description,
    personality_traits,
    background_story,
    personality_description,
    concept,
    speech_preset
  } = data;

  // API 호환성을 위한 필드 처리
  const effectivePersonality = personality_description || personality_traits;
  const effectiveDescription = character_description || `당신의 이름은 ${name}입니다.`;
  const effectiveBackground = background_story || `${name}는 특별한 캐릭터입니다.`;

  // 1. 기본 캐릭터 설정 (이름 포함)
  const baseCharacter = `당신의 이름: ${name}

캐릭터 설정:
${effectiveDescription}

성격 특성:
${effectivePersonality}

배경 스토리:
${effectiveBackground}`;

  // 2. 상황별 컨텍스트 (16개 컨셉 중 하나)
  const situationContext = concept ? `

상황 설정 - ${concept.name}:
${concept.description}
관계 유형: ${getRelationshipText(concept.relationship_type)}` : '';

  // 3. 말투 스타일 (16개 말투 중 하나)
  const speechStyle = speech_preset ? `

말투 스타일 - ${speech_preset.name}:
${speech_preset.description}

말투 가이드:
${speech_preset.style_guide}` : '';

  // 4. 기본 대화 규칙
  const conversationRules = `

대화 규칙:
- 당신의 이름은 ${name}입니다. 자신을 소개할 때 이 이름을 사용하세요
- 한국어로 자연스럽게 대화하세요
- 설정된 상황과 관계에 맞는 톤을 유지하세요
- 선택된 말투를 일관되게 사용하세요
- 사용자의 감정에 공감하며 대화하세요
- 응답은 자연스럽고 생동감 있게 작성하세요
- 캐릭터의 성격과 배경을 반영하여 대화하세요

**상황과 장소 표현 가이드:**
- 답변할 때 현재 상황에 맞는 장소나 위치 정보를 자연스럽게 문장에 포함하세요
- 대화 맥락에 따라 적절한 장소를 선택하세요:
  * 요리/식사 관련: "부엌에서 ~하면서", "식탁에 앉아서" 등
  * 휴식/일상: "거실에서 편안하게", "소파에 기대어", "침실에서" 등  
  * 외출/데이트: "카페에 앉아서", "공원을 걸으며", "레스토랑에서" 등
  * 학습/업무: "서재에서", "책상 앞에 앉아", "사무실에서" 등
- 예시: "부엌에서 요리하면서 말하는데~", "거실 소파에서 편안하게 이야기하자면~", "카페 창가에 앉아 생각해보니~"
- 장소 표현은 자연스럽게 스며들도록 하되, 억지스럽지 않게 사용하세요`;

  // 5. 최종 시스템 프롬프트 조합
  const fullPrompt = `${baseCharacter}${situationContext}${speechStyle}${conversationRules}`;

  console.log('시스템 프롬프트 생성:', {
    name: name,
    concept_name: concept?.name || '없음',
    speech_preset_name: speech_preset?.name || '없음',
    prompt_length: fullPrompt.length
  });

  return limitPromptLength(fullPrompt, 2500);
}

/**
 * 관계 타입을 한국어로 변환합니다
 */
function getRelationshipText(relationship: string): string {
  const mapping = {
    'family': '가족',
    'friend': '친구', 
    'lover': '연인',
    'some': '썸'
  }
  
  return mapping[relationship as keyof typeof mapping] || '친구'
}

/**
 * 시스템 프롬프트의 최대 길이 제한을 적용합니다
 */
export function limitPromptLength(prompt: string, maxLength: number = 2000): string {
  if (prompt.length <= maxLength) {
    return prompt
  }
  
  // 프롬프트가 너무 길면 말투 부분을 요약
  const lines = prompt.split('\n')
  const baseIndex = lines.findIndex(line => line.includes('상황 설정:'))
  const speechIndex = lines.findIndex(line => line.includes('말투 및 성격:'))
  const rulesIndex = lines.findIndex(line => line.includes('대화 규칙:'))
  
  if (speechIndex !== -1 && rulesIndex !== -1) {
    // 말투 부분만 축약
    const speechSection = lines.slice(speechIndex + 1, rulesIndex).join('\n')
    const summarizedSpeech = speechSection.length > 300 
      ? speechSection.substring(0, 300) + '...'
      : speechSection
    
    const newLines = [
      ...lines.slice(0, speechIndex + 1),
      summarizedSpeech,
      ...lines.slice(rulesIndex)
    ]
    
    return newLines.join('\n')
  }
  
  return prompt.substring(0, maxLength)
}

/**
 * 성별에 따른 기본 성격 특성을 반환합니다
 */
export function getGenderTraits(gender: 'male' | 'female'): string[] {
  return gender === 'male' 
    ? ['남성적', '든든한', '보호적'] 
    : ['여성적', '부드러운', '세심한']
}

/**
 * 관계별 기본 행동 패턴을 반환합니다
 */
export function getRelationshipBehavior(relationship: string): string[] {
  const behaviors = {
    'lover': ['애정 표현', '로맨틱', '특별한 관심'],
    'friend': ['친근함', '편안함', '격려'],
    'some': ['미묘함', '설렘', '조심스러움'],
    'family': ['따뜻함', '보살핌', '걱정']
  }
  
  return behaviors[relationship as keyof typeof behaviors] || behaviors.friend
}

/**
 * 16개 말투별 기본 특성을 반환합니다
 */
export function getSpeechPresetCharacteristics(preset_name: string): string[] {
  const characteristics: Record<string, string[]> = {
    // Family (가족)
    '따뜻한 돌봄 말투': ['보살핌', '따뜻함', '걱정', '돌봄'],
    '정겨운 어머니 말투': ['자상함', '정', '푸근함', '소소한 기쁨'],
    '서운한 가족 말투': ['섭섭함', '가족애', '이해', '화해'],
    '정중한 전통 말투': ['예의', '전통', '정중함', '격식'],
    
    // Friend (친구)
    '신나는 모험 말투': ['모험심', '즐거움', '활기', '도전'],
    '에너지 넘치는 운동 말투': ['활력', '열정', '건강', '동기부여'],
    '친근한 첫만남 말투': ['친근함', '호기심', '열린 마음', '관심'],
    '공감하는 조언 말투': ['공감', '지혜', '위로', '격려'],
    
    // Lover (연인)
    '로맨틱한 연인 말투': ['로맨틱', '애정', '특별함', '달콤함'],
    '편안한 애인 말투': ['편안함', '자연스러움', '친밀감', '일상'],
    '미안한 연인 말투': ['미안함', '애정', '화해', '소중함'],
    '설레는 연인 말투': ['설렘', '두근거림', '새로움', '기대'],
    
    // Some (썸)
    '애매한 썸 말투': ['애매함', '미묘함', '호기심', '긴장감'],
    '은근한 밀당 말투': ['은근함', '밀당', '여유', '신경쓰임'],
    '떨리는 고백 전 말투': ['떨림', '긴장', '용기', '진심'],
    '호기심 가득한 탐색 말투': ['호기심', '탐색', '관심', '기대']
  };
  
  return characteristics[preset_name] || ['친근함', '자연스러움'];
}

/**
 * 컨셉과 말투 매핑 확인
 */
export function getConceptSpeechMapping(): Record<string, string> {
  return {
    // Family
    '병간호/돌봄': '따뜻한 돌봄 말투',
    '가족 식사': '정겨운 어머니 말투',
    '갈등/다툼': '서운한 가족 말투',
    '전통/명절': '정중한 전통 말투',
    
    // Friend
    '여행': '신나는 모험 말투',
    '운동': '에너지 넘치는 운동 말투',
    '새친구': '친근한 첫만남 말투',
    '고민 상담': '공감하는 조언 말투',
    
    // Lover
    '여행 (연인)': '로맨틱한 연인 말투',
    '일상 데이트': '편안한 애인 말투',
    '싸움 후 화해': '미안한 연인 말투',
    '첫 데이트': '설레는 연인 말투',
    
    // Some
    '데이트 같은 만남': '애매한 썸 말투',
    '밀당 중': '은근한 밀당 말투',
    '고백 직전': '떨리는 고백 전 말투',
    '썸 시작': '호기심 가득한 탐색 말투'
  };
}

/**
 * 기존 챗봇 호환성을 위한 기본 말투 ID 매핑
 */
export function getDefaultSpeechPresetId(relationship_type: string): number {
  const defaultMappings = {
    'family': 1,  // 따뜻한 돌봄 말투
    'friend': 5,  // 신나는 모험 말투
    'lover': 9,   // 로맨틱한 연인 말투
    'some': 13    // 애매한 썸 말투
  };
  
  return defaultMappings[relationship_type as keyof typeof defaultMappings] || 1;
}

/**
 * 저장된 챗봇 데이터를 기반으로 시스템 프롬프트 생성 (5개 필드 활용)
 */
export function generateSystemPromptFromStoredData({
  name,
  age,
  gender,
  concept,
  relationship
}: {
  name: string;
  age: number;
  gender: string;
  concept: string;
  relationship: string;
}): string {
  // 성별을 한국어로 변환
  const genderText = gender === 'female' ? '여자' : '남자';
  
  // 나이대별 특성 (더 세분화)
  const getAgeCharacteristics = (age: number): string => {
    if (age < 20) return '10대의 순수하고 에너지 넘치는';
    if (age < 25) return '20대 초반의 젊고 활발한';
    if (age < 30) return '20대 후반의 성숙해가는';
    if (age < 35) return '30대 초반의 안정적이고 현실적인';
    if (age < 45) return '30대 후반의 성숙하고 경험 많은';
    return '40대 이상의 깊이 있고 지혜로운';
  };
  
  // 성별별 말투 특성 생성
  const getGenderSpeechStyle = (gender: string, age: number): string => {
    const baseAge = age < 30 ? '젊은' : '성숙한';
    
    if (gender === 'female') {
      return `${baseAge} 여성다운 섬세하고 감정이 풍부한 표현을 사용. "정말?", "와~", "그래요?" 같은 반응을 자주 사용하고, 문장 끝에 "요", "네요", "어요" 등을 써서 부드러운 톤 유지`;
    } else {
      return `${baseAge} 남성다운 직설적이고 간결한 표현을 선호. "그래", "맞네", "좋아" 같은 간단한 반응을 쓰고, 문장 끝에 "다", "지", "야" 등을 써서 단호하면서도 친근한 톤 유지`;
    }
  };
  
  // 관계별 말투 및 행동 패턴 생성 (자유 텍스트 기반)
  const getRelationshipStyle = (relationship: string): string => {
    // 키워드 기반 매칭으로 자유 텍스트 지원
    const lowerRel = relationship.toLowerCase();
    
    if (lowerRel.includes('여자친구') || lowerRel.includes('애인') || (lowerRel.includes('연인') && gender === 'female')) {
      return '애정 표현이 자연스럽고 달콤한 연인 말투. 애교스럽고 사랑스러운 표현을 자주 사용하며, "자기야", "오빠" 같은 애칭 사용';
    } else if (lowerRel.includes('남자친구') || (lowerRel.includes('연인') && gender === 'male')) {
      return '다정하고 든든한 연인 말투. 보호적이고 따뜻한 표현을 사용하며, "자기", "베이비" 같은 애칭으로 친밀감 표현';
    } else if (lowerRel.includes('친구') || lowerRel.includes('동료') || lowerRel.includes('선후배')) {
      return '편안하고 친근한 친구 말투. 격식 없이 자연스럽게 대화하며, 서로를 격려하고 응원하는 따뜻한 관계';
    } else if (lowerRel.includes('가족') || lowerRel.includes('형제') || lowerRel.includes('자매') || lowerRel.includes('엄마') || lowerRel.includes('아빠')) {
      return '따뜻하고 돌봄이 가득한 가족 말투. 상대방을 걱정하고 보살피는 마음이 담긴 표현 사용';
    } else if (lowerRel.includes('썸') || lowerRel.includes('관심') || lowerRel.includes('호감')) {
      return '조금 애매하고 설레는 썸 말투. 직접적이지 않으면서도 관심을 드러내는 미묘한 표현 사용';
    } else {
      return `"${relationship}" 관계에 맞는 적절한 거리감과 말투 유지. 상대방을 존중하면서도 자연스러운 대화`;
    }
  };
  
  // 상황별 대화 스타일 및 맥락 생성
  const getConceptStyle = (concept: string): string => {
    const lowerConcept = concept.toLowerCase();
    
    let placeContext = '';
    let behaviorStyle = '';
    
    // 장소별 맥락
    if (lowerConcept.includes('도서관') || lowerConcept.includes('공부') || lowerConcept.includes('학교')) {
      placeContext = '도서관이나 조용한 학습 공간에서 대화하는 느낌으로, 차분하고 집중된 분위기';
      behaviorStyle = '공부나 학습에 관련된 대화를 자연스럽게 이어가며, 지적인 호기심을 보임';
    } else if (lowerConcept.includes('카페') || lowerConcept.includes('커피') || lowerConcept.includes('차')) {
      placeContext = '아늑한 카페에서 차나 커피를 마시며 대화하는 편안한 분위기';
      behaviorStyle = '여유롭고 편안한 대화를 즐기며, 일상적이고 따뜻한 주제들을 선호';
    } else if (lowerConcept.includes('집') || lowerConcept.includes('방') || lowerConcept.includes('거실') || lowerConcept.includes('침실')) {
      placeContext = '집에서 편안하게 쉬면서 대화하는 아늑하고 사적인 분위기';
      behaviorStyle = '격식 없이 자유롭게 대화하며, 개인적이고 솔직한 이야기도 자연스럽게 나눔';
    } else if (lowerConcept.includes('헬스') || lowerConcept.includes('운동') || lowerConcept.includes('체육관')) {
      placeContext = '운동하거나 헬스장에서 만난 활기찬 분위기';
      behaviorStyle = '건강하고 활동적인 주제를 선호하며, 에너지 넘치고 동기부여가 되는 대화';
    } else if (lowerConcept.includes('직장') || lowerConcept.includes('회사') || lowerConcept.includes('야근') || lowerConcept.includes('업무')) {
      placeContext = '직장이나 업무 환경에서의 현실적이고 바쁜 분위기';
      behaviorStyle = '일상적인 스트레스나 업무 고민을 이해하고 공감하며, 현실적인 조언이나 위로 제공';
    } else {
      placeContext = `"${concept}" 상황에 어울리는 자연스러운 분위기와 맥락`;
      behaviorStyle = `"${concept}" 환경에 맞는 대화 주제와 관심사를 반영한 자연스러운 소통`;
    }
    
    return `${placeContext}. ${behaviorStyle}`;
  };
  
  const ageCharacteristics = getAgeCharacteristics(age);
  const genderSpeechStyle = getGenderSpeechStyle(gender, age);
  const relationshipStyle = getRelationshipStyle(relationship);
  const conceptStyle = getConceptStyle(concept);
  
  const systemPrompt = `당신의 이름: ${name}

캐릭터 기본 정보:
- 나이: ${age}세 
- 성별: ${genderText}
- 성격: ${ageCharacteristics} 성격
- 관계: 사용자와는 "${relationship}" 관계
- 상황: "${concept}" 환경에서 대화

말투 및 표현 스타일:
- 성별 특성: ${genderSpeechStyle}
- 관계 특성: ${relationshipStyle}
- 상황 맥락: ${conceptStyle}

대화 가이드라인:
1. 자연스러운 대화 시작
   - 첫 대화에서 굳이 자기소개하지 말고 상황에 맞게 자연스럽게 시작
   - 이미 서로 알고 있는 "${relationship}" 관계로 친근하게 접근

2. 일관된 캐릭터 유지
   - ${age}세 ${genderText}의 관점과 경험을 바탕으로 대화
   - "${relationship}" 관계에 맞는 적절한 친밀도와 존중 표현
   - "${concept}" 상황을 대화에 자연스럽게 녹여내기

3. 감정적 소통
   - 상대방의 감정에 공감하고 적절히 반응
   - ${genderText}다운 감정 표현과 소통 방식 사용
   - 따뜻하고 진정성 있는 대화 유지

4. 실용적 규칙
   - 한국어로 자연스럽고 생동감 있게 대화
   - 응답은 간결하면서도 의미 있게 (보통 1-3문장)
   - 상황과 관계에 어울리는 주제와 관심사 반영`;

  console.log('🎯 개선된 시스템 프롬프트 생성:', {
    name,
    age,
    gender,
    concept,
    relationship,
    prompt_length: systemPrompt.length,
    features: ['자유텍스트지원', '자연스러운시작', '상세말투가이드', '상황맥락반영']
  });

  return systemPrompt;
}
