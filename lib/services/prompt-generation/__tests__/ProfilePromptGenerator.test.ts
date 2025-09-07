// ProfilePromptGenerator 단위 테스트

import { ProfilePromptGenerator } from '../ProfilePromptGenerator'
import { UserInputData, ComfyUIPrompt } from '../types'

describe('ProfilePromptGenerator', () => {
  let generator: ProfilePromptGenerator
  
  beforeEach(() => {
    generator = new ProfilePromptGenerator()
  })

  describe('generateFinalPrompt', () => {
    test('기본 프롬프트 생성 테스트', () => {
      const userData: UserInputData = {
        age: 25,
        gender: 'female',
        relationship: '친구',
        concept: '카페에서 만나기'
      }

      const result = generator.generateFinalPrompt(userData)

      expect(result).toHaveProperty('positive_prompt')
      expect(result).toHaveProperty('negative_prompt')
      expect(result).toHaveProperty('user_context')
      
      expect(result.positive_prompt).toContain('young adult')
      expect(result.positive_prompt).toContain('woman')
      expect(result.positive_prompt).toContain('friend')
      expect(result.positive_prompt).toContain('cafe')
    })

    test('남성 캐릭터 프롬프트 생성', () => {
      const userData: UserInputData = {
        age: 35,
        gender: 'male',
        relationship: '동료',
        concept: '회사 회의실'
      }

      const result = generator.generateFinalPrompt(userData)

      expect(result.positive_prompt).toContain('young adult')
      expect(result.positive_prompt).toContain('man')
      expect(result.positive_prompt).toContain('colleague')
      expect(result.positive_prompt).toContain('office')
    })

    test('나이대별 특성 확인', () => {
      const youngUser: UserInputData = {
        age: 18,
        gender: 'female',
        relationship: '친구',
        concept: '학교'
      }

      const matureUser: UserInputData = {
        age: 55,
        gender: 'male',
        relationship: '가족',
        concept: '집'
      }

      const youngResult = generator.generateFinalPrompt(youngUser)
      const matureResult = generator.generateFinalPrompt(matureUser)

      expect(youngResult.positive_prompt).toContain('young')
      expect(matureResult.positive_prompt).toContain('mature')
    })
  })

  describe('generateSystemPrompt', () => {
    test('시스템 프롬프트 생성', () => {
      const userData: UserInputData = {
        age: 28,
        gender: 'female',
        relationship: '연인',
        concept: '로맨틱한 저녁'
      }

      const result = generator.generateSystemPrompt(userData)

      expect(result).toContain('28세')
      expect(result).toContain('여성')
      expect(result).toContain('연인')
      expect(result).toContain('로맨틱한 저녁')
    })

    test('나이대별 캐릭터 특성', () => {
      const youngData: UserInputData = {
        age: 19,
        gender: 'male',
        relationship: '친구',
        concept: '게임'
      }

      const middleAgedData: UserInputData = {
        age: 45,
        gender: 'female',
        relationship: '동료',
        concept: '업무'
      }

      const youngPrompt = generator.generateSystemPrompt(youngData)
      const middlePrompt = generator.generateSystemPrompt(middleAgedData)

      expect(youngPrompt).toContain('젊고 활기찬')
      expect(middlePrompt).toContain('경험이 풍부한')
    })
  })

  describe('프롬프트 품질 검증', () => {
    test('프롬프트 길이 제한', () => {
      const userData: UserInputData = {
        age: 30,
        gender: 'female',
        relationship: '매우 친한 친구이자 오랜 시간 함께한 동반자',
        concept: '매우 복잡하고 긴 상황 설명이 포함된 시나리오'
      }

      const result = generator.generateFinalPrompt(userData)
      
      // 프롬프트가 너무 길지 않은지 확인
      expect(result.positive_prompt.length).toBeLessThan(2000)
    })

    test('필수 요소 포함 확인', () => {
      const userData: UserInputData = {
        age: 25,
        gender: 'male',
        relationship: '친구',
        concept: '공원 산책'
      }

      const result = generator.generateFinalPrompt(userData)

      // 고정 프롬프트 요소들이 포함되어 있는지 확인
      expect(result.positive_prompt).toContain('professional portrait photography')
      expect(result.negative_prompt).toContain('worst quality')
      
      // 사용자 컨텍스트가 올바르게 포함되어 있는지 확인
      expect(result.user_context).toEqual({
        age: 25,
        gender: 'male',
        relationship: '친구',
        concept: '공원 산책'
      })
    })
  })

  describe('에러 처리', () => {
    test('잘못된 입력에 대한 처리', () => {
      const invalidData = {
        age: -5,
        gender: 'unknown' as any,
        relationship: '',
        concept: ''
      }

      // 에러가 발생하지 않고 기본값으로 처리되는지 확인
      expect(() => {
        generator.generateFinalPrompt(invalidData as UserInputData)
      }).not.toThrow()
    })

    test('빈 문자열 입력 처리', () => {
      const emptyData: UserInputData = {
        age: 25,
        gender: 'female',
        relationship: '',
        concept: ''
      }

      const result = generator.generateFinalPrompt(emptyData)
      
      expect(result.positive_prompt).toBeDefined()
      expect(result.negative_prompt).toBeDefined()
    })
  })
})