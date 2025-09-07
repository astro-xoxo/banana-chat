/**
 * 프롬프트 시스템 타입 정의
 * AI 챗봇의 카테고리화된 프롬프트 시스템을 위한 타입 정의
 */

/**
 * 메인 카테고리 타입
 */
export type MainCategory = 
  | 'relationship'   // 관계 설정
  | 'personality'    // 성격 특성
  | 'situation'      // 상황 설정
  | 'interaction';   // 상호작용 스타일

/**
 * 서브 카테고리 타입 (관계 설정)
 */
export type RelationshipSubCategory = 
  | 'romantic'       // 연인
  | 'friendship'     // 친구
  | 'professional'   // 직장/비즈니스
  | 'family'         // 가족
  | 'mentor';        // 멘토/조언자

/**
 * 서브 카테고리 타입 (성격 특성)
 */
export type PersonalitySubCategory = 
  | 'cheerful'       // 밝고 긍정적
  | 'calm'           // 차분하고 이성적
  | 'passionate'     // 열정적
  | 'gentle'         // 온화하고 부드러운
  | 'playful'        // 장난스럽고 유머러스
  | 'serious';       // 진지하고 신중한

/**
 * 서브 카테고리 타입 (상황 설정)
 */
export type SituationSubCategory = 
  | 'daily'          // 일상 대화
  | 'support'        // 위로/지원
  | 'celebration'    // 축하/기념
  | 'advice'         // 조언/상담
  | 'entertainment'  // 엔터테인먼트
  | 'learning';      // 학습/교육

/**
 * 서브 카테고리 타입 (상호작용 스타일)
 */
export type InteractionSubCategory = 
  | 'casual'         // 캐주얼한 대화
  | 'formal'         // 격식있는 대화
  | 'emotional'      // 감정적 교류
  | 'intellectual'   // 지적인 대화
  | 'playful_banter' // 재미있는 농담
  | 'deep_talk';     // 깊은 대화

/**
 * 통합 서브 카테고리 타입
 */
export type SubCategory = 
  | RelationshipSubCategory 
  | PersonalitySubCategory 
  | SituationSubCategory 
  | InteractionSubCategory;

/**
 * 프롬프트 템플릿 인터페이스
 */
export interface PromptTemplate {
  id: string;
  category: MainCategory;
  subcategory: SubCategory;
  name: string;
  description: string;
  template: string;
  variables?: PromptVariable[];
  examples?: string[];
  tags?: string[];
  popularity?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 프롬프트 변수 인터페이스
 */
export interface PromptVariable {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

/**
 * 카테고리 정보 인터페이스
 */
export interface CategoryInfo {
  id: MainCategory;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  subcategories: SubCategoryInfo[];
}

/**
 * 서브 카테고리 정보 인터페이스
 */
export interface SubCategoryInfo {
  id: SubCategory;
  name: string;
  description: string;
  parentCategory: MainCategory;
  templateCount?: number;
  icon?: string;
}

/**
 * 프롬프트 선택 상태 인터페이스
 */
export interface PromptSelectionState {
  selectedCategory: MainCategory | null;
  selectedSubcategory: SubCategory | null;
  selectedTemplate: PromptTemplate | null;
  variableValues: Record<string, any>;
  generatedPrompt: string;
}

/**
 * 프롬프트 필터 옵션 인터페이스
 */
export interface PromptFilterOptions {
  categories?: MainCategory[];
  subcategories?: SubCategory[];
  tags?: string[];
  searchQuery?: string;
  sortBy?: 'name' | 'popularity' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 프롬프트 통계 인터페이스
 */
export interface PromptStatistics {
  totalTemplates: number;
  categoryCounts: Record<MainCategory, number>;
  popularTemplates: PromptTemplate[];
  recentlyUsed: PromptTemplate[];
}

/**
 * 커스텀 프롬프트 인터페이스
 */
export interface CustomPrompt {
  id: string;
  userId: string;
  name: string;
  description?: string;
  baseTemplateId?: string;
  customTemplate: string;
  variables?: PromptVariable[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 프롬프트 생성 결과 인터페이스
 */
export interface PromptGenerationResult {
  success: boolean;
  prompt: string;
  metadata: {
    templateId: string;
    category: MainCategory;
    subcategory: SubCategory;
    variables: Record<string, any>;
    generatedAt: Date;
  };
  error?: string;
}

/**
 * 카테고리 매핑 타입
 */
export type CategoryMapping = {
  [K in MainCategory]: Extract<SubCategory, 
    K extends 'relationship' ? RelationshipSubCategory :
    K extends 'personality' ? PersonalitySubCategory :
    K extends 'situation' ? SituationSubCategory :
    K extends 'interaction' ? InteractionSubCategory :
    never
  >[];
};

/**
 * 프롬프트 검증 결과 인터페이스
 */
export interface PromptValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * 프롬프트 미리보기 옵션 인터페이스
 */
export interface PromptPreviewOptions {
  showVariables: boolean;
  highlightVariables: boolean;
  maxLength?: number;
  truncate?: boolean;
}

/**
 * 카테고리별 프롬프트 템플릿 매핑 타입
 */
export type CategoryTemplateMap = {
  [K in MainCategory]: {
    [S in Extract<SubCategory, CategoryMapping[K][number]>]: PromptTemplate[];
  };
};

/**
 * 프롬프트 사용 기록 인터페이스
 */
export interface PromptUsageHistory {
  id: string;
  userId: string;
  templateId: string;
  usedAt: Date;
  variableValues: Record<string, any>;
  generatedPrompt: string;
  chatbotId?: string;
}

/**
 * 프롬프트 평가 인터페이스
 */
export interface PromptRating {
  id: string;
  userId: string;
  templateId: string;
  rating: number; // 1-5
  feedback?: string;
  createdAt: Date;
}