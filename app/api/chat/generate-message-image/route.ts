/**
 * 메시지 기반 이미지 생성 API
 * Task 002: Expand Chat Image Generation API (Updated for Task 005 Integration)
 * 
 * AI 메시지 내용을 분석하여 자동으로 이미지를 생성하는 API
 * QuotaApiClient 기반 쿼터 시스템 사용 (프로필 이미지와 통일)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedServerClient } from '@/lib/supabase-server';
import { callComfyUIServer } from '@/lib/comfyui/client';
import { getMessageToPromptService } from '@/lib/services/message-to-prompt';
import { QuotaApiClient } from '@/lib/quota/quotaApiClient';
import { QuotaType } from '@/types/quota';
import type { MessageContext, ConversionOptions } from '@/lib/services/message-to-prompt/types';

interface MessageImageGenerationRequest {
  message_id: string;          // 이미지를 생성할 메시지 ID
  message_content?: string;    // 임시 메시지의 경우 메시지 내용 직접 전달
  quality_level?: 'draft' | 'standard' | 'high' | 'premium';
  style_override?: string;     // 사용자 지정 스타일
  template_id?: string;        // 프롬프트 템플릿 ID
}

interface MessageImageGenerationResponse {
  success: boolean;
  image_url?: string;
  prompt_info?: {
    positive_prompt: string;
    negative_prompt: string;
    quality_score: number;
    template_used: string;
    keywords_extracted: any;
  };
  processing_time?: number;
  error?: string;
  generation_job_id?: string;
  quota_info?: {
    remaining: number;
    total_limit: number;
    used_today: number;
    reset_time: Date | null;
  };
}

export async function POST(request: NextRequest) {
  console.log('=== 메시지 기반 이미지 생성 API 시작 (API 클라이언트 쿼터) ===');
  const startTime = Date.now();

  try {
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { 
      message_id: rawMessageId, 
      message_content,
      quality_level = 'standard',
      style_override,
      template_id
    }: MessageImageGenerationRequest = body;

    // 1.1. 메시지 ID 정규화 및 검증
    let message_id = rawMessageId;
    
    // split 접미사가 있는 경우 제거 (문장 분할 기능 대응)
    if (rawMessageId?.includes('-split-')) {
      const parts = rawMessageId.split('-split-');
      message_id = parts[0];
      console.log('🔍 Split 접미사 제거:', {
        original: rawMessageId,
        extracted: message_id,
        split_parts: parts.length
      });
    }

    console.log('📋 요청 데이터:', {
      raw_message_id: rawMessageId,
      normalized_message_id: message_id,
      message_content: message_content ? message_content.substring(0, 50) + '...' : undefined,
      quality_level,
      style_override: style_override ? style_override.substring(0, 30) + '...' : undefined,
      template_id
    });

    // 2. 기본 입력 검증
    if (!rawMessageId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'message_id가 필요합니다.' 
        }, 
        { status: 400 }
      );
    }

    if (!message_id || typeof message_id !== 'string' || message_id.trim() === '') {
      console.error('❌ 메시지 ID 기본 검증 실패:', {
        raw_message_id: rawMessageId,
        normalized_message_id: message_id,
        message_id_type: typeof message_id,
        message_id_length: message_id?.length,
        is_empty_after_trim: message_id?.trim() === ''
      });
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 메시지 ID입니다.' 
        }, 
        { status: 400 }
      );
    }

    // 2.1. 메시지 ID 형식 검증 (UUID 또는 임시 ID 허용)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tempIdRegex = /^ai-\d+-\d*$/; // 임시 ID 패턴 (ai-timestamp-index)
    
    const trimmedMessageId = message_id.trim();
    const isValidUUID = uuidRegex.test(trimmedMessageId);
    const isTempId = tempIdRegex.test(trimmedMessageId);
    
    console.log('🔍 메시지 ID 형식 검증:', {
      message_id: message_id,
      message_id_trimmed: trimmedMessageId,
      message_id_length: message_id.length,
      trimmed_length: trimmedMessageId.length,
      uuid_test_result: isValidUUID,
      temp_id_test_result: isTempId,
      expected_formats: 'UUID or ai-timestamp-index pattern'
    });
    
    if (!isValidUUID && !isTempId) {
      console.error('❌ 메시지 ID 형식 검증 실패:', { 
        raw_message_id: rawMessageId,
        normalized_message_id: message_id,
        trimmed_message_id: trimmedMessageId,
        char_codes: Array.from(trimmedMessageId).map(c => c.charCodeAt(0)),
        reason: 'UUID나 임시 ID 패턴과 일치하지 않음',
        isValidUUID,
        isTempId
      });
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 메시지 ID 형식입니다. (UUID 또는 임시 ID 형식이어야 합니다)' 
        }, 
        { status: 400 }
      );
    }
    
    // 임시 ID의 경우 추가 로깅
    if (isTempId) {
      console.log('🔄 서버: 임시 메시지 ID로 이미지 생성 시도:', {
        raw_message_id: rawMessageId,
        normalized_message_id: message_id,
        trimmed_message_id: trimmedMessageId
      });
    }

    // 정규화된 메시지 ID 사용
    message_id = message_id.trim();

    // 3. 사용자 인증 확인
    const { client: supabase } = await createAuthenticatedServerClient(request);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.error('인증되지 않은 요청');
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.' 
        }, 
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log('인증된 사용자:', userId);

    // 4. 메시지 조회 및 권한 확인
    console.log('🔍 메시지 조회 시작:', {
      message_id,
      userId,
      userEmail: session.user.email,
      is_temp_id: isTempId
    });

    let message = null;
    let messageError = null;

    if (isTempId) {
      // 임시 메시지의 경우 message_content가 필요
      if (!message_content || typeof message_content !== 'string' || message_content.trim() === '') {
        console.error('❌ 임시 메시지 ID이지만 message_content가 없음:', {
          message_id,
          message_content: message_content ? 'provided' : 'missing',
          message_content_length: message_content?.length || 0
        });
        return NextResponse.json(
          { 
            success: false,
            error: '임시 메시지의 경우 메시지 내용이 필요합니다.' 
          }, 
          { status: 400 }
        );
      }

      console.log('🔄 임시 메시지 처리:', {
        message_id,
        content_preview: message_content.substring(0, 50) + '...',
        content_length: message_content.length
      });

      // 임시 메시지의 경우 현재 세션의 챗봇 정보를 조회해야 함
      console.log('🔄 임시 메시지용 챗봇 정보 조회 중...');
      
      // 현재 사용자의 활성 세션을 통해 챗봇 정보 조회
      const { data: sessionData, error: sessionError } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          user_id,
          chatbot_id,
          chatbots (
            id,
            name,
            age,
            gender,
            relationship_type,
            personality_description,
            user_uploaded_image_url,
            concept_id,
            speech_preset_id,
            concepts (
              name,
              description,
              relationship_type
            ),
            speech_presets (
              name,
              description
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !sessionData) {
        console.error('❌ 임시 메시지용 세션 조회 실패:', sessionError);
        return NextResponse.json(
          { 
            success: false,
            error: '현재 세션 정보를 찾을 수 없습니다.' 
          }, 
          { status: 404 }
        );
      }

      console.log('✅ 임시 메시지용 챗봇 정보 조회 성공:', {
        session_id: sessionData.id,
        chatbot_id: sessionData.chatbot_id,
        chatbot_name: sessionData.chatbots?.name,
        has_user_uploaded_image: !!sessionData.chatbots?.user_uploaded_image_url
      });

      // 임시 메시지용 가짜 메시지 객체 생성 (챗봇 정보 포함)
      message = {
        id: message_id,
        content: message_content.trim(),
        role: 'assistant',
        session_id: sessionData.id,
        metadata: null,
        created_at: new Date().toISOString(),
        chat_sessions: {
          id: sessionData.id,
          user_id: sessionData.user_id,
          chatbot_id: sessionData.chatbot_id,
          chatbots: sessionData.chatbots
        }
      };
    } else {
      // 실제 데이터베이스 조회 (기존 로직)
      const { data: dbMessage, error: dbError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          role,
          session_id,
          metadata,
          created_at,
          chat_sessions!inner (
            id,
            user_id,
            chatbot_id,
            chatbots (
              id,
              name,
              age,
              gender,
              relationship_type,
              personality_description,
              user_uploaded_image_url,
              concept_id,
              speech_preset_id,
              concepts (
                name,
                description,
                relationship_type
              ),
              speech_presets (
                name,
                description
              )
            )
          )
        `)
        .eq('id', message_id)
        .single();
      
      message = dbMessage;
      messageError = dbError;
    }

    console.log('📋 메시지 조회 결과:', {
      message: !!message,
      messageError: messageError?.message || 'none',
      messageId: message?.id,
      sessionUserId: message?.chat_sessions?.user_id,
      currentUserId: userId,
      is_temp_message: isTempId
    });

    if (messageError || !message) {
      console.error('메시지 조회 실패:', messageError);
      return NextResponse.json(
        { 
          success: false,
          error: '메시지를 찾을 수 없습니다.' 
        }, 
        { status: 404 }
      );
    }

    // 권한 확인 (임시 메시지는 건너뛰기)
    if (!isTempId && message.chat_sessions?.user_id !== userId) {
      console.error('메시지 접근 권한 없음:', { message_id, userId, owner: message.chat_sessions.user_id });
      return NextResponse.json(
        { 
          success: false,
          error: '해당 메시지에 접근할 권한이 없습니다.' 
        }, 
        { status: 403 }
      );
    }

    // AI 메시지만 이미지 생성 가능
    if (message.role !== 'assistant') {
      return NextResponse.json(
        { 
          success: false,
          error: 'AI 메시지에 대해서만 이미지를 생성할 수 있습니다.' 
        }, 
        { status: 400 }
      );
    }

    // 이미 이미지가 있는지 확인
    if (message.metadata?.images && message.metadata.images.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: '이미 이미지가 생성된 메시지입니다.' 
        }, 
        { status: 400 }
      );
    }

    console.log('메시지 검증 완료:', {
      content_preview: message.content.substring(0, 50) + '...',
      session_id: message.session_id,
      chatbot_name: message.chat_sessions?.chatbots?.name || '임시 메시지',
      is_temp_message: isTempId
    });

    // 5. ✅ API 클라이언트를 사용한 쿼터 확인 및 소비 (프로필 이미지와 통일)
    console.log('🔍 API 클라이언트로 채팅 이미지 생성 쿼터 처리 중...');
    
    try {
      // 5.1 쿼터 확인
      const quotaCheck = await QuotaApiClient.check(request, QuotaType.CHAT_IMAGE_GENERATION);
      
      if (!quotaCheck.canUse) {
        const chatImageQuota = quotaCheck.quotas?.find(q => q.type === QuotaType.CHAT_IMAGE_GENERATION);
        console.error('채팅 이미지 생성 쿼터 부족:', {
          remaining: quotaCheck.remaining,
          used: chatImageQuota?.used,
          limit: chatImageQuota?.limit
        });
        
        return NextResponse.json(
          { 
            success: false,
            error: '채팅 이미지 생성 할당량이 부족합니다.',
            quota_info: {
              remaining: quotaCheck.remaining,
              total_limit: chatImageQuota?.limit || 5,
              used_today: chatImageQuota?.used || 0,
              reset_time: chatImageQuota?.nextResetAt ? new Date(chatImageQuota.nextResetAt) : null
            }
          }, 
          { status: 429 }
        );
      }

      console.log('✅ 쿼터 확인 완료:', {
        remaining: quotaCheck.remaining,
        can_use: quotaCheck.canUse
      });

      // 5.2 쿼터 소비 (이미지 생성 시작 시점)
      console.log('🔍 쿼터 소비 중...');
      const quotaResult = await QuotaApiClient.consume(
        request,
        QuotaType.CHAT_IMAGE_GENERATION,
        1
      );
      
      if (!quotaResult.success) {
        console.error('쿼터 소비 실패:', quotaResult.error);
        return NextResponse.json(
          { 
            success: false,
            error: quotaResult.error || '쿼터 처리 중 오류가 발생했습니다.',
            quota_info: {
              remaining: quotaResult.remaining,
              total_limit: quotaResult.quota_info?.limit || 5,
              used_today: quotaResult.quota_info?.used || 0,
              reset_time: null
            }
          }, 
          { status: 429 }
        );
      }

      console.log('✅ 쿼터 소비 완료:', {
        remaining: quotaResult.remaining,
        quota_info: quotaResult.quota_info
      });

    } catch (quotaError) {
      console.error('🚨 쿼터 API 클라이언트 오류:', quotaError);
      return NextResponse.json(
        { 
          success: false,
          error: '쿼터 시스템 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        }, 
        { status: 500 }
      );
    }

    // 6. 이전 메시지 컨텍스트 조회 (최근 5개) - 임시 메시지는 건너뛰기
    let previousMessages = null;
    if (!isTempId && message.session_id) {
      const { data } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('session_id', message.session_id)
        .lt('created_at', message.created_at)
        .order('created_at', { ascending: false })
        .limit(5);
      
      previousMessages = data;
      console.log('🔍 이전 메시지 컨텍스트 조회:', {
        found_messages: previousMessages?.length || 0,
        session_id: message.session_id
      });
    } else {
      console.log('🔄 임시 메시지 - 이전 메시지 컨텍스트 조회 건너뜀');
    }

    // 7. 메시지 컨텍스트 구성 - 캐릭터 정보 추가
    const chatbot = message.chat_sessions?.chatbots;
    
    const messageContext: MessageContext = {
      message_id: message_id,
      session_id: message.session_id || 'temp-session', // 임시 메시지용 기본값
      content: message.content, // ✅ 수정: message_content → content
      message_content: message.content, // ✅ 호환성을 위해 둘 다 제공
      gender: chatbot?.gender as 'male' | 'female' || 'female', // ✅ 추가: gender 필드
      chat_history: previousMessages?.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      })) || [], // ✅ 추가: chat_history 필드
      previous_messages: previousMessages?.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.created_at
      })) || [],
      // ✅ 캐릭터 정보 추가 (통합된 user_preferences)
      user_preferences: {
        name: chatbot?.name || '캐릭터',
        age: chatbot?.age || 25,
        gender: chatbot?.gender || 'female',
        relationship: chatbot?.relationship_type || 'friend',
        situation: chatbot?.personality_description,
        personality: chatbot?.personality_description || '친근한 AI'
      },
      chatbot_info: {
        personality: chatbot?.personality_description || '친근한 AI',
        relationship_type: chatbot?.concepts?.relationship_type || 'friend',
        visual_characteristics: chatbot?.concepts?.description || '일반적인 상황'
      }
    };

    // 8. 변환 옵션 설정
    const conversionOptions: ConversionOptions = {
      quality_level,
      style_override,
      template_id,
      include_context: true,
      max_prompt_length: 1500,
      fallback_on_error: true
    };

    // 프롬프트 생성 및 변환
    const messageToPromptService = getMessageToPromptService();
    const conversionResult = await messageToPromptService.convertMessageToPrompt(messageContext, conversionOptions);
    
    if (!conversionResult.success || !conversionResult.prompt) {
      console.error('❌ 프롬프트 변환 실패:', conversionResult.error);
      return NextResponse.json(
        { 
          success: false, 
          error: '프롬프트 생성에 실패했습니다: ' + (conversionResult.error?.message || '알 수 없는 오류') 
        },
        { status: 400 }
      );
    }

    const generatedPrompt = conversionResult.prompt;

    console.log('프롬프트 변환 완료:', {
      positive_prompt: generatedPrompt.positive_prompt,
      negative_prompt: generatedPrompt.negative_prompt,
      positive_length: generatedPrompt.positive_prompt.length,
      negative_length: generatedPrompt.negative_prompt.length,
      quality_score: generatedPrompt.quality_score,
      template_used: generatedPrompt.template_used,
      conversion_time: conversionResult.performance?.total_time_ms || 0
    });
    
    // 9-1. 사용자 업로드 이미지 조회 및 검증 (이미 정의된 chatbot 변수 사용)
    const userUploadedImageUrl = chatbot?.user_uploaded_image_url;
    
    console.log('🔍 사용자 업로드 이미지 확인 상세:', {
      message_id: message_id,
      session_id: message.session_id,
      has_chat_sessions: !!message.chat_sessions,
      has_chatbots: !!message.chat_sessions?.chatbots,
      chatbot_id: chatbot?.id,
      chatbot_name: chatbot?.name,
      chatbot_gender: chatbot?.gender,
      has_user_uploaded_image_url: !!userUploadedImageUrl,
      user_uploaded_image_url_type: typeof userUploadedImageUrl,
      user_uploaded_image_url_value: userUploadedImageUrl || 'NULL',
      image_url_preview: userUploadedImageUrl ? userUploadedImageUrl.substring(0, 50) + '...' : 'null',
      full_chatbot_object_keys: chatbot ? Object.keys(chatbot) : 'N/A'
    });
    
    // 사용자 이미지 필수 검증
    if (!userUploadedImageUrl) {
      console.error('❌ 사용자 업로드 이미지 없음:', {
        chatbot_id: message.chat_sessions?.chatbots?.id,
        message_id: message_id,
        session_id: message.session_id
      });
      
      return NextResponse.json({
        success: false,
        error: '해당 챗봇의 사용자 업로드 이미지가 없습니다.',
        error_code: 'NO_USER_UPLOADED_IMAGE',
        recommended_action: '챗봇 프로필을 다시 생성해주세요.',
        chatbot_info: {
          name: message.chat_sessions?.chatbots?.name,
          id: message.chat_sessions?.chatbots?.id
        }
      }, { status: 400 });
    }
    
    // 사용자 이미지 URL 형식 검증
    if (!userUploadedImageUrl.includes('/user-uploads/')) {
      console.error('❌ 잘못된 사용자 이미지 URL 형식:', {
        url: userUploadedImageUrl.substring(0, 50) + '...',
        expected_pattern: '/user-uploads/'
      });
      
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 사용자 이미지 URL입니다.',
        error_code: 'INVALID_USER_IMAGE_URL',
        recommended_action: '챗봇 프로필을 다시 생성해주세요.'
      }, { status: 400 });
    }
    
    // 9-2. 사용자 이미지 접근성 검증
    console.log('🔍 사용자 이미지 접근성 검증 중...');
    try {
      const response = await fetch(userUploadedImageUrl, { 
        method: 'HEAD',
        timeout: 10000  // 10초 타임아웃
      });
      
      if (!response.ok) {
        console.error('❌ 사용자 이미지 접근 불가:', {
          url: userUploadedImageUrl.substring(0, 50) + '...',
          status: response.status,
          statusText: response.statusText
        });
        
        return NextResponse.json({
          success: false,
          error: '사용자 업로드 이미지에 접근할 수 없습니다.',
          error_code: 'USER_IMAGE_INACCESSIBLE',
          recommended_action: '챗봇 프로필을 다시 생성하거나 잠시 후 다시 시도해주세요.',
          support_info: '지속적인 문제 발생 시 고객 지원팀에 문의해주세요.'
        }, { status: 400 });
      }
      
      console.log('✅ 사용자 이미지 접근 가능');
      
    } catch (error) {
      console.error('❌ 사용자 이미지 접근성 확인 실패:', error);
      
      return NextResponse.json({
        success: false,
        error: '사용자 업로드 이미지 접근성 확인에 실패했습니다.',
        error_code: 'USER_IMAGE_VALIDATION_FAILED',
        recommended_action: '잠시 후 다시 시도하거나 챗봇 프로필을 다시 생성해주세요.'
      }, { status: 400 });
    }
    
    console.log('✅ 사용자 이미지 검증 완료');
    
    // 10. ComfyUI 서버에 이미지 생성 요청 (사용자 이미지 포함)
    console.log('🚀 ComfyUI 서버에 이미지 생성 요청 (사용자 이미지 포함):', {
      user_image_url: userUploadedImageUrl.substring(0, 50) + '...',
      preset_id: 'message_based',
      prompt_length: generatedPrompt.positive_prompt.length,
      chatbot_name: message.chat_sessions?.chatbots?.name
    });
    const comfyUIResponse = await callComfyUIServer(
      userUploadedImageUrl, // ✅ 변경: 실제 사용자 업로드 이미지 URL 전달
      'message_based', // 메시지 기반 생성 전용 프리셋
      userId,
      {
        chatbotName: message.chat_sessions?.chatbots?.name || 'AI Assistant',
        customPrompt: generatedPrompt.positive_prompt,
        negativePrompt: generatedPrompt.negative_prompt,
        timeout: 50000, // 50초 (Vercel 60초 제한 내)
        retries: 1,
        metadata: {
          message_id,
          session_id: message.session_id,
          template_used: generatedPrompt.template_used,
          quality_score: generatedPrompt.quality_score,
          user_image_source: 'user_uploaded'  // ✅ 추가: 이미지 소스 표시
        }
      }
    );

    if (!comfyUIResponse.success || !comfyUIResponse.chat_image_url) {
      console.error('ComfyUI 이미지 생성 실패:', comfyUIResponse.error);
      
      // 이미지 생성 실패 시에도 프롬프트 정보는 저장
      const failedMetadata = {
        ...message.metadata,
        failed_image_attempts: [
          ...(message.metadata?.failed_image_attempts || []),
          {
            prompt: {
              positive: generatedPrompt.positive_prompt,
              negative: generatedPrompt.negative_prompt,
              template_used: generatedPrompt.template_used,
              quality_score: generatedPrompt.quality_score,
              keywords: generatedPrompt.source_keywords
            },
            user_image_info: {
              source_url: userUploadedImageUrl,
              chatbot_id: message.chat_sessions?.chatbots?.id,
              chatbot_name: message.chat_sessions?.chatbots?.name
            },
            failed_at: new Date().toISOString(),
            error: comfyUIResponse.error || '이미지 생성 실패',
            processing_time: conversionResult.processing_time_ms || 0,
            quota_consumed: true
          }
        ]
      };

      // 실패한 시도 기록 저장
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ 
          metadata: failedMetadata
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('실패 메타데이터 업데이트 실패:', updateError);
      } else {
        console.log('실패한 이미지 생성 시도 기록 저장 완료');
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: comfyUIResponse.error || '이미지 생성에 실패했습니다.',
          prompt_info: {
            positive_prompt: generatedPrompt.positive_prompt,
            negative_prompt: generatedPrompt.negative_prompt,
            quality_score: generatedPrompt.quality_score,
            template_used: generatedPrompt.template_used,
            keywords_extracted: generatedPrompt.source_keywords
          }
        }, 
        { status: 500 }
      );
    }

    const generatedImageUrl = comfyUIResponse.chat_image_url;
    console.log('이미지 생성 완료:', generatedImageUrl.substring(0, 50) + '...');

    // 11. 메시지 메타데이터 업데이트
    const updatedMetadata = {
      ...message.metadata,
      images: [{
        url: generatedImageUrl,
        prompt: {
          positive: generatedPrompt.positive_prompt,
          negative: generatedPrompt.negative_prompt,
          template_used: generatedPrompt.template_used,
          quality_score: generatedPrompt.quality_score,
          keywords: generatedPrompt.source_keywords
        },
        user_image_info: {  // ✅ 추가: 사용자 이미지 정보
          source_url: userUploadedImageUrl,
          chatbot_id: message.chat_sessions?.chatbots?.id,
          chatbot_name: message.chat_sessions?.chatbots?.name
        },
        generated_at: new Date().toISOString(),
        generation_job_id: comfyUIResponse.generation_job_id,
        processing_time: conversionResult.processing_time_ms || 0,
        quota_consumed: true // 쿼터 소비 기록
      }]
    };

    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({ 
        metadata: updatedMetadata
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('메시지 메타데이터 업데이트 실패:', updateError);
      // 이미지는 생성되었으므로 경고만 로그
    } else {
      console.log('메시지 메타데이터 업데이트 완료');
    }

    // 12. 최종 쿼터 상태 조회 (응답에 포함하기 위해)
    const finalQuotaCheck = await QuotaApiClient.check(request, QuotaType.CHAT_IMAGE_GENERATION);
    const finalChatImageQuota = finalQuotaCheck.quotas?.find(q => q.type === QuotaType.CHAT_IMAGE_GENERATION);

    // 13. 성공 응답
    const totalProcessingTime = Date.now() - startTime;
    console.log(`=== 메시지 기반 이미지 생성 완료 (${totalProcessingTime}ms) ===`);

    const response: MessageImageGenerationResponse = {
      success: true,
      image_url: generatedImageUrl,
      prompt_info: {
        positive_prompt: generatedPrompt.positive_prompt,
        negative_prompt: generatedPrompt.negative_prompt,
        quality_score: generatedPrompt.quality_score,
        template_used: generatedPrompt.template_used,
        keywords_extracted: generatedPrompt.source_keywords
      },
      processing_time: totalProcessingTime,
      generation_job_id: comfyUIResponse.generation_job_id,
      quota_info: {
        remaining: finalQuotaCheck.remaining,
        total_limit: finalChatImageQuota?.limit || 5,
        used_today: finalChatImageQuota?.used || 0,
        reset_time: finalChatImageQuota?.nextResetAt ? new Date(finalChatImageQuota.nextResetAt) : null
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('메시지 기반 이미지 생성 API 예외 발생:', error);
    
    let errorMessage = '서버 오류가 발생했습니다.';
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = '이미지 생성 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('RATE_LIMIT')) {
        errorMessage = 'AI 서비스가 일시적으로 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message.includes('fetch')) {
        errorMessage = '외부 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        processing_time: totalTime
      }, 
      { status: 500 }
    );
  }
}

// GET 요청: 메시지 이미지 생성 가능 여부 확인 (API 클라이언트 쿼터 시스템 사용)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawMessageId = searchParams.get('message_id');

    if (!rawMessageId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'message_id 파라미터가 필요합니다.' 
        }, 
        { status: 400 }
      );
    }

    // 메시지 ID 정규화 (split 접미사 제거)
    let messageId = rawMessageId;
    
    if (rawMessageId.includes('-split-')) {
      const parts = rawMessageId.split('-split-');
      messageId = parts[0];
      console.log('🔍 GET: Split 접미사 제거:', {
        original: rawMessageId,
        extracted: messageId
      });
    }

    // 기본 검증
    if (!messageId || typeof messageId !== 'string' || messageId.trim() === '') {
      console.error('❌ GET: 메시지 ID 기본 검증 실패:', {
        raw_message_id: rawMessageId,
        normalized_message_id: messageId
      });
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 메시지 ID입니다.' 
        }, 
        { status: 400 }
      );
    }

    // 메시지 ID 형식 검증 (UUID 또는 임시 ID 허용)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const tempIdRegex = /^ai-\d+-\d*$/; // 임시 ID 패턴 (ai-timestamp-index)
    
    messageId = messageId.trim();
    const isValidUUID = uuidRegex.test(messageId);
    const isTempId = tempIdRegex.test(messageId);
    
    console.log('🔍 GET: 메시지 ID 형식 검증:', {
      message_id: messageId,
      uuid_test_result: isValidUUID,
      temp_id_test_result: isTempId,
      expected_formats: 'UUID or ai-timestamp-index pattern'
    });
    
    if (!isValidUUID && !isTempId) {
      console.error('❌ GET: 메시지 ID 형식 검증 실패:', { 
        raw: rawMessageId, 
        normalized: messageId,
        trimmed: messageId.trim(),
        length: messageId.length,
        isValidUUID,
        isTempId
      });
      return NextResponse.json(
        { 
          success: false,
          error: '유효하지 않은 메시지 ID 형식입니다. (UUID 또는 임시 ID 형식이어야 합니다)' 
        }, 
        { status: 400 }
      );
    }
    
    // 임시 ID의 경우 추가 로깅
    if (isTempId) {
      console.log('🔄 GET: 임시 메시지 ID로 상태 확인 요청:', {
        raw_message_id: rawMessageId,
        normalized_message_id: messageId
      });
    }

    const { client: supabase } = await createAuthenticatedServerClient(request);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.' 
        }, 
        { status: 401 }
      );
    }

    // 메시지 조회
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        role,
        metadata,
        chat_sessions!inner (
          user_id
        )
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { 
          success: false,
          error: '메시지를 찾을 수 없습니다.' 
        }, 
        { status: 404 }
      );
    }

    // 권한 확인
    if (message.chat_sessions.user_id !== session.user.id) {
      return NextResponse.json(
        { 
          success: false,
          error: '해당 메시지에 접근할 권한이 없습니다.' 
        }, 
        { status: 403 }
      );
    }

    // 메시지 기본 조건 확인
    const messageCanGenerate = message.role === 'assistant' && 
                              (!message.metadata?.images || message.metadata.images.length === 0);

    // ✅ API 클라이언트로 할당량 확인
    const quotaCheck = await QuotaApiClient.check(request, QuotaType.CHAT_IMAGE_GENERATION);
    const chatImageQuota = quotaCheck.quotas?.find(q => q.type === QuotaType.CHAT_IMAGE_GENERATION);
    
    const canGenerate = messageCanGenerate && quotaCheck.canUse;
    let reason = '';
    
    if (!messageCanGenerate) {
      reason = message.role !== 'assistant' ? 'AI 메시지만 지원' : '이미 이미지 존재';
    } else if (!quotaCheck.canUse) {
      reason = '할당량 부족';
    } else {
      reason = '생성 가능';
    }

    return NextResponse.json({
      success: true,
      can_generate: canGenerate,
      reason: reason,
      quota_info: {
        remaining: quotaCheck.remaining,
        total_limit: chatImageQuota?.limit || 5,
        used_today: chatImageQuota?.used || 0,
        reset_time: chatImageQuota?.nextResetAt ? new Date(chatImageQuota.nextResetAt) : null,
        reset_in_hours: chatImageQuota?.nextResetAt ? 
          Math.ceil((new Date(chatImageQuota.nextResetAt).getTime() - Date.now()) / (1000 * 60 * 60)) : null
      },
      existing_images: message.metadata?.images || []
    });

  } catch (error) {
    console.error('메시지 이미지 생성 가능 여부 확인 오류:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '상태 확인 중 오류가 발생했습니다.' 
      }, 
      { status: 500 }
    );
  }
}
