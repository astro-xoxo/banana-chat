// 쿼터 리셋 전략 추상 클래스
// Strategy Pattern의 추상화 계층

import { QuotaInfo } from '@/types/quota'

/**
 * 리셋 실행 결과 인터페이스
 */
export interface ResetExecutionResult {
  shouldReset: boolean
  newUsedCount: number
  newLastResetAt: Date | null
  newNextResetAt: Date | null
}

/**
 * 쿼터 리셋 전략 인터페이스
 * Strategy Pattern: 다양한 리셋 정책을 유연하게 구현 가능
 */
export abstract class QuotaResetStrategy {
  /**
   * 쿼터 리셋이 필요한지 확인
   * @param quota 확인할 쿼터 정보
   * @returns 리셋 필요 여부
   */
  abstract shouldReset(quota: QuotaInfo): boolean

  /**
   * 쿼터를 리셋
   * @param quota 리셋할 쿼터 정보
   * @returns 리셋된 쿼터 정보
   */
  abstract reset(quota: QuotaInfo): QuotaInfo

  /**
   * 리셋 실행 (통합 메서드)
   * @param quota 확인할 쿼터 정보
   * @returns 리셋 실행 결과
   */
  abstract executeReset(quota: QuotaInfo): ResetExecutionResult

  /**
   * 쿼터 소진 시 다음 리셋 시간 반환
   * @param quota 소진된 쿼터 정보
   * @returns 다음 리셋 시간
   */
  abstract getResetTimeOnExhaustion(quota: QuotaInfo): Date | null

  /**
   * 전략 이름 반환
   * @returns 전략 이름
   */
  abstract getStrategyName(): string
}
