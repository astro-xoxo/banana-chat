/**
 * PromptGenerator 단위 테스트
 * Task 001 - 프롬프트 생성 로직 검증
 */

import { PromptGeneratorImpl } from '@/lib/services/message-to-prompt/PromptGenerator';
import type { 
  ExtractedKeywords, 
  ConversionOptions, 
  GeneratedPrompt 
} from '@/lib/services/message-to-prompt/types';

describe('PromptGenerator', () => {
  let generator: PromptGeneratorImpl;

  beforeEach(() => {
    generator = new PromptGeneratorImpl();
  });

  afterEach(() => {
    generator.clearCache();
  });

  describe('generatePrompt', () => {
    const createTestKeywords = (overrides: Partial<ExtractedKeywords> = {}): ExtractedKeywords => ({
      emotions: ['행복한', '즐거운'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['수채화'],
      confidence: 0.85,
      raw_analysis: '테스트 키워드',
      ...overrides
    });

    test('기본 프롬프트 생성이 성공적으로 작동한다', async () => {
      const keywords = createTestKeywords();
      const result = await generator.generatePrompt(keywords);

      expect(result).toMatchObject({
        positive_prompt: expect.any(String),
        negative_prompt: expect.any(String),
        style_modifiers: expect.any(Array),
        quality_score: expect.any(Number),
        source_keywords: keywords,
        template_used: expect.any(String),
        generated_at: expect.any(Date)
      });

      expect(result.positive_prompt.length).toBeGreaterThan(10);
      expect(result.quality_score).toBeGreaterThanOrEqual(0);
      expect(result.quality_score).toBeLessThanOrEqual(1);
    });

    test('품질 레벨에 따라 다른 프롬프트를 생성한다', async () => {
      const keywords = createTestKeywords();
      
      const draftResult = await generator.generatePrompt(keywords, { 
        quality_level: 'draft' 
      });
      const premiumResult = await generator.generatePrompt(keywords, { 
        quality_level: 'premium' 
      });

      expect(premiumResult.positive_prompt.length).toBeGreaterThan(draftResult.positive_prompt.length);
      expect(premiumResult.positive_prompt).toContain('masterpiece');
      expect(premiumResult.positive_prompt).toContain('ultra detailed');
    });

    test('템플릿 선택이 올바르게 작동한다', async () => {
      const keywords = createTestKeywords();
      
      const generalResult = await generator.generatePrompt(keywords, {
        template_id: 'general'
      });
      const artisticResult = await generator.generatePrompt(keywords, {
        template_id: 'artistic'
      });

      expect(generalResult.template_used).toBe('general');
      expect(artisticResult.template_used).toBe('artistic');
      expect(artisticResult.positive_prompt).toContain('artistic');
    });

    test('스타일 오버라이드가 적용된다', async () => {
      const keywords = createTestKeywords();
      const customStyle = 'cyberpunk, neon lights, futuristic';
      
      const result = await generator.generatePrompt(keywords, {
        style_override: customStyle
      });

      expect(result.positive_prompt).toContain('cyberpunk');
      expect(result.style_modifiers).toContain(customStyle);
    });

    test('최대 프롬프트 길이 제한이 작동한다', async () => {
      const keywords = createTestKeywords({
        emotions: ['행복한', '즐거운', '신나는', '기쁜', '쾌활한'],
        situations: ['공원에서', '해변에서', '카페에서', '집에서'],
        actions: ['놀고있는', '웃고있는', '춤추는', '뛰어다니는'],
        objects: ['고양이', '강아지', '꽃', '나무', '하늘', '구름']
      });
      
      const maxLength = 100;
      const result = await generator.generatePrompt(keywords, {
        max_prompt_length: maxLength
      });

      expect(result.positive_prompt.length).toBeLessThanOrEqual(maxLength);
    });

    test('캐시가 올바르게 작동한다', async () => {
      const keywords = createTestKeywords();
      const options: ConversionOptions = { quality_level: 'standard' };
      
      const result1 = await generator.generatePrompt(keywords, options);
      const result2 = await generator.generatePrompt(keywords, options);

      expect(result1.positive_prompt).toBe(result2.positive_prompt);
      expect(result1.generated_at).toEqual(result2.generated_at); // 캐시된 결과
    });

    test('키워드 매핑이 올바르게 작동한다', async () => {
      const keywords = createTestKeywords({
        emotions: ['행복한'],
        situations: ['카페에서'],
        actions: ['웃고있는'],
        objects: ['고양이'],
        style: ['수채화']
      });

      const result = await generator.generatePrompt(keywords);

      expect(result.positive_prompt).toContain('happy');
      expect(result.positive_prompt).toContain('cafe');
      expect(result.positive_prompt).toContain('smiling');
      expect(result.positive_prompt).toContain('cat');
      expect(result.positive_prompt).toContain('watercolor');
    });
  });

  describe('getTemplate & listTemplates', () => {
    test('기본 템플릿들이 초기화된다', () => {
      const templates = generator.listTemplates();
      
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'general')).toBe(true);
      expect(templates.some(t => t.id === 'artistic')).toBe(true);
      expect(templates.some(t => t.id === 'portrait')).toBe(true);
    });

    test('존재하는 템플릿을 조회할 수 있다', () => {
      const template = generator.getTemplate('general');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('general');
      expect(template?.name).toBeDefined();
      expect(template?.template).toBeDefined();
      expect(template?.keywords_map).toBeDefined();
    });

    test('존재하지 않는 템플릿 조회 시 null을 반환한다', () => {
      const template = generator.getTemplate('nonexistent');
      expect(template).toBeNull();
    });
  });

  describe('validatePrompt', () => {
    const createTestPrompt = (overrides: Partial<GeneratedPrompt> = {}): GeneratedPrompt => ({
      positive_prompt: 'beautiful cat, happy, in the park, watercolor style',
      negative_prompt: 'blurry, low quality',
      style_modifiers: ['artistic', 'detailed'],
      quality_score: 0.8,
      source_keywords: createTestKeywords(),
      template_used: 'general',
      generated_at: new Date(),
      ...overrides
    });

    const createTestKeywords = (overrides: Partial<ExtractedKeywords> = {}): ExtractedKeywords => ({
      emotions: ['행복한'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['수채화'],
      confidence: 0.85,
      raw_analysis: '테스트',
      ...overrides
    });

    test('유효한 프롬프트를 올바르게 검증한다', () => {
      const validPrompt = createTestPrompt();
      expect(generator.validatePrompt(validPrompt)).toBe(true);
    });

    test('빈 positive_prompt를 거부한다', () => {
      const invalidPrompt = createTestPrompt({ positive_prompt: '' });
      expect(generator.validatePrompt(invalidPrompt)).toBe(false);
    });

    test('잘못된 품질 점수를 거부한다', () => {
      const invalidPrompt = createTestPrompt({ quality_score: 1.5 });
      expect(generator.validatePrompt(invalidPrompt)).toBe(false);
    });

    test('너무 짧은 프롬프트를 거부한다', () => {
      const shortPrompt = createTestPrompt({ positive_prompt: 'cat' });
      expect(generator.validatePrompt(shortPrompt)).toBe(false);
    });

    test('너무 긴 프롬프트를 거부한다', () => {
      const longPrompt = createTestPrompt({ 
        positive_prompt: 'a'.repeat(2001) 
      });
      expect(generator.validatePrompt(longPrompt)).toBe(false);
    });
  });

  describe('template selection logic', () => {
    const createTestKeywords = (overrides: Partial<ExtractedKeywords> = {}): ExtractedKeywords => ({
      emotions: ['행복한'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['자연스러운'],
      confidence: 0.85,
      raw_analysis: '테스트',
      ...overrides
    });

    test('아트 스타일 키워드가 있으면 artistic 템플릿을 선택한다', async () => {
      const artKeywords = createTestKeywords({
        style: ['수채화', '유화']
      });

      const result = await generator.generatePrompt(artKeywords);
      expect(result.template_used).toBe('artistic');
    });

    test('인물 관련 키워드가 많으면 portrait 템플릿을 선택한다', async () => {
      const portraitKeywords = createTestKeywords({
        actions: ['웃고있는', '앉아있는'],
        emotions: ['행복한']
      });

      const result = await generator.generatePrompt(portraitKeywords);
      expect(result.template_used).toBe('portrait');
    });

    test('일반적인 키워드에는 general 템플릿을 선택한다', async () => {
      const generalKeywords = createTestKeywords({
        emotions: ['평화로운'],
        situations: ['집에서'],
        objects: ['꽃']
      });

      const result = await generator.generatePrompt(generalKeywords);
      expect(result.template_used).toBe('general');
    });
  });

  describe('quality score calculation', () => {
    const createTestKeywords = (overrides: Partial<ExtractedKeywords> = {}): ExtractedKeywords => ({
      emotions: ['행복한'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['자연스러운'],
      confidence: 0.85,
      raw_analysis: '테스트',
      ...overrides
    });

    test('높은 신뢰도의 키워드는 높은 품질 점수를 받는다', async () => {
      const highConfidenceKeywords = createTestKeywords({
        confidence: 0.95,
        emotions: ['행복한', '즐거운', '평화로운'],
        situations: ['공원에서', '해변에서'],
        actions: ['놀고있는', '웃고있는'],
        objects: ['고양이', '꽃']
      });

      const result = await generator.generatePrompt(highConfidenceKeywords);
      expect(result.quality_score).toBeGreaterThan(0.7);
    });

    test('낮은 신뢰도의 키워드는 낮은 품질 점수를 받는다', async () => {
      const lowConfidenceKeywords = createTestKeywords({
        confidence: 0.3,
        emotions: ['행복한'],
        situations: [],
        actions: [],
        objects: []
      });

      const result = await generator.generatePrompt(lowConfidenceKeywords);
      expect(result.quality_score).toBeLessThan(0.6);
    });

    test('키워드 다양성이 품질 점수에 반영된다', async () => {
      const diverseKeywords = createTestKeywords({
        emotions: ['행복한', '즐거운', '평화로운'],
        situations: ['공원에서', '해변에서', '카페에서'],
        actions: ['놀고있는', '웃고있는', '걷고있는'],
        objects: ['고양이', '꽃', '나무', '커피']
      });

      const sparseKeywords = createTestKeywords({
        emotions: ['행복한'],
        situations: [],
        actions: [],
        objects: []
      });

      const diverseResult = await generator.generatePrompt(diverseKeywords);
      const sparseResult = await generator.generatePrompt(sparseKeywords);

      expect(diverseResult.quality_score).toBeGreaterThan(sparseResult.quality_score);
    });
  });

  describe('negative prompt generation', () => {
    const createTestKeywords = (): ExtractedKeywords => ({
      emotions: ['행복한'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['자연스러운'],
      confidence: 0.85,
      raw_analysis: '테스트'
    });

    test('기본 negative prompt가 포함된다', async () => {
      const keywords = createTestKeywords();
      const result = await generator.generatePrompt(keywords);

      expect(result.negative_prompt).toContain('blurry');
      expect(result.negative_prompt).toContain('low quality');
      expect(result.negative_prompt).toContain('distorted');
    });

    test('높은 품질 레벨에서 더 많은 negative prompt가 추가된다', async () => {
      const keywords = createTestKeywords();
      
      const standardResult = await generator.generatePrompt(keywords, {
        quality_level: 'standard'
      });
      const premiumResult = await generator.generatePrompt(keywords, {
        quality_level: 'premium'
      });

      expect(premiumResult.negative_prompt.length).toBeGreaterThan(
        standardResult.negative_prompt.length
      );
      expect(premiumResult.negative_prompt).toContain('amateur');
    });
  });

  describe('statistics and performance', () => {
    const createTestKeywords = (): ExtractedKeywords => ({
      emotions: ['행복한'],
      situations: ['공원에서'],
      actions: ['놀고있는'],
      objects: ['고양이'],
      style: ['자연스러운'],
      confidence: 0.85,
      raw_analysis: '테스트'
    });

    test('통계가 올바르게 수집된다', async () => {
      const keywords = createTestKeywords();
      
      await generator.generatePrompt(keywords, { template_id: 'general' });
      await generator.generatePrompt(keywords, { template_id: 'artistic' });
      
      const stats = generator.getStats();
      
      expect(stats).toMatchObject({
        total_generations: expect.any(Number),
        success_count: expect.any(Number),
        cache_hits: expect.any(Number),
        cache_size: expect.any(Number),
        cache_hit_rate: expect.any(Number),
        template_usage: expect.any(Object)
      });
      
      expect(stats.total_generations).toBeGreaterThan(0);
    });

    test('캐시 히트율이 올바르게 계산된다', async () => {
      const keywords = createTestKeywords();
      const options = { quality_level: 'standard' as const };
      
      // 첫 번째 호출
      await generator.generatePrompt(keywords, options);
      
      // 두 번째 호출 (캐시 히트)
      await generator.generatePrompt(keywords, options);
      
      const stats = generator.getStats();
      expect(stats.cache_hit_rate).toBeGreaterThan(0);
    });

    test('캐시 정리가 올바르게 작동한다', async () => {
      const keywords = createTestKeywords();
      await generator.generatePrompt(keywords);
      
      let stats = generator.getStats();
      expect(stats.cache_size).toBeGreaterThan(0);
      
      generator.clearCache();
      
      stats = generator.getStats();
      expect(stats.cache_size).toBe(0);
    });
  });
});
