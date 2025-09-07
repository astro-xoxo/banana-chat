/**
 * Task 010: 캐릭터 생성 데이터 검증 유틸리티
 * 사용자 입력 데이터의 유효성을 검증하고 오류 메시지를 제공
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface CharacterValidationData {
  age: number;
  relationship: string;
  concept: string;
  name: string;
  gender?: 'male' | 'female';
  user_image_url?: string;
}

/**
 * 캐릭터 생성 데이터 종합 검증
 */
export function validateCharacterData(data: CharacterValidationData): ValidationResult {
  const errors: string[] = [];

  // 나이 검증
  const ageValidation = validateAge(data.age);
  if (!ageValidation.isValid) {
    errors.push(...ageValidation.errors);
  }

  // 관계 검증
  const relationshipValidation = validateRelationship(data.relationship);
  if (!relationshipValidation.isValid) {
    errors.push(...relationshipValidation.errors);
  }

  // 컨셉 검증
  const conceptValidation = validateConcept(data.concept);
  if (!conceptValidation.isValid) {
    errors.push(...conceptValidation.errors);
  }

  // 이름 검증
  const nameValidation = validateName(data.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }

  // 성별 검증 (옵션)
  if (data.gender && !['male', 'female'].includes(data.gender)) {
    errors.push('성별은 male 또는 female이어야 합니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 나이 검증
 */
export function validateAge(age: number): ValidationResult {
  const errors: string[] = [];

  if (typeof age !== 'number') {
    errors.push('나이는 숫자여야 합니다.');
    return { isValid: false, errors };
  }

  if (!Number.isInteger(age)) {
    errors.push('나이는 정수여야 합니다.');
  }

  if (age < 10) {
    errors.push('나이는 10세 이상이어야 합니다.');
  }

  if (age > 100) {
    errors.push('나이는 100세 이하여야 합니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 관계 검증
 */
export function validateRelationship(relationship: string): ValidationResult {
  const errors: string[] = [];

  if (!relationship || typeof relationship !== 'string') {
    errors.push('관계는 필수 입력 항목입니다.');
    return { isValid: false, errors };
  }

  const trimmed = relationship.trim();

  if (trimmed.length === 0) {
    errors.push('관계를 입력해주세요.');
  }

  if (trimmed.length > 20) {
    errors.push('관계는 20자 이하로 입력해주세요.');
  }

  // 부적절한 내용 검사 (기본적인 필터링)
  const inappropriateWords = ['욕설', '비속어', '성인']; // 실제로는 더 포괄적인 필터링 필요
  const hasInappropriate = inappropriateWords.some(word => trimmed.includes(word));
  
  if (hasInappropriate) {
    errors.push('적절하지 않은 관계 표현입니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 컨셉/상황 검증
 */
export function validateConcept(concept: string): ValidationResult {
  const errors: string[] = [];

  if (!concept || typeof concept !== 'string') {
    errors.push('상황/컨셉은 필수 입력 항목입니다.');
    return { isValid: false, errors };
  }

  const trimmed = concept.trim();

  if (trimmed.length === 0) {
    errors.push('상황/컨셉을 입력해주세요.');
  }

  if (trimmed.length > 20) {
    errors.push('상황/컨셉은 20자 이하로 입력해주세요.');
  }

  // 부적절한 내용 검사
  const inappropriateWords = ['폭력', '성인', '불법'];
  const hasInappropriate = inappropriateWords.some(word => trimmed.includes(word));
  
  if (hasInappropriate) {
    errors.push('적절하지 않은 상황/컨셉입니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 이름 검증
 */
export function validateName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || typeof name !== 'string') {
    errors.push('이름은 필수 입력 항목입니다.');
    return { isValid: false, errors };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    errors.push('이름을 입력해주세요.');
  }

  if (trimmed.length > 10) {
    errors.push('이름은 10자 이하로 입력해주세요.');
  }

  // 특수문자 검사 (기본적인 한글, 영문, 숫자만 허용)
  const validNameRegex = /^[가-힣a-zA-Z0-9\s]+$/;
  if (!validNameRegex.test(trimmed)) {
    errors.push('이름은 한글, 영문, 숫자만 사용할 수 있습니다.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 이미지 URL 검증 (옵션)
 */
export function validateImageUrl(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url || typeof url !== 'string') {
    errors.push('이미지 URL이 유효하지 않습니다.');
    return { isValid: false, errors };
  }

  // 기본적인 URL 형식 검사
  try {
    new URL(url);
  } catch {
    errors.push('올바른 이미지 URL 형식이 아닙니다.');
    return { isValid: false, errors };
  }

  // 이미지 파일 확장자 검사
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasValidExtension = imageExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  );

  if (!hasValidExtension) {
    errors.push('지원되는 이미지 형식이 아닙니다. (jpg, png, gif, webp)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 캐릭터 생성 요청 전체 검증
 */
export function validateCharacterCreationRequest(data: any): ValidationResult {
  const errors: string[] = [];

  // 필수 필드 검사
  const requiredFields = ['name', 'age', 'gender', 'relationship', 'concept'];
  
  for (const field of requiredFields) {
    if (!data[field]) {
      errors.push(`${field}은(는) 필수 항목입니다.`);
    }
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // 개별 필드 검증
  return validateCharacterData({
    age: data.age,
    relationship: data.relationship,
    concept: data.concept,
    name: data.name,
    gender: data.gender,
    user_image_url: data.user_image_url
  });
}