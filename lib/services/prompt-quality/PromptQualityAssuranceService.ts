/**
 * PromptQualityAssuranceService - 메인 프롬프트 품질 보증 서비스
 * Task 003: Implement Prompt Quality Assurance System
 */

import { ContentFilterService } from './ContentFilterService';
import { PromptQualityAnalyzer } from './PromptQualityAnalyzer';
import { PromptEnhancer } from './PromptEnhancer';
import type { 
  PromptQualityAssurance, 
  ValidationResult, 
  PromptEnhancement, 
  QualityMetrics,
  QualityAssuranceConfig,
  QualityIssue
} from './types';

export class PromptQualityAssuranceService implements PromptQualityAssurance {
  private contentFilter: ContentFilterService;
  private qualityAnalyzer: PromptQualityAnalyzer;
  private promptEnhancer: PromptEnhancer;
  private config: QualityAssuranceConfig;

  constructor(config?: Partial<QualityAssuranceConfig>) {
    this.contentFilter = new ContentFilterService();
    this.qualityAnalyzer = new PromptQualityAnalyzer();
    this.promptEnhancer = new PromptEnhancer();
    
    // 기본 설정
    this.config = {
      minKeywords: 3,
      maxLength: 200,
      minDescriptiveness: 0.3,
      contentFilterEnabled: true,
      enhancementEnabled: true,
      strictMode: false,
      ...config
    };
  }

  /**
   * 프롬프트 검증 및 품질 확인
   */
  async validatePrompt(prompt: string, context?: any): Promise<ValidationResult> {
    try {
      // 1. 기본 품질 메트릭 계산
      const metrics = await this.calculateMetrics(prompt);
      
      // 2. 품질 문제점 식별
      const issues = this.qualityAnalyzer.identifyIssues(prompt, metrics);
      
      // 3. 콘텐츠 적절성 검사
      if (this.config.contentFilterEnabled) {
        const hasInappropriateContent = await this.contentFilter.hasInappropriateContent(prompt);
        
        if (hasInappropriateContent) {
          issues.push({
            type: 'inappropriate_content',
            severity: 'high',
            message: '부적절한 내용이 포함되어 있습니다.',
            suggestion: '내용을 수정하거나 다른 표현을 사용해보세요.'
          });
        }
      }
      
      // 4. 검증 결과 결정
      const isValid = this.determineValidation(metrics, issues);
      
      // 5. 자동 개선 (설정된 경우)
      let enhancedPrompt: string | undefined;
      if (!isValid && this.config.enhancementEnabled) {
        const enhancement = await this.enhancePrompt(prompt, context);
        if (enhancement.confidenceScore > 0.7) {
          enhancedPrompt = enhancement.enhanced;
        }
      }
      
      return {
        isValid,
        issues,
        enhancedPrompt,
        metrics
      };
      
    } catch (error) {
      console.error('프롬프트 검증 중 오류 발생:', error);
      
      return {
        isValid: false,
        issues: [{
          type: 'grammar',
          severity: 'high',
          message: '프롬프트 검증 중 오류가 발생했습니다.',
          suggestion: '프롬프트를 다시 확인해주세요.'
        }],
        metrics: {
          keywordCount: 0,
          descriptiveness: 0,
          appropriateness: 0,
          coherence: 0,
          overallScore: 0
        }
      };
    }
  }

  /**
   * 프롬프트 품질 개선
   */
  async enhancePrompt(prompt: string, context?: any): Promise<PromptEnhancement> {
    try {
      // 부적절한 내용 먼저 정화
      let cleanPrompt = prompt;
      if (this.config.contentFilterEnabled) {
        const hasInappropriate = await this.contentFilter.hasInappropriateContent(prompt);
        if (hasInappropriate) {
          cleanPrompt = await this.contentFilter.sanitizePrompt(prompt);
        }
      }
      
      // 프롬프트 개선 수행
      const enhancement = await this.promptEnhancer.enhancePrompt(cleanPrompt, context);
      
      // 개선된 프롬프트도 다시 검증
      const enhancedValidation = await this.validatePrompt(enhancement.enhanced, context);
      
      // 개선 결과에 검증 정보 추가
      if (!enhancedValidation.isValid) {
        enhancement.improvements.push('주의: 개선된 프롬프트도 추가 수정이 필요할 수 있습니다.');
      }
      
      return enhancement;
      
    } catch (error) {
      console.error('프롬프트 개선 중 오류 발생:', error);
      
      return {
        original: prompt,
        enhanced: prompt,
        improvements: ['프롬프트 개선 중 오류가 발생했습니다.'],
        confidenceScore: 0
      };
    }
  }

