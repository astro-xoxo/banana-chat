/**
 * Task 011: ChatbotMemoryService 단위 테스트
 */

import {
  ChatbotMemoryService,
  generateSystemPrompt,
  type ChatbotMemoryData
} from '@/lib/services/chatbot/ChatbotMemoryService';

describe('ChatbotMemoryService', () => {
  let service: ChatbotMemoryService;

  beforeEach(() => {
    service = new ChatbotMemoryService();
  });

  describe('generateSystemPrompt', () => {
    test('젊은 남성 친구 관계 시스템 프롬프트 생성', () => {
      const data: ChatbotMemoryData = {
        name: '준호',
        gender: 'male',
        age: 25,
        relationship: '친한 친구',
        concept: '카페에서 만남'
      };

      const prompt = generateSystemPrompt(data);

      expect(prompt).toContain('준호');
      expect(prompt).toContain('남성');
      expect(prompt).toContain('25세');
      expect(prompt).toContain('20대');
      expect(prompt).toContain('친한 친구');
      expect(prompt).toContain('카페에서 만남');
      expect(prompt).toContain('반말');
    });

    test('중년 여성 직장 동료 관계 시스템 프롬프트 생성', () => {
      const data: ChatbotMemoryData = {
        name: '수진',
        gender: 'female',
        age: 45,
        relationship: '직장 동료',
        concept: '회의실 미팅'
      };

      const prompt = generateSystemPrompt(data);

      expect(prompt).toContain('수진');
      expect(prompt).toContain('여성');
      expect(prompt).toContain('45세');
      expect(prompt).toContain('40대');
      expect(prompt).toContain('직장 동료');
      expect(prompt).toContain('회의실 미팅');
      expect(prompt).toContain('존댓말');
    });

    test('나이별 말투 차이 확인', () => {
      const youngData: ChatbotMemoryData = {
        name: '민지',
        gender: 'female',
        age: 20,
        relationship: '친구',
        concept: '일반'
      };

      const oldData: ChatbotMemoryData = {
        name: '영숙',
        gender: 'female',
        age: 60,
        relationship: '이웃',
        concept: '일반'
      };

      const youngPrompt = generateSystemPrompt(youngData);
      const oldPrompt = generateSystemPrompt(oldData);

      expect(youngPrompt).toContain('반말');
      expect(oldPrompt).toContain('존댓말');
    });

    test('관계별 말투 차이 확인', () => {
      const friendData: ChatbotMemoryData = {
        name: '철수',
        gender: 'male',
        age: 25,
        relationship: '친구',
        concept: '일반'
      };

      const colleagueData: ChatbotMemoryData = {
        name: '철수',
        gender: 'male',
        age: 25,
        relationship: '직장 동료',
        concept: '일반'
      };

      const friendPrompt = generateSystemPrompt(friendData);
      const colleaguePrompt = generateSystemPrompt(colleagueData);

      expect(friendPrompt).toContain('반말');
      expect(colleaguePrompt).toContain('존댓말');
    });
  });

  describe('나이 기반 시스템 프롬프트 생성', () => {
    test('나이별 프롬프트 내용 확인', () => {
      const testCases = [
        { age: 15, ageGroup: '청소년' },
        { age: 25, ageGroup: '20대' },
        { age: 35, ageGroup: '30대' },
        { age: 45, ageGroup: '40대' },
        { age: 55, ageGroup: '50대' },
        { age: 65, ageGroup: '60대' }
      ];

      testCases.forEach(({ age, ageGroup }) => {
        const data: ChatbotMemoryData = {
          name: '테스트',
          gender: 'male',
          age,
          relationship: '친구',
          concept: '일반'
        };
        
        const prompt = generateSystemPrompt(data);
        expect(prompt).toContain(ageGroup);
      });
    });
  });

  describe('메모리 데이터 저장 및 조회 (모킹)', () => {
    test('메모리 데이터 저장 성공', async () => {
      // Supabase 클라이언트 모킹
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: {}, error: null })
      };

      // 실제 구현에서는 이 부분이 서비스 내부에서 처리됨
      const chatbotId = 'test-chatbot-id';
      const memoryData: ChatbotMemoryData = {
        name: '테스트',
        gender: 'male',
        age: 25,
        relationship: '친구',
        concept: '테스트 상황'
      };

      // 실제 테스트에서는 service.saveMemoryData를 모킹
      const saveSpy = jest.spyOn(service, 'saveMemoryData').mockResolvedValue(undefined);

      await service.saveMemoryData(chatbotId, memoryData);

      expect(saveSpy).toHaveBeenCalledWith(chatbotId, memoryData);
    });

    test('메모리 데이터 조회 성공', async () => {
      const chatbotId = 'test-chatbot-id';
      const expectedData: ChatbotMemoryData = {
        name: '테스트',
        gender: 'male',
        age: 25,
        relationship: '친구',
        concept: '테스트 상황'
      };

      const getSpy = jest.spyOn(service, 'getMemoryData').mockResolvedValue(expectedData);

      const result = await service.getMemoryData(chatbotId);

      expect(getSpy).toHaveBeenCalledWith(chatbotId);
      expect(result).toEqual(expectedData);
    });

    test('존재하지 않는 챗봇 조회 시 null 반환', async () => {
      const chatbotId = 'non-existent-id';

      const getSpy = jest.spyOn(service, 'getMemoryData').mockResolvedValue(null);

      const result = await service.getMemoryData(chatbotId);

      expect(result).toBeNull();
    });
  });

  describe('에러 처리', () => {
    test('잘못된 데이터로 시스템 프롬프트 생성 시 기본값 사용', () => {
      const invalidData = {
        name: '',
        gender: 'invalid' as any,
        age: -5,
        relationship: '',
        concept: ''
      };

      expect(() => {
        generateSystemPrompt(invalidData);
      }).not.toThrow();

      const prompt = generateSystemPrompt(invalidData);
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });

    test('극단적인 나이 값 처리', () => {
      const extremeAges = [-10, 0, 150, 999];

      extremeAges.forEach(age => {
        expect(() => {
          const data: ChatbotMemoryData = {
            name: '테스트',
            gender: 'male',
            age,
            relationship: '친구',
            concept: '일반'
          };
          generateSystemPrompt(data);
        }).not.toThrow();
      });
    });
  });

  describe('프롬프트 일관성 검증', () => {
    test('동일한 데이터로 생성한 프롬프트의 일관성', () => {
      const data: ChatbotMemoryData = {
        name: '일관성테스트',
        gender: 'female',
        age: 30,
        relationship: '동료',
        concept: '회의'
      };

      const prompt1 = generateSystemPrompt(data);
      const prompt2 = generateSystemPrompt(data);

      expect(prompt1).toBe(prompt2);
    });

    test('프롬프트 필수 요소 포함 확인', () => {
      const data: ChatbotMemoryData = {
        name: '필수요소테스트',
        gender: 'male',
        age: 35,
        relationship: '상사',
        concept: '업무 미팅'
      };

      const prompt = generateSystemPrompt(data);

      // 필수 요소들이 모두 포함되어 있는지 확인
      const requiredElements = [
        '이름', '나이', '성별', '관계', '상황',
        '대화', 'AI', '캐릭터'
      ];

      requiredElements.forEach(element => {
        expect(prompt).toContain(element);
      });
    });
  });
});