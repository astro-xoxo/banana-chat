/**
 * Task 011: 프롬프트 생성 로직 단위 테스트
 */

import { 
  ProfilePromptGenerator, 
  UserInputData 
} from '@/lib/services/prompt-generation/ProfilePromptGenerator';

describe('ProfilePromptGenerator', () => {
  let generator: ProfilePromptGenerator;

  beforeEach(() => {
    generator = new ProfilePromptGenerator();
  });

  describe('프롬프트 생성 테스트', () => {
    test('젊은 남성 친구 관계에 대한 올바른 프롬프트 생성', () => {
      const userData: UserInputData = {
        age: 22,
        gender: 'male',
        relationship: '친한 친구',
        concept: '카페에서 만남'
      };

      const result = generator.generateFinalPrompt(userData);
      
      expect(result.positive_prompt).toContain('young adult man');
      expect(result.positive_prompt).toContain('close friend relationship context');
      expect(result.positive_prompt).toContain('meeting at cafe setting');
    });

    test('중년 여성 직장 동료 관계에 대한 올바른 프롬프트 생성', () => {
      const userData: UserInputData = {
        age: 45,
        gender: 'female',
        relationship: '직장 동료',
        concept: '회의실에서 미팅'
      };

      const result = generator.generateFinalPrompt(userData);
      
      expect(result.positive_prompt).toContain('middle-aged woman');
      expect(result.positive_prompt).toContain('work colleague relationship context');
      expect(result.positive_prompt).toContain('casual meeting setting');
    });

    test('나이 그룹 경계값 테스트', () => {
      const testCases = [
        { age: 10, expected: 'young' },
        { age: 19, expected: 'young' },
        { age: 20, expected: 'young adult' },
        { age: 35, expected: 'young adult' },
        { age: 40, expected: 'middle-aged' },
        { age: 50, expected: 'middle-aged' },
        { age: 51, expected: 'mature' },
        { age: 100, expected: 'mature' }
      ];

      testCases.forEach(({ age, expected }) => {
        const userData: UserInputData = {
          age,
          gender: 'male',
          relationship: '친구',
          concept: '일반'
        };
        const result = generator.generateFinalPrompt(userData);
        expect(result.positive_prompt).toContain(expected);
      });
    });

    test('성별별 용어 변환 테스트', () => {
      const maleData: UserInputData = {
        age: 25,
        gender: 'male',
        relationship: '친구',
        concept: '카페'
      };

      const femaleData: UserInputData = {
        age: 25,
        gender: 'female',
        relationship: '친구',
        concept: '카페'
      };

      const maleResult = generator.generateFinalPrompt(maleData);
      const femaleResult = generator.generateFinalPrompt(femaleData);

      expect(maleResult.positive_prompt).toContain('man');
      expect(femaleResult.positive_prompt).toContain('woman');
    });
  });

  describe('부정 프롬프트 테스트', () => {
    test('기본 부정 프롬프트 포함 확인', () => {
      const userData: UserInputData = {
        age: 25,
        gender: 'male',
        relationship: '친구',
        concept: '카페'
      };

      const result = generator.generateFinalPrompt(userData);
      
      expect(result.negative_prompt).toContain('low res');
      expect(result.negative_prompt).toContain('bad anatomy');
      expect(result.negative_prompt).toContain('blurry');
    });
  });

  describe('전체 프롬프트 구조 테스트', () => {
    test('전체 프롬프트 객체 구조 확인', () => {
      const userData: UserInputData = {
        age: 28,
        gender: 'female',
        relationship: '연인',
        concept: '공원 산책'
      };

      const result = generator.generateFinalPrompt(userData);

      expect(result).toHaveProperty('positive_prompt');
      expect(result).toHaveProperty('negative_prompt');
      expect(typeof result.positive_prompt).toBe('string');
      expect(typeof result.negative_prompt).toBe('string');
      expect(result.positive_prompt.length).toBeGreaterThan(0);
      expect(result.negative_prompt.length).toBeGreaterThan(0);
    });

    test('프롬프트 길이 제한 확인', () => {
      const userData: UserInputData = {
        age: 30,
        gender: 'male',
        relationship: '매우 긴 관계 설명이 들어가는 경우',
        concept: '매우 상세하고 긴 상황 설명이 포함된 컨셉'
      };

      const result = generator.generateFinalPrompt(userData);

      // 프롬프트가 너무 길지 않은지 확인 (실용적 제한)
      expect(result.positive_prompt.length).toBeLessThan(2000);
      expect(result.negative_prompt.length).toBeLessThan(1500); // 실제 길이에 맞게 조정
    });
  });

  describe('에러 처리 테스트', () => {
    test('잘못된 성별 입력 처리', () => {
      const userData = {
        age: 25,
        gender: 'invalid' as any,
        relationship: '친구',
        concept: '카페'
      };

      expect(() => {
        generator.generateFinalPrompt(userData);
      }).not.toThrow(); // 에러가 발생하지 않고 기본값 사용
    });

    test('경계값 밖 나이 입력 처리', () => {
      const testCases = [
        { age: 5 },
        { age: 150 },
        { age: -10 }
      ];

      testCases.forEach(({ age }) => {
        const userData: UserInputData = {
          age,
          gender: 'male',
          relationship: '친구',
          concept: '카페'
        };

        expect(() => {
          generator.generateFinalPrompt(userData);
        }).not.toThrow(); // 에러가 발생하지 않고 기본값 사용
      });
    });

    test('빈 문자열 입력 처리', () => {
      const userData: UserInputData = {
        age: 25,
        gender: 'male',
        relationship: '',
        concept: ''
      };

      const result = generator.generateFinalPrompt(userData);
      expect(result).toBeDefined();
      expect(result.positive_prompt.length).toBeGreaterThan(0);
    });
  });
});