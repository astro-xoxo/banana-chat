import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🔍 환경 변수 디버그 시작')
  
  return NextResponse.json({
    success: true,
    environment: process.env.NODE_ENV,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasBananaChatKey: !!process.env.BANANA_CHAT_API_KEY,
    hasClaudeApiKey: !!process.env.CLAUDE_API_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // 보안상 키는 앞 10자리만 표시
    serviceRolePrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10),
    bananaChatPrefix: process.env.BANANA_CHAT_API_KEY?.substring(0, 10)
  })
}