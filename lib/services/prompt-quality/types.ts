/**
 * Types for Prompt Quality Assurance System
 * Task 003: Implement Prompt Quality Assurance System
 */

export interface QualityMetrics {
  keywordCount: number;
  descriptiveness: number; // 0-1 score
  appropriateness: number; // 0-1 score  
  coherence: number; // 0-1 score
  overallScore: number; // 0-1 weighted score
}

export interface ValidationResult {
  isValid: boolean;
  issues: QualityIssue[];
  enhancedPrompt?: string;
  metrics: QualityMetrics;
}

export interface QualityIssue {
  type: 'insufficient_keywords' | 'inappropriate_content' | 'too_long' | 'too_vague' | 'grammar';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion?: string;
}

export interface ContentFilter {
  inappropriateKeywords: string[];
  sensitivePhrases: string[];
  bannedTerms: string[];
}

export interface PromptEnhancement {
  original: string;
  enhanced: string;
  improvements: string[];
  confidenceScore: number;
}

export interface QualityAssuranceConfig {
  minKeywords: number;
  maxLength: number;
  minDescriptiveness: number;
  contentFilterEnabled: boolean;
  enhancementEnabled: boolean;
  strictMode: boolean;
}

export interface PromptQualityAssurance {
  validatePrompt(prompt: string, context?: any): Promise<ValidationResult>;
  enhancePrompt(prompt: string, context?: any): Promise<PromptEnhancement>;
  checkContentAppropriateness(prompt: string): Promise<boolean>;
  calculateMetrics(prompt: string): Promise<QualityMetrics>;
}
