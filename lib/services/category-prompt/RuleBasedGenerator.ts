/**
 * RuleBasedGenerator - 동적 규칙 기반 키워드 매핑 시스템
 * 정적 매핑에서 누락된 키워드들을 패턴 분석으로 동적 생성
 */

import { CategoryType } from './types';

export interface RulePattern {
  pattern: RegExp;
  category: CategoryType;
  template: string;
  confidence: number;
  description: string;
}

export interface GenerationResult {
  generated_prompt: string;
  confidence: number;
  rule_used: string;
  pattern_matched: string;
  analysis: {
    keyword: string;
    detected_category: string;
    location_type: string;
    rule_reasoning: string;
  };
}

export class RuleBasedGenerator {
  private locationRules: RulePattern[] = [
    // === 1. 매장/상점 패턴 ===
    {
      pattern: /(.+)매장$/,
      category: 'location_environment',
      template: 'in $1 store, retail commercial interior, shopping environment',
      confidence: 0.85,
      description: '○○매장 패턴 (수영복매장, 옷매장 등)'
    },
    {
      pattern: /(.+)가게$/,
      category: 'location_environment', 
      template: 'in $1 shop, commercial retail interior, store environment',
      confidence: 0.80,
      description: '○○가게 패턴 (꽃가게, 책가게 등)'
    },
    {
      pattern: /(.+)점$/,
      category: 'location_environment',
      template: 'in $1 store, commercial retail interior, business environment', 
      confidence: 0.75,
      description: '○○점 패턴 (편의점, 음식점 등)'
    },
    {
      pattern: /(.+)샵$/,
      category: 'location_environment',
      template: 'in $1 shop, modern retail interior, commercial space',
      confidence: 0.80,
      description: '○○샵 패턴 (커피샵, 플라워샵 등)'
    },

    // === 2. 공간 위치 전치사 패턴 ===
    {
      pattern: /(.+)에서$/,
      category: 'location_environment',
      template: 'in/at $1, comfortable setting, appropriate environment',
      confidence: 0.70,
      description: '○○에서 패턴 (모든 장소)'
    },
    {
      pattern: /(.+)안에$/,
      category: 'location_environment', 
      template: 'inside $1, interior space, enclosed environment',
      confidence: 0.75,
      description: '○○안에 패턴 (내부 공간)'
    },
    {
      pattern: /(.+)앞에$/,
      category: 'location_environment',
      template: 'in front of $1, outdoor area, external environment',
      confidence: 0.65,
      description: '○○앞에 패턴 (외부 공간)'
    },
    {
      pattern: /(.+)옆에$/,
      category: 'location_environment',
      template: 'beside $1, adjacent area, neighboring environment',
      confidence: 0.65,
      description: '○○옆에 패턴 (인접 공간)'
    },

    // === 3. 건물/시설 패턴 ===
    {
      pattern: /(.+)건물$/,
      category: 'location_environment',
      template: 'in $1 building, architectural interior, commercial space',
      confidence: 0.70,
      description: '○○건물 패턴 (상업건물, 사무건물 등)'
    },
    {
      pattern: /(.+)센터$/,
      category: 'location_environment',
      template: 'in $1 center, facility interior, service environment',
      confidence: 0.75,
      description: '○○센터 패턴 (쇼핑센터, 문화센터 등)'
    },
    {
      pattern: /(.+)타워$/,
      category: 'location_environment',
      template: 'in $1 tower, high-rise building interior, urban environment',
      confidence: 0.70,
      description: '○○타워 패턴 (오피스타워 등)'
    },
    {
      pattern: /(.+)플라자$/,
      category: 'location_environment',
      template: 'in $1 plaza, commercial complex interior, shopping environment',
      confidence: 0.75,
      description: '○○플라자 패턴 (쇼핑플라자 등)'
    },

    // === 4. 특수 장소 패턴 ===
    {
      pattern: /(.+)클럽$/,
      category: 'location_environment',
      template: 'in $1 club, membership facility interior, social environment',
      confidence: 0.80,
      description: '○○클럽 패턴 (헬스클럽, 골프클럽 등)'
    },
    {
      pattern: /(.+)룸$/,
      category: 'location_environment',
      template: 'in $1 room, private space interior, comfortable environment',
      confidence: 0.85,
      description: '○○룸 패턴 (노래방, 찜질방 등)'
    },
    {
      pattern: /(.+)홀$/,
      category: 'location_environment',
      template: 'in $1 hall, spacious interior, formal environment',
      confidence: 0.80,
      description: '○○홀 패턴 (연회홀, 컨퍼런스홀 등)'
    },
    {
      pattern: /(.+)라운지$/,
      category: 'location_environment',
      template: 'in $1 lounge, comfortable relaxation space, upscale environment',
      confidence: 0.80,
      description: '○○라운지 패턴 (호텔라운지, 비즈니스라운지 등)'
    },

    // === 5. 지역명 패턴 ===
    {
      pattern: /(.+)시$/,
      category: 'location_environment',
      template: 'in $1 city, urban environment, metropolitan setting',
      confidence: 0.60,
      description: '○○시 패턴 (도시명)'
    },
    {
      pattern: /(.+)구$/,
      category: 'location_environment',
      template: 'in $1 district, urban area, city neighborhood',
      confidence: 0.60,
      description: '○○구 패턴 (서울 구명 등)'
    },
    {
      pattern: /(.+)동$/,
      category: 'location_environment',
      template: 'in $1 neighborhood, local community area, residential district',
      confidence: 0.55,
      description: '○○동 패턴 (동네명)'
    },

    // === 6. 브랜드명 패턴 ===
    {
      pattern: /(스타벅스|투썸|이디야|컴포즈|할리스)/,
      category: 'location_environment',
      template: 'in $1 cafe, branded coffee shop interior, modern cafe environment',
      confidence: 0.90,
      description: '커피 브랜드 패턴'
    },
    {
      pattern: /(맥도날드|버거킹|롯데리아|KFC|써브웨이)/,
      category: 'location_environment',
      template: 'in $1 restaurant, fast food interior, casual dining environment',
      confidence: 0.90,
      description: '패스트푸드 브랜드 패턴'
    },
    {
      pattern: /(이마트|홈플러스|롯데마트|코스트코)/,
      category: 'location_environment',
      template: 'in $1 supermarket, large retail interior, shopping environment',
      confidence: 0.90,
      description: '마트 브랜드 패턴'
    },

    // === 7. 업종별 패턴 ===
    {
      pattern: /(.+)(은행|농협|신협)$/,
      category: 'location_environment',
      template: 'in $1$2 bank, financial institution interior, professional business environment',
      confidence: 0.85,
      description: '금융기관 패턴'
    },
    {
      pattern: /(.+)(병원|의원|클리닉)$/,
      category: 'location_environment',
      template: 'in $1$2 medical facility, healthcare interior, professional clinical environment',
      confidence: 0.85,
      description: '의료기관 패턴'
    },
    {
      pattern: /(.+)(약국|팜)$/,
      category: 'location_environment',
      template: 'in $1$2 pharmacy, medical retail interior, healthcare commercial space',
      confidence: 0.85,
      description: '약국 패턴'
    }
  ];

