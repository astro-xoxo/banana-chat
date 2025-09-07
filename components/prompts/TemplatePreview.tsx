/**
 * 템플릿 미리보기 컴포넌트
 * 선택된 프롬프트 템플릿을 미리보기하고 변수를 설정할 수 있는 UI 컴포넌트
 */

'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PromptTemplate, PromptVariable } from '@/lib/prompts/types';
import { usePromptStore, usePromptActions } from '@/stores/promptStore';
import { generatePromptPreview } from '@/lib/prompts/utils';

interface TemplatePreviewProps {
  className?: string;
  showVariables?: boolean;
  showExamples?: boolean;
  maxPreviewLength?: number;
  variant?: 'card' | 'full' | 'compact';
}

/**
 * 변수 입력 컴포넌트
 */
const VariableInput: React.FC<{
  variable: PromptVariable;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}> = ({ variable, value, onChange, disabled }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let newValue: any = e.target.value;
    
    if (variable.type === 'number') {
      newValue = Number(newValue);
    } else if (variable.type === 'boolean') {
      newValue = (e.target as HTMLInputElement).checked;
    }
    
    onChange(newValue);
  };

  const baseInputClasses = cn(
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {variable.label}
        {variable.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {variable.type === 'select' && variable.options ? (
        <select
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          className={baseInputClasses}
        >
          <option value="">선택해주세요</option>
          {variable.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : variable.type === 'boolean' ? (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={!!value}
            onChange={handleChange}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
          />
          <span className="ml-2 text-sm text-gray-600">활성화</span>
        </div>
      ) : variable.type === 'number' ? (
        <input
          type="number"
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder={variable.placeholder}
          min={variable.validation?.min}
          max={variable.validation?.max}
          className={baseInputClasses}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          placeholder={variable.placeholder || `${variable.label}을(를) 입력하세요`}
          className={baseInputClasses}
        />
      )}
      
      {variable.validation?.message && (
        <p className="text-xs text-gray-500">{variable.validation.message}</p>
      )}
    </div>
  );
};

/**
 * 템플릿 미리보기 컴포넌트
 */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  className,
  showVariables = true,
  showExamples = true,
  maxPreviewLength = 300,
  variant = 'card'
}) => {
  const {
    selectedTemplate,
    variableValues,
    generatedPrompt,
    error
  } = usePromptStore();
  const { setVariableValue, generatePrompt } = usePromptActions();

  const [previewMode, setPreviewMode] = useState<'template' | 'generated'>('template');

  // 템플릿이 변경되면 자동으로 프롬프트 생성
  useEffect(() => {
    if (selectedTemplate && Object.keys(variableValues).length > 0) {
      generatePrompt();
    }
  }, [selectedTemplate, variableValues, generatePrompt]);

  if (!selectedTemplate) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p>템플릿을 선택하면 미리보기를 확인할 수 있습니다.</p>
      </div>
    );
  }

  const hasVariables = selectedTemplate.variables && selectedTemplate.variables.length > 0;
  const preview = generatePromptPreview(selectedTemplate, variableValues, maxPreviewLength);

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-sm text-gray-900">
              {selectedTemplate.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {selectedTemplate.description}
            </p>
          </div>
          <div className="flex space-x-2">
            {hasVariables && (
              <button
                onClick={() => setPreviewMode(previewMode === 'template' ? 'generated' : 'template')}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {previewMode === 'template' ? '결과' : '템플릿'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {previewMode === 'template' ? selectedTemplate.template : (generatedPrompt || preview)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 템플릿 정보 */}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedTemplate.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {selectedTemplate.description}
            </p>
          </div>
          
          {/* 태그 */}
          {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedTemplate.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 변수 입력 */}
      {showVariables && hasVariables && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">변수 설정</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedTemplate.variables!.map((variable) => (
              <VariableInput
                key={variable.key}
                variable={variable}
                value={variableValues[variable.key]}
                onChange={(value) => setVariableValue(variable.key, value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 미리보기 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">미리보기</h3>
          {hasVariables && (
            <div className="flex space-x-2">
              <button
                onClick={() => setPreviewMode('template')}
                className={cn(
                  'px-3 py-1 text-sm rounded-md',
                  previewMode === 'template'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                템플릿
              </button>
              <button
                onClick={() => setPreviewMode('generated')}
                className={cn(
                  'px-3 py-1 text-sm rounded-md',
                  previewMode === 'generated'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                생성 결과
              </button>
            </div>
          )}
        </div>

        <div className={cn(
          'p-4 rounded-lg border',
          error ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
        )}>
          {error ? (
            <div className="text-red-600">
              <p className="font-medium">오류가 발생했습니다:</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {previewMode === 'template' 
                ? selectedTemplate.template 
                : (generatedPrompt || preview)
              }
            </pre>
          )}
        </div>
      </div>

      {/* 예제 */}
      {showExamples && selectedTemplate.examples && selectedTemplate.examples.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">예제</h3>
          <div className="space-y-2">
            {selectedTemplate.examples.map((example, index) => (
              <div
                key={index}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <p className="text-sm text-blue-800">{example}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => generatePrompt()}
          disabled={!hasVariables}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium',
            hasVariables
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
        >
          프롬프트 생성
        </button>
      </div>
    </div>
  );
};

export default TemplatePreview;