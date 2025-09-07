/**
 * StyleExtractionService - 이미지에서 스타일 추출 서비스
 * Task 010: Ensure Image Style Consistency
 */

import type { ExtractedStyle } from './types';

export class StyleExtractionService {
  
  /**
   * 이미지 URL에서 스타일 특성 추출
   */
  async extractStyleFromImage(imageUrl: string): Promise<ExtractedStyle> {
    try {
      console.log('StyleExtractionService: 이미지 스타일 추출 시작', { imageUrl });
      
      // 이미지 로드 및 기본 분석
      const imageAnalysis = await this.analyzeImageBasics(imageUrl);
      
      // 스타일 특성 추출
      const extractedStyle: ExtractedStyle = {
        color_palette: await this.extractColorPalette(imageAnalysis),
        dominant_colors: await this.extractDominantColors(imageAnalysis),
        lighting: await this.analyzeLighting(imageAnalysis),
        composition: await this.analyzeComposition(imageAnalysis),
        detail_level: await this.analyzeDetailLevel(imageAnalysis),
        artistic_style: await this.analyzeArtisticStyle(imageAnalysis),
        mood: await this.analyzeMood(imageAnalysis),
        texture: await this.analyzeTexture(imageAnalysis),
        contrast: await this.analyzeContrast(imageAnalysis),
        confidence_score: this.calculateConfidenceScore(imageAnalysis)
      };
      
      console.log('StyleExtractionService: 스타일 추출 완료', {
        imageUrl,
        extracted_style: extractedStyle,
        confidence: extractedStyle.confidence_score
      });
      
      return extractedStyle;
      
    } catch (error) {
      console.error('StyleExtractionService: 스타일 추출 오류', { imageUrl, error });
      
      // 오류 시 기본값 반환
      return this.getDefaultStyle();
    }
  }

