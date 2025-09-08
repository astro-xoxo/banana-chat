/**
 * Google Sheets 기반 고정 프롬프트 서비스
 * 스프레드시트에서 관계 유형별, 성별별 프롬프트를 가져와 적용
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

export class GoogleSheetsPromptService {
  private prompts: PromptTemplate[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30분 캐시

  // 스프레드시트 URL (CSV 형식으로 가져오기)
  private readonly SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1cfYncmIwM7Brq6k9uXicZmwe9mTMDBlwT0HsQPgfDOU/export?format=csv&gid=394541502';

  constructor() {
    console.log('🍌 GoogleSheetsPromptService 초기화');
  }

  /**
   * 스프레드시트에서 프롬프트 데이터 가져오기
   */
  private async fetchPromptsFromSheets(): Promise<void> {
    try {
      console.log('📊 스프레드시트에서 프롬프트 데이터 가져오는 중...');
      
      const response = await fetch(this.SHEETS_URL);
      if (!response.ok) {
        throw new Error(`스프레드시트 데이터 가져오기 실패: ${response.status}`);
      }

      const csvText = await response.text();
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      console.log('📊 CSV 헤더:', headers);

      this.prompts = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length >= 5) {
          this.prompts.push({
            prompt_id: values[0]?.trim() || '',
            relationship_type: values[1]?.trim() || '',
            gender: this.normalizeGender(values[2]?.trim() || ''),
            positive_prompt: values[3]?.trim() || '',
            negative_prompt: values[4]?.trim() || ''
          });
        }
      }

      this.lastFetchTime = Date.now();
      console.log(`✅ ${this.prompts.length}개 프롬프트 템플릿 로드 완료`);
      
      // 디버깅: 로드된 프롬프트 상세 정보 출력
      if (this.prompts.length > 0) {
        console.log('📊 로드된 프롬프트 상세:', {
          count: this.prompts.length,
          sample: this.prompts.slice(0, 3).map(p => ({
            id: p.prompt_id,
            rel: p.relationship_type,
            gender: p.gender,
            pos_length: p.positive_prompt?.length || 0,
            neg_length: p.negative_prompt?.length || 0
          })),
          allTypes: [...new Set(this.prompts.map(p => p.relationship_type))].join(', '),
          allGenders: [...new Set(this.prompts.map(p => p.gender))].join(', ')
        });
      }

    } catch (error) {
      console.error('❌ 스프레드시트 프롬프트 로드 실패:', error);
      // 기본 프롬프트로 폴백
      this.loadDefaultPrompts();
    }
  }

  /**
   * CSV 라인 파싱 (콤마가 포함된 값 처리)
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.replace(/"/g, ''));
    
    return result;
  }

  /**
   * 성별 정규화
   */
  private normalizeGender(gender: string): 'male' | 'female' | 'common' {
    const normalized = gender.toLowerCase();
    if (normalized.includes('female') || normalized.includes('여성')) {
      return 'female';
    } else if (normalized.includes('male') || normalized.includes('남성')) {
      return 'male';
    } else {
      return 'common';
    }
  }

  /**
   * 기본 프롬프트 로드 (폴백용)
   */
  private loadDefaultPrompts(): void {
    console.log('🔄 기본 프롬프트 템플릿 사용');
    this.prompts = [
      {
        prompt_id: 'default_common',
        relationship_type: 'common',
        gender: 'common',
        positive_prompt: 'photorealistic portrait, high quality, professional photography, natural lighting, detailed facial features, 8k resolution',
        negative_prompt: 'anime, cartoon, illustration, 3d render, painting, drawing, sketch, low quality, blurry, distorted'
      },
      {
        prompt_id: 'default_female',
        relationship_type: 'common',
        gender: 'female',
        positive_prompt: 'beautiful young woman, natural makeup, soft features, elegant pose',
        negative_prompt: 'masculine features, beard, mustache'
      },
      {
        prompt_id: 'default_male',
        relationship_type: 'common',
        gender: 'male',
        positive_prompt: 'handsome young man, strong jawline, confident expression',
        negative_prompt: 'feminine features, makeup, long eyelashes'
      }
    ];
  }

  /**
   * 프롬프트 데이터 확인 및 업데이트
   */
  private async ensurePromptsLoaded(): Promise<void> {
    const now = Date.now();
    if (this.prompts.length === 0 || (now - this.lastFetchTime) > this.CACHE_DURATION) {
      await this.fetchPromptsFromSheets();
    }
  }

  /**
   * 관계 유형과 성별에 맞는 프롬프트 구성 가져오기
   */
  async getPromptConfig(
    relationshipType: string = 'common', 
    gender: 'male' | 'female' = 'female'
  ): Promise<PromptConfig> {
    await this.ensurePromptsLoaded();

    // 공통 프롬프트 찾기
    const commonPrompt = this.prompts.find(p => 
      p.relationship_type.toLowerCase().includes('common') && 
      p.gender === 'common'
    );

    // 관계별 공통 프롬프트 찾기
    const relationshipPrompt = this.prompts.find(p => 
      p.relationship_type.toLowerCase().includes(relationshipType.toLowerCase()) &&
      p.gender === 'common'
    );

    // 성별별 프롬프트 찾기
    const genderPrompt = this.prompts.find(p => 
      p.gender === gender && 
      (p.relationship_type.toLowerCase().includes(relationshipType.toLowerCase()) || 
       p.relationship_type.toLowerCase().includes('common'))
    );

    console.log('🔍 프롬프트 구성 결과:', {
      relationshipType,
      gender,
      totalPromptsLoaded: this.prompts.length,
      commonPrompt: !!commonPrompt,
      relationshipPrompt: !!relationshipPrompt,
      genderPrompt: !!genderPrompt
    });

    // 디버깅: 로드된 프롬프트들 확인
    if (this.prompts.length > 0) {
      console.log('📊 로드된 프롬프트 샘플:', {
        firstPrompt: {
          relationship_type: this.prompts[0]?.relationship_type,
          gender: this.prompts[0]?.gender,
          prompt_id: this.prompts[0]?.prompt_id
        },
        allRelationshipTypes: [...new Set(this.prompts.map(p => p.relationship_type))],
        allGenders: [...new Set(this.prompts.map(p => p.gender))]
      });
    } else {
      console.warn('⚠️ 로드된 프롬프트가 없습니다!');
    }

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

    // Positive 프롬프트 조합
    const positivePrompt = [
      config.basePositivePrompt,
      config.genderSpecificPositive,
      claudeGeneratedPrompt,
    ].filter(Boolean).join(', ');

    // Negative 프롬프트 조합
    const negativePrompt = [
      config.baseNegativePrompt,
      config.genderSpecificNegative,
      'nsfw, inappropriate content'
    ].filter(Boolean).join(', ');

    console.log('🎯 최종 프롬프트 구성 완료:', {
      relationshipType,
      gender,
      positiveLength: positivePrompt.length,
      negativeLength: negativePrompt.length
    });

    return {
      positive: positivePrompt,
      negative: negativePrompt
    };
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.prompts = [];
    this.lastFetchTime = 0;
    console.log('🧹 프롬프트 캐시 정리됨');
  }

  /**
   * 사용 가능한 관계 유형 목록 반환
   */
  async getAvailableRelationshipTypes(): Promise<string[]> {
    await this.ensurePromptsLoaded();
    const types = [...new Set(this.prompts.map(p => p.relationship_type))];
    return types.filter(type => type && type !== 'common');
  }

  /**
   * 서비스 상태 확인
   */
  getServiceStatus() {
    return {
      promptsLoaded: this.prompts.length,
      lastFetchTime: new Date(this.lastFetchTime).toISOString(),
      cacheValid: (Date.now() - this.lastFetchTime) < this.CACHE_DURATION
    };
  }
}

// 싱글톤 인스턴스
let promptServiceInstance: GoogleSheetsPromptService | null = null;

export function getGoogleSheetsPromptService(): GoogleSheetsPromptService {
  if (!promptServiceInstance) {
    promptServiceInstance = new GoogleSheetsPromptService();
  }
  return promptServiceInstance;
}