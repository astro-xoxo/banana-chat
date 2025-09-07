/**
 * 카테고리 선택 컴포넌트
 * 메인 카테고리를 선택할 수 있는 UI 컴포넌트
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { MainCategory } from '@/lib/prompts/types';
import { CATEGORIES } from '@/lib/prompts/data/categories';
import { usePromptStore, usePromptActions } from '@/stores/promptStore';

interface CategorySelectorProps {
  className?: string;
  variant?: 'grid' | 'list' | 'tabs';
  showDescription?: boolean;
  disabled?: boolean;
}

/**
 * 카테고리 선택 컴포넌트
 */
export const CategorySelector: React.FC<CategorySelectorProps> = ({
  className,
  variant = 'grid',
  showDescription = true,
  disabled = false
}) => {
  const selectedCategory = usePromptStore((state) => state.selectedCategory);
  const { setSelectedCategory } = usePromptActions();

  const handleCategorySelect = (categoryId: MainCategory) => {
    if (disabled) return;
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
  };

  if (variant === 'tabs') {
    return (
      <div className={cn('w-full', className)}>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  disabled={disabled}
                  className={cn(
                    'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm',
                    'transition-colors duration-200',
                    isSelected
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              disabled={disabled}
              className={cn(
                'w-full flex items-center p-3 rounded-lg border transition-colors duration-200',
                'text-left hover:bg-gray-50',
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center space-x-3 flex-1">
                <div 
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
                    'transition-colors duration-200',
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {category.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{category.name}</h3>
                  {showDescription && (
                    <p className="text-xs text-gray-500 mt-1">
                      {category.description}
                    </p>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="w-5 h-5 text-blue-500">
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
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-4', className)}>
      {CATEGORIES.map((category) => {
        const isSelected = selectedCategory === category.id;
        
        return (
          <button
            key={category.id}
            onClick={() => handleCategorySelect(category.id)}
            disabled={disabled}
            className={cn(
              'group relative p-4 rounded-xl border transition-all duration-200',
              'hover:shadow-md hover:-translate-y-1',
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-200 bg-white hover:border-gray-300',
              disabled && 'opacity-50 cursor-not-allowed hover:transform-none hover:shadow-none'
            )}
            style={{ 
              borderColor: isSelected ? category.color : undefined,
              backgroundColor: isSelected ? `${category.color}15` : undefined 
            }}
          >
            <div className="text-center">
              <div 
                className={cn(
                  'w-12 h-12 mx-auto rounded-full flex items-center justify-center text-2xl mb-2',
                  'transition-colors duration-200',
                  isSelected
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                )}
                style={{ 
                  backgroundColor: isSelected ? category.color : undefined 
                }}
              >
                {category.icon}
              </div>
              <h3 className="font-semibold text-sm text-gray-900 mb-1">
                {category.name}
              </h3>
              {showDescription && (
                <p className="text-xs text-gray-500 line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
            
            {/* 선택 표시 */}
            {isSelected && (
              <div 
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: category.color }}
              >
                ✓
              </div>
            )}
            
            {/* 서브카테고리 개수 표시 */}
            <div className="absolute top-2 left-2 text-xs text-gray-400">
              {category.subcategories.length}
            </div>
          </button>
        );
      })}
    </div>
  );
};

/**
 * 선택된 카테고리 표시 컴포넌트
 */
export const SelectedCategoryBadge: React.FC<{
  className?: string;
  showClear?: boolean;
  onClear?: () => void;
}> = ({ className, showClear = true, onClear }) => {
  const selectedCategory = usePromptStore((state) => state.selectedCategory);
  const { setSelectedCategory } = usePromptActions();

  if (!selectedCategory) return null;

  const category = CATEGORIES.find(c => c.id === selectedCategory);
  if (!category) return null;

  const handleClear = () => {
    setSelectedCategory(null);
    onClear?.();
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
        'text-white',
        className
      )}
      style={{ backgroundColor: category.color }}
    >
      <span className="mr-2">{category.icon}</span>
      <span>{category.name}</span>
      {showClear && (
        <button
          onClick={handleClear}
          className="ml-2 w-4 h-4 rounded-full bg-white bg-opacity-30 hover:bg-opacity-50 flex items-center justify-center transition-colors"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default CategorySelector;