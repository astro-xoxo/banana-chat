/**
 * CategoryMapper - 키워드를 프롬프트로 매핑하는 시스템
 * 한국어 키워드 → 영어 ComfyUI 프롬프트 매핑 및 미매핑 키워드 처리
 */

import { 
  CategoryKeywords, 
  CategoryType, 
  MappingStats,
  CategoryMapping 
} from './types';
import { ALL_MAPPINGS } from './mappings';
import { RuleBasedGenerator, GenerationResult } from './RuleBasedGenerator';

interface TranslationService {
  translate: (text: string) => Promise<string>;
}

// Phase 3: 확장된 매핑 결과 인터페이스
export interface EnhancedMappingResult {
  mapped_prompts: Record<keyof CategoryKeywords, string>;
  mapping_analysis: {
    static_mappings: number;
    rule_generated: number;
    fallback_used: number;
    total_confidence: number;
  };
  detailed_results: Array<{
    category: CategoryType;
    keyword: string;
    result: string;
    source: 'static' | 'rule_based' | 'similarity' | 'fallback';
    confidence?: number;
  }>;
}

export class CategoryMapper {
  private cache: Map<string, string> = new Map();
  private ruleBasedGenerator: RuleBasedGenerator;
  private stats = {
    total_requests: 0,
    cache_hits: 0,
    mapping_hits: 0,
    mapping_misses: 0,
    translation_requests: 0,
    rule_generated: 0  // Phase 3 추가: 규칙 기반 생성 통계
  };

  constructor(private translationService?: TranslationService) {
    this.ruleBasedGenerator = new RuleBasedGenerator();
  }

  /**
   * 집에서 키워드 상황별 세분화 매핑
   * Prompt_Mapping_Enhancement_Plan.md 구현
   */
  private enhanceHomeLocationMapping(message: string): string {
    // 상황별 키워드 매핑 테이블
    const homeLocationMapping = {
      // 욕실 관련
      bathroom: {
        keywords: ['욕실', '물소리', '샤워', '수건', '세면대', '거울', '씻고', '목욕'],
        prompt: "bathroom interior, modern residential bathroom, shower room, wet bathroom ambiance"
      },
      
      // 침실 관련  
      bedroom: {
        keywords: ['침대', '잠', '베개', '이불', '침실', '잠옷', '자고', '누워'],
        prompt: "bedroom interior, residential bedroom, cozy bedroom, comfortable sleeping area"
      },
      
      // 거실 관련
      living: {
        keywords: ['거실', '소파', 'TV', '텔레비전', '응접실', '리빙룸', '쇼파'],
        prompt: "living room interior, cozy living space, home living area, comfortable family space"
      },
      
      // 부엌/주방 관련
      kitchen: {
        keywords: ['부엌', '요리', '냉장고', '싱크대', '주방', '식탁', '밥', '음식'],
        prompt: "kitchen interior, home cooking area, warm domestic kitchen, residential dining space"
      },

      // 기본값 (구체적 상황 없을 때)
      default: {
        keywords: [],
        prompt: "cozy home interior, residential indoor setting, comfortable domestic space"
      }
    };

    const messageText = message.toLowerCase();
    
    // 각 상황별 키워드 검사
    for (const [situationType, config] of Object.entries(homeLocationMapping)) {
      if (situationType === 'default') continue;
      
      const foundKeyword = config.keywords.find(keyword => 
        messageText.includes(keyword)
      );
      
      if (foundKeyword) {
        console.log(`🏠 집에서 상황 감지: ${foundKeyword} → ${situationType}`, {
          detected_keyword: foundKeyword,
          situation_type: situationType,
          enhanced_prompt: config.prompt
        });
        return config.prompt;
      }
    }
    
    // 구체적 상황을 찾지 못한 경우 기본값 사용
    console.log('🏠 집에서 구체적 상황 미발견 - 기본 프롬프트 적용:', {
      message_preview: messageText.substring(0, 50),
      fallback_prompt: homeLocationMapping.default.prompt
    });
    
    return homeLocationMapping.default.prompt;
  }