  /**
   * 키워드 패턴 분석 및 프롬프트 생성
   */
  public generatePrompt(keyword: string, category: CategoryType): GenerationResult | null {
    // 위치 카테고리만 처리
    if (category !== 'location_environment') {
      return null;
    }

    // 각 패턴에 대해 매칭 시도
    for (const rule of this.locationRules) {
      const match = keyword.match(rule.pattern);
      if (match) {
        return this.applyRule(rule, match, keyword);
      }
    }

    return null;
  }

  /**
   * 규칙 적용 및 결과 생성
   */
  private applyRule(rule: RulePattern, match: RegExpMatchArray, originalKeyword: string): GenerationResult {
    // 템플릿에 매치된 그룹 적용
    let generatedPrompt = rule.template;
    
    // $1, $2 등을 매치된 그룹으로 치환
    for (let i = 1; i < match.length; i++) {
      const placeholder = `$${i}`;
      const replacement = match[i] || '';
      generatedPrompt = generatedPrompt.replace(new RegExp(`\\${placeholder}`, 'g'), replacement);
    }

    // 위치 유형 분석
    const locationType = this.analyzeLocationType(originalKeyword, rule);
    
    return {
      generated_prompt: generatedPrompt,
      confidence: rule.confidence,
      rule_used: rule.description,
      pattern_matched: rule.pattern.toString(),
      analysis: {
        keyword: originalKeyword,
        detected_category: rule.category,
        location_type: locationType,
        rule_reasoning: this.generateRuleReasoning(rule, match, originalKeyword)
      }
    };
  }

  /**
   * 위치 유형 분석
   */
  private analyzeLocationType(keyword: string, rule: RulePattern): string {
    // 매장/상점 관련
    if (rule.pattern.source.includes('매장') || rule.pattern.source.includes('가게') || rule.pattern.source.includes('점')) {
      return 'commercial_retail';
    }
    
    // 건물/시설 관련
    if (rule.pattern.source.includes('센터') || rule.pattern.source.includes('건물') || rule.pattern.source.includes('타워')) {
      return 'commercial_facility';
    }
    
    // 특수 장소 관련
    if (rule.pattern.source.includes('클럽') || rule.pattern.source.includes('룸') || rule.pattern.source.includes('홀')) {
      return 'specialized_venue';
    }
    
    // 지역명 관련
    if (rule.pattern.source.includes('시') || rule.pattern.source.includes('구') || rule.pattern.source.includes('동')) {
      return 'geographic_location';
    }
    
    // 전치사 관련
    if (rule.pattern.source.includes('에서') || rule.pattern.source.includes('안에')) {
      return 'positional_reference';
    }
    
    return 'general_location';
  }

