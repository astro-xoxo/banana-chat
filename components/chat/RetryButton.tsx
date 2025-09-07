'use client'

import React, { useState, useEffect } from 'react'
import { RefreshCw, Clock, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { logError, logInfo } from '@/lib/errorLogger'

interface RetryButtonProps {
  onRetry: () => Promise<void>
  disabled?: boolean
  maxRetries?: number
  currentRetries?: number
  retryDelay?: number // milliseconds between retries
  exponentialBackoff?: boolean
  label?: string
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'destructive' | 'ghost'
  className?: string
  showProgress?: boolean
  context?: {
    operation?: string
    chatbotId?: string
    sessionId?: string
  }
}

/**
 * 재시도 버튼 컴포넌트
 * 자동 재시도 로직과 진행 상황 표시 기능 포함
 */
export function RetryButton({
  onRetry,
  disabled = false,
  maxRetries = 3,
  currentRetries = 0,
  retryDelay = 1000,
  exponentialBackoff = true,
  label = '다시 시도',
  size = 'default',
  variant = 'outline',
  className,
  showProgress = true,
  context
}: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(currentRetries)
  const [waitTime, setWaitTime] = useState(0)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [retrySuccess, setRetrySuccess] = useState(false)

  const isMaxRetriesReached = retryCount >= maxRetries
  const remainingRetries = Math.max(0, maxRetries - retryCount)

  // 대기 시간 타이머
  useEffect(() => {
    if (waitTime > 0) {
      const timer = setInterval(() => {
        setWaitTime(prev => Math.max(0, prev - 100))
      }, 100)

      return () => clearInterval(timer)
    }
  }, [waitTime])

  // 성공 상태 자동 해제
  useEffect(() => {
    if (retrySuccess) {
      const timer = setTimeout(() => {
        setRetrySuccess(false)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [retrySuccess])

  /**
   * 재시도 실행
   */
  const handleRetry = async () => {
    if (isRetrying || disabled || isMaxRetriesReached || waitTime > 0) {
      return
    }

    const currentAttempt = retryCount + 1
    setIsRetrying(true)
    setLastError(null)

    // 재시도 시작 로깅
    logInfo('RETRY_BUTTON', `Retry attempt ${currentAttempt}/${maxRetries}`, {
      ...context,
      api_endpoint: 'retry_button'
    }, {
      attempt: currentAttempt,
      max_retries: maxRetries,
      exponential_backoff: exponentialBackoff,
      retry_delay: retryDelay
    })

    console.log(`재시도 시작 (${currentAttempt}/${maxRetries})`, {
      context,
      exponentialBackoff,
      retryDelay
    })

    try {
      await onRetry()
      
      // 재시도 성공
      setRetrySuccess(true)
      setRetryCount(0) // 성공 시 카운터 리셋
      
      logInfo('RETRY_BUTTON', `Retry successful on attempt ${currentAttempt}`, {
        ...context,
        api_endpoint: 'retry_button'
      }, {
        successful_attempt: currentAttempt,
        total_attempts: currentAttempt
      })

      console.log(`재시도 성공! (${currentAttempt}번째 시도)`)

    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error))
      setLastError(errorInstance)
      setRetryCount(currentAttempt)

      // 재시도 실패 로깅
      logError('RETRY_BUTTON', `Retry failed on attempt ${currentAttempt}`, errorInstance, {
        ...context,
        api_endpoint: 'retry_button'
      }, {
        failed_attempt: currentAttempt,
        max_retries: maxRetries,
        remaining_retries: maxRetries - currentAttempt,
        will_retry_again: currentAttempt < maxRetries
      })

      console.error(`재시도 실패 (${currentAttempt}/${maxRetries}):`, errorInstance.message)

      // 자동 재시도 대기 시간 설정 (지수 백오프)
      if (currentAttempt < maxRetries) {
        const nextDelay = exponentialBackoff 
          ? retryDelay * Math.pow(2, currentAttempt - 1)
          : retryDelay
        
        setWaitTime(nextDelay)
        
        console.log(`${nextDelay}ms 후 자동 재시도 가능`)
      } else {
        console.log('최대 재시도 횟수 도달')
      }
    } finally {
      setIsRetrying(false)
    }
  }

  /**
   * 재시도 상태 초기화
   */
  const handleReset = () => {
    setRetryCount(0)
    setLastError(null)
    setWaitTime(0)
    setRetrySuccess(false)
    
    logInfo('RETRY_BUTTON', 'Retry state reset', {
      ...context,
      api_endpoint: 'retry_button'
    })

    console.log('재시도 상태 초기화')
  }

  /**
   * 현재 상태에 따른 버튼 텍스트와 아이콘
   */
  const getButtonContent = () => {
    if (retrySuccess) {
      return {
        icon: CheckCircle,
        text: '성공!',
        iconColor: 'text-green-500'
      }
    }

    if (isRetrying) {
      return {
        icon: RefreshCw,
        text: `재시도 중... (${retryCount + 1}/${maxRetries})`,
        iconColor: 'text-blue-500',
        spin: true
      }
    }

    if (waitTime > 0) {
      const secondsLeft = Math.ceil(waitTime / 1000)
      return {
        icon: Clock,
        text: `${secondsLeft}초 후 재시도`,
        iconColor: 'text-orange-500'
      }
    }

    if (isMaxRetriesReached) {
      return {
        icon: X,
        text: '재시도 한도 초과',
        iconColor: 'text-red-500'
      }
    }

    return {
      icon: RefreshCw,
      text: retryCount > 0 ? `${label} (${remainingRetries}회 남음)` : label,
      iconColor: 'text-gray-500'
    }
  }

  const { icon: IconComponent, text, iconColor, spin } = getButtonContent()

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          onClick={handleRetry}
          disabled={disabled || isRetrying || isMaxRetriesReached || waitTime > 0 || retrySuccess}
          size={size}
          variant={retrySuccess ? 'default' : variant}
          className={cn(
            'transition-all duration-200',
            retrySuccess && 'bg-green-600 hover:bg-green-700',
            className
          )}
        >
          <IconComponent 
            className={cn(
              'w-4 h-4 mr-2', 
              iconColor,
              spin && 'animate-spin'
            )} 
          />
          {text}
        </Button>

        {/* 리셋 버튼 (최대 재시도 도달 시) */}
        {isMaxRetriesReached && !retrySuccess && (
          <Button
            onClick={handleReset}
            size="sm"
            variant="ghost"
            className="text-xs"
          >
            초기화
          </Button>
        )}
      </div>

      {/* 진행 상황 정보 */}
      {showProgress && (
        <div className="flex items-center gap-2 text-xs">
          {retryCount > 0 && (
            <Badge variant="outline" className="text-xs">
              시도: {retryCount}/{maxRetries}
            </Badge>
          )}
          
          {lastError && !retrySuccess && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />
              오류 발생
            </Badge>
          )}
          
          {waitTime > 0 && (
            <Badge variant="secondary" className="text-xs">
              대기 중...
            </Badge>
          )}
          
          {retrySuccess && (
            <Badge variant="default" className="text-xs bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              성공
            </Badge>
          )}
        </div>
      )}

      {/* 에러 메시지 (개발 환경에서만) */}
      {process.env.NODE_ENV === 'development' && lastError && !retrySuccess && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border">
          {lastError.message}
        </div>
      )}
    </div>
  )
}

/**
 * 간단한 재시도 버튼 (기본 설정)
 */
export function SimpleRetryButton({
  onRetry,
  disabled,
  label = "다시 시도"
}: {
  onRetry: () => Promise<void>
  disabled?: boolean
  label?: string
}) {
  return (
    <RetryButton
      onRetry={onRetry}
      disabled={disabled}
      label={label}
      maxRetries={1}
      showProgress={false}
      size="sm"
    />
  )
}

/**
 * 자동 재시도 버튼 (지수 백오프 포함)
 */
export function AutoRetryButton({
  onRetry,
  disabled,
  maxRetries = 3,
  context
}: {
  onRetry: () => Promise<void>
  disabled?: boolean
  maxRetries?: number
  context?: RetryButtonProps['context']
}) {
  return (
    <RetryButton
      onRetry={onRetry}
      disabled={disabled}
      maxRetries={maxRetries}
      exponentialBackoff={true}
      retryDelay={2000}
      showProgress={true}
      context={context}
      label="자동 재시도"
    />
  )
}

export default RetryButton
