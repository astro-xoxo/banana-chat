/**
 * ContextValidator - Phase 2: 맥락 검증 시스템
 * 키워드 추출의 맥락적 일관성을 검증하는 범용적 시스템
 */

export class ContextValidator {
  /**
   * 위치 키워드와 메시지 맥락의 일관성 검증 (범용적 접근)
   */
  validateLocationContext(
    locationKeyword: string,
    originalMessage: string
  ): {
    isValid: boolean;
    confidence: number;
    suggestedFix?: string;
    reasoning: string;
  } {
    const analysis = this.analyzeLocationContext(originalMessage);
    
    // 현재 위치 vs 목적지 시제 분석
    const timeContext = this.analyzeTimeContext(originalMessage);
    
    // 동사-명사 관계 분석
    const actionContext = this.analyzeActionContext(originalMessage);
    
    // 맥락 일치도 검증
    const isConsistent = this.checkContextConsistency(
      locationKeyword,
      analysis,
      timeContext,
      actionContext
    );
    
    if (!isConsistent.isValid && isConsistent.suggestedLocation) {
      return {
        isValid: false,
        confidence: isConsistent.confidence,
        suggestedFix: isConsistent.suggestedLocation,
        reasoning: isConsistent.reasoning
      };
    }
    
    return {
      isValid: true,
      confidence: 0.9,
      reasoning: '위치 키워드가 맥락과 일치함'
    };
  }
  
  /**
   * 범용적 위치 맥락 분석 (모든 상황 적용)
   */
  private analyzeLocationContext(message: string): {
    explicitLocations: string[];
    locationIndicators: string[];
    method: string;
  } {
    const lowerMessage = message.toLowerCase();
    
    // 명시적 위치 표현
    const explicitLocations = this.extractExplicitLocations(lowerMessage);
    
    // 위치 관련 지시어들
    const locationIndicators = this.extractLocationIndicators(lowerMessage);
    
    return {
      explicitLocations,
      locationIndicators,
      method: 'universal_location_analysis'
    };
  }
  
  /**
   * 범용적 시제 분석 (모든 상황 적용)
   */
  private analyzeTimeContext(message: string): {
    timeframe: 'past' | 'present' | 'future';
    confidence: number;
    indicators: string[];
  } {
    const lowerMessage = message.toLowerCase();
    
    // 과거 지시어
    const pastIndicators = ['했어요', '었어요', '다녀왔어요', '갔었어요', '있었어요'];
    
    // 현재 지시어  
    const presentIndicators = ['있어요', '에서', '여기', '지금', '현재', '하고있어요', '하는중', '중이에요'];
    
    // 미래/의지/계획 지시어
    const futureIndicators = ['가요', '갈까요', '가는', '할예정', '예정이에요', '계획', '마셔요', '먹어요', '볼게요', '할게요', '려고', '을거에요'];
    
    // 각 시제별 매칭 점수 계산
    const pastScore = this.calculateIndicatorScore(lowerMessage, pastIndicators);
    const presentScore = this.calculateIndicatorScore(lowerMessage, presentIndicators);
    const futureScore = this.calculateIndicatorScore(lowerMessage, futureIndicators);
    
    // 가장 높은 점수의 시제 반환
    if (futureScore > presentScore && futureScore > pastScore) {
      return { 
        timeframe: 'future', 
        confidence: futureScore, 
        indicators: futureIndicators.filter(ind => lowerMessage.includes(ind))
      };
    } else if (presentScore > pastScore) {
      return { 
        timeframe: 'present', 
        confidence: presentScore, 
        indicators: presentIndicators.filter(ind => lowerMessage.includes(ind))
      };
    } else {
      return { 
        timeframe: 'past', 
        confidence: pastScore, 
        indicators: pastIndicators.filter(ind => lowerMessage.includes(ind))
      };
    }
  }
  
