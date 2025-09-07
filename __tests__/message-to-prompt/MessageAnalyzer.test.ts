/**
 * MessageAnalyzer 단위 테스트
 * Task 001 - 키워드 추출 로직 검증
 */

import { MessageAnalyzerImpl } from '@/lib/services/message-to-prompt/MessageAnalyzer';
import type { MessageContext, ExtractedKeywords } from '@/lib/services/message-to-prompt/types';
import { MessageToPromptError, ERROR_CODES } from '@/lib/services/message-to-prompt/types';

// Mock Claude API
jest.mock('@/lib/claude', () => ({
  ClaudeClient: jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn()
  }))
}));

describe('MessageAnalyzer', () => {
  let analyzer: MessageAnalyzerImpl;
  let mockClaudeClient: any;

  beforeEach(() => {
    analyzer = new MessageAnalyzerImpl();
    // Claude client mock 접근
    mockClaudeClient = (analyzer as any).claudeClient;
    
    // 기본 성공 응답 설정
    mockClaudeClient.generateResponse.mockResolvedValue(JSON.stringify({
      emotions: ['행복한', '즐거운'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['자연스러운'],
      confidence: 0.85,
      raw_analysis: '테스트 분석'
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    analyzer.clearCache();
  });

  describe('analyzeMessage', () => {
    const createTestContext = (content: string): MessageContext => ({
      message_id: 'test_123',
      session_id: 'session_456',
      message_content: content,
      previous_messages: [],
      user_preferences: {},
      chatbot_info: {}
    });

    test('기본 키워드 추출이 성공적으로 작동한다', async () => {
      const context = createTestContext('행복한 고양이가 공원에서 놀고 있어요');
      
      const result = await analyzer.analyzeMessage(context);
      
      expect(result).toMatchObject({
        emotions: expect.arrayContaining(['행복한']),
        situations: expect.arrayContaining(['공원에서']),
        actions: expect.arrayContaining(['놀고있는']),
        objects: expect.arrayContaining(['고양이']),
        style: expect.any(Array),
        confidence: expect.any(Number)
      });
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('다양한 감정 키워드를 정확히 추출한다', async () => {
      // 다양한 감정을 포함한 테스트 케이스들
      const emotionTests = [
        { content: '슬픈 이야기를 들었어요', expected: ['슬픈'] },
        { content: '로맨틱한 영화를 봤어요', expected: ['로맨틱한'] },
        { content: '신비로운 분위기였어요', expected: ['신비로운'] }
      ];

      for (const testCase of emotionTests) {
        mockClaudeClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
          emotions: testCase.expected,
          situations: [],
          actions: [],
          objects: [],
          style: [],
          confidence: 0.8,
          raw_analysis: '감정 테스트'
        }));

        const context = createTestContext(testCase.content);
        const result = await analyzer.analyzeMessage(context);
        
        expect(result.emotions).toEqual(expect.arrayContaining(testCase.expected));
      }
    });

    test('컨텍스트 정보가 포함된 분석 요청을 생성한다', async () => {
      const context: MessageContext = {
        message_id: 'test_123',
        session_id: 'session_456',
        message_content: '오늘 기분이 좋아요',
        previous_messages: [
          { role: 'user', content: '안녕', timestamp: '2024-01-01' },
          { role: 'assistant', content: '안녕하세요', timestamp: '2024-01-01' }
        ],
        user_preferences: {
          preferred_style: '수채화'
        },
        chatbot_info: {
          personality: '친근한',
          relationship_type: '친구'
        }
      };

      await analyzer.analyzeMessage(context);

      expect(mockClaudeClient.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('키워드를 추출하는 전문가'),
        expect.stringContaining('오늘 기분이 좋아요'),
        expect.objectContaining({
          maxTokens: 500,
          temperature: 0.3
        })
      );
    });

    test('캐시가 올바르게 작동한다', async () => {
      const context = createTestContext('테스트 메시지');
      
      // 첫 번째 호출
      await analyzer.analyzeMessage(context);
      expect(mockClaudeClient.generateResponse).toHaveBeenCalledTimes(1);
      
      // 두 번째 호출 (캐시 사용)
      await analyzer.analyzeMessage(context);
      expect(mockClaudeClient.generateResponse).toHaveBeenCalledTimes(1); // 여전히 1번만
    });

    test('Claude API 오류 시 적절한 에러를 발생시킨다', async () => {
      mockClaudeClient.generateResponse.mockRejectedValueOnce(
        new Error('RATE_LIMIT_EXCEEDED')
      );

      const context = createTestContext('테스트 메시지');
      
      await expect(analyzer.analyzeMessage(context)).rejects.toThrow(
        expect.objectContaining({
          code: 'CLAUDE_API_ERROR'
        })
      );
    });

    test('잘못된 JSON 응답에 대해 폴백을 제공한다', async () => {
      mockClaudeClient.generateResponse.mockResolvedValueOnce('잘못된 JSON');

      const context = createTestContext('행복한 하루입니다');
      const result = await analyzer.analyzeMessage(context);
      
      // 폴백 키워드가 생성되어야 함
      expect(result).toMatchObject({
        emotions: expect.any(Array),
        situations: expect.any(Array),
        actions: expect.any(Array),
        objects: expect.any(Array),
        style: expect.any(Array),
        confidence: expect.any(Number)
      });
      
      expect(result.confidence).toBeLessThan(0.5); // 폴백은 낮은 신뢰도
    });
  });

  describe('extractKeywords', () => {
    test('단순 키워드 추출이 작동한다', async () => {
      const result = await analyzer.extractKeywords('행복한 고양이');
      
      expect(result).toMatchObject({
        emotions: expect.any(Array),
        situations: expect.any(Array),
        actions: expect.any(Array),
        objects: expect.any(Array),
        style: expect.any(Array),
        confidence: expect.any(Number)
      });
    });

    test('부분 컨텍스트로도 작동한다', async () => {
      const partialContext = {
        message_id: 'test_123',
        user_preferences: {
          preferred_style: '애니메이션'
        }
      };

      const result = await analyzer.extractKeywords('귀여운 강아지', partialContext);
      
      expect(result).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });
  });

  describe('validateExtraction', () => {
    test('유효한 키워드 객체를 올바르게 검증한다', () => {
      const validKeywords: ExtractedKeywords = {
        emotions: ['행복한'],
        situations: ['공원에서'],
        actions: ['놀고있는'],
        objects: ['고양이'],
        style: ['자연스러운'],
        confidence: 0.8,
        raw_analysis: '유효한 분석'
      };

      expect(analyzer.validateExtraction(validKeywords)).toBe(true);
    });

    test('잘못된 구조의 키워드 객체를 거부한다', () => {
      const invalidKeywords = {
        emotions: 'not_array', // 배열이 아님
        situations: [],
        actions: [],
        objects: [],
        style: [],
        confidence: 0.8,
        raw_analysis: '잘못된 구조'
      } as any;

      expect(analyzer.validateExtraction(invalidKeywords)).toBe(false);
    });

    test('범위를 벗어난 신뢰도를 거부한다', () => {
      const invalidConfidence = {
        emotions: [],
        situations: [],
        actions: [],
        objects: [],
        style: [],
        confidence: 1.5, // 1.0 초과
        raw_analysis: '잘못된 신뢰도'
      } as ExtractedKeywords;

      expect(analyzer.validateExtraction(invalidConfidence)).toBe(false);
    });

    test('키워드가 전혀 없는 경우를 거부한다', () => {
      const noKeywords: ExtractedKeywords = {
        emotions: [],
        situations: [],
        actions: [],
        objects: [],
        style: [],
        confidence: 0.8,
        raw_analysis: '키워드 없음'
      };

      expect(analyzer.validateExtraction(noKeywords)).toBe(false);
    });
  });

  describe('statistics and caching', () => {
    const createTestContext = (content: string): MessageContext => ({
      message_id: 'test_123',
      session_id: 'session_456',
      message_content: content,
      previous_messages: [],
      user_preferences: {},
      chatbot_info: {}
    });

    test('통계가 올바르게 수집된다', async () => {
      const context = createTestContext('테스트 메시지 1');
      await analyzer.analyzeMessage(context);

      const stats = analyzer.getStats();
      
      expect(stats).toMatchObject({
        total_analyses: expect.any(Number),
        success_count: expect.any(Number),
        cache_hits: expect.any(Number),
        cache_size: expect.any(Number),
        cache_hit_rate: expect.any(Number)
      });
      
      expect(stats.total_analyses).toBeGreaterThan(0);
    });

    test('캐시 정리가 올바르게 작동한다', async () => {
      const context = createTestContext('테스트 메시지');
      await analyzer.analyzeMessage(context);
      
      let stats = analyzer.getStats();
      expect(stats.cache_size).toBeGreaterThan(0);
      
      analyzer.clearCache();
      
      stats = analyzer.getStats();
      expect(stats.cache_size).toBe(0);
    });
  });

  describe('error handling', () => {
    const createTestContext = (content: string): MessageContext => ({
      message_id: 'test_123',
      session_id: 'session_456',
      message_content: content,
      previous_messages: [],
      user_preferences: {},
      chatbot_info: {}
    });
    test('타임아웃 에러를 올바르게 처리한다', async () => {
      const timeoutError = new Error('TIMEOUT');
      timeoutError.name = 'AbortError';
      mockClaudeClient.generateResponse.mockRejectedValueOnce(timeoutError);

      const context = createTestContext('테스트 메시지');
      
      await expect(analyzer.analyzeMessage(context)).rejects.toThrow(
        expect.objectContaining({
          code: 'TIMEOUT'
        })
      );
    });

    test('네트워크 에러를 올바르게 처리한다', async () => {
      mockClaudeClient.generateResponse.mockRejectedValueOnce(
        new TypeError('Network error')
      );

      const context = createTestContext('테스트 메시지');
      
      await expect(analyzer.analyzeMessage(context)).rejects.toThrow(
        expect.objectContaining({
          code: 'KEYWORD_EXTRACTION_FAILED'
        })
      );
    });
  });

  describe('integration scenarios', () => {
    const createTestContext = (content: string): MessageContext => ({
      message_id: 'test_123',
      session_id: 'session_456',
      message_content: content,
      previous_messages: [],
      user_preferences: {},
      chatbot_info: {}
    });
    test('복잡한 메시지에 대해 전체 플로우가 작동한다', async () => {
      const complexMessage = '오늘 카페에서 친구와 맛있는 커피를 마시며 ' +
                           '행복한 시간을 보냈어요. 창밖으로 보이는 ' +
                           '아름다운 정원의 꽃들이 정말 예뻤답니다.';
      
      mockClaudeClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        emotions: ['행복한', '아름다운'],
        situations: ['카페에서', '정원에서'],
        actions: ['마시며', '보냈어요'],
        objects: ['커피', '꽃들', '친구'],
        style: ['자연스러운', '따뜻한'],
        confidence: 0.92,
        raw_analysis: '상세한 복합 감정 및 상황 분석'
      }));

      const context = createTestContext(complexMessage);
      const result = await analyzer.analyzeMessage(context);
      
      expect(result.emotions.length).toBeGreaterThan(0);
      expect(result.situations.length).toBeGreaterThan(0);
      expect(result.objects.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('짧은 메시지도 적절히 처리한다', async () => {
      mockClaudeClient.generateResponse.mockResolvedValueOnce(JSON.stringify({
        emotions: ['행복한'],
        situations: [],
        actions: ['웃음'],
        objects: [],
        style: ['단순한'],
        confidence: 0.6,
        raw_analysis: '간단한 감정 표현'
      }));

      const context = createTestContext('ㅎㅎ 좋아요!');
      const result = await analyzer.analyzeMessage(context);
      
      expect(result).toBeDefined();
      expect(result.emotions.length).toBeGreaterThan(0);
    });
  });
});