  /**
   * 규칙 적용 근거 생성
   */
  private generateRuleReasoning(rule: RulePattern, match: RegExpMatchArray, originalKeyword: string): string {
    const matchedPart = match[1] || match[0];
    
    return `키워드 "${originalKeyword}"가 패턴 ${rule.pattern}에 매칭됨. ` +
           `핵심 부분 "${matchedPart}"를 추출하여 ${rule.description} 규칙을 적용. ` +
           `신뢰도: ${(rule.confidence * 100).toFixed(1)}%`;
  }

  /**
   * 사용 가능한 패턴 정보 반환
   */
  public getAvailablePatterns(category?: CategoryType): RulePattern[] {
    if (category) {
      return this.locationRules.filter(rule => rule.category === category);
    }
    return this.locationRules;
  }

  /**
   * 패턴 매칭 통계
   */
  public analyzeKeyword(keyword: string): {
    potential_matches: Array<{
      rule: string;
      pattern: string;
      confidence: number;
      would_generate: string;
    }>;
    best_match: GenerationResult | null;
  } {
    const potentialMatches = [];
    let bestMatch: GenerationResult | null = null;
    let highestConfidence = 0;

    for (const rule of this.locationRules) {
      const match = keyword.match(rule.pattern);
      if (match) {
        const result = this.applyRule(rule, match, keyword);
        
        potentialMatches.push({
          rule: rule.description,
          pattern: rule.pattern.toString(),
          confidence: rule.confidence,
          would_generate: result.generated_prompt
        });

        if (result.confidence > highestConfidence) {
          highestConfidence = result.confidence;
          bestMatch = result;
        }
      }
    }

    return {
      potential_matches: potentialMatches,
      best_match: bestMatch
    };
  }

  /**
   * 특정 패턴의 예시 키워드 생성
   */
  public generateExamples(patternIndex?: number): Array<{
    pattern: string;
    description: string;
    examples: string[];
  }> {
    const patternsToShow = patternIndex !== undefined 
      ? [this.locationRules[patternIndex]] 
      : this.locationRules;

    return patternsToShow.map(rule => ({
      pattern: rule.pattern.toString(),
      description: rule.description,
      examples: this.generateExampleKeywords(rule)
    }));
  }

  /**
   * 패턴별 예시 키워드 생성
   */
  private generateExampleKeywords(rule: RulePattern): string[] {
    // 패턴별로 예시 생성
    const patternSource = rule.pattern.source;
    
    if (patternSource.includes('매장')) {
      return ['수영복매장', '의류매장', '신발매장', '가방매장', '악세서리매장'];
    }
    
    if (patternSource.includes('가게')) {
      return ['꽃가게', '책가게', '문구가게', '빵가게', '과일가게'];
    }
    
    if (patternSource.includes('점')) {
      return ['편의점', '음식점', '화장품점', '전자제품점', '중고점'];
    }
    
    if (patternSource.includes('센터')) {
      return ['쇼핑센터', '문화센터', '컨벤션센터', '서비스센터', '커뮤니티센터'];
    }
    
    if (patternSource.includes('클럽')) {
      return ['헬스클럽', '골프클럽', '북클럽', '댄스클럽', '요트클럽'];
    }

    return ['예시1', '예시2', '예시3'];
  }

  /**
   * 성능 통계 생성
   */
  public getPatternStats(): {
    total_patterns: number;
    patterns_by_category: Record<CategoryType, number>;
    average_confidence: number;
    pattern_coverage: {
      commercial: number;
      facility: number;
      specialized: number;
      geographic: number;
      positional: number;
    };
  } {
    const patternsByCategory: Record<CategoryType, number> = {
      location_environment: 0,
      outfit_style: 0,
      action_pose: 0,
      expression_emotion: 0,
      atmosphere_lighting: 0
    };

    let totalConfidence = 0;
    const patternCoverage = {
      commercial: 0,
      facility: 0,
      specialized: 0,
      geographic: 0,
      positional: 0
    };

    for (const rule of this.locationRules) {
      patternsByCategory[rule.category]++;
      totalConfidence += rule.confidence;
      
      // 커버리지 분류
      const source = rule.pattern.source;
      if (source.includes('매장') || source.includes('가게') || source.includes('점')) {
        patternCoverage.commercial++;
      } else if (source.includes('센터') || source.includes('건물') || source.includes('타워')) {
        patternCoverage.facility++;
      } else if (source.includes('클럽') || source.includes('룸') || source.includes('홀')) {
        patternCoverage.specialized++;
      } else if (source.includes('시') || source.includes('구') || source.includes('동')) {
        patternCoverage.geographic++;
      } else if (source.includes('에서') || source.includes('안에')) {
        patternCoverage.positional++;
      }
    }

    return {
      total_patterns: this.locationRules.length,
      patterns_by_category: patternsByCategory,
      average_confidence: totalConfidence / this.locationRules.length,
      pattern_coverage: patternCoverage
    };
  }
}