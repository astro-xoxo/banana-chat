'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RelationshipInputProps {
  value: string
  onChange: (relationship: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

export default function RelationshipInput({ 
  value, 
  onChange, 
  error, 
  disabled = false,
  className = '' 
}: RelationshipInputProps) {
  const [localError, setLocalError] = useState('')
  const [isComposing, setIsComposing] = useState(false)  // 한글 조합 상태 추적

  const handleRelationshipChange = (inputValue: string) => {
    // 20자 초과 시 입력 제한 (한글 조합 중일 때는 허용)
    if (!isComposing && inputValue.length > 20) {
      setLocalError('20자 이하로 입력해주세요')
      return
    }

    // 한글 조합 중일 때는 검증을 건너뜀
    if (!isComposing && inputValue) {
      // 한글 자음, 모음, 완성형 한글, 영문, 숫자, 공백, 하이픈, 언더스코어 허용
      if (!/^[ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z0-9\s\-_]*$/.test(inputValue)) {
        setLocalError('한글, 영문, 숫자만 입력 가능합니다')
        return
      }
    }

    setLocalError('')
    onChange(inputValue)
  }

  // 한글 조합 시작 시
  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  // 한글 조합 완료 시
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false)
    handleRelationshipChange(e.currentTarget.value)
  }

  const displayError = error || localError
  const inputId = 'relationship-input'
  const errorId = 'relationship-error'
  const counterId = 'relationship-counter'

  // 글자 수에 따른 색상 변경
  const getCounterColor = () => {
    if (value.length >= 18) return 'text-error'
    if (value.length >= 15) return 'text-warning'
    return 'text-muted'
  }

  return (
    <div className={className}>
      <Label htmlFor={inputId} className="text-base font-medium text-foreground">
        나와의 관계 *
      </Label>
      
      <div className="space-y-1 mt-2">
        <Input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => handleRelationshipChange(e.target.value)}
          onCompositionStart={handleCompositionStart}  // 한글 조합 시작
          onCompositionEnd={handleCompositionEnd}  // 한글 조합 완료
          placeholder="예: 남자친구, 여자친구, 친한 친구, 선배 등"
          disabled={disabled}
          maxLength={20}
          inputMode="text"  // 한글 입력을 위한 inputMode 명시적 설정
          autoComplete="off"  // 자동완성 비활성화
          lang="ko"  // 한국어 언어 설정
          aria-label="나와의 관계 입력"
          aria-describedby={`${displayError ? errorId + ' ' : ''}${counterId}`}
          aria-invalid={!!displayError}
          className={`w-full min-h-input px-4 py-3 border border-border rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm text-foreground shadow-sm transition-all duration-200 ${displayError ? 'border-error focus:ring-error focus:border-error' : ''}`}
        />
        
        <div className="flex justify-between items-center text-xs">
          <p className="text-muted">
            최대 20자까지 입력 가능합니다
          </p>
          
          <span 
            id={counterId}
            className={`font-medium ${getCounterColor()}`}
            aria-label={`현재 ${value.length}자, 최대 20자`}
          >
            {value.length}/20
          </span>
        </div>
        
        {displayError && (
          <p 
            id={errorId}
            className="text-error text-sm"
            role="alert"
            aria-live="polite"
          >
            {displayError}
          </p>
        )}
      </div>

      {/* 추천 예시 */}
      <div className="space-y-2 mt-8">
        <p className="text-sm text-muted">추천 예시:</p>
        <div className="flex flex-wrap gap-2">
          {['남자친구', '여자친구', '친한 친구', '직장 선배', '소꿉친구'].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => handleRelationshipChange(example)}
              disabled={disabled}
              className="bg-surface hover:bg-primary hover:text-inverse border border-border hover:border-primary px-3 py-1 rounded-xl text-xs text-muted hover:text-inverse transition-all duration-200 shadow-sm hover:shadow-hover"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}