// 쿼터 새로고침 버튼 컴포넌트
// 대시보드 제목과 함께 사용되는 독립적인 버튼

'use client'

import React from 'react'
import { useQuota } from '@/hooks/useQuota'

/**
 * 쿼터 새로고침 버튼 컴포넌트
 * 
 * 기능:
 * - 쿼터 데이터 수동 새로고침
 * - 로딩 상태 표시
 * - 에러 처리
 */
export const QuotaRefreshButton: React.FC = () => {
  const { loading, refreshQuotas } = useQuota()

  return (
    <button
      onClick={refreshQuotas}
      disabled={loading}
      className={`
        px-3 py-1 rounded-2xl text-sm transition-all duration-200 border
        ${loading 
          ? 'bg-interactive-hover text-muted cursor-not-allowed border-border' 
          : 'bg-interactive-hover hover:bg-interactive-active text-foreground hover:text-foreground border-border hover:border-foreground'
        }
        flex items-center space-x-1 shadow-sm hover:shadow-hover
      `}
    >
      <span className={loading ? 'animate-spin' : ''}>
        {loading ? '⏳' : '🔄'}
      </span>
      <span>{loading ? '새로고침 중...' : '새로고침'}</span>
    </button>
  )
}
