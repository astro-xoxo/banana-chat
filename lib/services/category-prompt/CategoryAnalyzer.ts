/**
 * CategoryAnalyzer - 2단계 Claude API 기반 컨텍스트 분석 서비스
 * Step 1: 전체 대화 컨텍스트를 분석하여 상황 파악
 * Step 2: 분석된 컨텍스트를 바탕으로 이미지 프롬프트 생성
 */

import Anthropic from '@anthropic-ai/sdk';
import { 
  CategoryKeywords, 
  CategoryAnalysisResult, 
  ChatContext, 
  CategoryType 
} from './types';

interface ContextAnalysis {
  location: string;
  activity: string;
  mood: string;
  time_of_day: string;
  weather: string;
  clothing_context: string;
  physical_state: string;
  social_context: string;
  tense_context: string;
}

// 숨겨진 태그 시스템을 위한 인터페이스
interface HiddenTags {
  location?: string;
  emotion?: string;
  action?: string;
  atmosphere?: string;
  outfit?: string;
  position?: string;
}

export class CategoryAnalyzer {
  private anthropic: Anthropic;
  private cache: Map<string, CategoryAnalysisResult> = new Map();
  private cacheSize = 1000;
  private cacheTTL = 1000 * 60 * 30; // 30분
  
  // 통계 추적
  private stats = {
    total_extractions: 0,
    context_analyses: 0,
    api_calls: 0,
    cache_hits: 0
  };

