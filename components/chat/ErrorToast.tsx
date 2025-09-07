'use client'

import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Wifi, Clock, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface ToastError {
  id: string
  type: 'claude_api' | 'network' | 'timeout' | 'quota' | 'database' | 'unknown'
  message: string
  details?: string
  retryable?: boolean
  retryAfter?: number // seconds
  context?: {
    chatbotName?: string
    relationshipType?: string
    operation?: string
    errorCode?: string
  }
}

interface ErrorToastProps {
  error: ToastError
  onRetry?: () => Promise<void>
  onDismiss: () => void
  autoHide?: boolean
  autoHideDelay?: number // milliseconds
}

/**
 * 개별 에러 토스트 컴포넌트
 * 에러 타입별로 다른 스타일과 메시지를 표시
 */
export function ErrorToast({ 
  error, 
  onRetry, 
  onDismiss, 
  autoHide = true, 
  autoHideDelay = 5000 
}: ErrorToastProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  // Rate Limit 재시도 타이머
  useEffect(() => {
    if (error.retryAfter && error.retryAfter > 0) {
      setTimeLeft(error.retryAfter)
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(timer)
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [error.retryAfter])

  // 자동 숨김 타이머
  useEffect(() => {
    if (autoHide && !error.retryable) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, autoHideDelay)

      return () => clearTimeout(timer)
    }
  }, [autoHide, autoHideDelay, error.retryable])

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return

    setIsRetrying(true)
    try {
      await onRetry()
      // 재시도 성공하면 토스트 자동 닫기
      setTimeout(() => handleDismiss(), 1000)
    } catch (retryError) {
      console.error('재시도 실패:', retryError)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss(), 300) // 애니메이션 완료 후 제거
  }

  /**
   * 에러 타입별 스타일 및 아이콘 반환
   */
  const getErrorStyle = () => {
    switch (error.type) {
      case 'claude_api':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-warning/5 border-warning/20',
          iconColor: 'text-warning',
          titleColor: 'text-foreground'
        }
      
      case 'network':
        return {
          icon: Wifi,
          bgColor: 'bg-error/5 border-error/20',
          iconColor: 'text-error',
          titleColor: 'text-foreground'
        }
      
      case 'timeout':
        return {
          icon: Clock,
          bgColor: 'bg-warning/5 border-warning/20',
          iconColor: 'text-warning',
          titleColor: 'text-foreground'
        }
      
      case 'quota':
        return {
          icon: AlertCircle,
          bgColor: 'bg-primary/5 border-primary/20',
          iconColor: 'text-primary',
          titleColor: 'text-foreground'
        }
      
      case 'database':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-surface border-border',
          iconColor: 'text-muted',
          titleColor: 'text-foreground'
        }
      
      default:
        return {
          icon: Info,
          bgColor: 'bg-info/5 border-info/20',
          iconColor: 'text-info',
          titleColor: 'text-foreground'
        }
    }
  }

  /**
   * 캐릭터별 맞춤 에러 메시지
   */
  const getCharacterSpecificMessage = (): string => {
    const { chatbotName, relationshipType } = error.context || {}
    const name = chatbotName || '친구'

    // 기본 메시지 사용 (이미 백엔드에서 캐릭터화됨)
    if (error.message.includes('잠깐만요') || error.message.includes('미안해') || error.message.includes('죄송')) {
      return error.message
    }

    // 타입별 기본 메시지에 캐릭터 성격 추가
    switch (error.type) {
      case 'network':
        switch (relationshipType?.toLowerCase()) {
          case 'family':
            return `${name}와의 연결이 끊어졌어요. 인터넷을 확인해주세요 🏠`
          case 'friend':
            return `어? 친구야, 인터넷이 안 되는 것 같아! 확인해볼래? 📶`
          case 'lover':
            return `사랑하는 당신과의 연결이... 💔 인터넷을 확인해주세요`
          case 'some':
            return `어... 연결이 좀 이상한데... 인터넷 괜찮아? 🤔`
          default:
            return '네트워크 연결을 확인해주세요'
        }

      case 'timeout':
        switch (relationshipType?.toLowerCase()) {
          case 'family':
            return `${name}가 생각하느라 시간이 좀 걸리네요. 조금만 기다려주세요`
          case 'friend':
            return `친구가 딴생각하고 있나봐? 다시 불러볼까?`
          case 'lover':
            return `${name}가 완벽한 답변을 준비하느라... 조금만 기다려줘요 💕`
          case 'some':
            return `음... 뭔가 시간이 오래 걸리네요... 다시 해볼까요?`
          default:
            return '응답 시간이 초과되었습니다'
        }

      default:
        return error.message
    }
  }

  const style = getErrorStyle()
  const IconComponent = style.icon

  return (
    <div
      className={cn(
        'transition-all duration-300 transform',
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <Card className={cn('shadow-lg border-l-4', style.bgColor)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* 아이콘 */}
            <div className="flex-shrink-0">
              <IconComponent className={cn('w-5 h-5', style.iconColor)} />
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className={cn('font-medium text-sm', style.titleColor)}>
                  {getCharacterSpecificMessage()}
                </p>
              </div>

              {/* 세부 정보 */}
              {error.details && (
                <p className="text-xs text-muted mb-2">
                  {error.details}
                </p>
              )}

              {/* 추가 정보 배지 */}
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs">
                  {error.type}
                </Badge>
                {error.context?.errorCode && (
                  <Badge variant="secondary" className="text-xs">
                    {error.context.errorCode}
                  </Badge>
                )}
                {timeLeft !== null && timeLeft > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {timeLeft}초 후 재시도 가능
                  </Badge>
                )}
              </div>

              {/* 액션 버튼들 */}
              <div className="flex items-center gap-2">
                {error.retryable && onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={isRetrying || (timeLeft !== null && timeLeft > 0)}
                    className="text-xs h-7"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        재시도 중...
                      </>
                    ) : timeLeft !== null && timeLeft > 0 ? (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        {timeLeft}초 대기
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        다시 시도
                      </>
                    )}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-xs h-7 px-2"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 토스트 매니저 컨텍스트
 */
interface ToastContextType {
  showToast: (error: Omit<ToastError, 'id'>) => void
  showSuccess: (message: string, autoHide?: boolean) => void
  showInfo: (message: string, autoHide?: boolean) => void
  dismissToast: (id: string) => void
  clearAllToasts: () => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

/**
 * 토스트 컨테이너 컴포넌트
 */
interface ToastContainerProps {
  children: React.ReactNode
  maxToasts?: number
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

export function ToastContainer({ 
  children, 
  maxToasts = 5,
  position = 'top-right'
}: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastError[]>([])

  const showToast = (errorData: Omit<ToastError, 'id'>) => {
    const id = Date.now().toString()
    const newToast: ToastError = {
      ...errorData,
      id
    }

    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, maxToasts)
      console.log('토스트 추가:', { id, type: errorData.type, message: errorData.message })
      return updated
    })
  }

  const showSuccess = (message: string, autoHide = true) => {
    showToast({
      type: 'unknown',
      message,
      retryable: false,
      context: { operation: 'success' }
    })
  }

  const showInfo = (message: string, autoHide = true) => {
    showToast({
      type: 'unknown',
      message,
      retryable: false,
      context: { operation: 'info' }
    })
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
    console.log('토스트 제거:', id)
  }

  const clearAllToasts = () => {
    setToasts([])
    console.log('모든 토스트 제거')
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      default:
        return 'top-4 right-4'
    }
  }

  const contextValue: ToastContextType = {
    showToast,
    showSuccess,
    showInfo,
    dismissToast,
    clearAllToasts
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* 토스트 오버레이 */}
      {toasts.length > 0 && (
        <div className={cn(
          'fixed z-50 w-80 max-w-sm space-y-3',
          getPositionClasses()
        )}>
          {toasts.map((toast) => (
            <ErrorToast
              key={toast.id}
              error={toast}
              onDismiss={() => dismissToast(toast.id)}
              onRetry={toast.retryable ? async () => {
                // 여기서 실제 재시도 로직 실행
                console.log('토스트에서 재시도:', toast.id)
              } : undefined}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/**
 * 토스트 훅
 */
export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastContainer')
  }
  return context
}

export default ErrorToast
