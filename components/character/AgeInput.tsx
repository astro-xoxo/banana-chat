'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AgeInputProps {
  value: number
  onChange: (age: number) => void
  error?: string
  disabled?: boolean
  className?: string
}

export default function AgeInput({ 
  value, 
  onChange, 
  error, 
  disabled = false,
  className = '' 
}: AgeInputProps) {
  const [localError, setLocalError] = useState('')

  const handleAgeChange = (inputValue: string) => {
    // 빈 문자열인 경우
    if (inputValue === '') {
      setLocalError('')
      onChange(0)
      return
    }

    // 숫자가 아닌 문자가 포함된 경우
    if (!/^\d+$/.test(inputValue)) {
      setLocalError('숫자만 입력 가능합니다')
      return
    }

    const age = parseInt(inputValue, 10)

    // 범위 검증
    if (age < 10) {
      setLocalError('10세 이상 입력해주세요')
    } else if (age > 100) {
      setLocalError('100세 이하 입력해주세요')
    } else {
      setLocalError('')
    }

    onChange(age)
  }

  const displayError = error || localError
  const inputId = 'age-input'
  const errorId = 'age-error'

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={inputId} className="text-base font-medium text-foreground">
        나이 *
      </Label>
      
      <div className="space-y-1">
        <Input
          id={inputId}
          type="number"
          value={value === 0 ? '' : value}  // 0일 때 빈 문자열로 표시
          onChange={(e) => handleAgeChange(e.target.value)}
          placeholder="나이를 입력하세요"
          disabled={disabled}
          min="10"
          max="100"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="나이 입력"
          aria-describedby={displayError ? errorId : undefined}
          aria-invalid={!!displayError}
          className={`w-full min-h-input px-4 py-3 border border-border rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm text-foreground shadow-sm transition-all duration-200 ${displayError ? 'border-error focus:ring-error focus:border-error' : ''}`}
        />
        
        <p className="text-xs text-muted">
          10-100 사이의 숫자를 입력해주세요
        </p>
        
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
    </div>
  )
}