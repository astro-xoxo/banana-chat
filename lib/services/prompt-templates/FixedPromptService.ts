/**
 * 하드코딩된 고정 프롬프트 서비스
 * 스프레드시트 내용을 직접 코드에 구현하여 안정적인 프롬프트 제공
 */

interface PromptTemplate {
  prompt_id: string;
  relationship_type: string;
  gender: 'male' | 'female' | 'common';
  positive_prompt: string;
  negative_prompt: string;
}

interface PromptConfig {
  basePositivePrompt: string;
  baseNegativePrompt: string;
  genderSpecificPositive: string;
  genderSpecificNegative: string;
}

export class FixedPromptService {
  // 하드코딩된 프롬프트 데이터 (스프레드시트 내용)
  private readonly FIXED_PROMPTS: PromptTemplate[] = [
    // 공통 프롬프트 (성별 무관) - 한 명만, 사용자 얼굴 기반 강화
    {
      prompt_id: '3',
      relationship_type: 'common',
      gender: 'common',
      positive_prompt: '(single person:1.5), (solo:1.4), (one person only:1.3), (medium shot:1.3), (half body:1.3), (waist up:1.2), (portrait:1.2), upper body to waist composition, looking at camera, natural pose, comfortable setting, soft lighting, professional photography, photorealistic, realistic, high quality, detailed, sharp focus, natural lighting, beautiful composition, 8k resolution, masterpiece, real person, not animated, not cartoon, maintain facial features from reference image, consistent face structure, same person appearance',
      negative_prompt: '(multiple people:1.5), (two people:1.5), (2girls:1.5), (2boys:1.5), (couple:1.4), (group:1.4), (crowd:1.4), (multiple faces:1.4), (different person:1.3), (face swap:1.3), (full body:1.3), (whole body:1.3), anime, cartoon, animated, 2d, illustration, drawing, sketch, manga, stylized, nsfw, nude, sexual content, low quality, blurry, distorted, ugly, bad anatomy, extra limbs, deformed, (watermark:1.5), (text:1.4), (logo:1.4), (signature:1.3), news, newspaper, magazine, 스포츠한국, 언론, 뉴스, 기사, caption, subtitle, label, brand, copyright'
    },
    // 여성 전용 프롬프트 - 한 명만, 사용자 얼굴 기반 강화
    {
      prompt_id: '1',
      relationship_type: 'female',
      gender: 'female',
      positive_prompt: '(1girl:1.5), (solo:1.4), (single person:1.3), (one woman only:1.3), beautiful woman, milky white skin, porcelain complexion, small face, clear transparent skin, soft feminine features, elegant appearance, natural makeup, graceful expression, beautiful eyes, long eyelashes, smooth skin texture, delicate facial features, photorealistic, realistic photography, professional photography, high quality, detailed, natural lighting, sharp focus, maintain original face structure, keep facial identity, same person appearance, consistent with reference photo',
      negative_prompt: '(2girls:1.5), (multiple girls:1.4), (two women:1.4), (lesbian couple:1.4), (group of women:1.3), (multiple faces:1.3), (different woman:1.3), masculine features, male characteristics, beard, mustache, body hair, rough skin, anime, cartoon, animated, 2d, illustration, drawing, sketch, manga, stylized, nsfw, nude, sexual content, inappropriate content, (watermark:1.5), (text:1.4), (logo:1.4), (signature:1.3), news, newspaper, magazine, 스포츠한국, 언론, 뉴스, 기사, caption, subtitle, label, brand, copyright'
    },
    // 남성 전용 프롬프트 - 한 명만, 사용자 얼굴 기반 강화 
    {
      prompt_id: '2',
      relationship_type: 'male',
      gender: 'male',
      positive_prompt: '(1boy:1.5), (solo:1.4), (single person:1.3), (one man only:1.3), handsome man, healthy skin tone, masculine face structure, clear skin, defined facial features, strong jawline, confident expression, natural masculine appearance, well-groomed, professional look, photorealistic, realistic photography, professional photography, high quality, detailed, natural lighting, sharp focus, maintain original face structure, keep facial identity, same person appearance, consistent with reference photo',
      negative_prompt: '(2boys:1.5), (multiple boys:1.4), (two men:1.4), (gay couple:1.4), (group of men:1.3), (multiple faces:1.3), (different man:1.3), feminine features, female characteristics, makeup, lipstick, nail polish, long hair, delicate features, anime, cartoon, animated, 2d, illustration, drawing, sketch, manga, stylized, nsfw, nude, sexual content, inappropriate content, (watermark:1.5), (text:1.4), (logo:1.4), (signature:1.3), news, newspaper, magazine, 스포츠한국, 언론, 뉴스, 기사, caption, subtitle, label, brand, copyright'
    }
  ];

