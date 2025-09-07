/**
 * PromptQualityAnalyzer - 프롬프트 품질 분석기
 * Task 003: Implement Prompt Quality Assurance System
 */

import type { QualityMetrics, QualityIssue } from './types';

export class PromptQualityAnalyzer {
  
  /**
   * 프롬프트의 전체 품질 메트릭 계산
   */
  async calculateMetrics(prompt: string): Promise<QualityMetrics> {
    const keywordCount = this.countKeywords(prompt);
    const descriptiveness = this.calculateDescriptiveness(prompt);
    const appropriateness = this.calculateAppropriateness(prompt);
    const coherence = this.calculateCoherence(prompt);
    
    // 가중 평균으로 전체 점수 계산
    const weights = {
      keywordCount: 0.2,
      descriptiveness: 0.3,
      appropriateness: 0.3,
      coherence: 0.2
    };
    
    const normalizedKeywordScore = Math.min(keywordCount / 5, 1); // 5개 키워드가 최적
    const overallScore = 
      normalizedKeywordScore * weights.keywordCount +
      descriptiveness * weights.descriptiveness +
      appropriateness * weights.appropriateness +
      coherence * weights.coherence;
    
    return {
      keywordCount,
      descriptiveness,
      appropriateness,
      coherence,
      overallScore: Math.round(overallScore * 100) / 100
    };
  }

