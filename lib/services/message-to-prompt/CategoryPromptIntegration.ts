/**
 * CategoryPromptIntegration - 기존 MessageToPromptService와 새로운 CategoryPromptService 통합
 * 기존 인터페이스를 유지하면서 새로운 카테고리 기반 시스템을 사용
 */

import { CategoryPromptService } from '../category-prompt';
import { ClaudeClient } from '@/lib/claude';
import type {
  MessageToPromptService,
  MessageContext,
  ConversionOptions,
  ConversionResult,
  MessageToPromptError
} from './types';
import { ERROR_CODES } from './types';

export class CategoryPromptIntegrationService implements MessageToPromptService {
  private categoryService: CategoryPromptService;
  private isInitialized = false;
  private stats = {
    total_conversions: 0,
    successful_conversions: 0,
    failed_conversions: 0,
    total_time_ms: 0,
    category_based_conversions: 0,
    fallback_conversions: 0
  };

  constructor() {
    // Claude 클라이언트 초기화
    const claudeClient = new ClaudeClient();
    this.categoryService = new CategoryPromptService(claudeClient);
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    console.log('CategoryPromptIntegrationService: 초기화 시작');
    this.isInitialized = true;
    console.log('CategoryPromptIntegrationService: 초기화 완료');
  }

  /**
   * 메시지를 프롬프트로 변환 (API 호환용 메소드)
   */
  async convert(
    context: MessageContext,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    return await this.convertMessageToPrompt(context, options);
  }

  /**
   * 메시지를 프롬프트로 변환 (기존 인터페이스 호환)
   */
  async convertMessageToPrompt(
    context: MessageContext,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.stats.total_conversions++;

    try {
      console.log('카테고리 기반 프롬프트 변환 시작:', {
        message_id: context.message_id,
        content_length: context.content?.length,
        gender: context.gender,
        quality_level: options.quality_level
      });

      // 메시지 내용 추출 (API 호환성)
      const messageContent = context.content || context.message_content || '';
      
      console.log('📝 메시지 내용 확인:', {
        content: context.content,
        message_content: context.message_content,
        final_content: messageContent,
        gender: context.gender,
        user_preferences: context.user_preferences
      });

      // 새로운 카테고리 프롬프트 서비스 사용 - 캐릭터 정보 전달
      const categoryPrompt = await this.categoryService.convertMessageToPrompt(
        messageContent,
        {
          gender: context.gender as 'male' | 'female' || 'female',
          chatHistory: context.chat_history,
          qualityLevel: this.mapQualityLevel(options.quality_level),
          // ✅ 캐릭터 정보 전달
          userPreferences: context.user_preferences ? {
            age: context.user_preferences.age,
            gender: context.user_preferences.gender,
            relationship: context.user_preferences.relationship,
            name: context.user_preferences.name
          } : undefined
        }
      );

      // 기존 형식으로 변환
      const result: ConversionResult = {
        success: true,
        // route.ts가 기대하는 prompt 객체 구조 추가
        prompt: {
          positive_prompt: categoryPrompt.positive_prompt,
          negative_prompt: categoryPrompt.negative_prompt,
          quality_score: categoryPrompt.quality_score,
          template_used: categoryPrompt.generation_info.template_used,
          source_keywords: categoryPrompt.category_breakdown
        },
        // 호환성을 위해 기존 필드들도 유지
        positive_prompt: categoryPrompt.positive_prompt,
        negative_prompt: categoryPrompt.negative_prompt,
        quality_score: categoryPrompt.quality_score,
        template_used: categoryPrompt.generation_info.template_used,
        processing_time_ms: Date.now() - startTime,
        generation_id: `category_${Date.now()}`,
        keywords_extracted: categoryPrompt.category_breakdown,
        metadata: {
          conversion_method: 'category_based',
          categories_filled: categoryPrompt.generation_info.categories_filled,
          gender: categoryPrompt.generation_info.gender,
          generation_info: categoryPrompt.generation_info
        }
      };

      this.stats.successful_conversions++;
      this.stats.category_based_conversions++;
      this.stats.total_time_ms += result.processing_time_ms;

      console.log('카테고리 기반 프롬프트 변환 성공:', {
        quality_score: result.quality_score,
        processing_time: result.processing_time_ms,
        positive_length: result.positive_prompt.length,
        negative_length: result.negative_prompt.length
      });

      return result;

    } catch (error) {
      console.error('카테고리 프롬프트 변환 실패:', error);
      this.stats.failed_conversions++;

      // 폴백: 간단한 기본 프롬프트 생성
      const fallbackResult = await this.createFallbackPrompt(context, options);
      this.stats.fallback_conversions++;
      
      return fallbackResult;
    }
  }

