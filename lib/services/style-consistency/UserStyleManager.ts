/**
 * UserStyleManager - 사용자 스타일 선호도 관리 서비스
 * Task 010: Ensure Image Style Consistency
 */

import { createAuthenticatedServerClient } from '@/lib/supabase-server';
import type { 
  StyleParameters, 
  UserStylePreferences, 
  StyleHistoryEntry, 
  ExtractedStyle 
} from './types';

export class UserStyleManager {
  
  /**
   * 사용자 스타일 매개변수 조회
   */
  async getUserStyleParameters(userId: string): Promise<StyleParameters | null> {
    try {
      console.log('UserStyleManager: 사용자 스타일 매개변수 조회 시작', { userId });
      
      // 사용자 선호도 조회
      const preferences = await this.getUserStylePreferences(userId);
      
      if (!preferences) {
        console.log('UserStyleManager: 사용자 선호도 없음, 업로드된 이미지에서 학습 시도');
        
        // 업로드된 이미지에서 스타일 학습 시도
        const learnedStyle = await this.learnStyleFromUserImages(userId);
        return learnedStyle;
      }
      
      // 명시적 선호도가 있으면 우선 사용
      if (preferences.preferred_style && Object.keys(preferences.preferred_style).length > 0) {
        console.log('UserStyleManager: 명시적 선호도 스타일 반환');
        return preferences.preferred_style;
      }
      
      // 학습된 스타일 반환
      if (preferences.learned_style && Object.keys(preferences.learned_style).length > 0) {
        console.log('UserStyleManager: 학습된 스타일 반환');
        return preferences.learned_style;
      }
      
      console.log('UserStyleManager: 사용 가능한 스타일 없음');
      return null;
      
    } catch (error) {
      console.error('UserStyleManager: 사용자 스타일 매개변수 조회 오류', { userId, error });
      return null;
    }
  }

  /**
   * 사용자 업로드 이미지에서 스타일 학습
   */
  async learnStyleFromUserImages(userId: string, maxImages: number = 5): Promise<StyleParameters | null> {
    try {
      console.log('UserStyleManager: 사용자 이미지에서 스타일 학습 시작', { userId, maxImages });
      
      const supabase = createAuthenticatedServerClient();
      
      // 사용자의 최근 업로드 이미지 조회 (프로필, 채팅 등)
      const userImages = await this.getUserUploadedImages(userId, maxImages);
      
      if (!userImages || userImages.length === 0) {
        console.log('UserStyleManager: 학습할 이미지 없음');
        return null;
      }
      
      // 각 이미지에서 스타일 추출 (클라이언트에서 실행되어야 함)
      const extractedStyles: ExtractedStyle[] = [];
      
      for (const imageUrl of userImages) {
        try {
          // 실제로는 StyleExtractionService를 사용해야 하지만,
          // 서버 사이드에서는 Canvas API를 사용할 수 없으므로
          // 클라이언트에서 추출된 스타일 데이터를 사용하거나
          // 외부 이미지 분석 API를 사용해야 함
          
          // 여기서는 기본값으로 처리
          console.log('UserStyleManager: 이미지 스타일 분석 스킵 (서버 사이드)');
        } catch (error) {
          console.error('UserStyleManager: 이미지 스타일 추출 오류', { imageUrl, error });
        }
      }
      
      if (extractedStyles.length === 0) {
        return null;
      }
      
      // 스타일들을 조합하여 학습된 스타일 생성
      const learnedStyle = this.combineExtractedStyles(extractedStyles);
      
      // 학습된 스타일을 사용자 선호도에 저장
      await this.updateUserStylePreferences(userId, {
        learned_style: learnedStyle,
        last_updated: new Date()
      });
      
      console.log('UserStyleManager: 스타일 학습 완료', { userId, learnedStyle });
      return learnedStyle;
      
    } catch (error) {
      console.error('UserStyleManager: 스타일 학습 오류', { userId, error });
      return null;
    }
  }