  constructor() {
    console.log('🍌 FixedPromptService 초기화 - 하드코딩된 프롬프트 사용');
  }

  /**
   * 관계 유형과 성별에 맞는 프롬프트 구성 가져오기
   */
  async getPromptConfig(
    relationshipType: string = 'common', 
    gender: 'male' | 'female' = 'female'
  ): Promise<PromptConfig> {
    
    // 공통 프롬프트 찾기
    const commonPrompt = this.FIXED_PROMPTS.find(p => 
      p.relationship_type === 'common' && 
      p.gender === 'common'
    );

    // 성별별 프롬프트 찾기  
    const genderPrompt = this.FIXED_PROMPTS.find(p => 
      p.gender === gender
    );

    console.log('🔍 하드코딩 프롬프트 구성 결과:', {
      relationshipType,
      gender,
      totalPromptsAvailable: this.FIXED_PROMPTS.length,
      commonPrompt: !!commonPrompt,
      genderPrompt: !!genderPrompt
    });

    // 프롬프트 상세 정보 출력
    console.log('📊 사용할 프롬프트 정보:', {
      commonPrompt: commonPrompt ? {
        id: commonPrompt.prompt_id,
        type: commonPrompt.relationship_type,
        pos_length: commonPrompt.positive_prompt.length,
        neg_length: commonPrompt.negative_prompt.length
      } : null,
      genderPrompt: genderPrompt ? {
        id: genderPrompt.prompt_id,
        gender: genderPrompt.gender,
        pos_length: genderPrompt.positive_prompt.length,
        neg_length: genderPrompt.negative_prompt.length
      } : null
    });

    return {
      basePositivePrompt: commonPrompt?.positive_prompt || 'photorealistic portrait, high quality, professional photography',
      baseNegativePrompt: commonPrompt?.negative_prompt || 'anime, cartoon, illustration, low quality',
      genderSpecificPositive: genderPrompt?.positive_prompt || (gender === 'female' ? 'beautiful young woman' : 'handsome young man'),
      genderSpecificNegative: genderPrompt?.negative_prompt || ''
    };
  }

  /**
   * 최종 프롬프트 조합 생성
   */
  async buildFinalPrompt(
    claudeGeneratedPrompt: string,
    relationshipType: string = 'common',
    gender: 'male' | 'female' = 'female'
  ): Promise<{ positive: string; negative: string }> {
    const config = await this.getPromptConfig(relationshipType, gender);

    // Positive 프롬프트 조합 (성별별 프롬프트 + Claude 생성 프롬프트 + 공통 프롬프트)
    const positivePrompt = [
      config.genderSpecificPositive,      // 성별별 프롬프트 (가장 앞에 배치)
      claudeGeneratedPrompt,             // Claude가 생성한 컨텍스트별 프롬프트
      config.basePositivePrompt,         // 공통 품질 프롬프트
    ].filter(Boolean).join(', ');

    // Negative 프롬프트 조합
    const negativePrompt = [
      config.genderSpecificNegative,     // 성별별 제외 프롬프트
      config.baseNegativePrompt,         // 공통 제외 프롬프트
    ].filter(Boolean).join(', ');

    console.log('🎯 최종 하드코딩 프롬프트 구성 완료:', {
      relationshipType,
      gender,
      positiveLength: positivePrompt.length,
      negativeLength: negativePrompt.length,
      claudePromptLength: claudeGeneratedPrompt.length
    });

    return {
      positive: positivePrompt,
      negative: negativePrompt
    };
  }

  /**
   * 사용 가능한 관계 유형 목록 반환
   */
  async getAvailableRelationshipTypes(): Promise<string[]> {
    const types = [...new Set(this.FIXED_PROMPTS.map(p => p.relationship_type))];
    return types.filter(type => type && type !== 'common');
  }

  /**
   * 서비스 상태 확인
   */
  getServiceStatus() {
    return {
      promptsLoaded: this.FIXED_PROMPTS.length,
      loadType: 'hardcoded',
      availableGenders: ['male', 'female', 'common'],
      availableRelationshipTypes: [...new Set(this.FIXED_PROMPTS.map(p => p.relationship_type))]
    };
  }

  /**
   * 캐시 정리 (하드코딩이므로 실제로는 불필요)
   */
  clearCache(): void {
    console.log('🧹 하드코딩된 프롬프트는 캐시 정리가 불필요합니다');
  }
}

// 싱글톤 인스턴스
let fixedPromptServiceInstance: FixedPromptService | null = null;

export function getFixedPromptService(): FixedPromptService {
  if (!fixedPromptServiceInstance) {
    fixedPromptServiceInstance = new FixedPromptService();
  }
  return fixedPromptServiceInstance;
}