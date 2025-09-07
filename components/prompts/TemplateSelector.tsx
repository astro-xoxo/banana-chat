/**
 * 템플릿 선택 컴포넌트
 * 카테고리와 서브카테고리에 맞는 프롬프트 템플릿을 선택할 수 있는 UI 컴포넌트
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PromptTemplate } from '@/lib/prompts/types';
import { usePromptStore, usePromptActions } from '@/stores/promptStore';
import { getTemplatesBySubcategory } from '@/lib/prompts/data/templates';

interface TemplateSelectorProps {
  className?: string;
  variant?: 'grid' | 'list' | 'compact';
  showDescription?: boolean;
  showTags?: boolean;
  showExamples?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * 템플릿 카드 컴포넌트
 */
const TemplateCard: React.FC<{
  template: PromptTemplate;
  isSelected: boolean;
  onClick: () => void;
  variant: 'grid' | 'list' | 'compact';
  showDescription?: boolean;
  showTags?: boolean;
  showExamples?: boolean;
  disabled?: boolean;
}> = ({
  template,
  isSelected,
  onClick,
  variant,
  showDescription = true,
  showTags = true,
  showExamples = false,
  disabled = false
}) => {
  const hasVariables = template.variables && template.variables.length > 0;
  const requiredVarsCount = template.variables?.filter(v => v.required).length || 0;

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-full text-left p-3 rounded-lg border transition-colors duration-200',
          'hover:bg-gray-50',
          isSelected
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-200 text-gray-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{template.name}</h3>
            {showDescription && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {template.description}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasVariables && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {requiredVarsCount > 0 ? `${requiredVarsCount}개 필수` : '선택사항'}
              </span>
            )}
            {isSelected && (
              <div className="w-5 h-5 text-blue-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }

  if (variant === 'list') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-full text-left p-4 rounded-lg border transition-all duration-200',
          'hover:shadow-md',
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-lg'
            : 'border-gray-200 bg-white hover:border-gray-300',
          disabled && 'opacity-50 cursor-not-allowed hover:shadow-none'
        )}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-900">
                {template.name}
              </h3>
              {showDescription && (
                <p className="text-gray-600 mt-1">
                  {template.description}
                </p>
              )}
            </div>
            {isSelected && (
              <div className="w-6 h-6 text-blue-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          {/* 변수 정보 */}
          {hasVariables && (
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>📝 {template.variables!.length}개 변수</span>
              {requiredVarsCount > 0 && (
                <span className="text-red-500">🔴 {requiredVarsCount}개 필수</span>
              )}
            </div>
          )}

          {/* 태그 */}
          {showTags && template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 예제 */}
          {showExamples && template.examples && template.examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">예제:</p>
              {template.examples.slice(0, 2).map((example, index) => (
                <div key={index} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  &quot;{example}&quot;
                </div>
              ))}
            </div>
          )}
        </div>
      </button>
    );
  }

  // 기본 grid 형태
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative p-4 rounded-xl border transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-1',
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-xl'
          : 'border-gray-200 bg-white hover:border-gray-300',
        disabled && 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none'
      )}
    >
      <div className="text-left space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600">
              {template.name}
            </h3>
            {showDescription && (
              <p className="text-gray-600 text-sm mt-1 line-clamp-3">
                {template.description}
              </p>
            )}
          </div>
        </div>

        {/* 변수 정보 */}
        {hasVariables && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>📝 {template.variables!.length}개 변수</span>
            {requiredVarsCount > 0 && (
              <span className="bg-red-100 text-red-600 px-2 py-1 rounded">
                {requiredVarsCount}개 필수
              </span>
            )}
          </div>
        )}

        {/* 태그 */}
        {showTags && template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="text-xs text-gray-400">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 인기도 */}
        {template.popularity && template.popularity > 0 && (
          <div className="flex items-center text-xs text-gray-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {template.popularity}회 사용
          </div>
        )}
      </div>

      {/* 선택 표시 */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
          ✓
        </div>
      )}
    </button>
  );
};

/**
 * 템플릿 선택 컴포넌트
 */
export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  className,
  variant = 'grid',
  showDescription = true,
  showTags = true,
  showExamples = false,
  disabled = false,
  emptyMessage = '선택할 수 있는 템플릿이 없습니다.'
}) => {
  const {
    selectedCategory,
    selectedSubcategory,
    selectedTemplate,
    filteredTemplates
  } = usePromptStore();
  const { setSelectedTemplate } = usePromptActions();

  // 현재 선택에 맞는 템플릿 필터링
  const availableTemplates = useMemo(() => {
    if (!selectedCategory || !selectedSubcategory) {
      return [];
    }

    return getTemplatesBySubcategory(selectedCategory, selectedSubcategory);
  }, [selectedCategory, selectedSubcategory]);

  const handleTemplateSelect = (template: PromptTemplate) => {
    if (disabled) return;
    setSelectedTemplate(template.id === selectedTemplate?.id ? null : template);
  };

  // 카테고리나 서브카테고리가 선택되지 않은 경우
  if (!selectedCategory || !selectedSubcategory) {
    return (
      <div className={cn('text-center py-12 text-gray-500', className)}>
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-lg font-medium">카테고리를 선택해주세요</p>
        <p className="text-sm mt-2">카테고리와 서브카테고리를 선택하면<br />사용 가능한 템플릿을 확인할 수 있습니다.</p>
      </div>
    );
  }

  // 템플릿이 없는 경우
  if (availableTemplates.length === 0) {
    return (
      <div className={cn('text-center py-12 text-gray-500', className)}>
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-lg font-medium">템플릿이 없습니다</p>
        <p className="text-sm mt-2">{emptyMessage}</p>
      </div>
    );
  }

  const gridClasses = {
    grid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
    list: 'space-y-4',
    compact: 'space-y-2'
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            템플릿 선택
          </h3>
          <p className="text-sm text-gray-500">
            {availableTemplates.length}개의 템플릿이 있습니다
          </p>
        </div>
      </div>

      {/* 템플릿 목록 */}
      <div className={gridClasses[variant]}>
        {availableTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplate?.id === template.id}
            onClick={() => handleTemplateSelect(template)}
            variant={variant}
            showDescription={showDescription}
            showTags={showTags}
            showExamples={showExamples}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;