/**
 * 카테고리화된 프롬프트 시스템 타입 정의
 * 7개 카테고리 기반 ComfyUI 프롬프트 생성을 위한 타입들
 */

// 7개 카테고리 중 키워드 추출이 필요한 5개 카테고리
export interface CategoryKeywords {
  location_environment: string;    // 위치/환경
  outfit_style: string;           // 의상/스타일
  action_pose: string;            // 행동/포즈
  expression_emotion: string;     // 표정/감정
  atmosphere_lighting: string;    // 분위기/조명
}

// 7개 카테고리 모두 포함된 프롬프트 구조
export interface CategoryPrompts {
  person_base: string;           // 인물 기본 정보 (고정)
  location_environment: string;  // 위치/환경
  outfit_style: string;         // 의상/스타일
  action_pose: string;          // 행동/포즈
  expression_emotion: string;   // 표정/감정
  atmosphere_lighting: string;  // 분위기/조명
  camera_composition: string;   // 카메라/구도 (고정)
}

// 최종 카테고리 기반 프롬프트 결과
export interface CategoryBasedPrompt {
  positive_prompt: string;
  negative_prompt: string;
  category_breakdown: CategoryPrompts;
  quality_score: number;
  generation_info: {
    gender: 'male' | 'female';
    template_used: string;
    categories_filled: number;
    generated_at: Date;
  };
}

// Phase 5: 확장된 키워드 추출 결과
export interface CategoryAnalysisResult {
  extracted_keywords: CategoryKeywords;
  confidence_scores: Record<keyof CategoryKeywords, number>;
  analysis_method: 'claude_api_enhanced' | 'context_aware_fallback' | 'universal_context_analysis' | 'claude_api' | 'fallback';
  processing_time_ms: number;
  corrections_applied?: string[];  // Phase 2에서 추가
  reasoning?: string;              // Phase 1에서 추가
}

// 매핑 통계
export interface MappingStats {
  total_mappings: number;
  hit_rate: number;
  miss_rate: number;
  cache_hit_rate: number;
  avg_mapping_time_ms: number;
}

// 서비스 성능 통계
export interface CategoryServiceStats {
  total_conversions: number;
  avg_processing_time_ms: number;
  success_rate: number;
  cache_efficiency: number;
  api_call_count: number;
}

// 품질 설정
export interface QualityConfig {
  level: 'draft' | 'standard' | 'premium';
  enhancers: string[];
  negative_filters: string[];
}

// 채팅 컨텍스트
export interface ChatContext {
  recent_messages?: string[];
  user_preferences?: Record<string, any>;
  conversation_topic?: string;
}

// 사용자 설정
export interface UserPreferences {
  preferred_style?: string;
  avoid_keywords?: string[];
  quality_preference?: 'speed' | 'quality';
}

// 메시지 컨텍스트
export interface MessageContext {
  message: string;
  gender?: 'male' | 'female';
  chat_history?: any[];
  user_preferences?: UserPreferences;
}

// 매핑 테이블 타입
export type CategoryMapping = Record<string, string>;

// 카테고리 타입
export type CategoryType = keyof CategoryKeywords;

// 에러 타입
export interface CategoryPromptError extends Error {
  code: string;
  category?: CategoryType;
  details?: any;
}

// 캐시 설정
export interface CacheConfig {
  ttl_seconds: number;
  max_entries: number;
  enabled: boolean;
}