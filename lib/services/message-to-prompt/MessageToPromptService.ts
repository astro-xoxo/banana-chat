/**
 * MessageToPromptService 메인 서비스 클래스
 * 메시지 분석과 프롬프트 생성을 통합하는 서비스
 */

import { MessageAnalyzerImpl } from './MessageAnalyzer';
import { PromptGeneratorImpl } from './PromptGenerator';
import { getPromptQualityAssuranceService } from '../prompt-quality';
import type { PromptQualityAssuranceService } from '../prompt-quality';
import type {
  MessageContext,
  ConversionOptions,
  ConversionResult,
  MessageToPromptService,
  ExtractedKeywords,
  GeneratedPrompt
} from './types';
import { ERROR_CODES, MessageToPromptError } from './types';

export class MessageToPromptServiceImpl implements MessageToPromptService {
  private messageAnalyzer: MessageAnalyzerImpl;
  private promptGenerator: PromptGeneratorImpl;
  private qualityAssuranceService: PromptQualityAssuranceService;
  private isInitialized = false;
  private globalStats = {
    total_conversions: 0,
    successful_conversions: 0,
    failed_conversions: 0,
    total_time_ms: 0,
    error_distribution: new Map<string, number>(),
    quality_improvements: 0,
    quality_passes: 0,
    quality_failures: 0
  };

  constructor() {
    this.messageAnalyzer = new MessageAnalyzerImpl();
    this.promptGenerator = new PromptGeneratorImpl();
    this.qualityAssuranceService = getPromptQualityAssuranceService({
      enhancementEnabled: true,
      contentFilterEnabled: true,
      strictMode: false
    });
  }

  /**
   * 템플릿 사전 로드
   */
  async preloadTemplates(): Promise<void> {
    try {
      console.log('MessageToPromptService: 템플릿 사전 로드 시작');
      
      // PromptGenerator는 이미 기본 템플릿을 초기화함
      const templates = this.promptGenerator.listTemplates();
      
      console.log('MessageToPromptService: 템플릿 사전 로드 완료', {
        template_count: templates.length,
        template_ids: templates.map(t => t.id)
      });
      
      this.isInitialized = true;

    } catch (error) {
      console.error('MessageToPromptService: 템플릿 사전 로드 실패', error);
      throw new MessageToPromptError(
        ERROR_CODES.TEMPLATE_NOT_FOUND,
        '템플릿 초기화에 실패했습니다',
        true,
        { original_error: error }
      );
    }
  }

