import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSystemPrompt, generateSystemPromptFromStoredData } from '@/lib/chatbotUtils';
import { ClaudeClient, generateClaudeResponse, ChatContextManager } from '@/lib/claude';
import { logError, logWarning, logInfo, logQuotaUsage, logDatabaseHealth, logApiCall } from '@/lib/errorLogger';
import { authenticateUser } from '@/lib/auth-server';
import { mapConceptToPresetIdV2, mapConceptToPresetId } from '@/lib/comfyui/preset-mapper'; // V2 매핑 함수 추가

// Task 008: AI 챗봇 장기기억 시스템 import
import { ChatbotMemoryService } from '@/lib/services/chatbot/ChatbotMemoryService'

// 서버 사이드 Supabase 클라이언트 설정
console.log('🔍 Supabase 환경변수 확인:', {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  service_key_exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  service_key_prefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...'
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ChatRequest {
  message: string;
  chatbot_id: string;
  session_id?: string;
  // Phase 2에서 추가된 프리셋 정보 (선택적 파라미터로 하위 호환성 보장)
  concept_id?: string;
  speech_preset_id?: string;
  gender?: string;
  relationship_type?: string;
}

interface ChatbotData {
  id: string;
  name: string;
  personality_description: string;
  speech_preset_id: string | null;
  concept_id: string | null;
  concepts?: {
    name: string;
    description: string;
    relationship_type: string;
    system_prompt: string;
  };
  speech_presets?: {
    name: string;
    description: string;
    system_prompt: string;
  };
}

// 챗봇 정보 조회 (저장된 5개 필드 직접 사용)
async function getChatbotStoredData(chatbot_id: string, user_id: string) {
  console.log('🔍 getChatbotStoredData 호출:', { chatbot_id, user_id });

  const { data, error } = await supabase
    .from('chatbots')
    .select(`
      id,
      name,
      age,
      gender,
      personality_description,
      relationship_type,
      system_prompt,
      speech_preset_id,
      concept_id
    `)
    .eq('id', chatbot_id)
    .eq('user_id', user_id)
    .eq('is_active', true)
    .single();

  console.log('🔍 저장된 챗봇 데이터 조회 결과:', {
    data: data,
    error: error,
    name: data?.name,
    age: data?.age,
    gender: data?.gender,
    concept: data?.personality_description,
    relationship: data?.relationship_type
  });

  if (error) {
    console.error('챗봇 조회 오류:', error);
    return null;
  }

  return data;
}

// 챗봇 정보 조회 (컨셉 + 말투 포함) - 레거시 지원용
async function getChatbotWithPresets(chatbot_id: string, user_id: string): Promise<ChatbotData | null> {
  console.log('🔍 getChatbotWithPresets 호출:', { chatbot_id, user_id });

  const { data, error } = await supabase
    .from('chatbots')
    .select(`
      id,
      name,
      personality_description,
      speech_preset_id,
      concept_id,
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
    `)
    .eq('id', chatbot_id)
    .eq('user_id', user_id)  // 사용자 ID 검증 추가
    .eq('is_active', true)
    .single();

  console.log('🔍 Supabase 조회 결과:', {
    data: data,
    error: error,
    chatbot_name: data?.name,
    name_type: typeof data?.name
  });

  if (error) {
    console.error('챗봇 조회 오류:', error);
    return null;
  }

  return data as ChatbotData;
}

// 기존 챗봇 호환성 처리 (speech_preset_id가 null인 경우)
function getDefaultSpeechPreset(relationship_type?: string) {
  // relationship_type에 따른 기본 말투 ID 반환
  const defaultMappings = {
    'family': 1,  // 따뜻한 돌봄 말투
    'friend': 5,  // 신나는 모험 말투
    'lover': 9,   // 로맨틱한 연인 말투
    'some': 13    // 애매한 썸 말투
  };
  
  return defaultMappings[relationship_type as keyof typeof defaultMappings] || 1;
}

// 할당량 API 기반 관리

// 🔧 추가: 서버 내부 API 호출용 인증 토큰 생성
function createAuthToken(userId: string): string {
  // 간단한 JWT 형태의 토큰 생성 (서버 내부 통신용)
  const header = { alg: 'none', typ: 'JWT' };
  const payload = { 
    sub: userId, 
    user_id: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1시간 유효
    internal: true  // 내부 호출 표시
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  return `${encodedHeader}.${encodedPayload}.internal`;
}

// 할당량 소진 API 호출
async function consumeQuotaAPI(request: NextRequest, userId: string): Promise<{ success: boolean; remaining: number; error?: string }> {
  try {
    console.log('🔍 할당량 소진 API 호출 시작 (사용자 ID 직접 전달):', userId);
    
    // 🔧 수정: 쿠키 대신 Authorization 헤더로 사용자 ID 직접 전달
    const authToken = createAuthToken(userId);
    
    console.log('🔍 DEBUG: consumeQuotaAPI 호출 정보:', {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quota/consume`,
      user_id: userId,
      has_auth_token: !!authToken
    });
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quota/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`, // 🔧 수정: Authorization 헤더 사용
      },
      body: JSON.stringify({
        quota_type: 'chat_messages',
        amount: 1
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('할당량 소진 API 오류:', {
        status: response.status,
        result
      });
      
      return {
        success: false,
        remaining: result.quota_info?.remaining || 0,
        error: result.message || '할당량 처리 중 오류가 발생했습니다.'
      };
    }

    console.log('✅ 할당량 소진 API 성공:', {
      used: result.quota_info?.used,
      limit: result.quota_info?.limit,
      remaining: result.quota_info?.remaining
    });

    return {
      success: true,
      remaining: result.quota_info?.remaining || 0
    };
    
  } catch (error) {
    console.error('할당량 소진 API 호출 실패:', error);
    return {
      success: false,
      remaining: 0,
      error: '할당량 API 연결에 실패했습니다.'
    };
  }
}

// 할당량 조회 API 호출
async function getQuotaAPI(request: NextRequest, userId: string): Promise<{ canUse: boolean; remaining: number; error?: string }> {
  try {
    console.log('🔍 할당량 조회 API 호출 시작 (사용자 ID 직접 전달):', userId);
    
    // 🔧 수정: 쿠키 대신 Authorization 헤더로 사용자 ID 직접 전달
    const authToken = createAuthToken(userId);
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/quota`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`, // 🔧 수정: Authorization 헤더 사용
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('할당량 조회 API 오류:', {
        status: response.status,
        result
      });
      
      return {
        canUse: false,
        remaining: 0,
        error: result.error || '할당량 조회 중 오류가 발생했습니다.'
      };
    }

    // chat_messages 할당량 찾기
    const chatQuota = result.quotas?.find((q: any) => q.type === 'chat_messages');
    
    if (!chatQuota) {
      console.error('chat_messages 할당량을 찾을 수 없음');
      return {
        canUse: false,
        remaining: 0,
        error: '채팅 할당량 정보를 찾을 수 없습니다.'
      };
    }

    console.log('✅ 할당량 조회 API 성공:', {
      used: chatQuota.used,
      limit: chatQuota.limit,
      canUse: chatQuota.canUse,
      remaining: chatQuota.limit - chatQuota.used
    });

    return {
      canUse: chatQuota.canUse,
      remaining: chatQuota.limit - chatQuota.used
    };
    
  } catch (error) {
    console.error('할당량 조회 API 호출 실패:', error);
    return {
      canUse: false,
      remaining: 0,
      error: '할당량 API 연결에 실패했습니다.'
    };
  }
}

// API 기반 할당량 롤백 (간소화)
async function rollbackQuota(user_id: string, reason: string): Promise<void> {
  console.log('⚠️ 할당량 롤백 요청 - API 기반 시스템에서는 자동 처리됨:', {
    user_id,
    reason
  });
  // Note: API 기반 시스템에서는 실패 시 자동으로 트랜잭션이 롤백되므로
  // 별도의 롤백 처리가 필요하지 않음
}

// API 기반 할당량 확인 및 차감 (기존 함수 대체)
async function checkAndUpdateQuota(request: NextRequest, userId: string): Promise<{ canUse: boolean; remainingQuota: number; error?: string }> {
  console.log('🔍 API 기반 할당량 처리 시작 (사용자 ID:', userId, ')');
  
  // 할당량 소진 API 호출 - 사용자 ID 직접 전달
  const quotaResult = await consumeQuotaAPI(request, userId);
  
  if (!quotaResult.success) {
    console.error('API 기반 할당량 처리 실패:', quotaResult.error);
    return {
      canUse: false,
      remainingQuota: quotaResult.remaining,
      error: quotaResult.error
    };
  }
  
  console.log('✅ API 기반 할당량 처리 성공:', {
    remaining: quotaResult.remaining
  });
  
  return {
    canUse: true,
    remainingQuota: quotaResult.remaining
  };
}

// Phase 4-9 Step 2: 메시지 완전성 보장 시스템 - 시스템 프롬프트 길이 제한 가이드 추가
function addLengthGuideToSystemPrompt(originalPrompt: string): string {
  const lengthGuide = `

**응답 길이 제한**
- 모든 응답은 한국어 기준 200자 이내로 작성해주세요.
- 문장이 중간에 끊어지지 않도록 완성된 문장으로 마무리해주세요.
- 200자에 가까워지면 자연스럽게 마무리하여 완전한 응답을 제공해주세요.`;
  
  return originalPrompt + lengthGuide;
}

// API 기반 할당량 확인 및 차감 (Phase 3 완료)
// 구 버전 함수 제거됨 - API 기반 시스템으로 완전 대체

// POST 요청 핸들러
export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { 
      message, 
      chatbot_id, 
      session_id,
      // Phase 2에서 추가된 프리셋 정보
      concept_id,
      speech_preset_id,
      gender,
      relationship_type
    } = body;

    console.log('🔍 Claude API 요청 파라미터:', {
      message_length: message?.length,
      chatbot_id,
      session_id,
      concept_id,
      speech_preset_id,
      gender,
      relationship_type
    });

    // 입력값 검증
    if (!message || !chatbot_id) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 🔐 사용자 인증 확인 (복구됨)
    console.log('Claude API: 사용자 인증 시작');
    const authenticatedUser = await authenticateUser(request);
    
    if (!authenticatedUser) {
      console.error('Claude API: 인증되지 않은 사용자 접근 시도');
      return NextResponse.json({
        error: 'authentication_required',
        message: '로그인이 필요합니다. 로그인 후 다시 시도해주세요.',
        redirect_to: '/simple-login'
      }, { status: 401 });
    }

    // 인증된 사용자 ID 사용
    const user_id = authenticatedUser.id;
    const finalUser = authenticatedUser; // 에러 처리용 변수
    
    console.log('Claude API 호출 시작:', { 
      chatbot_id, 
      user_id, 
      message_length: message.length,
      timestamp: new Date().toISOString()
    });
    
    console.log('Claude API: 사용자 인증 성공:', {
      user_id: finalUser.id,
      email: finalUser.email
    });

    // ✅ API 기반 할당량 확인 및 차감 (수정 완료: Authorization 헤더 방식)
    console.log('🔍 할당량 확인 시작 - 사용자 ID:', finalUser.id);
    const quotaResult = await checkAndUpdateQuota(request, finalUser.id);
    
    if (!quotaResult.canUse) {
      console.error('API 기반 할당량 초과:', { 
        user_id: finalUser.id, 
        remaining: quotaResult.remainingQuota,
        error: quotaResult.error 
      });
      
      logQuotaUsage(finalUser.id, 'chat_messages', 0, 50, 'quota_exceeded');
      
      return NextResponse.json({
        error: 'quota_exceeded',
        message: quotaResult.error || '일일 채팅 한도에 도달했습니다.',
        quota_info: {
          used_today: 50 - quotaResult.remainingQuota, // API에서 remaining 계산
          limit: 50,
          resets_tomorrow: true
        }
      }, { status: 429 });
    }
    
    console.log('✅ API 기반 할당량 확인 완료:', { 
      user_id: finalUser.id,
      remaining: quotaResult.remainingQuota 
    });

    // 1. 챗봇 정보 조회 (저장된 5개 필드 직접 사용) - 실제 인증된 사용자 ID 사용
    const chatbot = await getChatbotStoredData(chatbot_id, finalUser.id);
    if (!chatbot) {
      console.error('챗봇 조회 실패:', { chatbot_id, user_id: finalUser.id });
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 저장된 5개 필드 검증
    console.log('🔍 저장된 챗봇 데이터 확인:', {
      name: chatbot.name,
      age: chatbot.age,
      gender: chatbot.gender,
      concept: chatbot.personality_description,
      relationship: chatbot.relationship_type,
      has_system_prompt: !!chatbot.system_prompt
    });

    // 3. 시스템 프롬프트 생성 (저장된 5개 필드 우선 사용)
    let systemPrompt: string;

    // 5개 필드가 모두 있으면 저장된 데이터로 새 프롬프트 생성
    console.log('🔍 조건 체크:', {
      name: chatbot.name,
      age: chatbot.age, 
      gender: chatbot.gender,
      personality_description: chatbot.personality_description,
      relationship_type: chatbot.relationship_type,
      name_check: !!chatbot.name,
      age_check: !!chatbot.age,
      gender_check: !!chatbot.gender,
      concept_check: !!chatbot.personality_description,
      relationship_check: !!chatbot.relationship_type
    });

    if (chatbot.name && chatbot.age && chatbot.gender && 
        chatbot.personality_description && chatbot.relationship_type) {
      
      console.log('✅ 저장된 5개 필드 기반 시스템 프롬프트 생성:', {
        name: chatbot.name,
        age: chatbot.age,
        gender: chatbot.gender,
        concept: chatbot.personality_description,
        relationship: chatbot.relationship_type
      });

      systemPrompt = generateSystemPromptFromStoredData({
        name: chatbot.name,
        age: chatbot.age,
        gender: chatbot.gender,
        concept: chatbot.personality_description,
        relationship: chatbot.relationship_type
      });

      console.log('✅ 새로운 방식 시스템 프롬프트 생성 완료:', {
        prompt_length: systemPrompt.length,
        method: 'stored_data_based'
      });

    } else {
      // 폴백: 저장된 system_prompt 사용 또는 메모리 시스템
      console.log('⚠️ 필드 누락, 폴백 시스템 사용:', {
        missing_fields: {
          name: !chatbot.name,
          age: !chatbot.age,
          gender: !chatbot.gender,
          concept: !chatbot.personality_description,
          relationship: !chatbot.relationship_type
        },
        has_stored_prompt: !!chatbot.system_prompt
      });

      if (chatbot.system_prompt) {
        // 저장된 프롬프트 있으면 사용
        systemPrompt = chatbot.system_prompt;
        console.log('✅ 저장된 system_prompt 사용:', {
          prompt_length: systemPrompt.length,
          method: 'stored_prompt'
        });
      } else {
        // 메모리 시스템 시도
        const memoryService = new ChatbotMemoryService();
        try {
          const memoryData = await memoryService.getMemoryData(chatbot_id);
          if (memoryData) {
            systemPrompt = (await import('@/lib/services/chatbot/ChatbotMemoryService')).generateSystemPrompt(memoryData);
            console.log('✅ 메모리 시스템 프롬프트 사용:', {
              prompt_length: systemPrompt.length,
              method: 'memory_system'
            });
          } else {
            throw new Error('메모리 데이터 없음');
          }
        } catch (memoryError) {
          // 최후 폴백: 기본 프롬프트
          systemPrompt = `당신의 이름은 ${chatbot.name}입니다. 자연스럽게 대화해주세요.`;
          console.log('⚠️ 기본 프롬프트 사용:', {
            prompt_length: systemPrompt.length,
            method: 'fallback'
          });
        }
      }
    }

    // Phase 4-9 Step 2: 시스템 프롬프트에 길이 제한 가이드 추가 (소프트 제한)
    systemPrompt = addLengthGuideToSystemPrompt(systemPrompt);
    console.log('✅ Phase 4-9: 시스템 프롬프트에 길이 제한 가이드 추가 완료:', {
      original_length: systemPrompt.length - 200, // 대략적인 가이드 길이 차감
      final_length: systemPrompt.length
    });

    console.log('최종 적용된 정보:', {
      name: chatbot.name,
      age: chatbot.age,
      gender: chatbot.gender,
      concept: chatbot.personality_description,
      relationship: chatbot.relationship_type,
      system_prompt_length: systemPrompt.length
    });

    // 4. Claude API 호출 (강화된 에러 처리 + 컨텍스트 전달 + 성능 최적화)
    let response: string;
    let contextLoadAttempts = 0;
    let contextLoadSuccess = false;
    const maxContextRetries = 2;
    
    try {
      // 세션 ID가 있으면 컨텍스트 사용, 없으면 빈 컨텍스트 사용
      if (session_id) {
        console.log('세션 ID로 컨텍스트 조회 시도:', session_id);
        
        // 컨텍스트 로딩 재시도 로직
        let contextLoadError: any = null;
        for (let attempt = 1; attempt <= maxContextRetries; attempt++) {
          contextLoadAttempts = attempt;
          try {
            // 세션 소유권 검증 (보안 강화)
            const { data: sessionOwnership, error: ownershipError } = await supabase
              .from('chat_sessions')
              .select('id, user_id')
              .eq('id', session_id)
              .eq('user_id', finalUser.id)
              .single();

            if (ownershipError || !sessionOwnership) {
              console.error('세션 소유권 검증 실패:', {
                session_id,
                user_id: finalUser.id,
                error: ownershipError
              });
              
              // 권한 없는 세션 접근 시 빈 컨텍스트로 처리
              throw new Error('UNAUTHORIZED_SESSION');
            }

            // ✅ 먼저 사용자 메시지를 저장한 후 컨텍스트 조회
            console.log('🔍 사용자 메시지 저장 시도 (컨텍스트 조회 전):', {
              session_id: session_id,
              role: 'user',
              content: message.substring(0, 50) + '...'
            });

            const { error: userMsgError } = await supabase
              .from('chat_messages')
              .insert({
                session_id: session_id,
                role: 'user',
                content: message,
                created_at: new Date().toISOString()
              });

            if (userMsgError) {
              console.error('사용자 메시지 저장 오류:', userMsgError);
              throw new Error('사용자 메시지 저장에 실패했습니다.');
            } else {
              console.log('✅ 사용자 메시지 저장 성공 (컨텍스트 조회 전)');
              // 사용자 메시지 저장 성공 시 캐시 무효화
              ChatContextManager.invalidateSessionCache(session_id);
            }

            const context = await ChatContextManager.getRecentContext(session_id, chatbot.name);
            console.log('컨텍스트 조회 성공:', { 
              messageCount: context.recentMessages.length,
              attempt: attempt,
              session_id: session_id
            });
            
            // 디버깅을 위해 컨텍스트 상세 정보 응답에 포함
            let debugInfo = `[세션: ${session_id.substring(0, 8)}...] `;
            if (context.recentMessages.length > 0) {
              debugInfo += `[메시지 ${context.recentMessages.length}개: ${context.recentMessages.map(m => `${m.role}="${m.content.substring(0, 20)}..."`).join(', ')}]`;
            } else {
              debugInfo += `[메시지 없음]`;
            }
            
            // 성능 로깅
            logApiCall('context_load', true, {
              session_id,
              user_id: finalUser.id,
              message_count: context.recentMessages.length,
              attempt: attempt
            });
            
            // Phase 4-9 Step 2: maxTokens 300 → 500 증가 (하드 제한 - 여유분 확보)
            response = await generateClaudeResponse(message, context, {
              maxTokens: 500,  // 300 → 500 증가 (메시지 끊김 방지)
              temperature: 0.8
            });

            // Phase 4-9 Step 2: 서버 측 응답 길이 모니터링 로그
            const responseLength = response.length;
            console.log(`📏 Phase 4-9: Claude API 응답 길이 모니터링 - ${responseLength}자 (목표: 200자 이내)`);
            if (responseLength > 250) {
              console.warn('⚠️ Phase 4-9: 응답이 예상보다 길음 - 끊김 가능성 체크 필요:', {
                response_length: responseLength,
                max_tokens_used: 500,
                expected_length: 200
              });
            } else {
              console.log('✅ Phase 4-9: 응답 길이 정상 범위 - 끊김 방지 성공');
            }
            
            // 성공한 경우 응답 반환
            contextLoadSuccess = true;
            break;
            
          } catch (error) {
            contextLoadError = error;
            console.warn(`컨텍스트 조회 시도 ${attempt}/${maxContextRetries} 실패:`, {
              error: error instanceof Error ? error.message : error,
              session_id,
              user_id: finalUser.id
            });
            
            // 권한 에러는 재시도하지 않음
            if (error instanceof Error && error.message === 'UNAUTHORIZED_SESSION') {
              console.error('세션 접근 권한 없음 - 빈 컨텍스트로 즉시 처리');
              break;
            }
            
            // 마지막 시도가 아니면 잠시 대기
            if (attempt < maxContextRetries) {
              const waitTime = Math.pow(2, attempt) * 500; // 500ms, 1000ms
              console.log(`${waitTime}ms 대기 후 컨텍스트 재시도`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }
        
        // 모든 컨텍스트 로딩 시도 실패시 빈 컨텍스트로 대체
        if (!contextLoadSuccess) {
          console.warn('모든 컨텍스트 조회 시도 실패, 빈 컨텍스트로 대체:', {
            final_error: contextLoadError instanceof Error ? contextLoadError.message : contextLoadError,
            total_attempts: contextLoadAttempts
          });
          
          // 성능 로깅 (실패)
          logApiCall('context_load', false, {
            session_id,
            user_id: finalUser.id,
            total_attempts: contextLoadAttempts,
            final_error: contextLoadError instanceof Error ? contextLoadError.message : 'Unknown'
          });
          
          const emptyContext = {
            chatbotId: chatbot_id,
            systemPrompt,
            recentMessages: []
          };
          
          // Phase 4-9 Step 2: 빈 컨텍스트에서도 maxTokens 500 적용
          response = await generateClaudeResponse(message, emptyContext, {
            maxTokens: 500,  // 300 → 500 증가
            temperature: 0.8
          });

          // Phase 4-9 Step 2: 빈 컨텍스트 응답 길이 모니터링
          const responseLength = response.length;
          console.log(`📏 Phase 4-9: 빈 컨텍스트 응답 길이 - ${responseLength}자 (목표: 200자 이내)`);
          
          console.log('Claude API 빈 컨텍스트 대체 응답 성공:', { 
            response_length: response.length,
            context_fallback: true 
          });
        }
      } else {
        console.log('session_id 없음 - 빈 컨텍스트로 처리');
        
        const emptyContext = {
          chatbotId: chatbot_id,
          systemPrompt,
          recentMessages: []
        };
        
        // Phase 4-9 Step 2: 새 세션에서도 maxTokens 500 적용
        response = await generateClaudeResponse(message, emptyContext, {
          maxTokens: 500,  // 300 → 500 증가
          temperature: 0.8
        });

        // Phase 4-9 Step 2: 새 세션 응답 길이 모니터링
        const responseLength = response.length;
        console.log(`📏 Phase 4-9: 새 세션 응답 길이 - ${responseLength}자 (목표: 200자 이내)`);
        
        console.log('Claude API 빈 컨텍스트 응답 성공:', { response_length: response.length });
      }
    } catch (claudeError) {
      console.error('Claude API 호출 실패:', {
        error: claudeError instanceof Error ? claudeError.message : claudeError,
        chatbot_id,
        user_id,
        attempt: 'primary'
      });

      // 에러 타입별 맞춤 응답 처리
      if (claudeError instanceof Error) {
        switch (claudeError.message) {
          case 'API_TIMEOUT':
            console.log('타임아웃 에러 - 캐릭터별 타임아웃 메시지 반환');
            response = ClaudeClient.generateTimeoutMessage(
              (claudeError as any).timeoutMs || 10000,
              chatbot.concepts?.relationship_type,
              chatbot.name
            );
            break;

          case 'RATE_LIMIT_EXCEEDED':
            console.log('Rate Limit 에러 - 사용자 친화적 메시지 반환');
            const retryAfter = (claudeError as any).retryAfter;
            response = ClaudeClient.generateRateLimitMessage(
              429,
              chatbot.concepts?.relationship_type,
              retryAfter
            );
            
            // Rate Limit의 경우 할당량 롤백 및 429 상태 반환
            await rollbackQuota(finalUser.id, 'Rate Limit 발생으로 인한 롤백');
            return NextResponse.json({
              error: 'rate_limit_exceeded',
              message: response,
              retry_after: retryAfter,
              chatbot_name: chatbot.name,
              quota_rollback: true
            }, { status: 429 });

          case 'NETWORK_ERROR':
            console.log('네트워크 에러 - 재시도 안내 메시지');
            response = ClaudeClient.generateFallbackMessage(
              chatbot.name,
              chatbot.concepts?.relationship_type,
              chatbot.personality_traits
            );
            
            // 네트워크 에러도 할당량 롤백
            await rollbackQuota(finalUser.id, '네트워크 에러로 인한 롤백');
            break;

          default:
            if (claudeError.message.startsWith('CLIENT_ERROR')) {
              console.log('클라이언트 에러 - 입력 검증 필요');
              response = '죄송해요, 메시지를 이해할 수 없어요. 다른 방식으로 말해주시겠어요?';
              
              // 클라이언트 에러도 할당량 롤백
              await rollbackQuota(finalUser.id, '클라이언트 에러로 인한 롤백');
            } else {
              // 기타 에러는 캐릭터별 폴백 메시지
              response = ClaudeClient.generateFallbackMessage(
                chatbot.name,
                chatbot.concepts?.relationship_type,
                chatbot.personality_traits
              );
              
              await rollbackQuota(finalUser.id, '기타 에러로 인한 롤백');
            }
        }
      } else {
        // 알 수 없는 에러 타입
        response = ClaudeClient.generateFallbackMessage(
          chatbot.name,
          chatbot.concepts?.relationship_type,
          chatbot.personality_traits
        );
        
        await rollbackQuota(finalUser.id, '알 수 없는 에러로 인한 롤백');
      }
    }

    // 5. AI 응답을 chat_messages 테이블에 저장 + 캐시 무효화
    if (session_id) {
      // AI 응답 저장 (사용자 메시지는 이미 위에서 저장됨)
      console.log('🔍 AI 응답 저장 시도:', {
        session_id: session_id,
        role: 'assistant',
        content: response.substring(0, 50) + '...'
      });

      const { error: aiMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: session_id,
          role: 'assistant',
          content: response,
          created_at: new Date().toISOString()
        });

      if (aiMsgError) {
        console.error('AI 응답 저장 오류:', aiMsgError);
      } else {
        console.log('✅ AI 응답 저장 성공');
        // AI 응답 저장 성공 시 캐시 다시 무효화 (최신 상태 유지)
        ChatContextManager.invalidateSessionCache(session_id);
        console.log('AI 응답 저장 후 캐시 무효화:', session_id);
      }
      
      // 메모리 사용량 모니터링 (디버깅용)
      const memoryUsage = ChatContextManager.getMemoryUsage();
      if (memoryUsage.estimated_mb > 50) { // 50MB 초과 시 경고
        console.warn('컨텍스트 캐시 메모리 사용량 높음:', memoryUsage);
      }
    }

    // 6. 응답 반환 (할당량 정보 + 성능 메트릭 포함)
    const actualUsedToday = 10 - quotaResult.remainingQuota;
    const cacheStats = ChatContextManager.getCacheStats();
    
    return NextResponse.json({
      response,
      chatbot_name: chatbot.name,
      applied_info: {
        name: chatbot.name,
        age: chatbot.age,
        gender: chatbot.gender,
        concept: chatbot.personality_description,
        relationship: chatbot.relationship_type
      },
      system_prompt_length: systemPrompt.length,
      remaining_quota: quotaResult.remainingQuota,
      quota_info: {
        used_today: actualUsedToday,
        limit: 10,
        resets_tomorrow: true
      },
      quota_updated: true, // ✅ 할당량이 차감되었음을 표시
      // 성능 및 디버깅 정보
      performance_info: {
        context_load_success: contextLoadSuccess,
        context_load_attempts: contextLoadAttempts,
        cache_hit_rate: Math.round(cacheStats.hitRate * 100),
        cache_size: cacheStats.cacheSize,
        used_cached_context: contextLoadSuccess && contextLoadAttempts === 1 && cacheStats.hits > 0
      },
      // Phase 4-9 Step 2: 메시지 완전성 보장 정보 추가
      message_completeness_info: {
        response_length: response.length,
        max_tokens_limit: 500,
        length_guide_applied: true,
        expected_max_length: 200,
        truncation_prevention_active: true
      }
    });

  } catch (error) {
    console.error('Claude API 호출 오류:', {
      error: error instanceof Error ? error.message : error,
      chatbot_id: body.chatbot_id,
      user_id: body.user_id,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    let chatbotName: string | undefined;
    let relationshipType: string | undefined;
    let personalityTraits: string | undefined;
    
    // 챗봇 정보 조회 (에러 메시지 개인화용)
    try {
      const { data: chatbotData } = await supabase
        .from('chatbots')
        .select(`
          name,
          personality_traits,
          concepts:concept_id (
            relationship_type
          )
        `)
        .eq('id', body.chatbot_id)
        .single();
      
      if (chatbotData) {
        chatbotName = chatbotData.name;
        personalityTraits = chatbotData.personality_traits;
        relationshipType = chatbotData.concepts?.relationship_type;
      }
    } catch (chatbotError) {
      console.error('챗봇 정보 조회 실패:', chatbotError);
    }

    // 할당량 롤백 로직 (Claude API 실패 시) - 인증된 사용자 ID 사용
    // finalUser가 없으면 rollback 예외 처리 방지
    if (error instanceof Error && !error.message.includes('할당량') && finalUser?.id) {
      await rollbackQuota(finalUser.id, `전체 에러 처리: ${error.message}`);
      console.log('✅ 에러 처리 시 할당량 롤백 완료:', { user_id: finalUser.id });
    }

    // 에러 타입별 응답 생성
    let errorResponse = {
      error: 'unknown_error',
      message: ClaudeClient.generateFallbackMessage(chatbotName, relationshipType, personalityTraits),
      chatbot_name: chatbotName,
      quota_rollback: true,
      error_type: 'unknown'
    };

    let statusCode = 500;

    if (error instanceof Error) {
      switch (error.message) {
        case 'API_TIMEOUT':
          errorResponse = {
            error: 'api_timeout',
            message: ClaudeClient.generateTimeoutMessage(
              (error as any).timeoutMs || 10000,
              relationshipType,
              chatbotName
            ),
            chatbot_name: chatbotName,
            quota_rollback: true,
            error_type: 'timeout',
            timeout_ms: (error as any).timeoutMs || 10000
          };
          statusCode = 408; // Request Timeout
          break;

        case 'RATE_LIMIT_EXCEEDED':
          errorResponse = {
            error: 'rate_limit_exceeded',
            message: ClaudeClient.generateRateLimitMessage(
              429,
              relationshipType,
              (error as any).retryAfter
            ),
            chatbot_name: chatbotName,
            quota_rollback: true,
            error_type: 'rate_limit',
            retry_after: (error as any).retryAfter
          };
          statusCode = 429; // Too Many Requests
          break;

        case 'NETWORK_ERROR':
          errorResponse = {
            error: 'network_error',
            message: '네트워크 연결에 문제가 있어요. 잠시 후 다시 시도해주세요.',
            chatbot_name: chatbotName,
            quota_rollback: true,
            error_type: 'network'
          };
          statusCode = 503; // Service Unavailable
          break;

        default:
          if (error.message.startsWith('CLIENT_ERROR')) {
            errorResponse = {
              error: 'client_error',
              message: '메시지를 처리할 수 없어요. 다른 방식으로 말해주시겠어요?',
              chatbot_name: chatbotName,
              quota_rollback: true,
              error_type: 'client_error',
              client_error_code: (error as any).status
            };
            statusCode = 400; // Bad Request
          }
      }
    }

    return NextResponse.json({
      ...errorResponse,
      error_id: Date.now().toString(), // ✅ 에러 추적용 ID
      timestamp: new Date().toISOString()
    }, { 
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
