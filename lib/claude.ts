import { createClient } from '@supabase/supabase-js';
import { monitorClaudeAPI, endPerformanceTracking } from '@/lib/performanceMonitor';
import { getMessageTagEnhancer } from '@/lib/messageTagEnhancer';

// Supabase 클라이언트 설정 (Service Role - RLS 우회)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Claude API 설정
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// 인터페이스 정의
export interface ChatContext {
  chatbotId: string;
  systemPrompt: string;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export interface ClaudeApiResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  model: string;
  role: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API 클라이언트 클래스
 */
export class ClaudeClient {
  private apiKey: string;
  private apiUrl: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options?: {
    maxRetries?: number;
    timeoutMs?: number;
  }) {
    if (!CLAUDE_API_KEY) {
      throw new Error('Claude API 키가 설정되지 않았습니다. CLAUDE_API_KEY 환경변수를 확인하세요.');
    }

    this.apiKey = CLAUDE_API_KEY;
    this.apiUrl = CLAUDE_API_URL;
    this.maxRetries = options?.maxRetries || 3;
    this.timeoutMs = options?.timeoutMs || 10000; // 10초 타임아웃
  }

  /**
   * Claude API 호출 (재시도 로직 포함 + 성능 모니터링)
   */
  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      userId?: string;
    }
  ): Promise<string> {
    const {
      maxTokens = 1000,
      temperature = 0.8,
      model = 'claude-3-5-sonnet-20241022',
      userId
    } = options || {};

    // 성능 모니터링 시작
    const operationId = `claude_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const performanceTrackingId = monitorClaudeAPI(
      operationId, 
      userMessage.length + systemPrompt.length,
      { user_id: userId }
    )

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Claude API 호출 시도 ${attempt}/${this.maxRetries}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            messages: [
              {
                role: 'user',
                content: userMessage
              }
            ],
            system: systemPrompt
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }

          console.error(`Claude API 오류 (시도 ${attempt}):`, {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            retryable: (response.status === 429 || response.status >= 500) && attempt < this.maxRetries
          });

          // 상세한 에러 타입별 처리
          if (response.status === 429) {
            // Rate Limit 에러 - 세부 원인 분석
            const retryAfter = response.headers.get('retry-after');
            const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
            
            console.log(`Rate Limit 도달. ${retryAfterMs}ms 후 재시도 (시도 ${attempt}/${this.maxRetries})`);
            
            if (attempt < this.maxRetries) {
              await this.sleep(retryAfterMs);
              continue;
            }

            // 성능 모니터링 종료 (실패)
            endPerformanceTracking(performanceTrackingId, false, 'RATE_LIMIT_EXCEEDED', {
              retry_after: parseInt(retryAfter || '60'),
              attempts: attempt
            })

            const rateLimitError = new Error('RATE_LIMIT_EXCEEDED');
            (rateLimitError as any).retryAfter = parseInt(retryAfter || '60');
            (rateLimitError as any).details = errorData;
            throw rateLimitError;
          }

          // 5xx 서버 에러 - 재시도 가능
          if (response.status >= 500 && attempt < this.maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000; // 지수 백오프
            console.log(`서버 오류 (${response.status}). ${waitTime}ms 후 재시도 (시도 ${attempt}/${this.maxRetries})`);
            await this.sleep(waitTime);
            continue;
          }

          // 4xx 클라이언트 에러 - 재시도 불가
          if (response.status >= 400 && response.status < 500) {
            // 성능 모니터링 종료 (실패)
            endPerformanceTracking(performanceTrackingId, false, `CLIENT_ERROR_${response.status}`, {
              status: response.status,
              attempts: attempt
            })

            const clientError = new Error(`CLIENT_ERROR_${response.status}`);
            (clientError as any).status = response.status;
            (clientError as any).details = errorData;
            throw clientError;
          }

          // 기타 에러
          const unknownError = new Error(`UNKNOWN_API_ERROR_${response.status}`);
          (unknownError as any).status = response.status;
          (unknownError as any).details = errorData;
          throw unknownError;
        }

        const data: ClaudeApiResponse = await response.json();
        
        if (!data.content || !data.content[0] || !data.content[0].text) {
          throw new Error('Claude API 응답 형식이 올바르지 않습니다.');
        }

        const responseText = data.content[0].text;
        
        // 성능 모니터링 종료 (성공)
        endPerformanceTracking(performanceTrackingId, true, undefined, {
          attempts: attempt,
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
          response_length: responseText.length,
          model: model
        })

        console.log('Claude API 응답 성공:', {
          attempt,
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          responseLength: responseText.length
        });

        // 🏷️ 태그 강화 시스템 적용
        console.log('🔍 태그 강화 시스템 시작 - 상세 로깅:', {
          response_preview: responseText.substring(0, 100),
          system_prompt_preview: systemPrompt.substring(0, 100)
        });
        
        try {
          console.log('🔍 getMessageTagEnhancer 호출 시도...');
          const tagEnhancer = getMessageTagEnhancer();
          console.log('✅ tagEnhancer 인스턴스 생성 완료');
          
          console.log('🔍 addHiddenTags 호출 시도...');
          const enhancedMessage = await tagEnhancer.addHiddenTags(responseText, {
            recentMessages: [], // 컨텍스트 메시지는 별도 처리 필요
            chatbotPersonality: systemPrompt.substring(0, 200) // 시스템 프롬프트에서 성격 추출
          });

          console.log('🏷️ 태그 강화 적용 완료:', {
            original_length: responseText.length,
            enhanced_length: enhancedMessage.length,
            tags_added: enhancedMessage !== responseText,
            has_html_comments: enhancedMessage.includes('<!--'),
            enhanced_preview: enhancedMessage.substring(0, 200)
          });

          return enhancedMessage;

        } catch (tagError) {
          console.error('🚨 태그 강화 실패 - 상세 오류:', {
            error_message: tagError instanceof Error ? tagError.message : tagError,
            error_stack: tagError instanceof Error ? tagError.stack : undefined,
            error_name: tagError instanceof Error ? tagError.name : undefined
          });
          return responseText; // 태그 강화 실패 시 원본 반환
        }

      } catch (error) {
        console.error(`Claude API 호출 시도 ${attempt} 실패:`, {
          error: error instanceof Error ? error.message : error,
          attempt: `${attempt}/${this.maxRetries}`,
          isTimeout: error instanceof Error && error.name === 'AbortError',
          isNetworkError: error instanceof TypeError,
          willRetry: attempt < this.maxRetries
        });

        // 마지막 시도에서도 실패하면 적절한 에러 타입으로 분류
        if (attempt === this.maxRetries) {
          let errorType = 'UNKNOWN_ERROR'
          let errorDetails: any = {}

          if (error instanceof Error && error.name === 'AbortError') {
            errorType = 'API_TIMEOUT'
            errorDetails = { timeoutMs: this.timeoutMs }
            const timeoutError = new Error('API_TIMEOUT');
            (timeoutError as any).timeoutMs = this.timeoutMs;
            (timeoutError as any).message = `Claude API 타임아웃 (${this.timeoutMs}ms)`;
            
            // 성능 모니터링 종료 (타임아웃)
            endPerformanceTracking(performanceTrackingId, false, errorType, { 
              ...errorDetails, 
              attempts: attempt 
            })
            
            throw timeoutError;
          }

          if (error instanceof TypeError) {
            errorType = 'NETWORK_ERROR'
            const networkError = new Error('NETWORK_ERROR');
            (networkError as any).originalError = error;
            (networkError as any).message = '네트워크 연결 오류가 발생했습니다';
            
            // 성능 모니터링 종료 (네트워크 에러)
            endPerformanceTracking(performanceTrackingId, false, errorType, { 
              attempts: attempt 
            })
            
            throw networkError;
          }

          // 이미 분류된 에러는 그대로 전달
          if (error instanceof Error && (
            error.message.startsWith('RATE_LIMIT') ||
            error.message.startsWith('CLIENT_ERROR') ||
            error.message.startsWith('UNKNOWN_API_ERROR')
          )) {
            // 성능 모니터링 종료 (분류된 에러)
            endPerformanceTracking(performanceTrackingId, false, error.message, { 
              attempts: attempt 
            })
            throw error;
          }

          // 기타 예외
          const unknownError = new Error('UNKNOWN_ERROR');
          (unknownError as any).originalError = error;
          (unknownError as any).message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
          
          // 성능 모니터링 종료 (알 수 없는 에러)
          endPerformanceTracking(performanceTrackingId, false, 'UNKNOWN_ERROR', { 
            attempts: attempt,
            original_error: error instanceof Error ? error.message : 'Unknown'
          })
          
          throw unknownError;
        }

        // 재시도 대기 (지수 백오프)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`${waitTime}ms 대기 후 재시도 (${attempt + 1}/${this.maxRetries})`);
        await this.sleep(waitTime);
      }
    }

    // 최대 재시도 초과
    endPerformanceTracking(performanceTrackingId, false, 'MAX_RETRIES_EXCEEDED', { 
      max_retries: this.maxRetries 
    })
    throw new Error('Claude API 호출 최대 재시도 횟수 초과');
  }

  /**
   * 컨텍스트를 포함한 Claude 응답 생성 (강화된 에러 처리)
   */
  async generateContextualResponse(
    userMessage: string,
    context: ChatContext,
    options?: {
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    try {
      // 최근 메시지 히스토리를 컨텍스트로 포함
      const contextString = this.formatRecentMessages(context.recentMessages);
      
      console.log('🔍 generateContextualResponse 호출:', {
        userMessage: userMessage.substring(0, 50) + '...',
        recentMessagesCount: context.recentMessages.length,
        contextString: contextString.substring(0, 200) + '...',
        systemPromptLength: context.systemPrompt.length,
        fullContextString: contextString,  // 전체 컨텍스트 출력
        systemPromptPreview: context.systemPrompt.substring(0, 200) + '...' // 시스템 프롬프트 미리보기 추가
      });
      
      // 🔧 과거 잘못된 캐릭터 대화를 무시하고 현재 캐릭터 설정 강제 적용
      const enhancedSystemPrompt = `${context.systemPrompt}

⚠️ 중요한 지시사항:
이전 대화에서 다른 캐릭터(예: 도서관 사서)로 행동했을 수 있지만, 지금부터는 반드시 위에서 정의된 캐릭터 설정대로만 행동하세요.
과거 대화의 잘못된 캐릭터 설정은 완전히 무시하고, 현재 설정된 이름, 나이, 성별, 관계에 맞게 일관되게 행동하세요.

최근 대화 히스토리 (참고용):
${contextString}

위 대화 히스토리는 맥락 파악용일 뿐입니다. 캐릭터 설정은 위에서 정의된 것만 따르세요.`;

      console.log('🔍 enhancedSystemPrompt 생성:', {
        originalLength: context.systemPrompt.length,
        enhancedLength: enhancedSystemPrompt.length,
        contextIncluded: contextString !== '(이전 대화 없음)'
      });

      return await this.generateResponse(enhancedSystemPrompt, userMessage, options);

    } catch (error) {
      console.error('컨텍스트 포함 응답 생성 실패:', {
        error: error instanceof Error ? error.message : error,
        chatbotId: context.chatbotId,
        contextLength: context.recentMessages.length,
        systemPromptLength: context.systemPrompt.length
      });
      
      // 에러 타입별 처리
      if (error instanceof Error) {
        switch (error.message) {
          case 'API_TIMEOUT':
            console.log('타임아웃 발생 - 캐릭터별 타임아웃 메시지 생성');
            return this.generateCharacterSpecificTimeoutMessage(context, (error as any).timeoutMs);
            
          case 'RATE_LIMIT_EXCEEDED':
            console.log('Rate Limit 발생 - 캐릭터별 한도 초과 메시지 생성');
            return this.generateCharacterSpecificRateLimitMessage(context, (error as any).retryAfter);
            
          case 'NETWORK_ERROR':
            console.log('네트워크 오류 발생 - 폴백 시도');
            break;
            
          default:
            if (error.message.startsWith('CLIENT_ERROR')) {
              console.log('클라이언트 오류 발생 - 입력 검증 필요');
              return this.generateCharacterSpecificErrorMessage(context, 'input_error');
            }
        }
      }
      
      // 폴백 1: 컨텍스트 없이 기본 응답 시도
      try {
        console.log('폴백 1: 기본 시스템 프롬프트로 재시도');
        return await this.generateResponse(context.systemPrompt, userMessage, options);
      } catch (fallbackError) {
        console.error('폴백 1 실패:', fallbackError);
        
        // 폴백 2: 캐릭터별 맞춤 폴백 메시지 생성
        console.log('폴백 2: 캐릭터별 맞춤 폴백 메시지 생성');
        return this.generateCharacterSpecificFallbackMessage(context);
      }
    }
  }

  /**
   * 캐릭터별 타임아웃 메시지 생성
   */
  private generateCharacterSpecificTimeoutMessage(context: ChatContext, timeoutMs: number): string {
    const relationshipType = this.extractRelationshipType(context.systemPrompt);
    const chatbotName = this.extractChatbotName(context.systemPrompt);
    
    return ClaudeClient.generateTimeoutMessage(timeoutMs, relationshipType, chatbotName);
  }

  /**
   * 캐릭터별 Rate Limit 메시지 생성
   */
  private generateCharacterSpecificRateLimitMessage(context: ChatContext, retryAfter?: number): string {
    const relationshipType = this.extractRelationshipType(context.systemPrompt);
    
    return ClaudeClient.generateRateLimitMessage(429, relationshipType, retryAfter);
  }

  /**
   * 캐릭터별 일반 에러 메시지 생성
   */
  private generateCharacterSpecificErrorMessage(context: ChatContext, errorType: string): string {
    const relationshipType = this.extractRelationshipType(context.systemPrompt);
    const personalityTraits = this.extractPersonalityTraits(context.systemPrompt);
    
    return ClaudeClient.generateFallbackMessage(undefined, relationshipType, personalityTraits);
  }

  /**
   * 캐릭터별 맞춤 폴백 메시지 생성
   */
  private generateCharacterSpecificFallbackMessage(context: ChatContext): string {
    const relationshipType = this.extractRelationshipType(context.systemPrompt);
    const personalityTraits = this.extractPersonalityTraits(context.systemPrompt);
    const chatbotName = this.extractChatbotName(context.systemPrompt);
    
    return ClaudeClient.generateFallbackMessage(chatbotName, relationshipType, personalityTraits);
  }

  /**
   * 시스템 프롬프트에서 관계 유형 추출
   */
  private extractRelationshipType(systemPrompt: string): string | undefined {
    const relationshipMatch = systemPrompt.match(/관계.*?:(.*?)(?:\n|$)/i);
    if (relationshipMatch) {
      const relationship = relationshipMatch[1].trim().toLowerCase();
      if (relationship.includes('가족') || relationship.includes('family')) return 'family';
      if (relationship.includes('친구') || relationship.includes('friend')) return 'friend';
      if (relationship.includes('연인') || relationship.includes('lover')) return 'lover';
      if (relationship.includes('썸') || relationship.includes('some')) return 'some';
    }
    return undefined;
  }

  /**
   * 시스템 프롬프트에서 성격 특성 추출
   */
  private extractPersonalityTraits(systemPrompt: string): string | undefined {
    const personalityMatch = systemPrompt.match(/성격.*?:(.*?)(?:\n|$)/i);
    return personalityMatch ? personalityMatch[1].trim() : undefined;
  }

  /**
   * 시스템 프롬프트에서 챗봇 이름 추출
   */
  private extractChatbotName(systemPrompt: string): string | undefined {
    const nameMatch = systemPrompt.match(/이름.*?:(.*?)(?:\n|$)/i);
    return nameMatch ? nameMatch[1].trim() : undefined;
  }

  /**
   * 최근 메시지를 문자열로 포맷
   */
  private formatRecentMessages(messages: Array<{role: string, content: string, timestamp: string}>): string {
    if (!messages || messages.length === 0) {
      return '(이전 대화 없음)';
    }

    console.log('🔍 formatRecentMessages 호출:', {
      totalMessages: messages.length,
      messages: messages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`)
    });

    const formattedMessages = messages
      .slice(-10) // 최근 10개 메시지 사용 (5개→10개로 증가)
      .map(msg => `${msg.role === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
      .join('\n');
      
    console.log('🔍 formatRecentMessages 결과:', {
      resultLength: formattedMessages.length,
      result: formattedMessages
    });
    
    return formattedMessages;
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 캐릭터별 맞춤 폴백 메시지 생성
   */
  static generateFallbackMessage(
    chatbotName?: string, 
    relationshipType?: string,
    personalityTraits?: string
  ): string {
    // 관계 유형별 기본 폴백 메시지
    const relationshipBasedMessages = {
      'family': [
        '앗, 잠깐만... 뭔가 생각이 복잡해졌네. 다시 말해줄래?',
        '어머, 지금 좀 멍해져서... 조금 후에 다시 얘기하면 안 될까?',
        '아이고, 미안해. 갑자기 정신이 없어서... 다시 천천히 말해줘.'
      ],
      'friend': [
        '어? 잠깐, 뭔가 꼬였네! 다시 말해봐!',
        '아니 진짜 지금 머리가 하얘져서... 다시 얘기해줄래?',
        '헉, 미안! 갑자기 딴 생각했나봐. 뭐라고 했더라?'
      ],
      'lover': [
        '어? 잠깐... 지금 너무 설레서 집중이 안 돼. 다시 말해줄래?',
        '미안해... 지금 네 생각에 빠져서 못 들었어. 다시 한 번?',
        '앗... 너만 보고 있었나봐. 뭐라고 했어?'
      ],
      'some': [
        '어... 뭐라고? 갑자기 떨려서 못 들었어.',
        '잠깐만... 너 때문에 정신이 없어져서... 다시?',
        '어떡하지... 갑자기 심장이 뛰어서 집중이... 다시 말해줄래?'
      ]
    };

    // 성격별 추가 메시지
    const personalityBasedMessages = {
      'shy': [
        '어... 어떡하지... 갑자기 말문이 막혔어...',
        '미, 미안해... 너무 부끄러워서 말이 안 나와...'
      ],
      'cheerful': [
        '어라라! 뭔가 꼬였네! 다시 다시!',
        '앗! 깜빡했어! 뭐라고 했더라?'
      ],
      'tsundere': [
        '뭐, 뭐야! 갑자기 이상해져서...! 다, 다시 말해봐!',
        '별, 별로 안 중요하니까! 그냥... 다시 말해도 돼...'
      ]
    };

    let messages: string[] = [];

    // 관계 유형별 메시지 추가
    if (relationshipType && relationshipBasedMessages[relationshipType as keyof typeof relationshipBasedMessages]) {
      messages = [...relationshipBasedMessages[relationshipType as keyof typeof relationshipBasedMessages]];
    }

    // 성격별 메시지 추가
    if (personalityTraits) {
      Object.keys(personalityBasedMessages).forEach(trait => {
        if (personalityTraits.toLowerCase().includes(trait)) {
          messages = [...messages, ...personalityBasedMessages[trait as keyof typeof personalityBasedMessages]];
        }
      });
    }

    // 기본 메시지 (백업용)
    if (messages.length === 0) {
      messages = [
        '죄송해요, 지금은 답변을 생성할 수 없어요. 잠시 후 다시 시도해주세요.',
        '일시적으로 응답에 어려움이 있어요. 조금 있다가 다시 말해주시겠어요?',
        '아, 지금 생각이 잘 안 나네요. 다른 말로 다시 말해주시면 안될까요?',
        '잠깐, 뭔가 문제가 있는 것 같아요. 다시 시도해보시겠어요?'
      ];
    }

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return randomMessage;
  }

  /**
   * 타임아웃 상황별 맞춤 메시지 생성
   */
  static generateTimeoutMessage(
    timeoutMs: number,
    relationshipType?: string,
    chatbotName?: string
  ): string {
    const timeoutMessages = {
      'family': [
        `아이고, ${timeoutMs/1000}초나 기다렸구나... 미안해, 생각하느라 시간이 좀 걸렸어.`,
        `어머, 너무 오래 기다렸지? 복잡한 생각을 하느라 그랬어.`,
        `미안해, 깊게 생각해보느라 시간이 걸렸네. 다시 말해줄래?`
      ],
      'friend': [
        `어? ${timeoutMs/1000}초나 멍때렸네! 미안미안!`,
        `와 진짜 오래 걸렸다! 뭔가 복잡해서 그랬어!`,
        `헉! 너무 오래 기다렸지? 다시 말해봐!`
      ],
      'lover': [
        `미안해... ${timeoutMs/1000}초나 기다렸구나. 너한테 뭐라고 말할지 고민했어.`,
        `아... 너무 오래 기다렸네. 완벽한 답을 주고 싶어서 그랬어.`,
        `죄송해... 네 마음에 상처 주지 않을 말을 찾느라 시간이 걸렸어.`
      ],
      'some': [
        `어... ${timeoutMs/1000}초나 기다렸어? 뭐라고 말할지 몰라서...`,
        `미안... 너무 떨려서 대답이 안 나왔어.`,
        `어떡하지... 너한테 어떻게 말해야 할지 모르겠어서...`
      ]
    };

    const messages = relationshipType && timeoutMessages[relationshipType as keyof typeof timeoutMessages] 
      ? timeoutMessages[relationshipType as keyof typeof timeoutMessages]
      : [`${timeoutMs/1000}초 동안 응답을 기다렸지만 시간이 초과되었어요. 다시 시도해주시겠어요?`];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * API 한도 초과 시 친화적 메시지 생성
   */
  static generateRateLimitMessage(
    errorCode: number,
    relationshipType?: string,
    retryAfter?: number
  ): string {
    const retryMessage = retryAfter 
      ? `${Math.ceil(retryAfter / 60)}분 후에 다시 시도해주세요.`
      : '잠시 후에 다시 시도해주세요.';

    const rateLimitMessages = {
      'family': [
        `아이고, 지금 너무 많은 사람들이 얘기를 걸어서 정신이 없어. ${retryMessage}`,
        `미안해, 지금 좀 바빠서... ${retryMessage}`,
        `어머, 지금 할 일이 너무 많아서... ${retryMessage}`
      ],
      'friend': [
        `앗! 지금 사람이 너무 많아서 정신없어! ${retryMessage}`,
        `어? 지금 너무 바빠서 정신이 하나도 없어! ${retryMessage}`,
        `헉! 동시에 너무 많은 친구들이 연락해서...! ${retryMessage}`
      ],
      'lover': [
        `미안해... 지금 다른 일 때문에 바빠서... ${retryMessage} 기다려줄래?`,
        `죄송해, 지금 잠깐 바쁜 일이 있어서... ${retryMessage}`,
        `아... 지금 정말 바빠서... ${retryMessage} 조금만 기다려줘.`
      ],
      'some': [
        `어... 지금 좀 바빠서... ${retryMessage}`,
        `미안... 지금 다른 사람들이랑 얘기 중이어서... ${retryMessage}`,
        `어떡하지... 지금 너무 정신없어서... ${retryMessage}`
      ]
    };

    const messages = relationshipType && rateLimitMessages[relationshipType as keyof typeof rateLimitMessages]
      ? rateLimitMessages[relationshipType as keyof typeof rateLimitMessages]
      : [`현재 서버가 바빠서 응답할 수 없어요. ${retryMessage}`];

    return messages[Math.floor(Math.random() * messages.length)];
  }
}

/**
 * 챗봇 컨텍스트 관리 클래스 (캐싱 및 성능 최적화 포함)
 */
export class ChatContextManager {
  private static readonly MAX_CONTEXT_MESSAGES = 10;
  private static readonly CONTEXT_WINDOW_HOURS = 24;
  private static readonly CACHE_TTL_MINUTES = 5; // 캐시 유효시간 5분
  private static readonly MAX_CACHE_SIZE = 100; // 최대 캐시 크기
  
  // 메모리 캐시 (세션별 컨텍스트)
  private static contextCache = new Map<string, {
    context: ChatContext;
    timestamp: number;
    messageCount: number;
  }>();
  
  private static cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0
  };

  /**
   * 캐시 통계 조회
   */
  static getCacheStats() {
    return {
      ...this.cacheStats,
      cacheSize: this.contextCache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
  
  /**
   * 캐시 정리 (만료된 항목 제거)
   */
  private static cleanupCache() {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, value] of this.contextCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MINUTES * 60 * 1000) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.contextCache.delete(key);
      this.cacheStats.evictions++;
    });
    
    // 캐시 크기 제한
    if (this.contextCache.size > this.MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(this.contextCache.keys())
        .slice(0, this.contextCache.size - this.MAX_CACHE_SIZE);
      
      keysToDelete.forEach(key => {
        this.contextCache.delete(key);
        this.cacheStats.evictions++;
      });
    }
  }
  
  /**
   * 세션의 최근 컨텍스트 조회 (캐싱 포함)
   */
  static async getRecentContext(sessionId: string, chatbotName?: string): Promise<ChatContext> {
    const startTime = Date.now();
    
    try {
      // 1. 캐시 확인 - 🔧 잘못된 캐릭터 설정으로 인한 캐시 강제 무효화
      this.cleanupCache();
      
      // 🔧 기존 캐시가 잘못된 캐릭터 설정을 가지고 있을 수 있으므로 강제 삭제
      const existingCache = this.contextCache.get(sessionId);
      if (existingCache) {
        console.log('🔧 잘못된 캐릭터 설정 캐시 강제 무효화:', {
          sessionId,
          reason: 'character_settings_updated'
        });
        this.contextCache.delete(sessionId);
        this.cacheStats.evictions++;
      }
      
      // 캐시를 사용하지 않고 항상 DB에서 새로 조회 (캐릭터 설정 수정 후)
      
      console.log('컨텍스트 캐시 미스 - DB 조회:', { sessionId });
      this.cacheStats.misses++;
      // 최근 대화 메시지 조회 (시간 제한 제거 - 테스트용)
      console.log('🔍 메시지 히스토리 조회 시작 (시간 제한 없음):', {
        sessionId,
        maxMessages: this.MAX_CONTEXT_MESSAGES
      });

      const { data: messages, error: messagesError } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(this.MAX_CONTEXT_MESSAGES);

      console.log('🔍 메시지 히스토리 조회 결과:', {
        sessionId,
        messageCount: messages?.length || 0,
        messages: messages?.map(m => ({
          role: m.role,
          content: m.content.substring(0, 50) + '...',
          created_at: m.created_at
        })) || [],
        error: messagesError
      });

      if (messagesError) {
        console.error('메시지 히스토리 조회 오류:', messagesError);
      }

      // 챗봇 정보 및 시스템 프롬프트 조회 (저장된 5개 필드 포함)
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select(`
          chatbot_id,
          chatbots (
            id,
            name,
            age,
            gender,
            personality_description,
            relationship_type,
            concept_id,
            speech_preset_id,
            concepts:concept_id (
              name,
              description,
              relationship_type,
              system_prompt
            ),
            speech_presets:speech_preset_id (
              name,
              description,
              system_prompt
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('세션 정보 조회 오류:', sessionError);
        throw new Error('세션 정보를 찾을 수 없습니다.');
      }

      // 🔧 ChatContextManager에서 새로운 generateSystemPromptFromStoredData 사용
      const { generateSystemPromptFromStoredData } = await import('@/lib/chatbotUtils');
      
      const chatbot = session.chatbots;
      
      // 저장된 5개 필드를 기반으로 시스템 프롬프트 생성 (API와 동일한 방식)
      const effectiveName = chatbotName || chatbot.name || '친구';
      // 🔧 올바른 concept 매핑 - personality_description 사용
      const effectiveConcept = chatbot.personality_description || '일상 대화';
      
      console.log('🔍 ChatContextManager에서 저장된 데이터 기반 시스템 프롬프트 생성:', {
        parameter_chatbotName: chatbotName,
        db_chatbot_name: chatbot.name,
        effective_name: effectiveName,
        age: chatbot.age,
        gender: chatbot.gender,
        db_personality_description: chatbot.personality_description,
        effective_concept: effectiveConcept,
        relationship: chatbot.relationship_type || '친구',
        source: 'CHAT_CONTEXT_MANAGER_FIXED'
      });
      
      // 🎯 우선순위: 저장된 system_prompt 사용, 없으면 동적 생성
      let systemPrompt: string;
      
      if (chatbot.system_prompt && chatbot.system_prompt.trim().length > 50) {
        // 저장된 상세 system_prompt가 있으면 우선 사용
        systemPrompt = chatbot.system_prompt;
        console.log('✅ 저장된 system_prompt 사용:', {
          source: 'DATABASE_STORED',
          length: systemPrompt.length,
          preview: systemPrompt.substring(0, 100) + '...'
        });
      } else {
        // 저장된 것이 없거나 너무 짧으면 동적 생성 (호환성)
        systemPrompt = generateSystemPromptFromStoredData({
          name: effectiveName,
          age: chatbot.age || 25,
          gender: chatbot.gender || 'female',
          concept: effectiveConcept,
          relationship: chatbot.relationship_type || '친구'
        });
        console.log('🔄 동적 system_prompt 생성:', {
          source: 'RUNTIME_GENERATED',
          length: systemPrompt.length,
          reason: '저장된_프롬프트_없음_또는_부족'
        });
      }

      const context: ChatContext = {
        chatbotId: session.chatbot_id,
        systemPrompt,
        recentMessages: (messages || [])
          .reverse() // 시간순 정렬
          .map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.created_at
          }))
      };
      
      console.log('🔍 최종 컨텍스트 객체 생성:', {
        sessionId,
        chatbotId: context.chatbotId,
        systemPromptLength: context.systemPrompt.length,
        recentMessagesCount: context.recentMessages.length,
        recentMessages: context.recentMessages.map(msg => ({
          role: msg.role,
          content: msg.content.substring(0, 30) + '...'
        }))
      });
      
      // 캐시에 저장
      this.contextCache.set(sessionId, {
        context,
        timestamp: Date.now(),
        messageCount: context.recentMessages.length
      });
      
      console.log('컨텍스트 캐시 저장 완료:', {
        sessionId,
        messageCount: context.recentMessages.length,
        loadTime: Date.now() - startTime
      });
      
      return context;

    } catch (error) {
      console.error('컨텍스트 조회 중 오류:', {
        error: error instanceof Error ? error.message : error,
        sessionId,
        loadTime: Date.now() - startTime
      });
      
      this.cacheStats.errors++;
      
      // 폴백 컨텍스트 반환
      const fallbackContext: ChatContext = {
        chatbotId: '',
        systemPrompt: '당신은 친절하고 도움이 되는 AI 어시스턴트입니다.',
        recentMessages: []
      };
      
      return fallbackContext;
    }
  }
  
  /**
   * 세션 캐시 무효화 (새 메시지 추가 시 호출)
   */
  static invalidateSessionCache(sessionId: string) {
    const existed = this.contextCache.has(sessionId);
    this.contextCache.delete(sessionId);
    
    if (existed) {
      console.log('세션 캐시 무효화:', { sessionId });
      this.cacheStats.evictions++;
    }
  }
  
  /**
   * 전체 캐시 초기화 (메모리 정리용)
   */
  static clearAllCache() {
    const evictedCount = this.contextCache.size;
    this.contextCache.clear();
    this.cacheStats.evictions += evictedCount;
    
    console.log(`전체 컨텍스트 캐시 정리: ${evictedCount}개 항목 제거`);
  }
  
  /**
   * 캐시 상태 모니터링 (메모리 사용량 추적)
   */
  static getMemoryUsage() {
    let totalSize = 0;
    
    for (const [sessionId, cacheItem] of this.contextCache.entries()) {
      // 대략적인 메모리 사용량 계산 (문자열 길이 기반)
      const sessionIdSize = sessionId.length * 2; // UTF-16
      const promptSize = cacheItem.context.systemPrompt.length * 2;
      const messagesSize = cacheItem.context.recentMessages.reduce((acc, msg) => {
        return acc + msg.content.length * 2 + msg.timestamp.length * 2;
      }, 0);
      
      totalSize += sessionIdSize + promptSize + messagesSize + 200; // 기본 객체 오버헤드
    }
    
    return {
      estimated_bytes: totalSize,
      estimated_mb: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      cache_entries: this.contextCache.size
    };
  }
}

/**
 * 편의 함수: Claude 응답 생성
 */
export async function generateClaudeResponse(
  userMessage: string,
  context: ChatContext,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const client = new ClaudeClient();
  
  try {
    return await client.generateContextualResponse(userMessage, context, options);
  } catch (error) {
    console.error('Claude 응답 생성 실패:', error);
    
    // 폴백 메시지 반환
    return ClaudeClient.generateFallbackMessage();
  }
}

/**
 * 편의 함수: 기본 Claude 응답 생성 (컨텍스트 없음)
 */
export async function generateSimpleClaudeResponse(
  systemPrompt: string,
  userMessage: string,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const client = new ClaudeClient();
  
  try {
    return await client.generateResponse(systemPrompt, userMessage, options);
  } catch (error) {
    console.error('Claude 응답 생성 실패:', error);
    return ClaudeClient.generateFallbackMessage();
  }
}