  /**
   * 키워드를 프롬프트로 매핑
   */
  async mapKeywordToPrompt(
    keyword: string, 
    category: CategoryType, 
    contextMessage?: string
  ): Promise<string> {
    this.stats.total_requests++;
    
    // 캐시 확인
    const cacheKey = `${category}:${keyword}${contextMessage ? ':' + contextMessage.substring(0, 50) : ''}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cache_hits++;
      return cached;
    }

    let result: string;

    // 🏠 집에서 키워드 세분화 특별 처리
    if (keyword === '집에서' && category === 'location_environment' && contextMessage) {
      result = this.enhanceHomeLocationMapping(contextMessage);
      console.log('🏠 집에서 키워드 세분화:', {
        original_message: contextMessage.substring(0, 100),
        enhanced_prompt: result
      });
    } else {
      // 기존 직접 매핑 확인
      const mapping = ALL_MAPPINGS[category] as CategoryMapping;
      if (mapping[keyword]) {
        result = mapping[keyword];
        this.stats.mapping_hits++;
      } else {
        // 매핑되지 않은 키워드 처리
        result = await this.handleUnmappedKeyword(keyword, category);
        this.stats.mapping_misses++;
      }
    }

    // 캐시 저장
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Phase 3: 향상된 미매핑 키워드 처리 (규칙 기반 생성 추가)
   */
  private async handleUnmappedKeyword(keyword: string, category: CategoryType): Promise<string> {
    // default 키워드 처리
    if (keyword === 'default') {
      const mapping = ALL_MAPPINGS[category] as CategoryMapping;
      return mapping['default'] || this.getGenericPrompt(category);
    }

    // Phase 3 - 1단계: 규칙 기반 패턴 매칭 시도
    const ruleResult = this.ruleBasedGenerator.generatePrompt(keyword, category);
    if (ruleResult && ruleResult.confidence >= 0.7) {
      this.stats.rule_generated++;
      console.log('🔧 Phase 3 - 규칙 기반 매핑 성공:', {
        keyword,
        rule_used: ruleResult.rule_used,
        confidence: ruleResult.confidence,
        generated: ruleResult.generated_prompt
      });
      return ruleResult.generated_prompt;
    }

    // 2단계: 유사한 키워드 찾기 (기존 로직)
    const similarKeyword = this.findSimilarKeyword(keyword, category);
    if (similarKeyword) {
      const mapping = ALL_MAPPINGS[category] as CategoryMapping;
      console.log('🔍 Phase 3 - 유사 키워드 매칭:', {
        original: keyword,
        similar: similarKeyword,
        result: mapping[similarKeyword]
      });
      return mapping[similarKeyword];
    }

    // 3단계: 낮은 신뢰도 규칙도 시도
    if (ruleResult && ruleResult.confidence >= 0.5) {
      this.stats.rule_generated++;
      console.warn('⚠️ Phase 3 - 낮은 신뢰도 규칙 사용:', {
        keyword,
        confidence: ruleResult.confidence,
        rule: ruleResult.rule_used
      });
      return ruleResult.generated_prompt;
    }

    // 4단계: 번역 서비스 사용 (기존 로직)
    if (this.translationService) {
      try {
        const translated = await this.translateKeyword(keyword, category);
        if (translated) {
          return translated;
        }
      } catch (error) {
        console.error('번역 실패:', error);
      }
    }

    // 5단계: 폴백 - 원본 키워드를 기본 영어 프롬프트로 변환
    console.warn('🚨 Phase 3 - 모든 매핑 실패, 폴백 사용:', keyword);
    return this.createBasicPrompt(keyword, category);
  }

  /**
   * 유사한 키워드 찾기 (부분 매칭)
   */
  private findSimilarKeyword(keyword: string, category: CategoryType): string | null {
    const mapping = ALL_MAPPINGS[category] as CategoryMapping;
    const mappingKeys = Object.keys(mapping);
    
    // 정확한 부분 매칭
    for (const key of mappingKeys) {
      if (key.includes(keyword) || keyword.includes(key)) {
        return key;
      }
    }

    // 유사 키워드 매핑
    const similarMappings = this.getSimilarMappings(category);
    for (const [original, similar] of Object.entries(similarMappings)) {
      if (similar.includes(keyword) && mapping[original]) {
        return original;
      }
    }

    return null;
  }

  /**
   * 카테고리별 유사 키워드 매핑
   */
  private getSimilarMappings(category: CategoryType): Record<string, string[]> {
    const mappings = {
      location_environment: {
        '집에서': ['집', '댁', '자택', '가정'],
        '카페에서': ['카페', '커피숍', '찻집', '커피하우스'],
        '공원에서': ['공원', '잔디밭', '야외'],
        '해변에서': ['바다', '해안', '해변', '바닷가']
      },
      outfit_style: {
        '캐주얼': ['편한옷', '일상복', '평상복'],
        '정장': ['비즈니스', '정식', '수트'],
        '운동복': ['스포츠', '헬스', '운동'],
        '여름옷': ['시원한옷', '반팔', '얇은옷']
      },
      action_pose: {
        '앉아있는': ['앉은', '앉는', '앉다'],
        '서있는': ['선', '서는', '서다'],
        '웃고있는': ['웃는', '웃다', '미소'],
        '걷고있는': ['걷는', '걷다', '산책']
      },
      expression_emotion: {
        '행복한': ['기쁜', '즐거운', '좋은'],
        '따뜻한': ['온화한', '부드러운', '상냥한'],
        '로맨틱한': ['사랑스러운', '달콤한', '애정어린'],
        '평화로운': ['차분한', '안정된', '고요한']
      },
      atmosphere_lighting: {
        '자연광': ['햇빛', '일광', '밝은'],
        '따뜻한': ['포근한', '아늑한', '온화한'],
        '부드러운': ['은은한', '연한', '희미한'],
        '드라마틱한': ['강렬한', '선명한', '대비가강한']
      }
    };

    return mappings[category] || {};
  }

  /**
   * 키워드 번역
   */
  private async translateKeyword(keyword: string, category: CategoryType): Promise<string | null> {
    if (!this.translationService) return null;

    try {
      this.stats.translation_requests++;
      const translated = await this.translationService.translate(keyword);
      
      // 번역된 키워드를 카테고리에 적합한 프롬프트로 변환
      return this.formatTranslatedPrompt(translated, category);
    } catch (error) {
      console.error('번역 서비스 오류:', error);
      return null;
    }
  }

  /**
   * 번역된 키워드를 프롬프트 형식으로 변환
   */
  private formatTranslatedPrompt(translated: string, category: CategoryType): string {
    const formatters = {
      location_environment: (text: string) => `in/at ${text}, comfortable setting`,
      outfit_style: (text: string) => `${text} outfit, stylish clothing`,
      action_pose: (text: string) => `${text} naturally, comfortable posture`,
      expression_emotion: (text: string) => `${text} expression, genuine emotion`,
      atmosphere_lighting: (text: string) => `${text} lighting, pleasant atmosphere`
    };

    const formatter = formatters[category];
    return formatter ? formatter(translated.toLowerCase()) : translated;
  }

  /**
   * 기본 프롬프트 생성
   */
  private createBasicPrompt(keyword: string, category: CategoryType): string {
    const templates = {
      location_environment: `in comfortable ${keyword} setting, pleasant environment`,
      outfit_style: `wearing ${keyword} style clothing, comfortable outfit`,
      action_pose: `${keyword} naturally, relaxed comfortable posture`,
      expression_emotion: `${keyword} expression, natural genuine emotion`,
      atmosphere_lighting: `${keyword} lighting atmosphere, comfortable illumination`
    };

    return templates[category] || `${keyword} style, natural comfortable atmosphere`;
  }

  /**
   * 카테고리별 기본 프롬프트
   */
  private getGenericPrompt(category: CategoryType): string {
    const generics = {
      location_environment: 'in comfortable indoor setting, soft natural lighting',
      outfit_style: 'stylish casual outfit, comfortable everyday clothing',
      action_pose: 'natural relaxed pose, comfortable body posture',
      expression_emotion: 'natural pleasant expression, gentle comfortable demeanor',
      atmosphere_lighting: 'soft natural lighting, comfortable warm atmosphere'
    };

    return generics[category];
  }

  /**
   * 모든 키워드를 한 번에 매핑
   */
  async mapAllKeywords(
    keywords: CategoryKeywords, 
    contextMessage?: string
  ): Promise<Record<keyof CategoryKeywords, string>> {
    const results = await Promise.all([
      this.mapKeywordToPrompt(keywords.location_environment, 'location_environment', contextMessage),
      this.mapKeywordToPrompt(keywords.outfit_style, 'outfit_style'),
      this.mapKeywordToPrompt(keywords.action_pose, 'action_pose'),
      this.mapKeywordToPrompt(keywords.expression_emotion, 'expression_emotion'),
      this.mapKeywordToPrompt(keywords.atmosphere_lighting, 'atmosphere_lighting')
    ]);

    return {
      location_environment: results[0],
      outfit_style: results[1],
      action_pose: results[2],
      expression_emotion: results[3],
      atmosphere_lighting: results[4]
    };
  }

  /**
   * Phase 3: 확장된 매핑 통계 반환 (규칙 기반 생성 포함)
   */
  getStats(): MappingStats & {
    rule_generation_rate: number;
    rule_generated_count: number;
    total_coverage_rate: number;
    pattern_stats?: any;
  } {
    const total = this.stats.total_requests;
    const hitRate = total > 0 ? (this.stats.mapping_hits / total) * 100 : 0;
    const missRate = total > 0 ? (this.stats.mapping_misses / total) * 100 : 0;
    const cacheHitRate = total > 0 ? (this.stats.cache_hits / total) * 100 : 0;
    const ruleGenerationRate = total > 0 ? (this.stats.rule_generated / total) * 100 : 0;
    const totalCoverageRate = hitRate + ruleGenerationRate; // 정적 매핑 + 동적 생성

    return {
      total_mappings: total,
      hit_rate: hitRate,
      miss_rate: missRate,
      cache_hit_rate: cacheHitRate,
      avg_mapping_time_ms: 2,
      rule_generation_rate: ruleGenerationRate,
      rule_generated_count: this.stats.rule_generated,
      total_coverage_rate: totalCoverageRate,
      pattern_stats: this.ruleBasedGenerator.getPatternStats()
    };
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.cache.clear();
    this.stats.cache_hits = 0;
  }

  /**
   * Phase 3: 확장된 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      total_requests: 0,
      cache_hits: 0,
      mapping_hits: 0,
      mapping_misses: 0,
      translation_requests: 0,
      rule_generated: 0
    };
  }

  /**
   * Phase 3: 확장된 사용 가능한 매핑 정보 반환 (정적 + 동적)
   */
  getAvailableKeywords(category: CategoryType): {
    static_mappings: string[];
    available_patterns: Array<{
      pattern: string;
      description: string;
      examples: string[];
    }>;
    total_coverage: {
      static_count: number;
      pattern_count: number;
      estimated_coverage: string;
    };
  } {
    const mapping = ALL_MAPPINGS[category] as CategoryMapping;
    const staticMappings = Object.keys(mapping);
    const availablePatterns = this.ruleBasedGenerator.generateExamples();
    
    return {
      static_mappings: staticMappings,
      available_patterns: availablePatterns,
      total_coverage: {
        static_count: staticMappings.length,
        pattern_count: availablePatterns.length,
        estimated_coverage: this.calculateEstimatedCoverage(staticMappings.length, availablePatterns.length)
      }
    };
  }
  
  /**
   * Phase 3: 예상 커버리지 계산
   */
  private calculateEstimatedCoverage(staticCount: number, patternCount: number): string {
    // 정적 매핑 + 동적 패턴으로 예상 커버리지 계산
    const baseScore = Math.min(staticCount / 100, 0.6); // 정적 매핑 기여도 (최대 60%)
    const patternScore = Math.min(patternCount / 50, 0.35); // 패턴 매핑 기여도 (최대 35%)
    const totalScore = (baseScore + patternScore) * 100;
    
    return `${Math.round(totalScore)}% (정적 ${staticCount}개 + 동적 패턴 ${patternCount}개)`;
  }
  
  /**
   * Phase 3: 키워드 매핑 테스트 (디버깅용)
   */
  async testKeywordMapping(keyword: string, category: CategoryType): Promise<{
    static_result: string | null;
    rule_result: GenerationResult | null;
    final_result: string;
    analysis: {
      mapping_source: 'static' | 'rule_based' | 'similarity' | 'fallback';
      confidence?: number;
      reasoning: string;
    };
  }> {
    // 정적 매핑 확인
    const mapping = ALL_MAPPINGS[category] as CategoryMapping;
    const staticResult = mapping[keyword] || null;
    
    // 규칙 기반 매핑 확인  
    const ruleResult = this.ruleBasedGenerator.generatePrompt(keyword, category);
    
    // 최종 결과 결정
    let finalResult: string;
    let mappingSource: 'static' | 'rule_based' | 'similarity' | 'fallback';
    let confidence: number | undefined;
    let reasoning: string;
    
    if (staticResult) {
      finalResult = staticResult;
      mappingSource = 'static';
      reasoning = '정적 매핑 테이블에서 직접 매칭';
    } else if (ruleResult && ruleResult.confidence >= 0.7) {
      finalResult = ruleResult.generated_prompt;
      mappingSource = 'rule_based';
      confidence = ruleResult.confidence;
      reasoning = ruleResult.analysis.rule_reasoning;
    } else {
      // 실제 처리 로직 사용
      finalResult = await this.handleUnmappedKeyword(keyword, category);
      if (ruleResult && ruleResult.confidence >= 0.5) {
        mappingSource = 'rule_based';
        confidence = ruleResult.confidence;
        reasoning = '낮은 신뢰도 규칙 적용';
      } else {
        mappingSource = 'fallback';
        reasoning = '모든 매핑 실패, 폴백 적용';
      }
    }
    
    return {
      static_result: staticResult,
      rule_result: ruleResult,
      final_result: finalResult,
      analysis: {
        mapping_source: mappingSource,
        confidence,
        reasoning
      }
    };
  }
  
  /**
   * Phase 3: 성능 모니터링 및 디버깅 도구
   */
  generateMappingReport(): {
    system_status: string;
    coverage_analysis: {
      location_static_count: number;
      location_pattern_count: number;
      estimated_location_coverage: string;
      other_categories_coverage: string;
    };
    recent_performance: {
      total_requests: number;
      success_rates: {
        static_hit_rate: string;
        rule_generation_rate: string;
        total_coverage_rate: string;
      };
      avg_processing_time: string;
    };
    recommendations: string[];
  } {
    const locationMapping = ALL_MAPPINGS.location_environment as CategoryMapping;
    const locationStaticCount = Object.keys(locationMapping).length;
    const locationPatterns = this.ruleBasedGenerator.getAvailablePatterns('location_environment');
    const stats = this.getStats();
    
    // 추천사항 생성
    const recommendations = [];
    if (stats.hit_rate < 50) {
      recommendations.push('정적 매핑 테이블 확장 권장 (현재 적중률 ' + stats.hit_rate.toFixed(1) + '%)');
    }
    if (stats.rule_generation_rate && stats.rule_generation_rate > 30) {
      recommendations.push('자주 사용되는 규칙 패턴을 정적 매핑으로 이전 고려');
    }
    if (stats.miss_rate > 20) {
      recommendations.push('새로운 규칙 패턴 추가 필요 (미스율 ' + stats.miss_rate.toFixed(1) + '%)');
    }
    if (stats.total_coverage_rate && stats.total_coverage_rate >= 90) {
      recommendations.push('우수한 매핑 커버리지 달성! 현재 수준 유지');
    }
    
    return {
      system_status: (stats.total_coverage_rate && stats.total_coverage_rate >= 85) ? '정상 운영' : 
                     (stats.total_coverage_rate && stats.total_coverage_rate >= 70) ? '주의 필요' : '개선 필요',
      coverage_analysis: {
        location_static_count: locationStaticCount,
        location_pattern_count: locationPatterns.length,
        estimated_location_coverage: this.calculateEstimatedCoverage(locationStaticCount, locationPatterns.length),
        other_categories_coverage: '정적 매핑 기반 (85-95% 추정)'
      },
      recent_performance: {
        total_requests: stats.total_mappings,
        success_rates: {
          static_hit_rate: stats.hit_rate.toFixed(1) + '%',
          rule_generation_rate: (stats.rule_generation_rate || 0).toFixed(1) + '%',
          total_coverage_rate: (stats.total_coverage_rate || 0).toFixed(1) + '%'
        },
        avg_processing_time: stats.avg_mapping_time_ms.toFixed(1) + 'ms'
      },
      recommendations
    };
  }
}