  /**
   * 단일 메시지를 프롬프트로 변환
   */
  async convert(
    context: MessageContext, 
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    this.globalStats.total_conversions++;

    try {
      // 초기화 확인
      if (!this.isInitialized) {
        await this.preloadTemplates();
      }

      console.log('MessageToPromptService: 변환 시작', {
        message_id: context.message_id,
        session_id: context.session_id,
        content_length: context.message_content.length,
        has_context: !!context.previous_messages?.length,
        options
      });

      // 입력 검증
      this.validateContext(context, options);

      // 1단계: 키워드 추출
      const extractionStartTime = Date.now();
      const keywords = await this.messageAnalyzer.analyzeMessage(context);
      const extractionTime = Date.now() - extractionStartTime;

      console.log('MessageToPromptService: 키워드 추출 완료', {
        message_id: context.message_id,
        extraction_time_ms: extractionTime,
        keywords_summary: {
          emotions: keywords.emotions.length,
          situations: keywords.situations.length,
          actions: keywords.actions.length,
          objects: keywords.objects.length,
          style: keywords.style.length,
          confidence: keywords.confidence
        }
      });

      // 2단계: 프롬프트 생성
      const generationStartTime = Date.now();
      const prompt = await this.promptGenerator.generatePrompt(keywords, options);
      const generationTime = Date.now() - generationStartTime;

      // 3단계: 품질 보증 및 개선 (Task 003)
      const qualityStartTime = Date.now();
      const qualityValidation = await this.qualityAssuranceService.validatePrompt(
        prompt.positive_prompt, 
        {
          messageContext: context,
          chatHistory: context.previous_messages,
          userPreferences: options.user_preferences
        }
      );
      
      let finalPrompt = prompt;
      
      // 품질 검증 실패 시 자동 개선 시도
      if (!qualityValidation.isValid && qualityValidation.enhancedPrompt) {
        console.log('MessageToPromptService: 프롬프트 품질 개선 적용', {
          message_id: context.message_id,
          original_length: prompt.positive_prompt.length,
          enhanced_length: qualityValidation.enhancedPrompt.length,
          issues: qualityValidation.issues.map(i => i.type),
          quality_score_before: qualityValidation.metrics.overallScore
        });
        
        finalPrompt = {
          ...prompt,
          positive_prompt: qualityValidation.enhancedPrompt,
          quality_score: Math.max(prompt.quality_score, qualityValidation.metrics.overallScore)
        };
        
        this.globalStats.quality_improvements++;
      }
      
      // 품질 통계 업데이트
      if (qualityValidation.isValid) {
        this.globalStats.quality_passes++;
      } else {
        this.globalStats.quality_failures++;
      }
      
      const qualityTime = Date.now() - qualityStartTime;
      const totalTime = Date.now() - startTime;

      // 성공 통계 업데이트
      this.globalStats.successful_conversions++;
      this.globalStats.total_time_ms += totalTime;

      const result: ConversionResult = {
        success: true,
        prompt: finalPrompt,
        performance: {
          extraction_time_ms: extractionTime,
          generation_time_ms: generationTime,
          quality_assurance_time_ms: qualityTime,
          total_time_ms: totalTime,
          tokens_used: this.estimateTokenUsage(context, finalPrompt)
        },
        quality_info: {
          validation_passed: qualityValidation.isValid,
          quality_score: qualityValidation.metrics.overallScore,
          issues: qualityValidation.issues,
          was_enhanced: !!qualityValidation.enhancedPrompt
        }
      };

      console.log('MessageToPromptService: 변환 완료', {
        message_id: context.message_id,
        success: true,
        total_time_ms: totalTime,
        prompt_length: finalPrompt.positive_prompt.length,
        quality_score: finalPrompt.quality_score,
        quality_validation_passed: qualityValidation.isValid,
        was_enhanced: !!qualityValidation.enhancedPrompt
      });

      return result;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.globalStats.failed_conversions++;
      this.globalStats.total_time_ms += totalTime;

      // 에러 분류 및 통계
      const errorCode = error instanceof MessageToPromptError ? error.code : ERROR_CODES.UNKNOWN_ERROR;
      const currentCount = this.globalStats.error_distribution.get(errorCode) || 0;
      this.globalStats.error_distribution.set(errorCode, currentCount + 1);

      console.error('MessageToPromptService: 변환 실패', {
        message_id: context.message_id,
        error_code: errorCode,
        error_message: error instanceof Error ? error.message : error,
        total_time_ms: totalTime,
        retryable: error instanceof MessageToPromptError ? error.retryable : false
      });

      // 폴백 옵션이 활성화된 경우 폴백 시도
      if (options.fallback_on_error !== false && !(error instanceof MessageToPromptError && !error.retryable)) {
        try {
          console.log('MessageToPromptService: 폴백 시도', { message_id: context.message_id });
          const fallbackResult = await this.generateFallbackPrompt(context, options);
          
          return {
            success: true,
            prompt: fallbackResult,
            performance: {
              extraction_time_ms: 0,
              generation_time_ms: Date.now() - startTime,
              total_time_ms: Date.now() - startTime,
              tokens_used: 0
            }
          };
        } catch (fallbackError) {
          console.error('MessageToPromptService: 폴백도 실패', {
            message_id: context.message_id,
            fallbackError
          });
        }
      }

      return {
        success: false,
        prompt: null,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
          retry_suggested: error instanceof MessageToPromptError ? error.retryable : true
        },
        performance: {
          extraction_time_ms: 0,
          generation_time_ms: 0,
          total_time_ms: totalTime,
          tokens_used: 0
        }
      };
    }
  }

  /**
   * 배치 변환
   */
  async convertBatch(
    contexts: MessageContext[], 
    options: ConversionOptions = {}
  ): Promise<ConversionResult[]> {
    console.log('MessageToPromptService: 배치 변환 시작', {
      batch_size: contexts.length,
      options
    });

    const results: ConversionResult[] = [];
    const batchStartTime = Date.now();

    // 배치 크기 제한 (과부하 방지)
    if (contexts.length > 10) {
      console.warn('MessageToPromptService: 배치 크기가 너무 큼, 10개로 제한', {
        requested: contexts.length,
        limited_to: 10
      });
      contexts = contexts.slice(0, 10);
    }

    // 순차 처리 (동시 처리는 Claude API 제한으로 인해 지양)
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      try {
        console.log(`MessageToPromptService: 배치 처리 ${i + 1}/${contexts.length}`, {
          message_id: context.message_id
        });

        const result = await this.convert(context, options);
        results.push(result);

        // API 부하 방지를 위한 지연 (마지막 요청 제외)
        if (i < contexts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 지연
        }

      } catch (error) {
        console.error(`MessageToPromptService: 배치 처리 ${i + 1} 실패`, {
          message_id: context.message_id,
          error: error instanceof Error ? error.message : error
        });

        // 실패한 항목도 결과에 포함
        results.push({
          success: false,
          prompt: null,
          error: {
            code: error instanceof MessageToPromptError ? error.code : ERROR_CODES.UNKNOWN_ERROR,
            message: error instanceof Error ? error.message : '배치 처리 중 오류 발생',
            retry_suggested: true
          },
          performance: {
            extraction_time_ms: 0,
            generation_time_ms: 0,
            total_time_ms: 0,
            tokens_used: 0
          }
        });
      }
    }

    const batchTime = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.success).length;

    console.log('MessageToPromptService: 배치 변환 완료', {
      total_count: contexts.length,
      success_count: successCount,
      failure_count: contexts.length - successCount,
      total_time_ms: batchTime,
      average_time_ms: batchTime / contexts.length
    });

    return results;
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.messageAnalyzer.clearCache();
    this.promptGenerator.clearCache();
    console.log('MessageToPromptService: 모든 캐시 정리 완료');
  }

  /**
   * 메시지를 프롬프트로 변환 (별칭 메서드)
   */
  async convertMessageToPrompt(
    context: MessageContext,
    options?: ConversionOptions
  ): Promise<ConversionResult> {
    return await this.convert(context, options);
  }

  /**
   * 통계 조회
   */
  getStats() {
    const analyzerStats = this.messageAnalyzer.getStats();
    const generatorStats = this.promptGenerator.getStats();

    return {
      total_conversions: this.globalStats.total_conversions,
      success_rate: this.globalStats.total_conversions > 0 ? 
        this.globalStats.successful_conversions / this.globalStats.total_conversions : 0,
      average_time_ms: this.globalStats.total_conversions > 0 ? 
        this.globalStats.total_time_ms / this.globalStats.total_conversions : 0,
      cache_hit_rate: (analyzerStats.cache_hit_rate + generatorStats.cache_hit_rate) / 2,
      component_stats: {
        analyzer: analyzerStats,
        generator: generatorStats
      },
      error_distribution: Object.fromEntries(this.globalStats.error_distribution)
    };
  }

  /**
   * 입력 컨텍스트 검증
   */
  private validateContext(context: MessageContext, options: ConversionOptions): void {
    // 필수 필드 검증
    if (!context.message_id || typeof context.message_id !== 'string') {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        'message_id가 유효하지 않습니다',
        false
      );
    }

    if (!context.session_id || typeof context.session_id !== 'string') {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        'session_id가 유효하지 않습니다',
        false
      );
    }

    if (!context.message_content || typeof context.message_content !== 'string') {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        'message_content가 유효하지 않습니다',
        false
      );
    }

    // 메시지 길이 검증
    if (context.message_content.length < 5) {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        '메시지가 너무 짧습니다 (최소 5자)',
        false
      );
    }

    if (context.message_content.length > 2000) {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        '메시지가 너무 깁니다 (최대 2000자)',
        false
      );
    }

    // 옵션 검증
    if (options.template_id) {
      const template = this.promptGenerator.getTemplate(options.template_id);
      if (!template) {
        throw new MessageToPromptError(
          ERROR_CODES.TEMPLATE_NOT_FOUND,
          `템플릿을 찾을 수 없습니다: ${options.template_id}`,
          false
        );
      }
    }

    if (options.max_prompt_length && 
        (options.max_prompt_length < 50 || options.max_prompt_length > 2000)) {
      throw new MessageToPromptError(
        ERROR_CODES.INVALID_MESSAGE,
        'max_prompt_length는 50-2000 범위여야 합니다',
        false
      );
    }
  }

  /**
   * 폴백 프롬프트 생성
   */
  private async generateFallbackPrompt(
    context: MessageContext, 
    options: ConversionOptions
  ) {
    console.log('MessageToPromptService: 폴백 프롬프트 생성', {
      message_id: context.message_id
    });

    // 간단한 키워드 기반 폴백
    const content = context.message_content.toLowerCase();
    const fallbackKeywords = {
      emotions: this.extractSimpleEmotions(content),
      situations: this.extractSimpleSituations(content),
      actions: this.extractSimpleActions(content),
      objects: this.extractSimpleObjects(content),
      style: ['자연스러운'],
      confidence: 0.3,
      raw_analysis: '폴백 분석'
    };

    return await this.promptGenerator.generatePrompt(fallbackKeywords, {
      ...options,
      quality_level: 'draft' // 폴백은 낮은 품질로
    });
  }

  /**
   * 간단한 감정 키워드 추출 (폴백용)
   */
  private extractSimpleEmotions(content: string): string[] {
    const emotionMap = {
      '기쁘': '행복한',
      '행복': '행복한',
      '웃': '행복한',
      '슬프': '슬픈',
      '울': '슬픈',
      '화나': '화난',
      '짜증': '화난',
      '사랑': '로맨틱한',
      '예쁘': '아름다운',
      '무서': '두려운',
      '신기': '신비로운'
    };

    const found: string[] = [];
    for (const [keyword, emotion] of Object.entries(emotionMap)) {
      if (content.includes(keyword)) {
        found.push(emotion);
      }
    }

    return [...new Set(found)];
  }

  /**
   * 간단한 상황 키워드 추출 (폴백용)
   */
  private extractSimpleSituations(content: string): string[] {
    const situationMap = {
      '집': '집에서',
      '카페': '카페에서',
      '공원': '공원에서',
      '바다': '해변에서',
      '산': '산에서',
      '학교': '학교에서',
      '회사': '직장에서',
      '밤': '밤에',
      '아침': '아침에'
    };

    const found: string[] = [];
    for (const [keyword, situation] of Object.entries(situationMap)) {
      if (content.includes(keyword)) {
        found.push(situation);
      }
    }

    return [...new Set(found)];
  }

  /**
   * 간단한 액션 키워드 추출 (폴백용)
   */
  private extractSimpleActions(content: string): string[] {
    const actionMap = {
      '걷': '걷고있는',
      '뛰': '뛰고있는',
      '앉': '앉아있는',
      '서': '서있는',
      '먹': '먹고있는',
      '마시': '마시고있는',
      '자': '잠자는',
      '공부': '공부하는',
      '일': '일하는'
    };

    const found: string[] = [];
    for (const [keyword, action] of Object.entries(actionMap)) {
      if (content.includes(keyword)) {
        found.push(action);
      }
    }

    return [...new Set(found)];
  }

  /**
   * 간단한 객체 키워드 추출 (폴백용)
   */
  private extractSimpleObjects(content: string): string[] {
    const objectMap = {
      '고양이': '고양이',
      '강아지': '강아지',
      '꽃': '꽃',
      '나무': '나무',
      '커피': '커피',
      '책': '책',
      '음식': '음식',
      '차': '자동차',
      '하늘': '하늘'
    };

    const found: string[] = [];
    for (const [keyword, object] of Object.entries(objectMap)) {
      if (content.includes(keyword)) {
        found.push(object);
      }
    }

    return [...new Set(found)];
  }


}

