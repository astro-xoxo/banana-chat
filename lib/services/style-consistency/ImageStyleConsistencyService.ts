/**
 * ImageStyleConsistencyService - 메인 이미지 스타일 일관성 서비스
 * Task 010: Ensure Image Style Consistency
 */

import { StyleExtractionService } from './StyleExtractionService';
import { UserStyleManager } from './UserStyleManager';
import { StyleApplicator } from './StyleApplicator';
import type {
  ImageStyleConsistency,
  ExtractedStyle,
  StyleParameters,
  StyleApplicationResult,
  StyleConsistencyOptions,
  UserStylePreferences
} from './types';

export class ImageStyleConsistencyService implements ImageStyleConsistency {
  private styleExtraction: StyleExtractionService;
  private userStyleManager: UserStyleManager;
  private styleApplicator: StyleApplicator;

  constructor() {
    this.styleExtraction = new StyleExtractionService();
    this.userStyleManager = new UserStyleManager();
    this.styleApplicator = new StyleApplicator();
  }

  /**
   * 이미지에서 스타일 추출
   */
  async extractStyleFromImage(imageUrl: string): Promise<ExtractedStyle> {
    try {
      console.log('ImageStyleConsistencyService: 이미지 스타일 추출 시작', { imageUrl });
      
      const extractedStyle = await this.styleExtraction.extractStyleFromImage(imageUrl);
      
      console.log('ImageStyleConsistencyService: 스타일 추출 완료', {
        imageUrl,
        confidence: extractedStyle.confidence_score,
        dominant_colors: extractedStyle.dominant_colors,
        lighting: extractedStyle.lighting,
        artistic_style: extractedStyle.artistic_style
      });
      
      return extractedStyle;
      
    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 추출 오류', { imageUrl, error });
      throw error;
    }
  }

  /**
   * 사용자 스타일 매개변수 조회
   */
  async getUserStyleParameters(userId: string): Promise<StyleParameters | null> {
    try {
      console.log('ImageStyleConsistencyService: 사용자 스타일 매개변수 조회', { userId });
      
      return await this.userStyleManager.getUserStyleParameters(userId);
      
    } catch (error) {
      console.error('ImageStyleConsistencyService: 사용자 스타일 조회 오류', { userId, error });
      return null;
    }
  }

  /**
   * 스타일을 프롬프트에 적용
   */
  async applyStyleToPrompt(
    prompt: string, 
    styleParams: StyleParameters,
    options?: StyleConsistencyOptions
  ): Promise<string> {
    try {
      console.log('ImageStyleConsistencyService: 프롬프트에 스타일 적용', {
        prompt_length: prompt.length,
        style_params_count: Object.keys(styleParams).length
      });
      
      const result = await this.styleApplicator.applyStyleToPrompt(
        prompt, 
        styleParams, 
        options
      );
      
      console.log('ImageStyleConsistencyService: 스타일 적용 완료', {
        original_length: result.original_prompt.length,
        styled_length: result.styled_prompt.length,
        confidence: result.confidence_score,
        source: result.style_source
      });
      
      return result.styled_prompt;
      
    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 적용 오류', { prompt, styleParams, error });
      return prompt; // 오류 시 원본 프롬프트 반환
    }
  }

  /**
   * 사용자 이미지에서 스타일 학습
   */
  async learnFromUserImages(userId: string, imageUrls: string[]): Promise<StyleParameters> {
    try {
      console.log('ImageStyleConsistencyService: 사용자 이미지에서 스타일 학습', {
        userId,
        image_count: imageUrls.length
      });

      if (imageUrls.length === 0) {
        throw new Error('학습할 이미지가 없습니다');
      }

      // 각 이미지에서 스타일 추출
      const extractedStyles: ExtractedStyle[] = [];
      
      for (const imageUrl of imageUrls) {
        try {
          const style = await this.extractStyleFromImage(imageUrl);
          extractedStyles.push(style);
        } catch (error) {
          console.warn('ImageStyleConsistencyService: 이미지 스타일 추출 실패', { imageUrl, error });
          // 개별 이미지 실패는 전체 프로세스를 중단하지 않음
        }
      }

      if (extractedStyles.length === 0) {
        throw new Error('유효한 스타일을 추출할 수 없습니다');
      }

      // 추출된 스타일들을 조합
      const learnedStyle = this.combineStyles(extractedStyles);

      // 학습된 스타일을 사용자 선호도에 저장
      await this.userStyleManager.updateUserStylePreferences(userId, {
        learned_style: learnedStyle,
        last_updated: new Date()
      });

      // 스타일 히스토리에 추가
      for (let i = 0; i < imageUrls.length && i < extractedStyles.length; i++) {
        await this.userStyleManager.addStyleHistory(userId, {
          image_url: imageUrls[i],
          extracted_style: extractedStyles[i]
        });
      }

      console.log('ImageStyleConsistencyService: 스타일 학습 완료', {
        userId,
        learned_style: learnedStyle,
        processed_images: extractedStyles.length
      });

      return learnedStyle;

    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 학습 오류', { userId, error });
      throw error;
    }
  }