  /**
   * 프롬프트의 키워드 개수 계산
   */
  private countKeywords(prompt: string): number {
    // 의미있는 키워드만 카운트 (명사, 형용사, 동사)
    const words = prompt.toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // 불용어 제거
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      '그', '이', '저', '것', '수', '있', '하', '되', '것', '들', '로', '을', '를', '이', '가', '에', '와', '과'
    ]);
    
    const meaningfulWords = words.filter(word => !stopWords.has(word));
    
    return meaningfulWords.length;
  }

  /**
   * 프롬프트의 설명력 계산 (0-1)
   */
  private calculateDescriptiveness(prompt: string): number {
    let score = 0;
    
    // 시각적 설명어 확인
    const visualDescriptors = [
      'color', 'bright', 'dark', 'light', 'shadow', 'glow', 'shiny', 'matte',
      'big', 'small', 'tall', 'short', 'wide', 'narrow', 'thick', 'thin',
      'round', 'square', 'curved', 'straight', 'smooth', 'rough',
      '색깔', '밝은', '어두운', '빛', '그림자', '빛나는', '무광',
      '큰', '작은', '높은', '낮은', '넓은', '좁은', '두꺼운', '얇은',
      '둥근', '네모난', '곡선', '직선', '부드러운', '거친'
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    const foundDescriptors = visualDescriptors.filter(desc => 
      lowerPrompt.includes(desc.toLowerCase())
    );
    
    score += Math.min(foundDescriptors.length * 0.1, 0.4); // 최대 0.4점
    
    // 상세한 설명 길이 점수
    const words = prompt.split(/\s+/).filter(word => word.length > 0);
    if (words.length >= 10) score += 0.3;
    else if (words.length >= 6) score += 0.2;
    else if (words.length >= 3) score += 0.1;
    
    // 구체적인 명사 확인
    const specificNouns = [
      'person', 'woman', 'man', 'child', 'animal', 'cat', 'dog', 'bird',
      'house', 'building', 'tree', 'flower', 'car', 'mountain', 'ocean',
      '사람', '여자', '남자', '아이', '동물', '고양이', '개', '새',
      '집', '건물', '나무', '꽃', '자동차', '산', '바다'
    ];
    
    const foundNouns = specificNouns.filter(noun => 
      lowerPrompt.includes(noun.toLowerCase())
    );
    
    score += Math.min(foundNouns.length * 0.1, 0.3); // 최대 0.3점
    
    return Math.min(score, 1);
  }

  /**
   * 프롬프트의 적절성 계산 (0-1)
   */
  private calculateAppropriateness(prompt: string): number {
    const lowerPrompt = prompt.toLowerCase();
    
    // 부정적 키워드 확인
    const negativeKeywords = [
      'ugly', 'disgusting', 'horrible', 'terrible', 'awful', 'bad', 'worst',
      '못생긴', '역겨운', '끔찍한', '나쁜', '최악의'
    ];
    
    let negativeCount = 0;
    for (const keyword of negativeKeywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        negativeCount++;
      }
    }
    
    // 부정적 키워드가 많을수록 점수 감소
    const negativepenalty = Math.min(negativeCount * 0.1, 0.3);
    
    // 긍정적 키워드 확인
    const positiveKeywords = [
      'beautiful', 'stunning', 'amazing', 'wonderful', 'excellent', 'perfect', 'good',
      '아름다운', '멋진', '놀라운', '훌륭한', '완벽한', '좋은'
    ];
    
    let positiveCount = 0;
    for (const keyword of positiveKeywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        positiveCount++;
      }
    }
    
    const positiveBonus = Math.min(positiveCount * 0.05, 0.1);
    
    return Math.max(0.7 - negativepenalty + positiveBonus, 0);
  }

  /**
   * 프롬프트의 일관성 계산 (0-1)
   */
  private calculateCoherence(prompt: string): number {
    // 단어 간 연결성 확인
    const words = prompt.toLowerCase().split(/\s+/);
    
    if (words.length < 3) {
      return 0.3; // 너무 짧으면 일관성 판단 어려움
    }
    
    // 반복되는 테마나 주제 확인
    const themes = {
      nature: ['tree', 'flower', 'mountain', 'ocean', 'forest', 'nature', '자연', '나무', '꽃', '산', '바다', '숲'],
      people: ['person', 'man', 'woman', 'child', 'people', 'human', '사람', '남자', '여자', '아이', '인간'],
      objects: ['house', 'car', 'building', 'object', 'item', '집', '자동차', '건물', '물건'],
      art: ['painting', 'drawing', 'art', 'creative', 'artistic', '그림', '예술', '창작', '예술적']
    };
    
    let maxThemeCount = 0;
    let totalThemeWords = 0;
    
    for (const [theme, keywords] of Object.entries(themes)) {
      let themeCount = 0;
      for (const keyword of keywords) {
        if (words.includes(keyword)) {
          themeCount++;
          totalThemeWords++;
        }
      }
      maxThemeCount = Math.max(maxThemeCount, themeCount);
    }
    
    // 주요 테마가 있고 일관성이 있으면 높은 점수
    if (maxThemeCount >= 2) {
      return 0.8 + (totalThemeWords * 0.02);
    } else if (maxThemeCount >= 1) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * 품질 문제점 식별
   */
  identifyIssues(prompt: string, metrics: QualityMetrics): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    // 키워드 부족
    if (metrics.keywordCount < 3) {
      issues.push({
        type: 'insufficient_keywords',
        severity: 'medium',
        message: '프롬프트에 충분한 키워드가 포함되지 않았습니다.',
        suggestion: '더 구체적인 설명을 추가해보세요. (색상, 크기, 스타일 등)'
      });
    }
    
    // 너무 길거나 짧은 프롬프트
    if (prompt.length > 200) {
      issues.push({
        type: 'too_long',
        severity: 'low',
        message: '프롬프트가 너무 길어서 최적화가 필요합니다.',
        suggestion: '핵심적인 설명만 남기고 불필요한 부분을 제거해보세요.'
      });
    } else if (prompt.length < 10) {
      issues.push({
        type: 'too_vague',
        severity: 'high',
        message: '프롬프트가 너무 간단합니다.',
        suggestion: '더 자세한 설명을 추가해주세요.'
      });
    }
    
    // 설명력 부족
    if (metrics.descriptiveness < 0.3) {
      issues.push({
        type: 'too_vague',
        severity: 'medium',  
        message: '프롬프트가 구체적이지 않습니다.',
        suggestion: '시각적 요소(색상, 모양, 크기 등)를 더 자세히 설명해보세요.'
      });
    }
    
    // 일관성 부족
    if (metrics.coherence < 0.4) {
      issues.push({
        type: 'grammar',
        severity: 'low',
        message: '프롬프트의 일관성을 개선할 수 있습니다.',
        suggestion: '하나의 주제나 테마에 집중해보세요.'
      });
    }
    
    return issues;
  }
}
