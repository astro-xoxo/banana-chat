// 쿼터 진행률 표시 컴포넌트
// Tailwind CSS 기반 애니메이션 진행률 바

import React from 'react'

interface QuotaProgressProps {
  percentage: number
  isExhausted: boolean
  colorClass?: string
  height?: 'sm' | 'md' | 'lg'
  animated?: boolean
}

/**
 * 쿼터 진행률 바 컴포넌트
 * 
 * 기능:
 * - 부드러운 애니메이션 효과
 * - 소진 상태에 따른 색상 변경
 * - 다양한 높이 옵션
 */
export const QuotaProgress: React.FC<QuotaProgressProps> = ({ 
  percentage, 
  isExhausted, 
  colorClass = 'blue-500',
  height = 'sm',
  animated = true
}) => {
  const heightClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  // 소진 상태에 따른 색상 결정
  const progressColor = isExhausted 
    ? 'bg-red-500' 
    : `bg-${colorClass}`

  // 퍼센티지 제한 (0-100)
  const normalizedPercentage = Math.min(Math.max(percentage, 0), 100)

  return (
    <div className="w-full bg-surface rounded-full overflow-hidden">
      <div 
        className={`
          ${heightClasses[height]} 
          ${progressColor} 
          rounded-full 
          ${animated ? 'transition-all duration-500 ease-out' : ''}
          relative
        `}
        style={{ 
          width: `${normalizedPercentage}%`
        }}
      >
        {/* 소진 상태일 때 추가 효과 */}
        {isExhausted && (
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-600 rounded-full"></div>
        )}
        
        {/* 진행 중일 때 그라데이션 효과 */}
        {!isExhausted && normalizedPercentage > 0 && normalizedPercentage < 100 && (
          <div className={`absolute inset-0 bg-gradient-to-r from-${colorClass} to-${colorClass}/80 rounded-full`}></div>
        )}
      </div>
    </div>
  )
}
