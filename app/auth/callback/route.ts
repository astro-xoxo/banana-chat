/**
 * Google OAuth 콜백 처리 라우트
 * 작성일: 2025-07-01
 */

import { createAuthenticatedServerClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  console.log('OAuth callback received:', {
    code: code ? 'present' : 'missing',
    origin,
    searchParams: Object.fromEntries(requestUrl.searchParams.entries())
  })

  if (code) {
    try {
      const { client: supabase, authToken } = await createAuthenticatedServerClient(request)
      
      // OAuth 코드를 세션으로 교환
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth 코드 교환 오류:', error)
        return NextResponse.redirect(`${origin}/login?error=oauth_error&message=${encodeURIComponent(error.message)}`)
      }

      if (session?.user) {
        console.log('OAuth 로그인 성공:', session.user.email)
        
        // 사용자 프로필 자동 생성 (서버에서 직접 처리)
        try {
          const { data: existingProfile } = await supabase
            .from('users')
            .select('id')
            .eq('id', session.user.id)
            .single()

          if (!existingProfile) {
            const newProfile = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || null,
              profile_image_used: false,
              daily_chat_count: 0,
              quota_reset_time: null
            }

            const { error: insertError } = await supabase
              .from('users')
              .insert([newProfile])

            if (insertError) {
              console.error('프로필 생성 오류:', insertError)
            } else {
              console.log('새 사용자 프로필 생성 완료:', newProfile.email)
            }
          }
        } catch (profileError) {
          console.error('프로필 처리 오류:', profileError)
          // 프로필 생성 실패해도 로그인은 진행
        }

        // 세션 설정 후 대시보드로 리다이렉트
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    } catch (error) {
      console.error('OAuth 콜백 처리 오류:', error)
      return NextResponse.redirect(`${origin}/login?error=callback_error&message=${encodeURIComponent('로그인 처리 중 오류가 발생했습니다.')}`)
    }
  }

  // 코드가 없거나 처리 실패 시 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=no_code&message=${encodeURIComponent('인증 코드가 없습니다.')}`)
}
