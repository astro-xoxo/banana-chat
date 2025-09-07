// 프롬프트 생성 유틸리티 함수

import { AgeGroup } from './types'

// 나이를 세분화된 나이 그룹으로 변환
export function getDetailedAgeGroup(age: number): string {
  if (age <= 17) return 'teenage' // 18+ 권장
  if (age <= 22) return 'early twenties'
  if (age <= 27) return 'mid twenties' 
  if (age <= 32) return 'late twenties to early thirties'
  if (age <= 37) return 'mid thirties'
  if (age <= 42) return 'late thirties to early forties'
  if (age <= 50) return 'middle-aged'
  return 'mature adult'
}

// 기존 함수 유지 (호환성을 위해)
export function getAgeGroup(age: number): AgeGroup {
  if (age <= 19) return 'young'
  if (age <= 35) return 'young adult'
  if (age <= 50) return 'middle-aged'
  return 'mature'
}

// 한글 관계를 영어로 변환 (기본 매핑)
export function translateRelationship(relationship: string): string {
  const relationshipMap: Record<string, string> = {
    '친구': 'friend',
    '연인': 'lover',
    '가족': 'family',
    '동료': 'colleague',
    '선배': 'senior',
    '후배': 'junior',
    '친한 친구': 'close friend',
    '절친': 'close friend',
    '첫사랑': 'first love',
    '직장 동료': 'work colleague',
    '소개팅 상대': 'blind date',
    '소개팅': 'blind date',
    '오랜 친구': 'old friend'
  }
  
  return relationshipMap[relationship] || 'friend'
}

// 한글 컨셉을 영어로 변환 (기본 매핑)
export function translateConcept(concept: string): string {
  const conceptMap: Record<string, string> = {
    // 단일 컨셉
    '카페': 'cafe',
    '공원': 'park',
    '해변': 'beach',
    '집': 'home',
    '학교': 'school',
    '회사': 'office',
    '도서관': 'library',
    '헬스장': 'gym',
    '영화관': 'movie theater',
    '식당': 'restaurant',
    
    // 복합 컨셉
    '카페에서 만나기': 'meeting at cafe',
    '카페에서 만남': 'meeting at cafe',
    '공원 산책': 'park walk',
    '로맨틱한 저녁': 'romantic evening',
    '업무 미팅': 'business meeting',
    '친구들과 파티': 'party with friends',
    '회사 회의실': 'office meeting room',
    '학교 도서관': 'school library',
    '야근하는 직장': 'working late at office',
    '바닷가 여행': 'beach trip',
    '겨울 눈내리는 날': 'snowy winter day',
    '운동하는 헬스장': 'working out at gym',
    '회사 회식': 'company dinner',
    '데이트': 'date',
    '게임': 'gaming',
    '업무': 'work'
  }
  
  return conceptMap[concept] || 'casual meeting'
}

// 프롬프트 길이 최적화 (최대 토큰 수 제한)
export function optimizePromptLength(prompt: string, maxLength: number = 1000): string {
  if (prompt.length <= maxLength) return prompt
  
  // 중요한 부분을 유지하면서 길이 줄이기
  const parts = prompt.split(', ')
  const essential = parts.slice(0, Math.floor(parts.length * 0.7))
  
  return essential.join(', ')
}

// 부적절한 내용 필터링
export function filterInappropriateContent(text: string): string {
  // 부적절한 단어 목록 (테스트용)
  const inappropriateWords = [
    'inappropriate',
    'offensive',
    'harmful',
    'explicit'
  ]
  
  let filtered = text
  inappropriateWords.forEach(word => {
    filtered = filtered.replace(new RegExp(word, 'gi'), '')
  })
  
  // 연속된 공백과 쉼표 정리
  filtered = filtered.replace(/,\s*,/g, ',').replace(/\s+/g, ' ')
  
  return filtered.trim()
}

// 성별 용어 변환
export function getGenderTerm(gender: 'male' | 'female'): string {
  return gender === 'male' ? 'man' : 'woman'
}

// 프롬프트 검증
export function validatePrompt(prompt: string): boolean {
  // 빈 문자열 체크
  if (!prompt || prompt.trim().length === 0) return false
  
  // 최소 길이 체크
  if (prompt.length < 10) return false
  
  // 최대 길이 체크
  if (prompt.length > 2000) return false
  
  // 부적절한 키워드 체크
  const inappropriateKeywords = ['inappropriate', 'offensive', 'harmful', 'explicit']
  const hasInappropriateContent = inappropriateKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  )
  
  if (hasInappropriateContent) return false
  
  // 필수 키워드 체크
  const requiredKeywords = ['portrait', 'photography', 'quality']
  const hasRequiredKeywords = requiredKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  )
  
  return hasRequiredKeywords
}