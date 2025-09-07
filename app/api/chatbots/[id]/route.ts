import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '@/lib/supabase-server'

// GET /api/chatbots/[id] - 개별 챗봇 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    
    // 사용자 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const chatbotId = params.id

    // UUID 형식 검증
    if (!chatbotId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatbotId)) {
      return NextResponse.json(
        { error: 'Valid chatbot ID is required' },
        { status: 400 }
      )
    }

    // 개별 챗봇 조회 (본인 소유만)
    const { data: chatbot, error: chatbotError } = await supabase
      .from('chatbots')
      .select(`
        id,
        name,
        profile_image_url,
        relationship_type,
        gender,
        personality_description,
        speech_preset_id,
        concept_id,
        is_active,
        created_at
      `)
      .eq('id', chatbotId)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .single()

    if (chatbotError || !chatbot) {
      console.error('❌ 챗봇 조회 실패:', chatbotError)
      return NextResponse.json(
        { error: 'Chatbot not found or access denied' }, 
        { status: 404 }
      )
    }

    console.log(`✅ 챗봇 조회 성공: ${chatbot.name}`)
    return NextResponse.json(chatbot)

  } catch (error) {
    console.error('❌ 개별 챗봇 조회 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

// PUT /api/chatbots/[id] - 챗봇 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
    
    // 사용자 인증 확인
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const chatbotId = params.id
    const updateData = await request.json()

    // UUID 형식 검증
    if (!chatbotId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatbotId)) {
      return NextResponse.json(
        { error: 'Valid chatbot ID is required' },
        { status: 400 }
      )
    }

    // 업데이트 가능한 필드만 허용
    const allowedFields = [
      'name', 
      'personality_description', 
      'concept_id', 
      'speech_preset_id',
      'relationship_type',
      'gender'
    ]
    
    const filteredUpdateData = Object.keys(updateData)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key]
        return obj
      }, {} as any)

    if (Object.keys(filteredUpdateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // 챗봇 업데이트 (본인 소유만)
    const { data: updatedChatbot, error: updateError } = await supabase
      .from('chatbots')
      .update({
        ...filteredUpdateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', chatbotId)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .select()
      .single()

    if (updateError || !updatedChatbot) {
      console.error('❌ 챗봇 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: 'Chatbot not found or update failed' }, 
        { status: 404 }
      )
    }

    console.log(`✅ 챗봇 업데이트 성공: ${updatedChatbot.name}`)
    return NextResponse.json(updatedChatbot)

  } catch (error) {
    console.error('❌ 챗봇 업데이트 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
