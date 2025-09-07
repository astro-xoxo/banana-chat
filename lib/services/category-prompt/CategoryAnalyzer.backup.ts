/**
 * CategoryAnalyzer - 7개 카테고리별 키워드 추출 시스템
 * Claude API를 사용하여 채팅 메시지에서 카테고리별 키워드 추출
 */

import { 
  CategoryKeywords, 
  CategoryAnalysisResult, 
  ChatContext, 
  CategoryType 
} from './types';

interface ClaudeClient {
  messages: {
    create: (params: any) => Promise<any>;
  };
}

export class CategoryAnalyzer {
  private cache: Map<string, CategoryAnalysisResult> = new Map();
  private cacheSize = 1000;
  private cacheTTL = 1000 * 60 * 30; // 30분

  constructor(private claudeClient: ClaudeClient) {}

  /**
   * 채팅 메시지에서 7개 카테고리별 키워드 추출
   */
  async extractKeywords(
    message: string,
    context?: ChatContext
  ): Promise<CategoryAnalysisResult> {
    const startTime = Date.now();
    
    // 캐시 확인
    const cacheKey = this.getCacheKey(message, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Claude API로 키워드 추출
      const extracted = await this.extractWithClaudeAPI(message, context);
      
      const result: CategoryAnalysisResult = {
        extracted_keywords: extracted,
        confidence_scores: this.calculateConfidenceScores(extracted, message),
        analysis_method: 'claude_api',
        processing_time_ms: Date.now() - startTime
      };

      // 캐시 저장
      this.saveToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Claude API 키워드 추출 실패:', error);
      
      // 폴백 추출 사용
      const extracted = this.fallbackExtraction(message);
      
      return {
        extracted_keywords: extracted,
        confidence_scores: this.calculateConfidenceScores(extracted, message),
        analysis_method: 'fallback',
        processing_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Claude API를 사용한 키워드 추출
   */
  private async extractWithClaudeAPI(
    message: string,
    context?: ChatContext
  ): Promise<CategoryKeywords> {
    const prompt = this.buildExtractionPrompt(message, context);
    
    const response = await this.claudeClient.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature: 0.1
    });

    return this.parseClaudeResponse(response.content[0].text);
  }

  /**
   * 키워드 추출을 위한 프롬프트 생성
   */
  private buildExtractionPrompt(message: string, context?: ChatContext): string {
    const contextInfo = context?.recent_messages?.length 
      ? `\n\n최근 대화 맥락:\n${context.recent_messages.join('\n')}`
      : '';

    return `다음 채팅 메시지에서 이미지 생성을 위한 5개 카테고리별 키워드를 추출해주세요.
각 카테고리에서 가장 적합한 키워드 1개만 선택하세요.

메시지: "${message}"${contextInfo}

카테고리별 키워드 추출 (JSON 형식으로 응답):
{
  "location_environment": "위치/환경 키워드 (예: 카페에서, 집에서, 공원에서)",
  "outfit_style": "의상/스타일 키워드 (예: 캐주얼, 정장, 여름옷)", 
  "action_pose": "행동/포즈 키워드 (예: 앉아있는, 웃고있는, 걷는)",
  "expression_emotion": "표정/감정 키워드 (예: 행복한, 따뜻한, 로맨틱한)",
  "atmosphere_lighting": "분위기/조명 키워드 (예: 자연광, 따뜻한, 부드러운)"
}

키워드가 명확하지 않으면 "default"를 사용하세요.`;
  }

  /**
   * Claude API 응답 파싱
   */
  private parseClaudeResponse(response: string): CategoryKeywords {
    try {
      // JSON 부분만 추출
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON 형식을 찾을 수 없음');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        location_environment: parsed.location_environment || 'default',
        outfit_style: parsed.outfit_style || 'default',
        action_pose: parsed.action_pose || 'default',
        expression_emotion: parsed.expression_emotion || 'default',
        atmosphere_lighting: parsed.atmosphere_lighting || 'default'
      };
    } catch (error) {
      console.error('Claude 응답 파싱 실패:', error);
      return this.getDefaultKeywords();
    }
  }

  /**
   * 다수 키워드 중 최적 1개 선택 로직
   */
  private selectBestKeyword(
    keywords: string[], 
    category: CategoryType, 
    fullContext: string
  ): string {
    if (keywords.length <= 1) {
      return keywords[0] || 'default';
    }

    // 전체 맥락에서 각 키워드의 적합도 계산
    const scores = keywords.map(keyword => ({
      keyword,
      score: this.calculateContextRelevance(keyword, fullContext, category)
    }));

    // 가장 높은 점수의 키워드 반환
    const best = scores.reduce((prev, curr) => 
      curr.score > prev.score ? curr : prev
    );

    return best.keyword;
  }

