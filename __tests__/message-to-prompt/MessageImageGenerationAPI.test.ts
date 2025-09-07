/**
 * 메시지 기반 이미지 생성 API 통합 테스트
 * Task 002 - Expand Chat Image Generation API
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/chat/generate-message-image/route';

// Mock dependencies
jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedServerClient: jest.fn()
}));

jest.mock('@/lib/comfyui/client', () => ({
  callComfyUIServer: jest.fn()
}));

jest.mock('@/lib/services/message-to-prompt', () => ({
  getMessageToPromptService: jest.fn()
}));

import { createAuthenticatedServerClient } from '@/lib/supabase-server';
import { callComfyUIServer } from '@/lib/comfyui/client';
import { getMessageToPromptService } from '@/lib/services/message-to-prompt';

describe('/api/chat/generate-message-image', () => {
  let mockSupabase: any;
  let mockMessageToPromptService: any;

  beforeEach(() => {
    // Supabase mock 설정
    mockSupabase = {
      auth: {
        getSession: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            limit: jest.fn(() => ({
              // 추가 체이닝을 위한 mock
              order: jest.fn(() => ({
                limit: jest.fn()
              }))
            }))
          })),
          lt: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn()
            }))
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn()
        })),
        upsert: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    };

    (createAuthenticatedServerClient as jest.Mock).mockResolvedValue({
      client: mockSupabase
    });

    // MessageToPromptService mock 설정
    mockMessageToPromptService = {
      convert: jest.fn()
    };

    (getMessageToPromptService as jest.Mock).mockReturnValue(mockMessageToPromptService);

    // ComfyUI mock 설정
    (callComfyUIServer as jest.Mock).mockResolvedValue({
      success: true,
      chat_image_url: 'https://example.com/generated-image.png',
      generation_job_id: 'job_123'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/chat/generate-message-image', () => {
    const createMockRequest = (body: any) => {
      return {
        json: jest.fn().mockResolvedValue(body),
        url: 'http://localhost:3000/api/chat/generate-message-image'
      } as unknown as NextRequest;
    };

    const createMockSession = (userId: string = 'user_123') => ({
      user: { id: userId }
    });

    const createMockMessage = (overrides: any = {}) => ({
      id: 'msg_123',
      content: '오늘은 정말 행복한 하루였어요! 공원에서 예쁜 꽃들을 많이 봤거든요.',
      role: 'assistant',
      session_id: 'session_123',
      metadata: null,
      created_at: '2024-01-15T10:00:00Z',
      chat_sessions: {
        user_id: 'user_123',
        chatbot_id: 'bot_123',
        chatbots: {
          id: 'bot_123',
          name: '친근한 친구',
          personality_description: '밝고 긍정적인 성격',
          concept_id: 'concept_123',
          speech_preset_id: 'speech_123',
          concepts: {
            name: '친근한 친구',
            description: '항상 밝고 긍정적인 친구',
            relationship_type: 'friend'
          },
          speech_presets: {
            name: '친근한 말투',
            description: '편안하고 친근한 대화 스타일'
          }
        }
      },
      ...overrides
    });

    test('성공적인 메시지 기반 이미지 생성', async () => {
      // Arrange
      const requestBody = {
        message_id: 'msg_123',
        quality_level: 'high',
        style_override: 'watercolor, artistic'
      };

      const request = createMockRequest(requestBody);
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = createMockMessage();
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMessage,
              error: null
            })
          })
        })
      });

      // 할당량 조회 mock
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    image_generation_count: 5,
                    daily_limit: 10,
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          };
        }
        return mockSupabase.from();
      });

      // 이전 메시지 조회 mock
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null
                }),
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [
                        { role: 'user', content: '안녕하세요', created_at: '2024-01-15T09:00:00Z' },
                        { role: 'assistant', content: '안녕하세요!', created_at: '2024-01-15T09:01:00Z' }
                      ],
                      error: null
                    })
                  })
                })
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
        return {
          upsert: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        };
      });

      // 프롬프트 변환 mock
      mockMessageToPromptService.convert.mockResolvedValue({
        success: true,
        prompt: {
          positive_prompt: 'happy person in a beautiful park with flowers, watercolor style, high quality',
          negative_prompt: 'blurry, low quality, distorted',
          quality_score: 0.85,
          template_used: 'general',
          source_keywords: {
            emotions: ['행복한'],
            situations: ['공원에서'],
            objects: ['꽃들'],
            style: ['수채화'],
            confidence: 0.8
          }
        },
        performance: {
          extraction_time_ms: 500,
          generation_time_ms: 300,
          total_time_ms: 800,
          tokens_used: 150
        }
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.image_url).toBe('https://example.com/generated-image.png');
      expect(responseData.prompt_info).toBeDefined();
      expect(responseData.prompt_info.positive_prompt).toContain('happy person');
      expect(responseData.prompt_info.quality_score).toBe(0.85);
      expect(responseData.generation_job_id).toBe('job_123');

      // 서비스 호출 검증
      expect(mockMessageToPromptService.convert).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: 'msg_123',
          session_id: 'session_123',
          message_content: expect.stringContaining('행복한 하루'),
          previous_messages: expect.any(Array),
          chatbot_info: expect.objectContaining({
            personality: '밝고 긍정적인 성격',
            relationship_type: 'friend'
          })
        }),
        expect.objectContaining({
          quality_level: 'high',
          style_override: 'watercolor, artistic',
          include_context: true,
          fallback_on_error: true
        })
      );

      expect(callComfyUIServer).toHaveBeenCalledWith(
        null, // 메시지 기반이므로 user_image_url은 null
        'message_based',
        'user_123',
        expect.objectContaining({
          chatbotName: '친근한 친구',
          customPrompt: 'happy person in a beautiful park with flowers, watercolor style, high quality',
          negativePrompt: 'blurry, low quality, distorted',
          timeout: 120000,
          retries: 2,
          metadata: expect.objectContaining({
            message_id: 'msg_123',
            session_id: 'session_123'
          })
        })
      );
    });

    test('인증되지 않은 요청 거부', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null }
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('인증이 필요합니다.');
    });

    test('존재하지 않는 메시지 요청 시 404 반환', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'nonexistent' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('메시지를 찾을 수 없습니다.');
    });

    test('사용자 메시지에 대한 이미지 생성 요청 시 400 반환', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const userMessage = createMockMessage({ role: 'user' });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: userMessage,
              error: null
            })
          })
        })
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('AI 메시지에 대해서만 이미지를 생성할 수 있습니다.');
    });

    test('일일 할당량 초과 시 429 반환', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = createMockMessage();
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null
                })
              })
            })
          };
        } else if (table === 'user_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    image_generation_count: 10, // 할당량 초과
                    daily_limit: 10,
                    updated_at: new Date().toISOString()
                  },
                  error: null
                })
              })
            })
          };
        }
        return { /* other tables */ };
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(429);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('일일 이미지 생성 제한에 도달했습니다');
    });

    test('프롬프트 변환 실패 시 500 반환', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = createMockMessage();
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null
                }),
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          };
        } else if (table === 'user_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    image_generation_count: 5,
                    daily_limit: 10,
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          };
        }
        return { /* other tables */ };
      });

      // 프롬프트 변환 실패 mock
      mockMessageToPromptService.convert.mockResolvedValue({
        success: false,
        prompt: null,
        error: {
          code: 'CLAUDE_API_ERROR',
          message: 'Claude API 오류',
          retry_suggested: true
        }
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Claude API 오류');
    });

    test('ComfyUI 서버 실패 시 500 반환', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      // 성공적인 인증 및 메시지 조회 설정
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = createMockMessage();
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null
                }),
                lt: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              })
            })
          };
        } else if (table === 'user_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    image_generation_count: 5,
                    daily_limit: 10,
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          };
        }
        return { };
      });

      // 성공적인 프롬프트 변환
      mockMessageToPromptService.convert.mockResolvedValue({
        success: true,
        prompt: {
          positive_prompt: 'test prompt',
          negative_prompt: 'blurry',
          quality_score: 0.8,
          template_used: 'general',
          source_keywords: {}
        },
        performance: { total_time_ms: 500 }
      });

      // ComfyUI 서버 실패 mock
      (callComfyUIServer as jest.Mock).mockResolvedValue({
        success: false,
        error: 'ComfyUI 서버 연결 실패'
      });

      // Act
      const response = await POST(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('ComfyUI 서버 연결 실패');
    });
  });

  describe('GET /api/chat/generate-message-image', () => {
    const createMockRequest = (searchParams: Record<string, string>) => {
      const url = new URL('http://localhost:3000/api/chat/generate-message-image');
      Object.entries(searchParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      return {
        url: url.toString()
      } as unknown as NextRequest;
    };

    test('이미지 생성 가능한 메시지 확인', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = {
        id: 'msg_123',
        role: 'assistant',
        metadata: null,
        chat_sessions: { user_id: 'user_123' }
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'chat_messages') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: mockMessage,
                  error: null
                })
              })
            })
          };
        } else if (table === 'user_quotas') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    image_generation_count: 5,
                    daily_limit: 10,
                    updated_at: '2024-01-15T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          };
        }
        return { };
      });

      // Act
      const response = await GET(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.can_generate).toBe(true);
      expect(responseData.reason).toBe('생성 가능');
      expect(responseData.quota_info).toEqual({
        current_count: 5,
        daily_limit: 10,
        remaining: 5
      });
    });

    test('이미 이미지가 있는 메시지 확인', async () => {
      // Arrange
      const request = createMockRequest({ message_id: 'msg_123' });
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession() }
      });

      const mockMessage = {
        id: 'msg_123',
        role: 'assistant',
        metadata: {
          images: [{ url: 'existing-image.png' }]
        },
        chat_sessions: { user_id: 'user_123' }
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockMessage,
              error: null
            })
          })
        })
      });

      // Act
      const response = await GET(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.can_generate).toBe(false);
      expect(responseData.reason).toBe('이미 이미지 존재');
      expect(responseData.existing_images).toHaveLength(1);
    });

    test('message_id 파라미터 누락 시 400 반환', async () => {
      // Arrange
      const request = createMockRequest({});

      // Act
      const response = await GET(request);
      const responseData = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('message_id 파라미터가 필요합니다.');
    });
  });
});
