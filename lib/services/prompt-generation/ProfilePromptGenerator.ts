// 프로필 프롬프트 생성기

import {
  UserInputData,
  ComfyUIPrompt,
  FixedPrompts,
  PromptGenerationOptions
} from './types'

import {
  getAgeGroup,
  getDetailedAgeGroup,
  optimizePromptLength,
  filterInappropriateContent,
  getGenderTerm,
  validatePrompt
} from './utils'

export class ProfilePromptGenerator {
  private readonly fixedPrompts: FixedPrompts = {
    positive: `milky white skin, porcelain complexion, ivory skin tone, pale white skin, fair complexion, light skin tone, caucasian features, european skin tone, very pale skin, white skin, light complexion, passport photo style, professional ID photo, head and shoulders portrait, 50mm lens perspective, appropriate framing for identification, Photograph looking directly at camera, professional portrait photography, front facing pose with clear facial features perfect for face swap, detailed skin texture with skin pores, photorealistic, portrait, high resolution 8K UHD, sharp focus, tack sharp, depth of field, film grain, studio lighting setup, rim lighting, crystal clear, ultra quality, highly detailed glossy eyes, refined facial structure, elegant features, well-defined jawline, detailed cheekbones, appropriate clothing coverage, professional photography composition, DSLR quality, ultra-detailed rendering`,
    
    negative: `dark skin, tan skin, brown skin, olive skin, bronze skin, golden skin, tanned complexion, dark complexion, ethnic skin tone, african skin, asian skin, latin skin, mediterranean skin, middle eastern skin, indian skin, black skin, dusky skin, swarthy skin, worst quality, normal quality, low quality, low res, blurry, bad anatomy, bad proportions, poorly drawn face, poorly drawn hands, deformed, disfigured, mutated hands, mutated limbs, extra limbs, missing limbs, extra fingers, missing fingers, fused fingers, malformed limbs, bad hands, bad eyes, extra eyes, huge eyes, cross-eyed, asymmetric ears, broken wrist, elongated throat, double face, conjoined, bad face, broken hand, out of frame, disconnected limb, amputee, cloned face, copied visage, absent limbs, cropped head, cloned head, duplicated features, dismembered, disproportionate, cripple, bad composition, distorted features, oversaturated, harsh lighting, profile view, side angle, multiple faces, dark shadows, overexposed, cartoon, anime, painting, sketch, 3d, cgi, render, illustration, artwork, drawing, low detail, jpeg artifacts, watermark, signature, username, text, error, mutation, disgusting, gross proportions, long neck, horror, geometry, monochrome, grainy, pixelated, out of focus, dehydrated, ugly, duplicate, morbid, mutilated, extra arms, extra legs, too many fingers, fused feet, worst feet, three feet, malformed feet, distortion, banner, logo, cropped, split screen`
  }

  // 사용자 입력을 영어 프롬프트로 변환 (프로필 이미지용 - 단일 인물 중심)
  private generateUserPrompt(data: UserInputData): string {
    const ageGroup = getDetailedAgeGroup(data.age)
    const genderTerm = getGenderTerm(data.gender)

    // 🎯 관계/컨셉 완전 제거, 순수 외모만 생성
    const basePrompt = `${ageGroup} ${genderTerm}`
    
    // 나이별 추가 특성 (성별 정보 전달)
    const ageSpecificTraits = this.getAgeSpecificTraits(data.age, data.gender)
    console.log('🔥 getAgeSpecificTraits 결과:', ageSpecificTraits)
    
    // 성별별 추가 특성
    const genderSpecificTraits = this.getGenderSpecificTraits(data.gender)
    console.log('🔥 getGenderSpecificTraits 결과:', genderSpecificTraits)
    
    // 🎯 기본 친근한 표정으로 통일 (관계별 분위기 제거)
    const basicExpression = 'natural smile, friendly expression, warm look'
    
    // 사용자 기본 정보(성별/나이)와 나머지 특성 분리 반환
    const result = {
      baseInfo: basePrompt,
      additionalTraits: `${ageSpecificTraits}, ${genderSpecificTraits}, ${basicExpression}`
    }
    
    console.log('🔥 generateUserPrompt 최종 결과:', result)
    return result
  }

