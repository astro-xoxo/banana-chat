/**
 * 카테고리 프롬프트 서비스 메인 익스포트
 * 외부에서 사용할 수 있도록 모든 주요 클래스와 타입을 익스포트
 */

// 메인 서비스
import { CategoryPromptService } from './CategoryPromptService';
import { PromptAssembler } from './PromptAssembler';
export { CategoryPromptService } from './CategoryPromptService';

// 개별 컴포넌트
export { CategoryAnalyzer } from './CategoryAnalyzer';
export { CategoryMapper } from './CategoryMapper';
export { PromptAssembler } from './PromptAssembler';

// 타입 정의
export type {
  CategoryKeywords,
  CategoryPrompts,
  CategoryBasedPrompt,
  CategoryAnalysisResult,
  CategoryType,
  MessageContext,
  ChatContext,
  UserPreferences,
  QualityConfig,
  MappingStats,
  CategoryServiceStats,
  CategoryPromptError,
  CacheConfig
} from './types';

// 매핑 데이터
export {
  LOCATION_MAPPINGS,
  OUTFIT_MAPPINGS,
  ACTION_MAPPINGS,
  EXPRESSION_MAPPINGS,
  ATMOSPHERE_MAPPINGS,
  ALL_MAPPINGS,
  type LocationKeyword,
  type OutfitKeyword,
  type ActionKeyword,
  type ExpressionKeyword,
  type AtmosphereKeyword,
  type MappingKeyword
} from './mappings';

// 유틸리티 함수들
export const CategoryPromptUtils = {
  /**
   * 기본 서비스 인스턴스 생성
   */
  createService: (claudeClient: any, translationService?: any) => {
    return new CategoryPromptService(claudeClient, translationService);
  },

  /**
   * 빠른 프롬프트 변환 (간단한 사용을 위한 헬퍼)
   */
  quickConvert: async (
    message: string, 
    gender: 'male' | 'female', 
    claudeClient: any
  ) => {
    const service = new CategoryPromptService(claudeClient);
    return await service.convertMessageToPrompt(message, { gender });
  },

  /**
   * 성별에 따른 기본 인물 프롬프트 반환
   */
  getPersonBase: PromptAssembler.getPersonBase,

  /**
   * 카메라 구도 프롬프트 반환
   */
  getCameraComposition: () => PromptAssembler.CAMERA_COMPOSITION,

  /**
   * 지원되는 품질 레벨 목록
   */
  getSupportedQualityLevels: () => ['draft', 'standard', 'premium'] as const,

  /**
   * 지원되는 카테고리 목록
   */
  getSupportedCategories: () => [
    'location_environment',
    'outfit_style', 
    'action_pose',
    'expression_emotion',
    'atmosphere_lighting'
  ] as const
};

// 기본 내보내기
export default CategoryPromptService;