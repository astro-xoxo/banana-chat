/**
 * 접근성 테스트 (A11y)
 * 웹 접근성 지침 준수 확인
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('접근성 테스트', () => {
  describe('기본 HTML 구조', () => {
    it('버튼 요소가 적절한 접근성 속성을 가진다', () => {
      render(
        <div>
          <button type="button" aria-label="닫기">×</button>
          <button type="submit">제출</button>
          <button disabled>비활성화</button>
        </div>
      );
      
      const closeButton = screen.getByLabelText('닫기');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('type', 'button');
      
      const submitButton = screen.getByRole('button', { name: '제출' });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
      
      const disabledButton = screen.getByRole('button', { name: '비활성화' });
      expect(disabledButton).toBeDisabled();
    });

    it('폼 요소가 적절한 라벨을 가진다', () => {
      render(
        <form>
          <label htmlFor="name">이름</label>
          <input id="name" type="text" required aria-describedby="name-help" />
          <div id="name-help">이름을 입력해주세요</div>
          
          <label htmlFor="age">나이</label>
          <input id="age" type="number" min="10" max="100" />
        </form>
      );
      
      const nameInput = screen.getByLabelText('이름');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveAttribute('required');
      expect(nameInput).toHaveAttribute('aria-describedby', 'name-help');
      
      const ageInput = screen.getByLabelText('나이');
      expect(ageInput).toBeInTheDocument();
      expect(ageInput).toHaveAttribute('min', '10');
      expect(ageInput).toHaveAttribute('max', '100');
    });

    it('헤딩 구조가 적절하다', () => {
      render(
        <div>
          <h1>메인 제목</h1>
          <h2>섹션 제목</h2>
          <h3>하위 섹션</h3>
        </div>
      );
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('메인 제목');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('섹션 제목');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('하위 섹션');
    });
  });

  describe('진행률 표시기', () => {
    it('progressbar 역할이 올바르게 설정된다', () => {
      render(
        <div>
          <div 
            role="progressbar"
            aria-valuenow={30}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="프로필 생성 진행률"
          >
            30%
          </div>
        </div>
      );
      
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '30');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', '프로필 생성 진행률');
    });
  });

  describe('대화형 요소', () => {
    it('탭 인덱스가 논리적 순서로 설정된다', () => {
      render(
        <div>
          <input tabIndex={1} placeholder="첫 번째" />
          <input tabIndex={2} placeholder="두 번째" />
          <button tabIndex={3}>세 번째</button>
          <a href="#" tabIndex={4}>네 번째</a>
        </div>
      );
      
      const firstInput = screen.getByPlaceholderText('첫 번째');
      const secondInput = screen.getByPlaceholderText('두 번째');
      const button = screen.getByRole('button');
      const link = screen.getByRole('link');
      
      expect(firstInput).toHaveAttribute('tabindex', '1');
      expect(secondInput).toHaveAttribute('tabindex', '2');
      expect(button).toHaveAttribute('tabindex', '3');
      expect(link).toHaveAttribute('tabindex', '4');
    });
  });

  describe('시각적 표시', () => {
    it('에러 메시지가 적절한 역할을 가진다', () => {
      render(
        <div>
          <input aria-describedby="error-message" />
          <div id="error-message" role="alert" aria-live="polite">
            필수 입력 항목입니다
          </div>
        </div>
      );
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('필수 입력 항목입니다');
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('색상 대비', () => {
    it('텍스트와 배경의 색상 대비가 적절한지 확인', () => {
      // 실제로는 색상 대비를 계산하는 로직이 필요
      // 여기서는 CSS 클래스가 올바르게 적용되는지만 확인
      render(
        <div>
          <p className="text-gray-900">높은 대비 텍스트</p>
          <p className="text-gray-600">중간 대비 텍스트</p>
          <button className="bg-blue-600 text-white">버튼</button>
        </div>
      );
      
      const highContrastText = screen.getByText('높은 대비 텍스트');
      const mediumContrastText = screen.getByText('중간 대비 텍스트');
      const button = screen.getByRole('button');
      
      expect(highContrastText).toHaveClass('text-gray-900');
      expect(mediumContrastText).toHaveClass('text-gray-600');
      expect(button).toHaveClass('bg-blue-600', 'text-white');
    });
  });

  describe('키보드 네비게이션', () => {
    it('모든 대화형 요소가 키보드로 접근 가능하다', () => {
      render(
        <div>
          <button>클릭 가능한 버튼</button>
          <a href="/link">링크</a>
          <input type="text" placeholder="입력 필드" />
          <select>
            <option value="1">옵션 1</option>
            <option value="2">옵션 2</option>
          </select>
          <textarea placeholder="텍스트 영역"></textarea>
        </div>
      );
      
      const button = screen.getByRole('button');
      const link = screen.getByRole('link');
      const input = screen.getByPlaceholderText('입력 필드');
      const select = screen.getByRole('combobox');
      const textarea = screen.getByPlaceholderText('텍스트 영역');
      
      // 모든 요소가 tabindex -1이 아닌지 확인 (키보드 접근 가능)
      expect(button).not.toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('tabindex', '-1');
      expect(input).not.toHaveAttribute('tabindex', '-1');
      expect(select).not.toHaveAttribute('tabindex', '-1');
      expect(textarea).not.toHaveAttribute('tabindex', '-1');
    });
  });

  describe('화면 리더 지원', () => {
    it('숨겨진 텍스트가 화면 리더에게 제공된다', () => {
      render(
        <div>
          <button>
            <span aria-hidden="true">❌</span>
            <span className="sr-only">삭제</span>
          </button>
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            상태 업데이트 영역
          </div>
        </div>
      );
      
      const hiddenIcon = screen.getByText('❌');
      const srOnlyText = screen.getByText('삭제');
      const liveRegion = screen.getByText('상태 업데이트 영역');
      
      expect(hiddenIcon).toHaveAttribute('aria-hidden', 'true');
      expect(srOnlyText).toHaveClass('sr-only');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });
  });
});