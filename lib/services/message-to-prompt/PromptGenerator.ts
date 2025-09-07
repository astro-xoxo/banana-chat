/**
 * PromptGenerator 구현
 * 추출된 키워드를 ComfyUI 호환 프롬프트로 변환하는 서비스
 */

import type {
  PromptGenerator,
  ExtractedKeywords,
  GeneratedPrompt,
  PromptTemplate,
  ConversionOptions
} from './types';
import { ERROR_CODES, QUALITY_LEVELS, MessageToPromptError } from './types';

export class PromptGeneratorImpl implements PromptGenerator {
  private templates = new Map<string, PromptTemplate>();
  private cache = new Map<string, GeneratedPrompt>();
  private stats = {
    total_generations: 0,
    success_count: 0,
    cache_hits: 0,
    template_usage: new Map<string, number>()
  };

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * 키워드를 기반으로 프롬프트 생성
   */
  async generatePrompt(
    keywords: ExtractedKeywords, 
    options: ConversionOptions = {}
  ): Promise<GeneratedPrompt> {
    const startTime = Date.now();
    this.stats.total_generations++;

    try {
      // 캐시 확인
      const cacheKey = this.generateCacheKey(keywords, options);
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        this.stats.cache_hits++;
        console.log('PromptGenerator: 캐시 히트', { cache_key: cacheKey });
        return cached;
      }

      console.log('PromptGenerator: 프롬프트 생성 시작', {
        keywords_summary: {
          emotions: keywords.emotions.length,
          situations: keywords.situations.length,
          actions: keywords.actions.length,
          objects: keywords.objects.length,
          style: keywords.style.length,
          confidence: keywords.confidence
        },
        options
      });

      // 템플릿 선택
      const template = this.selectTemplate(keywords, options);
      
      // 품질 레벨 설정
      const qualityLevel = options.quality_level || 'standard';
      const qualityConfig = QUALITY_LEVELS[qualityLevel];

      // 프롬프트 구성 요소 생성
      const promptComponents = this.buildPromptComponents(keywords, template, options);
      
      // 최종 프롬프트 조합
      const positivePrompt = this.assemblePositivePrompt(
        promptComponents, 
        template, 
        qualityConfig,
        options.max_prompt_length
      );
      
      const negativePrompt = this.assembleNegativePrompt(
        template, 
        keywords, 
        options
      );

      // 품질 점수 계산
      const qualityScore = this.calculateQualityScore(keywords, promptComponents, template);

      const generatedPrompt: GeneratedPrompt = {
        positive_prompt: positivePrompt,
        negative_prompt: negativePrompt,
        style_modifiers: promptComponents.style_modifiers,
        quality_score: qualityScore,
        source_keywords: keywords,
        template_used: template.id,
        generated_at: new Date()
      };

      // 유효성 검증
      if (!this.validatePrompt(generatedPrompt)) {
        throw new MessageToPromptError(
          ERROR_CODES.VALIDATION_FAILED,
          '생성된 프롬프트가 유효하지 않습니다',
          false
        );
      }

      // 캐시에 저장
      if (this.cache.size >= 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, generatedPrompt);

      // 통계 업데이트
      this.stats.success_count++;
      const currentUsage = this.stats.template_usage.get(template.id) || 0;
      this.stats.template_usage.set(template.id, currentUsage + 1);

      console.log('PromptGenerator: 프롬프트 생성 완료', {
        template_used: template.id,
        positive_length: positivePrompt.length,
        negative_length: negativePrompt.length,
        quality_score: qualityScore,
        duration_ms: Date.now() - startTime
      });

      return generatedPrompt;

    } catch (error) {
      console.error('PromptGenerator: 프롬프트 생성 실패', {
        error: error instanceof Error ? error.message : error,
        keywords_count: Object.values(keywords).filter(Array.isArray).flat().length,
        duration_ms: Date.now() - startTime
      });

      throw new MessageToPromptError(
        ERROR_CODES.PROMPT_GENERATION_FAILED,
        '프롬프트 생성 중 오류가 발생했습니다',
        true,
        { original_error: error }
      );
    }
  }

  /**
   * 템플릿 조회
   */
  getTemplate(templateId: string): PromptTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * 모든 템플릿 목록 조회
   */
  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 프롬프트 유효성 검증
   */
  validatePrompt(prompt: GeneratedPrompt): boolean {
    // 기본 구조 검증
    if (!prompt || typeof prompt !== 'object') {
      return false;
    }

    // 필수 필드 검증
    if (!prompt.positive_prompt || typeof prompt.positive_prompt !== 'string') {
      return false;
    }

    if (typeof prompt.negative_prompt !== 'string') {
      return false;
    }

    if (!Array.isArray(prompt.style_modifiers)) {
      return false;
    }

    // 품질 점수 검증
    if (typeof prompt.quality_score !== 'number' || 
        prompt.quality_score < 0 || 
        prompt.quality_score > 1) {
      return false;
    }

    // 프롬프트 길이 검증
    if (prompt.positive_prompt.length < 10 || prompt.positive_prompt.length > 2000) {
      console.warn('PromptGenerator: 프롬프트 길이가 범위를 벗어남', {
        length: prompt.positive_prompt.length
      });
      return false;
    }

    return true;
  }

  /**
   * 기본 템플릿 초기화
   */
  private initializeDefaultTemplates() {
    // 일반적인 템플릿
    const generalTemplate: PromptTemplate = {
      id: 'general',
      name: '일반 템플릿',
      template: '{style_prefix} {main_subject} {emotions} {actions} {situations} {objects} {style_suffix} {quality_tags}',
      keywords_map: {
        emotions: {
          '행복한': 'happy, joyful, cheerful',
          '슬픈': 'sad, melancholic, sorrowful',
          '로맨틱한': 'romantic, lovely, tender',
          '신비로운': 'mysterious, mystical, enigmatic',
          '평화로운': 'peaceful, serene, calm',
          '에너지넘치는': 'energetic, vibrant, dynamic',
          '따뜻한': 'warm, cozy, comfortable',
          '차가운': 'cool, cold, distant',
          '드라마틱한': 'dramatic, intense, powerful'
        },
        situations: {
          '카페에서': 'in a cozy cafe, coffee shop setting',
          '해변에서': 'on the beach, seaside, ocean view',
          '집에서': 'at home, indoor setting, comfortable interior',
          '공원에서': 'in the park, outdoor garden, nature setting',
          '도시에서': 'in the city, urban environment, cityscape',
          '숲에서': 'in the forest, woodland, nature scene',
          '밤에': 'at night, nighttime, evening atmosphere',
          '아침에': 'in the morning, sunrise, dawn light',
          '비오는날': 'in the rain, rainy weather, wet atmosphere'
        },
        actions: {
          '웃고있는': 'smiling, laughing, happy expression',
          '걷고있는': 'walking, strolling, moving',
          '앉아있는': 'sitting, resting, relaxed pose',
          '춤추는': 'dancing, graceful movement',
          '요리하는': 'cooking, preparing food',
          '독서하는': 'reading, studying, focused',
          '잠자는': 'sleeping, resting, peaceful',
          '운동하는': 'exercising, active, fitness',
          '대화하는': 'talking, conversation, interaction'
        },
        objects: {
          '꽃': 'flowers, blooms, floral elements',
          '나무': 'trees, branches, foliage',
          '고양이': 'cat, feline, cute pet',
          '강아지': 'dog, puppy, loyal companion',
          '책': 'books, literature, knowledge',
          '커피': 'coffee, hot beverage, cafe culture',
          '음식': 'food, meal, culinary delight',
          '하늘': 'sky, clouds, heavenly view',
          '별': 'stars, celestial, night sky'
        },
        style: {
          '수채화': 'watercolor painting, soft brush strokes',
          '애니메이션': 'anime style, animated, manga-inspired',
          '사실적인': 'realistic, photorealistic, lifelike',
          '빈티지': 'vintage, retro, classic style',
          '모던': 'modern, contemporary, sleek design',
          '파스텔': 'pastel colors, soft tones, gentle hues',
          '선명한': 'vibrant colors, sharp, clear details',
          '몽환적인': 'dreamy, ethereal, fantasy-like',
          '미니멀': 'minimal, simple, clean aesthetic'
        }
      },
      style_modifiers: {
        'prefix': '(masterpiece:1.2), (best quality:1.2), (ultra detailed:1.2)',
        'suffix': ', professional lighting, sharp focus, vivid colors'
      },
      quality_tags: [
        'highly detailed',
        'professional photography',
        'perfect composition',
        'beautiful lighting'
      ],
      negative_prompts: [
        'blurry',
        'low quality',
        'distorted',
        'ugly',
        'bad anatomy',
        'worst quality',
        'low resolution',
        'artifacts'
      ]
    };

    // 아트 스타일 특화 템플릿
    const artTemplate: PromptTemplate = {
      id: 'artistic',
      name: '아트 스타일 템플릿',
      template: '{art_prefix} {artistic_style} {main_subject} {emotions} {artistic_elements} {quality_tags}',
      keywords_map: {
        ...generalTemplate.keywords_map,
        artistic_style: {
          '수채화': 'watercolor painting, fluid brush strokes, transparent layers',
          '유화': 'oil painting, rich textures, classical technique',
          '스케치': 'pencil sketch, line art, artistic drawing',
          '디지털아트': 'digital art, digital painting, modern illustration',
          '일러스트': 'illustration, artistic rendering, stylized art'
        }
      },
      style_modifiers: {
        'art_prefix': '(artistic masterpiece:1.3), (fine art:1.2)',
        'artistic_elements': ', artistic composition, creative lighting, expressive style'
      },
      quality_tags: [
        'fine art',
        'artistic masterpiece',
        'creative composition',
        'expressive style',
        'museum quality'
      ],
      negative_prompts: [
        'photograph',
        'realistic',
        'commercial',
        'generic',
        'amateur',
        'low artistic value'
      ]
    };

    // 인물 중심 템플릿
    const portraitTemplate: PromptTemplate = {
      id: 'portrait',
      name: '인물 템플릿',
      template: '{portrait_prefix} {character_description} {emotions} {portrait_style} {lighting} {quality_tags}',
      keywords_map: {
        ...generalTemplate.keywords_map,
        character_description: {
          '여성': 'beautiful woman, feminine features, elegant',
          '남성': 'handsome man, masculine features, confident',
          '어린이': 'cute child, innocent expression, youthful',
          '청년': 'young adult, energetic, vibrant'
        },
        portrait_style: {
          '클로즈업': 'close-up portrait, detailed facial features',
          '반신': 'half-body portrait, waist up view, torso visible',
          '전신': 'full body portrait, complete figure'
        },
        lighting: {
          '자연광': 'natural lighting, soft daylight',
          '스튜디오': 'studio lighting, professional setup',
          '황금시간': 'golden hour lighting, warm sunset glow',
          '드라마틱': 'dramatic lighting, strong contrast'
        }
      },
      style_modifiers: {
        'portrait_prefix': '(professional portrait:1.3), (beautiful lighting:1.2)'
      },
      quality_tags: [
        'professional portrait',
        'perfect facial features',
        'beautiful eyes',
        'natural expression',
        'high quality photography'
      ],
      negative_prompts: [
        'deformed face',
        'bad eyes',
        'distorted features',
        'unnatural expression',
        'poor lighting',
        'blurry face'
      ]
    };

    // 템플릿 등록
    this.templates.set(generalTemplate.id, generalTemplate);
    this.templates.set(artTemplate.id, artTemplate);
    this.templates.set(portraitTemplate.id, portraitTemplate);

    console.log('PromptGenerator: 기본 템플릿 초기화 완료', {
      template_count: this.templates.size,
      templates: Array.from(this.templates.keys())
    });
  }

  /**
   * 적절한 템플릿 선택
   */
  private selectTemplate(keywords: ExtractedKeywords, options: ConversionOptions): PromptTemplate {
    // 옵션에서 지정된 템플릿 사용
    if (options.template_id) {
      const template = this.templates.get(options.template_id);
      if (template) {
        return template;
      }
      console.warn('PromptGenerator: 지정된 템플릿을 찾을 수 없음', {
        template_id: options.template_id
      });
    }

    // 키워드 분석을 통한 자동 템플릿 선택
    const styleKeywords = keywords.style.join(' ').toLowerCase();
    const emotionKeywords = keywords.emotions.join(' ').toLowerCase();
    const actionKeywords = keywords.actions.join(' ').toLowerCase();

    // 아트 스타일 키워드가 있는 경우
    if (styleKeywords.includes('수채화') || styleKeywords.includes('유화') || 
        styleKeywords.includes('스케치') || styleKeywords.includes('일러스트')) {
      return this.templates.get('artistic')!;
    }

    // 인물 관련 키워드가 많은 경우
    const personRelatedWords = ['웃고있는', '앉아있는', '대화하는', '표정', '얼굴'];
    const hasPersonKeywords = personRelatedWords.some(word => 
      actionKeywords.includes(word) || emotionKeywords.includes(word)
    );

    if (hasPersonKeywords) {
      return this.templates.get('portrait')!;
    }

    // 기본 템플릿 사용
    return this.templates.get('general')!;
  }

  /**
   * 프롬프트 구성 요소 생성
   */
  private buildPromptComponents(
    keywords: ExtractedKeywords, 
    template: PromptTemplate,
    options: ConversionOptions
  ) {
    const mapKeywords = (category: keyof ExtractedKeywords, keywordList: string[]) => {
      if (!Array.isArray(keywordList)) return [];
      
      return keywordList.map(keyword => {
        const mapping = template.keywords_map[category];
        if (mapping && mapping[keyword]) {
          return mapping[keyword];
        }
        return keyword; // 매핑이 없으면 원본 키워드 사용
      });
    };

    return {
      emotions: mapKeywords('emotions', keywords.emotions),
      situations: mapKeywords('situations', keywords.situations),
      actions: mapKeywords('actions', keywords.actions),
      objects: mapKeywords('objects', keywords.objects),
      style_base: mapKeywords('style', keywords.style),
      style_modifiers: this.selectStyleModifiers(keywords, template, options)
    };
  }

  /**
   * 스타일 수정자 선택
   */
  private selectStyleModifiers(
    keywords: ExtractedKeywords,
    template: PromptTemplate,
    options: ConversionOptions
  ): string[] {
    const modifiers: string[] = [];

    // 템플릿 기본 스타일 수정자
    if (template.style_modifiers.prefix) {
      modifiers.push(template.style_modifiers.prefix);
    }

    // 옵션의 스타일 오버라이드
    if (options.style_override) {
      modifiers.push(options.style_override);
    }

    // 키워드 기반 스타일 수정자
    keywords.style.forEach(styleKeyword => {
      if (template.style_modifiers[styleKeyword]) {
        modifiers.push(template.style_modifiers[styleKeyword]);
      }
    });

    // 템플릿 접미사
    if (template.style_modifiers.suffix) {
      modifiers.push(template.style_modifiers.suffix);
    }

    return modifiers;
  }

  /**
   * 긍정 프롬프트 조합
   */
  private assemblePositivePrompt(
    components: any,
    template: PromptTemplate,
    qualityConfig: any,
    maxLength?: number
  ): string {
    const parts: string[] = [];

    // 스타일 프리픽스
    if (components.style_modifiers.length > 0) {
      parts.push(components.style_modifiers[0]);
    }

    // 주요 구성 요소들
    if (components.emotions.length > 0) {
      parts.push(components.emotions.join(', '));
    }

    if (components.actions.length > 0) {
      parts.push(components.actions.join(', '));
    }

    if (components.situations.length > 0) {
      parts.push(components.situations.join(', '));
    }

    if (components.objects.length > 0) {
      parts.push(components.objects.join(', '));
    }

    if (components.style_base.length > 0) {
      parts.push(components.style_base.join(', '));
    }

    // 품질 태그
    parts.push(qualityConfig.quality_tags.join(', '));

    // 추가 스타일 수정자
    if (components.style_modifiers.length > 1) {
      parts.push(...components.style_modifiers.slice(1));
    }

    let prompt = parts.filter(Boolean).join(', ');

    // 최대 길이 제한
    if (maxLength && prompt.length > maxLength) {
      prompt = prompt.substring(0, maxLength - 3) + '...';
    }

    return prompt;
  }

  /**
   * 부정 프롬프트 조합
   */
  private assembleNegativePrompt(
    template: PromptTemplate,
    keywords: ExtractedKeywords,
    options: ConversionOptions
  ): string {
    const negativeElements: string[] = [];

    // 템플릿 기본 부정 프롬프트
    negativeElements.push(...template.negative_prompts);

    // 사용자 피해야 할 콘텐츠가 옵션에 있다면 추가
    // (향후 user_preferences 연동 시 구현)

    // 품질 레벨에 따른 부정 프롬프트 추가
    const qualityLevel = options.quality_level || 'standard';
    if (qualityLevel === 'premium' || qualityLevel === 'high') {
      negativeElements.push(
        'amateur',
        'low quality',
        'pixelated',
        'compression artifacts',
        'oversaturated'
      );
    }

    // 중복 제거
    const uniqueNegatives = [...new Set(negativeElements)];
    
    return uniqueNegatives.join(', ');
  }

  /**
   * 품질 점수 계산
   */
  private calculateQualityScore(
    keywords: ExtractedKeywords,
    components: any,
    template: PromptTemplate
  ): number {
    let score = 0.5; // 기본 점수

    // 키워드 신뢰도 반영
    score = score * 0.3 + keywords.confidence * 0.7;

    // 키워드 다양성 보너스
    const totalKeywords = keywords.emotions.length + keywords.situations.length + 
                         keywords.actions.length + keywords.objects.length + keywords.style.length;
    
    const diversityBonus = Math.min(totalKeywords / 15, 0.2); // 최대 0.2 보너스
    score += diversityBonus;

    // 매핑된 키워드 비율 (더 구체적인 프롬프트일수록 높은 점수)
    const mappedCount = Object.values(components).flat().filter(Boolean).length;
    const totalComponents = Object.values(components).flat().length;
    
    if (totalComponents > 0) {
      const mappingRatio = mappedCount / totalComponents;
      score = score * 0.8 + mappingRatio * 0.2;
    }

    // 점수 범위 제한
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(keywords: ExtractedKeywords, options: ConversionOptions): string {
    const keyData = {
      keywords: JSON.stringify(keywords),
      template_id: options.template_id || 'auto',
      quality_level: options.quality_level || 'standard',
      style_override: options.style_override,
      max_length: options.max_prompt_length
    };

    // 간단한 해시 생성
    const dataStr = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return `prompt_${Math.abs(hash)}`;
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      ...this.stats,
      cache_size: this.cache.size,
      cache_hit_rate: this.stats.total_generations > 0 ? 
        this.stats.cache_hits / this.stats.total_generations : 0,
      template_usage: Object.fromEntries(this.stats.template_usage)
    };
  }

  /**
   * 캐시 정리
   */
  clearCache() {
    this.cache.clear();
    console.log('PromptGenerator: 캐시 정리 완료');
  }
}
