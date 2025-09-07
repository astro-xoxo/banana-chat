/**
 * Types for Image Style Consistency System
 * Task 010: Ensure Image Style Consistency
 */

export interface StyleParameters {
  color_palette?: string;
  lighting?: string;
  composition?: string;
  detail_level?: string;
  artistic_style?: string;
  mood?: string;
  texture?: string;
  contrast?: string;
}

export interface ExtractedStyle {
  color_palette: string;
  dominant_colors: string[];
  lighting: 'natural' | 'dramatic' | 'soft' | 'bright' | 'moody';
  composition: 'centered' | 'rule_of_thirds' | 'dynamic' | 'balanced';
  detail_level: 'minimal' | 'moderate' | 'high' | 'ultra_detailed';
  artistic_style: 'realistic' | 'artistic' | 'abstract' | 'stylized';
  mood: 'cheerful' | 'calm' | 'dramatic' | 'mysterious' | 'energetic';
  texture: 'smooth' | 'rough' | 'soft' | 'sharp' | 'organic';
  contrast: 'low' | 'medium' | 'high';
  confidence_score: number; // 0-1
}

export interface UserStylePreferences {
  user_id: string;
  preferred_style?: StyleParameters;
  learned_style?: StyleParameters;
  style_history: StyleHistoryEntry[];
  last_updated: Date;
}

export interface StyleHistoryEntry {
  image_url: string;
  extracted_style: ExtractedStyle;
  user_rating?: number; // 1-5
  created_at: Date;
}

export interface StyleConsistencyOptions {
  enforce_user_style: boolean;
  style_weight: number; // 0-1, how much to apply user style
  allow_style_variation: boolean;
  fallback_to_default: boolean;
}

export interface StyleApplicationResult {
  original_prompt: string;
  styled_prompt: string;
  applied_styles: StyleParameters;
  confidence_score: number;
  style_source: 'user_preference' | 'learned' | 'uploaded_image' | 'default';
}

export interface ImageStyleConsistency {
  extractStyleFromImage(imageUrl: string): Promise<ExtractedStyle>;
  getUserStyleParameters(userId: string): Promise<StyleParameters | null>;
  applyStyleToPrompt(prompt: string, styleParams: StyleParameters): Promise<string>;
  learnFromUserImages(userId: string, imageUrls: string[]): Promise<StyleParameters>;
  updateUserStylePreferences(userId: string, preferences: Partial<UserStylePreferences>): Promise<void>;
}
