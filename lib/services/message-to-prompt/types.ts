/**
 * 메시지-프롬프트 변환 엔진 TypeScript 인터페이스
 * Task 001: Design Message-to-Prompt Conversion Engine
 */

export interface ExtractedKeywords {
  emotions: string[];
  situations: string[];
  actions: string[];
  objects: string[];
  style: string[];
  confidence: number; // 0-1 범위의 신뢰도 점수
  raw_analysis: string; // Claude의 원본 분석 텍스트
}

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  keywords_map: {
    [category: string]: {
      [keyword: string]: string; // 키워드 -> ComfyUI 프롬프트 조각
    };
  };
  style_modifiers: {
    [style: string]: string;
  };
  quality_tags: string[];
  negative_prompts: string[];
}

export interface GeneratedPrompt {
  positive_prompt: string;
  negative_prompt: string;
  style_modifiers: string[];
  quality_score: number; // 0-1 범위의 품질 점수
  source_keywords: ExtractedKeywords;
  template_used: string;
  generated_at: Date;
}



// 메시지 컨텍스트 인터페이스 추가
export interface MessageContext {
  message_id: string;
  session_id?: string;
  content?: string;
  message_content?: string;  // API 호환성을 위한 별칭
  gender?: 'male' | 'female';
  chat_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  previous_messages?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  chatbot_info?: {
    personality?: string;
    relationship_type?: string;
    visual_characteristics?: string;
  };
  // ✅ 캐릭터 정보를 위한 user_preferences 추가
  user_preferences?: {
    age?: number;
    gender?: string;
    relationship?: string;
    name?: string;
    preferred_style?: string;
    art_style?: string;
  };
}

export interface ConversionOptions {
  template_id?: string;
  style_override?: string;
  quality_level?: 'draft' | 'standard' | 'high' | 'premium';
  include_context?: boolean;
  max_prompt_length?: number;
  fallback_on_error?: boolean;
  user_preferences?: {
    preferredStyle?: string;
    colorPreference?: string;
    [key: string]: any;
  };
}

export interface ConversionResult {
  success: boolean;
  prompt?: {
    positive_prompt: string;
    negative_prompt: string;
    quality_score: number;
    template_used: string;
    source_keywords?: any;
  } | null;
  positive_prompt?: string;
  negative_prompt?: string;
  quality_score?: number;
  template_used?: string;
  processing_time_ms?: number;
  generation_id?: string;
  keywords_extracted?: any;
  metadata?: any;
  error?: {
    code: string;
    message: string;
    retry_suggested: boolean;
  };
  performance?: {
    extraction_time_ms: number;
    generation_time_ms: number;
    quality_assurance_time_ms?: number;
    total_time_ms: number;
    tokens_used: number;
  };
  quality_info?: {
    validation_passed: boolean;
    quality_score: number;
    issues: Array<{
      type: string;
      severity: string;
      message: string;
      suggestion?: string;
    }>;
    was_enhanced: boolean;
  };
}

export interface MessageAnalyzer {
  analyzeMessage(context: MessageContext): Promise<ExtractedKeywords>;
  extractKeywords(content: string, context?: Partial<MessageContext>): Promise<ExtractedKeywords>;
  validateExtraction(keywords: ExtractedKeywords): boolean;
}

export interface PromptGenerator {
  generatePrompt(keywords: ExtractedKeywords, options?: ConversionOptions): Promise<GeneratedPrompt>;
  getTemplate(templateId: string): PromptTemplate | null;
  listTemplates(): PromptTemplate[];
  validatePrompt(prompt: GeneratedPrompt): boolean;
}



// 에러 타입 정의
export class MessageToPromptError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'MessageToPromptError';
  }
}

// 상수 정의
export const ERROR_CODES = {
  CLAUDE_API_ERROR: 'CLAUDE_API_ERROR',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  KEYWORD_EXTRACTION_FAILED: 'KEYWORD_EXTRACTION_FAILED',
  PROMPT_GENERATION_FAILED: 'PROMPT_GENERATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  TIMEOUT: 'TIMEOUT'
} as const;

export const QUALITY_LEVELS = {
  draft: {
    max_tokens: 200,
    temperature: 0.9,
    quality_tags: ['simple', 'sketch']
  },
  standard: {
    max_tokens: 400,
    temperature: 0.8,
    quality_tags: ['detailed', 'clean']
  },
  high: {
    max_tokens: 600,
    temperature: 0.7,
    quality_tags: ['highly detailed', 'professional', 'masterpiece']
  },
  premium: {
    max_tokens: 800,
    temperature: 0.6,
    quality_tags: ['ultra detailed', 'award winning', 'masterpiece', '8k', 'photorealistic']
  }
} as const;
