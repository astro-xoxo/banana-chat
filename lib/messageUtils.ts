/**
 * 한국어 텍스트를 문단 단위로 분할하는 유틸리티
 * Claude API 응답을 문단별 버블로 표시하기 위한 전용 유틸리티
 * Phase 4-8: 문장별 분할에서 문단별 분할로 변경
 */

export interface SentenceSplitOptions {
  minLength?: number;          // 최소 문단 길이 (기본: 3)
  maxLength?: number;          // 최대 문단 길이 (기본: 500)
  preserveQuotes?: boolean;    // 따옴표 내부 보호 (기본: true)
  mergeShort?: boolean;        // 짧은 문단 병합 (기본: false - 문단은 병합하지 않음)
}

/**
 * 한국어 텍스트를 문단 단위로 분할
 * Phase 4-8: \n\n 기준으로 문단 분할, 문단 내 \n은 줄바꿈으로 보존
 * @param text 분할할 텍스트
 * @param options 분할 옵션 (호환성을 위해 유지하지만 대부분 사용 안함)
 * @returns 분할된 문단 배열
 */
export function splitIntoSentences(
  text: string, 
  options: SentenceSplitOptions = {}
): string[] {
  // 빈 텍스트 처리
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Phase 4-8: 문단별 분할 로직 (단순화)
  // 1. \n\n (또는 여러 개의 연속된 줄바꿈) 기준으로 문단 분할
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  
  // 2. 각 문단의 앞뒤 공백 제거하되, 문단 내 \n은 보존
  const cleanParagraphs = paragraphs.map(paragraph => {
    return paragraph.trim(); // 앞뒤 공백만 제거, 내부 \n은 보존
  });

  // 3. 빈 문단 제거
  const validParagraphs = cleanParagraphs.filter(paragraph => paragraph.length > 0);

  console.log('📝 Phase 4-8: 문단별 분할 결과:', {
    originalText: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
    totalParagraphs: validParagraphs.length,
    paragraphs: validParagraphs.map((p, i) => ({
      index: i,
      preview: p.substring(0, 50) + (p.length > 50 ? '...' : ''),
      hasNewlines: p.includes('\n')
    }))
  });

  return validParagraphs;
}

/**
 * 분할된 문단들의 유효성 검증 및 정리
 * Phase 4-8: 문단별 분할에 맞게 단순화
 */
export function validateSentences(sentences: string[]): string[] {
  return sentences
    .map(sentence => sentence.trim())
    .filter(sentence => {
      // 빈 문단 제거
      if (sentence.length === 0) return false;
      
      // 유효한 문단
      return true;
    });
}

/**
 * 문단의 예상 읽기 시간 계산 (밀리초 단위)
 * 한국어 기준 약 200자/분 = 3.33자/초
 * Phase 4-8: 문단은 문장보다 길므로 읽기 시간 조정
 */
export function estimateReadingTime(sentence: string): number {
  const charactersPerSecond = 3.33;
  const characters = sentence.length;
  const secondsToRead = characters / charactersPerSecond;
  
  // 최소 1초, 최대 8초 (문단이므로 최대값 증가)
  const clampedSeconds = Math.max(1, Math.min(8, secondsToRead));
  
  return Math.round(clampedSeconds * 1000);
}

/**
 * 문단별 표시 속도 계산 (고정값 0.8초 사용)
 * Phase 4-8: 기존과 동일한 속도 유지
 */
export const SENTENCE_DISPLAY_SPEED = 800; // ms (고정값)

/**
 * 문단 분할 기능 활성화 여부 (항상 활성화)
 */
export const ENABLE_SENTENCE_SPLIT = true;

/**
 * 테스트용 문단 분할 함수
 * Phase 4-8: 문단 분할 테스트에 맞게 수정
 */
export function testSentenceSplit(testCases: string[]): void {
  console.log('=== Phase 4-8: 문단 분할 테스트 시작 ===');
  
  testCases.forEach((text, index) => {
    console.log(`\n테스트 케이스 ${index + 1}:`);
    console.log(`원문: "${text}"`);
    
    const paragraphs = splitIntoSentences(text);
    console.log(`분할 결과 (${paragraphs.length}개 문단):`);
    
    paragraphs.forEach((paragraph, paragraphIndex) => {
      console.log(`  ${paragraphIndex + 1}. "${paragraph}"`);
      if (paragraph.includes('\n')) {
        console.log(`     ↳ 내부 줄바꿈 ${paragraph.split('\n').length - 1}개 포함`);
      }
    });
  });
  
  console.log('\n=== Phase 4-8: 문단 분할 테스트 완료 ===');
}

// Phase 4-8: 기존 복잡한 함수들은 제거하고 단순화된 구조로 변경
// 호환성을 위해 함수명과 인터페이스는 그대로 유지
