import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { callComfyUIServer, checkComfyUIServerHealth, getSimplePresetIdLegacy, getSimplePresetId } from '@/lib/comfyui/client_simple'
import { createImageGenerationService } from '@/lib/services/imageGenerationFactory'
import { generateSystemPrompt, generateSystemPromptFromStoredData } from '@/lib/chatbotUtils'
import { convertToPublicImageUrl, validateImageUrlAccessibility, optimizeImageUrlForComfyUI } from '@/lib/utils/imageHelpers'
import { Client } from 'pg'
// 기존 직접 import 제거 - API 기반으로 변경
// import { QuotaService } from '@/lib/quota/QuotaService'
// import { QuotaRepository } from '@/lib/quota/QuotaRepository'
// import { QuotaValidator } from '@/lib/quota/QuotaValidator'
import { QuotaType } from '@/types/quota'

// 새로운 쿼터 API 클라이언트 import
import { QuotaApiClient } from '@/lib/quota/quotaApiClient'

// Task 007: 새로운 프롬프트 기반 ComfyUI 클라이언트 import
import { ComfyUIProfileClient } from '@/lib/comfyui/profile-client'
import type { UserInputData } from '@/lib/services/prompt-generation/types'

// 성능 모니터링 및 에러 로깅
interface PerformanceMetrics {
  startTime: number
  authTime?: number
  quotaCheckTime?: number
  presetMappingTime?: number
  imageValidationTime?: number
  imageGenerationTime?: number
  databaseSaveTime?: number
  totalTime?: number
}

function createMetrics(): PerformanceMetrics {
  return { startTime: Date.now() }
}

function logMetrics(metrics: PerformanceMetrics, phase: string) {
  const currentTime = Date.now()
  console.log(`[성능] ${phase}: ${currentTime - metrics.startTime}ms`)
  return currentTime
}



interface ProfileGenerationResponse {
  success: boolean
  profile_image_url?: string
  chatbot_id?: string
  generation_job_id?: string
  error?: string
  processing_time?: number
  is_mock?: boolean
  mapping_info?: {
    concept_name?: string
    speech_preset_name?: string
    mapped_preset_id?: string
    gender?: string
    relationship_type?: string
  }
  // API 기반 쿼터 정보 추가
  quota_api_used?: boolean
  remaining_quota?: number
}