  // 나이별 특성 (세분화된 버전 + 약화된 동안 특성 + 33세 이상 성별별 호칭)
  private getAgeSpecificTraits(age: number, gender: 'male' | 'female'): string {
    // 동안 키워드들 (강력한 키워드 4개 제거: baby face, youthful appearance, young looking, ageless beauty)
    const babyFaceKeywords = 'fresh complexion, smooth skin, innocent look, bright eyes, soft facial features, korean baby face, asian youthful look'
    
    // 32세 이하는 기존 로직 유지 (성별 무관)
    if (age <= 17) return `teenage appearance, youthful skin, innocent expression, ${babyFaceKeywords}`
    if (age <= 22) return `fresh youthful appearance, bright complexion, energetic look, ${babyFaceKeywords}`
    if (age <= 27) return `young adult appearance, confident expression, vibrant look, ${babyFaceKeywords}`
    if (age <= 32) return `mature youthful appearance, established confidence, professional demeanor, ${babyFaceKeywords}`
    
    // 33세 이상: 실제 나이 + 성별별 호칭/특성 키워드 적용
    const ageKeyword = `${age} years old`
    const genderSpecificKeywords = this.getAgeGenderKeywords(age, gender)
    
    if (age <= 39) return `${ageKeyword} ${genderSpecificKeywords.ageGroup}, ${genderSpecificKeywords.traits}, refined appearance, sophisticated look, experienced confidence, ${babyFaceKeywords}`
    if (age <= 49) return `${ageKeyword} ${genderSpecificKeywords.ageGroup}, ${genderSpecificKeywords.traits}, mature sophisticated appearance, distinguished features, seasoned confidence, ${babyFaceKeywords}`
    if (age <= 59) return `${ageKeyword} ${genderSpecificKeywords.ageGroup}, ${genderSpecificKeywords.traits}, experienced mature appearance, distinguished look, confident wisdom, ${babyFaceKeywords}`
    if (age <= 69) return `${ageKeyword} ${genderSpecificKeywords.ageGroup}, ${genderSpecificKeywords.traits}, dignified mature appearance, wise expression, senior presence, ${babyFaceKeywords}`
    
    // 70세 이상: 노인 특화 키워드
    return `${ageKeyword} ${genderSpecificKeywords.ageGroup}, ${genderSpecificKeywords.traits}, dignified elderly appearance, wise expression, venerable presence, distinguished elder features, ${babyFaceKeywords}`
  }

  // 나이별 성별 호칭/특성 키워드 생성
  private getAgeGenderKeywords(age: number, gender: 'male' | 'female'): { ageGroup: string, traits: string } {
    if (gender === 'male') {
      if (age <= 39) return { ageGroup: 'mature man', traits: 'professional gentleman, established man' }
      if (age <= 49) return { ageGroup: 'middle-aged man', traits: 'experienced gentleman, distinguished man' }
      if (age <= 59) return { ageGroup: 'mature gentleman', traits: 'seasoned man, distinguished gentleman' }
      if (age <= 69) return { ageGroup: 'senior gentleman', traits: 'wise man, elder gentleman' }
      return { ageGroup: 'elderly man', traits: 'aged gentleman, senior elder, venerable man' }
    } else {
      if (age <= 39) return { ageGroup: 'mature woman', traits: 'elegant lady, sophisticated woman' }
      if (age <= 49) return { ageGroup: 'middle-aged woman', traits: 'graceful lady, refined woman' }
      if (age <= 59) return { ageGroup: 'mature lady', traits: 'seasoned woman, distinguished lady' }
      if (age <= 69) return { ageGroup: 'senior lady', traits: 'wise woman, elder woman' }
      return { ageGroup: 'elderly woman', traits: 'aged lady, senior elder, venerable woman' }
    }
  }

  // 성별별 특성 (헤어스타일 랜덤화 + K-pop 스타일)
  private getGenderSpecificTraits(gender: 'male' | 'female'): string {
    if (gender === 'male') {
      const maleHairStyles = [
        'short hair', 'medium length hair', 'wavy hair', 'straight hair', 'textured hair',
        'side part hair', 'casual hairstyle', 'modern haircut', 'natural hair styling',
        'k-pop idol hairstyle', 'korean men hairstyle', 'asian pop star hair', 'trendy korean haircut',
        'soft layered hair', 'stylish korean hair', 'modern asian hairstyle', 'korean celebrity hair'
      ]
      const randomIndex = Math.floor(Math.random() * maleHairStyles.length)
      const randomHair = maleHairStyles[randomIndex]
      console.log(`🔥 남성 헤어스타일 선택: ${randomHair} (index: ${randomIndex})`)
      return `masculine features, strong jawline, defined facial structure, ${randomHair}`
    } else {
      const femaleHairStyles = [
        'long hair', 'medium length hair', 'wavy hair', 'straight hair', 'curly hair',
        'layered hair', 'shoulder length hair', 'natural hair styling', 'soft hair texture',
        'k-pop idol hairstyle', 'korean women hairstyle', 'asian pop star hair', 'trendy korean haircut',
        'korean celebrity hair', 'stylish korean hair', 'modern asian hairstyle', 'elegant korean hair'
      ]
      const randomIndex = Math.floor(Math.random() * femaleHairStyles.length)
      const randomHair = femaleHairStyles[randomIndex]
      console.log(`🔥 여성 헤어스타일 선택: ${randomHair} (index: ${randomIndex})`)
      return `feminine features, soft expressions, elegant appearance, ${randomHair}`
    }
  }



