/**
 * CategoryPromptService 테스트
 * 카테고리화된 프롬프트 시스템 통합 테스트
 */

import { CategoryPromptService } from '../../lib/services/category-prompt/CategoryPromptService';
import { CategoryPromptIntegrationService } from '../../lib/services/message-to-prompt/CategoryPromptIntegration';

// Mock Claude Client
const mockClaudeClient = {
  messages: {
    create: jest.fn()
  }
};

describe('CategoryPromptService', () => {
  let service: CategoryPromptService;

  beforeEach(() => {
    service = new CategoryPromptService(mockClaudeClient);
    jest.clearAllMocks();
  });

  describe('convertMessageToPrompt', () => {
    it('복합 메시지에서 7개 카테고리 모두 추출 테스트', async () => {
      // Mock Claude API response
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: '카페에서',
            outfit_style: '캐주얼',
            action_pose: '앉아있는',
            expression_emotion: '행복한',
            atmosphere_lighting: '따뜻한'
          })
        }]
      });

      const message = '카페에서 편안한 옷을 입고 앉아서 웃으면서 따뜻한 분위기에서 커피를 마시고 있어';
      const result = await service.convertMessageToPrompt(message, { gender: 'female' });

      expect(result.positive_prompt).toContain('1girl');
      expect(result.positive_prompt).toContain('cozy cafe');
      expect(result.positive_prompt).toContain('casual');
      expect(result.positive_prompt).toContain('sitting');
      expect(result.positive_prompt).toContain('happy');
      expect(result.positive_prompt).toContain('warm');

      expect(result.category_breakdown).toMatchObject({
        location_environment: expect.stringContaining('cafe'),
        outfit_style: expect.stringContaining('casual'),
        action_pose: expect.stringContaining('sitting'),
        expression_emotion: expect.stringContaining('happy'),
        atmosphere_lighting: expect.stringContaining('warm')
      });
    });

    it('성별별 프롬프트 분기 테스트', async () => {
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: 'default',
            outfit_style: 'default',
            action_pose: 'default',
            expression_emotion: 'default',
            atmosphere_lighting: 'default'
          })
        }]
      });

      const message = '안녕하세요';
      
      // 여성 캐릭터 테스트
      const femaleResult = await service.convertMessageToPrompt(message, { gender: 'female' });
      expect(femaleResult.positive_prompt).toContain('1girl');
      expect(femaleResult.generation_info.gender).toBe('female');

      // 남성 캐릭터 테스트
      const maleResult = await service.convertMessageToPrompt(message, { gender: 'male' });
      expect(maleResult.positive_prompt).toContain('1boy');
      expect(maleResult.generation_info.gender).toBe('male');
    });

    it('NSFW 필터링 테스트', async () => {
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: 'default',
            outfit_style: 'default',
            action_pose: 'default',
            expression_emotion: 'default',
            atmosphere_lighting: 'default'
          })
        }]
      });

      const message = '평범한 대화';
      const result = await service.convertMessageToPrompt(message, { gender: 'female' });

      expect(result.negative_prompt).toContain('nsfw');
      expect(result.negative_prompt).toContain('nude');
      expect(result.negative_prompt).toContain('sexual content');
      expect(result.negative_prompt).toContain('inappropriate');
      expect(result.negative_prompt).toContain('explicit');
    });

    it('폴백 처리 테스트', async () => {
      // Claude API 호출 실패 시뮬레이션
      mockClaudeClient.messages.create.mockRejectedValue(new Error('API 호출 실패'));

      const message = '테스트 메시지';
      const result = await service.convertMessageToPrompt(message, { gender: 'female' });

      expect(result.positive_prompt).toBeDefined();
      expect(result.negative_prompt).toBeDefined();
      expect(result.quality_score).toBeGreaterThan(0);
      expect(result.generation_info.template_used).toContain('category_based');
    });

    it('품질 레벨별 프롬프트 테스트', async () => {
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: 'default',
            outfit_style: 'default',
            action_pose: 'default',
            expression_emotion: 'default',
            atmosphere_lighting: 'default'
          })
        }]
      });

      const message = '테스트';

      // Draft 품질
      const draftResult = await service.convertMessageToPrompt(message, { 
        gender: 'female', 
        qualityLevel: 'draft' 
      });
      expect(draftResult.positive_prompt).toContain('high quality');

      // Premium 품질
      const premiumResult = await service.convertMessageToPrompt(message, { 
        gender: 'female', 
        qualityLevel: 'premium' 
      });
      expect(premiumResult.positive_prompt).toContain('(masterpiece:1.4)');
      expect(premiumResult.positive_prompt).toContain('8k resolution');
      expect(premiumResult.quality_score).toBeGreaterThan(draftResult.quality_score);
    });
  });

  describe('배치 처리', () => {
    it('여러 메시지 동시 변환 테스트', async () => {
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: 'default',
            outfit_style: 'default',
            action_pose: 'default',
            expression_emotion: 'default',
            atmosphere_lighting: 'default'
          })
        }]
      });

      const messages = [
        { message: '카페에서', gender: 'female' as const },
        { message: '공원에서', gender: 'male' as const },
        { message: '집에서', gender: 'female' as const }
      ];

      const results = await service.convertMessages(messages);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.positive_prompt).toBeDefined();
        expect(result.negative_prompt).toBeDefined();
        expect(result.quality_score).toBeGreaterThan(0);
      });
    });
  });

  describe('성능 및 통계', () => {
    it('성능 통계 수집 테스트', async () => {
      mockClaudeClient.messages.create.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            location_environment: 'default',
            outfit_style: 'default',
            action_pose: 'default',
            expression_emotion: 'default',
            atmosphere_lighting: 'default'
          })
        }]
      });

      // 여러 번 변환 실행
      await service.convertMessageToPrompt('테스트1', { gender: 'female' });
      await service.convertMessageToPrompt('테스트2', { gender: 'male' });

      const stats = service.getPerformanceStats();

      expect(stats.total_conversions).toBe(2);
      expect(stats.avg_processing_time_ms).toBeGreaterThan(0);
      expect(stats.success_rate).toBe(100);
    });

    it('서비스 상태 확인 테스트', async () => {
      const health = service.getServiceHealth();

      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.last_check).toBeDefined();
    });
  });
});

