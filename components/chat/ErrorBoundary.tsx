'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { logError } from '@/lib/errorLogger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: React.ComponentType<{error: Error, resetError: () => void}>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  chatbotName?: string
  relationshipType?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

/**
 * React 에러 바운더리 컴포넌트
 * 예상치 못한 컴포넌트 에러를 캐치하고 사용자 친화적인 폴백 UI 제공
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 에러 발생 시 상태 업데이트
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 에러 정보 저장
    this.setState({
      error,
      errorInfo
    })

    // 에러 로깅 (errorLogger 활용)
    logError(
      'REACT_ERROR_BOUNDARY', 
      `React component error caught: ${error.message}`,
      error,
      {
        user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
        api_endpoint: 'chat_component'
      },
      {
        component_stack: errorInfo.componentStack,
        error_boundary_location: 'ChatErrorBoundary',
        chatbot_name: this.props.chatbotName,
        relationship_type: this.props.relationshipType,
        retry_count: this.state.retryCount
      }
    )

    // 커스텀 에러 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    console.error('React Error Boundary 캐치:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      chatbot: this.props.chatbotName,
      retryCount: this.state.retryCount
    })
  }

  /**
   * 에러 상태 초기화 및 재시도
   */
  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1

    console.log(`에러 바운더리 재시도 (${newRetryCount}/${this.maxRetries})`)

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount
    })

    // 재시도 로깅
    logError(
      'ERROR_BOUNDARY_RETRY',
      `User initiated retry ${newRetryCount}/${this.maxRetries}`,
      this.state.error || undefined,
      undefined,
      {
        retry_count: newRetryCount,
        max_retries: this.maxRetries,
        chatbot_name: this.props.chatbotName
      }
    )
  }

  /**
   * 뒤로 가기 (안전한 페이지로 이동)
   */
  handleGoBack = () => {
    console.log('에러 바운더리에서 뒤로 가기')
    
    logError(
      'ERROR_BOUNDARY_GO_BACK',
      'User chose to go back from error boundary',
      this.state.error || undefined,
      undefined,
      {
        chatbot_name: this.props.chatbotName,
        retry_count: this.state.retryCount
      }
    )

    // 안전한 페이지로 이동
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }

  /**
   * 캐릭터별 맞춤 에러 메시지 생성
   */
  getCharacterSpecificErrorMessage(): {
    title: string
    message: string
    emoji: string
  } {
    const { relationshipType, chatbotName } = this.props
    const name = chatbotName || '친구'

    switch (relationshipType?.toLowerCase()) {
      case 'family':
        return {
          title: `${name}가 잠깐 쉬고 있어요 😊`,
          message: `가족같은 우리, 조금만 기다려줄래요? 금방 다시 돌아올게요!`,
          emoji: '🏠'
        }

      case 'friend':
        return {
          title: `${name}가 버그에 갇혔어요! 🐛`,
          message: `친구야, 미안해! 뭔가 꼬인 것 같아. 새로고침 한번 눌러줄래?`,
          emoji: '🤝'
        }

      case 'lover':
        return {
          title: `${name}가 잠깐 멈춰버렸어요 💕`,
          message: `사랑하는 당신을 위해 더 완벽해지려고 하다가... 조금만 기다려줘요?`,
          emoji: '💝'
        }

      case 'some':
        return {
          title: `${name}가 좀... 이상해요? 🤔`,
          message: `어색하게 에러가 났네요... 혹시 다시 시도해볼까요? 아니면 말고요... 😅`,
          emoji: '❓'
        }

      default:
        return {
          title: `${name}에게 문제가 생겼어요`,
          message: `예상치 못한 오류가 발생했습니다. 새로고침을 시도해보세요.`,
          emoji: '⚠️'
        }
    }
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 컴포넌트가 있으면 사용
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.handleRetry} />
      }

      // 기본 에러 UI
      const { title, message, emoji } = this.getCharacterSpecificErrorMessage()
      const canRetry = this.state.retryCount < this.maxRetries

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-error/5 to-warning/5">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center text-2xl">
                {emoji}
              </div>
              <CardTitle className="text-lg font-medium text-foreground">
                {title}
              </CardTitle>
              <div className="flex justify-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  에러 바운더리
                </Badge>
                {this.state.retryCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    재시도 {this.state.retryCount}회
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-center text-muted text-sm leading-relaxed">
                {message}
              </p>

              {/* 기술적 세부사항 (개발 환경에서만) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-3 bg-surface rounded-lg">
                  <p className="text-xs font-mono text-muted break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {canRetry ? (
                  <Button 
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    다시 시도 ({this.maxRetries - this.state.retryCount}회 남음)
                  </Button>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted mb-3">
                      최대 재시도 횟수를 초과했습니다.
                    </p>
                  </div>
                )}

                <Button 
                  onClick={this.handleGoBack}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  이전 페이지로 돌아가기
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted">
                  문제가 계속되면 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 함수형 컴포넌트용 에러 바운더리 래퍼
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

export default ErrorBoundary
