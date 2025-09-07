/**
 * CategoryPromptService - 카테고리화된 프롬프트 시스템 메인 서비스
 * 모든 하위 서비스를 통합하여 메시지를 ComfyUI 프롬프트로 변환
 */

import { CategoryAnalyzer } from './CategoryAnalyzer';
import { PromptAssembler } from './PromptAssembler';
import { getMessageTagEnhancer } from '@/lib/messageTagEnhancer';
import { 
  CategoryBasedPrompt, 
  CategoryPrompts,
  MessageContext,
  CategoryServiceStats,
  UserPreferences,
  ChatContext
} from './types';

interface ClaudeClient {
  messages: {
    create: (params: any) => Promise<any>;
  };
}

export class CategoryPromptService {
  private analyzer: CategoryAnalyzer;
  private assembler: PromptAssembler;
  private stats = {
    total_conversions: 0,
    successful_conversions: 0,
    failed_conversions: 0,
    total_processing_time: 0,
    cache_hits: 0
  };

  constructor() {
    this.analyzer = new CategoryAnalyzer();
    this.assembler = new PromptAssembler();
  }

  /**
   * 메인 변환 메서드: 메시지 → 카테고리 기반 프롬프트
   */
  async convertMessageToPrompt(
    message: string,
    context: {
      gender?: 'male' | 'female';
      chatHistory?: any[];
      userPreferences?: UserPreferences;
      qualityLevel?: 'draft' | 'standard' | 'premium';
    } = {}
  ): Promise<CategoryBasedPrompt> {
    const startTime = Date.now();
    this.stats.total_conversions++;

    try {
      // 🏷️ 0단계: 태그 강화 시스템 적용 (우선 단계)
      console.log('🏷️ CategoryPromptService: 태그 강화 시스템 적용 시작');
      let enhancedMessage = message;
      
      try {
        const tagEnhancer = getMessageTagEnhancer();
        enhancedMessage = await tagEnhancer.addHiddenTags(message, {
          recentMessages: context.chatHistory?.slice(-3).map(m => m.content) || [],
          chatbotPersonality: context.userPreferences?.personality || '친근한 캐릭터',
          // 🎯 실제 캐릭터 정보 전달
          characterInfo: {
            name: context.userPreferences?.name,
            age: context.userPreferences?.age,
            gender: context.userPreferences?.gender,
            relationship: context.userPreferences?.relationship,
            situation: context.userPreferences?.situation
          }
        });
        
        console.log('🏷️ CategoryPromptService: 태그 강화 완료:', {
          original_length: message.length,
          enhanced_length: enhancedMessage.length,
          tags_added: enhancedMessage !== message,
          has_html_comments: enhancedMessage.includes('<!--')
        });
      } catch (tagError) {
        console.error('🚨 CategoryPromptService: 태그 강화 실패, 원본 메시지 사용:', tagError);
        enhancedMessage = message;
      }

      // 1단계: 컨텍스트 분석 및 키워드 추출 (CategoryAnalyzer - 2단계 API)
      const chatContext: ChatContext = {
        recent_messages: context.chatHistory?.slice(-5).map(m => m.content) || [],
        user_preferences: context.userPreferences
      };

      // 🎯 강화된 메시지를 사용하여 분석
      const analysisResult = await this.analyzer.extractKeywords(enhancedMessage, chatContext);
      console.log('✅ 2단계 API 분석 완료 - 태그 강화 시스템 적용됨:', {
        original_message_preview: message.substring(0, 50),
        enhanced_message_preview: enhancedMessage.substring(0, 50),
        tags_applied: enhancedMessage !== message,
        extracted_keywords: analysisResult.extracted_keywords,
        analysis_method: analysisResult.analysis_method,
        processing_time: analysisResult.processing_time_ms
      });
      
      // 2단계: 성별별 기본 프롬프트 + Claude 생성 키워드 조합 - 나이 정보 추가
      const gender = context.gender || 'female';
      const age = context.userPreferences?.age; // 나이 정보 추출
      
      console.log('🎯 캐릭터 정보 확인:', {
        gender,
        age,
        relationship: context.userPreferences?.relationship,
        has_user_preferences: !!context.userPreferences
      });
      
      const categoryPrompts: CategoryPrompts = {
        person_base: PromptAssembler.getPersonBase(gender, age), // ✅ 나이 정보 전달
        location_environment: analysisResult.extracted_keywords.location_environment,
        outfit_style: analysisResult.extracted_keywords.outfit_style,
        action_pose: analysisResult.extracted_keywords.action_pose,
        expression_emotion: analysisResult.extracted_keywords.expression_emotion,
        atmosphere_lighting: analysisResult.extracted_keywords.atmosphere_lighting,
        camera_composition: PromptAssembler.CAMERA_COMPOSITION
      };

      // 3단계: 최종 프롬프트 조합 (PromptAssembler)
      const qualityLevel = context.qualityLevel || 'standard';
      const finalPrompt = this.assembler.assemblePrompt(
        categoryPrompts, 
        gender, 
        qualityLevel
      );

      // 4단계: 통계 업데이트
      this.stats.successful_conversions++;
      this.stats.total_processing_time += Date.now() - startTime;

      return finalPrompt;

    } catch (error) {
      console.error('프롬프트 변환 실패:', error);
      this.stats.failed_conversions++;
      
      // 폴백: 기본 프롬프트 생성 - 나이 정보 전달
      return this.createFallbackPrompt(
        message, 
        context.gender || 'female',
        context.userPreferences?.age
      );
    }
  }

