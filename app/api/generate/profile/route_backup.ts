import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import { callComfyUIServer, getRelationshipType, PRESET_MAPPING, processComfyUIResponse } from '@/lib/comfyui/client'
import { uploadImageToSupabase } from '@/lib/storage/upload'
import { createImageGenerationService } from '@/lib/services/imageGenerationFactory'
import { generateSystemPrompt } from '@/lib/chatbotUtils'
import { Client } from 'pg'

// 성능 모니터링 및 에러 로깅
interface PerformanceMetrics {
  startTime: number
  authTime?: number
  quotaCheckTime?: number
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

interface ProfileGenerationRequest {
  user_uploads_url?: string  // Mock 모드에서는 선택사항
  concept_id?: string       // 새로운 컨셉 ID
  speech_preset_id?: string // 새로운 말투 프리셋 ID
  preset_id?: string        // 기존 프리셋 ID (backward compatibility)
  chatbot_name?: string
}

interface ProfileGenerationResponse {
  success: boolean
  profile_image_url?: string
  chatbot_id?: string
  generation_job_id?: string
  error?: string
  processing_time?: number
  is_mock?: boolean
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
  console.log('=== 프로필 이미지 생성 API 시작 ===')
  
  try {
    // 1. 요청 데이터 파싱
    const body = await request.json()
    const { user_uploads_url, concept_id, speech_preset_id, preset_id, chatbot_name }: ProfileGenerationRequest = body

    console.log('요청 데이터:', {
      concept_id,
      speech_preset_id,
      preset_id,
      chatbot_name,
      user_uploads_url: user_uploads_url ? user_uploads_url.substring(0, 50) + '...' : 'null',
      mock_mode: process.env.NEXT_PUBLIC_ENABLE_MOCK
    })

    // 2. 입력 검증 - 새로운 방식 또는 기존 방식 지원 (강화된 검증)
    const isNewFormat = concept_id && speech_preset_id
    const isLegacyFormat = preset_id

    if (!isNewFormat && !isLegacyFormat) {
      console.error('필수 파라미터 누락:', { concept_id, speech_preset_id, preset_id })
      return NextResponse.json(
        { 
          success: false,
          error: '필수 파라미터가 누락되었습니다. (concept_id + speech_preset_id 또는 preset_id 필요)' 
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

    // 프리셋 ID 검증 (기존 방식일 때만)
    if (isLegacyFormat && !PRESET_MAPPING[preset_id!]) {
      console.error('유효하지 않은 프리셋 ID:', preset_id)
      return NextResponse.json(
        { 
          success: false,
          error: `유효하지 않은 프리셋 ID: ${preset_id}` 
        }, 
        { status: 400 }
      )
    }

    // 3. 사용자 인증 확인 (Authorization 헤더 또는 쿠키) - 성능 모니터링 추가
    const metrics = createMetrics()
    
    const supabase = createSupabaseServerClient()
    let session = null
    
    // Authorization 헤더 확인 (우선순위)
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (user && !authError) {
        session = { user }
      } else if (authError) {
        console.warn('Bearer 토큰 인증 실패:', authError.message)
      }
    }
    
    // Authorization 헤더가 없거나 실패하면 쿠키 기반 세션 확인
    if (!session) {
      const sessionData = await supabase.auth.getSession()
      session = sessionData.data.session
    }

    if (!session) {
      console.error('인증되지 않은 요청 - 인증 방법:', {
        hasAuthHeader: !!authHeader,
        sessionAvailable: false
      })
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다. 로그인 후 다시 시도해주세요.' 
        }, 
        { status: 401 }
      )
    }

    const userId = session.user.id
    metrics.authTime = logMetrics(metrics, '사용자 인증 완료')
    console.log('인증된 사용자:', userId)

    // 4. 사용자 쿼터 확인 (Service Role 사용) - 에러 처리 강화
    const supabaseService = createSupabaseServiceClient()
    
    try {
      const { data: user, error: quotaError } = await supabaseService
        .from('users')
        .select('profile_image_used, email')
        .eq('id', userId)
        .single()

      if (quotaError) {
        console.error('쿼터 조회 오류:', quotaError)
        return NextResponse.json(
          { 
            success: false,
            error: '사용자 쿼터 정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' 
          }, 
          { status: 500 }
        )
      }

      if (!user) {
        console.error('사용자 정보 없음:', userId)
        return NextResponse.json(
          { 
            success: false,
            error: '사용자 정보를 찾을 수 없습니다.' 
          }, 
          { status: 404 }
        )
      }

      if (user.profile_image_used) {
        console.error('프로필 이미지 쿼터 초과:', { userId, email: user.email })
        return NextResponse.json(
          { 
            success: false,
            error: '프로필 이미지 생성 쿼터를 이미 사용하셨습니다. (1회 제한)' 
          }, 
          { status: 403 }
        )
      }

      metrics.quotaCheckTime = logMetrics(metrics, '쿼터 확인 완료')
      console.log('쿼터 확인 완료 - 생성 가능:', { userId, email: user.email })
      
    } catch (error) {
      console.error('쿼터 확인 중 예외 발생:', error)
      return NextResponse.json(
        { 
          success: false,
          error: '쿼터 확인 중 오류가 발생했습니다.' 
        }, 
        { status: 500 }
      )
    }

    // 5. 이미지 생성 서비스 호출 (성능 모니터링 및 강화된 에러 처리)
    console.log(`${isMockMode ? 'Mock' : 'ComfyUI'} 서비스에 이미지 생성 요청 중... (실제 처리시간: 30초~3분 예상)`)
    
    const imageGenerationStart = Date.now()
    const imageService = createImageGenerationService()
    
    try {
      // 이미지 생성 요청 - 기존 방식은 preset_id, 새로운 방식은 concept_id 사용
      const effectivePresetId = isNewFormat ? '1' : preset_id! // 새로운 방식일 때는 기본값 사용
      
      // ComfyUI 서버 실제 처리시간(30초~3분)에 맞춘 타임아웃 설정
      const imageGenerationOptions = {
        timeout: isMockMode ? 5000 : 180000, // Mock: 5초, 실제: 3분
        retries: isMockMode ? 1 : 3,          // Mock: 1회, 실제: 3회
        user_id: userId,
        chatbot_name: chatbot_name || '나의 AI 캐릭터'
      }
      
      console.log('이미지 생성 옵션:', {
        preset_id: effectivePresetId,
        timeout: imageGenerationOptions.timeout + 'ms',
        retries: imageGenerationOptions.retries,
        is_mock: isMockMode
      })
      
      const imageResult = await imageService.generateProfile({
        user_image_url: user_uploads_url,
        preset_id: effectivePresetId,
        chatbot_name: imageGenerationOptions.chatbot_name,
        user_id: userId
      })

      const imageGenerationTime = Date.now() - imageGenerationStart
      metrics.imageGenerationTime = logMetrics(metrics, `이미지 생성 완료 (${imageGenerationTime}ms)`)
      
      console.log(`이미지 생성 완료 상세 정보:`, {
        success: imageResult.success,
        hasImageUrl: !!imageResult.profile_image_url,
        is_mock: imageResult.is_mock,
        processing_time: imageGenerationTime,
        server_processing_time: imageResult.processing_time,
        error: imageResult.error
      })

      if (!imageResult.success) {
        // 이미지 생성 실패 시 상세 로깅 및 사용자 친화적 에러 메시지
        console.error('이미지 생성 실패 상세:', {
          error: imageResult.error,
          is_mock: imageResult.is_mock,
          processing_time: imageGenerationTime,
          user_id: userId
        })
        
        let userFriendlyError = imageResult.error || '이미지 생성에 실패했습니다.'
        
        // ComfyUI 서버 특정 에러 메시지 개선
        if (userFriendlyError.includes('timeout')) {
          userFriendlyError = 'AI 이미지 생성 시간이 초과되었습니다. ComfyUI 서버가 일시적으로 바쁜 상태일 수 있습니다. 잠시 후 다시 시도해주세요.'
        } else if (userFriendlyError.includes('fetch') || userFriendlyError.includes('network')) {
          userFriendlyError = 'ComfyUI 서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'
        } else if (userFriendlyError.includes('500') || userFriendlyError.includes('Internal Server Error')) {
          userFriendlyError = 'ComfyUI 서버에 일시적인 문제가 발생했습니다. 관리자가 확인 중이며, 잠시 후 다시 시도해주세요.'
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: userFriendlyError,
            is_mock: imageResult.is_mock,
            processing_time: imageGenerationTime
          }, 
          { status: 500 }
        )
      }
      
    } catch (error) {
      const imageGenerationTime = Date.now() - imageGenerationStart
      console.error('이미지 생성 중 예외 발생:', {
        error: error instanceof Error ? error.message : error,
        processing_time: imageGenerationTime,
        is_mock: isMockMode,
        user_id: userId
      })
      
      let errorMessage = '이미지 생성 중 오류가 발생했습니다.'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = `이미지 생성 시간이 초과되었습니다. (${Math.round(imageGenerationTime/1000)}초 경과) ComfyUI 서버 상태를 확인해주세요.`
        } else if (error.message.includes('fetch')) {
          errorMessage = 'ComfyUI 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
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

    // 6. 생성된 이미지 URL 추출
    const generatedImageUrl = imageResult.profile_image_url

    if (!generatedImageUrl) {
      console.error('프로필 이미지 URL 누락')
      return NextResponse.json(
        { 
          success: false,
          error: '프로필 이미지 URL을 받지 못했습니다.',
          is_mock: imageResult.is_mock
        }, 
        { status: 500 }
      )
    }

    console.log('생성된 프로필 이미지 URL 확인:', generatedImageUrl.substring(0, 50) + '...')

    // 7. 프리셋 정보 처리 - 새로운 방식 또는 기존 방식
    let preset, relationshipType, systemPrompt, personalityDescription

    if (isNewFormat) {
      // 새로운 방식: 컨셉과 말투 프리셋으로 동적 시스템 프롬프트 생성
      console.log('새로운 방식: 컨셉과 말투 프리셋으로 프롬프트 생성 중...')
      
      const { concept, speechPreset } = await fetchConceptAndSpeechPreset(concept_id!, speech_preset_id!)
      
      // 동적 시스템 프롬프트 생성
      systemPrompt = generateSystemPrompt({
        name: chatbot_name || '나의 AI 캐릭터',
        gender: 'female', // 기본값, 추후 사용자 설정으로 확장 가능
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
      
      relationshipType = concept.relationship_type
      personalityDescription = `${concept.name} 성격의 ${speechPreset.name} 캐릭터`
      
      console.log('생성된 시스템 프롬프트 길이:', systemPrompt.length)
      
    } else {
      // 기존 방식: 고정 프리셋 사용
      preset = PRESET_MAPPING[preset_id!]
      relationshipType = getRelationshipType(preset_id!)
      systemPrompt = imageResult.style_description || `${preset.gender} ${relationshipType} 캐릭터`
      personalityDescription = imageResult.is_mock ? 
        `Mock 캐릭터 (${imageResult.metadata?.character_type})` : 
        `AI 생성 캐릭터`
    }

    // 8. 챗봇 정보 데이터베이스 저장 (Service Role 사용) - 트랜잭션 처리 강화
    console.log('챗봇 정보 데이터베이스 저장 중...')
    const dbSaveStart = Date.now()
    
    const chatbotData = {
      user_id: userId,
      name: chatbot_name || '나의 AI 캐릭터',
      profile_image_url: generatedImageUrl,
      relationship_type: relationshipType,
      gender: isNewFormat ? 'female' : preset.gender, // 새로운 방식에서는 기본값 사용
      is_active: true,
      system_prompt: systemPrompt,
      personality_description: personalityDescription,
      // 새로운 방식에서는 컨셉과 말투 프리셋 ID 저장
      ...(isNewFormat && {
        concept_id: concept_id,
        speech_preset_id: speech_preset_id
      }),
      // 메타데이터 추가
      created_at: new Date().toISOString(),
      metadata: {
        generation_time: metrics.imageGenerationTime,
        is_mock: imageResult.is_mock,
        generation_job_id: imageResult.metadata?.generation_job_id
      }
    }
    
    console.log('저장할 챗봇 데이터:', {
      ...chatbotData,
      system_prompt: systemPrompt.substring(0, 100) + '...',
      metadata: chatbotData.metadata
    })
    
    try {
      // 데이터베이스 저장 트랜잭션
      const { data: chatbot, error: chatbotError } = await supabaseService
        .from('chatbots')
        .insert(chatbotData)
        .select()
        .single()

      if (chatbotError) {
        console.error('챗봇 저장 오류:', {
          error: chatbotError,
          user_id: userId,
          chatbot_name: chatbot_name,
          data_size: JSON.stringify(chatbotData).length
        })
        
        // 저장 실패 상세 에러 메시지
        let dbErrorMessage = '챗봇 정보 저장에 실패했습니다.'
        
        if (chatbotError.code === '23505') { // Unique constraint violation
          dbErrorMessage = '이미 생성된 챗봇이 있습니다. 기존 챗봇을 확인해주세요.'
        } else if (chatbotError.code === '23503') { // Foreign key violation
          dbErrorMessage = '참조 데이터가 유효하지 않습니다. 컨셉 또는 말투 프리셋을 확인해주세요.'
        } else if (chatbotError.message?.includes('too long')) {
          dbErrorMessage = '입력 데이터가 너무 깁니다. 챗봇 이름을 줄여주세요.'
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: dbErrorMessage,
            is_mock: imageResult.is_mock,
            debug_info: process.env.NODE_ENV === 'development' ? {
              db_error: chatbotError.message,
              db_code: chatbotError.code
            } : undefined
          }, 
          { status: 500 }
        )
      }

      metrics.databaseSaveTime = logMetrics(metrics, `데이터베이스 저장 완료 (${Date.now() - dbSaveStart}ms)`)
      console.log('챗봇 생성 완료:', { 
        id: chatbot.id, 
        name: chatbot.name, 
        is_mock: imageResult.is_mock,
        db_save_time: Date.now() - dbSaveStart + 'ms'
      })
      
      // 챗봇 변수를 외부에서 사용할 수 있도록 설정
      var createdChatbot = chatbot
      
    } catch (error) {
      console.error('챗봇 저장 중 예외 발생:', error)
      return NextResponse.json(
        { 
          success: false,
          error: '데이터베이스 저장 중 오류가 발생했습니다.',
          is_mock: imageResult.is_mock
        }, 
        { status: 500 }
      )
    }

    // 9. 프로필 이미지 쿼터 사용 처리 (Service Role 사용) - 강화된 처리
    try {
      const { error: quotaError } = await supabaseService
        .from('users')
        .update({ 
          profile_image_used: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (quotaError) {
        console.error('쿼터 업데이트 오류:', {
          error: quotaError,
          user_id: userId,
          chatbot_id: createdChatbot.id
        })
        // 챗봇은 이미 생성되었으므로 경고만 로그, 사용자에게는 성공으로 응답
        console.warn('챗봇 생성은 성공했으나 쿼터 업데이트 실패 - 수동 처리 필요')
      } else {
        console.log('프로필 이미지 쿼터 사용 처리 완료')
      }
    } catch (error) {
      console.error('쿼터 업데이트 중 예외 발생:', error)
      // 챗봇은 생성되었으므로 계속 진행
    }

    // 10. 성공 응답 - 상세 메트릭스 포함
    metrics.totalTime = Date.now() - metrics.startTime
    console.log(`=== 전체 처리 완료 ===`)
    console.log('성능 메트릭스:', {
      총처리시간: metrics.totalTime + 'ms',
      인증시간: (metrics.authTime - metrics.startTime) + 'ms',
      쿼터확인시간: (metrics.quotaCheckTime - metrics.authTime) + 'ms', 
      이미지생성시간: metrics.imageGenerationTime + 'ms',
      DB저장시간: metrics.databaseSaveTime + 'ms',
      is_mock: imageResult.is_mock
    })

    const response: ProfileGenerationResponse = {
      success: true,
      profile_image_url: generatedImageUrl,
      chatbot_id: createdChatbot.id,
      generation_job_id: imageResult.metadata?.generation_job_id,
      processing_time: metrics.totalTime,
      is_mock: imageResult.is_mock
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('프로필 생성 API 예외 발생:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      user_id: request.headers.get('Authorization') ? 'Bearer 토큰 있음' : '세션 기반',
      timestamp: new Date().toISOString()
    })
    
    let errorMessage = '서버 오류가 발생했습니다.'
    let statusCode = 500
    
    if (error instanceof Error) {
      // 타임아웃 관련 에러
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'ComfyUI 서버 응답 시간이 초과되었습니다. 서버가 일시적으로 바쁜 상태일 수 있습니다. 잠시 후 다시 시도해주세요.'
        statusCode = 408 // Request Timeout
      } 
      // 네트워크 연결 에러
      else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = 'ComfyUI 서버에 연결할 수 없습니다. 네트워크 연결을 확인하거나 잠시 후 다시 시도해주세요.'
        statusCode = 503 // Service Unavailable
      }
      // 인증 관련 에러
      else if (error.message.includes('auth') || error.message.includes('Unauthorized')) {
        errorMessage = '인증에 실패했습니다. 다시 로그인해주세요.'
        statusCode = 401 // Unauthorized
      }
      // 권한 관련 에러
      else if (error.message.includes('permission') || error.message.includes('Forbidden')) {
        errorMessage = '접근 권한이 없습니다.'
        statusCode = 403 // Forbidden
      }
      // 데이터베이스 관련 에러
      else if (error.message.includes('database') || error.message.includes('postgres')) {
        errorMessage = '데이터베이스 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
        statusCode = 503 // Service Unavailable
      }
      // JSON 파싱 에러
      else if (error.message.includes('JSON') || error.message.includes('parse')) {
        errorMessage = '요청 데이터 형식이 올바르지 않습니다.'
        statusCode = 400 // Bad Request
      }
      // 기타 알려진 에러
      else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        is_mock: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
        timestamp: new Date().toISOString(),
        // 개발 환경에서만 디버그 정보 포함
        ...(process.env.NODE_ENV === 'development' && {
          debug_info: {
            error_type: error instanceof Error ? error.name : 'Unknown',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }, 
      { status: statusCode }
    )
  }
}

// GET 요청: 프로필 이미지 생성 가능 여부 확인 - 강화된 처리
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now()
    const supabase = createSupabaseServerClient()
    let session = null
    
    // Authorization 헤더 확인 (우선순위)
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (user && !authError) {
        session = { user }
      } else if (authError) {
        console.warn('Bearer 토큰 검증 실패:', authError.message)
      }
    }
    
    // Authorization 헤더가 없거나 실패하면 쿠키 기반 세션 확인
    if (!session) {
      const sessionData = await supabase.auth.getSession()
      session = sessionData.data.session
    }

    if (!session) {
      return NextResponse.json(
        { 
          success: false,
          error: '인증이 필요합니다.' 
        }, 
        { status: 401 }
      )
    }

    // 사용자 쿼터 상태 조회 (Service Role 사용) - 에러 처리 강화
    const supabaseService = createSupabaseServiceClient()
    
    try {
      const { data: user, error: quotaError } = await supabaseService
        .from('users')
        .select('profile_image_used, email, created_at')
        .eq('id', session.user.id)
        .single()

      if (quotaError) {
        console.error('쿼터 상태 조회 오류:', quotaError)
        return NextResponse.json(
          { 
            success: false,
            error: '사용자 쿼터 정보를 확인할 수 없습니다.' 
          }, 
          { status: 500 }
        )
      }

      const processingTime = Date.now() - startTime
      console.log('쿼터 상태 조회 완료:', {
        user_id: session.user.id,
        email: user?.email,
        can_generate: !user?.profile_image_used,
        processing_time: processingTime + 'ms'
      })

      return NextResponse.json({
        success: true,
        can_generate: !user?.profile_image_used,
        quota_used: !!user?.profile_image_used,
        is_mock_mode: process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true',
        mock_version: process.env.NEXT_PUBLIC_MOCK_VERSION || '1.0',
        comfyui_server_url: process.env.COMFYUI_SERVER_URL ? 'Connected' : 'Not configured',
        processing_time: processingTime
      })
      
    } catch (error) {
      console.error('쿼터 조회 중 예외 발생:', error)
      return NextResponse.json(
        { 
          success: false,
          error: '쿼터 상태 조회 중 오류가 발생했습니다.' 
        }, 
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('프로필 생성 가능 여부 확인 오류:', error)
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
