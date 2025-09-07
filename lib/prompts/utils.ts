/**
 * 프롬프트 시스템 유틸리티 함수
 * 프롬프트 생성, 검증, 변환 등의 헬퍼 함수
 */

import {
  PromptTemplate,
  PromptVariable,
  PromptValidationResult,
  PromptGenerationResult,
  MainCategory,
  SubCategory,
  CategoryMapping
} from './types';

/**
 * 프롬프트 템플릿에서 변수를 실제 값으로 치환
 */
export const generatePromptFromTemplate = (
  template: PromptTemplate,
  variableValues: Record<string, any>
): PromptGenerationResult => {
  try {
    let generatedPrompt = template.template;
    const missingVariables: string[] = [];

    // 필수 변수 확인
    template.variables?.forEach(variable => {
      if (variable.required && !variableValues[variable.key]) {
        missingVariables.push(variable.key);
      }
    });

    if (missingVariables.length > 0) {
      return {
        success: false,
        prompt: '',
        metadata: {
          templateId: template.id,
          category: template.category,
          subcategory: template.subcategory,
          variables: variableValues,
          generatedAt: new Date()
        },
        error: `필수 변수가 누락되었습니다: ${missingVariables.join(', ')}`
      };
    }

    // 변수 치환
    template.variables?.forEach(variable => {
      const value = variableValues[variable.key] || variable.defaultValue || '';
      const regex = new RegExp(`{{${variable.key}}}`, 'g');
      generatedPrompt = generatedPrompt.replace(regex, String(value));
    });

    // 남은 플레이스홀더 제거 (변수가 없는 경우)
    generatedPrompt = generatedPrompt.replace(/{{[^}]+}}/g, '');

    return {
      success: true,
      prompt: generatedPrompt.trim(),
      metadata: {
        templateId: template.id,
        category: template.category,
        subcategory: template.subcategory,
        variables: variableValues,
        generatedAt: new Date()
      }
    };
  } catch (error) {
    return {
      success: false,
      prompt: '',
      metadata: {
        templateId: template.id,
        category: template.category,
        subcategory: template.subcategory,
        variables: variableValues,
        generatedAt: new Date()
      },
      error: `프롬프트 생성 중 오류가 발생했습니다: ${error}`
    };
  }
};

/**
 * 프롬프트 변수 값 검증
 */
export const validatePromptVariables = (
  template: PromptTemplate,
  variableValues: Record<string, any>
): PromptValidationResult => {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: Array<{ field: string; message: string }> = [];

  template.variables?.forEach(variable => {
    const value = variableValues[variable.key];

    // 필수 변수 확인
    if (variable.required && !value) {
      errors.push({
        field: variable.key,
        message: `${variable.label}은(는) 필수 입력 항목입니다.`
      });
      return;
    }

    if (value && variable.validation) {
      // 타입별 검증
      if (variable.type === 'number') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push({
            field: variable.key,
            message: `${variable.label}은(는) 숫자여야 합니다.`
          });
        } else {
          if (variable.validation.min !== undefined && numValue < variable.validation.min) {
            errors.push({
              field: variable.key,
              message: `${variable.label}은(는) ${variable.validation.min} 이상이어야 합니다.`
            });
          }
          if (variable.validation.max !== undefined && numValue > variable.validation.max) {
            errors.push({
              field: variable.key,
              message: `${variable.label}은(는) ${variable.validation.max} 이하여야 합니다.`
            });
          }
        }
      }

      // 패턴 검증
      if (variable.type === 'text' && variable.validation.pattern) {
        const regex = new RegExp(variable.validation.pattern);
        if (!regex.test(String(value))) {
          errors.push({
            field: variable.key,
            message: variable.validation.message || `${variable.label} 형식이 올바르지 않습니다.`
          });
        }
      }
    }

    // 선택 옵션 검증
    if (variable.type === 'select' && variable.options) {
      const validValues = variable.options.map(opt => opt.value);
      if (!validValues.includes(value)) {
        warnings.push({
          field: variable.key,
          message: `${variable.label}의 값이 권장 옵션에 없습니다.`
        });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

/**
 * 프롬프트 템플릿에서 변수 추출
 */
export const extractVariablesFromTemplate = (templateString: string): string[] => {
  const regex = /{{([^}]+)}}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(templateString)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
};

/**
 * 카테고리와 서브카테고리 조합 유효성 검증
 */
export const isValidCategorySubcategory = (
  category: MainCategory,
  subcategory: SubCategory
): boolean => {
  const validSubcategories: CategoryMapping = {
    relationship: ['romantic', 'friendship', 'professional', 'family', 'mentor'],
    personality: ['cheerful', 'calm', 'passionate', 'gentle', 'playful', 'serious'],
    situation: ['daily', 'support', 'celebration', 'advice', 'entertainment', 'learning'],
    interaction: ['casual', 'formal', 'emotional', 'intellectual', 'playful_banter', 'deep_talk']
  };

  return validSubcategories[category]?.includes(subcategory as any) || false;
};

/**
 * 프롬프트 미리보기 생성
 */
export const generatePromptPreview = (
  template: PromptTemplate,
  variableValues: Record<string, any>,
  maxLength: number = 200
): string => {
  const result = generatePromptFromTemplate(template, variableValues);
  
  if (!result.success) {
    return template.template.substring(0, maxLength) + '...';
  }

  const preview = result.prompt;
  if (preview.length <= maxLength) {
    return preview;
  }

  return preview.substring(0, maxLength) + '...';
};

/**
 * 프롬프트 템플릿 병합
 */
export const mergePromptTemplates = (
  templates: PromptTemplate[],
  separator: string = '\n\n'
): string => {
  return templates
    .map(template => template.template)
    .join(separator);
};

/**
 * 변수 기본값 설정
 */
export const getDefaultVariableValues = (
  template: PromptTemplate
): Record<string, any> => {
  const defaults: Record<string, any> = {};

  template.variables?.forEach(variable => {
    if (variable.defaultValue !== undefined) {
      defaults[variable.key] = variable.defaultValue;
    } else if (variable.type === 'boolean') {
      defaults[variable.key] = false;
    } else if (variable.type === 'number') {
      defaults[variable.key] = 0;
    } else if (variable.type === 'select' && variable.options?.length) {
      defaults[variable.key] = variable.options[0].value;
    } else {
      defaults[variable.key] = '';
    }
  });

  return defaults;
};

/**
 * 프롬프트 복잡도 계산
 */
export const calculatePromptComplexity = (template: PromptTemplate): number => {
  let complexity = 0;

  // 템플릿 길이
  complexity += Math.min(template.template.length / 100, 5);

  // 변수 개수
  complexity += (template.variables?.length || 0) * 0.5;

  // 필수 변수 개수
  const requiredVars = template.variables?.filter(v => v.required).length || 0;
  complexity += requiredVars * 0.3;

  // 검증 규칙 개수
  const validationRules = template.variables?.filter(v => v.validation).length || 0;
  complexity += validationRules * 0.2;

  return Math.min(Math.round(complexity * 10) / 10, 10); // 0-10 scale
};

/**
 * 프롬프트 템플릿 검색
 */
export const searchPromptTemplates = (
  templates: PromptTemplate[],
  query: string
): PromptTemplate[] => {
  const lowerQuery = query.toLowerCase();

  return templates.filter(template => {
    // 이름 검색
    if (template.name.toLowerCase().includes(lowerQuery)) return true;

    // 설명 검색
    if (template.description.toLowerCase().includes(lowerQuery)) return true;

    // 템플릿 내용 검색
    if (template.template.toLowerCase().includes(lowerQuery)) return true;

    // 태그 검색
    if (template.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;

    // 예제 검색
    if (template.examples?.some(ex => ex.toLowerCase().includes(lowerQuery))) return true;

    return false;
  });
};

/**
 * 카테고리별 템플릿 개수 계산
 */
export const countTemplatesByCategory = (
  templates: PromptTemplate[]
): Record<MainCategory, number> => {
  const counts: Record<string, number> = {
    relationship: 0,
    personality: 0,
    situation: 0,
    interaction: 0
  };

  templates.forEach(template => {
    if (counts[template.category] !== undefined) {
      counts[template.category]++;
    }
  });

  return counts as Record<MainCategory, number>;
};

/**
 * 프롬프트 템플릿 정렬
 */
export const sortPromptTemplates = (
  templates: PromptTemplate[],
  sortBy: 'name' | 'popularity' | 'createdAt' | 'complexity' = 'name',
  order: 'asc' | 'desc' = 'asc'
): PromptTemplate[] => {
  const sorted = [...templates].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'popularity':
        compareValue = (a.popularity || 0) - (b.popularity || 0);
        break;
      case 'createdAt':
        compareValue = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
        break;
      case 'complexity':
        compareValue = calculatePromptComplexity(a) - calculatePromptComplexity(b);
        break;
    }

    return order === 'asc' ? compareValue : -compareValue;
  });

  return sorted;
};