  /**
   * 키워드의 컨텍스트 적합도 계산
   */
  private calculateContextRelevance(
    keyword: string, 
    context: string, 
    category: CategoryType
  ): number {
    let score = 0;
    const lowerContext = context.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    // 키워드가 컨텍스트에 직접 포함되면 높은 점수
    if (lowerContext.includes(lowerKeyword)) {
      score += 10;
    }

    // 관련 단어 근접도 계산
    const relatedWords = this.getRelatedWords(category);
    relatedWords.forEach(word => {
      if (lowerContext.includes(word.toLowerCase())) {
        score += word === lowerKeyword ? 5 : 2;
      }
    });

    return score;
  }

  /**
   * 카테고리별 관련 단어 목록
   */
  private getRelatedWords(category: CategoryType): string[] {
    const relatedWords = {
      location_environment: ['집', '카페', '공원', '사무실', '학교', '해변', '산', '숲'],
      outfit_style: ['옷', '의상', '정장', '캐주얼', '드레스', '티셔츠', '코트'],
      action_pose: ['앉다', '서다', '걷다', '웃다', '요리', '자다', '운동'],
      expression_emotion: ['행복', '기쁘다', '사랑', '따뜻', '부드럽다', '웃다'],
      atmosphere_lighting: ['밝다', '어둡다', '따뜻', '차갑다', '자연광', '조명']
    };
    
    return relatedWords[category] || [];
  }

  /**
   * 폴백 키워드 추출 (Claude API 실패 시)
   */
  private fallbackExtraction(message: string): CategoryKeywords {
    const lowerMessage = message.toLowerCase();
    
    return {
      location_environment: this.extractLocationFallback(lowerMessage),
      outfit_style: this.extractOutfitFallback(lowerMessage),
      action_pose: this.extractActionFallback(lowerMessage),
      expression_emotion: this.extractExpressionFallback(lowerMessage),
      atmosphere_lighting: this.extractAtmosphereFallback(lowerMessage)
    };
  }

  private extractLocationFallback(message: string): string {
    const locationKeywords = ['집', '카페', '공원', '해변', '사무실', '학교', '산', '숲'];
    for (const keyword of locationKeywords) {
      if (message.includes(keyword)) {
        return keyword + '에서';
      }
    }
    return 'default';
  }

  private extractOutfitFallback(message: string): string {
    const outfitKeywords = ['정장', '캐주얼', '운동복', '드레스', '여름옷', '겨울옷'];
    for (const keyword of outfitKeywords) {
      if (message.includes(keyword)) {
        return keyword;
      }
    }
    return 'default';
  }

  private extractActionFallback(message: string): string {
    const actionKeywords = ['앉', '서', '걷', '웃', '요리', '자', '운동', '읽'];
    for (const keyword of actionKeywords) {
      if (message.includes(keyword)) {
        return keyword + '고있는';
      }
    }
    return 'default';
  }

  private extractExpressionFallback(message: string): string {
    const expressionKeywords = ['행복', '기쁜', '사랑', '따뜻', '로맨틱', '부드러운'];
    for (const keyword of expressionKeywords) {
      if (message.includes(keyword)) {
        return keyword + '한';
      }
    }
    return 'default';
  }

  private extractAtmosphereFallback(message: string): string {
    const atmosphereKeywords = ['밝', '어두운', '따뜻', '부드러운', '자연광', '아늑'];
    for (const keyword of atmosphereKeywords) {
      if (message.includes(keyword)) {
        return keyword + '한';
      }
    }
    return 'default';
  }

  /**
   * 신뢰도 점수 계산
   */
  private calculateConfidenceScores(
    keywords: CategoryKeywords,
    originalMessage: string
  ): Record<keyof CategoryKeywords, number> {
    const lowerMessage = originalMessage.toLowerCase();
    
    return {
      location_environment: this.getKeywordConfidence(keywords.location_environment, lowerMessage),
      outfit_style: this.getKeywordConfidence(keywords.outfit_style, lowerMessage),
      action_pose: this.getKeywordConfidence(keywords.action_pose, lowerMessage),
      expression_emotion: this.getKeywordConfidence(keywords.expression_emotion, lowerMessage),
      atmosphere_lighting: this.getKeywordConfidence(keywords.atmosphere_lighting, lowerMessage)
    };
  }

  private getKeywordConfidence(keyword: string, message: string): number {
    if (keyword === 'default') return 0.3;
    
    const keywordBase = keyword.replace(/(에서|한|고있는)$/, '');
    if (message.includes(keywordBase.toLowerCase())) {
      return 0.9;
    }
    
    return 0.6;
  }

  /**
   * 기본 키워드 반환
   */
  private getDefaultKeywords(): CategoryKeywords {
    return {
      location_environment: 'default',
      outfit_style: 'default', 
      action_pose: 'default',
      expression_emotion: 'default',
      atmosphere_lighting: 'default'
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
   * 통계 정보
   */
  getStats() {
    return {
      cache_size: this.cache.size,
      cache_limit: this.cacheSize
    };
  }
}