  /**
   * 콘텐츠 적절성 확인
   */
  async checkContentAppropriateness(prompt: string): Promise<boolean> {
    if (!this.config.contentFilterEnabled) {
      return true;
    }
    
    try {
      return !(await this.contentFilter.hasInappropriateContent(prompt));
    } catch (error) {
      console.error('콘텐츠 적절성 검사 중 오류 발생:', error);
      return false; // 안전을 위해 false 반환
    }
  }

  /**
   * 품질 메트릭 계산
   */
  async calculateMetrics(prompt: string): Promise<QualityMetrics> {
    try {
      return await this.qualityAnalyzer.calculateMetrics(prompt);
    } catch (error) {
      console.error('품질 메트릭 계산 중 오류 발생:', error);
      
      return {
        keywordCount: 0,
        descriptiveness: 0,
        appropriateness: 0,
        coherence: 0,
        overallScore: 0
      };
    }
  }

  /**
   * 검증 결과 결정
   */
  private determineValidation(metrics: QualityMetrics, issues: QualityIssue[]): boolean {
    // 심각한 문제가 있으면 무효
    const hasHighSeverityIssues = issues.some(issue => issue.severity === 'high');
    if (hasHighSeverityIssues) {
      return false;
    }
    
    // 엄격 모드인 경우 더 높은 기준 적용
    if (this.config.strictMode) {
      return (
        metrics.keywordCount >= this.config.minKeywords &&
        metrics.descriptiveness >= this.config.minDescriptiveness &&
        metrics.appropriateness >= 0.8 &&
        metrics.overallScore >= 0.7
      );
    }
    
    // 일반 모드 - 기본 기준 적용
    return (
      metrics.keywordCount >= Math.max(this.config.minKeywords - 1, 1) &&
      metrics.descriptiveness >= Math.max(this.config.minDescriptiveness - 0.1, 0.1) &&
      metrics.appropriateness >= 0.5 &&
      metrics.overallScore >= 0.4
    );
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig: Partial<QualityAssuranceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 현재 설정 조회
   */
  getConfig(): QualityAssuranceConfig {
    return { ...this.config };
  }

  /**
   * 콘텐츠 필터 규칙 업데이트
   */
  updateContentFilter(filterRules: any): void {
    this.contentFilter.updateFilterRules(filterRules);
  }

  /**
   * 품질 보증 통계 (선택적 기능)
   */
  async getQualityStats(prompts: string[]): Promise<{
    averageScore: number;
    passRate: number;
    commonIssues: { [key: string]: number };
  }> {
    const results = await Promise.all(
      prompts.map(prompt => this.validatePrompt(prompt))
    );
    
    const totalScore = results.reduce((sum, result) => sum + result.metrics.overallScore, 0);
    const averageScore = totalScore / results.length;
    
    const passCount = results.filter(result => result.isValid).length;
    const passRate = passCount / results.length;
    
    const commonIssues: { [key: string]: number } = {};
    results.forEach(result => {
      result.issues.forEach(issue => {
        commonIssues[issue.type] = (commonIssues[issue.type] || 0) + 1;
      });
    });
    
    return {
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      commonIssues
    };
  }
}

// 기본 인스턴스 생성 함수
export function createPromptQualityAssuranceService(config?: Partial<QualityAssuranceConfig>): PromptQualityAssuranceService {
  return new PromptQualityAssuranceService(config);
}

// 싱글톤 인스턴스 (선택적)
let defaultInstance: PromptQualityAssuranceService | null = null;

export function getPromptQualityAssuranceService(config?: Partial<QualityAssuranceConfig>): PromptQualityAssuranceService {
  if (!defaultInstance) {
    defaultInstance = new PromptQualityAssuranceService(config);
  }
  return defaultInstance;
}
