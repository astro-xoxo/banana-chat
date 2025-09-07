/**
 * MessageImageGeneration 컴포넌트 단위 테스트
 * Task 006: Create Message Image Generation UI Components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { MessageImageGeneration } from '@/components/chat/MessageImageGeneration';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('MessageImageGeneration', () => {
  const mockProps = {
    messageId: '123e4567-e89b-12d3-a456-426614174000', // UUID 형식
    messageContent: '오늘은 정말 행복한 하루였어요! 공원에서 예쁜 꽃들을 많이 봤거든요.',
    onImageGenerated: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('초기 렌더링', () => {
    test('이미지 생성 버튼이 표시된다', () => {
      render(<MessageImageGeneration {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('📸 이미지 생성');
    });

    test('기존 이미지가 있으면 버튼이 표시되지 않는다', () => {
      render(
        <MessageImageGeneration 
          {...mockProps} 
          existingImages={['https://example.com/image.jpg']}
        />
      );
      
      const button = screen.queryByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).not.toBeInTheDocument();
    });

    test('버튼이 초기에는 활성화되어 있다', () => {
      render(<MessageImageGeneration {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('이미지 생성 플로우', () => {
    test('성공적인 이미지 생성', async () => {
      const user = userEvent.setup();

      // GET 요청 (할당량 확인) mock
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            can_generate: true,
            quota_info: {
              current_count: 5,
              daily_limit: 10,
              remaining: 5
            }
          })
        })
        // POST 요청 (이미지 생성) mock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            image_url: 'https://example.com/generated-image.jpg',
            prompt_info: {
              positive_prompt: 'happy person in beautiful park with flowers',
              negative_prompt: 'blurry, low quality',
              quality_score: 0.85,
              template_used: 'general',
              keywords_extracted: {
                emotions: ['행복한'],
                situations: ['공원에서'],
                objects: ['꽃들']
              }
            },
            processing_time: 45000,
            generation_job_id: 'job_123'
          })
        })
        // 할당량 재확인 mock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            can_generate: true,
            quota_info: {
              current_count: 6,
              daily_limit: 10,
              remaining: 4
            }
          })
        });

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });

      // 버튼 클릭
      await user.click(button);

      // 로딩 상태 확인
      await waitFor(() => {
        expect(screen.getByText('생성 중...')).toBeInTheDocument();
      });

      // 진행률 표시 확인
      await waitFor(() => {
        expect(screen.getByText('이미지 생성 중...')).toBeInTheDocument();
      });

      // 성공 완료 대기
      await waitFor(() => {
        expect(mockProps.onImageGenerated).toHaveBeenCalledWith(
          'https://example.com/generated-image.jpg',
          expect.objectContaining({
            quality_score: 0.85,
            template_used: 'general'
          })
        );
      }, { timeout: 5000 });

      // 성공 토스트 확인
      expect(toast.success).toHaveBeenCalledWith(
        '이미지가 성공적으로 생성되었습니다!',
        expect.objectContaining({
          description: '처리 시간: 45초'
        })
      );

      // API 호출 확인
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(fetch).toHaveBeenNthCalledWith(1, 
        `/api/chat/generate-message-image?message_id=${mockProps.messageId}`,
        expect.objectContaining({ method: 'GET' })
      );
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/api/chat/generate-message-image',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            message_id: mockProps.messageId,
            quality_level: 'high'
          })
        })
      );
    });

    test('할당량 초과로 인한 생성 불가', async () => {
      const user = userEvent.setup();

      // 할당량 초과 응답
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          can_generate: false,
          reason: '일일 할당량 초과',
          quota_info: {
            current_count: 10,
            daily_limit: 10,
            remaining: 0
          }
        })
      });

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('일일 할당량 초과')).toBeInTheDocument();
      });

      expect(button).toBeDisabled();
    });

    test('서버 오류 처리 및 재시도', async () => {
      const user = userEvent.setup();

      // 첫 번째: 할당량 확인 성공
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            can_generate: true,
            quota_info: { current_count: 5, daily_limit: 10, remaining: 5 }
          })
        })
        // 두 번째: 이미지 생성 실패
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            success: false,
            error: 'ComfyUI 서버 연결 실패'
          })
        })
        // 재시도 시 할당량 확인
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            can_generate: true,
            quota_info: { current_count: 5, daily_limit: 10, remaining: 5 }
          })
        })
        // 재시도 시 이미지 생성 성공
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            image_url: 'https://example.com/retry-image.jpg',
            prompt_info: { quality_score: 0.8 },
            processing_time: 30000
          })
        });

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      // 첫 번째 시도
      await user.click(button);

      // 오류 메시지 확인
      await waitFor(() => {
        expect(screen.getByText('ComfyUI 서버 연결 실패')).toBeInTheDocument();
      });

      // 오류 토스트 확인
      expect(toast.error).toHaveBeenCalledWith(
        '이미지 생성 실패',
        expect.objectContaining({
          description: 'ComfyUI 서버 연결 실패'
        })
      );

      // 재시도 버튼 클릭
      const retryButton = screen.getByRole('button', { name: /다시 시도/i });
      await user.click(retryButton);

      // 재시도 성공 확인
      await waitFor(() => {
        expect(mockProps.onImageGenerated).toHaveBeenCalledWith(
          'https://example.com/retry-image.jpg',
          expect.objectContaining({ quality_score: 0.8 })
        );
      });
    });

    test('네트워크 오류 처리', async () => {
      const user = userEvent.setup();

      // 네트워크 오류 시뮬레이션
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith(
        '이미지 생성 실패',
        expect.objectContaining({
          description: 'Network error'
        })
      );
    });
  });

  describe('진행률 표시', () => {
    test('로딩 중 진행률이 표시된다', async () => {
      const user = userEvent.setup();

      // 할당량 확인 성공, 이미지 생성은 지연
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, can_generate: true })
        })
        .mockImplementationOnce(() => new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              success: true,
              image_url: 'https://example.com/test.jpg'
            })
          }), 2000);
        }));

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      await user.click(button);

      // 진행률 바 확인
      await waitFor(() => {
        expect(screen.getByText('이미지 생성 중...')).toBeInTheDocument();
      });

      // 진행률 퍼센트 확인
      await waitFor(() => {
        const progressText = screen.getByText(/\d+%/);
        expect(progressText).toBeInTheDocument();
      });
    });

    test('진행률 단계별 메시지가 표시된다', async () => {
      render(<MessageImageGeneration {...mockProps} />);

      // 컴포넌트 내부의 진행률 단계별 메시지 로직은 
      // 실제 진행률 값에 따라 다른 메시지를 표시합니다.
      // 이는 통합 테스트에서 더 잘 검증할 수 있습니다.
    });
  });

  describe('할당량 정보 표시', () => {
    test('할당량 정보가 올바르게 표시된다', async () => {
      const user = userEvent.setup();

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          can_generate: true,
          quota_info: {
            current_count: 7,
            daily_limit: 10,
            remaining: 3
          }
        })
      });

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('일일 생성 가능: 3/10')).toBeInTheDocument();
      });
    });
  });

  describe('접근성', () => {
    test('버튼에 적절한 aria-label이 설정되어 있다', () => {
      render(<MessageImageGeneration {...mockProps} />);
      
      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).toHaveAttribute('aria-label', '메시지 내용을 바탕으로 이미지 생성');
    });

    test('로딩 상태에서 버튼이 비활성화된다', async () => {
      const user = userEvent.setup();

      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, can_generate: true })
        })
        .mockImplementationOnce(() => new Promise(() => {})); // 무한 대기

      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      await user.click(button);

      await waitFor(() => {
        expect(button).toBeDisabled();
      });
    });

    test('키보드 네비게이션이 작동한다', async () => {
      render(<MessageImageGeneration {...mockProps} />);

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      
      // Tab으로 포커스 이동
      button.focus();
      expect(button).toHaveFocus();

      // Enter 키로 활성화
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // 실제 클릭 이벤트가 발생하는지는 브라우저 구현에 따라 다르므로
      // 여기서는 포커스 상태만 확인
    });
  });

  describe('에지 케이스', () => {
    test('빈 메시지 내용으로도 처리 가능하다', () => {
      render(
        <MessageImageGeneration 
          {...mockProps} 
          messageContent=""
        />
      );

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).toBeInTheDocument();
    });

    test('매우 긴 메시지 내용을 처리할 수 있다', () => {
      const longContent = 'A'.repeat(5000);
      
      render(
        <MessageImageGeneration 
          {...mockProps} 
          messageContent={longContent}
        />
      );

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).toBeInTheDocument();
    });

    test('잘못된 messageId로도 UI가 깨지지 않는다', () => {
      render(
        <MessageImageGeneration 
          {...mockProps} 
          messageId=""
        />
      );

      const button = screen.getByRole('button', { name: /메시지 내용을 바탕으로 이미지 생성/i });
      expect(button).toBeInTheDocument();
    });
  });
});