  /**
   * 이미지 기본 분석 (Canvas API 사용)
   */
  private async analyzeImageBasics(imageUrl: string): Promise<ImageAnalysisData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Canvas context를 생성할 수 없습니다');
          }
          
          // 분석을 위해 이미지 크기 조정 (성능 최적화)
          const maxSize = 200;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // 이미지 데이터 추출
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const analysis: ImageAnalysisData = {
            width: canvas.width,
            height: canvas.height,
            imageData: imageData.data,
            histogram: this.calculateHistogram(imageData.data),
            averageBrightness: this.calculateAverageBrightness(imageData.data),
            colorVariance: this.calculateColorVariance(imageData.data),
            aspectRatio: canvas.width / canvas.height
          };
          
          resolve(analysis);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('이미지 로드 실패'));
      img.src = imageUrl;
    });
  }

  /**
   * 색상 팔레트 추출
   */
  private async extractColorPalette(analysis: ImageAnalysisData): Promise<string> {
    const dominantColors = this.getDominantColors(analysis.imageData, 5);
    
    // 색상 분포 기반으로 팔레트 타입 결정
    const colorTypes = dominantColors.map(color => this.classifyColor(color));
    
    if (colorTypes.includes('warm') && !colorTypes.includes('cool')) {
      return 'warm colors';
    } else if (colorTypes.includes('cool') && !colorTypes.includes('warm')) {
      return 'cool colors';
    } else if (colorTypes.filter(t => t === 'neutral').length > 3) {
      return 'monochromatic';
    } else if (colorTypes.includes('vibrant')) {
      return 'vibrant colors';
    } else {
      return 'natural colors';
    }
  }

  /**
   * 주요 색상 추출
   */
  private async extractDominantColors(analysis: ImageAnalysisData): Promise<string[]> {
    const dominantColors = this.getDominantColors(analysis.imageData, 3);
    return dominantColors.map(color => this.rgbToColorName(color));
  }

  /**
   * 조명 분석
   */
  private async analyzeLighting(analysis: ImageAnalysisData): Promise<ExtractedStyle['lighting']> {
    const brightness = analysis.averageBrightness;
    const contrast = this.calculateContrastLevel(analysis.imageData);
    
    if (brightness > 200 && contrast < 0.3) {
      return 'bright';
    } else if (brightness < 100 && contrast > 0.6) {
      return 'dramatic';
    } else if (brightness < 150 && contrast < 0.4) {
      return 'moody';
    } else if (contrast < 0.3) {
      return 'soft';
    } else {
      return 'natural';
    }
  }

  /**
   * 구도 분석
   */
  private async analyzeComposition(analysis: ImageAnalysisData): Promise<ExtractedStyle['composition']> {
    const aspectRatio = analysis.aspectRatio;
    
    // 간단한 구도 분석 (실제로는 더 복잡한 이미지 처리 필요)
    if (aspectRatio > 1.5) {
      return 'dynamic';
    } else if (aspectRatio < 0.7) {
      return 'centered';
    } else if (Math.abs(aspectRatio - 1) < 0.1) {
      return 'balanced';
    } else {
      return 'rule_of_thirds';
    }
  }

  /**
   * 디테일 레벨 분석
   */
  private async analyzeDetailLevel(analysis: ImageAnalysisData): Promise<ExtractedStyle['detail_level']> {
    const variance = analysis.colorVariance;
    
    if (variance > 10000) {
      return 'ultra_detailed';
    } else if (variance > 5000) {
      return 'high';
    } else if (variance > 2000) {
      return 'moderate';
    } else {
      return 'minimal';
    }
  }

  /**
   * 예술적 스타일 분석
   */
  private async analyzeArtisticStyle(analysis: ImageAnalysisData): Promise<ExtractedStyle['artistic_style']> {
    const variance = analysis.colorVariance;
    const brightness = analysis.averageBrightness;
    
    // 단순한 휴리스틱 기반 분류
    if (variance > 8000 && brightness > 150) {
      return 'realistic';
    } else if (variance < 3000) {
      return 'stylized';
    } else if (brightness < 100 || brightness > 220) {
      return 'artistic';
    } else {
      return 'abstract';
    }
  }

  /**
   * 분위기 분석
   */
  private async analyzeMood(analysis: ImageAnalysisData): Promise<ExtractedStyle['mood']> {
    const brightness = analysis.averageBrightness;
    const contrast = this.calculateContrastLevel(analysis.imageData);
    
    if (brightness > 180 && contrast < 0.4) {
      return 'cheerful';
    } else if (brightness < 100 && contrast > 0.6) {
      return 'dramatic';
    } else if (brightness < 120) {
      return 'mysterious';
    } else if (contrast > 0.7) {
      return 'energetic';
    } else {
      return 'calm';
    }
  }

  /**
   * 텍스처 분석
   */
  private async analyzeTexture(analysis: ImageAnalysisData): Promise<ExtractedStyle['texture']> {
    const variance = analysis.colorVariance;
    
    if (variance > 8000) {
      return 'rough';
    } else if (variance > 4000) {
      return 'organic';
    } else if (variance > 2000) {
      return 'sharp';
    } else if (variance > 1000) {
      return 'soft';
    } else {
      return 'smooth';
    }
  }

  /**
   * 대비 분석
   */
  private async analyzeContrast(analysis: ImageAnalysisData): Promise<ExtractedStyle['contrast']> {
    const contrastLevel = this.calculateContrastLevel(analysis.imageData);
    
    if (contrastLevel > 0.6) {
      return 'high';
    } else if (contrastLevel > 0.3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 신뢰도 점수 계산
   */
  private calculateConfidenceScore(analysis: ImageAnalysisData): number {
    // 이미지 크기, 품질, 분석 가능성에 따른 신뢰도
    let score = 0.5; // 기본 점수
    
    // 이미지 크기 고려
    const pixelCount = analysis.width * analysis.height;
    if (pixelCount > 10000) score += 0.2;
    else if (pixelCount > 5000) score += 0.1;
    
    // 색상 다양성 고려
    if (analysis.colorVariance > 1000) score += 0.2;
    else if (analysis.colorVariance > 500) score += 0.1;
    
    // 밝기 적절성 고려
    if (analysis.averageBrightness > 50 && analysis.averageBrightness < 200) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  /**
   * 기본 스타일 반환 (오류 시)
   */
  private getDefaultStyle(): ExtractedStyle {
    return {
      color_palette: 'natural colors',
      dominant_colors: ['blue', 'white', 'gray'],
      lighting: 'natural',
      composition: 'balanced',
      detail_level: 'moderate',
      artistic_style: 'realistic',
      mood: 'calm',
      texture: 'smooth',
      contrast: 'medium',
      confidence_score: 0.3
    };
  }

  // 유틸리티 메서드들

  private calculateHistogram(imageData: Uint8ClampedArray): number[] {
    const histogram = new Array(256).fill(0);
    
    for (let i = 0; i < imageData.length; i += 4) {
      const gray = Math.round(0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]);
      histogram[gray]++;
    }
    
    return histogram;
  }

  private calculateAverageBrightness(imageData: Uint8ClampedArray): number {
    let total = 0;
    let count = 0;
    
    for (let i = 0; i < imageData.length; i += 4) {
      const brightness = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
      total += brightness;
      count++;
    }
    
    return count > 0 ? total / count : 0;
  }

  private calculateColorVariance(imageData: Uint8ClampedArray): number {
    const colors: number[][] = [];
    
    for (let i = 0; i < imageData.length; i += 4) {
      colors.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
    }
    
    // RGB 각 채널의 분산 계산
    const means = [0, 1, 2].map(channel => 
      colors.reduce((sum, color) => sum + color[channel], 0) / colors.length
    );
    
    const variances = [0, 1, 2].map(channel =>
      colors.reduce((sum, color) => sum + Math.pow(color[channel] - means[channel], 2), 0) / colors.length
    );
    
    return variances.reduce((sum, variance) => sum + variance, 0);
  }

  private getDominantColors(imageData: Uint8ClampedArray, count: number): number[][] {
    const colorCount = new Map<string, { color: number[], count: number }>();
    
    // 색상 빈도 계산 (성능을 위해 샘플링)
    for (let i = 0; i < imageData.length; i += 16) { // 4픽셀마다 샘플링
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      
      // 색상 양자화 (비슷한 색상 그룹화)
      const quantizedR = Math.floor(r / 32) * 32;
      const quantizedG = Math.floor(g / 32) * 32;
      const quantizedB = Math.floor(b / 32) * 32;
      
      const key = `${quantizedR},${quantizedG},${quantizedB}`;
      
      if (colorCount.has(key)) {
        colorCount.get(key)!.count++;
      } else {
        colorCount.set(key, { color: [quantizedR, quantizedG, quantizedB], count: 1 });
      }
    }
    
    // 빈도순 정렬하여 상위 N개 반환
    return Array.from(colorCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, count)
      .map(item => item.color);
  }

  private classifyColor(rgb: number[]): 'warm' | 'cool' | 'neutral' | 'vibrant' {
    const [r, g, b] = rgb;
    
    // 채도 계산
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    
    if (saturation > 0.6) {
      return 'vibrant';
    }
    
    // 색온도 계산
    if (r > g + 20 && r > b + 20) {
      return 'warm'; // 빨간색 계열
    } else if (b > r + 20 && b > g + 20) {
      return 'cool'; // 파란색 계열
    } else {
      return 'neutral';
    }
  }

  private rgbToColorName(rgb: number[]): string {
    const [r, g, b] = rgb;
    
    // 간단한 색상 이름 매핑
    if (r > 200 && g < 100 && b < 100) return 'red';
    if (r < 100 && g > 200 && b < 100) return 'green';
    if (r < 100 && g < 100 && b > 200) return 'blue';
    if (r > 200 && g > 200 && b < 100) return 'yellow';
    if (r > 200 && g < 100 && b > 200) return 'magenta';
    if (r < 100 && g > 200 && b > 200) return 'cyan';
    if (r > 200 && g > 200 && b > 200) return 'white';
    if (r < 100 && g < 100 && b < 100) return 'black';
    if (r > 150 && g > 100 && b < 100) return 'orange';
    if (r > 100 && g > 100 && b > 100) return 'gray';
    
    return 'mixed';
  }

  private calculateContrastLevel(imageData: Uint8ClampedArray): number {
    let min = 255;
    let max = 0;
    
    for (let i = 0; i < imageData.length; i += 4) {
      const brightness = 0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2];
      min = Math.min(min, brightness);
      max = Math.max(max, brightness);
    }
    
    return max > 0 ? (max - min) / max : 0;
  }
}

// 이미지 분석 데이터 인터페이스
interface ImageAnalysisData {
  width: number;
  height: number;
  imageData: Uint8ClampedArray;
  histogram: number[];
  averageBrightness: number;
  colorVariance: number;
  aspectRatio: number;
}
