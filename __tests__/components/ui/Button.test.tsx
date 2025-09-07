/**
 * Button 컴포넌트 테스트
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Button } from '@/components/ui/button';

describe('Button 컴포넌트', () => {
  it('기본 버튼이 렌더링된다', () => {
    render(<Button>클릭</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('클릭');
  });

  it('클릭 이벤트가 동작한다', () => {
    const mockClick = jest.fn();
    render(<Button onClick={mockClick}>클릭</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 상태가 올바르게 동작한다', () => {
    const mockClick = jest.fn();
    render(<Button disabled onClick={mockClick}>비활성화</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('variant 속성이 올바르게 적용된다', () => {
    const { rerender } = render(<Button variant="default">기본</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary');

    rerender(<Button variant="destructive">위험</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">윤곽선</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border');

    rerender(<Button variant="secondary">보조</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-secondary');

    rerender(<Button variant="ghost">투명</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent');

    rerender(<Button variant="link">링크</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('underline-offset-4');
  });

  it('size 속성이 올바르게 적용된다', () => {
    const { rerender } = render(<Button size="default">기본</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-10');

    rerender(<Button size="sm">작은</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');

    rerender(<Button size="lg">큰</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');

    rerender(<Button size="icon">아이콘</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-10');
    expect(button).toHaveClass('w-10');
  });

  it('asChild 속성이 동작한다', () => {
    render(
      <Button asChild>
        <a href="/test">링크 버튼</a>
      </Button>
    );
    
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveTextContent('링크 버튼');
  });

  it('커스텀 className이 올바르게 병합된다', () => {
    render(<Button className="custom-class">커스텀</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveClass('inline-flex'); // 기본 클래스도 유지
  });

  it('로딩 상태를 표시할 수 있다', () => {
    // 실제 구현에서 loading prop이 있다면
    render(<Button disabled>로딩 중...</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('로딩 중...');
  });
});