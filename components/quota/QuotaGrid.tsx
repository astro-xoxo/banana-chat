// 쿼터 그리드 레이아웃 컴포넌트
// 모든 쿼터 카드를 통합 관리

import React from 'react'
import { QuotaType } from '@/types/quota'
import { QuotaCard } from './QuotaCard'
import { useQuota } from '@/hooks/useQuota'

interface QuotaConfig {
  type: QuotaType
  icon: string
  title: string
  description: string
  color: {
    primary: string
    background: string
  }
}

// 쿼터 설정 정보 (모두 24시간 충전으로 통일)
const quotaConfigs: QuotaConfig[] = [
  {
    type: 'profile_image_generation',
    icon: '🎭',
    title: '프로필 이미지',
    description: '소진 후 24시간 충전',
    color: {
      primary: 'purple-500',
      background: 'purple-100'
    }
  },
  {
    type: 'chat_messages',
    icon: '💬',
    title: '채팅 메시지',
    description: '소진 후 24시간 충전',
    color: {
      primary: 'blue-500',
      background: 'blue-100'
    }
  },
  {
    type: 'chat_image_generation',
    icon: '🖼️',
    title: '채팅 이미지',
    description: '소진 후 24시간 충전',
    color: {
      primary: 'indigo-500',
      background: 'indigo-100'
    }
  }
]

interface QuotaGridProps {
  compact?: boolean
  showRefreshButton?: boolean
}

/**
 * 쿼터 그리드 컴포넌트
 * 
 * 기능:
 * - 모든 쿼터 카드 통합 표시
 * - 로딩 및 에러 상태 처리
 * - 실시간 API 연동
 * - 반응형 그리드 레이아웃
 */
export const QuotaGrid: React.FC<QuotaGridProps> = ({ 
  compact = false,
  showRefreshButton = false
}) => {
  const { quotas, loading, error, refreshQuotas } = useQuota()

  // 로딩 상태
  if (loading) {
    return (
      <div className={`grid ${compact ? 'md:grid-cols-3 gap-4' : 'md:grid-cols-3 gap-6'}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div 
            key={index}
            className={`
              bg-white rounded-xl shadow-sm border border-gray-200 animate-pulse
              ${compact ? 'p-4' : 'p-6'}
            `}
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-gray-200 rounded-lg`}></div>
              <div>
                <div className={`h-4 bg-gray-200 rounded ${compact ? 'w-20' : 'w-24'} mb-2`}></div>
                <div className={`h-3 bg-gray-200 rounded ${compact ? 'w-24' : 'w-32'}`}></div>
              </div>
            </div>
            <div className="h-2 bg-gray-200 rounded-full mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-red-700">
            <span>⚠️</span>
            <span className="font-medium">쿼터 정보를 불러올 수 없습니다</span>
          </div>
          {showRefreshButton && (
            <button
              onClick={refreshQuotas}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm transition-colors"
            >
              다시 시도
            </button>
          )}
        </div>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    )
  }

  // 정상 상태 - 쿼터 카드 표시
  return (
    <div>
      {/* 쿼터 카드 그리드 */}
      <div className={`grid ${compact ? 'md:grid-cols-3 gap-4' : 'md:grid-cols-3 gap-6'}`}>
        {quotaConfigs.map(config => {
          const quota = quotas.find(q => q.type === config.type)
          
          return quota ? (
            <QuotaCard
              key={config.type}
              quota={quota}
              icon={config.icon}
              title={config.title}
              description={config.description}
              color={config.color}
              compact={compact}
            />
          ) : (
            // 데이터가 없는 경우 플레이스홀더
            <div 
              key={config.type}
              className={`
                bg-gray-100 rounded-xl shadow-sm border border-gray-200
                ${compact ? 'p-4' : 'p-6'}
              `}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} bg-gray-200 rounded-lg flex items-center justify-center`}>
                  <span className={compact ? 'text-lg' : 'text-xl'}>{config.icon}</span>
                </div>
                <div>
                  <h3 className={`font-semibold text-gray-500 ${compact ? 'text-sm' : 'text-base'}`}>
                    {config.title}
                  </h3>
                  <p className="text-gray-400 text-xs">데이터 로딩 중...</p>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full mb-3"></div>
              <p className="text-gray-400 text-sm">데이터 없음</p>
            </div>
          )
        })}
      </div>

      {/* 안내 정보 */}
      {!compact && quotas.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center space-x-2 text-yellow-800 mb-2">
            <span>💡</span>
            <span className="font-medium text-sm">이용 안내</span>
          </div>
          <p className="text-yellow-700 text-sm">
            모든 쿼터는 소진 후 24시간 뒤 자동으로 충전됩니다. 
            개별 사용자별로 독립적인 타이머가 적용됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
