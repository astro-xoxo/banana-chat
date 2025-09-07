/**
 * InputValidator - API 요청 입력 검증 서비스
 * Task 012: Implement Security and Validation Systems
 */

import type { ValidationResult, ValidationError, ValidationWarning } from './types';

export class InputValidator {
  
  /**
   * 이미지 생성 요청 검증
   */
  async validateImageGenerationRequest(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // 필수 필드 검증
      if (!data.message_id) {
        errors.push({
          field: 'message_id',
          code: 'REQUIRED_FIELD',
          message: 'message_id는 필수 항목입니다',
          severity: 'high'
        });
      } else if (!this.isValidUUID(data.message_id)) {
        errors.push({
          field: 'message_id',
          code: 'INVALID_FORMAT',
          message: 'message_id 형식이 올바르지 않습니다',
          severity: 'high'
        });
      }

      // 품질 레벨 검증
      if (data.quality_level) {
        const validQualityLevels = ['draft', 'standard', 'high', 'premium'];
        if (!validQualityLevels.includes(data.quality_level)) {
          errors.push({
            field: 'quality_level',
            code: 'INVALID_VALUE',
            message: `quality_level은 ${validQualityLevels.join(', ')} 중 하나여야 합니다`,
            severity: 'medium'
          });
        }
      }

      // 스타일 오버라이드 검증
      if (data.style_override) {
        const styleValidation = this.validateStyleOverride(data.style_override);
        errors.push(...styleValidation.errors);
        warnings.push(...styleValidation.warnings);
      }

      // 템플릿 ID 검증
      if (data.template_id) {
        if (typeof data.template_id !== 'string' || data.template_id.length > 50) {
          errors.push({
            field: 'template_id',
            code: 'INVALID_LENGTH',
            message: 'template_id는 50자 이하의 문자열이어야 합니다',
            severity: 'medium'
          });
        }
      }

      // 추가 매개변수 검증
      if (data.additional_params) {
        const paramsValidation = this.validateAdditionalParams(data.additional_params);
        errors.push(...paramsValidation.errors);
        warnings.push(...paramsValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error('InputValidator: 요청 검증 중 오류 발생', { data, error });
      
      return {
        isValid: false,
        errors: [{
          field: 'general',
          code: 'VALIDATION_ERROR',
          message: '요청 검증 중 오류가 발생했습니다',
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  /**
   * 스타일 오버라이드 검증
   */
  private validateStyleOverride(styleOverride: string): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 길이 검증
    if (styleOverride.length > 500) {
      errors.push({
        field: 'style_override',
        code: 'INVALID_LENGTH',
        message: 'style_override는 500자 이하여야 합니다',
        severity: 'medium'
      });
    }

    // 부적절한 내용 검증
    const inappropriatePatterns = [
      /\b(nude|naked|nsfw|adult|sexual)\b/i,
      /\b(violence|kill|death|blood|gore)\b/i,
      /\b(drug|illegal|crime|fraud)\b/i,
      /\b(hate|racism|discrimination)\b/i
    ];

    for (const pattern of inappropriatePatterns) {
      if (pattern.test(styleOverride)) {
        errors.push({
          field: 'style_override',
          code: 'INAPPROPRIATE_CONTENT',
          message: 'style_override에 부적절한 내용이 포함되어 있습니다',
          severity: 'high'
        });
        break;
      }
    }

    // SQL 인젝션 검증
    const sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|exec|execute)\b)/i,
      /(;|'|"|`|\-\-|\#|\/\*|\*\/)/
    ];

    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(styleOverride)) {
        errors.push({
          field: 'style_override',
          code: 'SECURITY_VIOLATION',
          message: 'style_override에 허용되지 않는 문자가 포함되어 있습니다',
          severity: 'critical'
        });
        break;
      }
    }

    // 경고 사항
    if (styleOverride.length < 10) {
      warnings.push({
        field: 'style_override',
        message: 'style_override가 너무 짧아 효과가 제한적일 수 있습니다',
        suggestion: '더 구체적인 스타일 설명을 추가해보세요'
      });
    }

    return { errors, warnings };
  }

  /**
   * 추가 매개변수 검증
   */
  private validateAdditionalParams(params: any): { errors: ValidationError[], warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (typeof params !== 'object' || params === null) {
      errors.push({
        field: 'additional_params',
        code: 'INVALID_TYPE',
        message: 'additional_params는 객체여야 합니다',
        severity: 'medium'
      });
      return { errors, warnings };
    }

    // 객체 크기 제한
    const paramKeys = Object.keys(params);
    if (paramKeys.length > 20) {
      errors.push({
        field: 'additional_params',
        code: 'TOO_MANY_PARAMS',
        message: 'additional_params는 최대 20개의 속성을 가질 수 있습니다',
        severity: 'medium'
      });
    }

    // 각 매개변수 검증
    for (const [key, value] of Object.entries(params)) {
      // 키 검증
      if (typeof key !== 'string' || key.length > 50) {
        errors.push({
          field: `additional_params.${key}`,
          code: 'INVALID_KEY',
          message: '매개변수 키는 50자 이하의 문자열이어야 합니다',
          severity: 'medium'
        });
      }

      // 값 검증
      if (typeof value === 'string' && value.length > 1000) {
        errors.push({
          field: `additional_params.${key}`,
          code: 'INVALID_VALUE_LENGTH',
          message: '매개변수 값은 1000자 이하여야 합니다',
          severity: 'medium'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * UUID 형식 검증
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * XSS 공격 패턴 검증
   */
  private containsXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<\s*\w+\s+on\w+/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * 일반적인 문자열 입력 검증
   */
  validateStringInput(
    value: string, 
    fieldName: string, 
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      allowSpecialChars?: boolean;
      checkXSS?: boolean;
    } = {}
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const { 
      required = false, 
      minLength = 0, 
      maxLength = 1000, 
      allowSpecialChars = true,
      checkXSS = true 
    } = options;

    // 필수 필드 검증
    if (required && (!value || value.trim().length === 0)) {
      errors.push({
        field: fieldName,
        code: 'REQUIRED_FIELD',
        message: `${fieldName}은(는) 필수 항목입니다`,
        severity: 'high'
      });
      return errors;
    }

    if (!value) return errors;

    // 길이 검증
    if (value.length < minLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_SHORT',
        message: `${fieldName}은(는) 최소 ${minLength}자 이상이어야 합니다`,
        severity: 'medium'
      });
    }

    if (value.length > maxLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_LONG',
        message: `${fieldName}은(는) 최대 ${maxLength}자 이하여야 합니다`,
        severity: 'medium'
      });
    }

    // 특수 문자 검증
    if (!allowSpecialChars) {
      const specialCharPattern = /[<>\"'&]/;
      if (specialCharPattern.test(value)) {
        errors.push({
          field: fieldName,
          code: 'INVALID_CHARACTERS',
          message: `${fieldName}에 허용되지 않는 특수 문자가 포함되어 있습니다`,
          severity: 'medium'
        });
      }
    }

    // XSS 검증
    if (checkXSS && this.containsXSS(value)) {
      errors.push({
        field: fieldName,
        code: 'XSS_DETECTED',
        message: `${fieldName}에 보안 위험이 있는 내용이 포함되어 있습니다`,
        severity: 'critical'
      });
    }

    return errors;
  }

  /**
   * 숫자 입력 검증
   */
  validateNumberInput(
    value: number, 
    fieldName: string, 
    options: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
    } = {}
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const { required = false, min, max, integer = false } = options;

    // 필수 필드 검증
    if (required && (value === undefined || value === null)) {
      errors.push({
        field: fieldName,
        code: 'REQUIRED_FIELD',
        message: `${fieldName}은(는) 필수 항목입니다`,
        severity: 'high'
      });
      return errors;
    }

    if (value === undefined || value === null) return errors;

    // 숫자 타입 검증
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        field: fieldName,
        code: 'INVALID_TYPE',
        message: `${fieldName}은(는) 유효한 숫자여야 합니다`,
        severity: 'high'
      });
      return errors;
    }

    // 정수 검증
    if (integer && !Number.isInteger(value)) {
      errors.push({
        field: fieldName,
        code: 'NOT_INTEGER',
        message: `${fieldName}은(는) 정수여야 합니다`,
        severity: 'medium'
      });
    }

    // 범위 검증
    if (min !== undefined && value < min) {
      errors.push({
        field: fieldName,
        code: 'TOO_SMALL',
        message: `${fieldName}은(는) ${min} 이상이어야 합니다`,
        severity: 'medium'
      });
    }

    if (max !== undefined && value > max) {
      errors.push({
        field: fieldName,
        code: 'TOO_LARGE',
        message: `${fieldName}은(는) ${max} 이하여야 합니다`,
        severity: 'medium'
      });
    }

    return errors;
  }

  /**
   * 배열 입력 검증
   */
  validateArrayInput(
    value: any[], 
    fieldName: string, 
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      itemValidator?: (item: any, index: number) => ValidationError[];
    } = {}
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const { required = false, minLength = 0, maxLength = 100, itemValidator } = options;

    // 필수 필드 검증
    if (required && (!value || !Array.isArray(value))) {
      errors.push({
        field: fieldName,
        code: 'REQUIRED_FIELD',
        message: `${fieldName}은(는) 필수 항목입니다`,
        severity: 'high'
      });
      return errors;
    }

    if (!value) return errors;

    // 배열 타입 검증
    if (!Array.isArray(value)) {
      errors.push({
        field: fieldName,
        code: 'INVALID_TYPE',
        message: `${fieldName}은(는) 배열이어야 합니다`,
        severity: 'high'
      });
      return errors;
    }

    // 길이 검증
    if (value.length < minLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_SHORT',
        message: `${fieldName}은(는) 최소 ${minLength}개의 항목이 필요합니다`,
        severity: 'medium'
      });
    }

    if (value.length > maxLength) {
      errors.push({
        field: fieldName,
        code: 'TOO_LONG',
        message: `${fieldName}은(는) 최대 ${maxLength}개의 항목만 허용됩니다`,
        severity: 'medium'
      });
    }

    // 개별 항목 검증
    if (itemValidator) {
      value.forEach((item, index) => {
        const itemErrors = itemValidator(item, index);
        errors.push(...itemErrors.map(error => ({
          ...error,
          field: `${fieldName}[${index}].${error.field}`
        })));
      });
    }

    return errors;
  }
}
