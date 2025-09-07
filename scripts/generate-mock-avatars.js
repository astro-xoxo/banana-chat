const fs = require('fs')
const path = require('path')

// Mock 이미지 설정
const MOCK_CONFIGS = {
  'female-lover': {
    color: '#FF6B9D',
    gender: 'female',
    relationshipType: 'lover',
    description: '여성 연인 캐릭터',
    emoji: '💕👩'
  },
  'female-friend': {
    color: '#4ECDC4',
    gender: 'female',
    relationshipType: 'friend',
    description: '여성 친구 캐릭터',
    emoji: '🤝👩'
  },
  'female-some': {
    color: '#9B59B6',
    gender: 'female',
    relationshipType: 'some',
    description: '여성 썸 캐릭터',
    emoji: '💭👩'
  },
  'female-family': {
    color: '#F39C12',
    gender: 'female',
    relationshipType: 'family',
    description: '여성 가족 캐릭터',
    emoji: '🏠👩'
  },
  'male-lover': {
    color: '#3498DB',
    gender: 'male',
    relationshipType: 'lover',
    description: '남성 연인 캐릭터',
    emoji: '💕👨'
  },
  'male-friend': {
    color: '#2ECC71',
    gender: 'male',
    relationshipType: 'friend',
    description: '남성 친구 캐릭터',
    emoji: '🤝👨'
  },
  'male-some': {
    color: '#E74C3C',
    gender: 'male',
    relationshipType: 'some',
    description: '남성 썸 캐릭터',
    emoji: '💭👨'
  },
  'male-family': {
    color: '#95A5A6',
    gender: 'male',
    relationshipType: 'family',
    description: '남성 가족 캐릭터',
    emoji: '🏠👨'
  }
}

// SVG 생성 함수
function createMockAvatarSVG(config) {
  const { color, gender, relationshipType, description, emoji } = config
  
  const genderIcon = gender === 'female' ? '👩' : '👨'
  
  const relationshipEmoji = {
    lover: '💕',
    friend: '🤝',
    some: '💭',
    family: '🏠'
  }[relationshipType] || '✨'
  
  return `<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- 배경 원 -->
  <circle cx="100" cy="100" r="90" fill="${color}" fill-opacity="0.8" stroke="#ffffff" stroke-width="4"/>
  
  <!-- 그라데이션 배경 -->
  <defs>
    <radialGradient id="bg-gradient-${relationshipType}-${gender}" cx="50%" cy="30%" r="70%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:${color};stop-opacity:0.8" />
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="85" fill="url(#bg-gradient-${relationshipType}-${gender})"/>
  
  <!-- 중앙 아이콘 영역 -->
  <circle cx="100" cy="80" r="35" fill="white" fill-opacity="0.9"/>
  
  <!-- 성별 아이콘 -->
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
</svg>`
}

// Mock 아바타 생성 함수
function generateMockAvatars() {
  console.log('🎨 Mock 아바타 SVG 생성 시작...')
  
  const publicDir = path.join(process.cwd(), 'public', 'mock-avatars')
  let generatedCount = 0
  
  // 각 Mock 이미지에 대해 SVG 파일 생성
  for (const [key, config] of Object.entries(MOCK_CONFIGS)) {
    try {
      const svgContent = createMockAvatarSVG(config)
      const fileName = `${key}.svg`
      const filePath = path.join(publicDir, fileName)
      
      fs.writeFileSync(filePath, svgContent, 'utf8')
      
      console.log(`✅ 생성 완료: ${fileName}`)
      generatedCount++
      
    } catch (error) {
      console.error(`❌ ${key} 생성 실패:`, error)
    }
  }
  
  console.log(`🎉 Mock 아바타 생성 완료: ${generatedCount}개`)
  
  // 생성된 파일 목록 확인
  const files = fs.readdirSync(publicDir)
  console.log('📂 생성된 파일 목록:')
  files.forEach(file => {
    console.log(`   - ${file}`)
  })
  
  return generatedCount
}

// 스크립트 실행
generateMockAvatars()