async function fetchConceptAndSpeechPreset(conceptId: string, speechPresetId: string) {
  const client = new Client({
    host: 'aws-0-ap-northeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.thnboxxfxahwkawzgcjj',
    password: '3exoqpCdDIBHoO2U',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    
    // 컨셉 정보 조회 (system_prompt 포함)
    const conceptResult = await client.query(
      'SELECT id, name, description, relationship_type, system_prompt FROM concepts WHERE id = $1 AND is_active = true',
      [conceptId]
    )
    
    // 말투 프리셋 정보 조회 (system_prompt 포함)
    const speechPresetResult = await client.query(
      'SELECT id, name, description, system_prompt FROM speech_presets WHERE id = $1 AND is_active = true',
      [speechPresetId]
    )
    
    if (conceptResult.rows.length === 0 || speechPresetResult.rows.length === 0) {
      throw new Error('Concept or speech preset not found')
    }
    
    return {
      concept: conceptResult.rows[0],
      speechPreset: speechPresetResult.rows[0]
    }
    
  } finally {
    await client.end()
  }
}

export async function POST(request: NextRequest) {
  console.log('=== 🚀 프로필 이미지 생성 API 시작 (API 기반 쿼터) ===')
  console.log('현재 시간:', new Date().toISOString())
  
  // Phase 3: 프로덕션 환경 전용 디버깅 강화
  const isProduction = process.env.VERCEL_ENV === 'production'
  const environment = isProduction ? 'production' : 'development'
  
  if (isProduction) {
    console.log('🚀 Phase 3: 프로덕션 환경 전용 요청 분석:', {
      environment: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      vercelRegion: process.env.VERCEL_REGION || 'unknown',
      vercelUrl: process.env.VERCEL_URL || 'unknown',
      domain: request.headers.get('host'),
      protocol: request.headers.get('x-forwarded-proto') || 'unknown',
      realIp: request.headers.get('x-real-ip') || 'unknown',
      forwardedFor: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent')?.substring(0, 80) + '...',
      timestamp: new Date().toISOString()
    })
  }
  
  // 🔍 헤더 디버깅 (환경별 상세도 조절)
  if (isProduction) {
    console.log('🔍 Phase 3: 프로덕션 요청 헤더 상세 분석:', {
      authorizationHeader: {
        present: !!request.headers.get('authorization'),
        type: request.headers.get('authorization')?.substring(0, 6) || 'none',
        length: request.headers.get('authorization')?.length || 0,
        preview: request.headers.get('authorization') ? 
          'Bearer ' + request.headers.get('authorization')?.substring(7, 37) + '...' : '없음'
      },
      cookieHeader: {
        present: !!request.headers.get('cookie'),
        length: request.headers.get('cookie')?.length || 0,
        count: request.headers.get('cookie')?.split(';').length || 0,
        hasSupabaseAuth: request.headers.get('cookie')?.includes('sb-thnboxxfxahwkawzgcjj') || false,
        hasSecureCookies: request.headers.get('cookie')?.includes('Secure') || false
      },
      additionalHeaders: {
        contentType: request.headers.get('content-type'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        acceptLanguage: request.headers.get('accept-language'),
        acceptEncoding: request.headers.get('accept-encoding')
      }
    })
  } else {
    console.log(`🔍 Phase 3: 요청 헤더 상세 확인 [${environment}]:`, {
      authorizationHeader: request.headers.get('authorization') ? 
        'Bearer ' + request.headers.get('authorization')?.substring(7, 37) + '...' : '없음',
      cookieHeader: request.headers.get('cookie') ? '존재함' : '없음',
      contentType: request.headers.get('content-type'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    })
  }
  
  console.log(`🔧 Phase 3: 환경 정보 [${environment}]:`, {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_ENABLE_MOCK: process.env.NEXT_PUBLIC_ENABLE_MOCK,
    COMFYUI_SERVER_URL: process.env.COMFYUI_SERVER_URL?.substring(0, 30) + '...',
    ...(isProduction && {
      VERCEL_REGION: process.env.VERCEL_REGION,
      VERCEL_URL: process.env.VERCEL_URL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
  })
  
  try {
    // 1. 요청 데이터 파싱
    const body = await request.json()
    
    // ✅ 사용자 입력값 추출
    const { 
      concept_id, 
      speech_preset_id, 
      preset_id,
      chatbot_name, 
      user_uploads_url: originalUserUploadsUrl,
      // 사용자 실제 입력값들
      age,
      gender, 
      relationship,
      concept,
      relationship_type,
      personalityDescription: inputPersonalityDescription
    } = body

    console.log('사용자 입력 데이터 파싱:', {
      age,
      gender, 
      relationship,
      concept,
      concept_id,
      speech_preset_id,
      chatbot_name
    })

    // user_uploads_url을 let으로 재선언하여 재할당 가능하게 함
    let user_uploads_url = originalUserUploadsUrl



    // 2. 입력 검증 - 새로운 프롬프트 기반 방식 또는 기존 방식 지원
    const isNewFormat = concept_id && speech_preset_id
    const isLegacyFormat = preset_id
    const isPromptBasedFormat = age && gender && relationship && concept // Task 007: 프롬프트 기반 형식

    if (!isNewFormat && !isLegacyFormat && !isPromptBasedFormat) {
      console.error('필수 파라미터 누락:', { 
        concept_id, 
        speech_preset_id, 
        preset_id,
        prompt_based_params: { age, gender, relationship, concept }
      })
      return NextResponse.json(
        { 
          success: false,
          error: '필수 파라미터가 누락되었습니다. (concept_id + speech_preset_id, preset_id 또는 age + gender + relationship + concept 필요)' 
        }, 
        { status: 400 }
      )
    }

    // 입력 데이터 타입 및 형식 검증
    if (isNewFormat) {
      if (typeof concept_id !== 'string' || typeof speech_preset_id !== 'string') {
        return NextResponse.json(
          { success: false, error: 'concept_id와 speech_preset_id는 문자열이어야 합니다.' },
          { status: 400 }
        )
      }

      // UUID 형식 검증 (선택사항)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(concept_id) || !uuidRegex.test(speech_preset_id)) {
        console.warn('UUID 형식이 아닌 ID 감지:', { concept_id, speech_preset_id })
        // 경고만 로그하고 계속 진행 (UUID가 아닐 수도 있음)
      }
    }

    if (chatbot_name && (typeof chatbot_name !== 'string' || chatbot_name.length > 50)) {
      return NextResponse.json(
        { success: false, error: '챗봇 이름은 50자 이하의 문자열이어야 합니다.' },
        { status: 400 }
      )
    }

    // Mock 모드가 아닌 경우 user_uploads_url 필수
    const isMockMode = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true'
    if (!isMockMode && !user_uploads_url) {
      console.error('운영 모드에서 user_uploads_url 누락')
      return NextResponse.json(
        { 
          success: false,
          error: '운영 모드에서는 user_uploads_url이 필수입니다.' 
        }, 
        { status: 400 }
      )
    }

    // user-uploads 버킷 URL 검증 (운영 모드만)
    if (!isMockMode && user_uploads_url && !user_uploads_url.includes('/user-uploads/')) {
      console.error('유효하지 않은 user-uploads URL:', user_uploads_url)
      return NextResponse.json(
        { 
          success: false,
          error: 'user_uploads_url은 user-uploads 버킷의 이미지 URL이어야 합니다.' 
        }, 
        { status: 400 }
      )
    }

    // 3. Task 7: 통합 인증 시스템 사용 (Authorization 헤더 우선)
    const metrics = createMetrics()
    
    console.log('🔐 Task 7: 통합 인증 시스템 시작 (JWT 우선)')
    
    // Task 7에서 추가한 통합 인증 로직
    const { extractUserFromRequest } = await import('@/lib/auth-utils')
    const authResult = await extractUserFromRequest(request)
    
    if (!authResult.success || !authResult.userId) {
      console.error(`❌ Task 7: 인증 실패 [${environment}]`, {
        source: authResult.source,
        debugInfo: authResult.debugInfo
      })
      
      // Task 7: 프로덕션 환경에서 더 상세한 인증 실패 분석
      const authFailureDebug = {
        environment: process.env.VERCEL_ENV,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        task7_auth_result: {
          success: authResult.success,
          source: authResult.source,
          debugInfo: authResult.debugInfo
        },
        request_analysis: {
          hasAuthHeader: !!request.headers.get('authorization'),
          hasCookieHeader: !!request.headers.get('cookie'),
          cookieHeaderLength: request.headers.get('cookie')?.length || 0,
          origin: request.headers.get('origin'),
          referer: request.headers.get('referer'),
          userAgent: request.headers.get('user-agent')?.substring(0, 50) + '...'
        },
        ...(isProduction && {
          production_specific: {
            vercelRegion: process.env.VERCEL_REGION,
            vercelUrl: process.env.VERCEL_URL,
            forwardedProto: request.headers.get('x-forwarded-proto'),
            realIp: request.headers.get('x-real-ip'),
            cookiePatternScan: request.headers.get('cookie')?.includes('sb-') || false
          }
        })
      }
      
      if (isProduction) {
        console.error('🔍 Task 7: 프로덕션 인증 실패 상세 분석:', authFailureDebug)
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다. 로그인 후 다시 시도해주세요.',
          task7_debug: authFailureDebug
        }, 
        { status: 401 }
      )
    }

    const userId = authResult.userId!
    console.log('✅ Task 7: 통합 인증 성공:', {
      userId: userId.substring(0, 8) + '...',
      source: authResult.source,
      processingTime: Date.now() - metrics.startTime
    })

    // Service Role 클라이언트로 DB 작업 수행 (인증된 사용자 ID 사용)
    const supabase = createSupabaseServiceClient()
    
    metrics.authTime = logMetrics(metrics, 'Task 7 통합 인증 완료')

    // 4. 🔄 API 기반 쿼터 확인 및 차감
    console.log('🔄 API 기반 쿼터 처리 시작:', {
      userId: userId.substring(0, 8) + '...',
      quotaType: QuotaType.PROFILE_IMAGE_GENERATION
    })
    
    const quotaResult = await QuotaApiClient.consume(
      request,
      QuotaType.PROFILE_IMAGE_GENERATION,
      1
    )
    
    if (!quotaResult.success) {
      console.error('API 기반 쿼터 소진 실패:', {
        userId: userId.substring(0, 8) + '...',
        error: quotaResult.error,
        remaining: quotaResult.remaining
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: quotaResult.error || `프로필 이미지 생성 쿼터가 부족합니다. (남은 쿼터: ${quotaResult.remaining})` 
        }, 
        { status: 403 }
      )
    }
    
    console.log('✅ API 기반 쿼터 소진 성공:', {
      userId: userId.substring(0, 8) + '...',
      remaining: quotaResult.remaining,
      quota_info: quotaResult.quota_info
    })
    
    metrics.quotaCheckTime = logMetrics(metrics, 'API 기반 쿼터 처리 완료')
    
    // 4.5. 프리셋 ID 매핑 (레거시 대비용)
    const legacyPresetId = getSimplePresetIdLegacy(concept_id, speech_preset_id) // 간단한 프리셋 매핑 (레거시)
    
    // 5. Supabase 서비스 클라이언트 생성 (챗봇 저장용)
    const supabaseService = createSupabaseServiceClient()

    // 6. ComfyUI 서버 연결 준비 (운영 모드만) - 헬스체크 우회
    if (!isMockMode) {
      console.log('🔥 ComfyUI 서버 연결 준비 (헬스체크 우회) [수정됨 v5]')
      console.log('⚠️ 헬스체크를 건너뛰고 실제 요청 시 워밍업 수행')
    }

    // 7. 이미지 URL 접근성 확인 (운영 모드만)
    if (!isMockMode && user_uploads_url) {
      console.log('사용자 이미지 URL 접근성 확인 중...')
      const imageAccessibilityStart = Date.now()
      
      // Public URL로 변환 (필요시)
      const publicImageUrl = convertToPublicImageUrl(user_uploads_url)
      
      const isAccessible = await validateImageUrlAccessibility(publicImageUrl)
      
      if (!isAccessible) {
        console.error('이미지 URL 접근 불가:', {
          originalUrl: user_uploads_url.substring(0, 50) + '...',
          publicUrl: publicImageUrl.substring(0, 50) + '...'
        })
        
        return NextResponse.json(
          { 
            success: false,
            error: '업로드된 이미지에 접근할 수 없습니다. 이미지가 올바르게 업로드되었는지 확인해주세요.' 
          }, 
          { status: 400 }
        )
      }
      
      metrics.imageValidationTime = logMetrics(metrics, `이미지 접근성 확인 완료 (${Date.now() - imageAccessibilityStart}ms)`)
      console.log('이미지 URL 접근 가능 확인')
      
      // 접근 가능한 Public URL 사용 (이제 재할당 가능)
      user_uploads_url = publicImageUrl
    }

    // 8. Task 007: 새로운 프롬프트 기반 이미지 생성 시스템 사용
    console.log(`${isMockMode ? 'Mock' : 'ComfyUI'} 서비스에 이미지 생성 요청 중...`)
    
    const imageGenerationStart = Date.now()
    let imageResult: any // 스코프 밖으로 이동
    let mappingInfo: any = {}
    let positivePrompt: string | null = null // 프롬프트를 상위 스코프로 이동
    let negativePrompt: string | null = null // 프롬프트를 상위 스코프로 이동
    
    try {
      // Mock 모드 또는 운영 모드에 따라 처리

      if (isMockMode) {
        // Mock 모드: 기존 imageService 사용
        const imageService = createImageGenerationService()
        const effectivePresetId = isNewFormat ? '1' : preset_id!
        
        imageResult = await imageService.generateProfile({
          user_image_url: user_uploads_url || 'mock://default.jpg',
          preset_id: effectivePresetId,
          chatbot_name: chatbot_name || '나의 AI 캐릭터',
          user_id: userId
        })
        
        mappingInfo = {
          mapped_preset_id: effectivePresetId,
          is_mock: true,
          gender: imageResult.style_info?.gender || 'female',
          relationship_type: imageResult.style_info?.relationship || 'friend'
        }
        
      } else {
        // 운영 모드: Task 007 - 새로운 프롬프트 기반 ComfyUI 클라이언트 사용
        if (isNewFormat) {
          // Task 007: 새로운 방식 - 프롬프트 기반 이미지 생성
          console.log('Task 007: 새로운 프롬프트 기반 방식 시작 (concept_id + speech_preset_id)')
          const mappingStart = Date.now()
          
          // ✅ 사용자 입력 데이터 구성 (실제 입력값 사용)
          const userData: UserInputData = {
            age: age || 25, // 사용자가 입력한 실제 나이 사용, 없으면 기본값
            gender: (gender as 'male' | 'female') || 'female',
            relationship: relationship || relationship_type || 'friend', // 사용자가 입력한 실제 관계명 사용
            concept: concept || concept_id || 'romantic' // 사용자가 입력한 실제 컨셉 사용
          }
          
          console.log('Task 007: 사용자 데이터 구성:', {
            userData,
            userImageUrl: user_uploads_url?.substring(0, 50) + '...',
            userId: userId.substring(0, 8) + '...'
          })
          
          // Task 007: 새로운 프롬프트 기반 ComfyUI 클라이언트 사용
          console.log('🚨 API Route: ComfyUIProfileClient 사용 시작')
          console.log('🚨 userData:', userData)
          
          const comfyUIClient = new ComfyUIProfileClient()
          
          imageResult = await comfyUIClient.generateProfile(
            userData,
            user_uploads_url!,
            userId,
            chatbot_name || '나의 AI 캐릭터'
          )
          
          console.log('🚨 생성된 프롬프트 (앞 200자):', imageResult.generated_prompts?.positive_prompt?.substring(0, 200))
          
          // 생성된 프롬프트 추출 (실패 시에도 저장되도록 즉시 추출)
          if (imageResult.generated_prompts) {
            positivePrompt = imageResult.generated_prompts.positive_prompt
            negativePrompt = imageResult.generated_prompts.negative_prompt
            
            console.log('isNewFormat - 생성된 프롬프트 추출 완료:', {
              positive_length: positivePrompt?.length || 0,
              negative_length: negativePrompt?.length || 0,
              has_positive: !!positivePrompt,
              has_negative: !!negativePrompt
            })
          }
          
          // 매핑 정보 추출
          mappingInfo = {
            concept_id: concept_id,
            speech_preset_id: speech_preset_id,
            is_new_format: true,
            is_prompt_based: true, // Task 007: 프롬프트 기반임을 표시
            gender: gender || 'female',
            relationship_type: relationship_type || 'friend',
            mapping_method: 'prompt_based_generation' // Task 007: 새로운 매핑 방식
          }
          
        } else if (isPromptBasedFormat) {
          // Task 007: 프롬프트 기반 방식 - 사용자 입력값으로 직접 처리
          console.log('Task 007: 프롬프트 기반 방식 시작 (age + gender + relationship + concept)')
          
          // ✅ 사용자 입력 데이터 구성 (실제 입력값 사용)
          const userData: UserInputData = {
            age: age,
            gender: gender as 'male' | 'female',
            relationship: relationship,
            concept: concept
          }
          
          console.log('Task 007: 프롬프트 기반 사용자 데이터:', {
            userData,
            userImageUrl: user_uploads_url?.substring(0, 50) + '...',
            userId: userId.substring(0, 8) + '...'
          })
          
          // Task 007: 새로운 프롬프트 기반 ComfyUI 클라이언트 사용
          console.log('🚨 API Route: ComfyUIProfileClient 사용 시작')
          console.log('🚨 userData:', userData)
          
          const comfyUIClient = new ComfyUIProfileClient()
          
          imageResult = await comfyUIClient.generateProfile(
            userData,
            user_uploads_url!,
            userId,
            chatbot_name || '나의 AI 캐릭터'
          )
          
          console.log('🚨 생성된 프롬프트 (앞 200자):', imageResult.generated_prompts?.positive_prompt?.substring(0, 200))
          
          // 생성된 프롬프트 추출 (실패 시에도 저장되도록 즉시 추출)
          if (imageResult.generated_prompts) {
            positivePrompt = imageResult.generated_prompts.positive_prompt
            negativePrompt = imageResult.generated_prompts.negative_prompt
            
            console.log('isPromptBasedFormat - 생성된 프롬프트 추출 완료:', {
              positive_length: positivePrompt?.length || 0,
              negative_length: negativePrompt?.length || 0,
              has_positive: !!positivePrompt,
              has_negative: !!negativePrompt
            })
          }
          
          // 매핑 정보 추출
          mappingInfo = {
            is_prompt_based_format: true,
            is_prompt_based: true, // Task 007: 프롬프트 기반임을 표시
            gender: gender,
            relationship_type: relationship,
            mapping_method: 'direct_prompt_based_generation', // Task 007: 직접 프롬프트 기반 매핑 방식
            user_input: userData // 사용자 원본 입력값 보존
          }
          
        } else {
          // 기존 방식: preset_id 직접 사용 (하위 호환성)
          console.log('기존 방식: 고정 프리셋 사용 (레거시 호환)')
          
          // ✅ Phase 4 Step 3: 올바른 매핑 로직 사용 (레거시 호환)
          const presetId = gender && relationship_type 
            ? getSimplePresetId(gender, relationship_type)  // 올바른 직접 매핑
            : preset_id || '1' // 기본 프리셋
          
          imageResult = await callComfyUIServer(
            user_uploads_url!,
            presetId,
            userId,
            {
              timeout: 180000,
              retries: 3,
              chatbotName: chatbot_name || '나의 AI 캐릭터',
              environment: 'production'
            }
          )
          
          mappingInfo = {
            mapped_preset_id: presetId,
            is_legacy: true,
            gender: imageResult.style_info?.gender || 'female',
            relationship_type: imageResult.style_info?.relationship || 'friend'
          }
        }
      }

      const imageGenerationTime = Date.now() - imageGenerationStart
      metrics.imageGenerationTime = logMetrics(metrics, `이미지 생성 완료 (${imageGenerationTime}ms)`)
      
      console.log('이미지 생성 완료 상세 정보:', {
        success: imageResult.success,
        hasImageUrl: !!imageResult.profile_image_url,
        is_mock: imageResult.is_mock || isMockMode,
        processing_time: imageGenerationTime,
        mapping_info: mappingInfo,
        error: imageResult.error
      })

      if (!imageResult.success) {
        // Phase 3-1: 상세 에러 로깅 개선 (Phase 2 기반)
        console.error('🔥 이미지 생성 실패 - 상세 분석:', {
          // 기본 에러 정보
          error: imageResult.error,
          error_code: imageResult.error_code,
          
          // Phase 2에서 추가된 style_info 관련 로깅
          style_info: imageResult.style_info,
          generation_job_id: imageResult.generation_job_id,
          
          // 성능 및 환경 정보
          processing_time: imageGenerationTime,
          is_mock: imageResult.is_mock || isMockMode,
          
          // Phase 1,2에서 개선된 mapping_info
          mapping_info: mappingInfo,
          
          // 요청 컨텍스트
          request_context: {
            user_id: userId.substring(0, 8) + '...',
            preset_id: preset_id || 'dynamic',
            is_new_format: isNewFormat,
            has_user_image: !!user_uploads_url,
            server_mode: isMockMode ? 'mock' : 'comfyui'
          },
          
          // 에러 패턴 분석
          error_patterns: {
            is_timeout: imageResult.error?.includes('timeout') || false,
            is_network: imageResult.error?.includes('fetch') || imageResult.error?.includes('network') || false,
            is_server_error: imageResult.error?.includes('500') || false,
            is_image_download_error: imageResult.error?.includes('Failed to download user image') || false,
            has_error_code: !!imageResult.error_code
          },
          
          // 디버깅 정보
          debug_info: {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            comfyui_server: process.env.COMFYUI_SERVER_URL,
            mock_enabled: process.env.NEXT_PUBLIC_ENABLE_MOCK
          }
        })
        
        let userFriendlyError = imageResult.error || '이미지 생성에 실패했습니다.'
        
        // Phase 3-1: ComfyUI 서버 특정 에러 메시지 개선 (기존 로직 확장)
        if (userFriendlyError.includes('timeout')) {
          userFriendlyError = 'AI 이미지 생성 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        } else if (userFriendlyError.includes('fetch') || userFriendlyError.includes('network')) {
          userFriendlyError = 'ComfyUI 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
        } else if (userFriendlyError.includes('500')) {
          userFriendlyError = 'ComfyUI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
        } else if (userFriendlyError.includes('Failed to download user image')) {
          userFriendlyError = '업로드된 이미지를 처리할 수 없습니다. 이미지 파일을 다시 업로드해보세요.'
        } else if (imageResult.error_code === 'INVALID_INPUT') {
          userFriendlyError = '입력된 이미지나 설정이 올바르지 않습니다. 다시 확인해주세요.'
        } else if (imageResult.error_code === 'SERVER_OVERLOAD') {
          userFriendlyError = '서버가 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
        } else if (imageResult.error_code === 'QUOTA_EXCEEDED') {
          userFriendlyError = '이미지 생성 한도를 초과했습니다.'
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: userFriendlyError,
            is_mock: imageResult.is_mock || isMockMode,
            processing_time: imageGenerationTime,
            mapping_info: mappingInfo
          }, 
          { status: 500 }
        )
      }
      
    } catch (error) {
      const imageGenerationTime = Date.now() - imageGenerationStart
      
      // Phase 3-1: 이미지 생성 예외 상세 로깅 개선
      console.error('🚨 이미지 생성 중 예외 발생 - 상세 분석:', {
        // 기본 에러 정보
        error: error instanceof Error ? error.message : error,
        error_name: error instanceof Error ? error.name : 'Unknown',
        error_stack: error instanceof Error ? error.stack?.substring(0, 500) + '...' : undefined,
        
        // 성능 및 환경 정보
        processing_time: imageGenerationTime,
        processing_time_seconds: Math.round(imageGenerationTime/1000),
        is_mock: isMockMode,
        
        // 요청 컨텍스트
        request_context: {
          user_id: userId.substring(0, 8) + '...',
          preset_id: preset_id || 'dynamic',
          is_new_format: isNewFormat,
          has_user_image: !!user_uploads_url,
          server_mode: isMockMode ? 'mock' : 'comfyui',
          user_image_url_preview: user_uploads_url?.substring(0, 50) + '...' || 'none'
        },
        
        // 에러 패턴 분석
        error_analysis: {
          is_abort_error: error instanceof Error && error.name === 'AbortError',
          is_timeout: error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout')),
          is_fetch_error: error instanceof Error && error.message.includes('fetch'),
          is_network_error: error instanceof Error && (error.message.includes('network') || error.message.includes('ECONNREFUSED')),
          is_json_parse_error: error instanceof Error && error.message.includes('JSON'),
          is_url_error: error instanceof Error && error.message.includes('URL'),
          is_ssl_error: error instanceof Error && error.message.includes('SSL')
        },
        
        // 시스템 정보
        system_info: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          memory_usage: process.memoryUsage ? {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          } : 'unavailable'
        },
        
        // 매핑 정보 (Phase 1,2에서 개선됨)
        mapping_info: mappingInfo || 'not_available'
      })
      
      let errorMessage = '이미지 생성 중 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = `이미지 생성 시간이 초과되었습니다. (${Math.round(imageGenerationTime/1000)}초)`
        } else if (error.message.includes('fetch')) {
          errorMessage = 'ComfyUI 서버에 연결할 수 없습니다.'
        } else if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
          errorMessage = '네트워크 연결에 문제가 발생했습니다. 인터넷 연결을 확인해주세요.'
        } else if (error.message.includes('JSON')) {
          errorMessage = '서버 응답 형식에 문제가 있습니다. 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('SSL')) {
          errorMessage = 'SSL 인증서 문제가 발생했습니다. 서버 관리자에게 문의하세요.'
        } else {
          errorMessage = error.message
        }
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          is_mock: isMockMode,
          processing_time: imageGenerationTime
        }, 
        { status: 500 }
      )
    }

    // 9. 생성된 이미지 URL 추출
    const generatedImageUrl = imageResult.profile_image_url

    if (!generatedImageUrl) {
      console.error('프로필 이미지 URL 누락')
      return NextResponse.json(
        { 
          success: false,
          error: '프로필 이미지 URL을 받지 못했습니다.',
          is_mock: imageResult.is_mock || isMockMode
        }, 
        { status: 500 }
      )
    }

    console.log('생성된 프로필 이미지 URL 확인:', generatedImageUrl.substring(0, 50) + '...')

    // 10. 프리셋 정보 처리 - 새로운 방식 또는 기존 방식
    let relationshipType, systemPrompt, personalityDescription

    if (isNewFormat) {
      // 새로운 방식: 컨셉과 말투 프리셋으로 동적 시스템 프롬프트 생성
      console.log('새로운 방식: 컨셉과 말투 프리셋으로 프롬프트 생성 중...')
      
      try {
        const { concept, speechPreset } = await fetchConceptAndSpeechPreset(concept_id!, speech_preset_id!)
        
        // 동적 시스템 프롬프트 생성
        systemPrompt = generateSystemPrompt({
          name: chatbot_name || '나의 AI 캐릭터',
          gender: gender || mappingInfo.gender || 'female', // ✅ Phase 4 Step 3: 직접 전달받은 gender 우선 사용
          relationship_type: concept.relationship_type,
          concept: {
            name: concept.name,
            system_prompt: concept.system_prompt
          },
          speech_preset: {
            name: speechPreset.name,
            system_prompt: speechPreset.system_prompt
          }
        })
        
        relationshipType = relationship_type || concept.relationship_type // ✅ Phase 4 Step 3: 직접 전달받은 relationship_type 우선 사용
        personalityDescription = `${concept.name} 성격의 ${speechPreset.name} 캐릭터`
        
        console.log('프롬프트 생성 완료:', {
          concept: concept.name,
          speech: speechPreset.name,
          relationship: relationshipType,
          promptLength: systemPrompt.length
        })
        
      } catch (error) {
        console.error('컨셉/말투 프리셋 조회 실패, 기본값 사용:', error)
        relationshipType = relationship_type || mappingInfo.relationship_type || 'friend' // ✅ Phase 4 Step 3: 직접 전달받은 relationship_type 우선 사용
        systemPrompt = `${chatbot_name || '나의 AI 캐릭터'} - AI 생성 캐릭터`
        personalityDescription = '기본 AI 캐릭터'
      }
      
    } else {
      // 기존 방식: 고정 프리셋 사용
      relationshipType = relationship_type || 'friend' // ✅ Phase 4 Step 3: 직접 전달받은 relationship_type 우선 사용
      systemPrompt = `${chatbot_name || '나의 AI 캐릭터'} - ${relationshipType} 캐릭터`
      personalityDescription = `${relationshipType} 캐릭터`
    }

    // 11. 챗봇 정보 데이터베이스 저장
    console.log('챗봇 정보 데이터베이스 저장 중...')
    const dbSaveStart = Date.now()
    
    // 프롬프트는 이미 이미지 생성 과정에서 추출됨
    console.log('데이터베이스 저장 시 프롬프트 정보:', {
      positive_length: positivePrompt?.length || 0,
      negative_length: negativePrompt?.length || 0,
      has_positive: !!positivePrompt,
      has_negative: !!negativePrompt,
      extraction_source: positivePrompt ? 'comfyui_client_response' : 'not_available'
    })

    // ✅ 사용자 입력값을 기존 데이터베이스 컬럼에 매핑 + 프롬프트 저장 추가
    const chatbotData = {
      user_id: userId,
      name: chatbot_name || '나의 AI 캐릭터',
      profile_image_url: generatedImageUrl,
      user_uploaded_image_url: user_uploads_url,
      
      // ✅ 사용자 실제 입력값을 기존 컬럼에 저장
      age: age || 25, // 사용자가 입력한 실제 나이 → age 컬럼
      gender: gender || 'female', // 사용자가 선택한 성별 → gender 컬럼  
      relationship_type: relationship || relationshipType, // 사용자 입력 관계 → relationship_type 컬럼
      personality_description: concept || personalityDescription, // 사용자 입력 컨셉 → personality_description 컬럼
      
      // 🎯 개선된 시스템 프롬프트: 사용자 입력 기반 상세 가이드 저장
      system_prompt: generateSystemPromptFromStoredData({
        name: chatbot_name || '나의 AI 캐릭터',
        age: age || 25,
        gender: gender || 'female',
        concept: concept || personalityDescription,
        relationship: relationship || relationshipType
      }),
      concept_id: concept_id,
      speech_preset_id: speech_preset_id,
      is_active: true,
      created_at: new Date().toISOString(),
      
      // ✅ 새로 추가: 이미지 생성에 사용된 프롬프트 저장 (실패한 경우에도 저장됨)
      positive_prompt: positivePrompt,
      negative_prompt: negativePrompt
    }

    console.log('사용자 입력값 → DB 컬럼 매핑:', {
      user_age: age,
      user_relationship: relationship,  
      user_concept: concept,
      mapped_to_columns: {
        age: chatbotData.age,
        relationship_type: chatbotData.relationship_type,
        personality_description: chatbotData.personality_description
      }
    })

    try {
      const { data: chatbot, error: chatbotError } = await supabaseService
        .from('chatbots')
        .insert(chatbotData)
        .select()
        .single()

      if (chatbotError) {
        // Phase 3-1: 상세 오류 로깅 추가 (Phase 1,2 기반 개선)
        console.error('🔥 챗봇 저장 상세 오류 - 완전한 진단:', {
          // 기본 에러 정보
          error: chatbotError,
          code: chatbotError.code,
          details: chatbotError.details,
          hint: chatbotError.hint,
          message: chatbotError.message,
          
          // Phase 1에서 수정된 chatbotData (metadata 제거됨)
          chatbotData: {
            ...chatbotData,
            // 민감정보 마스킹 (Phase 1에서 이미 부분 구현됨)
            user_id: chatbotData.user_id.substring(0, 8) + '...',
            profile_image_url: chatbotData.profile_image_url?.substring(0, 50) + '...',
            system_prompt: chatbotData.system_prompt?.substring(0, 100) + '...'
          },
          
          // Phase 2에서 추가된 style_info 관련 로깅
          style_info: imageResult.style_info,
          mapping_info: mappingInfo,
          
          // 상세 진단 정보
          diagnostic_info: {
            generation_job_id: imageResult.generation_job_id,
            processing_time: imageResult.processing_time,
            is_mock: imageResult.is_mock || isMockMode,
            request_format: isNewFormat ? 'new_concept_speech' : 'legacy_preset',
            
            // 데이터 유효성 검사
            data_validation: {
              has_user_id: !!chatbotData.user_id,
              has_name: !!chatbotData.name,
              has_profile_image_url: !!chatbotData.profile_image_url,
              has_relationship_type: !!chatbotData.relationship_type,
              has_gender: !!chatbotData.gender,
              has_system_prompt: !!chatbotData.system_prompt,
              has_concept_id: !!chatbotData.concept_id,
              has_speech_preset_id: !!chatbotData.speech_preset_id
            }
          },
          
          // 에러 분류
          error_classification: {
            is_duplicate_key: chatbotError.code === '23505',
            is_foreign_key: chatbotError.code === '23503',
            is_invalid_column: chatbotError.code === '42703',
            is_not_null_violation: chatbotError.code === '23502',
            is_check_violation: chatbotError.code === '23514',
            is_data_type_mismatch: chatbotError.code === '22P02',
            is_permission_denied: chatbotError.code === '42501'
          },
          
          // 시스템 상태
          system_state: {
            timestamp: new Date().toISOString(),
            database_save_time: Date.now() - dbSaveStart,
            total_request_time: Date.now() - metrics.startTime,
            environment: process.env.NODE_ENV
          }
        })
        
        let dbErrorMessage = '챗봇 정보 저장에 실패했습니다.'
        
        // Phase 3-1: 에러 코드별 상세 메시지 개선
        if (chatbotError.code === '23505') {
          dbErrorMessage = '이미 생성된 챗봇이 있습니다.'
        } else if (chatbotError.code === '23503') {
          dbErrorMessage = '참조 데이터가 유효하지 않습니다.'
        } else if (chatbotError.code === '42703') {
          dbErrorMessage = '데이터베이스 스키마 오류: 유효하지 않은 열이 감지되었습니다.'
        } else if (chatbotError.code === '23502') {
          dbErrorMessage = '필수 데이터가 누락되었습니다.'
        } else if (chatbotError.code === '23514') {
          dbErrorMessage = '데이터 유효성 검사에 실패했습니다.'
        } else if (chatbotError.code === '22P02') {
          dbErrorMessage = '데이터 형식이 올바르지 않습니다.'
        } else if (chatbotError.code === '42501') {
          dbErrorMessage = '데이터베이스 접근 권한이 없습니다.'
        } else if (chatbotError.message?.includes('timeout')) {
          dbErrorMessage = '데이터베이스 연결 시간이 초과되었습니다.'
        } else if (chatbotError.message?.includes('connection')) {
          dbErrorMessage = '데이터베이스에 연결할 수 없습니다.'
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: dbErrorMessage,
            is_mock: imageResult.is_mock || isMockMode
          }, 
          { status: 500 }
        )
      }

      metrics.databaseSaveTime = logMetrics(metrics, `데이터베이스 저장 완료 (${Date.now() - dbSaveStart}ms)`)
      console.log('✅ 챗봇 생성 완료:', {
        chatbot_id: chatbot.id,
        name: chatbot.name,
        profile_image_url: generatedImageUrl?.substring(0, 50) + '...',
        user_uploaded_image_url: user_uploads_url?.substring(0, 50) + '...',  // ✅ 추가
        mapping_info: mappingInfo
      })
      
      // Phase 3-1: 메타데이터 대체 로깅 강화 (Phase 1 완료 기반)
      console.log('🎯 챗봇 생성 통합 메타정보 - 완전한 추적:', {
        // 기본 챗봇 정보
        chatbot_basic: {
          id: chatbot.id,
          name: chatbot.name,
          relationship_type: chatbot.relationship_type,
          gender: chatbot.gender,
          is_active: chatbot.is_active
        },
        
        // Phase 2에서 추가된 이미지 생성 정보
        image_generation: {
          generation_job_id: imageResult.generation_job_id, // Phase 2에서 추가
          processing_time: imageResult.processing_time,     // Phase 2에서 추가
          profile_image_url_preview: chatbot.profile_image_url?.substring(0, 50) + '...',
          is_mock: imageResult.is_mock || isMockMode
        },
        
        // Phase 2에서 추가된 style_info
        style_info: imageResult.style_info,              // Phase 2에서 추가
        
        // Phase 1,2에서 개선된 mapping_info
        mapping_info: mappingInfo,                       // Phase 1,2에서 개선
        
        // 성능 메트릭스
        performance_metrics: {
          auth_time: metrics.authTime,
          quota_check_time: metrics.quotaCheckTime,
          preset_mapping_time: metrics.presetMappingTime,
          image_validation_time: metrics.imageValidationTime,
          image_generation_time: metrics.imageGenerationTime,
          database_save_time: metrics.databaseSaveTime,
          total_time: Date.now() - metrics.startTime
        },
        
        // 요청 컨텍스트
        request_context: {
          user_id: userId.substring(0, 8) + '...',
          format_type: isNewFormat ? 'new_concept_speech' : 'legacy_preset',
          concept_id: concept_id?.substring(0, 8) + '...' || 'none',
          speech_preset_id: speech_preset_id?.substring(0, 8) + '...' || 'none',
          preset_id: preset_id || 'dynamic',
          chatbot_name: chatbot_name || 'default',
          has_user_uploads: !!user_uploads_url
        },
        
        // 시스템 정보
        system_info: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          mock_mode: isMockMode,
          server_url: isMockMode ? 'mock_service' : process.env.COMFYUI_SERVER_URL,
          database_host: 'aws-0-ap-northeast-2.pooler.supabase.com'
        },
        
        // 새로운 방식 전용 정보 (concept + speech preset)
        ...(isNewFormat && {
          new_format_details: {
            concept_id: concept_id,
            speech_preset_id: speech_preset_id,
            system_prompt_length: chatbot.system_prompt?.length || 0,
            personality_description: chatbot.personality_description
          }
        }),
        
        // 레거시 방식 정보
        ...(!isNewFormat && {
          legacy_format_details: {
            preset_id: preset_id,
            mapping_used: 'hardcoded_preset_mapping'
          }
        })
      })
      
      // 챗봇 변수를 외부에서 사용할 수 있도록 설정
      var createdChatbot = chatbot
      
    } catch (error) {
      // Phase 3-1: 데이터베이스 저장 예외 상세 로깅 개선
      console.error('🚨 챗봇 저장 중 예외 발생 - 상세 분석:', {
        // 기본 에러 정보
        error: error instanceof Error ? error.message : error,
        error_name: error instanceof Error ? error.name : 'Unknown',
        error_stack: error instanceof Error ? error.stack?.substring(0, 500) + '...' : undefined,
        
        // 데이터베이스 관련 정보
        database_context: {
          save_start_time: dbSaveStart,
          processing_time: Date.now() - dbSaveStart,
          total_request_time: Date.now() - metrics.startTime,
          connection_info: {
            host: 'aws-0-ap-northeast-2.pooler.supabase.com',
            port: 5432,
            database: 'postgres'
          }
        },
        
        // 시도한 데이터 (민감정보 마스킹)
        attempted_data: {
          user_id: chatbotData.user_id.substring(0, 8) + '...',
          name: chatbotData.name,
          relationship_type: chatbotData.relationship_type,
          gender: chatbotData.gender,
          has_profile_image_url: !!chatbotData.profile_image_url,
          has_system_prompt: !!chatbotData.system_prompt,
          has_concept_id: !!chatbotData.concept_id,
          has_speech_preset_id: !!chatbotData.speech_preset_id,
          data_size: JSON.stringify(chatbotData).length
        },
        
        // Phase 2에서 추가된 이미지 관련 정보
        image_context: {
          generation_job_id: imageResult.generation_job_id,
          style_info: imageResult.style_info,
          mapping_info: mappingInfo,
          is_mock: imageResult.is_mock || isMockMode
        },
        
        // 에러 패턴 분석
        error_analysis: {
          is_connection_error: error instanceof Error && (
            error.message.includes('connection') || 
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
          ),
          is_auth_error: error instanceof Error && (
            error.message.includes('authentication') ||
            error.message.includes('permission')
          ),
          is_data_error: error instanceof Error && (
            error.message.includes('invalid') ||
            error.message.includes('constraint') ||
            error.message.includes('duplicate')
          ),
          is_network_error: error instanceof Error && error.message.includes('network')
        },
        
        // 시스템 상태
        system_state: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          memory_usage: process.memoryUsage ? {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
          } : 'unavailable'
        }
      })
      
      let errorMessage = '데이터베이스 저장 중 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('ECONNREFUSED')) {
          errorMessage = '데이터베이스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('timeout')) {
          errorMessage = '데이터베이스 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        } else if (error.message.includes('authentication') || error.message.includes('permission')) {
          errorMessage = '데이터베이스 접근 권한에 문제가 있습니다. 관리자에게 문의하세요.'
        } else if (error.message.includes('constraint') || error.message.includes('duplicate')) {
          errorMessage = '데이터 제약 조건 위반이 발생했습니다.'
        } else if (error.message.includes('network')) {
          errorMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.'
        } else {
          errorMessage = `저장 중 오류 발생: ${error.message}`
        }
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          is_mock: imageResult.is_mock || isMockMode,
          processing_time: Date.now() - metrics.startTime
        }, 
        { status: 500 }
      )
    }

    // 12. 쿼터 소진 성공 로깅 (API 기반 쿼터는 이미 차감됨)
    console.log('✅ 프로필 이미지 생성 완료:', {
      chatbot_id: createdChatbot.id,
      remaining_quota: quotaResult.remaining,
      api_based_quota: true // API 기반 쿼터 사용 표시
    })

    // 13. 성공 응답 - 상세 메트릭스 포함
    metrics.totalTime = Date.now() - metrics.startTime
    console.log(`=== 프로필 생성 API 완료 (API 기반 쿼터) ===`)
    console.log('성능 메트릭스:', {
      총처리시간: metrics.totalTime + 'ms',
      인증시간: (metrics.authTime! - metrics.startTime) + 'ms',
      쿼터처리시간: (metrics.quotaCheckTime! - metrics.authTime!) + 'ms',
      프리셋매핑시간: metrics.presetMappingTime ? (metrics.presetMappingTime - metrics.quotaCheckTime!) + 'ms' : 'N/A',
      이미지검증시간: metrics.imageValidationTime ? (metrics.imageValidationTime - (metrics.presetMappingTime || metrics.quotaCheckTime!)) + 'ms' : 'N/A',
      이미지생성시간: metrics.imageGenerationTime + 'ms',
      DB저장시간: metrics.databaseSaveTime + 'ms',
      is_mock: imageResult.is_mock || isMockMode,
      mapping_info: mappingInfo
    })

    const response: ProfileGenerationResponse = {
      success: true,
      profile_image_url: generatedImageUrl,
      chatbot_id: createdChatbot.id,
      generation_job_id: imageResult.generation_job_id,
      processing_time: metrics.totalTime,
      is_mock: imageResult.is_mock || isMockMode,
      mapping_info: mappingInfo,
      // API 기반 쿼터 정보 추가
      quota_api_used: true,
      remaining_quota: quotaResult.remaining
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('프로필 생성 API 예외 발생 (Phase 2 Fix):', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    
    let errorMessage = '서버 오류가 발생했습니다.'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'ComfyUI 서버 응답 시간이 초과되었습니다.'
        statusCode = 408
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'ComfyUI 서버에 연결할 수 없습니다.'
        statusCode = 503
      } else if (error.message.includes('auth')) {
        errorMessage = '인증에 실패했습니다.'
        statusCode = 401
      } else if (error.message.includes('database') || error.message.includes('postgres')) {
        errorMessage = '데이터베이스 연결에 문제가 발생했습니다.'
        statusCode = 503
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        is_mock: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
        timestamp: new Date().toISOString()
      }, 
      { status: statusCode }
    )
  }
}

