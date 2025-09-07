/**
 * ChatMessageWithActions 컴포넌트 단위 테스트
 * Task 006: Create Message Image Generation UI Components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatMessageWithActions } from '@/components/chat/ChatMessageWithActions';
import type { ChatMessage } from '@/components/chat/ChatMessageWithActions';

// Mock MessageImageGeneration 컴포넌트
jest.mock('@/components/chat/MessageImageGeneration', () => ({
  MessageImageGeneration: ({ onImageGenerated, messageId }: any) => (
    <button
      data-testid="mock-image-generation"
      onClick={() => onImageGenerated?.('mock-image-url', { quality_score: 0.8 })}
    >
      Generate Image for {messageId}
    </button>
  )
}));

describe('ChatMessageWithActions', () => {
  const createMockMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'msg_123',
    content: '오늘은 정말 행복한 하루였어요! 공원에서 예쁜 꽃들을 많이 봤거든요.',
    role: 'assistant',
    created_at: '2024-01-15T10:30:00Z',
    ...overrides
  });

  describe('메시지 기본 렌더링', () => {
    test('AI 메시지가 올바르게 렌더링된다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText(message.content)).toBeInTheDocument();
      expect(screen.getByText('10:30')).toBeInTheDocument(); // 시간 표시
    });

    test('사용자 메시지가 올바르게 렌더링된다', () => {
      const message = createMockMessage({ role: 'user' });
      render(<ChatMessageWithActions message={message} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText(message.content)).toBeInTheDocument();
    });

    test('메시지 역할에 따라 다른 색상 표시가 적용된다', () => {
      const aiMessage = createMockMessage({ role: 'assistant' });
      const { rerender } = render(<ChatMessageWithActions message={aiMessage} />);

      // AI 메시지는 파란색 점
      const aiIndicator = screen.getByRole('generic', { hidden: true });
      expect(aiIndicator).toHaveClass('bg-blue-500');

      const userMessage = createMockMessage({ role: 'user' });
      rerender(<ChatMessageWithActions message={userMessage} />);

      // 사용자 메시지는 초록색 점
      const userIndicator = screen.getByRole('generic', { hidden: true });
      expect(userIndicator).toHaveClass('bg-green-500');
    });
  });

  describe('호버 액션 표시', () => {
    test('AI 메시지에 마우스 호버 시 액션이 표시된다', async () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} />);

      const messageContainer = screen.getByText(message.content).closest('div')!.parentElement!;

      // 처음에는 액션이 보이지 않음
      expect(screen.queryByTestId('mock-image-generation')).not.toBeInTheDocument();

      // 마우스 호버
      fireEvent.mouseEnter(messageContainer);

      await waitFor(() => {
        expect(screen.getByTestId('mock-image-generation')).toBeInTheDocument();
      });

      // 마우스 떠남
      fireEvent.mouseLeave(messageContainer);

      await waitFor(() => {
        expect(screen.queryByTestId('mock-image-generation')).not.toBeInTheDocument();
      });
    });

    test('사용자 메시지에는 호버해도 액션이 표시되지 않는다', async () => {
      const message = createMockMessage({ role: 'user' });
      render(<ChatMessageWithActions message={message} />);

      const messageContainer = screen.getByText(message.content).closest('div')!.parentElement!;

      // 마우스 호버
      fireEvent.mouseEnter(messageContainer);

      await waitFor(() => {
        expect(screen.queryByTestId('mock-image-generation')).not.toBeInTheDocument();
      });
    });

    test('외부에서 showActions를 true로 설정하면 항상 액션이 표시된다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} showActions={true} />);

      expect(screen.getByTestId('mock-image-generation')).toBeInTheDocument();
    });

    test('외부에서 showActions를 false로 설정하면 호버해도 액션이 표시되지 않는다', async () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} showActions={false} />);

      const messageContainer = screen.getByText(message.content).closest('div')!.parentElement!;

      fireEvent.mouseEnter(messageContainer);

      await waitFor(() => {
        expect(screen.queryByTestId('mock-image-generation')).not.toBeInTheDocument();
      });
    });
  });

  describe('기존 이미지 표시', () => {
    test('기존 이미지가 있으면 표시된다', () => {
      const message = createMockMessage({
        metadata: {
          images: [
            {
              url: 'https://example.com/image1.jpg',
              prompt: { quality_score: 0.9 },
              generated_at: '2024-01-15T10:35:00Z'
            },
            {
              url: 'https://example.com/image2.jpg',
              prompt: { quality_score: 0.8 },
              generated_at: '2024-01-15T10:40:00Z'
            }
          ]
        }
      });

      render(<ChatMessageWithActions message={message} />);

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
      expect(images[0]).toHaveAttribute('src', 'https://example.com/image1.jpg');
      expect(images[1]).toHaveAttribute('src', 'https://example.com/image2.jpg');

      // 품질 점수 표시 확인
      expect(screen.getByText('품질 점수: 0.90')).toBeInTheDocument();
      expect(screen.getByText('품질 점수: 0.80')).toBeInTheDocument();
    });

    test('이미지 로딩 최적화를 위해 lazy loading이 적용된다', () => {
      const message = createMockMessage({
        metadata: {
          images: [{ url: 'https://example.com/image.jpg' }]
        }
      });

      render(<ChatMessageWithActions message={message} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('loading', 'lazy');
    });

    test('이미지에 적절한 alt 텍스트가 설정된다', () => {
      const message = createMockMessage({
        metadata: {
          images: [
            { url: 'https://example.com/image1.jpg' },
            { url: 'https://example.com/image2.jpg' }
          ]
        }
      });

      render(<ChatMessageWithActions message={message} />);

      expect(screen.getByAltText('생성된 이미지 1')).toBeInTheDocument();
      expect(screen.getByAltText('생성된 이미지 2')).toBeInTheDocument();
    });
  });

  describe('이미지 생성 처리', () => {
    test('이미지 생성 성공 시 콜백이 호출된다', async () => {
      const message = createMockMessage();
      const onImageGenerated = jest.fn();

      render(
        <ChatMessageWithActions 
          message={message} 
          onImageGenerated={onImageGenerated}
          showActions={true}
        />
      );

      const generateButton = screen.getByTestId('mock-image-generation');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(onImageGenerated).toHaveBeenCalledWith(
          message.id,
          'mock-image-url',
          { quality_score: 0.8 }
        );
      });
    });

    test('이미지 생성 콜백이 없어도 오류가 발생하지 않는다', async () => {
      const message = createMockMessage();

      render(<ChatMessageWithActions message={message} showActions={true} />);

      const generateButton = screen.getByTestId('mock-image-generation');
      
      expect(() => {
        fireEvent.click(generateButton);
      }).not.toThrow();
    });
  });

  describe('스타일링 및 레이아웃', () => {
    test('메시지 컨테이너에 호버 효과가 적용된다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} />);

      const container = screen.getByText(message.content).closest('.group');
      expect(container).toHaveClass('group', 'relative', 'transition-all', 'duration-200');
    });

    test('커스텀 className이 적용된다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} className="custom-class" />);

      const container = screen.getByText(message.content).closest('.custom-class');
      expect(container).toBeInTheDocument();
    });

    test('메시지 내용에 prose 스타일이 적용된다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} />);

      const contentElement = screen.getByText(message.content);
      expect(contentElement.closest('.prose')).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    test('시간 정보가 올바른 형식으로 표시된다', () => {
      const message = createMockMessage({
        created_at: '2024-01-15T14:30:45Z'
      });

      render(<ChatMessageWithActions message={message} />);

      // 한국 시간 형식으로 표시되는지 확인
      expect(screen.getByText('14:30')).toBeInTheDocument();
    });

    test('메시지 역할이 명확하게 표시된다', () => {
      const aiMessage = createMockMessage({ role: 'assistant' });
      const { rerender } = render(<ChatMessageWithActions message={aiMessage} />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();

      const userMessage = createMockMessage({ role: 'user' });
      rerender(<ChatMessageWithActions message={userMessage} />);

      expect(screen.getByText('You')).toBeInTheDocument();
    });

    test('이미지에 적절한 접근성 속성이 설정된다', () => {
      const message = createMockMessage({
        metadata: {
          images: [{ url: 'https://example.com/image.jpg' }]
        }
      });

      render(<ChatMessageWithActions message={message} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', '생성된 이미지 1');
    });
  });

  describe('에지 케이스', () => {
    test('메타데이터가 null이어도 처리된다', () => {
      const message = createMockMessage({ metadata: null });

      expect(() => {
        render(<ChatMessageWithActions message={message} />);
      }).not.toThrow();

      expect(screen.getByText(message.content)).toBeInTheDocument();
    });

    test('이미지 배열이 비어있어도 처리된다', () => {
      const message = createMockMessage({
        metadata: { images: [] }
      });

      expect(() => {
        render(<ChatMessageWithActions message={message} />);
      }).not.toThrow();

      expect(screen.getByText(message.content)).toBeInTheDocument();
    });

    test('잘못된 날짜 형식도 처리된다', () => {
      const message = createMockMessage({
        created_at: 'invalid-date'
      });

      expect(() => {
        render(<ChatMessageWithActions message={message} />);
      }).not.toThrow();

      expect(screen.getByText(message.content)).toBeInTheDocument();
    });

    test('매우 긴 메시지 내용도 처리된다', () => {
      const longContent = 'A'.repeat(5000);
      const message = createMockMessage({ content: longContent });

      expect(() => {
        render(<ChatMessageWithActions message={message} />);
      }).not.toThrow();

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    test('빈 메시지 내용도 처리된다', () => {
      const message = createMockMessage({ content: '' });

      expect(() => {
        render(<ChatMessageWithActions message={message} />);
      }).not.toThrow();
    });
  });

  describe('반응형 디자인', () => {
    test('이미지가 반응형 스타일을 가진다', () => {
      const message = createMockMessage({
        metadata: {
          images: [{ url: 'https://example.com/image.jpg' }]
        }
      });

      render(<ChatMessageWithActions message={message} />);

      const image = screen.getByRole('img');
      expect(image).toHaveClass('max-w-md', 'w-full', 'h-auto');
    });

    test('메시지 컨테이너가 적절한 패딩을 가진다', () => {
      const message = createMockMessage();
      render(<ChatMessageWithActions message={message} />);

      const container = screen.getByText(message.content).closest('.group');
      expect(container).toHaveClass('px-3', 'py-2', '-mx-3', '-my-2');
    });
  });
});
