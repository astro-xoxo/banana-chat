/**
 * Message-to-Prompt Conversion Engine
 * 메시지 내용을 분석하여 ComfyUI 호환 이미지 생성 프롬프트로 변환하는 서비스
 * 
 * Task 001: Design Message-to-Prompt Conversion Engine
 */

// 타입 정의 내보내기
export type {
  ExtractedKeywords,
  PromptTemplate,
  GeneratedPrompt,
  MessageContext,
  ConversionOptions,
  ConversionResult,
  MessageAnalyzer,
  PromptGenerator,
  MessageToPromptService
} from './types';

export { 
  MessageToPromptError, 
  ERROR_CODES, 
  QUALITY_LEVELS 
} from './types';

// 구현 클래스 내보내기
export { MessageAnalyzerImpl } from './MessageAnalyzer';
export { PromptGeneratorImpl } from './PromptGenerator';
export { MessageToPromptServiceImpl } from './MessageToPromptService';

// 새로운 카테고리 프롬프트 통합 서비스
export { CategoryPromptIntegrationService } from './CategoryPromptIntegration';

// 편의 함수 내보내기
export {
  convertMessageToPrompt,
  convertMessagesToPrompts,
  getMessageToPromptService
} from './MessageToPromptService';

// 기본 내보내기 (메인 서비스)
export { getMessageToPromptService as default } from './MessageToPromptService';

/**
 * 사용 예시:
 * 
 * import { getMessageToPromptService, type MessageContext } from '@/lib/services/message-to-prompt';
 * 
 * const service = getMessageToPromptService();
 * 
 * const context: MessageContext = {
 *   message_id: '123',
 *   session_id: 'session_456',
 *   message_content: '행복한 고양이가 공원에서 놀고 있어요',
 *   previous_messages: [],
 *   user_preferences: {
 *     preferred_style: '수채화',
 *     art_style: 'cute'
 *   }
 * };
 * 
 * const result = await service.convert(context, {
 *   quality_level: 'high',
 *   template_id: 'general'
 * });
 * 
 * if (result.success) {
 *   console.log('Generated prompt:', result.prompt.positive_prompt);
 *   console.log('Quality score:', result.prompt.quality_score);
 * } else {
 *   console.error('Conversion failed:', result.error);
 * }
 */