// GET 요청: 프로필 이미지 생성 가능 여부 확인 (API 기반)
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    console.log('🔍 프로필 생성 가능 여부 확인 API 시작 (API 기반)')
    
    // 🔍 헤더 디버깅 추가
    console.log('🔍 GET 요청 헤더 상세 확인:', {
      authorizationHeader: request.headers.get('authorization') ? 
        'Bearer ' + request.headers.get('authorization')?.substring(7, 37) + '...' : '없음',
      cookieHeader: request.headers.get('cookie') ? '존재함' : '없음',
      contentType: request.headers.get('content-type'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    })
    
    // Request 기반 인증 처리
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    
    if (!authToken) {
      console.error('❌ GET 요청 인증 토큰 없음')
      
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.',
          can_generate: false
        }, 
        { status: 401 }
      )
    }

    // 세션 및 사용자 정보 확인
    console.log('✅ GET 요청 토큰 발견, 세션 확인 중')
    const authState = await debugAuthState(supabase, 'profile-check-api-get')
    
    if (!authState.isAuthenticated || !authState.user) {
      console.error('❌ GET 요청 유효하지 않은 세션')
      
      return NextResponse.json(
        { 
          success: false,
          error: '세션이 만료되었거나 유효하지 않습니다.',
          can_generate: false
        }, 
        { status: 401 }
      )
    }

    const user = authState.user
    console.log('✅ GET 요청 인증 성공:', {
      userId: user.id.substring(0, 8) + '...',
      email: user.email
    })

    // API 기반 쿼터 상태 조회
    console.log('API 기반 쿼터 상태 조회 시작')
    const quotaStatus = await QuotaApiClient.check(
      request,
      QuotaType.PROFILE_IMAGE_GENERATION
    )
    
    const processingTime = Date.now() - startTime
    
    // ComfyUI 서버 상태도 함께 확인
    const serverHealth = await checkComfyUIServerHealth()
    
    console.log('✅ API 기반 쿼터 상태 조회 완료:', {
      can_generate: quotaStatus.canUse,
      remaining: quotaStatus.remaining,
      server_status: serverHealth.status,
      processing_time: processingTime + 'ms'
    })

    return NextResponse.json({
      success: true,
      can_generate: quotaStatus.canUse,
      quota_remaining: quotaStatus.remaining,
      is_mock_mode: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
      mock_version: process.env.NEXT_PUBLIC_MOCK_VERSION || '1.0',
      comfyui_server_status: serverHealth.status,
      comfyui_server_version: serverHealth.version,
      processing_time: processingTime,
      quota_api_used: true // API 기반 쿼터 사용 표시
    })

  } catch (error) {
    console.error('❌ GET 프로필 생성 가능 여부 확인 오류:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '쿼터 상태 확인 중 오류가 발생했습니다.',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    )
  }
}
