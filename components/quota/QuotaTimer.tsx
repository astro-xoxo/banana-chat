// 실시간 충전 타이머 컴포넌트
// 24시간 자동 충전 시간 표시

import React from 'react'
import { useQuotaTimer } from '@/hooks/useQuotaTimer'

interface QuotaTimerProps {
  nextResetAt: Date | null
  isExhausted: boolean
  compact?: boolean
}

/**
 * 실시간 쿼터 타이머 컴포넌트
 * 
 * 기능:
 * - 24시간 충전 카운트다운
 * - 실시간 업데이트 (1분마다)
 * - 상태별 메시지 표시
 */
export const QuotaTimer: React.FC<QuotaTimerProps> = ({ 
  nextResetAt, 
  isExhausted,
  compact = false
}) => {
  const timerInfo = useQuotaTimer(nextResetAt)

  // 소진되지 않은 경우
  if (!isExhausted) {
    return (
      <p className="text-xs text-muted">
        사용 가능
      </p>
    )
  }

  // 타이머가 비활성인 경우 (무제한 소진 또는 시간 경과)
  if (!timerInfo.isActive) {
    return (
      <p className="text-xs text-muted">
        {timerInfo.formattedTime || '소진됨'}
      </p>
    )
  }

  // 활성 타이머 표시
  if (compact) {
    // 컴팩트 모드 - 간단한 표시
    return (
      <p className="text-xs text-orange-500 font-medium">
        {timerInfo.formattedTime} 후
      </p>
    )
  }

  // 상세 모드 - 자세한 정보
  return (
    <div className="text-xs">
      <p className="text-orange-500 font-medium">
        ⏰ {timerInfo.formattedTime} 후 충전
      </p>
      {timerInfo.hoursRemaining > 12 && (
        <p className="text-muted text-xs mt-1">
          24시간 자동 충전 시스템
        </p>
      )}
    </div>
  )
}
