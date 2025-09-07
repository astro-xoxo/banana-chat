'use client'

import React from 'react'
import { AlertTriangle, Info } from 'lucide-react'

// Mock 모드 표시 컴포넌트
export function MockModeIndicator() {
  // 환경 변수에서 Mock 모드 상태 확인
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  // Mock 모드가 아니면 렌더링하지 않음
  if (!isMockMode) {
    return null
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm">
              개발 모드 (Mock)
            </div>
            <div className="text-xs opacity-80">
              샘플 이미지를 사용합니다
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 인라인 Mock 모드 표시 컴포넌트 (카드나 폼 내부용)
export function InlineMockIndicator({ 
  className = "" 
}: { 
  className?: string 
}) {
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  if (!isMockMode) {
    return null
  }
  
  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 text-yellow-800">
        <Info className="w-4 h-4 flex-shrink-0" />
        <div className="text-sm">
          <span className="font-medium">개발 모드:</span>
          <span className="ml-1">샘플 이미지를 사용합니다</span>
        </div>
      </div>
    </div>
  )
}

// Mock 이미지 표시 컴포넌트
export function MockImageBadge({ 
  className = "" 
}: { 
  className?: string 
}) {
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  if (!isMockMode) {
    return null
  }
  
  return (
    <div className={`absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full ${className}`}>
      MOCK
    </div>
  )
}

// 페이지 레벨 Mock 모드 안내 컴포넌트
export function PageMockNotice({ 
  message = "현재 개발 모드에서 샘플 데이터를 사용하고 있습니다",
  className = "" 
}: { 
  message?: string
  className?: string 
}) {
  const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
  
  if (!isMockMode) {
    return null
  }
  
  return (
    <div className={`mb-6 ${className}`}>
      <div className="bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-300 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-yellow-800 font-semibold text-sm mb-1">
              개발 모드 안내
            </div>
            <div className="text-yellow-700 text-sm">
              {message}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MockModeIndicator
