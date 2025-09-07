// AI Face Chat Lite - 쿼터 시스템 타입 정의
// 마이그레이션된 데이터베이스 스키마 반영

/**
 * 쿼터 타입 열거형 (마이그레이션 후 3개 타입)
 * - profile_image_generation: 소진 후 24시간 자동 충전 (1개 한도)
 * - chat_messages: 소진 후 24시간 자동 충전 (50개 한도)
 * - chat_image_generation: 소진 후 24시간 자동 충전 (5개 한도)
 */
export enum QuotaType {
  PROFILE_IMAGE_GENERATION = 'profile_image_generation',
  CHAT_MESSAGES = 'chat_messages',
  CHAT_IMAGE_GENERATION = 'chat_image_generation'
}

/**
 * 데이터베이스 쿼터 정보 모델 (마이그레이션 후 스키마)
 * user_quotas 테이블과 정확히 일치
 */
export interface QuotaInfo {
  id: string
  user_id: string
  quota_type: QuotaType
  used_count: number
  limit_count: number
  last_reset_at: Date | null      // 마지막 리셋 시점 (신규 추가)
  next_reset_at: Date | null      // 다음 충전 가능 시점 (신규 추가)
  created_at: Date
  updated_at: Date
}

/**
 * 프론트엔드 표시용 쿼터 모델
 * API 응답에서 사용되는 UI 친화적 형태
 */
export interface QuotaDisplay {
  type: QuotaType
  used: number
  limit: number
  canUse: boolean                 // 현재 사용 가능 여부
  nextResetAt: Date | null        // 다음 충전 시점
  resetInHours: number | null     // 충전까지 남은 시간 (시)
  percentage: number              // 사용률 (0-100)
}

/**
 * 쿼터 설정 정보
 * 각 쿼터 타입별 기본 설정값
 */
export interface QuotaConfig {
  type: QuotaType
  defaultLimit: number
  resetStrategy: 'none' | '24hours'
  description: string
}

/**
 * 쿼터 소진 결과
 * API에서 쿼터 소진 시도 결과 반환
 */
export interface QuotaConsumeResult {
  success: boolean
  quota: QuotaDisplay
  message?: string
  remaining?: number  // 남은 할당량
}

/**
 * 쿼터 검증 결과
 * 내부 로직에서 검증 결과 표현
 */
export interface QuotaValidationResult {
  canConsume: boolean
  reason?: string
  resetAvailableAt?: Date
}

/**
 * 쿼터 리셋 정보
 * 자동 리셋 로직에서 사용
 */
export interface QuotaResetInfo {
  shouldReset: boolean
  newUsedCount: number
  newLastResetAt: Date | null
  newNextResetAt: Date | null
}

/**
 * API 요청/응답 타입들
 */

// GET /api/quota 응답
export interface GetQuotasResponse {
  quotas: QuotaDisplay[]
}

// POST /api/quota/consume 요청
export interface ConsumeQuotaRequest {
  quotaType: QuotaType
}

// POST /api/quota/consume 응답 (성공)
export interface ConsumeQuotaResponse {
  success: true
  quota: QuotaDisplay
}

// POST /api/quota/consume 응답 (실패)
export interface ConsumeQuotaErrorResponse {
  success: false
  error: string
  quota: QuotaDisplay
  message?: string
}

/**
 * 에러 타입 정의
 */
export class QuotaError extends Error {
  constructor(
    message: string,
    public code: 'QUOTA_EXCEEDED' | 'INVALID_TYPE' | 'USER_NOT_FOUND' | 'DB_ERROR',
    public quota?: QuotaDisplay
  ) {
    super(message)
    this.name = 'QuotaError'
  }
}

/**
 * 상수 정의
 */
export const QUOTA_CONFIGS: Record<QuotaType, QuotaConfig> = {
  [QuotaType.PROFILE_IMAGE_GENERATION]: {
    type: QuotaType.PROFILE_IMAGE_GENERATION,
    defaultLimit: 1,
    resetStrategy: '24hours',
    description: '소진 후 24시간 충전'
  },
  [QuotaType.CHAT_MESSAGES]: {
    type: QuotaType.CHAT_MESSAGES,
    defaultLimit: 50,
    resetStrategy: '24hours',
    description: '소진 후 24시간 충전'
  },
  [QuotaType.CHAT_IMAGE_GENERATION]: {
    type: QuotaType.CHAT_IMAGE_GENERATION,
    defaultLimit: 5,
    resetStrategy: '24hours',
    description: '소진 후 24시간 충전'
  }
} as const

/**
 * 유틸리티 타입
 */
export type QuotaTypeArray = [QuotaType, ...QuotaType[]]
export type QuotaConfigKey = keyof typeof QUOTA_CONFIGS

/**
 * 타입 가드 함수들
 */
export function isValidQuotaType(value: string): value is QuotaType {
  return Object.values(QuotaType).includes(value as QuotaType)
}

export function isQuotaInfo(obj: any): obj is QuotaInfo {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.user_id === 'string' &&
    isValidQuotaType(obj.quota_type) &&
    typeof obj.used_count === 'number' &&
    typeof obj.limit_count === 'number' &&
    (obj.last_reset_at === null || obj.last_reset_at instanceof Date) &&
    (obj.next_reset_at === null || obj.next_reset_at instanceof Date) &&
    obj.created_at instanceof Date &&
    obj.updated_at instanceof Date
  )
}
