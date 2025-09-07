/**
 * 프롬프트 빌더 컴포넌트
 * 카테고리 선택부터 최종 프롬프트 생성까지 통합 UI
 */

'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Wand2, Copy, Check, RotateCcw } from 'lucide-react';

import { CategorySelector } from './CategorySelector';
import { SubcategorySelector, SelectedSubcategoryBreadcrumb } from './SubcategorySelector';
import { TemplateSelector } from './TemplateSelector';
import { TemplatePreview } from './TemplatePreview';

import { usePromptStore, usePromptActions } from '@/stores/promptStore';

interface PromptBuilderProps {
  className?: string;
  onPromptGenerated?: (prompt: string, templateId: string, variables: Record<string, any>) => void;
  onBack?: () => void;
  showNavigation?: boolean;
  allowGeneration?: boolean;
}

type BuilderStep = 'category' | 'subcategory' | 'template' | 'preview' | 'generate';

/**
 * 프롬프트 빌더 메인 컴포넌트
 */
export const PromptBuilder: React.FC<PromptBuilderProps> = ({
  className,
  onPromptGenerated,
  onBack,
  showNavigation = true,
  allowGeneration = true
}) => {
  const [currentStep, setCurrentStep] = useState<BuilderStep>('category');
  const [copied, setCopied] = useState(false);

  const {
    selectedCategory,
    selectedSubcategory,
    selectedTemplate,
    generatedPrompt,
    variableValues,
    error
  } = usePromptStore();

  const { generatePrompt, resetSelection } = usePromptActions();

  // 단계 자동 진행
  useEffect(() => {
    if (selectedCategory && !selectedSubcategory && currentStep === 'category') {
      setCurrentStep('subcategory');
    }
    if (selectedSubcategory && !selectedTemplate && currentStep === 'subcategory') {
      setCurrentStep('template');
    }
    if (selectedTemplate && currentStep === 'template') {
      setCurrentStep('preview');
    }
  }, [selectedCategory, selectedSubcategory, selectedTemplate, currentStep]);

  // 프롬프트 생성 완료 처리
  useEffect(() => {
    if (generatedPrompt && allowGeneration && onPromptGenerated) {
      onPromptGenerated(generatedPrompt, selectedTemplate?.id || '', variableValues);
    }
  }, [generatedPrompt, allowGeneration, onPromptGenerated, selectedTemplate, variableValues]);

  const handleNext = () => {
    const steps: BuilderStep[] = ['category', 'subcategory', 'template', 'preview', 'generate'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const steps: BuilderStep[] = ['category', 'subcategory', 'template', 'preview', 'generate'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleGeneratePrompt = () => {
    generatePrompt();
    if (allowGeneration) {
      setCurrentStep('generate');
    }
  };

  const handleCopyPrompt = async () => {
    if (generatedPrompt) {
      try {
        await navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('클립보드 복사 실패:', error);
      }
    }
  };

  const handleReset = () => {
    resetSelection();
    setCurrentStep('category');
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'category': return '카테고리 선택';
      case 'subcategory': return '세부 분류 선택';
      case 'template': return '템플릿 선택';
      case 'preview': return '프롬프트 설정';
      case 'generate': return '완성된 프롬프트';
      default: return '프롬프트 생성';
    }
  };

  const getStepProgress = () => {
    const steps = ['category', 'subcategory', 'template', 'preview', 'generate'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'category': return !!selectedCategory;
      case 'subcategory': return !!selectedSubcategory;
      case 'template': return !!selectedTemplate;
      case 'preview': return !!selectedTemplate;
      case 'generate': return !!generatedPrompt;
      default: return false;
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 헤더 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              AI 캐릭터 프롬프트 생성
            </h2>
            <p className="text-gray-600 mt-1">
              단계별로 선택하여 완벽한 AI 캐릭터를 만들어보세요
            </p>
          </div>
          
          {showNavigation && onBack && (
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              뒤로
            </Button>
          )}
        </div>

        {/* 진행 상태 */}
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{getStepTitle()}</h3>
                <span className="text-sm text-gray-500">
                  {Math.round(getStepProgress())}% 완료
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getStepProgress()}%` }}
                />
              </div>

              {/* 선택 상태 표시 */}
              {(selectedCategory || selectedSubcategory || selectedTemplate) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <SelectedSubcategoryBreadcrumb 
                    showClear={false}
                  />
                  {selectedTemplate && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      📝 {selectedTemplate.name}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 선택 단계 */}
        <div className="lg:col-span-2 space-y-6">
          {currentStep === 'category' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white text-sm rounded-full flex items-center justify-center">1</span>
                  카테고리를 선택하세요
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategorySelector 
                  variant="grid"
                  showDescription={true}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'subcategory' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white text-sm rounded-full flex items-center justify-center">2</span>
                  세부 분류를 선택하세요
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SubcategorySelector 
                  variant="grid"
                  showDescription={true}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'template' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white text-sm rounded-full flex items-center justify-center">3</span>
                  템플릿을 선택하세요
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TemplateSelector 
                  variant="grid"
                  showDescription={true}
                  showTags={true}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'preview' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white text-sm rounded-full flex items-center justify-center">4</span>
                  프롬프트 설정 및 미리보기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TemplatePreview 
                  showVariables={true}
                  showExamples={true}
                  variant="full"
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 'generate' && generatedPrompt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-500 text-white text-sm rounded-full flex items-center justify-center">✓</span>
                  완성된 프롬프트
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {generatedPrompt}
                  </pre>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleCopyPrompt}
                    variant="outline"
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        복사됨!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        프롬프트 복사
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleReset}
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    다시 만들기
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 에러 표시 */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                    !
                  </div>
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="space-y-6">
          {selectedTemplate && currentStep !== 'generate' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">미리보기</CardTitle>
              </CardHeader>
              <CardContent>
                <TemplatePreview 
                  variant="compact"
                  showVariables={false}
                  showExamples={false}
                />
              </CardContent>
            </Card>
          )}

          {/* 도움말 */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                팁
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-600 space-y-2">
              {currentStep === 'category' && (
                <div>
                  <p>🎯 AI와의 <strong>관계</strong>나 <strong>성격</strong>을 먼저 정해보세요.</p>
                  <p>📝 각 카테고리는 다양한 세부 옵션을 제공합니다.</p>
                </div>
              )}
              {currentStep === 'subcategory' && (
                <div>
                  <p>⚡ 원하는 세부 특성을 선택하세요.</p>
                  <p>🎨 선택에 따라 적합한 템플릿이 제공됩니다.</p>
                </div>
              )}
              {currentStep === 'template' && (
                <div>
                  <p>📋 각 템플릿의 <strong>설명</strong>과 <strong>예제</strong>를 확인하세요.</p>
                  <p>🔧 변수가 있는 템플릿은 더 개인화된 결과를 제공합니다.</p>
                </div>
              )}
              {currentStep === 'preview' && (
                <div>
                  <p>✏️ 변수 값을 입력해서 개성을 추가하세요.</p>
                  <p>👀 실시간 미리보기로 결과를 확인할 수 있습니다.</p>
                </div>
              )}
              {currentStep === 'generate' && (
                <div>
                  <p>🎉 완성된 프롬프트를 복사해서 사용하세요!</p>
                  <p>🔄 다른 설정으로 새롭게 만들어볼 수도 있습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 네비게이션 버튼 */}
      {showNavigation && currentStep !== 'generate' && (
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentStep === 'category'}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            이전 단계
          </Button>

          <div className="flex gap-3">
            {currentStep === 'preview' && selectedTemplate && (
              <Button 
                onClick={handleGeneratePrompt}
                disabled={!canProceed() || !!error}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                프롬프트 생성
              </Button>
            )}
            
            {currentStep !== 'preview' && (
              <Button 
                onClick={handleNext}
                disabled={!canProceed()}
              >
                다음 단계
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptBuilder;