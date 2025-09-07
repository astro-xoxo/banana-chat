/**
 * PromptEnhancer - 프롬프트 개선 서비스
 * Task 003: Implement Prompt Quality Assurance System
 */

import type { PromptEnhancement, QualityMetrics } from './types';

export class PromptEnhancer {
  
  /**
   * 프롬프트 품질 개선
   */
  async enhancePrompt(prompt: string, context?: any): Promise<PromptEnhancement> {
    const improvements: string[] = [];
    let enhanced = prompt.trim();
    
    // 1. 기본 구조 개선
    enhanced = this.improveStructure(enhanced, improvements);
    
    // 2. 시각적 디테일 추가
    enhanced = this.addVisualDetails(enhanced, improvements);
    
    // 3. 품질 향상 키워드 추가
    enhanced = this.addQualityKeywords(enhanced, improvements);
    
    // 4. 문법 및 표현 개선
    enhanced = this.improveExpression(enhanced, improvements);
    
    // 5. 컨텍스트 기반 개선 (채팅 히스토리나 사용자 선호도 고려)
    if (context) {
      enhanced = this.applyContextualEnhancements(enhanced, context, improvements);
    }
    
    // 신뢰도 점수 계산
    const confidenceScore = this.calculateConfidenceScore(prompt, enhanced);
    
    return {
      original: prompt,
      enhanced,
      improvements,
      confidenceScore
    };
  }

  /**
   * 프롬프트 구조 개선
   */
  private improveStructure(prompt: string, improvements: string[]): string {
    let enhanced = prompt;
    
    // 쉼표와 연결어로 구조화
    if (!enhanced.includes(',') && enhanced.split(' ').length > 5) {
      const words = enhanced.split(' ');
      const midPoint = Math.floor(words.length / 2);
      enhanced = words.slice(0, midPoint).join(' ') + ', ' + words.slice(midPoint).join(' ');
      improvements.push('프롬프트 구조를 개선했습니다');
    }
    
    return enhanced;
  }

  /**
   * 시각적 디테일 추가
   */
  private addVisualDetails(prompt: string, improvements: string[]): string {
    let enhanced = prompt;
    const lowerPrompt = prompt.toLowerCase();
    
    // 조명 정보 추가
    if (!this.hasLightingInfo(lowerPrompt)) {
      const lightingOptions = [
        'soft lighting',
        'natural lighting', 
        'warm lighting',
        'dramatic lighting',
        '부드러운 조명',
        '자연스러운 조명'
      ];
      const randomLighting = lightingOptions[Math.floor(Math.random() * lightingOptions.length)];
      enhanced += `, ${randomLighting}`;
      improvements.push('조명 정보를 추가했습니다');
    }
    
    // 품질 수식어 추가
    if (!this.hasQualityModifiers(lowerPrompt)) {
      const qualityModifiers = [
        'high quality',
        'detailed',
        'professional',
        'crisp',
        '고품질',
        '상세한',
        '전문적인'
      ];
      const randomModifier = qualityModifiers[Math.floor(Math.random() * qualityModifiers.length)];
      enhanced += `, ${randomModifier}`;
      improvements.push('품질 수식어를 추가했습니다');
    }
    
    // 색상 정보 추가 (색상이 없는 경우)
    if (!this.hasColorInfo(lowerPrompt)) {
      const contexts = this.detectContext(lowerPrompt);
      if (contexts.includes('nature')) {
        enhanced += ', vibrant colors';
        improvements.push('자연스러운 색상 정보를 추가했습니다');
      } else if (contexts.includes('portrait')) {
        enhanced += ', natural skin tones';
        improvements.push('자연스러운 피부색 정보를 추가했습니다');
      }
    }
    
    return enhanced;
  }

  /**
   * 품질 향상 키워드 추가
   */
  private addQualityKeywords(prompt: string, improvements: string[]): string {
    let enhanced = prompt;
    
    // 기술적 품질 키워드
    const technicalKeywords = [
      '8k resolution',
      'highly detailed',
      'photorealistic',
      'masterpiece',
      '8k 해상도',
      '매우 상세한',
      '사실적인'
    ];
    
    // 이미 품질 키워드가 있는지 확인
    const hasQualityKeywords = technicalKeywords.some(keyword => 
      enhanced.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!hasQualityKeywords) {
      const randomKeyword = technicalKeywords[Math.floor(Math.random() * technicalKeywords.length)];
      enhanced += `, ${randomKeyword}`;
      improvements.push('기술적 품질 키워드를 추가했습니다');
    }
    
    return enhanced;
  }

  /**
   * 문법 및 표현 개선
   */
  private improveExpression(prompt: string, improvements: string[]): string {
    let enhanced = prompt;
    
    // 중복 단어 제거
    const words = enhanced.split(' ');
    const uniqueWords = [];
    const seen = new Set();
    
    for (const word of words) {
      const cleanWord = word.toLowerCase().replace(/[^\w가-힣]/g, '');
      if (!seen.has(cleanWord) && cleanWord.length > 0) {
        uniqueWords.push(word);
        seen.add(cleanWord);
      }
    }
    
    if (uniqueWords.length < words.length) {
      enhanced = uniqueWords.join(' ');
      improvements.push('중복 단어를 제거했습니다');
    }
    
    // 연속된 쉼표나 공백 정리
    enhanced = enhanced.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
    
    return enhanced;
  }

