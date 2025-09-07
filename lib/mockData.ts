// Mock 데이터 정의 - Phase 1에서 사용할 임시 데이터
// ComfyUI 서버 완료 후 실제 이미지로 교체 예정

// 8가지 Mock 이미지 프리셋 (성별 × 관계 조합)
export const MOCK_PROFILE_IMAGES = {
  'female-lover': {
    url: '/mock-avatars/female-lover.svg',
    description: '여성 연인 캐릭터',
    style: 'romantic, warm, feminine',
    color: '#FF6B9D', // 핑크 계열 - 로맨틱
    relationshipType: 'lover',
    gender: 'female'
  },
  'female-friend': {
    url: '/mock-avatars/female-friend.svg',
    description: '여성 친구 캐릭터',
    style: 'friendly, casual, approachable',
    color: '#4ECDC4', // 청록 계열 - 친근함
    relationshipType: 'friend',
    gender: 'female'
  },
  'female-some': {
    url: '/mock-avatars/female-some.svg',
    description: '여성 썸 캐릭터',
    style: 'mysterious, attractive, subtle',
    color: '#9B59B6', // 보라 계열 - 신비로움
    relationshipType: 'some',
    gender: 'female'
  },
  'female-family': {
    url: '/mock-avatars/female-family.svg',
    description: '여성 가족 캐릭터',
    style: 'caring, mature, reliable',
    color: '#F39C12', // 오렌지 계열 - 따뜻함
    relationshipType: 'family',
    gender: 'female'
  },
  'male-lover': {
    url: '/mock-avatars/male-lover.svg',
    description: '남성 연인 캐릭터',
    style: 'romantic, protective, masculine',
    color: '#3498DB', // 파란 계열 - 로맨틱
    relationshipType: 'lover',
    gender: 'male'
  },
  'male-friend': {
    url: '/mock-avatars/male-friend.svg',
    description: '남성 친구 캐릭터',
    style: 'friendly, reliable, fun',
    color: '#2ECC71', // 초록 계열 - 신뢰감
    relationshipType: 'friend',
    gender: 'male'
  },
  'male-some': {
    url: '/mock-avatars/male-some.svg',
    description: '남성 썸 캐릭터',
    style: 'charming, confident, intriguing',
    color: '#E74C3C', // 빨간 계열 - 매력적
    relationshipType: 'some',
    gender: 'male'
  },
  'male-family': {
    url: '/mock-avatars/male-family.svg',
    description: '남성 가족 캐릭터',
    style: 'dependable, caring, strong',
    color: '#95A5A6', // 회색 계열 - 안정감
    relationshipType: 'family',
    gender: 'male'
  }
}

// 프리셋 ID를 이미지 키로 매핑 (ComfyUI 연동용)
export const PRESET_ID_TO_IMAGE_KEY = {
  '1': 'female-lover',
  '2': 'female-friend', 
  '3': 'female-some',
  '4': 'female-family',
  '5': 'male-lover',
  '6': 'male-friend',
  '7': 'male-some',
  '8': 'male-family'
}

// Mock 이미지 생성을 위한 SVG 템플릿
export const createMockAvatarSVG = (config: {
  color: string
  gender: 'male' | 'female'
  relationshipType: string
  description: string
}) => {
  const { color, gender, relationshipType, description } = config
  
  // 성별에 따른 아이콘 선택
  const genderIcon = gender === 'female' ? '👩' : '👨'
  
  // 관계에 따른 이모지 선택
  const relationshipEmoji = {
    lover: '💕',
    friend: '🤝',
    some: '💭',
    family: '🏠'
  }[relationshipType] || '✨'
  
  return `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <!-- 배경 원 -->
      <circle cx="100" cy="100" r="90" fill="${color}" fill-opacity="0.8" stroke="#ffffff" stroke-width="4"/>
      
      <!-- 그라데이션 배경 -->
      <defs>
        <radialGradient id="bg-gradient" cx="50%" cy="30%" r="70%">
          <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:${color};stop-opacity:0.8" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="85" fill="url(#bg-gradient)"/>
      
      <!-- 중앙 아이콘 영역 -->
      <circle cx="100" cy="80" r="35" fill="white" fill-opacity="0.9"/>
      
      <!-- 성별 아이콘 (텍스트로 대체) -->
      <text x="100" y="95" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="${color}">
        ${genderIcon}
      </text>
      
      <!-- 관계 타입 아이콘 -->
      <text x="100" y="140" font-family="Arial, sans-serif" font-size="24" text-anchor="middle">
        ${relationshipEmoji}
      </text>
      
      <!-- 관계 타입 텍스트 -->
      <text x="100" y="165" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="white" font-weight="bold">
        ${relationshipType.toUpperCase()}
      </text>
      
      <!-- Mock 표시 -->
      <text x="100" y="185" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="white" opacity="0.7">
        MOCK
      </text>
    </svg>
  `
}

// 기본 Mock 이미지 설정
export const MOCK_IMAGE_CONFIG = {
  format: 'svg',
  width: 200,
  height: 200,
  quality: 'high',
  isMock: true,
  version: '1.0'
}

// Mock 모드 식별자
export const MOCK_MODE_IDENTIFIER = 'mock-avatar-v1'

export default MOCK_PROFILE_IMAGES
