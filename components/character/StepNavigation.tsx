/**
 * Task 010: 캐릭터 생성 스텝 네비게이션 컴포넌트
 * 단계별 진행을 위한 이전/다음 버튼과 진행 상태 표시
 */

'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export interface StepNavigationProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  submitLabel?: string;
  showCancel?: boolean;
}

export default function StepNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onCancel,
  isSubmitting = false,
  canProceed = true,
  nextLabel = '다음',
  prevLabel = '이전',
  submitLabel = '캐릭터 생성',
  showCancel = true
}: StepNavigationProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex justify-between items-center pt-6 border-t border-gray-200">
      {/* 왼쪽: 이전/취소 버튼 */}
      <div>
        {isFirstStep ? (
          // 첫 단계에서는 취소 버튼 표시
          showCancel ? (
            <Button 
              variant="outline" 
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              취소
            </Button>
          ) : (
            <div /> // 취소 버튼이 없으면 빈 공간
          )
        ) : (
          // 이후 단계에서는 이전 버튼 표시
          <Button 
            variant="outline" 
            onClick={onPrev}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {prevLabel}
          </Button>
        )}
      </div>

      {/* 중간: 진행 상태 표시 */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="font-medium">{currentStep}</span>
        <span>/</span>
        <span>{totalSteps}</span>
      </div>

      {/* 오른쪽: 다음/완료 버튼 */}
      <div>
        {isLastStep ? (
          // 마지막 단계에서는 생성 완료 버튼
          <Button
            onClick={onNext}
            disabled={!canProceed || isSubmitting}
            className="flex items-center gap-2 min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        ) : (
          // 이전 단계에서는 다음 버튼
          <Button
            onClick={onNext}
            disabled={!canProceed || isSubmitting}
            className="flex items-center gap-2"
          >
            {nextLabel}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 단계 진행률 표시 컴포넌트
 */
export interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  steps?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
}

export function StepProgress({ 
  currentStep, 
  totalSteps, 
  steps 
}: StepProgressProps) {
  return (
    <div className="w-full">
      {/* 진행률 바 */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* 단계별 표시 (옵션) */}
      {steps && (
        <div className="flex justify-between text-xs text-muted">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`text-center ${
                index + 1 === currentStep 
                  ? 'text-blue-600 font-medium' 
                  : step.completed 
                    ? 'text-success' 
                    : 'text-muted'
              }`}
            >
              <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs ${
                index + 1 === currentStep 
                  ? 'bg-blue-600 text-white' 
                  : step.completed 
                    ? 'bg-success text-white' 
                    : 'bg-surface text-muted'
              }`}>
                {index + 1}
              </div>
              <span className="hidden sm:block">{step.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 컴팩트한 스텝 네비게이션 (모바일 최적화)
 */
export function CompactStepNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  isSubmitting = false,
  canProceed = true
}: Pick<StepNavigationProps, 'currentStep' | 'totalSteps' | 'onNext' | 'onPrev' | 'isSubmitting' | 'canProceed'>) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={isFirstStep || isSubmitting}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <span className="text-sm font-medium px-4">
        {currentStep} / {totalSteps}
      </span>

      <Button
        size="sm"
        onClick={onNext}
        disabled={!canProceed || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isLastStep ? (
          '완료'
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}