describe('CategoryPromptIntegrationService', () => {
  let integrationService: CategoryPromptIntegrationService;

  beforeEach(() => {
    integrationService = new CategoryPromptIntegrationService();
  });

  describe('기존 인터페이스 호환성', () => {
    it('MessageToPromptService 인터페이스 호환 테스트', async () => {
      const context = {
        message_id: 'test-123',
        session_id: 'session-456',
        content: '카페에서 커피를 마시고 있어',
        gender: 'female',
        chat_history: []
      };

      const result = await integrationService.convertMessageToPrompt(context);

      expect(result.success).toBe(true);
      expect(result.positive_prompt).toBeDefined();
      expect(result.negative_prompt).toBeDefined();
      expect(result.quality_score).toBeGreaterThan(0);
      expect(result.template_used).toContain('category_based');
      expect(result.processing_time_ms).toBeGreaterThan(0);
      expect(result.generation_id).toBeDefined();
    });

    it('배치 변환 호환성 테스트', async () => {
      const contexts = [
        {
          message_id: '1',
          content: '공원에서 산책',
          gender: 'female'
        },
        {
          message_id: '2', 
          content: '카페에서 독서',
          gender: 'male'
        }
      ];

      const results = await integrationService.convertBatch(contexts);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.positive_prompt).toBeDefined();
      });
    });

    it('품질 레벨 매핑 테스트', async () => {
      const context = {
        message_id: 'test',
        content: '테스트',
        gender: 'female'
      };

      // 기존 시스템의 'high' 품질을 'premium'으로 매핑
      const result = await integrationService.convertMessageToPrompt(
        context, 
        { quality_level: 'high' }
      );

      expect(result.success).toBe(true);
      expect(result.positive_prompt).toContain('masterpiece');
    });
  });

  describe('통합 서비스 통계', () => {
    it('통합 서비스 통계 수집 테스트', async () => {
      const context = {
        message_id: 'stats-test',
        content: '통계 테스트',
        gender: 'female'
      };

      await integrationService.convertMessageToPrompt(context);

      const stats = integrationService.getServiceStats();

      expect(stats.total_conversions).toBeGreaterThan(0);
      expect(stats.success_rate).toBeGreaterThanOrEqual(0);
      expect(stats.category_service_stats).toBeDefined();
    });

    it('헬스체크 테스트', async () => {
      const health = await integrationService.healthCheck();

      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.details.integration_stats).toBeDefined();
      expect(health.details.category_service_health).toBeDefined();
    });
  });
});