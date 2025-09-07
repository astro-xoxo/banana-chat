/**
 * ContentFilterService - 부적절한 콘텐츠 필터링 서비스
 * Task 003: Implement Prompt Quality Assurance System
 */

import type { ContentFilter } from './types';

export class ContentFilterService {
  private contentFilter: ContentFilter;
  
  constructor() {
    this.contentFilter = {
      inappropriateKeywords: [
        // 폭력적 내용
        'violence', 'blood', 'gore', 'weapon', 'kill', 'death', 'murder',
        '폭력', '피', '무기', '살인', '죽음',
        
        // 성인 내용
        'nude', 'naked', 'sexual', 'erotic', 'adult',
        '누드', '나체', '성적', '에로틱',
        
        // 혐오 발언
        'hate', 'discrimination', 'racism', 'sexism',
        '혐오', '차별', '인종차별', '성차별',
        
        // 불법 활동
        'drug', 'illegal', 'crime', 'fraud',
        '마약', '불법', '범죄', '사기'
      ],
      
      sensitivePhrases: [
        'explicit content',
        'inappropriate for children',
        'adult only',
        '성인만 시청 가능',
        '부적절한 내용'
      ],
      
      bannedTerms: [
        'terrorism',
        'extremism', 
        'self-harm',
        '테러',
        '극단주의',
        '자해'
      ]
    };
  }

  /**
   * 프롬프트에 부적절한 내용이 포함되어 있는지 확인
   */
  async hasInappropriateContent(prompt: string): Promise<boolean> {
    const lowerPrompt = prompt.toLowerCase();
    
    // 금지된 용어 확인
    for (const term of this.contentFilter.bannedTerms) {
      if (lowerPrompt.includes(term.toLowerCase())) {
        return true;
      }
    }
    
    // 부적절한 키워드 확인
    let inappropriateCount = 0;
    for (const keyword of this.contentFilter.inappropriateKeywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        inappropriateCount++;
      }
    }
    
    // 부적절한 키워드가 2개 이상이면 필터링
    if (inappropriateCount >= 2) {
      return true;
    }
    
    // 민감한 구문 확인
    for (const phrase of this.contentFilter.sensitivePhrases) {
      if (lowerPrompt.includes(phrase.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 프롬프트에서 부적절한 내용을 제거하거나 대체
   */
  async sanitizePrompt(prompt: string): Promise<string> {
    let sanitized = prompt;
    
    // 부적절한 키워드를 중성적인 용어로 대체
    const replacements = {
      'violence': 'action',
      'blood': 'red liquid',
      'weapon': 'tool',
      'kill': 'defeat',
      'death': 'end',
      'murder': 'conflict',
      '폭력': '액션',
      '피': '빨간 액체',
      '무기': '도구',
      '살인': '갈등',
      '죽음': '끝'
    };
    
    for (const [inappropriate, replacement] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${inappropriate}\\b`, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    }
    
    // 금지된 용어는 완전히 제거
    for (const term of this.contentFilter.bannedTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '');
    }
    
    // 연속된 공백 정리
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }

  /**
   * 새로운 필터 규칙 추가
   */
  addFilterRule(type: keyof ContentFilter, terms: string[]): void {
    this.contentFilter[type].push(...terms);
  }

  /**
   * 필터 규칙 업데이트
   */
  updateFilterRules(newFilter: Partial<ContentFilter>): void {
    this.contentFilter = { ...this.contentFilter, ...newFilter };
  }

  /**
   * 현재 필터 규칙 조회
   */
  getFilterRules(): ContentFilter {
    return { ...this.contentFilter };
  }
}
