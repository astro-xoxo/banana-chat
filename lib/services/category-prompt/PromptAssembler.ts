/**
 * PromptAssembler - 7개 카테고리 프롬프트를 최종 형태로 조합
 * 성별별 기본 정보 + 5개 카테고리 매핑 + 고정 프롬프트 조합
 */

import { 
  CategoryPrompts, 
  CategoryBasedPrompt, 
  QualityConfig 
} from './types';

export class PromptAssembler {
  /**
   * 7개 카테고리 프롬프트를 최종 형태로 조합
   */
  assemblePrompt(
    categoryPrompts: CategoryPrompts,
    gender: 'male' | 'female',
    qualityLevel: 'draft' | 'standard' | 'premium' = 'standard'
  ): CategoryBasedPrompt {
    const qualityConfig = this.getQualityConfig(qualityLevel);
    
    // 긍정 프롬프트 생성
    const positivePrompt = this.buildPositivePrompt(categoryPrompts, qualityConfig);
    
    // 부정 프롬프트 생성
    const negativePrompt = this.buildNegativePrompt(gender);
    
    // 품질 점수 계산
    const qualityScore = this.calculateQualityScore(categoryPrompts, qualityConfig);
    
    // 카테고리 채움 정도 계산
    const categoriesFilled = this.countFilledCategories(categoryPrompts);

    return {
      positive_prompt: positivePrompt,
      negative_prompt: negativePrompt,
      category_breakdown: categoryPrompts,
      quality_score: qualityScore,
      generation_info: {
        gender,
        template_used: `category_based_${qualityLevel}`,
        categories_filled: categoriesFilled,
        generated_at: new Date()
      }
    };
  }

  /**
   * 긍정 프롬프트 생성 - 일관성 향상을 위한 순서 및 가중치 최적화
   */
  private buildPositivePrompt(
    components: CategoryPrompts, 
    quality: QualityConfig
  ): string {
    // 🔥 프롬프트 템플릿 - 중요도 순서로 재배열
    const template = [
      // 1순위: 핵심 제어 키워드 (인물수, 카메라구도) - 최우선 배치
      components.person_base,
      components.camera_composition,
      // 2순위: 품질 향상자
      quality.enhancers.join(', '),
      // 3순위: 환경 및 스타일 (Claude 생성 키워드)
      components.location_environment,
      components.outfit_style,
      // 4순위: 동작과 감정 조합
      components.action_pose + ' with ' + components.expression_emotion + ' expression',
      // 5순위: 분위기
      components.atmosphere_lighting,
      // 6순위: 품질 접미사
      this.getQualitySuffix(quality.level)
    ];

    return template
      .filter(part => part && part.trim().length > 0)
      .join(', ')
      .replace(/,\s*,/g, ',') // 중복 쉼표 제거
      .replace(/,\s*$/, ''); // 마지막 쉼표 제거
  }

  /**
   * 부정 프롬프트 생성 - 일관성 강화를 위한 제어 키워드 추가
   */
  private buildNegativePrompt(gender: 'male' | 'female'): string {
    const baseNegative = [
      // 🔥 핵심 제어 필터 - 일관성 문제 해결
      '(multiple people:1.4), (2girls:1.4), (2boys:1.4), (couple:1.3), (group:1.3)',
      '(full body:1.3), (whole body:1.3), (legs visible:1.2), (feet visible:1.2)',
      'multiple heads, two faces, split screen, side by side',
      'long shot, wide shot, full body shot, feet, legs below waist',
      
      // NSFW 필터
      'nsfw, nude, sexual content, inappropriate, explicit, adult content',
      'sexual pose, sexual expression, revealing clothing, underwear',
      'sexual gesture, sexual activity, pornographic, erotic',
      
      // 품질 필터
      'blurry, low quality, distorted, ugly, bad anatomy, worst quality',
      'low resolution, artifacts, deformed, malformed, disfigured',
      'bad hands, missing fingers, extra digits, fewer digits',
      'bad face, bad eyes, bad proportions, gross proportions',
      'mutation, mutated, extra limbs, missing limbs',
      
      // 기술적 필터
      'jpeg artifacts, compression artifacts, noise, grain',
      'watermark, text, signature, logo, username',
      'cropped, cut off, out of frame, border',
      
      // 표현 필터 - 기존 + 추가
      'duplicate, crowd, multiple subjects, background people',
      'cartoon, anime style, illustration, drawing',
      'unrealistic, fantasy, fictional character'
    ];

    // 성별별 추가 필터 - 강화
    const genderSpecificFilters = {
      male: [
        '(2boys:1.4), (multiple boys:1.3), (gay couple:1.3)',
        'feminine features, female characteristics',
        'makeup, lipstick, nail polish, jewelry, dress'
      ],
      female: [
        '(2girls:1.4), (multiple girls:1.3), (lesbian couple:1.3)',
        'masculine features, male characteristics', 
        'beard, mustache, male body type, masculine clothing'
      ]
    };

    const allFilters = [
      ...baseNegative,
      ...genderSpecificFilters[gender]
    ];

    return allFilters.join(', ');
  }