// 편의 함수들
export async function convertMessageToPrompt(
  context: MessageContext,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const service = new MessageToPromptServiceImpl();
  return await service.convert(context, options);
}

export async function convertMessagesToPrompts(
  contexts: MessageContext[],
  options?: ConversionOptions
): Promise<ConversionResult[]> {
  const service = new MessageToPromptServiceImpl();
  return await service.convertBatch(contexts, options);
}

// 새로운 카테고리 프롬프트 통합 서비스 임포트
import { CategoryPromptIntegrationService } from './CategoryPromptIntegration';

// 싱글톤 인스턴스 (카테고리 프롬프트 통합 서비스 사용)
let serviceInstance: CategoryPromptIntegrationService | null = null;
let legacyServiceInstance: MessageToPromptServiceImpl | null = null;

export function getMessageToPromptService(): CategoryPromptIntegrationService {
  if (!serviceInstance) {
    console.log('🔄 새로운 카테고리 프롬프트 통합 서비스로 초기화');
    serviceInstance = new CategoryPromptIntegrationService();
  }
  return serviceInstance;
}

// 레거시 서비스 (하위 호환성을 위해 유지)
export function getLegacyMessageToPromptService(): MessageToPromptServiceImpl {
  if (!legacyServiceInstance) {
    legacyServiceInstance = new MessageToPromptServiceImpl();
  }
  return legacyServiceInstance;
}