  // 최종 프롬프트 생성
  public generateFinalPrompt(
    userData: UserInputData,
    options: PromptGenerationOptions = {}
  ): ComfyUIPrompt {
    const {
      includeContext = true,
      validateContent = true
    } = options

    console.log('🔥 ProfilePromptGenerator.generateFinalPrompt 호출됨!')
    console.log('🔥 고정 프롬프트 앞 100자:', this.fixedPrompts.positive.substring(0, 100))
    console.log('🔥 입력된 사용자 데이터:', { age: userData.age, gender: userData.gender })
    
    // 사용자 프롬프트 생성 (baseInfo와 additionalTraits 분리)
    const userPromptData = this.generateUserPrompt(userData) as any
    console.log('🔥 generateUserPrompt 결과:', userPromptData)
    
    // 부적절한 내용 필터링
    let baseInfo = userPromptData.baseInfo
    let additionalTraits = userPromptData.additionalTraits
    
    console.log('🔥 필터링 전 baseInfo:', baseInfo)
    console.log('🔥 필터링 전 additionalTraits:', additionalTraits)
    
    if (validateContent) {
      baseInfo = filterInappropriateContent(baseInfo)
      additionalTraits = filterInappropriateContent(additionalTraits)
    }
    
    // 🎯 피부색 키워드 극대 강조 (반복 + 다양한 표현)
    const skinToneKeywords = 'extremely pale white skin, milky white skin, porcelain white complexion, ivory white skin tone, snow white skin, alabaster skin, very fair skin, caucasian white features, nordic pale skin, paper white complexion, ghost white skin, chalk white skin, marble white skin, pearl white skin, cream white skin'
    const otherFixedPrompts = this.fixedPrompts.positive.replace(/milky white skin, porcelain complexion, ivory skin tone, pale white skin, fair complexion, light skin tone, caucasian features, european skin tone, very pale skin, white skin, light complexion, /, '')
    
    // 🎯 최종 순서: 극대 강조된 피부색 → 성별/나이 → 나이별 특성 → 고정 프롬프트
    const positivePrompt = `${skinToneKeywords}, ${baseInfo}, ${additionalTraits}, ${otherFixedPrompts}`
    console.log('🔥 최종 조합된 프롬프트 길이:', positivePrompt.length)
    console.log('🔥 프롬프트 시작 부분:', positivePrompt.substring(0, 150))
    console.log('🔥 milky white skin 포함?:', positivePrompt.includes('milky white skin'))
    
    const optimizedPositive = optimizePromptLength(positivePrompt, 2500)
    console.log('🔥 최적화 후 길이:', optimizedPositive.length)
    
    // 프롬프트 검증
    if (validateContent && !validatePrompt(optimizedPositive)) {
      console.warn('Generated prompt failed validation')
    }
    
    return {
      positive_prompt: optimizedPositive,
      negative_prompt: this.fixedPrompts.negative,
      user_context: includeContext ? {
        age: userData.age,
        gender: userData.gender,
        relationship: userData.relationship,
        concept: userData.concept
      } : userData
    }
  }

  // 시스템 프롬프트 생성 (AI 챗봇용)
  public generateSystemPrompt(userData: UserInputData): string {
    const ageGroup = getAgeGroup(userData.age)
    const genderTerm = userData.gender === 'male' ? '남성' : '여성'
    
    const characterTraits = ageGroup === 'young' ? '젊고 활기찬' : 
      ageGroup === 'young adult' ? '성숙하고 안정적인' :
      ageGroup === 'middle-aged' ? '경험이 풍부한' : '지혜로운'
    
    return `당신은 ${userData.age}세 ${genderTerm} AI 캐릭터입니다. 
사용자와의 관계는 '${userData.relationship}'이며, 
현재 상황은 '${userData.concept}'입니다.
나이에 맞는 ${characterTraits} 
대화 스타일을 유지하면서 자연스럽게 대화해주세요.
관계와 상황에 맞는 적절한 존댓말이나 반말을 사용하세요.`
  }
}

// 싱글톤 인스턴스 export
export const profilePromptGenerator = new ProfilePromptGenerator()