  /**
   * 품질 설정 반환
   */
  private getQualityConfig(level: 'draft' | 'standard' | 'premium'): QualityConfig {
    const configs = {
      draft: {
        level: 'draft' as const,
        enhancers: [
          'high quality',
          'detailed'
        ],
        negative_filters: ['low quality', 'blurry', 'distorted']
      },
      standard: {
        level: 'standard' as const,
        enhancers: [
          '(masterpiece:1.2)',
          '(best quality:1.2)', 
          '(ultra detailed:1.1)',
          'professional photography'
        ],
        negative_filters: [
          'low quality', 'worst quality', 'bad anatomy', 'blurry',
          'distorted', 'deformed', 'bad hands', 'artifacts'
        ]
      },
      premium: {
        level: 'premium' as const,
        enhancers: [
          '(masterpiece:1.4)',
          '(best quality:1.3)',
          '(ultra detailed:1.2)',
          '(photorealistic:1.2)',
          'professional photography',
          'perfect composition',
          'beautiful lighting',
          'sharp focus',
          'vivid colors',
          '8k resolution'
        ],
        negative_filters: [
          'low quality', 'worst quality', 'bad anatomy', 'blurry',
          'distorted', 'deformed', 'bad hands', 'artifacts',
          'jpeg artifacts', 'noise', 'grain', 'mutation',
          'extra limbs', 'missing limbs', 'bad proportions'
        ]
      }
    };

    return configs[level];
  }

  /**
   * 품질 접미사 반환
   */
  private getQualitySuffix(level: 'draft' | 'standard' | 'premium'): string {
    const suffixes = {
      draft: 'good lighting, clear image',
      standard: 'perfect lighting, professional composition, sharp focus',
      premium: 'studio lighting, cinematic composition, ultra sharp focus, award winning photography'
    };

    return suffixes[level];
  }