  constructor() {
    // 공식 Anthropic SDK 클라이언트 초기화 - 2단계 API 구조
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY, // 환경 변수에서 자동 로드
    });
    
    console.log('✅ CategoryAnalyzer 초기화 완료 - 2단계 API 구조 (CategoryMapper 제거)');
  }

  /**
   * HTML 주석 태그에서 정보 추출 (숨겨진 태그 시스템)
   */
  private parseHiddenTags(message: string): { cleanMessage: string; hiddenTags: HiddenTags } {
    let cleanMessage = message;
    const hiddenTags: HiddenTags = {};
    
    // HTML 주석 패턴 매칭
    const tagPatterns = [
      { key: 'location', pattern: /<!--\s*LOCATION:\s*([^-]+?)\s*-->/gi },
      { key: 'emotion', pattern: /<!--\s*EMOTION:\s*([^-]+?)\s*-->/gi },
      { key: 'action', pattern: /<!--\s*ACTION:\s*([^-]+?)\s*-->/gi },
      { key: 'atmosphere', pattern: /<!--\s*ATMOSPHERE:\s*([^-]+?)\s*-->/gi },
      { key: 'outfit', pattern: /<!--\s*OUTFIT:\s*([^-]+?)\s*-->/gi },
      { key: 'position', pattern: /<!--\s*POSITION:\s*([^-]+?)\s*-->/gi }
    ];
    
    console.log('🏷️ 숨겨진 태그 파싱 시작:', message.substring(0, 100));
    
    for (const { key, pattern } of tagPatterns) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        const value = match[1].trim();
        if (value) {
          hiddenTags[key as keyof HiddenTags] = value;
          // 원본 메시지에서 태그 제거
          cleanMessage = cleanMessage.replace(match[0], '');
          console.log(`✅ ${key.toUpperCase()} 태그 발견:`, value);
        }
      }
    }
    
    // 연속된 공백과 줄바꿈 정리
    cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
    
    const hasHiddenTags = Object.keys(hiddenTags).length > 0;
    console.log('🏷️ 태그 파싱 완료:', {
      has_tags: hasHiddenTags,
      tags_found: Object.keys(hiddenTags),
      clean_message_preview: cleanMessage.substring(0, 50),
      original_length: message.length,
      clean_length: cleanMessage.length
    });
    
    return { cleanMessage, hiddenTags };
  }

  /**
   * 메인 키워드 추출 메서드 - 2단계 API 방식 + 숨겨진 태그 지원
   */
  async extractKeywords(
    message: string,
    context?: ChatContext
  ): Promise<CategoryAnalysisResult> {
    const startTime = Date.now();
    this.stats.total_extractions++;
    
    // 🏷️ 첫 단계: 숨겨진 태그 파싱
    const { cleanMessage, hiddenTags } = this.parseHiddenTags(message);
    const processingMessage = cleanMessage || message; // 태그가 없으면 원본 사용
    
    // 캐시 확인 (태그 정보도 포함)
    const cacheKey = this.getCacheKey(processingMessage + JSON.stringify(hiddenTags), context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log('✅ 캐시에서 결과 반환 (태그 시스템)');
      this.stats.cache_hits++;
      return cached;
    }

    try {
      console.log('🤖 2단계 API 분석 시작 (숨겨진 태그 시스템)');
      console.log('📝 원본 메시지:', message.substring(0, 100));
      console.log('🧹 정제된 메시지:', processingMessage.substring(0, 100));
      console.log('🏷️ 발견된 태그:', hiddenTags);
      console.log('📚 컨텍스트:', context?.recent_messages?.slice(-3));
      
      // Step 1: 컨텍스트 기반 상세 분석 (태그 정보 포함)
      const contextAnalysis = await this.analyzeContext(processingMessage, context, hiddenTags);
      console.log('📊 Step 1 - 컨텍스트 분석 완료:', contextAnalysis);
      
      // Step 2: 분석 결과를 이미지 프롬프트로 변환 (태그 정보 반영)
      const imagePrompt = await this.generateImagePrompt(contextAnalysis, processingMessage, hiddenTags);
      console.log('🎨 Step 2 - 이미지 프롬프트 생성 완료:', imagePrompt);
      
      this.stats.context_analyses++;
      this.stats.api_calls += 2; // 2번의 API 호출
      
      const result: CategoryAnalysisResult = {
        extracted_keywords: imagePrompt,
        confidence_scores: this.calculateConfidenceScores(imagePrompt, message),
        analysis_method: 'two_step_api',
        processing_time_ms: Date.now() - startTime,
        corrections_applied: [],
        reasoning: `Step 1: ${JSON.stringify(contextAnalysis, null, 2)}`
      };
      
      console.log('💾 결과 캐시 저장');
      this.saveToCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('2단계 API 분석 실패:', error);
      // 폴백: 기본값 반환
      return this.createEmptyResult('error', Date.now() - startTime);
    }
  }

  /**
   * Step 1: 전체 대화 컨텍스트 분석 + 숨겨진 태그 활용
   */
  private async analyzeContext(
    message: string,
    context?: ChatContext,
    hiddenTags?: HiddenTags
  ): Promise<ContextAnalysis> {
    try {
      // 🏷️ 태그 정보가 있는 경우 우선 활용
      const hasHiddenTags = hiddenTags && Object.keys(hiddenTags).length > 0;
      
      const systemPrompt = `당신은 대화 컨텍스트를 분석하여 이미지 생성에 필요한 정보를 추출하는 전문가입니다.
주어진 메시지와 대화 기록을 종합적으로 분석하여 다음 정보를 정확히 파악해주세요:

1. location: 현재 위치/장소 (예: 산, 등산로, 카페, 해변, 집, 사무실 등)
2. activity: 현재 하고 있는 활동 (예: 등산, 휴식, 대화, 작업 등)  
3. mood: 전반적인 분위기/감정 (예: 평화로운, 활기찬, 로맨틱한 등)
4. time_of_day: 시간대 (예: 아침, 오후, 저녁, 밤)
5. weather: 날씨 상태 (예: 맑은, 흐린, 비오는 등)
6. clothing_context: 상황에 맞는 복장 (예: 등산복, 캐주얼, 정장 등)
7. physical_state: 신체 상태 (예: 활기찬, 피곤한, 편안한 등)
8. social_context: 사회적 맥락 (예: 혼자, 연인과 함께, 친구들과 등)
9. tense_context: 시제 및 맥락 (예: current_action, future_reference, past_memory, hypothetical)

🏷️ 숨겨진 태그 시스템 우선 활용 지침:
${hasHiddenTags ? `
- HTML 주석 태그에서 추출된 정보를 최우선으로 사용하세요
- LOCATION 태그: 현재 배경/위치로 정확히 반영 
  * "호수 한가운데" → location: "호수 중앙" (수영장이 아님!)
  * "호숫가" → location: "호수 가장자리" (수영장이 아님!)
  * "대피소 문가" → location: "대피소 입구"  
  * "카페" → location: "카페 실내"
- POSITION 태그: 위치의 세부사항으로 활용
  * "중앙" → location에 "중앙" 정보 통합
  * "가장자리" → location에 "가장자리" 정보 통합
- EMOTION 태그: 감정/표정 정보로 직접 활용 
  * "불안한" → mood: "불안한"
  * "즐거운" → mood: "즐거운"
  * "장난스러운" → mood: "장난스러운"
- ACTION 태그: 현재 동작/포즈로 반영 
  * "서있는" → activity: "서있기"
  * "수영하는" → activity: "수영"
  * "물장구치는" → activity: "물장구치기"
- ATMOSPHERE 태그: 전체 분위기로 활용
- OUTFIT 태그: 복장 정보로 직접 사용 (활동 기반 자동 매핑 반영)
  * "수영복" → clothing_context: "수영복"
  * "등산복" → clothing_context: "등산복"

🎯 중요: 태그 정보가 있으면 메시지 해석보다 태그를 절대 우선하세요!
🎯 특히 LOCATION + POSITION 조합은 정확한 공간 인식을 위해 필수입니다!
` : '- 태그 정보가 없으므로 메시지 내용과 대화 맥락을 종합 분석하세요'}

일반적인 분석 지침:
- 이전 대화 기록을 반드시 고려하여 전체적인 상황을 파악하세요
- 현재와 비현재 구분: "보여요", "있어요" = 비현재(future_reference), "에서", "에 있어요" = 현재(current_action)
- 감정 기술: "겁에 질린", "놀란", "무서운" 등 강한 감정도 정확히 파악
- *별표* 안의 내용은 상황 설명이므로 특히 주의깊게 분석하세요  
- 대화 흐름과 맥락을 종합적으로 고려하세요

JSON 형식으로만 응답하세요. 마크다운 블록은 사용하지 마세요.`;

      const userPrompt = `현재 메시지: "${message}"
${hasHiddenTags ? `\n🏷️ 추출된 태그 정보:\n${JSON.stringify(hiddenTags, null, 2)}` : ''}
${context?.recent_messages?.length ? `\n최근 대화:\n${context.recent_messages.join('\n')}` : ''}

${hasHiddenTags ? 
  '🏷️ 태그 정보를 최우선으로 활용하여 9가지 정보를 추출해주세요. 태그로 명시된 정보는 그대로 적용하세요.' : 
  '위 대화를 분석하여 9가지 정보를 추출해주세요.'
}`;

      console.log('🤖 Step 1 - Claude API 호출 중...', {
        model: 'claude-sonnet-4-20250514',
        messageLength: message.length,
        contextMessages: context?.recent_messages?.length || 0
      });

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      if (!response.content[0] || response.content[0].type !== 'text') {
        throw new Error('Claude API 응답 형식이 올바르지 않습니다');
      }

      const content = response.content[0].text;
      console.log('📊 Step 1 - Claude API 응답 수신:', {
        contentLength: content.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        rawContent: content
      });
      
      // JSON 응답에서 코드 블록 제거
      const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      console.log('🧹 Step 1 - 정제된 JSON:', cleanContent);
      
      const analysis = JSON.parse(cleanContent);
      
      return {
        location: analysis.location || '실내',
        activity: analysis.activity || '대화',
        mood: analysis.mood || '편안한',
        time_of_day: analysis.time_of_day || '낮',
        weather: analysis.weather || '맑은',
        clothing_context: analysis.clothing_context || '캐주얼',
        physical_state: analysis.physical_state || '편안한',
        social_context: analysis.social_context || '혼자',
        tense_context: analysis.tense_context || 'current_action'
      };
      
    } catch (error) {
      console.error('컨텍스트 분석 실패:', error);
      // 기본값 반환
      return {
        location: '실내',
        activity: '대화',
        mood: '편안한',
        time_of_day: '낮',
        weather: '맑은',
        clothing_context: '캐주얼',
        physical_state: '편안한',
        social_context: '혼자',
        tense_context: 'current_action'
      };
    }
  }

  /**
   * Step 2: 컨텍스트 분석을 이미지 프롬프트로 변환 + 태그 정보 최종 반영
   */
  private async generateImagePrompt(
    analysis: ContextAnalysis,
    originalMessage: string,
    hiddenTags?: HiddenTags
  ): Promise<CategoryKeywords> {
    try {
      const hasHiddenTags = hiddenTags && Object.keys(hiddenTags).length > 0;
      
      const systemPrompt = `당신은 대화 컨텍스트 분석 결과를 ComfyUI 이미지 생성 프롬프트로 변환하는 전문가입니다.
주어진 분석 결과를 바탕으로 각 카테고리별로 적절한 영어 키워드를 생성해주세요.

카테고리별 키워드 생성 규칙:
1. location_environment: 장소와 환경 묘사 (3-5개 키워드)
2. outfit_style: 상황에 맞는 복장 스타일 (2-4개 키워드)  
3. action_pose: 현재 동작이나 포즈 (2-3개 키워드)
4. expression_emotion: 표정과 감정 상태 (2-3개 키워드)
5. atmosphere_lighting: 전체적인 분위기와 조명 (3-4개 키워드)

🏷️ 숨겨진 태그 시스템 최종 반영 지침:
${hasHiddenTags ? `
- HTML 주석 태그 정보를 최우선으로 정확히 반영하세요
- LOCATION 태그가 있으면 해당 정보를 location_environment에 정확히 적용
- POSITION 태그 또는 LOCATION에 포함된 위치 정보로 공간 세부화
- EMOTION 태그가 있으면 해당 감정을 expression_emotion에 직접 반영
- ACTION 태그가 있으면 해당 동작을 action_pose에 정확히 적용
- ATMOSPHERE 태그가 있으면 atmosphere_lighting에 반영
- OUTFIT 태그가 있으면 outfit_style에 직접 활용 (활동 기반 자동 매핑 반영됨)

🎯 정확한 위치 번역 (세부 위치 포함):
- "호수 한가운데" → location_environment: "lake center, middle of lake, deep lake water, central lake area" (NOT pool/swimming pool)
- "호숫가" → location_environment: "lakeside, natural lake shore, lake waterfront, lake edge" (NOT pool/swimming pool)
- "호수" → location_environment: "natural lake, freshwater lake, scenic lake" (NOT pool)  
- "해변" → location_environment: "beach, ocean shore, seaside" (NOT pool)
- "수영장" → location_environment: "swimming pool, pool area, poolside" (ONLY if explicitly mentioned)

🎯 활동 기반 복장 정확한 반영:
- "수영복" → outfit_style: "swimsuit, swimwear, swimming attire, bathing suit"
- "등산복" → outfit_style: "hiking clothes, outdoor gear, trekking attire"
- "캐주얼" → outfit_style: "casual wear, comfortable clothing"

🎯 감정/동작 정확한 반영:
- "망설이는" → expression_emotion: "hesitant expression, uncertain look, contemplative"  
- "즐거운" → expression_emotion: "joyful expression, happy smile, delighted look"
- "장난스러운" → expression_emotion: "mischievous smile, playful expression, teasing look"
- "수영하는" → action_pose: "swimming, in water, aquatic activity"
- "물장구치는" → action_pose: "splashing water, playful water movement, water play"

태그로 지정된 정보는 분석 결과보다 우선하여 정확히 번역해서 사용하세요!
특히 LOCATION의 세부 위치 정보를 정확히 반영하여 혼동을 방지하세요!
` : '- 태그 정보 없음: 분석 결과만으로 키워드 생성'}

각 키워드는 간단하고 명확한 영어 단어나 짧은 구문으로 작성하세요.
JSON 형식으로만 응답하세요. 마크다운 블록은 사용하지 마세요.`;

      const userPrompt = `컨텍스트 분석 결과:
${JSON.stringify(analysis, null, 2)}

${hasHiddenTags ? `🏷️ 우선 반영할 태그 정보:
${JSON.stringify(hiddenTags, null, 2)}` : ''}

원본 메시지: "${originalMessage}"

${hasHiddenTags ? 
  '🏷️ 태그 정보를 최우선으로 정확히 반영하여 5개 카테고리의 이미지 생성 키워드를 만들어주세요.' :
  '위 분석을 바탕으로 5개 카테고리의 이미지 생성 키워드를 만들어주세요.'
}`;

      console.log('🎨 Step 2 - Claude API 호출 중...', {
        model: 'claude-sonnet-4-20250514',
        analysisResults: analysis
      });

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        temperature: 0.4,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      if (!response.content[0] || response.content[0].type !== 'text') {
        throw new Error('Claude API 응답 형식이 올바르지 않습니다');
      }

      const content = response.content[0].text;
      console.log('🎨 Step 2 - Claude API 응답 수신:', {
        contentLength: content.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        rawContent: content
      });

      // JSON 응답에서 코드 블록 제거  
      const cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      console.log('🧹 Step 2 - 정제된 JSON:', cleanContent);

      const keywords = JSON.parse(cleanContent);
      
      // 키워드 검증 및 정리
      return {
        location_environment: this.validateKeyword(keywords.location_environment) || 'indoor comfortable',
        outfit_style: this.validateKeyword(keywords.outfit_style) || 'casual comfortable',
        action_pose: this.validateKeyword(keywords.action_pose) || 'standing relaxed',
        expression_emotion: this.validateKeyword(keywords.expression_emotion) || 'pleasant natural',
        atmosphere_lighting: this.validateKeyword(keywords.atmosphere_lighting) || 'soft lighting warm'
      };
      
    } catch (error) {
      console.error('🚨 Step 2 - 이미지 프롬프트 생성 실패:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        analysis: analysis,
        originalMessage: originalMessage
      });
      
      // 기본 키워드 반환
      return {
        location_environment: 'indoor comfortable',
        outfit_style: 'casual stylish',
        action_pose: 'standing natural pose',
        expression_emotion: 'pleasant friendly',
        atmosphere_lighting: 'soft lighting warm atmosphere'
      };
    }
  }

  /**
   * 키워드 유효성 검증 및 변환
   */
  private validateKeyword(keyword: any): string | null {
    // 배열 형태의 키워드를 문자열로 조합
    if (Array.isArray(keyword)) {
      const combinedKeyword = keyword.filter(k => typeof k === 'string' && k.length > 0).join(' ');
      return combinedKeyword.length > 0 ? 
        (combinedKeyword.length > 100 ? combinedKeyword.substring(0, 100) : combinedKeyword) : 
        null;
    }
    
    // 문자열 형태 검증
    if (typeof keyword !== 'string' || keyword.length === 0) {
      return null;
    }
    
    // 키워드 길이 제한 (100자 이내)
    return keyword.length > 100 ? keyword.substring(0, 100) : keyword;
  }

  /**
   * 신뢰도 점수 계산
   */
  private calculateConfidenceScores(
    keywords: CategoryKeywords,
    originalMessage: string
  ): Record<keyof CategoryKeywords, number> {
    // 2단계 API 방식이므로 높은 신뢰도 부여
    return {
      location_environment: 0.85,
      outfit_style: 0.80,
      action_pose: 0.80,
      expression_emotion: 0.75,
      atmosphere_lighting: 0.75
    };
  }

  /**
   * 빈 결과 생성 (오류 발생 시)
   */
  private createEmptyResult(method: string, processingTime: number): CategoryAnalysisResult {
    return {
      extracted_keywords: {
        location_environment: 'indoor comfortable',
        outfit_style: 'casual comfortable',
        action_pose: 'standing natural',
        expression_emotion: 'pleasant friendly',
        atmosphere_lighting: 'soft lighting warm'
      },
      confidence_scores: {
        location_environment: 0.30,
        outfit_style: 0.30,
        action_pose: 0.30,
        expression_emotion: 0.30,
        atmosphere_lighting: 0.30
      },
      analysis_method: method,
      processing_time_ms: processingTime,
      corrections_applied: ['API 실패로 인한 기본값 사용'],
      reasoning: 'API failure - using default values'
    };
  }

  /**
   * 캐시 관련 메서드
   */
  private getCacheKey(message: string, context?: ChatContext): string {
    const contextStr = context?.recent_messages?.join('|') || '';
    return `${message}_${contextStr}`;
  }

  private saveToCache(key: string, result: CategoryAnalysisResult): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, result);
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    return {
      cache_size: this.cache.size,
      cache_limit: this.cacheSize,
      performance_stats: {
        total_extractions: this.stats.total_extractions,
        context_analyses: this.stats.context_analyses,
        api_calls: this.stats.api_calls,
        cache_hits: this.stats.cache_hits,
        cache_hit_rate: this.stats.total_extractions > 0 ? 
          ((this.stats.cache_hits / this.stats.total_extractions) * 100).toFixed(2) + '%' : '0%',
        api_success_rate: this.stats.total_extractions > 0 ? 
          ((this.stats.context_analyses / this.stats.total_extractions) * 100).toFixed(2) + '%' : '0%'
      }
    };
  }
}