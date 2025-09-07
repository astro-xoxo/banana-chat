/**
 * useImageGenerationInteraction 훅
 * Task 006: Create Message Image Generation UI Components
 * 
 * 이미지 생성 UI의 상호작용 로직을 관리하는 커스텀 훅
 * 모바일 친화적이고 접근성을 고려한 인터랙션 제공
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UseImageGenerationInteractionProps {
  messageId: string;
  messageContent: string;
  onImageGenerated?: (imageUrl: string, promptInfo: any) => void;
  onError?: (error: string) => void;
}

interface GenerationState {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  canGenerate: boolean;
  quotaInfo: {
    currentCount: number;
    dailyLimit: number;
    remaining: number;
  } | null;
}

export const useImageGenerationInteraction = ({
  messageId,
  messageContent,
  onImageGenerated,
  onError
}: UseImageGenerationInteractionProps) => {
  
  // 상태 관리
  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    progress: 0,
    error: null,
    canGenerate: false,
    quotaInfo: null
  });

  // 호버 상태 (데스크톱용)
  const [showActions, setShowActions] = useState(false);
  
  // 터치 디바이스 감지
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // 참조
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 터치 디바이스 감지 효과
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    checkTouchDevice();
    window.addEventListener('resize', checkTouchDevice);
    
    return () => {
      window.removeEventListener('resize', checkTouchDevice);
    };
  }, []);

  // 정리 효과
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 이미지 생성 가능 여부 확인
  const checkGenerationCapability = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/generate/chat-image-nanobanana?message_id=${messageId}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '상태 확인 실패');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        canGenerate: data.can_generate,
        quotaInfo: data.quota_info || null,
        error: data.can_generate ? null : (data.reason || '이미지 생성이 불가능합니다.')
      }));

      return data.can_generate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '상태 확인 중 오류가 발생했습니다.';
      setState(prev => ({ ...prev, error: errorMessage, canGenerate: false }));
      if (onError) onError(errorMessage);
      return false;
    }
  }, [messageId, onError]);

  // 진행률 시뮬레이션 시작
  const startProgressSimulation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setState(prev => ({ ...prev, progress: 0 }));

    progressIntervalRef.current = setInterval(() => {
      setState(prev => {
        if (prev.progress >= 90) return prev;
        return {
          ...prev,
          progress: Math.min(90, prev.progress + Math.random() * 15)
        };
      });
    }, 1000);
  }, []);

  // 진행률 시뮬레이션 정지
  const stopProgressSimulation = useCallback((finalProgress: number = 100) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setState(prev => ({ ...prev, progress: finalProgress }));
  }, []);

  // 이미지 생성 실행
  const generateImage = useCallback(async (qualityLevel: 'draft' | 'standard' | 'high' | 'premium' = 'high') => {
    if (state.isGenerating) return false;

    console.log('이미지 생성 시작:', {
      messageId,
      qualityLevel,
      contentPreview: messageContent.substring(0, 50) + '...'
    });

    // 생성 가능 여부 먼저 확인
    const canGenerate = await checkGenerationCapability();
    if (!canGenerate) {
      return false;
    }

    // 상태 초기화
    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      progress: 0
    }));

    // 진행률 시뮬레이션 시작
    startProgressSimulation();

    // 요청 취소를 위한 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate/chat-image-nanobanana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          quality_level: qualityLevel,
        }),
        signal: abortControllerRef.current.signal,
      });

      stopProgressSimulation(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 생성에 실패했습니다.');
      }

      const data = await response.json();

      if (!data.success || !data.image_url) {
        throw new Error(data.error || '이미지 URL을 받지 못했습니다.');
      }

      console.log('이미지 생성 성공:', {
        imageUrl: data.image_url.substring(0, 50) + '...',
        qualityScore: data.prompt_info?.quality_score,
        processingTime: data.processing_time
      });

      // 성공 처리
      if (onImageGenerated) {
        onImageGenerated(data.image_url, data.prompt_info);
      }

      // 성공 토스트
      toast.success('이미지가 성공적으로 생성되었습니다!', {
        description: `처리 시간: ${data.processing_time ? Math.round(data.processing_time / 1000) : '?'}초`,
        duration: 3000,
      });

      // 할당량 정보 업데이트
      await checkGenerationCapability();

      return true;

    } catch (error) {
      stopProgressSimulation(0);
      
      // 요청 취소된 경우는 오류로 처리하지 않음
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('이미지 생성 요청이 취소되었습니다.');
        return false;
      }

      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      console.error('이미지 생성 실패:', error);
      
      setState(prev => ({ ...prev, error: errorMessage }));
      
      if (onError) onError(errorMessage);
      
      // 오류 토스트
      toast.error('이미지 생성 실패', {
        description: errorMessage,
        duration: 5000,
      });

      return false;

    } finally {
      setState(prev => ({ ...prev, isGenerating: false }));
      abortControllerRef.current = null;
    }
  }, [messageId, messageContent, state.isGenerating, onImageGenerated, onError, checkGenerationCapability, startProgressSimulation, stopProgressSimulation]);

  // 생성 취소
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    stopProgressSimulation(0);
    setState(prev => ({
      ...prev,
      isGenerating: false,
      error: null,
      progress: 0
    }));

    toast.info('이미지 생성이 취소되었습니다.');
  }, [stopProgressSimulation]);

  // 재시도
  const retry = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    return generateImage();
  }, [generateImage]);

  // 호버 이벤트 핸들러 (데스크톱용)
  const handleMouseEnter = useCallback(() => {
    if (!isTouchDevice) {
      setShowActions(true);
    }
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    if (!isTouchDevice) {
      setShowActions(false);
    }
  }, [isTouchDevice]);

  // 터치 이벤트 핸들러 (모바일용)
  const handleTouchStart = useCallback(() => {
    if (isTouchDevice) {
      setShowActions(true);
    }
  }, [isTouchDevice]);

  // 초기 생성 가능 여부 확인
  useEffect(() => {
    checkGenerationCapability();
  }, [checkGenerationCapability]);

  return {
    // 상태
    ...state,
    showActions: isTouchDevice ? showActions : showActions,
    isTouchDevice,

    // 액션
    generateImage,
    cancelGeneration,
    retry,
    checkGenerationCapability,

    // 이벤트 핸들러
    handleMouseEnter,
    handleMouseLeave,
    handleTouchStart,

    // 유틸리티
    canInteract: !state.isGenerating && state.canGenerate,
    progressPercentage: Math.round(state.progress),
    remainingQuota: state.quotaInfo?.remaining || 0,
  };
};

export default useImageGenerationInteraction;