  /**
   * 품질 점수 계산
   */
  private calculateQualityScore(
    prompts: CategoryPrompts, 
    quality: QualityConfig
  ): number {
    let score = 0;
    
    // 기본 점수 (품질 레벨에 따라)
    const baseScores = { draft: 60, standard: 75, premium: 90 };
    score += baseScores[quality.level];
    
    // 카테고리 채움 정도에 따른 보너스
    const filledCount = this.countFilledCategories(prompts);
    score += (filledCount / 7) * 15; // 최대 15점 보너스
    
    // 기본값이 아닌 카테고리에 대한 보너스
    let nonDefaultCount = 0;
    Object.values(prompts).forEach(prompt => {
      if (!prompt.includes('default') && !prompt.includes('comfortable')) {
        nonDefaultCount++;
      }
    });
    score += (nonDefaultCount / 7) * 10; // 최대 10점 보너스
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * 채워진 카테고리 수 계산
   */
  private countFilledCategories(prompts: CategoryPrompts): number {
    return Object.values(prompts).filter(
      prompt => prompt && prompt.trim().length > 0
    ).length;
  }

  /**
   * 하얀 피부 키워드 (프로필 이미지와 일관성 유지)
   */
  static readonly WHITE_SKIN_KEYWORDS = `
    extremely pale white skin, milky white skin, porcelain white complexion,
    ivory white skin tone, snow white skin, alabaster skin, very fair skin,
    caucasian white features, nordic pale skin, paper white complexion,
    ghost white skin, chalk white skin, marble white skin, pearl white skin,
    cream white skin, porcelain complexion, ivory skin tone, pale white skin,
    fair complexion, light skin tone, caucasian features, european skin tone,
    very pale skin, white skin, light complexion
  `.replace(/\s+/g, ' ').trim();

  /**
   * 고정 프롬프트 상수들 - 일관성 강화를 위한 가중치 적용 + 하얀 피부 키워드 추가
   */
  static readonly PERSON_BASE_FEMALE = `
    ${PromptAssembler.WHITE_SKIN_KEYWORDS},
    (1girl:1.4), (solo:1.3), (single person:1.2), beautiful woman,
    small face, clear transparent skin, not prominent cheekbones,
    beautiful detailed eyes, natural eyebrows, soft facial features,
    elegant feminine appearance, graceful demeanor
  `.replace(/\s+/g, ' ').trim();

  static readonly PERSON_BASE_MALE = `
    ${PromptAssembler.WHITE_SKIN_KEYWORDS},
    (1boy:1.4), (solo:1.3), (single person:1.2), handsome man,
    masculine face structure, clear skin, defined facial features,
    expressive eyes, natural eyebrows, strong jawline,
    confident masculine appearance, charismatic presence
  `.replace(/\s+/g, ' ').trim();

  static readonly CAMERA_COMPOSITION = `
    (medium shot:1.3), (half body:1.3), (waist up:1.2), (portrait:1.2),
    upper body to waist composition, looking at camera,
    professional portrait composition, focused subject,
    subtle background details, person-centered focus,
    perfect framing, natural pose, engaging eye contact, torso visible
  `.replace(/\s+/g, ' ').trim();

  /**
   * 성별과 나이에 맞는 기본 인물 프롬프트 생성
   */
  static getPersonBase(gender: 'male' | 'female', age?: number): string {
    const basePrompt = gender === 'female' 
      ? PromptAssembler.PERSON_BASE_FEMALE
      : PromptAssembler.PERSON_BASE_MALE;
    
    // 나이가 제공된 경우 나이에 맞는 키워드 추가
    if (age) {
      const ageKeyword = PromptAssembler.getAgeKeyword(age);
      // "beautiful woman" -> "beautiful 70 years old elderly woman"
      if (gender === 'female') {
        return basePrompt.replace('beautiful woman', `beautiful ${age} years old ${ageKeyword} woman`);
      } else {
        return basePrompt.replace('handsome man', `handsome ${age} years old ${ageKeyword} man`);
      }
    }
    
    return basePrompt;
  }

  /**
   * 나이에 따른 적절한 키워드 반환
   */
  static getAgeKeyword(age: number): string {
    if (age < 13) return 'child';
    if (age < 20) return 'teenage';
    if (age < 25) return 'young';
    if (age < 35) return 'young adult';
    if (age < 45) return 'adult';
    if (age < 55) return 'middle-aged';
    if (age < 65) return 'mature';
    return 'elderly';
  }

  /**
   * 프롬프트 길이 검증 및 최적화 - 일관성 키워드 보존 우선
   */
  optimizePromptLength(prompt: string, maxLength: number = 1500): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }

    // 🔥 우선순위에 따라 부분 제거 - 일관성 키워드 보존
    const parts = prompt.split(', ');
    const criticalKeywords = [
      // 인물수 제어 (최고 우선순위)
      '1girl', '1boy', 'solo', 'single person',
      // 카메라 구도 제어
      'medium shot', 'half body', 'waist up', 'portrait',
      // 품질 키워드
      'masterpiece', 'best quality', 'detailed', 'professional',
      'beautiful', 'perfect', 'high quality'
    ];

    // 1단계: 중요 키워드가 포함된 부분은 반드시 보존
    const criticalParts = parts.filter(part => {
      const lowerPart = part.toLowerCase();
      return criticalKeywords.some(keyword => lowerPart.includes(keyword)) ||
             part.includes(':1.') || // 가중치가 있는 키워드 보존
             part.length < 20; // 짧은 중요 키워드 보존
    });

    // 2단계: 길이가 여전히 초과하면 소트하여 제거
    if (criticalParts.join(', ').length > maxLength) {
      // 길이 순으로 소트하여 긴 부분부터 제거
      const sortedParts = criticalParts.sort((a, b) => a.length - b.length);
      let result = '';
      for (const part of sortedParts) {
        const testResult = result ? result + ', ' + part : part;
        if (testResult.length <= maxLength) {
          result = testResult;
        } else {
          break;
        }
      }
      return result;
    }

    const result = criticalParts.join(', ');
    return result.length <= maxLength ? result : result.substring(0, maxLength);
  }

  /**
   * 디버깅용: 카테고리별 프롬프트 분석
   */
  analyzePrompt(prompt: CategoryBasedPrompt): any {
    return {
      positive_length: prompt.positive_prompt.length,
      negative_length: prompt.negative_prompt.length,
      categories_used: this.countFilledCategories(prompt.category_breakdown),
      quality_score: prompt.quality_score,
      estimated_tokens: Math.ceil(prompt.positive_prompt.length / 4), // 대략적인 토큰 수
      generation_info: prompt.generation_info
    };
  }
}