  /**
   * 동사-명사 관계 분석 (범용적)
   */
  private analyzeActionContext(message: string): {
    currentLocationActions: string[];
    movementActions: string[];
    preparationActions: string[];
  } {
    const lowerMessage = message.toLowerCase();
    
    return {
      // 현재 위치에서의 행동
      currentLocationActions: this.extractActionsByType(lowerMessage, 'current'),
      // 이동 관련 행동
      movementActions: this.extractActionsByType(lowerMessage, 'movement'),
      // 준비/계획 관련 행동
      preparationActions: this.extractActionsByType(lowerMessage, 'preparation')
    };
  }
  
  /**
   * 행동 유형별 키워드 추출
   */
  private extractActionsByType(message: string, actionType: string): string[] {
    const actionPatterns = {
      current: ['앉아', '서있', '있어요', '마시고', '보고', '하고있', '놀고'],
      movement: ['가요', '오고', '출발', '도착', '이동', '떠나'],
      preparation: ['준비', '챙기', '계획', '예약', '예정', '준비중']
    };
    
    const patterns = actionPatterns[actionType as keyof typeof actionPatterns] || [];
    return patterns.filter(pattern => message.includes(pattern));
  }
  
  /**
   * 맥락 일치도 종합 검증
   */
  private checkContextConsistency(
    locationKeyword: string,
    analysis: any,
    timeContext: any,
    actionContext: any
  ): {
    isValid: boolean;
    confidence: number;
    suggestedLocation?: string;
    reasoning: string;
  } {
    // 미래 시제 + 이동 행동 = 목적지 언급일 가능성 높음
    if (timeContext.timeframe === 'future' && actionContext.movementActions.length > 0) {
      return {
        isValid: false,
        confidence: 0.8,
        suggestedLocation: 'default',
        reasoning: `미래 시제와 이동 행동 감지 - 목적지 언급으로 판단 (${timeContext.indicators.join(', ')})`
      };
    }
    
    // 현재 시제 + 현재 위치 행동 = 현재 위치일 가능성 높음
    if (timeContext.timeframe === 'present' && actionContext.currentLocationActions.length > 0) {
      return {
        isValid: true,
        confidence: 0.9,
        reasoning: `현재 시제와 현재 행동 감지 - 현재 위치로 판단 (${actionContext.currentLocationActions.join(', ')})`
      };
    }
    
    // 준비 행동 = 현재 위치에서 준비 중
    if (actionContext.preparationActions.length > 0) {
      return {
        isValid: true,
        confidence: 0.7,
        reasoning: `준비/계획 행동 감지 - 현재 위치에서 준비 중으로 판단 (${actionContext.preparationActions.join(', ')})`
      };
    }
    
    return {
      isValid: true,
      confidence: 0.6,
      reasoning: '명확한 시제/행동 패턴 없음 - 기본 판정'
    };
  }
  
  /**
   * 지시어 매칭 점수 계산
   */
  private calculateIndicatorScore(message: string, indicators: string[]): number {
    const matches = indicators.filter(indicator => message.includes(indicator));
    return matches.length / Math.max(indicators.length, 1);
  }
  
  /**
   * 명시적 위치 표현 추출
   */
  private extractExplicitLocations(message: string): string[] {
    const locationPatterns = [
      /([가-힣]+)에서/g,  // "카페에서", "집에서" 등
      /([가-힣]+)\s*안에/g,  // "방 안에" 등
      /([가-힣]+)\s*내부/g   // "건물 내부" 등
    ];
    
    const locations: string[] = [];
    
    for (const pattern of locationPatterns) {
      const matches = message.matchAll(pattern);
      for (const match of matches) {
        if (match[0]) {
          locations.push(match[0]);
        }
      }
    }
    
    return locations;
  }
  
  /**
   * 위치 관련 지시어 추출
   */
  private extractLocationIndicators(message: string): string[] {
    const indicators = [
      '캐리어', '비행기', '면세점', '공항', '터미널',
      '카페', '집', '학교', '사무실', '병원', '공원',
      '여기', '저기', '이곳', '그곳'
    ];
    
    return indicators.filter(indicator => message.includes(indicator));
  }
}