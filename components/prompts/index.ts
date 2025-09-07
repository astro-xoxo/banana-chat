/**
 * 프롬프트 컴포넌트 통합 인덱스
 * 모든 프롬프트 관련 컴포넌트를 한 곳에서 import할 수 있도록 함
 */

export { CategorySelector, SelectedCategoryBadge } from './CategorySelector';
export { SubcategorySelector, SelectedSubcategoryBreadcrumb } from './SubcategorySelector';
export { TemplatePreview } from './TemplatePreview';
export { TemplateSelector } from './TemplateSelector';

// 통합 프롬프트 선택기 컴포넌트 (추후 구현 예정)
// export { PromptBuilder } from './PromptBuilder';

// 프롬프트 관련 훅들 재export
export {
  usePromptStore,
  usePromptSelection,
  usePromptTemplates,
  usePromptFilters,
  usePromptActions,
  usePromptUI,
  initializePromptStore
} from '@/stores/promptStore';

// 프롬프트 유틸리티 함수들 재export
export {
  generatePromptFromTemplate,
  validatePromptVariables,
  generatePromptPreview,
  searchPromptTemplates,
  sortPromptTemplates
} from '@/lib/prompts/utils';

// 데이터 및 타입 재export
export type {
  PromptTemplate,
  PromptVariable,
  MainCategory,
  SubCategory,
  PromptSelectionState,
  PromptFilterOptions
} from '@/lib/prompts/types';

export {
  CATEGORIES,
  ALL_TEMPLATES,
  DEFAULT_TEMPLATE
} from '@/lib/prompts/data/templates';