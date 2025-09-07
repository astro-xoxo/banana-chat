/**
 * ImageGenerationStatus 컴포넌트들
 * Task 006: Create Message Image Generation UI Components
 * 
 * 이미지 생성 과정에서 사용되는 상태 표시 컴포넌트들
 */

'use client';

import React from 'react';
import { Loader2, AlertCircle, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  progress?: number;
  message?: string;
  className?: string;
}

/**
 * 이미지 생성 로딩 인디케이터
 */
export const ImageGenerationLoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  progress = 0,
  message = '이미지 생성 중...',
  className = ''
}) => {
  return (
    <div className={cn('image-generation-loading space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg', className)}>
      
      {/* 로딩 헤더 */}
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <div className="flex-1">
          <div className="text-sm font-medium text-blue-900">{message}</div>
          <div className="text-xs text-blue-600 mt-1">
            AI가 메시지 내용을 분석하여 최적의 이미지를 생성하고 있습니다
          </div>
        </div>
        {progress > 0 && (
          <div className="text-sm font-medium text-blue-700">
            {Math.round(progress)}%
          </div>
        )}
      </div>

      {/* 진행률 바 */}
      {progress > 0 && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-blue-600 text-center">
            {progress < 30 && '메시지 분석 중...'}
            {progress >= 30 && progress < 60 && '키워드 추출 중...'}
            {progress >= 60 && progress < 85 && '프롬프트 최적화 중...'}
            {progress >= 85 && '이미지 생성 중...'}
          </div>
        </div>
      )}

      {/* 예상 시간 */}
      <div className="flex items-center gap-2 text-xs text-blue-500">
        <Clock className="w-3 h-3" />
        <span>예상 소요 시간: 30-60초</span>
      </div>
    </div>
  );
};

interface ErrorMessageProps {
  error: string;
  onRetry?: () => void;
  className?: string;
  showRetry?: boolean;
}

/**
 * 이미지 생성 오류 메시지
 */
export const ImageGenerationErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  className = '',
  showRetry = true
}) => {
  return (
    <div className={cn('image-generation-error p-4 bg-red-50 border border-red-200 rounded-lg', className)}>
      
      {/* 오류 헤더 */}
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-red-900 mb-1">
            이미지 생성 실패
          </div>
          <div className="text-sm text-red-700">
            {error}
          </div>
        </div>
      </div>

      {/* 재시도 버튼 */}
      {showRetry && onRetry && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            다시 시도
          </Button>
        </div>
      )}

      {/* 도움말 */}
      <div className="mt-3 text-xs text-red-600 bg-red-100 p-2 rounded">
        💡 <strong>문제 해결 팁:</strong>
        <ul className="mt-1 ml-4 list-disc space-y-1">
          <li>메시지가 이미지 생성에 적합한 내용인지 확인해보세요</li>
          <li>일일 생성 할당량을 초과하지 않았는지 확인해보세요</li>
          <li>잠시 후 다시 시도해보세요</li>
        </ul>
      </div>
    </div>
  );
};

interface SuccessMessageProps {
  imageUrl: string;
  processingTime?: number;
  qualityScore?: number;
  className?: string;
}

/**
 * 이미지 생성 성공 메시지
 */
export const ImageGenerationSuccessMessage: React.FC<SuccessMessageProps> = ({
  imageUrl,
  processingTime,
  qualityScore,
  className = ''
}) => {
  return (
    <div className={cn('image-generation-success p-4 bg-green-50 border border-green-200 rounded-lg', className)}>
      
      {/* 성공 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <div className="flex-1">
          <div className="text-sm font-medium text-green-900">
            이미지 생성 완료!
          </div>
          <div className="text-xs text-green-600 mt-1">
            고품질 이미지가 성공적으로 생성되었습니다
          </div>
        </div>
      </div>

      {/* 생성된 이미지 */}
      <div className="mb-3">
        <img
          src={imageUrl}
          alt="생성된 이미지"
          className="max-w-full h-auto rounded-lg shadow-sm border border-green-200"
          loading="lazy"
        />
      </div>

      {/* 메타데이터 */}
      <div className="flex items-center justify-between text-xs text-green-600">
        <div className="flex items-center gap-4">
          {processingTime && (
            <span>처리 시간: {Math.round(processingTime / 1000)}초</span>
          )}
          {qualityScore && (
            <span>품질 점수: {qualityScore.toFixed(2)}</span>
          )}
        </div>
        <div className="text-green-500">
          ✨ AI 생성 이미지
        </div>
      </div>
    </div>
  );
};

interface QuotaDisplayProps {
  currentCount: number;
  dailyLimit: number;
  className?: string;
}

/**
 * 할당량 표시 컴포넌트
 */
export const ImageGenerationQuotaDisplay: React.FC<QuotaDisplayProps> = ({
  currentCount,
  dailyLimit,
  className = ''
}) => {
  const remaining = dailyLimit - currentCount;
  const percentage = (currentCount / dailyLimit) * 100;
  
  const getStatusColor = () => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className={cn('quota-display p-3 bg-gray-50 border border-gray-200 rounded-lg', className)}>
      
      {/* 할당량 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-700">
          일일 이미지 생성 할당량
        </div>
        <div className={cn('text-sm font-medium', getStatusColor())}>
          {remaining}회 남음
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', getProgressColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 상세 정보 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{currentCount}/{dailyLimit} 사용됨</span>
        <span>매일 자정 초기화</span>
      </div>

      {/* 경고 메시지 */}
      {remaining <= 2 && (
        <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
          ⚠️ 일일 할당량이 거의 소진되었습니다. 신중하게 사용해주세요.
        </div>
      )}
    </div>
  );
};

// 모든 컴포넌트와 타입 내보내기
export type {
  LoadingIndicatorProps,
  ErrorMessageProps,
  SuccessMessageProps,
  QuotaDisplayProps
};
