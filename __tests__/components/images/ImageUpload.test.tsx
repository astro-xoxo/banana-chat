/**
 * ImageUpload 컴포넌트 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUpload from '@/components/images/ImageUpload';

// FileReader mock
const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: null,
  onload: null,
  onerror: null
};

(global as any).FileReader = jest.fn(() => mockFileReader);

describe('ImageUpload 컴포넌트', () => {
  const mockOnImageSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileReader.result = null;
  });

  it('이미지 업로드 영역이 렌더링된다', () => {
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    expect(screen.getByText('이미지 업로드')).toBeInTheDocument();
    expect(screen.getByText(/클릭하여 이미지를 선택하세요/)).toBeInTheDocument();
  });

  it('드래그 앤 드롭 영역이 표시된다', () => {
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const dropzone = screen.getByRole('button');
    expect(dropzone).toHaveAttribute('aria-label', expect.stringContaining('이미지 업로드'));
  });

  it('파일 선택 시 유효성 검사가 수행된다', async () => {
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    
    // 유효하지 않은 파일 타입
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText(/지원되지 않는 파일 형식입니다/)).toBeInTheDocument();
    });
  });

  it('유효한 이미지 파일 선택 시 미리보기가 표시된다', async () => {
    const mockDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    // FileReader 시뮬레이션
    mockFileReader.result = mockDataURL;
    
    fireEvent.change(fileInput);
    
    // FileReader onload 호출
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockDataURL } } as any);
    }
    
    await waitFor(() => {
      const previewImage = screen.getByAltText('업로드된 이미지 미리보기');
      expect(previewImage).toBeInTheDocument();
      expect(previewImage).toHaveAttribute('src', mockDataURL);
    });
    
    expect(mockOnImageSelect).toHaveBeenCalledWith(validFile, mockDataURL);
  });

  it('파일 크기 제한이 적용된다', async () => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    render(<ImageUpload onImageSelect={mockOnImageSelect} maxSize={maxSize} />);
    
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    
    // 큰 파일 (10MB 시뮬레이션)
    const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText(/파일 크기가 너무 큽니다/)).toBeInTheDocument();
    });
    
    expect(mockOnImageSelect).not.toHaveBeenCalled();
  });

  it('이미지 삭제 기능이 동작한다', async () => {
    const mockDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    // 이미지 업로드
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [validFile],
      writable: false,
    });
    
    mockFileReader.result = mockDataURL;
    fireEvent.change(fileInput);
    
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockDataURL } } as any);
    }
    
    await waitFor(() => {
      expect(screen.getByAltText('업로드된 이미지 미리보기')).toBeInTheDocument();
    });
    
    // 삭제 버튼 클릭
    const deleteButton = screen.getByRole('button', { name: /이미지 삭제/i });
    fireEvent.click(deleteButton);
    
    await waitFor(() => {
      expect(screen.queryByAltText('업로드된 이미지 미리보기')).not.toBeInTheDocument();
      expect(screen.getByText('이미지 업로드')).toBeInTheDocument();
    });
    
    expect(mockOnImageSelect).toHaveBeenCalledWith(null, null);
  });

  it('드래그 오버 상태가 올바르게 표시된다', () => {
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const dropzone = screen.getByRole('button');
    
    // 드래그 엔터
    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveClass('border-blue-500');
    
    // 드래그 리브
    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass('border-blue-500');
  });

  it('드롭 이벤트가 올바르게 처리된다', async () => {
    const mockDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const dropzone = screen.getByRole('button');
    const validFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    
    mockFileReader.result = mockDataURL;
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [validFile]
      }
    });
    
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result: mockDataURL } } as any);
    }
    
    await waitFor(() => {
      expect(mockOnImageSelect).toHaveBeenCalledWith(validFile, mockDataURL);
    });
  });

  it('에러 메시지가 자동으로 사라진다', async () => {
    render(<ImageUpload onImageSelect={mockOnImageSelect} />);
    
    const fileInput = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      writable: false,
    });
    
    fireEvent.change(fileInput);
    
    await waitFor(() => {
      expect(screen.getByText(/지원되지 않는 파일 형식입니다/)).toBeInTheDocument();
    });
    
    // 3초 후 에러 메시지가 사라져야 함
    await waitFor(() => {
      expect(screen.queryByText(/지원되지 않는 파일 형식입니다/)).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });
});