  /**
   * 사용자 스타일 선호도 업데이트
   */
  async updateUserStylePreferences(
    userId: string, 
    preferences: Partial<UserStylePreferences>
  ): Promise<void> {
    try {
      console.log('ImageStyleConsistencyService: 사용자 스타일 선호도 업데이트', { userId });
      
      await this.userStyleManager.updateUserStylePreferences(userId, preferences);
      
      console.log('ImageStyleConsistencyService: 스타일 선호도 업데이트 완료', { userId });
      
    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 선호도 업데이트 오류', { userId, error });
      throw error;
    }
  }

  /**
   * 완전한 스타일 적용 프로세스 (종합적)
   */
  async applyUserStyleToPrompt(
    userId: string,
    prompt: string,
    options: StyleConsistencyOptions = {
      enforce_user_style: true,
      style_weight: 0.7,
      allow_style_variation: true,
      fallback_to_default: true
    }
  ): Promise<StyleApplicationResult> {
    try {
      console.log('ImageStyleConsistencyService: 사용자 스타일 적용 프로세스 시작', {
        userId,
        prompt_length: prompt.length,
        options
      });

      // 1. 사용자 스타일 매개변수 조회
      const userStyleParams = await this.getUserStyleParameters(userId);

      // 2. 스타일을 프롬프트에 적용
      const result = await this.styleApplicator.applyStyleToPrompt(
        prompt,
        userStyleParams || {},
        options
      );

      console.log('ImageStyleConsistencyService: 사용자 스타일 적용 완료', {
        userId,
        has_user_style: !!userStyleParams,
        style_source: result.style_source,
        confidence: result.confidence_score
      });

      return result;

    } catch (error) {
      console.error('ImageStyleConsistencyService: 사용자 스타일 적용 오류', { userId, prompt, error });
      
      // 오류 시 기본 결과 반환
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
   * 스타일 피드백 처리
   */
  async processStyleFeedback(
    userId: string,
    imageUrl: string,
    rating: number,
    extractedStyle?: ExtractedStyle
  ): Promise<void> {
    try {
      let style = extractedStyle;
      
      // 추출된 스타일이 없으면 이미지에서 추출
      if (!style) {
        style = await this.extractStyleFromImage(imageUrl);
      }

      await this.userStyleManager.processStyleFeedback(userId, imageUrl, rating, style);

      console.log('ImageStyleConsistencyService: 스타일 피드백 처리 완료', {
        userId,
        rating,
        imageUrl
      });

    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 피드백 처리 오류', {
        userId,
        imageUrl,
        rating,
        error
      });
    }
  }

  /**
   * 스타일 호환성 검사
   */
  checkStyleCompatibility(styleParams: StyleParameters): {
    compatible: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    return this.styleApplicator.checkStyleCompatibility(styleParams);
  }

  /**
   * 스타일 최적화 제안
   */
  suggestStyleOptimizations(styleParams: StyleParameters): string[] {
    return this.styleApplicator.suggestStyleOptimizations(styleParams);
  }

