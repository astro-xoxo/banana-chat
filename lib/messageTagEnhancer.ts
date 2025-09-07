/**
 * 메시지 태그 강화 시스템
 * Claude가 생성한 메시지에 숨겨진 태그를 자동으로 추가하는 유틸리티
 */

import Anthropic from '@anthropic-ai/sdk';

interface TagExtractionResult {
  location?: string;
  emotion?: string;
  action?: string;
  atmosphere?: string;
  outfit?: string;
  position?: string;
}

export class MessageTagEnhancer {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * 시스템 프롬프트 또는 직접 전달받은 캐릭터 정보 추출
   */
  private extractCharacterInfo(
    personalityPrompt: string,
    directCharacterInfo?: {
      name?: string;
      age?: number;
      gender?: string;
      relationship?: string;
      situation?: string;
    }
  ): {
    name: string;
    age: string;
    gender: string;
    relationship: string;
    situation: string;
  } {
    // 1. 직접 전달받은 캐릭터 정보가 있으면 우선 사용
    if (directCharacterInfo) {
      console.log('🎯 직접 전달받은 캐릭터 정보 사용:', directCharacterInfo);
      return {
        name: directCharacterInfo.name || 'AI',
        age: String(directCharacterInfo.age || 25),
        gender: directCharacterInfo.gender === 'female' ? '여자' : (directCharacterInfo.gender === 'male' ? '남자' : '여자'),
        relationship: directCharacterInfo.relationship || '친구',
        situation: directCharacterInfo.situation || '일상 대화'
      };
    }
    
    // 2. 시스템 프롬프트에서 정규식으로 추출 시도
    const nameMatch = personalityPrompt.match(/당신의?\s*이름:?\s*(.+?)(?:\n|$)/);
    const ageMatch = personalityPrompt.match(/나이:?\s*(\d+)세/);
    const genderMatch = personalityPrompt.match(/성별:?\s*(남자|여자)/);
    const relationshipMatch = personalityPrompt.match(/관계:?\s*사용자와는?\s*["\"](.+?)["\"]?\s*관계/);
    const situationMatch = personalityPrompt.match(/상황:?\s*["\"](.+?)["\"]?\s*환경/);
    
    console.log('🔍 시스템 프롬프트에서 정규식 추출 결과:', {
      nameMatch: nameMatch?.[1]?.trim(),
      ageMatch: ageMatch?.[1],
      genderMatch: genderMatch?.[1],
      relationshipMatch: relationshipMatch?.[1]?.trim(),
      situationMatch: situationMatch?.[1]?.trim(),
      promptPreview: personalityPrompt.substring(0, 200) + '...'
    });
    
    const extractedInfo = {
      name: nameMatch?.[1]?.trim() || 'AI',
      age: ageMatch?.[1] || '25',
      gender: genderMatch?.[1] || '여자',
      relationship: relationshipMatch?.[1]?.trim() || '친구',
      situation: situationMatch?.[1]?.trim() || '일상 대화'
    };
    
    console.log('📊 최종 추출된 캐릭터 정보:', extractedInfo);
    return extractedInfo;
  }

  /**
   * 메시지에 숨겨진 태그를 추가
   */
  async addHiddenTags(
    message: string, 
    context: {
      recentMessages?: string[];
      chatbotPersonality?: string;
      conversationTopic?: string;
      // 🎯 직접 캐릭터 정보 전달을 위한 새 필드 추가
      characterInfo?: {
        name?: string;
        age?: number;
        gender?: string;
        relationship?: string;
        situation?: string;
      };
    }
  ): Promise<string> {
    console.log('🏷️ MessageTagEnhancer.addHiddenTags 시작:', {
      message_preview: message.substring(0, 50),
      context_keys: Object.keys(context),
      personality_preview: context.chatbotPersonality?.substring(0, 50) || 'none'
    });
    
    try {
      // Claude API로 태그 추출
      console.log('🔍 extractTagsFromMessage 호출 시도...');
      const extractedTags = await this.extractTagsFromMessage(message, context);
      console.log('🔍 extractTagsFromMessage 응답:', extractedTags);

      // 태그가 추출되지 않은 경우 원본 반환
      if (!extractedTags || Object.keys(extractedTags).length === 0) {
        console.log('🏷️ 추출된 태그 없음 - 원본 메시지 반환');
        return message;
      }

      // HTML 주석 태그 생성
      console.log('🔍 generateHiddenTags 호출 시도...');
      const hiddenTags = this.generateHiddenTags(extractedTags);
      console.log('🔍 생성된 hiddenTags:', hiddenTags);

      // 태그 + 원본 메시지 조합
      const enhancedMessage = hiddenTags + message;

      console.log('✅ 메시지 태그 강화 완료:', {
        original_length: message.length,
        enhanced_length: enhancedMessage.length,
        tags_added: Object.keys(extractedTags),
        tags_content: extractedTags,
        has_html_comments: enhancedMessage.includes('<!--'),
        enhanced_message_start: enhancedMessage.substring(0, 100)
      });

      return enhancedMessage;

    } catch (error) {
      console.error('🚨 메시지 태그 강화 실패 - 상세 오류:', {
        error_message: error instanceof Error ? error.message : error,
        error_stack: error instanceof Error ? error.stack : undefined,
        error_name: error instanceof Error ? error.name : undefined
      });
      // 실패 시 원본 메시지 반환 (안전성 우선)
      return message;
    }
  }

  /**
   * Claude API로 메시지에서 태그 정보 추출
   */
  private async extractTagsFromMessage(
    message: string,
    context: {
      recentMessages?: string[];
      chatbotPersonality?: string;
      conversationTopic?: string;
    }
  ): Promise<TagExtractionResult> {
    // 🔧 현재 캐릭터 정보 추출
    // 🎯 직접 전달받은 캐릭터 정보를 우선 사용, 없으면 시스템 프롬프트에서 추출
    const characterInfo = this.extractCharacterInfo(
      context.chatbotPersonality || '', 
      context.characterInfo
    );
    console.log('🔍 추출된 캐릭터 정보:', characterInfo);
    
    const systemPrompt = `당신은 채팅 메시지를 분석하여 이미지 생성에 필요한 태그 정보를 추출하는 전문가입니다.

🎯 현재 캐릭터 정보:
- 이름: ${characterInfo.name}
- 나이: ${characterInfo.age}세
- 성별: ${characterInfo.gender}
- 관계: ${characterInfo.relationship}
- 상황: ${characterInfo.situation}

⚠️ 중요: 태그 생성 시 위 캐릭터 정보를 반드시 반영하세요. 과거의 다른 캐릭터 설정(예: 도서관 사서)은 무시하고 현재 캐릭터에 맞는 태그만 생성하세요.

주어진 메시지를 분석하여 다음 6가지 태그를 적극적으로 추출해주세요:

1. location: 현재 위치/배경 (세부 위치 포함)
   - 기본 위치: "호수", "카페", "공원", "집" 등
   - 세부 위치: "한가운데", "가장자리", "깊은 곳", "중앙" 등
   - 최종 형태: "호수 한가운데", "호숫가 가장자리" 등

2. emotion: 감정/표정 (복합 감정 포함)
   - 직접 표현: "행복한", "불안한", "망설이는", "즐거운" 등
   - 행동에서 추론: "조심스럽게" → "조심스러운", "장난스럽게" → "장난스러운"
   - 복합 감정: "놀라면서도 즐거운", "걱정되지만 설레는" 등

3. action: 동작/포즈 (연속 동작 포함)
   - 주요 동작: "수영하는", "물장구치는", "돌고 있는" 등
   - 연속 동작: "따라가며 장난치는", "돌면서 뿜는" 등

4. atmosphere: 분위기 
   - 환경적 분위기: "로맨틱한", "평화로운", "드라마틱한" 등
   - 시간/날씨 맥락: "따뜻한 오후", "맑은 하늘" 등

5. outfit: 복장 (활동 기반 자동 추론 강화)
   - 명시된 복장: "수영복", "캐주얼", "정장" 등
   - 🔥 활동 기반 자동 추론:
     * "수영", "물장구", "호수에서" → 반드시 "수영복"
     * "등산", "산에서" → "등산복"
     * "카페에서" → "캐주얼"

6. position: 위치 세부사항 (신규 추가)
   - 공간적 위치: "중앙", "가장자리", "깊은 곳", "얕은 곳" 등
   - 상대적 위치: "주변을", "따라", "곁에서" 등

🎯 스마트 추론 규칙:
1. 활동-복장 자동 매핑:
   - 수영 관련 동작 = 수영복 필수
   - 물 관련 활동 = 수영복/물놀이복
   - 실내 활동 = 캐주얼/편안한 복장

2. 위치 세부화:
   - "호수 한가운데" = location: "호수", position: "중앙"
   - "호숫가에서" = location: "호수", position: "가장자리"

3. 누락 태그 보완:
   - action이 "수영"인데 outfit이 없으면 → outfit: "수영복" 자동 추가
   - location이 "호수"인데 position이 없으면 → 메시지에서 위치 단서 재검색

4. 일관성 검증:
   - 수영 활동 + 일반 복장 = 복장을 수영복으로 보정
   - 실내 위치 + 수영 동작 = 위치를 수영장/워터파크로 보정

JSON 형식으로만 응답하세요. 위 규칙을 반드시 적용하여 태그를 생성하세요.`;

    const userPrompt = `분석할 메시지: "${message}"

${context.recentMessages?.length ? `최근 대화 맥락:\n${context.recentMessages.join('\n')}` : ''}

${context.chatbotPersonality ? `채팅봇 성격: ${context.chatbotPersonality}` : ''}

위 메시지를 분석하여 명확한 태그 정보만 추출해주세요.`;

    try {
      console.log('🤖 태그 추출 Claude API 호출 중...');

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        temperature: 0.2, // 낮은 온도로 일관성 확보
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      if (!response.content[0] || response.content[0].type !== 'text') {
        throw new Error('Claude API 응답 형식 오류');
      }

      const content = response.content[0].text;
      
      // JSON 정제
      const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      
      console.log('🏷️ 태그 추출 응답:', cleanContent);

      const extractedTags = JSON.parse(cleanContent);
      
      // 🎯 스마트 태그 보완 및 검증 (캐릭터 정보 반영)
      const enhancedTags = this.enhanceAndValidateTags(extractedTags, message, characterInfo);
      
      console.log('🔧 태그 보완 및 검증 완료:', {
        original: extractedTags,
        enhanced: enhancedTags
      });

      return enhancedTags;

    } catch (error) {
      console.error('🚨 태그 추출 Claude API 실패:', error);
      return {};
    }
  }

  /**
   * 스마트 태그 보완 및 검증 (캐릭터 정보 반영)
   */
  private enhanceAndValidateTags(tags: TagExtractionResult, originalMessage: string, characterInfo: any): TagExtractionResult {
    const enhanced = { ...tags };
    
    console.log('🔧 태그 보완 시작:', tags);
    
    // 🔧 캐릭터 기반 태그 보정 (과거 사서 설정 무시)
    enhanced.outfit = this.correctCharacterBasedOutfit(enhanced.outfit, characterInfo, enhanced.action, enhanced.location);
    enhanced.location = this.correctCharacterBasedLocation(enhanced.location, characterInfo, originalMessage);
    
    // 1. 활동-복장 자동 매핑
    enhanced.outfit = this.autoMapOutfitFromActivity(enhanced.action, enhanced.location, enhanced.outfit);
    
    // 2. 위치 세부화 및 통합
    enhanced.location = this.enhanceLocationWithPosition(enhanced.location, enhanced.position, originalMessage);
    
    // 3. 누락 태그 보완
    this.fillMissingTags(enhanced, originalMessage);
    
    // 4. 일관성 검증 및 보정
    this.validateAndCorrectTags(enhanced);
    
    console.log('🔧 태그 보완 완료:', enhanced);
    
    return enhanced;
  }

  /**
   * 캐릭터 정보 기반 복장 보정 (과거 사서복 등 제거)
   */
  private correctCharacterBasedOutfit(currentOutfit?: string, characterInfo?: any, action?: string, location?: string): string | undefined {
    // 🔧 과거 잘못된 캐릭터 복장 제거
    if (currentOutfit?.includes('사서복') || currentOutfit?.includes('업무복')) {
      console.log('🔧 과거 사서 복장 제거:', currentOutfit);
      
      // 현재 캐릭터(20세 여자친구)에 맞는 복장으로 교체
      if (characterInfo?.relationship === '여자친구') {
        if (location?.includes('도서관') || location?.includes('학교')) {
          return '캐주얼'; // 대학생 느낌의 캐주얼
        } else {
          return '예쁜 원피스'; // 여자친구다운 복장
        }
      }
    }
    
    return currentOutfit;
  }

  /**
   * 캐릭터 정보 기반 위치 보정
   */
  private correctCharacterBasedLocation(currentLocation?: string, characterInfo?: any, message?: string): string | undefined {
    // 🔧 캐릭터 관계에 따른 위치 보정
    if (characterInfo?.relationship === '여자친구' && characterInfo?.age && parseInt(characterInfo.age) <= 25) {
      // 20대 여자친구라면 도서관보다는 데이트 장소가 자연스러움
      if (currentLocation?.includes('도서관') && !message?.includes('공부') && !message?.includes('책')) {
        console.log('🔧 캐릭터 맞춤 위치 보정: 도서관 → 카페');
        return '아늑한 카페';
      }
    }
    
    return currentLocation;
  }

  /**
   * 활동 기반 복장 자동 매핑
   */
  private autoMapOutfitFromActivity(action?: string, location?: string, currentOutfit?: string): string | undefined {
    if (currentOutfit) return currentOutfit; // 이미 복장이 지정된 경우 유지
    
    const message = action?.toLowerCase() + ' ' + (location?.toLowerCase() || '');
    
    // 수영 관련 활동 감지
    if (message.includes('수영') || message.includes('물장구') || message.includes('물') && message.includes('호수')) {
      console.log('🏊 수영 활동 감지 → 수영복 자동 적용');
      return '수영복';
    }
    
    // 등산 관련 활동 감지  
    if (message.includes('등산') || message.includes('산') || message.includes('트레킹')) {
      console.log('🥾 등산 활동 감지 → 등산복 자동 적용');
      return '등산복';
    }
    
    // 카페/실내 활동 감지
    if (message.includes('카페') || message.includes('실내') || message.includes('집')) {
      console.log('☕ 실내 활동 감지 → 캐주얼 자동 적용');
      return '캐주얼';
    }
    
    return currentOutfit;
  }

  /**
   * 위치와 세부위치 통합
   */
  private enhanceLocationWithPosition(location?: string, position?: string, originalMessage?: string): string | undefined {
    if (!location) return location;
    
    // position이 있으면 통합
    if (position) {
      const combinedLocation = `${location} ${position}`;
      console.log(`📍 위치 세부화: ${location} → ${combinedLocation}`);
      return combinedLocation;
    }
    
    // 메시지에서 위치 세부사항 재검색
    if (originalMessage) {
      const message = originalMessage.toLowerCase();
      if (location.includes('호수')) {
        if (message.includes('한가운데') || message.includes('중앙')) {
          console.log('🎯 호수 중앙 감지 → 위치 세부화');
          return '호수 한가운데';
        }
        if (message.includes('가장자리') || message.includes('호숫가')) {
          console.log('🏖️ 호수 가장자리 감지 → 위치 세부화');
          return '호숫가';
        }
        if (message.includes('깊은')) {
          console.log('🌊 깊은 호수 감지 → 위치 세부화');
          return '호수 깊은 곳';
        }
      }
    }
    
    return location;
  }

  /**
   * 누락 태그 보완
   */
  private fillMissingTags(tags: TagExtractionResult, originalMessage: string): void {
    const message = originalMessage.toLowerCase();
    
    // action이 수영인데 outfit이 없으면 수영복 추가
    if (tags.action?.includes('수영') && !tags.outfit) {
      tags.outfit = '수영복';
      console.log('🏊 수영 동작 감지 → 수영복 자동 추가');
    }
    
    // 물 관련 활동인데 location이 모호하면 구체화
    if ((tags.action?.includes('물') || tags.action?.includes('수영')) && !tags.location?.includes('호수') && !tags.location?.includes('수영장')) {
      if (message.includes('호수')) {
        tags.location = '호수';
        console.log('🏞️ 물 활동 + 호수 언급 → 위치 보완');
      }
    }
    
    // 감정이 없는데 장난스러운 행동이 있으면 감정 추가
    if (!tags.emotion && (message.includes('장난') || message.includes('뿜') || message.includes('웃'))) {
      tags.emotion = '장난스러운';
      console.log('😄 장난스러운 행동 감지 → 감정 보완');
    }
  }

  /**
   * 일관성 검증 및 보정
   */
  private validateAndCorrectTags(tags: TagExtractionResult): void {
    // 수영 활동인데 일반 복장이면 보정
    if (tags.action?.includes('수영') && tags.outfit && !tags.outfit.includes('수영복')) {
      console.log('⚠️ 수영 활동 + 일반 복장 감지 → 수영복으로 보정');
      tags.outfit = '수영복';
    }
    
    // 호수에서 활동하는데 실내 복장이면 보정
    if (tags.location?.includes('호수') && tags.outfit?.includes('정장')) {
      console.log('⚠️ 호수 + 정장 조합 감지 → 캐주얼로 보정');
      tags.outfit = '캐주얼';
    }
    
    // 실내인데 수영복이면 수영장으로 위치 보정
    if (tags.outfit?.includes('수영복') && tags.location && !tags.location.includes('호수') && !tags.location.includes('수영장') && !tags.location.includes('바다')) {
      console.log('⚠️ 수영복 + 일반 실내 감지 → 수영장으로 위치 보정');
      tags.location = '수영장';
    }
  }

  /**
   * 추출된 태그를 HTML 주석 형태로 변환
   */
  private generateHiddenTags(tags: TagExtractionResult): string {
    const htmlTags: string[] = [];

    if (tags.location) {
      htmlTags.push(`<!-- LOCATION: ${tags.location} -->`);
    }
    if (tags.emotion) {
      htmlTags.push(`<!-- EMOTION: ${tags.emotion} -->`);
    }
    if (tags.action) {
      htmlTags.push(`<!-- ACTION: ${tags.action} -->`);
    }
    if (tags.atmosphere) {
      htmlTags.push(`<!-- ATMOSPHERE: ${tags.atmosphere} -->`);
    }
    if (tags.outfit) {
      htmlTags.push(`<!-- OUTFIT: ${tags.outfit} -->`);
    }
    if (tags.position && !tags.location?.includes(tags.position)) {
      // position이 location에 이미 포함되지 않은 경우만 별도 태그 생성
      htmlTags.push(`<!-- POSITION: ${tags.position} -->`);
    }

    return htmlTags.length > 0 ? htmlTags.join('\n') + '\n' : '';
  }

  /**
   * 기존 메시지에서 태그 제거 (사용자에게 표시할 때)
   */
  static removeHiddenTags(message: string): string {
    return message.replace(/<!--[\s\S]*?-->\s*/g, '').trim();
  }

  /**
   * 메시지에 태그가 있는지 확인
   */
  static hasHiddenTags(message: string): boolean {
    return /<!--[\s\S]*?-->/.test(message);
  }
}

// 싱글톤 인스턴스
let enhancerInstance: MessageTagEnhancer | null = null;

export function getMessageTagEnhancer(): MessageTagEnhancer {
  if (!enhancerInstance) {
    enhancerInstance = new MessageTagEnhancer();
  }
  return enhancerInstance;
}

// 편의 함수
export async function enhanceMessageWithTags(
  message: string,
  context: {
    recentMessages?: string[];
    chatbotPersonality?: string;
    conversationTopic?: string;
  }
): Promise<string> {
  const enhancer = getMessageTagEnhancer();
  return await enhancer.addHiddenTags(message, context);
}