  /**
   * 컨텍스트 기반 개선
   */
  private applyContextualEnhancements(prompt: string, context: any, improvements: string[]): string {
    let enhanced = prompt;
    
    // 채팅 히스토리 기반 개선
    if (context.chatHistory) {
      const recentMessages = context.chatHistory.slice(-3);
      const commonThemes = this.extractCommonThemes(recentMessages);
      
      if (commonThemes.length > 0) {
        // 공통 테마를 반영한 스타일 추가
        const theme = commonThemes[0];
        enhanced = this.applyThemeStyle(enhanced, theme);
        improvements.push(`대화 맥락(${theme})을 반영했습니다`);
      }
    }
    
    // 사용자 선호도 기반 개선
    if (context.userPreferences) {
      const prefs = context.userPreferences;
      
      if (prefs.preferredStyle) {
        enhanced += `, ${prefs.preferredStyle} style`;
        improvements.push('사용자 선호 스타일을 적용했습니다');
      }
      
      if (prefs.colorPreference) {
        enhanced += `, ${prefs.colorPreference} tones`;
        improvements.push('선호 색상을 적용했습니다');
      }
    }
    
    return enhanced;
  }

  /**
   * 조명 정보 포함 여부 확인
   */
  private hasLightingInfo(prompt: string): boolean {
    const lightingKeywords = [
      'light', 'lighting', 'bright', 'dark', 'shadow', 'glow', 'illuminate',
      '조명', '빛', '밝은', '어두운', '그림자', '빛나는'
    ];
    
    return lightingKeywords.some(keyword => prompt.includes(keyword));
  }

  /**
   * 품질 수식어 포함 여부 확인
   */
  private hasQualityModifiers(prompt: string): boolean {
    const qualityKeywords = [
      'high quality', 'detailed', 'professional', 'masterpiece', 'beautiful',
      '고품질', '상세한', '전문적인', '걸작', '아름다운'
    ];
    
    return qualityKeywords.some(keyword => prompt.includes(keyword));
  }

  /**
   * 색상 정보 포함 여부 확인
   */
  private hasColorInfo(prompt: string): boolean {
    const colorKeywords = [
      'red', 'blue', 'green', 'yellow', 'black', 'white', 'color', 'colorful',
      '빨간', '파란', '초록', '노란', '검은', '흰', '색깔', '다채로운'
    ];
    
    return colorKeywords.some(keyword => prompt.includes(keyword));
  }

  /**
   * 프롬프트의 맥락 감지
   */
  private detectContext(prompt: string): string[] {
    const contexts: string[] = [];
    
    const contextKeywords = {
      nature: ['tree', 'flower', 'mountain', 'forest', 'nature', '자연', '나무', '꽃', '산', '숲'],
      portrait: ['person', 'face', 'man', 'woman', 'portrait', '사람', '얼굴', '남자', '여자', '초상화'],
      landscape: ['landscape', 'scenery', 'view', 'horizon', '풍경', '경치', '전망'],
      architecture: ['building', 'house', 'structure', 'architecture', '건물', '집', '건축']
    };
    
    for (const [context, keywords] of Object.entries(contextKeywords)) {
      if (keywords.some(keyword => prompt.includes(keyword))) {
        contexts.push(context);
      }
    }
    
    return contexts;
  }

  /**
   * 공통 테마 추출
   */
  private extractCommonThemes(messages: string[]): string[] {
    const themes = ['nature', 'portrait', 'landscape', 'architecture'];
    const themeCounts: { [key: string]: number } = {};
    
    for (const message of messages) {
      const messageThemes = this.detectContext(message.toLowerCase());
      for (const theme of messageThemes) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      }
    }
    
    return Object.entries(themeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([theme]) => theme);
  }

  /**
   * 테마 스타일 적용
   */
  private applyThemeStyle(prompt: string, theme: string): string {
    const themeStyles = {
      nature: 'organic, natural textures',
      portrait: 'soft focus, warm tones', 
      landscape: 'wide angle, panoramic',
      architecture: 'geometric, structured'
    };
    
    const style = themeStyles[theme as keyof typeof themeStyles];
    return style ? `${prompt}, ${style}` : prompt;
  }

  /**
   * 개선 신뢰도 점수 계산
   */
  private calculateConfidenceScore(original: string, enhanced: string): number {
    const originalLength = original.split(' ').length;
    const enhancedLength = enhanced.split(' ').length;
    
    // 개선된 단어 수에 따른 점수
    const lengthImprovement = Math.min((enhancedLength - originalLength) / originalLength, 0.5);
    
    // 기본 신뢰도 + 개선도
    const baseConfidence = 0.7;
    const confidence = baseConfidence + lengthImprovement;
    
    return Math.min(Math.max(confidence, 0), 1);
  }
}
