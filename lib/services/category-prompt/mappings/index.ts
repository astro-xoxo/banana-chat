/**
 * 카테고리별 매핑 통합 익스포트
 */

import { LOCATION_MAPPINGS, type LocationKeyword } from './LocationMappings';
import { OUTFIT_MAPPINGS, type OutfitKeyword } from './OutfitMappings';
import { ACTION_MAPPINGS, type ActionKeyword } from './ActionMappings';
import { EXPRESSION_MAPPINGS, type ExpressionKeyword } from './ExpressionMappings';
import { ATMOSPHERE_MAPPINGS, type AtmosphereKeyword } from './AtmosphereMappings';

export { LOCATION_MAPPINGS, type LocationKeyword } from './LocationMappings';
export { OUTFIT_MAPPINGS, type OutfitKeyword } from './OutfitMappings';
export { ACTION_MAPPINGS, type ActionKeyword } from './ActionMappings';
export { EXPRESSION_MAPPINGS, type ExpressionKeyword } from './ExpressionMappings';
export { ATMOSPHERE_MAPPINGS, type AtmosphereKeyword } from './AtmosphereMappings';

// 모든 매핑을 하나의 객체로 통합
export const ALL_MAPPINGS = {
  location_environment: LOCATION_MAPPINGS,
  outfit_style: OUTFIT_MAPPINGS,
  action_pose: ACTION_MAPPINGS,
  expression_emotion: EXPRESSION_MAPPINGS,
  atmosphere_lighting: ATMOSPHERE_MAPPINGS
} as const;

// 모든 키워드 타입 통합
export type MappingKeyword = 
  | LocationKeyword 
  | OutfitKeyword 
  | ActionKeyword 
  | ExpressionKeyword 
  | AtmosphereKeyword;