  /**
   * 폴백 프롬프트 생성
   */
  private async createFallbackPrompt(
    context: MessageContext,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    console.log('폴백 프롬프트 생성 중...');

    const gender = (context.gender as 'male' | 'female') || 'female';
    const personBase = gender === 'female' 
      ? '1girl, beautiful young woman, detailed face, natural expression'
      : '1boy, handsome young man, detailed face, confident expression';

    const basicPrompt = [
      '(best quality:1.2)',
      personBase,
      'comfortable setting, natural pose, pleasant expression',
      'soft lighting, professional composition'
    ].join(', ');

    const basicNegative = [
      'nsfw, nude, sexual content, inappropriate, explicit',
      'low quality, worst quality, bad anatomy, blurry, distorted'
    ].join(', ');

    return {
      success: true,
      // route.ts가 기대하는 prompt 객체 구조 추가
      prompt: {
        positive_prompt: basicPrompt,
        negative_prompt: basicNegative,
        quality_score: 60,
        template_used: 'fallback_basic',
        source_keywords: {
          method: 'fallback',
          categories: 'basic_template'
        }
      },
      // 호환성을 위해 기존 필드들도 유지
      positive_prompt: basicPrompt,
      negative_prompt: basicNegative,
      quality_score: 60,
      template_used: 'fallback_basic',
      processing_time_ms: 50,
      generation_id: `fallback_${Date.now()}`,
      keywords_extracted: {
        method: 'fallback',
        categories: 'basic_template'
      },
      metadata: {
        conversion_method: 'fallback',
        reason: 'category_service_error',
        gender
      }
    };
  }

  /**
   * 품질 레벨 매핑
   */
  private mapQualityLevel(level?: string): 'draft' | 'standard' | 'premium' {
    const mapping: Record<string, 'draft' | 'standard' | 'premium'> = {
      'draft': 'draft',
      'standard': 'standard', 
      'high': 'premium',
      'premium': 'premium'
    };
    
    return mapping[level || 'standard'] || 'standard';
  }

  /**
   * 배치 변환 (기존 인터페이스 호환)
   */
  async convertBatch(
    contexts: MessageContext[],
    options: ConversionOptions = {}
  ): Promise<ConversionResult[]> {
    console.log(`배치 변환 시작: ${contexts.length}개 메시지`);

    const results = await Promise.all(
      contexts.map(context => this.convertMessageToPrompt(context, options))
    );

    const successCount = results.filter(r => r.success).length;
    console.log(`배치 변환 완료: ${successCount}/${contexts.length} 성공`);

    return results;
  }

  /**
   * 템플릿 사전 로드 (호환성을 위한 빈 구현)
   */
  async preloadTemplates(): Promise<void> {
    console.log('CategoryPromptIntegrationService: 템플릿 사전 로드 (카테고리 매핑 사용)');
    // 카테고리 매핑은 이미 로드되어 있으므로 별도 작업 불필요
  }

  /**
   * 사용 가능한 템플릿 반환
   */
  getAvailableTemplates(): string[] {
    return [
      'category_based_standard',
      'category_based_draft', 
      'category_based_premium',
      'fallback_basic'
    ];
  }

  /**
   * 서비스 통계
   */
  getServiceStats() {
    const categoryStats = this.categoryService.getPerformanceStats();
    
    return {
      total_conversions: this.stats.total_conversions,
      successful_conversions: this.stats.successful_conversions,
      failed_conversions: this.stats.failed_conversions,
      success_rate: this.stats.total_conversions > 0 
        ? (this.stats.successful_conversions / this.stats.total_conversions) * 100 
        : 0,
      average_processing_time: this.stats.total_conversions > 0
        ? this.stats.total_time_ms / this.stats.total_conversions
        : 0,
      category_based_rate: this.stats.total_conversions > 0
        ? (this.stats.category_based_conversions / this.stats.total_conversions) * 100
        : 0,
      fallback_rate: this.stats.total_conversions > 0
        ? (this.stats.fallback_conversions / this.stats.total_conversions) * 100
        : 0,
      category_service_stats: categoryStats
    };
  }

  /**
   * 서비스 상태 확인
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    const stats = this.getServiceStats();
    const categoryHealth = this.categoryService.getServiceHealth();
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (stats.success_rate < 90) {
      status = 'degraded';
    }
    if (stats.success_rate < 70) {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        integration_stats: stats,
        category_service_health: categoryHealth,
        initialized: this.isInitialized,
        last_check: new Date().toISOString()
      }
    };
  }

  /**
   * 캐시 정리
   */
  clearCache(): void {
    this.categoryService.clearAllCaches();
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      total_conversions: 0,
      successful_conversions: 0,
      failed_conversions: 0,
      total_time_ms: 0,
      category_based_conversions: 0,
      fallback_conversions: 0
    };
    this.categoryService.resetStats();
  }
}