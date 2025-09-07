/**
 * StyleApplicator - 스타일을 프롬프트에 적용하는 서비스
 * Task 010: Ensure Image Style Consistency
 */

import type { 
  StyleParameters, 
  StyleApplicationResult,
  StyleConsistencyOptions 
} from './types';

export class StyleApplicator {
  
  /**
   * 스타일 매개변수를 프롬프트에 적용
   */
  async applyStyleToPrompt(
    prompt: string,
    styleParams: StyleParameters,
    options: StyleConsistencyOptions = {
      enforce_user_style: true,
      style_weight: 0.7,
      allow_style_variation: true,
      fallback_to_default: true
    }
  ): Promise<StyleApplicationResult> {
    try {
      console.log('StyleApplicator: 스타일 적용 시작', {
        prompt_length: prompt.length,
        style_params: styleParams,
        options
      });

      let styledPrompt = prompt;
      const appliedStyles: StyleParameters = {};
      let confidenceScore = 0.5;
      let styleSource: StyleApplicationResult['style_source'] = 'default';

      // 스타일 매개변수가 있는 경우에만 적용
      if (styleParams && Object.keys(styleParams).length > 0) {
        styleSource = 'user_preference';
        
        // 각 스타일 속성을 프롬프트에 적용
        const styleText = this.buildStyleText(styleParams, options);
        
        if (styleText) {
          // 기존 프롬프트에 스타일 추가
          styledPrompt = this.integrateStyleIntoPrompt(prompt, styleText, options);
          appliedStyles = { ...styleParams };
          confidenceScore = this.calculateApplicationConfidence(styleParams, options);
        }
      }

      // 스타일이 적용되지 않았고 폴백이 허용된 경우 기본 스타일 적용
      if (styledPrompt === prompt && options.fallback_to_default) {
        const defaultStyle = this.getDefaultStyle();
        const defaultStyleText = this.buildStyleText(defaultStyle, options);
        
        if (defaultStyleText) {
          styledPrompt = this.integrateStyleIntoPrompt(prompt, defaultStyleText, options);
          appliedStyles = defaultStyle;
          styleSource = 'default';
          confidenceScore = 0.6;
        }
      }

      const result: StyleApplicationResult = {
        original_prompt: prompt,
        styled_prompt: styledPrompt,
        applied_styles: appliedStyles,
        confidence_score: confidenceScore,
        style_source: styleSource
      };

      console.log('StyleApplicator: 스타일 적용 완료', {
        original_length: prompt.length,
        styled_length: styledPrompt.length,
        applied_styles: Object.keys(appliedStyles),
        confidence: confidenceScore,
        source: styleSource
      });

      return result;

    } catch (error) {
      console.error('StyleApplicator: 스타일 적용 오류', { prompt, styleParams, error });
      
      // 오류 시 원본 프롬프트 반환
      return {
        original_prompt: prompt,
        styled_prompt: prompt,
        applied_styles: {},
        confidence_score: 0,
        style_source: 'default'
      };
    }
  }

  /**
   * 스타일 매개변수를 텍스트로 변환
   */
  private buildStyleText(styleParams: StyleParameters, options: StyleConsistencyOptions): string {
    const styleElements: string[] = [];

    // 색상 팔레트
    if (styleParams.color_palette) {
      styleElements.push(this.formatColorPalette(styleParams.color_palette));
    }

    // 조명
    if (styleParams.lighting) {
      styleElements.push(this.formatLighting(styleParams.lighting));
    }

    // 구도
    if (styleParams.composition) {
      styleElements.push(this.formatComposition(styleParams.composition));
    }

    // 디테일 레벨
    if (styleParams.detail_level) {
      styleElements.push(this.formatDetailLevel(styleParams.detail_level));
    }

    // 예술적 스타일
    if (styleParams.artistic_style) {
      styleElements.push(this.formatArtisticStyle(styleParams.artistic_style));
    }

    // 분위기
    if (styleParams.mood) {
      styleElements.push(this.formatMood(styleParams.mood));
    }

    // 텍스처
    if (styleParams.texture) {
      styleElements.push(this.formatTexture(styleParams.texture));
    }

    // 대비
    if (styleParams.contrast) {
      styleElements.push(this.formatContrast(styleParams.contrast));
    }

    // 스타일 가중치 적용
    if (options.style_weight < 1 && styleElements.length > 0) {
      const elementsToKeep = Math.ceil(styleElements.length * options.style_weight);
      return styleElements.slice(0, elementsToKeep).join(', ');
    }

    return styleElements.join(', ');
  }

