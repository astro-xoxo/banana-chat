/**
 * ChatMessageWithActions 컴포넌트
 * Task 006: Create Message Image Generation UI Components
 * 
 * 채팅 메시지에 이미지 생성 기능을 추가한 통합 컴포넌트
 * MessageBubble 스타일을 유지하면서 이미지 생성 버튼과 이미지 표시 기능을 추가
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, AlertCircle } from 'lucide-react';
import { MessageImageGeneration } from './MessageImageGeneration';
import { cn } from '@/lib/utils';

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
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: {
    images?: Array<{
      url: string;
      prompt?: any;
      generated_at?: string;
    }>;
  };
  // 문장 분할 관련 필드
  isSentencePart?: boolean;
  sentenceIndex?: number;
  totalSentences?: number;
}

interface ChatMessageWithActionsProps {
  message: ChatMessage;
  onImageGenerated?: (messageId: string, imageUrl: string, promptInfo: any) => void;
  className?: string;
  // 챗봇 정보 추가
  chatbotName?: string;
  chatbotImage?: string;
}

export const ChatMessageWithActions: React.FC<ChatMessageWithActionsProps> = ({
  message,
  onImageGenerated,
  className = '',
  chatbotName = 'AI Assistant',
  chatbotImage
}) => {
  const [showActions, setShowActions] = useState(false);

  const isUser = message.role === 'user';
  const isAIMessage = message.role === 'assistant';
  const hasExistingImages = message.metadata?.images && message.metadata.images.length > 0;
  
  // 문장 분할 관련
  const isSentencePart = message.isSentencePart || false;
  const sentenceIndex = message.sentenceIndex || 0;
  const totalSentences = message.totalSentences || 1;

  const timestamp = new Date(message.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // 새로 생성된 AI 메시지는 일정 시간 후 버튼 자동 표시
  useEffect(() => {
    console.log('🔍 버튼 자동 표시 useEffect 실행:', {
      isAIMessage,
      isSentencePart,
      sentenceIndex,
      totalSentences,
      shouldShowButton: isAIMessage && (!isSentencePart || sentenceIndex === totalSentences - 1)
    });
    
    if (isAIMessage && (!isSentencePart || sentenceIndex === totalSentences - 1)) {
      console.log('✅ 버튼 자동 표시 조건 만족 - 1초 후 표시 예정');
      const timer = setTimeout(() => {
        console.log('🎯 1초 경과 - 버튼 표시 실행');
        setShowActions(true);
      }, 1000); // 1초 후 자동 표시
      
      return () => {
        console.log('🧹 타이머 정리');
        clearTimeout(timer);
      };
    }
  }, [isAIMessage, isSentencePart, sentenceIndex, totalSentences]);

  // 이미지 생성 성공 핸들러
  const handleImageGenerated = useCallback((imageUrl: string, promptInfo: any) => {
    console.log('🖼️ 이미지 생성 완료:', {
      messageId: message.id,
      imageUrl: imageUrl.substring(0, 50) + '...'
    });
    
    if (onImageGenerated) {
      onImageGenerated(message.id, imageUrl, promptInfo);
    }
  }, [message.id, onImageGenerated]);

  // 문장별 버블 간격 조정
  const getSentenceSpacing = () => {
    if (!isSentencePart) {
      return 'mb-4'; // 기본 메시지 간격
    }
    
    // 문장별 버블은 더 작은 간격
    return sentenceIndex === totalSentences - 1 ? 'mb-4' : 'mb-2';
  };

  return (
    <div 
      className={cn(
        "group flex gap-3 max-w-[95%] sm:max-w-[80%] md:max-w-[70%]",
        isUser ? "ml-auto justify-end self-end" : "mr-auto justify-start self-start",
        getSentenceSpacing(),
        className
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* AI 프로필 이미지 (왼쪽) - 문장별 버블일 때는 첫 번째 문장에만 표시 */}
      {!isUser && (!isSentencePart || sentenceIndex === 0) && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={chatbotImage} alt={chatbotName} />
          <AvatarFallback className="text-xs bg-yellow-100 text-yellow-800">
            {chatbotName.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      )}

      {/* 문장별 버블일 때 프로필 이미지 공간 확보 (두 번째 문장부터) */}
      {!isUser && isSentencePart && sentenceIndex > 0 && (
        <div className="w-8 h-8 flex-shrink-0" />
      )}

      <div className={cn(
        "flex flex-col gap-1 flex-1",
        isUser ? "items-end" : "items-start"
      )}>
        {/* 발신자 이름 (AI만 표시, 문장별 버블일 때는 첫 번째 문장에만) */}
        {!isUser && (!isSentencePart || sentenceIndex === 0) && (
          <span className="text-xs text-muted px-1">
            {chatbotName}
          </span>
        )}

        {/* 메시지 말풍선 */}
        <div className={cn(
          "relative px-4 py-3 rounded-2xl break-words",
          "shadow-sm border transition-all duration-200",
          isUser ? [
            "bg-blue-500 text-white",
            "rounded-br-md",
            "border-blue-500"
          ] : [
            "bg-warning-light text-foreground", 
            "rounded-bl-md",
            "border-warning"
          ]
        )}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {/* 🏷️ 숨겨진 태그 제거 후 표시 */}
            {removeHiddenTags(message.content)}
          </div>
        </div>

        {/* AI 메시지 이미지 생성 버튼 (메시지 단위, 마지막 문장에만 표시) */}
        {isAIMessage && (!isSentencePart || sentenceIndex === totalSentences - 1) && (
          <div className="flex items-center mt-1 mb-1 opacity-100">
            {/* 이미지 생성에는 태그 포함 내용 전달 */}
            <MessageImageGeneration
              messageId={message.id}
              messageContent={message.content}
              existingImages={message.metadata?.images?.map(img => img.url) || []}
              onImageGenerated={handleImageGenerated}
              className="flex-shrink-0"
            />
          </div>
        )}

        {/* 생성된 이미지들 표시 - 문장 분할 시 마지막 문장에만 표시 */}
        {hasExistingImages && 
         (!isSentencePart || sentenceIndex === totalSentences - 1) && (
          <div className="message-images mt-2 space-y-2">
            {message.metadata!.images!.map((image, index) => (
              <div key={index} className="relative max-w-sm">
                <img
                  src={image.url}
                  alt={`생성된 이미지 ${index + 1}`}
                  className="w-full h-auto rounded-lg shadow-sm border border-gray-200"
                  loading="lazy"
                />
                {image.prompt && (
                  <div className="mt-1 text-xs text-muted">
                    생성시간: {image.generated_at ? new Date(image.generated_at).toLocaleTimeString('ko-KR') : 'N/A'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 시간 표시 (문장별 버블일 때는 마지막 문장에만 표시) */}
        {(!isSentencePart || sentenceIndex === totalSentences - 1) && (
          <span className={cn(
            "text-xs text-muted px-1",
            isUser ? "text-right" : "text-left"
          )}>
            {timestamp}
          </span>
        )}
      </div>

      {/* 사용자 프로필 이미지 (오른쪽) */}
      {isUser && (
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarFallback className="text-xs bg-blue-100 text-blue-800">
            나
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessageWithActions;

// 타입 정의 내보내기
export type {
  ChatMessage,
  ChatMessageWithActionsProps
};
