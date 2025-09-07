'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// 숨겨진 태그 제거 유틸리티 함수
function removeHiddenTags(content: string): string {
  if (!content || typeof content !== 'string') return '';
  
  // 더 강력한 HTML 주석 제거 정규식 (줄바꿈 포함)
  return content
    .replace(/<!--[\s\S]*?-->/g, '') // HTML 주석 제거
    .replace(/^\s*\n/gm, '') // 빈 줄 제거
    .trim(); // 앞뒤 공백 제거
}

interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  // 문장 분할 관련 추가 필드
  isSentencePart?: boolean
  sentenceIndex?: number
  totalSentences?: number
}

interface MessageBubbleProps {
  message: ChatMessage
  chatbotName: string
  chatbotImage?: string
  isTyping?: boolean
  // 문장별 버블 애니메이션 관련 props
  isSentencePart?: boolean
  sentenceIndex?: number
  totalSentences?: number
  animationDelay?: number
  enableAnimation?: boolean
}

export function MessageBubble({ 
  message, 
  chatbotName, 
  chatbotImage,
  isTyping = false,
  // 문장별 버블 props (기본값 설정)
  isSentencePart = false,
  sentenceIndex = 0,
  totalSentences = 1,
  animationDelay = 0,
  enableAnimation = true
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const timestamp = new Date(message.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // 문장별 버블 애니메이션 클래스 생성
  const getAnimationClasses = () => {
    if (!enableAnimation || !isSentencePart) {
      return ''
    }
    
    return 'animate-fade-in-up'
  }

  // 문장별 버블 간격 조정
  const getSentenceSpacing = () => {
    if (!isSentencePart) {
      return 'mb-4' // 기본 메시지 간격
    }
    
    // 문장별 버블은 더 작은 간격
    return sentenceIndex === totalSentences - 1 ? 'mb-4' : 'mb-2'
  }

  return (
    <div 
      className={cn(
        "flex gap-4 max-w-[95%] sm:max-w-[85%] md:max-w-[75%]",
        isUser ? "ml-auto justify-end self-end" : "mr-auto justify-start self-start",
        getSentenceSpacing(),
        getAnimationClasses()
      )}
      style={{
        animationDelay: enableAnimation && animationDelay > 0 ? `${animationDelay}ms` : '0ms'
      }}
    >
      {/* AI 프로필 이미지 (왼쪽) - 문장별 버블일 때는 첫 번째 문장에만 표시 */}
      {!isUser && (!isSentencePart || sentenceIndex === 0) && (
        <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
          <AvatarImage src={chatbotImage} alt={chatbotName} />
          <AvatarFallback className="text-sm bg-primary/10 text-primary">
            {chatbotName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 문장별 버블일 때 프로필 이미지 공간 확보 (두 번째 문장부터) */}
      {!isUser && isSentencePart && sentenceIndex > 0 && (
        <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0" />
      )}

      <div className={cn(
        "flex flex-col gap-2",
        isUser ? "items-end" : "items-start"
      )}>
        {/* 발신자 이름 (AI만 표시, 문장별 버블일 때는 첫 번째 문장에만) */}
        {!isUser && (!isSentencePart || sentenceIndex === 0) && (
          <span className="text-sm text-muted px-1 font-medium">
            {chatbotName}
            {/* Phase 4-8 Step 2-1: 닉네임 옆 (1/n) 숨김 처리 */}
          </span>
        )}

        {/* 메시지 말풍선 */}
        <div className={cn(
          "relative px-5 py-4 rounded-3xl break-words",
          "shadow-card border transition-all duration-200",
          isUser ? [
            "bg-primary text-inverse",
            "rounded-br-lg", // LobeChat 스타일 꺽임
            "border-primary"
          ] : [
            "bg-primary/10 text-foreground", 
            "rounded-bl-lg", // LobeChat 스타일 꺽임
            "border-primary/20"
          ],
          // 문장별 버블 특별 스타일링
          isSentencePart && [
            "transform transition-transform duration-200",
            "hover:scale-[1.02]"
          ]
        )}>
          {/* 타이핑 애니메이션 */}
          {isTyping ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-muted ml-2">입력중...</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-base leading-relaxed">
              {/* 🏷️ 숨겨진 태그 제거 후 표시 */}
              {removeHiddenTags(message.content)}
              {/* Phase 4-8 Step 2-1: 각 버블 내 [1/n] 숨김 처리 */}
            </div>
          )}
        </div>

        {/* 시간 표시 (문장별 버블일 때는 마지막 문장에만 표시) */}
        {(!isSentencePart || sentenceIndex === totalSentences - 1) && (
          <span className={cn(
            "text-sm text-muted px-1",
            isUser ? "text-right" : "text-left"
          )}>
            {timestamp}
            {/* Phase 4-8 Step 2-1: 시간 옆 (n개 문장) 숨김 처리 */}
          </span>
        )}
      </div>

      {/* 사용자 프로필 이미지 (오른쪽) */}
      {isUser && (
        <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
          <AvatarFallback className="text-sm bg-primary/10 text-primary">
            나
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

// 타이핑 상태 전용 컴포넌트
export function TypingIndicator({ 
  chatbotName, 
  chatbotImage 
}: { 
  chatbotName: string
  chatbotImage?: string 
}) {
  return (
    <div className="flex gap-4 max-w-[95%] sm:max-w-[85%] md:max-w-[75%] mr-auto">
      <Avatar className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
        <AvatarImage src={chatbotImage} alt={chatbotName} />
        <AvatarFallback className="text-sm bg-primary/10 text-primary">
          {chatbotName.slice(0, 2)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2 items-start">
        <span className="text-sm text-muted px-1 font-medium">
          {chatbotName}
        </span>

        <div className="bg-warning/10 border border-warning/20 px-5 py-4 rounded-3xl rounded-bl-lg shadow-card">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted ml-2">입력중...</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// 문장별 버블 그룹 컴포넌트 (여러 문장을 순차 표시)
export function SentenceGroup({ 
  sentences, 
  chatbotName, 
  chatbotImage,
  displaySpeed = 800,
  onComplete
}: {
  sentences: ChatMessage[]
  chatbotName: string
  chatbotImage?: string
  displaySpeed?: number
  onComplete?: () => void
}) {
  const [visibleSentences, setVisibleSentences] = useState<number>(0)

  useEffect(() => {
    if (sentences.length === 0) return

    // 첫 번째 문장은 즉시 표시
    setVisibleSentences(1)

    // 나머지 문장들을 순차적으로 표시
    const timers: NodeJS.Timeout[] = []
    
    for (let i = 1; i < sentences.length; i++) {
      const timer = setTimeout(() => {
        setVisibleSentences(i + 1)
        
        // 마지막 문장 표시 완료 시 콜백 호출
        if (i === sentences.length - 1 && onComplete) {
          setTimeout(onComplete, 100) // 애니메이션 완료 후 콜백
        }
      }, i * displaySpeed)
      
      timers.push(timer)
    }

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [sentences, displaySpeed, onComplete])

  return (
    <div className="space-y-3">
      {sentences.slice(0, visibleSentences).map((sentence, index) => (
        <MessageBubble
          key={sentence.id}
          message={sentence}
          chatbotName={chatbotName}
          chatbotImage={chatbotImage}
          isSentencePart={true}
          sentenceIndex={index}
          totalSentences={sentences.length}
          animationDelay={0} // SentenceGroup에서 순차 표시를 관리하므로 개별 딜레이 없음
          enableAnimation={true}
        />
      ))}
    </div>
  )
}