/**
 * 유사한 프롬프트 템플릿 찾기
 */
export const findSimilarTemplates = (
  template: PromptTemplate,
  allTemplates: PromptTemplate[],
  limit: number = 5
): PromptTemplate[] => {
  const similar = allTemplates
    .filter(t => t.id !== template.id)
    .map(t => ({
      template: t,
      score: calculateSimilarityScore(template, t)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.template);

  return similar;
};

/**
 * 두 템플릿 간 유사도 점수 계산
 */
const calculateSimilarityScore = (
  template1: PromptTemplate,
  template2: PromptTemplate
): number => {
  let score = 0;

  // 같은 카테고리
  if (template1.category === template2.category) score += 3;

  // 같은 서브카테고리
  if (template1.subcategory === template2.subcategory) score += 5;

  // 공통 태그
  const commonTags = template1.tags?.filter(tag => 
    template2.tags?.includes(tag)
  ).length || 0;
  score += commonTags * 2;

  // 변수 개수 유사도
  const varDiff = Math.abs(
    (template1.variables?.length || 0) - (template2.variables?.length || 0)
  );
  score += Math.max(0, 3 - varDiff);

  return score;
};

/**
 * 프롬프트 사용 통계 업데이트
 */
export const updatePromptStatistics = (
  template: PromptTemplate,
  usage: 'view' | 'use' | 'rate'
): PromptTemplate => {
  const updated = { ...template };

  if (usage === 'use') {
    updated.popularity = (updated.popularity || 0) + 1;
  }

  updated.updatedAt = new Date();

  return updated;
};

/**
 * 프롬프트 변수 자동 완성 제안
 */
export const suggestVariableValues = (
  variable: PromptVariable,
  userHistory?: Record<string, any>[]
): string[] => {
  const suggestions: string[] = [];

  // 옵션이 있는 경우
  if (variable.options) {
    suggestions.push(...variable.options.map(opt => opt.value));
  }

  // 사용자 히스토리에서 제안
  if (userHistory) {
    const historicalValues = userHistory
      .map(h => h[variable.key])
      .filter(v => v !== undefined && v !== null)
      .filter((v, i, arr) => arr.indexOf(v) === i); // unique values

    suggestions.push(...historicalValues);
  }

  // 기본값 제안
  if (variable.defaultValue !== undefined) {
    suggestions.unshift(String(variable.defaultValue));
  }

  return [...new Set(suggestions)]; // 중복 제거
};