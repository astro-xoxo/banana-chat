/**
 * ImageSkeleton 컴포넌트
 * Task 007: Implement Image Display and Management UI
 * 
 * 이미지 로딩 중 표시되는 스켈레톤 UI
 */

'use client';

import React from 'react';

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
  showPulse?: boolean;
}

export function ImageSkeleton({ 
  className = "", 
  aspectRatio = 'landscape',
  showPulse = true 
}: ImageSkeletonProps) {
  const aspectRatioClasses = {
    square: 'aspect-square',
    landscape: 'aspect-video', // 16:9
    portrait: 'aspect-[3/4]',
    auto: ''
  };

  return (
    <div 
      className={`
        bg-gray-200 rounded-lg overflow-hidden
        ${aspectRatioClasses[aspectRatio]}
        ${showPulse ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
        {/* 이미지 아이콘 스켈레톤 */}
        <div className="w-16 h-16 bg-gray-300 rounded-lg opacity-50">
          <svg 
            className="w-full h-full p-4 text-gray-400" 
            fill="currentColor" 
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path 
              fillRule="evenodd" 
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      </div>
      
      {/* 하단 액션 버튼 스켈레톤 */}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-black/20 backdrop-blur-sm rounded-lg p-1">
        <div className="w-8 h-8 bg-white/20 rounded animate-pulse"></div>
        <div className="w-8 h-8 bg-white/20 rounded animate-pulse"></div>
        <div className="w-8 h-8 bg-white/20 rounded animate-pulse"></div>
      </div>
    </div>
  );
}

/**
 * 프리로더가 있는 이미지 스켈레톤
 */
interface LoadingImageSkeletonProps extends ImageSkeletonProps {
  progress?: number; // 0-100
  showProgress?: boolean;
  loadingText?: string;
}

export function LoadingImageSkeleton({ 
  progress = 0,
  showProgress = true,
  loadingText = "이미지 생성 중...",
  ...skeletonProps 
}: LoadingImageSkeletonProps) {
  return (
    <div className="relative">
      <ImageSkeleton {...skeletonProps} />
      
      {/* 로딩 오버레이 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
        <div className="flex flex-col items-center gap-3">
          {/* 스피너 */}
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          
          {/* 로딩 텍스트 */}
          <span className="text-sm font-medium">{loadingText}</span>
          
          {/* 진행률 바 */}
          {showProgress && progress > 0 && (
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          )}
          
          {/* 진행률 텍스트 */}
          {showProgress && progress > 0 && (
            <span className="text-xs text-white/80">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 다중 이미지 스켈레톤 그리드
 */
interface MultiImageSkeletonProps {
  count: number;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function MultiImageSkeleton({ 
  count, 
  className = "", 
  columns = 2 
}: MultiImageSkeletonProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4'
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-4 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <ImageSkeleton 
          key={index}
          aspectRatio="square"
          className="w-full"
        />
      ))}
    </div>
  );
}

export default ImageSkeleton;
