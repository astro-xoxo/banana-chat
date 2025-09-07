// 프롬프트 생성 유틸리티 함수 단위 테스트

import {
  getAgeGroup,
  translateRelationship,
  translateConcept,
  getGenderTerm,
  optimizePromptLength,
  filterInappropriateContent,
  validatePrompt
} from '../utils'

describe('프롬프트 생성 유틸리티', () => {
  
  describe('getAgeGroup', () => {
    test('나이대별 그룹 분류', () => {
      expect(getAgeGroup(15)).toBe('young')
      expect(getAgeGroup(25)).toBe('young adult')
      expect(getAgeGroup(40)).toBe('middle-aged')
      expect(getAgeGroup(60)).toBe('mature')
    })

    test('경계값 테스트', () => {
      expect(getAgeGroup(19)).toBe('young')
      expect(getAgeGroup(20)).toBe('young adult')
      expect(getAgeGroup(35)).toBe('young adult')
      expect(getAgeGroup(36)).toBe('middle-aged')
      expect(getAgeGroup(50)).toBe('middle-aged')
      expect(getAgeGroup(51)).toBe('mature')
    })
  })

  describe('getGenderTerm', () => {
    test('성별 용어 변환', () => {
      expect(getGenderTerm('male')).toBe('man')
      expect(getGenderTerm('female')).toBe('woman')
    })
  })

  describe('translateRelationship', () => {
    test('관계 용어 한글→영어 변환', () => {
      expect(translateRelationship('친구')).toBe('friend')
      expect(translateRelationship('연인')).toBe('lover')
      expect(translateRelationship('가족')).toBe('family')
      expect(translateRelationship('동료')).toBe('colleague')
      expect(translateRelationship('절친')).toBe('close friend')
      expect(translateRelationship('첫사랑')).toBe('first love')
      expect(translateRelationship('소개팅')).toBe('blind date')
    })

    test('정의되지 않은 관계 처리', () => {
      expect(translateRelationship('알 수 없는 관계')).toBe('friend')
      expect(translateRelationship('')).toBe('friend')
    })
  })

  describe('translateConcept', () => {
    test('컨셉 한글→영어 변환', () => {
      expect(translateConcept('카페')).toBe('cafe')
      expect(translateConcept('공원')).toBe('park')
      expect(translateConcept('해변')).toBe('beach')
      expect(translateConcept('집')).toBe('home')
      expect(translateConcept('학교')).toBe('school')
      expect(translateConcept('회사')).toBe('office')
      expect(translateConcept('도서관')).toBe('library')
    })

    test('복합 컨셉 변환', () => {
      expect(translateConcept('카페에서 만나기')).toBe('meeting at cafe')
      expect(translateConcept('공원 산책')).toBe('park walk')
      expect(translateConcept('로맨틱한 저녁')).toBe('romantic evening')
      expect(translateConcept('업무 미팅')).toBe('business meeting')
      expect(translateConcept('친구들과 파티')).toBe('party with friends')
    })

    test('정의되지 않은 컨셉 처리', () => {
      expect(translateConcept('알 수 없는 상황')).toBe('casual meeting')
      expect(translateConcept('')).toBe('casual meeting')
    })
  })

  describe('optimizePromptLength', () => {
    test('프롬프트 길이 제한', () => {
      const longPrompt = 'a'.repeat(2000)
      const optimized = optimizePromptLength(longPrompt, 100)
      
      expect(optimized.length).toBeLessThanOrEqual(100)
    })

    test('짧은 프롬프트는 그대로 유지', () => {
      const shortPrompt = 'short prompt'
      const optimized = optimizePromptLength(shortPrompt, 100)
      
      expect(optimized).toBe(shortPrompt)
    })

    test('중요한 키워드 보존', () => {
      const promptWithKeywords = 'important keyword, another important term, ' + 'filler '.repeat(100)
      const optimized = optimizePromptLength(promptWithKeywords, 50)
      
      expect(optimized).toContain('important keyword')
    })
  })

  describe('filterInappropriateContent', () => {
    test('부적절한 내용 필터링', () => {
      const inappropriatePrompt = 'normal content, inappropriate content, more normal content'
      const filtered = filterInappropriateContent(inappropriatePrompt)
      
      expect(filtered).not.toContain('inappropriate')
      expect(filtered).toContain('normal content')
    })

    test('적절한 내용은 그대로 유지', () => {
      const appropriatePrompt = 'beautiful portrait, professional photo, high quality'
      const filtered = filterInappropriateContent(appropriatePrompt)
      
      expect(filtered).toBe(appropriatePrompt)
    })
  })

  describe('validatePrompt', () => {
    test('유효한 프롬프트 검증', () => {
      const validPrompt = 'professional portrait, high quality, beautiful lighting'
      expect(validatePrompt(validPrompt)).toBe(true)
    })

    test('너무 짧은 프롬프트 거부', () => {
      const tooShort = 'short'
      expect(validatePrompt(tooShort)).toBe(false)
    })

    test('빈 프롬프트 거부', () => {
      expect(validatePrompt('')).toBe(false)
      expect(validatePrompt('   ')).toBe(false)
    })

    test('부적절한 키워드가 포함된 프롬프트 거부', () => {
      const inappropriate = 'portrait with inappropriate content'
      expect(validatePrompt(inappropriate)).toBe(false)
    })
  })
})