  /**
   * 추출된 스타일들을 조합하여 통합 스타일 생성
   */
  private combineExtractedStyles(styles: ExtractedStyle[]): StyleParameters {
    if (styles.length === 0) {
      return {};
    }
    
    // 각 스타일 속성의 최빈값 계산
    const combined: StyleParameters = {};
    
    // 색상 팔레트
    const colorPalettes = styles.map(s => s.color_palette);
    combined.color_palette = this.getMostCommon(colorPalettes);
    
    // 조명
    const lightings = styles.map(s => s.lighting);
    combined.lighting = this.getMostCommon(lightings);
    
    // 구도
    const compositions = styles.map(s => s.composition);
    combined.composition = this.getMostCommon(compositions);
    
    // 디테일 레벨
    const detailLevels = styles.map(s => s.detail_level);
    combined.detail_level = this.getMostCommon(detailLevels);
    
    // 예술적 스타일
    const artisticStyles = styles.map(s => s.artistic_style);
    combined.artistic_style = this.getMostCommon(artisticStyles);
    
    // 분위기
    const moods = styles.map(s => s.mood);
    combined.mood = this.getMostCommon(moods);
    
    // 텍스처
    const textures = styles.map(s => s.texture);
    combined.texture = this.getMostCommon(textures);
    
    // 대비
    const contrasts = styles.map(s => s.contrast);
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
   * 사용자 업로드 이미지 URL 조회
   */
  private async getUserUploadedImages(userId: string, limit: number = 5): Promise<string[]> {
    try {
      const supabase = createAuthenticatedServerClient();
      
      // 1. 챗봇 프로필 이미지 조회
      const { data: chatbots } = await supabase
        .from('chatbots')
        .select('profile_image_url')
        .eq('user_id', userId)
        .not('profile_image_url', 'is', null)
        .limit(limit);
      
      const imageUrls: string[] = [];
      
      if (chatbots) {
        imageUrls.push(...chatbots.map(bot => bot.profile_image_url).filter(Boolean));
      }
      
      // 2. 채팅 메시지의 이미지들 조회 (향후 구현)
      // const { data: messageImages } = await supabase
      //   .from('chat_messages')
      //   .select('metadata')
      //   .eq('user_id', userId)
      //   .not('metadata->image_url', 'is', null)
      //   .limit(limit - imageUrls.length);
      
      return imageUrls.slice(0, limit);
      
    } catch (error) {
      console.error('UserStyleManager: 사용자 업로드 이미지 조회 오류', { userId, error });
      return [];
    }
  }

  /**
   * 사용자 스타일 선호도 조회
   */
  async getUserStylePreferences(userId: string): Promise<UserStylePreferences | null> {
    try {
      const supabase = createAuthenticatedServerClient();
      
      const { data, error } = await supabase
        .from('user_style_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // 데이터 없음
          return null;
        }
        throw error;
      }
      
      return {
        user_id: data.user_id,
        preferred_style: data.preferred_style || undefined,
        learned_style: data.learned_style || undefined,
        style_history: data.style_history || [],
        last_updated: new Date(data.last_updated)
      };
      
    } catch (error) {
      console.error('UserStyleManager: 사용자 스타일 선호도 조회 오류', { userId, error });
      return null;
    }
  }

  /**
   * 사용자 스타일 선호도 업데이트
   */
  async updateUserStylePreferences(
    userId: string, 
    updates: Partial<UserStylePreferences>
  ): Promise<void> {
    try {
      const supabase = createAuthenticatedServerClient();
      
      const updateData = {
        user_id: userId,
        preferred_style: updates.preferred_style || null,
        learned_style: updates.learned_style || null,
        style_history: updates.style_history || null,
        last_updated: updates.last_updated || new Date()
      };
      
      const { error } = await supabase
        .from('user_style_preferences')
        .upsert(updateData, { onConflict: 'user_id' });
      
      if (error) {
        throw error;
      }
      
      console.log('UserStyleManager: 사용자 스타일 선호도 업데이트 완료', { userId });
      
    } catch (error) {
      console.error('UserStyleManager: 사용자 스타일 선호도 업데이트 오류', { userId, error });
      throw error;
    }
  }

  /**
   * 스타일 히스토리 추가
   */
  async addStyleHistory(
    userId: string, 
    entry: Omit<StyleHistoryEntry, 'created_at'>
  ): Promise<void> {
    try {
      const preferences = await this.getUserStylePreferences(userId);
      const currentHistory = preferences?.style_history || [];
      
      const newEntry: StyleHistoryEntry = {
        ...entry,
        created_at: new Date()
      };
      
      // 최근 10개 항목만 유지
      const updatedHistory = [newEntry, ...currentHistory].slice(0, 10);
      
      await this.updateUserStylePreferences(userId, {
        style_history: updatedHistory,
        last_updated: new Date()
      });
      
    } catch (error) {
      console.error('UserStyleManager: 스타일 히스토리 추가 오류', { userId, error });
    }
  }

  /**
   * 사용자 스타일 피드백 처리
   */
  async processStyleFeedback(
    userId: string,
    imageUrl: string,
    rating: number,
    extractedStyle: ExtractedStyle
  ): Promise<void> {
    try {
      // 피드백을 히스토리에 추가
      await this.addStyleHistory(userId, {
        image_url: imageUrl,
        extracted_style: extractedStyle,
        user_rating: rating
      });
      
      // 높은 평점의 스타일들을 학습에 반영
      if (rating >= 4) {
        const preferences = await this.getUserStylePreferences(userId);
        const goodStyles = (preferences?.style_history || [])
          .filter(entry => entry.user_rating && entry.user_rating >= 4)
          .map(entry => entry.extracted_style);
        
        if (goodStyles.length >= 2) {
          const improvedStyle = this.combineExtractedStyles(goodStyles);
          await this.updateUserStylePreferences(userId, {
            learned_style: {
              ...preferences?.learned_style,
              ...improvedStyle
            },
            last_updated: new Date()
          });
        }
      }
      
      console.log('UserStyleManager: 스타일 피드백 처리 완료', { userId, rating });
      
    } catch (error) {
      console.error('UserStyleManager: 스타일 피드백 처리 오류', { userId, error });
    }
  }

  /**
   * 스타일 선호도 재설정
   */
  async resetUserStylePreferences(userId: string): Promise<void> {
    try {
      await this.updateUserStylePreferences(userId, {
        preferred_style: undefined,
        learned_style: undefined,
        style_history: [],
        last_updated: new Date()
      });
      
      console.log('UserStyleManager: 사용자 스타일 선호도 재설정 완료', { userId });
      
    } catch (error) {
      console.error('UserStyleManager: 스타일 선호도 재설정 오류', { userId, error });
      throw error;
    }
  }
}
