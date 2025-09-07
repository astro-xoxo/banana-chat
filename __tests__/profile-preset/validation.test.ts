/**
 * Task 011: 캐릭터 데이터 검증 로직 단위 테스트
 */

import {
  validateCharacterData,
  validateAge,
  validateRelationship,
  validateConcept,
  validateName,
  validateImageUrl,
  validateCharacterCreationRequest,
  type CharacterValidationData
} from '@/lib/validation/characterValidation';

describe('Character Data Validation', () => {
  describe('validateCharacterData', () => {
    test('유효한 데이터에 대해 검증 통과', () => {
      const validData: CharacterValidationData = {
        age: 25,
        relationship: '친구',
        concept: '카페',
        name: '민수',
        gender: 'male'
      };

      const result = validateCharacterData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('여러 오류가 있는 데이터에 대해 모든 오류 반환', () => {
      const invalidData: CharacterValidationData = {
        age: 5, // 너무 어림
        relationship: '', // 빈 문자열
        concept: '이것은 20자를 초과하는 매우 긴 컨셉 설명입니다', // 너무 김
        name: '', // 빈 문자열
        gender: 'invalid' as any // 잘못된 성별
      };

      const result = validateCharacterData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('나이는 10세 이상이어야 합니다.');
      expect(result.errors).toContain('관계는 필수 입력 항목입니다.');
      expect(result.errors).toContain('상황/컨셉은 20자 이하로 입력해주세요.');
      expect(result.errors).toContain('이름은 필수 입력 항목입니다.');
    });
  });

  describe('validateAge', () => {
    test('유효한 나이 범위 테스트', () => {
      const validAges = [10, 25, 50, 75, 100];
      
      validAges.forEach(age => {
        const result = validateAge(age);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('무효한 나이에 대한 오류 메시지', () => {
      const testCases = [
        { age: 5, expectedError: '10세 이상' },
        { age: 150, expectedError: '100세 이하' },
        { age: 25.5, expectedError: '정수' },
        { age: -10, expectedError: '10세 이상' }
      ];

      testCases.forEach(({ age, expectedError }) => {
        const result = validateAge(age);
        expect(result.isValid).toBe(false);
        expect(result.errors.join(' ')).toContain(expectedError);
      });
    });

    test('숫자가 아닌 값에 대한 오류 처리', () => {
      const result = validateAge('25' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('나이는 숫자여야 합니다.');
    });
  });

  describe('validateRelationship', () => {
    test('유효한 관계 입력 테스트', () => {
      const validRelationships = ['친구', '연인', '직장동료', '가족', '선후배'];
      
      validRelationships.forEach(relationship => {
        const result = validateRelationship(relationship);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('20자 제한 테스트', () => {
      const result = validateRelationship('이것은 20자를 초과하는 매우 긴 관계 설명입니다');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('관계는 20자 이하로 입력해주세요.');
    });

    test('빈 문자열 및 null 처리', () => {
      const testCases = ['', '   ', null, undefined];
      
      testCases.forEach(input => {
        const result = validateRelationship(input as any);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(err => err.includes('필수') || err.includes('입력'))).toBe(true);
      });
    });

    test('부적절한 내용 필터링', () => {
      const result = validateRelationship('욕설 포함');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('적절하지 않은 관계 표현입니다.');
    });
  });

  describe('validateConcept', () => {
    test('유효한 컨셉 입력 테스트', () => {
      const validConcepts = ['카페', '공원 산책', '회사 미팅', '집에서 휴식'];
      
      validConcepts.forEach(concept => {
        const result = validateConcept(concept);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('20자 제한 테스트', () => {
      const result = validateConcept('이것은 20자를 초과하는 매우 긴 상황 컨셉 설명입니다');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('상황/컨셉은 20자 이하로 입력해주세요.');
    });

    test('부적절한 내용 필터링', () => {
      const inappropriateInputs = ['폭력적인 상황', '성인 내용', '불법 활동'];
      
      inappropriateInputs.forEach(input => {
        const result = validateConcept(input);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('적절하지 않은 상황/컨셉입니다.');
      });
    });
  });

  describe('validateName', () => {
    test('유효한 이름 테스트', () => {
      const validNames = ['민수', 'John', '김철수', 'Alice123', '박영희'];
      
      validNames.forEach(name => {
        const result = validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('10자 제한 테스트', () => {
      const result = validateName('이것은10자를초과하는이름');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('이름은 10자 이하로 입력해주세요.');
    });

    test('특수문자 필터링', () => {
      const invalidNames = ['민수@', '철수#', '영희!@#', '이름$%'];
      
      invalidNames.forEach(name => {
        const result = validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('이름은 한글, 영문, 숫자만 사용할 수 있습니다.');
      });
    });
  });

  describe('validateImageUrl', () => {
    test('유효한 이미지 URL 테스트', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'https://example.com/photo.png',
        'https://example.com/pic.gif',
        'https://example.com/image.webp'
      ];
      
      validUrls.forEach(url => {
        const result = validateImageUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('잘못된 URL 형식 테스트', () => {
      const invalidUrls = ['not-a-url', 'invalid-url', '://invalid'];
      
      invalidUrls.forEach(url => {
        const result = validateImageUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('올바른 이미지 URL 형식이 아닙니다.');
      });
    });

    test('지원되지 않는 이미지 형식 테스트', () => {
      const result = validateImageUrl('https://example.com/file.txt');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('지원되는 이미지 형식이 아닙니다. (jpg, png, gif, webp)');
    });
  });

  describe('validateCharacterCreationRequest', () => {
    test('완전한 요청 데이터 검증', () => {
      const validRequest = {
        name: '민수',
        age: 25,
        gender: 'male',
        relationship: '친구',
        concept: '카페',
        user_image_url: 'https://example.com/image.jpg'
      };

      const result = validateCharacterCreationRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('필수 필드 누락 검증', () => {
      const incompleteRequest = {
        name: '민수',
        // age, gender, relationship, concept 누락
      };

      const result = validateCharacterCreationRequest(incompleteRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('age'))).toBe(true);
      expect(result.errors.some(err => err.includes('gender'))).toBe(true);
    });
  });
});