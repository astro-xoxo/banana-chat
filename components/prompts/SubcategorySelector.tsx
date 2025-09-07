/**
 * 서브카테고리 선택 컴포넌트
 * 선택된 메인 카테고리의 서브카테고리를 선택할 수 있는 UI 컴포넌트
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { SubCategory } from '@/lib/prompts/types';
import { getSubcategoriesByCategory, CATEGORIES } from '@/lib/prompts/data/categories';
import { usePromptStore, usePromptActions } from '@/stores/promptStore';

interface SubcategorySelectorProps {
  className?: string;
  variant?: 'grid' | 'list' | 'chips';
  showDescription?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * 서브카테고리 선택 컴포넌트
 */
export const SubcategorySelector: React.FC<SubcategorySelectorProps> = ({
  className,
  variant = 'grid',
  showDescription = true,
  disabled = false,
  emptyMessage = '먼저 카테고리를 선택해주세요.'
}) => {
  const { selectedCategory, selectedSubcategory } = usePromptStore();
  const { setSelectedSubcategory } = usePromptActions();

  // 선택된 카테고리가 없으면 빈 상태 표시
  if (!selectedCategory) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const subcategories = getSubcategoriesByCategory(selectedCategory);
  const selectedCategoryInfo = CATEGORIES.find(c => c.id === selectedCategory);

  const handleSubcategorySelect = (subcategoryId: SubCategory) => {
    if (disabled) return;
    setSelectedSubcategory(subcategoryId === selectedSubcategory ? null : subcategoryId);
  };

  if (variant === 'chips') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap gap-2">
          {subcategories.map((subcategory) => {
            const isSelected = selectedSubcategory === subcategory.id;
            
            return (
              <button
                key={subcategory.id}
                onClick={() => handleSubcategorySelect(subcategory.id as SubCategory)}
                disabled={disabled}
                className={cn(
                  'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium',
                  'transition-colors duration-200',
                  isSelected
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={{ 
                  backgroundColor: isSelected ? selectedCategoryInfo?.color : undefined 
                }}
              >
                <span className="mr-2">{subcategory.icon}</span>
                {subcategory.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        {subcategories.map((subcategory) => {
          const isSelected = selectedSubcategory === subcategory.id;
          
          return (
            <button
              key={subcategory.id}
              onClick={() => handleSubcategorySelect(subcategory.id as SubCategory)}
              disabled={disabled}
              className={cn(
                'w-full flex items-center p-3 rounded-lg border transition-colors duration-200',
                'text-left hover:bg-gray-50',
                isSelected
                  ? 'bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{ 
                borderColor: isSelected ? selectedCategoryInfo?.color : undefined,
                backgroundColor: isSelected ? `${selectedCategoryInfo?.color}15` : undefined 
              }}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div 
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-lg',
                    'transition-colors duration-200',
                    isSelected
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600'
                  )}
                  style={{ 
                    backgroundColor: isSelected ? selectedCategoryInfo?.color : undefined 
                  }}
                >
                  {subcategory.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{subcategory.name}</h4>
                  {showDescription && (
                    <p className="text-xs text-gray-500 mt-1">
                      {subcategory.description}
                    </p>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="w-5 h-5" style={{ color: selectedCategoryInfo?.color }}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // 기본 grid 형태
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      {subcategories.map((subcategory) => {
        const isSelected = selectedSubcategory === subcategory.id;
        
        return (
          <button
            key={subcategory.id}
            onClick={() => handleSubcategorySelect(subcategory.id as SubCategory)}
            disabled={disabled}
            className={cn(
              'group relative p-3 rounded-lg border transition-all duration-200',
              'hover:shadow-md hover:-translate-y-0.5',
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-gray-300',
              disabled && 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none'
            )}
            style={{ 
              borderColor: isSelected ? selectedCategoryInfo?.color : undefined,
              backgroundColor: isSelected ? `${selectedCategoryInfo?.color}15` : undefined 
            }}
          >
            <div className="text-center">
              <div 
                className={cn(
                  'w-10 h-10 mx-auto rounded-lg flex items-center justify-center text-xl mb-2',
                  'transition-colors duration-200',
                  isSelected
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                )}
                style={{ 
                  backgroundColor: isSelected ? selectedCategoryInfo?.color : undefined 
                }}
              >
                {subcategory.icon}
              </div>
              <h4 className="font-medium text-sm text-gray-900 mb-1">
                {subcategory.name}
              </h4>
              {showDescription && (
                <p className="text-xs text-gray-500 line-clamp-2">
                  {subcategory.description}
                </p>
              )}
            </div>
            
            {/* 선택 표시 */}
            {isSelected && (
              <div 
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: selectedCategoryInfo?.color }}
              >
                ✓
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * 선택된 서브카테고리 표시 컴포넌트
 */
export const SelectedSubcategoryBreadcrumb: React.FC<{
  className?: string;
  showClear?: boolean;
  onClear?: () => void;
}> = ({ className, showClear = true, onClear }) => {
  const { selectedCategory, selectedSubcategory } = usePromptStore();
  const { setSelectedCategory, setSelectedSubcategory } = usePromptActions();

  if (!selectedCategory) return null;

  const category = CATEGORIES.find(c => c.id === selectedCategory);
  const subcategory = selectedSubcategory 
    ? getSubcategoriesByCategory(selectedCategory).find(s => s.id === selectedSubcategory)
    : null;

  const handleClearCategory = () => {
    setSelectedCategory(null);
    onClear?.();
  };

  const handleClearSubcategory = () => {
    setSelectedSubcategory(null);
    onClear?.();
  };

  return (
    <div className={cn('flex items-center space-x-2 text-sm', className)}>
      {/* 카테고리 */}
      <div 
        className="inline-flex items-center px-2 py-1 rounded-md text-white font-medium"
        style={{ backgroundColor: category?.color }}
      >
        <span className="mr-1">{category?.icon}</span>
        <span>{category?.name}</span>
        {showClear && (
          <button
            onClick={handleClearCategory}
            className="ml-1 w-4 h-4 rounded-full bg-white bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center transition-colors"
          >
            <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* 화살표 */}
      {subcategory && (
        <>
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>

          {/* 서브카테고리 */}
          <div 
            className="inline-flex items-center px-2 py-1 rounded-md text-white font-medium"
            style={{ backgroundColor: category?.color }}
          >
            <span className="mr-1">{subcategory.icon}</span>
            <span>{subcategory.name}</span>
            {showClear && (
              <button
                onClick={handleClearSubcategory}
                className="ml-1 w-4 h-4 rounded-full bg-white bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center transition-colors"
              >
                <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SubcategorySelector;