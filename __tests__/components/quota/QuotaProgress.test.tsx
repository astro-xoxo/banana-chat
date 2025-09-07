/**
 * QuotaProgress 컴포넌트 테스트
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuotaProgress from '@/components/quota/QuotaProgress';

describe('QuotaProgress 컴포넌트', () => {
  // 실제 컴포넌트 props에 맞게 수정
  const mockProps = {
    percentage: 30, // 30%
    isExhausted: false,
    colorClass: 'bg-blue-500',
    height: 'md' as const,
    animated: true
  };

  it('기본 진행률 바가 렌더링된다', () => {
    render(<QuotaProgress {...mockProps} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('진행률 바가 올바르게 표시된다', () => {
    render(<QuotaProgress quota={mockQuota} />);
    
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(2);
    
    // 프로필 이미지 진행률: 3/10 = 30%
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '30');
    
    // 채팅 이미지 진행률: 5/20 = 25%
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '25');
  });

  it('할당량 초과 상태가 표시된다', () => {
    const overQuota = {
      ...mockQuota,
      profile_image_generation_used: 15, // 한도 초과
      profile_image_generation_limit: 10
    };
    
    render(<QuotaProgress quota={overQuota} />);
    
    expect(screen.getByText('15 / 10')).toBeInTheDocument();
    
    const progressBar = screen.getAllByRole('progressbar')[0];
    expect(progressBar).toHaveAttribute('aria-valuenow', '100'); // 최대값으로 제한
  });

  it('할당량이 0일 때 올바르게 표시된다', () => {
    const zeroQuota = {
      ...mockQuota,
      profile_image_generation_used: 0,
      chat_image_generation_used: 0
    };
    
    render(<QuotaProgress quota={zeroQuota} />);
    
    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(screen.getByText('0 / 20')).toBeInTheDocument();
    
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '0');
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '0');
  });

  it('할당량 상태에 따라 적절한 색상이 적용된다', () => {
    render(<QuotaProgress quota={mockQuota} />);
    
    const progressElements = document.querySelectorAll('[data-testid^="quota-progress"]');
    
    // 30% 사용 (낮음) - 초록색 계열
    expect(progressElements[0]).toHaveClass('bg-green-500');
    
    // 25% 사용 (낮음) - 초록색 계열  
    expect(progressElements[1]).toHaveClass('bg-green-500');
  });

  it('높은 사용률에서 경고 색상이 적용된다', () => {
    const highUsageQuota = {
      ...mockQuota,
      profile_image_generation_used: 8, // 80% 사용
      chat_image_generation_used: 16    // 80% 사용
    };
    
    render(<QuotaProgress quota={highUsageQuota} />);
    
    const progressElements = document.querySelectorAll('[data-testid^="quota-progress"]');
    
    // 80% 사용 - 주황색 계열
    expect(progressElements[0]).toHaveClass('bg-orange-500');
    expect(progressElements[1]).toHaveClass('bg-orange-500');
  });

  it('할당량 소진 시 빨간색이 적용된다', () => {
    const depletedQuota = {
      ...mockQuota,
      profile_image_generation_used: 10, // 100% 사용
      chat_image_generation_used: 20     // 100% 사용
    };
    
    render(<QuotaProgress quota={depletedQuota} />);
    
    const progressElements = document.querySelectorAll('[data-testid^="quota-progress"]');
    
    // 100% 사용 - 빨간색 계열
    expect(progressElements[0]).toHaveClass('bg-red-500');
    expect(progressElements[1]).toHaveClass('bg-red-500');
  });

  it('접근성 속성이 올바르게 설정된다', () => {
    render(<QuotaProgress quota={mockQuota} />);
    
    const progressBars = screen.getAllByRole('progressbar');
    
    // 프로필 이미지 진행률
    expect(progressBars[0]).toHaveAttribute('aria-valuemin', '0');
    expect(progressBars[0]).toHaveAttribute('aria-valuemax', '100');
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '30');
    expect(progressBars[0]).toHaveAttribute('aria-label', expect.stringContaining('프로필'));
    
    // 채팅 이미지 진행률
    expect(progressBars[1]).toHaveAttribute('aria-valuemin', '0');
    expect(progressBars[1]).toHaveAttribute('aria-valuemax', '100');
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '25');
    expect(progressBars[1]).toHaveAttribute('aria-label', expect.stringContaining('채팅'));
  });
});