  /**
   * 배치 처리: 여러 메시지를 한 번에 변환
   */
  async convertMessages(messages: MessageContext[]): Promise<CategoryBasedPrompt[]> {
    const results = await Promise.all(
      messages.map(async (msgContext) => {
        try {
          return await this.convertMessageToPrompt(
            msgContext.message,
            {
              gender: msgContext.gender,
              chatHistory: msgContext.chat_history,
              userPreferences: msgContext.user_preferences
            }
          );
        } catch (error) {
          console.error(`메시지 변환 실패: ${msgContext.message}`, error);
          return this.createFallbackPrompt(
            msgContext.message, 
            msgContext.gender || 'female',
            msgContext.user_preferences?.age
          );
        }
      })
    );

    return results;
  }

  /**
   * 폴백 프롬프트 생성 (오류 발생 시) - 나이 정보 고려
   */
  private createFallbackPrompt(
    message: string, 
    gender: 'male' | 'female', 
    age?: number
  ): CategoryBasedPrompt {
    const categoryPrompts: CategoryPrompts = {
      person_base: PromptAssembler.getPersonBase(gender, age), // ✅ 나이 정보 전달
      location_environment: 'in comfortable indoor setting, soft natural lighting',
      outfit_style: 'stylish casual outfit, comfortable everyday clothing',
      action_pose: 'natural relaxed pose, comfortable body posture',
      expression_emotion: 'natural pleasant expression, gentle comfortable demeanor',
      atmosphere_lighting: 'soft natural lighting, comfortable warm atmosphere',
      camera_composition: PromptAssembler.CAMERA_COMPOSITION
    };

    return this.assembler.assemblePrompt(categoryPrompts, gender, 'standard');
  }

  /**
   * 성능 통계 반환
   */
  getPerformanceStats(): CategoryServiceStats {
    const total = this.stats.total_conversions;
    const avgTime = total > 0 ? this.stats.total_processing_time / total : 0;
    const successRate = total > 0 ? (this.stats.successful_conversions / total) * 100 : 0;

    // 하위 서비스 통계 포함 (2단계 구조)
    const analyzerStats = this.analyzer.getStats();

    return {
      total_conversions: total,
      avg_processing_time_ms: avgTime,
      success_rate: successRate,
      cache_efficiency: analyzerStats.performance_stats?.cache_hit_rate || '0%',
      api_call_count: analyzerStats.performance_stats?.api_calls || 0,
      structure_info: '2단계 API 구조 (CategoryMapper 제거 완료)'
    };
  }

  /**
   * 상세 분석 정보 반환 (디버깅용)
   */
  async analyzeMessage(
    message: string,
    context: { gender?: 'male' | 'female' } = {}
  ): Promise<any> {
    const analysisResult = await this.analyzer.extractKeywords(message);
    
    return {
      original_message: message,
      extracted_keywords: analysisResult.extracted_keywords,
      confidence_scores: analysisResult.confidence_scores,
      direct_prompts: analysisResult.extracted_keywords, // CategoryMapper 없이 직접 사용
      analysis_method: analysisResult.analysis_method,
      processing_time_ms: analysisResult.processing_time_ms,
      structure_info: '2단계 API 구조 (Analyzer → Assembler)'
    };
  }

  /**
   * 카테고리별 사용 가능한 키워드 반환
   */
  getAvailableKeywords() {
    return {
      message: '2단계 API 구조에서는 Claude가 직접 키워드를 생성하므로 고정 키워드 목록이 없습니다',
      supported_categories: [
        'location_environment',
        'outfit_style', 
        'action_pose',
        'expression_emotion',
        'atmosphere_lighting'
      ],
      generation_method: 'Claude API 기반 동적 생성'
    };
  }

  /**
   * 캐시 정리
   */
  clearAllCaches(): void {
    this.analyzer.clearCache();
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      total_conversions: 0,
      successful_conversions: 0,
      failed_conversions: 0,
      total_processing_time: 0,
      cache_hits: 0
    };
  }

  /**
   * 서비스 상태 확인
   */
  getServiceHealth(): any {
    const stats = this.getPerformanceStats();
    
    return {
      status: stats.success_rate > 90 ? 'healthy' : 'degraded',
      success_rate: stats.success_rate,
      avg_response_time: stats.avg_processing_time_ms,
      total_requests: stats.total_conversions,
      cache_efficiency: stats.cache_efficiency,
      last_check: new Date().toISOString()
    };
  }

  /**
   * 프롬프트 품질 검증
   */
  validatePrompt(prompt: CategoryBasedPrompt): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 길이 검사
    if (prompt.positive_prompt.length > 1500) {
      issues.push('긍정 프롬프트가 너무 깁니다');
      recommendations.push('프롬프트 길이를 1500자 이하로 줄여주세요');
    }

    if (prompt.negative_prompt.length > 1000) {
      issues.push('부정 프롬프트가 너무 깁니다');
    }

    // NSFW 키워드 검사
    const nsfwKeywords = ['nude', 'sexual', 'explicit', 'inappropriate'];
    const hasNSFW = nsfwKeywords.some(keyword => 
      prompt.positive_prompt.toLowerCase().includes(keyword)
    );
    
    if (hasNSFW) {
      issues.push('긍정 프롬프트에 부적절한 키워드가 포함되어 있습니다');
      recommendations.push('NSFW 키워드를 제거해주세요');
    }

    // 품질 점수 검사
    if (prompt.quality_score < 70) {
      recommendations.push('더 구체적인 키워드를 사용하여 품질을 향상시켜주세요');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
}