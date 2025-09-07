/**
 * MessageImage 컴포넌트
 * Task 007: Implement Image Display and Management UI
 * 
 * 생성된 이미지를 채팅 메시지 내에 표시하고
 * 다운로드, 재생성, 삭제 등의 관리 기능을 제공합니다.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  RefreshCw, 
  Trash2, 
  Maximize2, 
  Loader2,
  AlertCircle,
  Eye,
  EyeOff 
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageImageProps {
  imageUrl: string;
  messageId: string;
  alt?: string;
  onRegenerate?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  className?: string;
  showActions?: boolean;
  loading?: boolean;
}

export function MessageImage({
  imageUrl,
  messageId,
  alt = "AI 생성 이미지",
  onRegenerate,
  onDelete,
  className = "",
  showActions = true,
  loading = false
}: MessageImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const actionsTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * 이미지 로딩 완료 처리
   */
  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  /**
   * 이미지 로딩 오류 처리
   */
  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setError('이미지를 불러올 수 없습니다');
    console.error('MessageImage: 이미지 로딩 오류', { imageUrl, messageId });
  }, [imageUrl, messageId]);

  /**
   * 이미지 다운로드
   */
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = `ai-image-${messageId}-${Date.now()}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('이미지가 다운로드되었습니다');
      
    } catch (error) {
      console.error('이미지 다운로드 오류:', error);
      toast.error('이미지 다운로드에 실패했습니다');
    }
  }, [imageUrl, messageId]);

  /**
   * 이미지 재생성
   */
  const handleRegenerate = useCallback(async () => {
    if (!onRegenerate || isRegenerating) return;
    
    try {
      setIsRegenerating(true);
      await onRegenerate();
      toast.success('이미지 재생성이 시작되었습니다');
    } catch (error) {
      console.error('이미지 재생성 오류:', error);
      toast.error('이미지 재생성에 실패했습니다');
    } finally {
      setIsRegenerating(false);
      setShowActionsMenu(false);
    }
  }, [onRegenerate, isRegenerating]);

  /**
   * 이미지 삭제
   */
  const handleDelete = useCallback(async () => {
    if (!onDelete || isDeleting) return;
    
    // 삭제 확인
    const confirmed = window.confirm('이 이미지를 삭제하시겠습니까?');
    if (!confirmed) return;
    
    try {
      setIsDeleting(true);
      await onDelete();
      toast.success('이미지가 삭제되었습니다');
    } catch (error) {
      console.error('이미지 삭제 오류:', error);
      toast.error('이미지 삭제에 실패했습니다');
    } finally {
      setIsDeleting(false);
      setShowActionsMenu(false);
    }
  }, [onDelete, isDeleting]);

  /**
   * 풀스크린 모달 열기
   */
  const handleOpenFullscreen = useCallback(() => {
    if (!error && !isLoading) {
      setShowFullscreen(true);
    }
  }, [error, isLoading]);

  /**
   * 마우스 호버 시 액션 메뉴 표시
   */
  const handleMouseEnter = useCallback(() => {
    if (showActions && !loading) {
      if (actionsTimeoutRef.current) {
        clearTimeout(actionsTimeoutRef.current);
      }
      setShowActionsMenu(true);
    }
  }, [showActions, loading]);

  /**
   * 마우스 벗어날 시 액션 메뉴 숨김 (지연)
   */
  const handleMouseLeave = useCallback(() => {
    if (actionsTimeoutRef.current) {
      clearTimeout(actionsTimeoutRef.current);
    }
    
    actionsTimeoutRef.current = setTimeout(() => {
      setShowActionsMenu(false);
    }, 500); // 500ms 지연
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (actionsTimeoutRef.current) {
        clearTimeout(actionsTimeoutRef.current);
      }
    };
  }, []);

  // 키보드 접근성
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenFullscreen();
    }
  }, [handleOpenFullscreen]);

  return (
    <>
      <div 
        className={`relative group bg-gray-50 rounded-lg overflow-hidden transition-all duration-200 ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* 로딩 상태 */}
        {(isLoading || loading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">이미지 로딩 중...</span>
            </div>
          </div>
        )}

        {/* 오류 상태 */}
        {error && !isLoading && (
          <div className="flex items-center justify-center p-8 text-gray-500 bg-gray-100">
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <span className="text-sm">{error}</span>
              {onRegenerate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-2">다시 시도</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 이미지 */}
        {!error && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={alt}
            className={`
              w-full h-auto max-w-full cursor-pointer transition-transform duration-200 
              hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${isLoading ? 'opacity-0' : 'opacity-100'}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            onClick={handleOpenFullscreen}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`${alt} - 클릭하여 확대 보기`}
            style={{ display: isLoading ? 'none' : 'block' }}
          />
        )}

        {/* 액션 버튼들 */}
        {showActions && showActionsMenu && !error && !isLoading && !loading && (
          <div className="absolute top-2 right-2 flex gap-1 bg-black/50 backdrop-blur-sm rounded-lg p-1">
            {/* 풀스크린 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={handleOpenFullscreen}
              title="확대 보기"
              aria-label="이미지 확대 보기"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            {/* 다운로드 버튼 */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              onClick={handleDownload}
              title="다운로드"
              aria-label="이미지 다운로드"
            >
              <Download className="w-4 h-4" />
            </Button>

            {/* 재생성 버튼 */}
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
                onClick={handleRegenerate}
                disabled={isRegenerating}
                title="재생성"
                aria-label="이미지 재생성"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* 삭제 버튼 */}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-red-500/80 h-8 w-8 p-0"
                onClick={handleDelete}
                disabled={isDeleting}
                title="삭제"
                aria-label="이미지 삭제"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 풀스크린 모달 */}
      {showFullscreen && (
        <FullscreenImageModal
          imageUrl={imageUrl}
          alt={alt}
          onClose={() => setShowFullscreen(false)}
        />
      )}
    </>
  );
}

/**
 * 풀스크린 이미지 모달 컴포넌트
 */
interface FullscreenImageModalProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

function FullscreenImageModal({ imageUrl, alt, onClose }: FullscreenImageModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === '+' || event.key === '=') {
        setScale(prev => Math.min(prev * 1.2, 5));
      } else if (event.key === '-') {
        setScale(prev => Math.max(prev / 1.2, 0.1));
      } else if (event.key === '0') {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // 마우스 휠로 확대/축소
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.1), 5));
  }, []);

  // 드래그 시작
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
  }, [position]);

  // 드래그 중
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  // 드래그 종료
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 cursor-pointer"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
        aria-label="모달 닫기"
      >
        <EyeOff className="w-6 h-6" />
      </Button>

      {/* 확대/축소 컨트롤 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => setScale(prev => Math.max(prev / 1.2, 0.1))}
          aria-label="축소"
        >
          -
        </Button>
        <span className="text-white px-2 py-1 min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => setScale(prev => Math.min(prev * 1.2, 5))}
          aria-label="확대"
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20"
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
          aria-label="원본 크기"
        >
          원본
        </Button>
      </div>

      {/* 이미지 */}
      <img
        src={imageUrl}
        alt={alt}
        className={`max-w-none max-h-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        draggable={false}
      />

      {/* 사용법 안내 */}
      <div className="absolute top-4 left-4 text-white/70 text-sm">
        <div>ESC: 닫기</div>
        <div>휠: 확대/축소</div>
        <div>드래그: 이동</div>
        <div>+/-: 확대/축소</div>
        <div>0: 원본</div>
      </div>
    </div>
  );
}

export default MessageImage;