  /**
   * 여러 추출된 스타일을 조합하여 통합 스타일 생성
   */
  private combineStyles(styles: ExtractedStyle[]): StyleParameters {
    if (styles.length === 0) {
      return {};
    }

    if (styles.length === 1) {
      const style = styles[0];
      return {
        color_palette: style.color_palette,
        lighting: style.lighting,
        composition: style.composition,
        detail_level: style.detail_level,
        artistic_style: style.artistic_style,
        mood: style.mood,
        texture: style.texture,
        contrast: style.contrast
      };
    }

    // 신뢰도가 높은 스타일들에 더 큰 가중치 적용
    const weightedStyles = styles.filter(style => style.confidence_score > 0.5);
    const stylesToUse = weightedStyles.length > 0 ? weightedStyles : styles;

    // 각 속성의 최빈값 또는 가중 평균 계산
    const combined: StyleParameters = {};
    
    // 색상 팔레트 - 최빈값
    const colorPalettes = stylesToUse.map(s => s.color_palette);
    combined.color_palette = this.getMostCommon(colorPalettes);

    // 조명 - 최빈값
    const lightings = stylesToUse.map(s => s.lighting);
    combined.lighting = this.getMostCommon(lightings);

    // 구도 - 최빈값
    const compositions = stylesToUse.map(s => s.composition);
    combined.composition = this.getMostCommon(compositions);

    // 디테일 레벨 - 최빈값
    const detailLevels = stylesToUse.map(s => s.detail_level);
    combined.detail_level = this.getMostCommon(detailLevels);

    // 예술적 스타일 - 최빈값
    const artisticStyles = stylesToUse.map(s => s.artistic_style);
    combined.artistic_style = this.getMostCommon(artisticStyles);

    // 분위기 - 최빈값
    const moods = stylesToUse.map(s => s.mood);
    combined.mood = this.getMostCommon(moods);

    // 텍스처 - 최빈값
    const textures = stylesToUse.map(s => s.texture);
    combined.texture = this.getMostCommon(textures);

    // 대비 - 최빈값
    const contrasts = stylesToUse.map(s => s.contrast);
    combined.contrast = this.getMostCommon(contrasts);

    return combined;
  }

  /**
   * 배열에서 최빈값 찾기
   */
  private getMostCommon<T>(items: T[]): T {
    const counts = new Map<T, number>();
    
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    
    let mostCommon = items[0];
    let maxCount = 0;
    
    for (const [item, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }
    
    return mostCommon;
  }

  /**
   * 스타일 통계 조회
   */
  async getStyleStatistics(userId: string): Promise<{
    total_styles_learned: number;
    average_confidence: number;
    most_common_styles: StyleParameters;
    style_consistency_score: number;
  }> {
    try {
      const preferences = await this.userStyleManager.getUserStylePreferences(userId);
      
      if (!preferences || !preferences.style_history) {
        return {
          total_styles_learned: 0,
          average_confidence: 0,
          most_common_styles: {},
          style_consistency_score: 0
        };
      }

      const history = preferences.style_history;
      const styles = history.map(entry => entry.extracted_style);

      const totalStyles = styles.length;
      const averageConfidence = styles.reduce((sum, style) => sum + style.confidence_score, 0) / totalStyles;
      const mostCommonStyles = this.combineStyles(styles);
      
      // 일관성 점수 계산 (스타일들이 얼마나 일관적인지)
      const consistencyScore = this.calculateStyleConsistency(styles);

      return {
        total_styles_learned: totalStyles,
        average_confidence: Math.round(averageConfidence * 100) / 100,
        most_common_styles: mostCommonStyles,
        style_consistency_score: Math.round(consistencyScore * 100) / 100
      };

    } catch (error) {
      console.error('ImageStyleConsistencyService: 스타일 통계 조회 오류', { userId, error });
      
      return {
        total_styles_learned: 0,
        average_confidence: 0,
        most_common_styles: {},
        style_consistency_score: 0
      };
    }
  }

  /**
   * 스타일 일관성 점수 계산
   */
  private calculateStyleConsistency(styles: ExtractedStyle[]): number {
    if (styles.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < styles.length; i++) {
      for (let j = i + 1; j < styles.length; j++) {
        const similarity = this.calculateStyleSimilarity(styles[i], styles[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * 두 스타일 간 유사도 계산
   */
  private calculateStyleSimilarity(style1: ExtractedStyle, style2: ExtractedStyle): number {
    let matchingAttributes = 0;
    let totalAttributes = 0;

    const attributes: (keyof ExtractedStyle)[] = [
      'lighting', 'composition', 'detail_level', 'artistic_style', 
      'mood', 'texture', 'contrast'
    ];

    for (const attr of attributes) {
      totalAttributes++;
      if (style1[attr] === style2[attr]) {
        matchingAttributes++;
      }
    }

    return totalAttributes > 0 ? matchingAttributes / totalAttributes : 0;
  }
}

// 기본 인스턴스 생성 함수
export function createImageStyleConsistencyService(): ImageStyleConsistencyService {
  return new ImageStyleConsistencyService();
}

// 싱글톤 인스턴스 (선택적)
let defaultInstance: ImageStyleConsistencyService | null = null;

export function getImageStyleConsistencyService(): ImageStyleConsistencyService {
  if (!defaultInstance) {
    defaultInstance = new ImageStyleConsistencyService();
  }
  return defaultInstance;
}
