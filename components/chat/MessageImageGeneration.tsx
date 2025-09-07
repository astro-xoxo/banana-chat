/**
 * MessageImageGeneration 컴포넌트
 * Task 006: Create Message Image Generation UI Components
 * 
 * AI 메시지에 마우스 호버 시 이미지 생성 버튼을 표시하고
 * 이미지 생성 요청 플로우를 처리합니다.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessageImageGenerationProps {
  messageId: string;
  messageContent: string;
  existingImages?: string[];
  onImageGenerated?: (imageUrl: string, promptInfo: any) => void;
  className?: string;
}

interface GenerationResponse {
  success: boolean;
  image_url?: string;
  prompt_info?: {
    positive_prompt: string;
    negative_prompt: string;
    quality_score: number;
    template_used: string;
    keywords_extracted: any;
  };
  processing_time?: number;
  error?: string;
}

export const MessageImageGeneration: React.FC<MessageImageGenerationProps> = ({
  messageId,
  messageContent,
  existingImages = [],
  onImageGenerated,
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  // 이미지 생성 처리
  const handleGenerateImage = useCallback(async () => {
    if (isGenerating) return;

    // messageId 검증
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      console.error('❌ 클라이언트: 유효하지 않은 messageId:', {
        messageId,
        messageIdType: typeof messageId,
        messageIdLength: messageId?.length
      });
      toast.error('오류', {
        description: '유효하지 않은 메시지 ID입니다.',
        duration: 3000,
      });
      return;
    }

    // split 접미사 제거 (문장 분할 기능 대응)
    let normalizedMessageId = messageId.trim();
    if (normalizedMessageId.includes('-split-')) {
      const parts = normalizedMessageId.split('-split-');
      normalizedMessageId = parts[0];
      console.log('🔍 클라이언트: Split 접미사 제거:', {
        original: messageId,
        normalized: normalizedMessageId,
        splitIndex: parts[1]
      });
    }

    // UUID 검증을 완화하여 임시 메시지 ID도 허용
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tempIdRegex = /^ai-\d+-\d*$/; // 임시 ID 패턴 (ai-timestamp-index)
    
    const isValidUuid = uuidRegex.test(normalizedMessageId);
    const isTempId = tempIdRegex.test(normalizedMessageId);
    
    if (!isValidUuid && !isTempId) {
      console.error('❌ 클라이언트: 지원하지 않는 messageId 형식:', {
        originalMessageId: messageId,
        normalizedMessageId: normalizedMessageId,
        messageIdLength: normalizedMessageId.length,
        isValidUuid,
        isTempId
      });
      toast.error('오류', {
        description: '메시지 ID 형식이 올바르지 않습니다.',
        duration: 3000,
      });
      return;
    }
    
    // 임시 ID의 경우 서버에서 처리할 수 있도록 로그 출력
    if (isTempId) {
      console.log('🔄 임시 메시지 ID로 이미지 생성 시도:', {
        originalMessageId: messageId,
        normalizedMessageId: normalizedMessageId
      });
    }

    console.log('🎨 이미지 생성 시작:', {
      originalMessageId: messageId,
      normalizedMessageId: normalizedMessageId,
      contentPreview: messageContent.substring(0, 50) + '...'
    });

    setIsGenerating(true);

    try {
      // 요청 바디 구성
      const requestBody: any = {
        message_id: normalizedMessageId,  // 정규화된 ID 전송
        quality_level: 'high',
      };

      // 임시 메시지인 경우 메시지 내용도 함께 전송
      if (isTempId) {
        requestBody.message_content = messageContent;
        console.log('🔄 임시 메시지용 요청 바디:', {
          message_id: normalizedMessageId,
          content_preview: messageContent.substring(0, 50) + '...',
          content_length: messageContent.length
        });
      }

      const response = await fetch('/api/chat/generate-message-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = '이미지 생성에 실패했습니다.';
        try {
          const errorData = await response.json();
          console.error('🔍 서버 오류 응답:', errorData);
          errorMessage = errorData.error || errorMessage;
          
          // error_details가 있으면 더 자세한 정보 로깅
          if (errorData.error_details) {
            console.error('오류 상세:', errorData.error_details);
          }
        } catch (parseError) {
          console.error('오류 응답 파싱 실패:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data: GenerationResponse = await response.json();

      if (!data.success || !data.image_url) {
        throw new Error(data.error || '이미지 URL을 받지 못했습니다.');
      }

      console.log('✅ 이미지 생성 성공:', {
        imageUrl: data.image_url.substring(0, 50) + '...',
        processingTime: data.processing_time
      });

      // 성공 시 콜백 호출
      if (onImageGenerated) {
        onImageGenerated(data.image_url, data.prompt_info);
      }

      // 성공 토스트 표시
      toast.success('이미지가 생성되었습니다!', {
        description: `처리 시간: ${data.processing_time ? Math.round(data.processing_time / 1000) : '?'}초`,
        duration: 3000,
      });

    } catch (err) {
      console.error('❌ 이미지 생성 실패:', err);
      
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      
      // 오류 토스트 표시
      toast.error('이미지 생성 실패', {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [messageId, messageContent, isGenerating, onImageGenerated]);

  // 이미 이미지가 있으면 버튼을 표시하지 않음
  if (existingImages.length > 0) {
    return null;
  }

  // 임시 메시지 ID 검증 로직 제거 - 실시간 메시지에서도 버튼 표시 허용
  // const isTemporaryId = messageId.startsWith('ai-') && /^ai-\d+-\d*$/.test(messageId);
  // if (isTemporaryId) {
  //   console.log('🔍 임시 메시지 ID 감지, 이미지 생성 버튼 숨김:', messageId);
  //   return null;
  // }

  // UUID 검증 로직 제거 - 실시간 메시지의 임시 ID도 허용
  // const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // let normalizedId = messageId.trim();
  
  // // split 접미사 제거
  // if (normalizedId.includes('-split-')) {
  //   normalizedId = normalizedId.split('-split-')[0];
  // }
  
  // if (!uuidRegex.test(normalizedId)) {
  //   console.log('🔍 UUID가 아닌 메시지 ID, 이미지 생성 버튼 숨김:', messageId);
  //   return null;
  // }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleGenerateImage}
      disabled={isGenerating}
      className={cn(
        "h-auto px-2 py-1 rounded-md",
        "text-xs text-blue-600 hover:text-blue-700",
        "hover:bg-blue-50",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "flex items-center gap-1",
        className
      )}
      aria-label="메시지 내용을 바탕으로 이미지 생성"
      title={isGenerating ? "이미지 생성 중..." : "이미지 생성"}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>생성 중...</span>
        </>
      ) : (
        <>
          <Camera className="w-3 h-3" />
          <span>이미지 만들기</span>
        </>
      )}
    </Button>
  );
};

export default MessageImageGeneration;

// 타입 정의 내보내기
export type {
  MessageImageGenerationProps,
  GenerationResponse
};