  /**
   * 스타일 텍스트를 프롬프트에 통합
   */
  private integrateStyleIntoPrompt(
    prompt: string, 
    styleText: string, 
    options: StyleConsistencyOptions
  ): string {
    if (!styleText) return prompt;

    // 스타일 변화 허용 여부에 따른 통합 방식
    if (options.allow_style_variation) {
      // 자연스럽게 통합
      return `${prompt}, ${styleText}`;
    } else {
      // 강제 적용
      return `${styleText}, ${prompt}`;
    }
  }

  /**
   * 적용 신뢰도 계산
   */
  private calculateApplicationConfidence(
    styleParams: StyleParameters, 
    options: StyleConsistencyOptions
  ): number {
    let confidence = 0.5; // 기본 신뢰도

    // 스타일 매개변수 수에 따른 신뢰도
    const paramCount = Object.keys(styleParams).length;
    confidence += Math.min(paramCount * 0.05, 0.2);

    // 스타일 가중치에 따른 조정
    confidence *= options.style_weight;

    // 강제 적용 시 신뢰도 증가
    if (options.enforce_user_style) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 기본 스타일 반환
   */
  private getDefaultStyle(): StyleParameters {
    return {
      color_palette: 'natural colors',
      lighting: 'natural lighting',
      composition: 'balanced composition',
      detail_level: 'detailed',
      artistic_style: 'professional',
      mood: 'pleasant',
      contrast: 'medium contrast'
    };
  }

  // 포맷터 메서드들

  private formatColorPalette(colorPalette: string): string {
    const colorMappings: { [key: string]: string } = {
      'warm colors': 'warm color palette',
      'cool colors': 'cool color palette',
      'natural colors': 'natural color tones',
      'vibrant colors': 'vibrant and colorful',
      'monochromatic': 'monochromatic color scheme',
      'pastel': 'soft pastel colors',
      'earth tones': 'earthy color palette'
    };

    return colorMappings[colorPalette] || colorPalette;
  }

  private formatLighting(lighting: string): string {
    const lightingMappings: { [key: string]: string } = {
      'natural': 'natural lighting',
      'dramatic': 'dramatic lighting',
      'soft': 'soft diffused lighting',
      'bright': 'bright even lighting',
      'moody': 'moody atmospheric lighting',
      'golden': 'golden hour lighting',
      'studio': 'professional studio lighting'
    };

    return lightingMappings[lighting] || `${lighting} lighting`;
  }

  private formatComposition(composition: string): string {
    const compositionMappings: { [key: string]: string } = {
      'centered': 'centered composition',
      'rule_of_thirds': 'rule of thirds composition',
      'dynamic': 'dynamic composition',
      'balanced': 'well-balanced composition',
      'asymmetric': 'asymmetric composition',
      'minimalist': 'minimalist composition'
    };

    return compositionMappings[composition] || `${composition} composition`;
  }

  private formatDetailLevel(detailLevel: string): string {
    const detailMappings: { [key: string]: string } = {
      'minimal': 'clean and minimal',
      'moderate': 'moderate detail',
      'high': 'highly detailed',
      'ultra_detailed': 'ultra detailed, intricate',
      'simple': 'simple and clean',
      'complex': 'complex and detailed'
    };

    return detailMappings[detailLevel] || detailLevel;
  }

  private formatArtisticStyle(artisticStyle: string): string {
    const styleMappings: { [key: string]: string } = {
      'realistic': 'photorealistic style',
      'artistic': 'artistic style',
      'abstract': 'abstract art style',
      'stylized': 'stylized illustration',
      'impressionist': 'impressionist style',
      'modern': 'modern art style',
      'classic': 'classical art style'
    };

    return styleMappings[artisticStyle] || `${artisticStyle} style`;
  }

  private formatMood(mood: string): string {
    const moodMappings: { [key: string]: string } = {
      'cheerful': 'cheerful and uplifting mood',
      'calm': 'calm and peaceful atmosphere',
      'dramatic': 'dramatic and intense mood',
      'mysterious': 'mysterious atmosphere',
      'energetic': 'energetic and dynamic',
      'serene': 'serene and tranquil',
      'melancholic': 'melancholic mood',
      'pleasant': 'pleasant atmosphere'
    };

    return moodMappings[mood] || `${mood} mood`;
  }

  private formatTexture(texture: string): string {
    const textureMappings: { [key: string]: string } = {
      'smooth': 'smooth textures',
      'rough': 'rough textured surfaces',
      'soft': 'soft and smooth textures',
      'sharp': 'sharp and crisp details',
      'organic': 'organic natural textures',
      'geometric': 'geometric patterns',
      'flowing': 'flowing organic forms'
    };

    return textureMappings[texture] || `${texture} texture`;
  }

  private formatContrast(contrast: string): string {
    const contrastMappings: { [key: string]: string } = {
      'low': 'low contrast, soft gradients',
      'medium': 'balanced contrast',
      'high': 'high contrast, bold',
      'dramatic': 'dramatic high contrast',
      'subtle': 'subtle contrast variations'
    };

    return contrastMappings[contrast] || `${contrast} contrast`;
  }

  /**
   * 스타일 호환성 검사
   */
  checkStyleCompatibility(styleParams: StyleParameters): {
    compatible: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 상충되는 스타일 조합 검사
    if (styleParams.mood === 'cheerful' && styleParams.lighting === 'dramatic') {
      warnings.push('밝은 분위기와 드라마틱한 조명이 상충될 수 있습니다');
      suggestions.push('자연스러운 조명이나 부드러운 조명을 고려해보세요');
    }

    if (styleParams.detail_level === 'minimal' && styleParams.artistic_style === 'ultra_detailed') {
      warnings.push('미니멀 디테일과 초상세한 스타일이 모순됩니다');
      suggestions.push('일관된 디테일 레벨을 선택해주세요');
    }

    if (styleParams.color_palette === 'monochromatic' && styleParams.mood === 'energetic') {
      warnings.push('단색 팔레트는 에너지틱한 분위기와 잘 맞지 않을 수 있습니다');
      suggestions.push('비브런트한 색상 팔레트를 고려해보세요');
    }

    return {
      compatible: warnings.length === 0,
      warnings,
      suggestions
    };
  }

  /**
   * 스타일 최적화 제안
   */
  suggestStyleOptimizations(styleParams: StyleParameters): string[] {
    const suggestions: string[] = [];

    // 색상과 조명의 조화
    if (styleParams.color_palette === 'warm colors' && styleParams.lighting === 'cool') {
      suggestions.push('따뜻한 색상에는 골든 아워나 자연스러운 조명이 잘 어울립니다');
    }

    // 구도와 분위기의 조화
    if (styleParams.composition === 'dynamic' && styleParams.mood === 'calm') {
      suggestions.push('역동적인 구도에는 에너지틱하거나 드라마틱한 분위기가 더 적합합니다');
    }

    // 디테일과 스타일의 조화
    if (styleParams.detail_level === 'ultra_detailed' && styleParams.artistic_style === 'abstract') {
      suggestions.push('추상적 스타일에는 적당한 디테일 레벨이 더 효과적입니다');
    }

    return suggestions;
  }
}
