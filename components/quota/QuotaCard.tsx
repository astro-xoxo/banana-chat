// 개별 쿼터 카드 컴포넌트
// 쿼터 정보 시각적 표시

import React from 'react'
import { QuotaDisplay } from '@/types/quota'
import { QuotaProgress } from './QuotaProgress'
import { QuotaTimer } from './QuotaTimer'

interface QuotaCardProps {
  quota: QuotaDisplay
  icon: string
  title: string
  description: string
  color?: {
    primary: string
    background: string
  }
  compact?: boolean
}

/**
 * 쿼터 카드 컴포넌트
 * 
 * 기능:
 * - 쿼터 상태 시각적 표시
 * - 진행률 바 및 타이머 통합
 * - 상태별 색상 및 메시지
 * - 반응형 디자인
 */
export const QuotaCard: React.FC<QuotaCardProps> = ({ 
  quota, 
  icon, 
  title, 
  description,
  color = { primary: 'blue-500', background: 'blue-100' },
  compact = false
}) => {
  const isExhausted = quota.used >= quota.limit
  const canReset = quota.nextResetAt && isExhausted

  return (
    <div className={`
      bg-surface rounded-2xl shadow-sm border border-border
      ${compact ? 'p-4' : 'p-6'}
    `}>
      {/* 헤더 */}
      <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
        <div className="flex items-center space-x-3">
          <div className={`
            ${compact ? 'w-8 h-8' : 'w-10 h-10'} 
            bg-interactive-hover rounded-2xl border border-border
            flex items-center justify-center
          `}>
            <span className={compact ? 'text-base' : 'text-lg'}>{icon}</span>
          </div>
          <div>
            <h3 className={`font-medium text-foreground ${compact ? 'text-sm' : 'text-sm'}`}>
              {title}
            </h3>
            <p className={`text-muted ${compact ? 'text-xs' : 'text-xs'}`}>
              {description}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={`font-semibold text-foreground ${compact ? 'text-sm' : 'text-sm'}`}>
            {quota.used}/{quota.limit}
          </p>
          <QuotaTimer 
            nextResetAt={quota.nextResetAt}
            isExhausted={isExhausted}
            compact={compact}
          />
        </div>
      </div>

      {/* 진행률 바 */}
      <QuotaProgress 
        percentage={quota.percentage}
        isExhausted={isExhausted}
        colorClass={color.primary}
        height={compact ? 'sm' : 'md'}
      />

      {/* 상태 메시지 */}
      <div className={compact ? 'mt-2' : 'mt-3'}>
        {isExhausted ? (
          canReset ? (
            <p className="text-xs text-warning flex items-center">
              <span className="mr-1">⏰</span>
              {quota.resetInHours}시간 후 자동 충전
            </p>
          ) : (
            <p className="text-xs text-error flex items-center">
              <span className="mr-1">🚫</span>
              소진됨
            </p>
          )
        ) : (
          <p className="text-xs text-success flex items-center">
            <span className="mr-1">✅</span>
            {quota.limit - quota.used}회 남음
          </p>
        )}
      </div>

      {/* 추가 정보 (컴팩트 모드가 아닐 때만) */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between items-center text-xs text-muted">
            <span>사용률</span>
            <span>{quota.percentage.toFixed(0)}%</span>
          </div>
          {quota.nextResetAt && (
            <div className="flex justify-between items-center text-xs text-muted mt-1">
              <span>충전 방식</span>
              <span>24시간 자동</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
