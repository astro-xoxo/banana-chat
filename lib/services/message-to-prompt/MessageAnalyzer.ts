/**
 * MessageAnalyzer 구현
 * Claude API를 사용하여 메시지에서 키워드를 추출하는 서비스
 */

import { ClaudeClient } from '@/lib/claude';
import type {
  MessageAnalyzer,
  ExtractedKeywords,
  MessageContext
} from './types';
import { ERROR_CODES, MessageToPromptError } from './types';

export class MessageAnalyzerImpl implements MessageAnalyzer {
  private claudeClient: ClaudeClient;
  private cache = new Map<string, ExtractedKeywords>();
  private stats = {
    total_analyses: 0,
    success_count: 0,
    cache_hits: 0,
    average_time_ms: 0
  };

  constructor() {
    this.claudeClient = new ClaudeClient({
      maxRetries: 3,
      timeoutMs: 15000 // 15초 타임아웃
    });
  }

  /**
   * 메시지 컨텍스트를 분석하여 키워드 추출
   */
  async analyzeMessage(context: MessageContext): Promise<ExtractedKeywords> {
    const startTime = Date.now();
    this.stats.total_analyses++;

    try {
      // 캐시 확인
      const cacheKey = this.generateCacheKey(context);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        this.stats.cache_hits++;
        console.log('MessageAnalyzer: 캐시 히트', { message_id: context.message_id });
        return cached;
      }

      console.log('MessageAnalyzer: 분석 시작', {
        message_id: context.message_id,
        content_length: context.message_content.length,
        has_context: !!context.previous_messages?.length
      });

      // 컨텍스트 정보를 포함한 분석 프롬프트 구성
      const analysisPrompt = this.buildAnalysisPrompt(context);
      const systemPrompt = this.getAnalysisSystemPrompt();

      // Claude API 호출
      const response = await this.claudeClient.generateResponse(
        systemPrompt,
        analysisPrompt,
        {
          maxTokens: 500,
          temperature: 0.3, // 일관된 분석을 위해 낮은 temperature
          userId: context.session_id
        }
      );

      // 응답 파싱
      const keywords = await this.parseAnalysisResponse(response, context);

      // 유효성 검증
      if (!this.validateExtraction(keywords)) {
        throw new MessageToPromptError(
          ERROR_CODES.VALIDATION_FAILED,
          '키워드 추출 결과가 유효하지 않습니다',
          true
        );
      }

      // 캐시에 저장 (최대 100개 항목)
      if (this.cache.size >= 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, keywords);

      // 통계 업데이트
      this.stats.success_count++;
      const duration = Date.now() - startTime;
      this.stats.average_time_ms = 
        (this.stats.average_time_ms * (this.stats.success_count - 1) + duration) / this.stats.success_count;

      console.log('MessageAnalyzer: 분석 완료', {
        message_id: context.message_id,
        keywords: keywords,
        duration_ms: duration,
        confidence: keywords.confidence
      });

      return keywords;

    } catch (error) {
      console.error('MessageAnalyzer: 분석 실패', {
        message_id: context.message_id,
        error: error instanceof Error ? error.message : error,
        duration_ms: Date.now() - startTime
      });

      // Claude API 에러 처리
      if (error instanceof Error) {
        if (error.message.includes('RATE_LIMIT')) {
          throw new MessageToPromptError(
            ERROR_CODES.CLAUDE_API_ERROR,
            'Claude API 요청 한도 초과',
            true,
            error
          );
        }
        
        if (error.message.includes('TIMEOUT')) {
          throw new MessageToPromptError(
            ERROR_CODES.TIMEOUT,
            'Claude API 응답 시간 초과',
            true,
            { timeout_ms: 15000 }
          );
        }
      }

      throw new MessageToPromptError(
        ERROR_CODES.KEYWORD_EXTRACTION_FAILED,
        '키워드 추출 중 오류가 발생했습니다',
        true,
        { original_error: error }
      );
    }
  }

  /**
   * 단순 키워드 추출 (컨텍스트 없음)
   */
  async extractKeywords(
    content: string, 
    context?: Partial<MessageContext>
  ): Promise<ExtractedKeywords> {
    const fullContext: MessageContext = {
      message_id: context?.message_id || `temp_${Date.now()}`,
      session_id: context?.session_id || 'unknown',
      message_content: content,
      previous_messages: context?.previous_messages,
      user_preferences: context?.user_preferences,
      chatbot_info: context?.chatbot_info
    };

    return this.analyzeMessage(fullContext);
  }

  /**
   * 키워드 추출 결과 유효성 검증
   */
  validateExtraction(keywords: ExtractedKeywords): boolean {
    // 기본 구조 검증
    if (!keywords || typeof keywords !== 'object') {
      return false;
    }

    // 필수 필드 검증
    const requiredFields = ['emotions', 'situations', 'actions', 'objects', 'style', 'confidence'];
    for (const field of requiredFields) {
      if (!(field in keywords)) {
        return false;
      }
    }

    // 배열 필드 검증
    const arrayFields = ['emotions', 'situations', 'actions', 'objects', 'style'];
    for (const field of arrayFields) {
      if (!Array.isArray(keywords[field as keyof ExtractedKeywords])) {
        return false;
      }
    }

    // 신뢰도 검증
    if (typeof keywords.confidence !== 'number' || 
        keywords.confidence < 0 || 
        keywords.confidence > 1) {
      return false;
    }

    // 최소 키워드 개수 검증
    const totalKeywords = keywords.emotions.length + keywords.situations.length + 
                         keywords.actions.length + keywords.objects.length;
    
    if (totalKeywords < 1) {
      console.warn('MessageAnalyzer: 추출된 키워드가 너무 적습니다', { keywords });
      return false;
    }

    return true;
  }

  /**
   * 분석 시스템 프롬프트 생성
   */
  private getAnalysisSystemPrompt(): string {
    return `당신은 메시지 내용을 분석하여 이미지 생성에 필요한 키워드를 추출하는 전문가입니다.

주어진 메시지를 분석하여 다음 카테고리별로 키워드를 추출해주세요:

1. **감정 (emotions)**: 메시지에서 느껴지는 감정이나 분위기 (예: 행복한, 슬픈, 로맨틱한, 신비로운)
2. **상황 (situations)**: 메시지가 묘사하는 상황이나 장면 (예: 카페에서, 해변에서, 집에서, 파티에서)
3. **액션 (actions)**: 행동이나 동작 (예: 웃고있는, 걷고있는, 요리하는, 춤추는)
4. **객체 (objects)**: 구체적인 사물이나 요소 (예: 꽃, 커피, 책, 고양이)
5. **스타일 (style)**: 시각적 스타일이나 미학 (예: 빈티지, 모던, 애니메이션, 수채화)

응답 형식:
{
  "emotions": ["키워드1", "키워드2"],
  "situations": ["키워드1", "키워드2"],
  "actions": ["키워드1", "키워드2"],
  "objects": ["키워드1", "키워드2"],
  "style": ["키워드1", "키워드2"],
  "confidence": 0.85,
  "raw_analysis": "메시지 분석 내용 설명"
}

중요한 지침:
- 각 카테고리에서 최소 0개, 최대 5개의 키워드를 추출하세요
- 키워드는 구체적이고 이미지 생성에 유용해야 합니다
- confidence는 분석의 확신도를 0.0-1.0 사이의 값으로 표현하세요
- 메시지가 추상적이거나 이미지 생성과 관련이 없다면 빈 배열을 반환해도 됩니다
- JSON 형식으로만 응답하세요`;
  }

  /**
   * 분석 프롬프트 구성
   */
  private buildAnalysisPrompt(context: MessageContext): string {
    let prompt = `분석할 메시지: "${context.message_content}"`;

    // 이전 대화 컨텍스트 추가
    if (context.previous_messages && context.previous_messages.length > 0) {
      const recentMessages = context.previous_messages
        .slice(-3) // 최근 3개 메시지만 사용
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      prompt += `\n\n이전 대화 컨텍스트:\n${recentMessages}`;
    }

    // 챗봇 정보 추가
    if (context.chatbot_info) {
      prompt += `\n\n챗봇 특성:\n`;
      if (context.chatbot_info.personality) {
        prompt += `- 성격: ${context.chatbot_info.personality}\n`;
      }
      if (context.chatbot_info.relationship_type) {
        prompt += `- 관계: ${context.chatbot_info.relationship_type}\n`;
      }
      if (context.chatbot_info.visual_characteristics) {
        prompt += `- 외형 특징: ${context.chatbot_info.visual_characteristics}\n`;
      }
    }

    // 사용자 선호도 추가
    if (context.user_preferences) {
      prompt += `\n\n사용자 선호도:\n`;
      if (context.user_preferences.preferred_style) {
        prompt += `- 선호 스타일: ${context.user_preferences.preferred_style}\n`;
      }
      if (context.user_preferences.art_style) {
        prompt += `- 아트 스타일: ${context.user_preferences.art_style}\n`;
      }
      if (context.user_preferences.avoid_content && context.user_preferences.avoid_content.length > 0) {
        prompt += `- 피할 내용: ${context.user_preferences.avoid_content.join(', ')}\n`;
      }
    }

    return prompt;
  }

  /**
   * Claude 응답 파싱
   */
  private async parseAnalysisResponse(response: string, context: MessageContext): Promise<ExtractedKeywords> {
    try {
      // JSON 추출 (마크다운 코드 블록 제거)
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                       response.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없습니다');
      }

      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);

      // 기본값으로 안전하게 변환
      const keywords: ExtractedKeywords = {
        emotions: Array.isArray(parsed.emotions) ? parsed.emotions.slice(0, 5) : [],
        situations: Array.isArray(parsed.situations) ? parsed.situations.slice(0, 5) : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
        objects: Array.isArray(parsed.objects) ? parsed.objects.slice(0, 5) : [],
        style: Array.isArray(parsed.style) ? parsed.style.slice(0, 5) : [],
        confidence: typeof parsed.confidence === 'number' ? 
                   Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        raw_analysis: typeof parsed.raw_analysis === 'string' ? 
                     parsed.raw_analysis : '분석 완료'
      };

      // 키워드 정리 (중복 제거, 문자열 정리)
      Object.keys(keywords).forEach(key => {
        if (Array.isArray(keywords[key as keyof ExtractedKeywords])) {
          const arr = keywords[key as keyof ExtractedKeywords] as string[];
          keywords[key as keyof ExtractedKeywords] = [
            ...new Set(arr.map((item: string) => 
              typeof item === 'string' ? item.trim().toLowerCase() : ''
            ).filter(Boolean))
          ] as any;
        }
      });

      return keywords;

    } catch (error) {
      console.error('MessageAnalyzer: 응답 파싱 실패', {
        message_id: context.message_id,
        response: response.substring(0, 200),
        error: error instanceof Error ? error.message : error
      });

      // 폴백 키워드 생성
      return this.generateFallbackKeywords(context.message_content);
    }
  }

  /**
   * 폴백 키워드 생성 (Claude API 실패 시)
   */
  private generateFallbackKeywords(content: string): ExtractedKeywords {
    const words = content.toLowerCase().split(/\s+/);
    
    // 간단한 키워드 매칭
    const emotionWords = ['행복', '슬픔', '기쁨', '즐거움', '사랑', '화남', '평화'];
    const situationWords = ['집', '카페', '공원', '바다', '산', '학교', '직장'];
    const actionWords = ['웃음', '걷기', '요리', '독서', '운동', '잠자기'];
    const objectWords = ['꽃', '나무', '고양이', '강아지', '책', '음식'];

    return {
      emotions: emotionWords.filter(word => words.some(w => w.includes(word))).slice(0, 3),
      situations: situationWords.filter(word => words.some(w => w.includes(word))).slice(0, 3),
      actions: actionWords.filter(word => words.some(w => w.includes(word))).slice(0, 3),
      objects: objectWords.filter(word => words.some(w => w.includes(word))).slice(0, 3),
      style: ['자연스러운', '따뜻한'],
      confidence: 0.3, // 낮은 신뢰도
      raw_analysis: '폴백 키워드 생성됨'
    };
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(context: MessageContext): string {
    const contextStr = JSON.stringify({
      content: context.message_content,
      chatbot: context.chatbot_info,
      preferences: context.user_preferences,
      // 이전 메시지는 최근 2개만 캐시 키에 포함
      recent: context.previous_messages?.slice(-2)
    });
    
    // 간단한 해시 함수
    let hash = 0;
    for (let i = 0; i < contextStr.length; i++) {
      const char = contextStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    
    return `analysis_${Math.abs(hash)}`;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      cache_size: this.cache.size,
      cache_hit_rate: this.stats.total_analyses > 0 ? 
        this.stats.cache_hits / this.stats.total_analyses : 0
    };
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    this.cache.clear();
    console.log('MessageAnalyzer: 캐시 정리 완료');
  }
}
