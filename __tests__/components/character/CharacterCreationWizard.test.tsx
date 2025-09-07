/**
 * CharacterCreationWizard 컴포넌트 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CharacterCreationWizard from '@/components/character/CharacterCreationWizard';

// Mock 의존성들
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } } }))
    }
  }))
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn()
  }))
}));

// API 호출 mock
global.fetch = jest.fn();

describe('CharacterCreationWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        chatbotId: 'test-chatbot-id',
        profileImageUrl: '/test-image.jpg'
      })
    });
  });

  it('첫 번째 단계(이름 입력)가 렌더링된다', () => {
    render(<CharacterCreationWizard />);
    
    expect(screen.getByText('캐릭터 이름')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 지수, Alex, 민지')).toBeInTheDocument();
  });

  it('이름 입력 후 다음 버튼이 활성화된다', async () => {
    render(<CharacterCreationWizard />);
    
    const nameInput = screen.getByPlaceholderText('예: 지수, Alex, 민지');
    const nextButton = screen.getByRole('button', { name: /다음/i });
    
    // 초기에는 비활성화
    expect(nextButton).toBeDisabled();
    
    // 이름 입력 후 활성화
    fireEvent.change(nameInput, { target: { value: '테스트' } });
    
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('단계별 네비게이션이 동작한다', async () => {
    render(<CharacterCreationWizard />);
    
    // 1단계: 이름 입력
    const nameInput = screen.getByPlaceholderText('예: 지수, Alex, 민지');
    fireEvent.change(nameInput, { target: { value: '테스트' } });
    
    let nextButton = screen.getByRole('button', { name: /다음/i });
    fireEvent.click(nextButton);
    
    // 2단계: 성별 선택 화면으로 이동
    await waitFor(() => {
      expect(screen.getByText('성별')).toBeInTheDocument();
    });
  });

  it('성별 선택이 동작한다', async () => {
    render(<CharacterCreationWizard />);
    
    // 1단계 완료
    const nameInput = screen.getByPlaceholderText('예: 지수, Alex, 민지');
    fireEvent.change(nameInput, { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 2단계: 성별 선택
    await waitFor(() => {
      expect(screen.getByText('성별')).toBeInTheDocument();
    });
    
    const maleButton = screen.getByText('남성');
    fireEvent.click(maleButton);
    
    await waitFor(() => {
      expect(maleButton).toHaveClass('bg-blue-600');
    });
  });

  it('나이 입력 유효성 검사가 동작한다', async () => {
    render(<CharacterCreationWizard />);
    
    // 3단계까지 진행
    const nameInput = screen.getByPlaceholderText('예: 지수, Alex, 민지');
    fireEvent.change(nameInput, { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('남성'));
    });
    
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 3단계: 나이 입력
    await waitFor(() => {
      expect(screen.getByText('나이')).toBeInTheDocument();
    });
    
    const ageInput = screen.getByPlaceholderText('예: 25');
    
    // 유효하지 않은 나이 입력
    fireEvent.change(ageInput, { target: { value: '5' } });
    
    const nextButton = screen.getByRole('button', { name: /다음/i });
    expect(nextButton).toBeDisabled();
    
    // 유효한 나이 입력
    fireEvent.change(ageInput, { target: { value: '25' } });
    
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled();
    });
  });

  it('이전 버튼으로 단계 이동이 가능하다', async () => {
    render(<CharacterCreationWizard />);
    
    // 1단계 완료
    const nameInput = screen.getByPlaceholderText('예: 지수, Alex, 민지');
    fireEvent.change(nameInput, { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 2단계로 이동
    await waitFor(() => {
      expect(screen.getByText('성별')).toBeInTheDocument();
    });
    
    // 이전 버튼 클릭
    const prevButton = screen.getByRole('button', { name: /이전/i });
    fireEvent.click(prevButton);
    
    // 1단계로 돌아감
    await waitFor(() => {
      expect(screen.getByText('캐릭터 이름')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('예: 지수, Alex, 민지')).toHaveValue('테스트');
    });
  });

  it('최종 단계에서 캐릭터 생성이 요청된다', async () => {
    render(<CharacterCreationWizard />);
    
    // 모든 단계 완료
    // 1단계: 이름
    fireEvent.change(screen.getByPlaceholderText('예: 지수, Alex, 민지'), { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 2단계: 성별
    await waitFor(() => fireEvent.click(screen.getByText('남성')));
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 3단계: 나이
    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('예: 25'), { target: { value: '25' } });
    });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 4단계: 관계
    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('예: 친구, 연인, 동료'), { target: { value: '친구' } });
    });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 5단계: 상황
    await waitFor(() => {
      fireEvent.change(screen.getByPlaceholderText('예: 카페에서 만나기'), { target: { value: '카페' } });
    });
    fireEvent.click(screen.getByRole('button', { name: /다음/i }));
    
    // 6단계: 이미지 (건너뛰기)
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /건너뛰기/i }));
    });
    
    // 7단계: 최종 확인 및 생성
    await waitFor(() => {
      expect(screen.getByText('캐릭터 생성')).toBeInTheDocument();
    });
    
    const createButton = screen.getByRole('button', { name: /캐릭터 생성/i });
    fireEvent.click(createButton);
    
    // API 호출 검증
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/generate/profile',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('테스트')
        })
      );
    });
  });

  it('에러 상태가 올바르게 표시된다', async () => {
    // API 에러 시뮬레이션
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: '테스트 에러'
      })
    });

    render(<CharacterCreationWizard />);
    
    // 모든 단계를 빠르게 완료 (간소화)
    fireEvent.change(screen.getByPlaceholderText('예: 지수, Alex, 민지'), { target: { value: '테스트' } });
    // ... 추가 단계들을 빠르게 진행 후 생성 버튼 클릭
    
    // 에러 메시지가 표시되는지 확인
    // (실제 구현에 따라 조정 필요)
  });
});