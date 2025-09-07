import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Edge Runtime에서는 Node.js 모듈 사용 불가 - fileLogger import 제거

export async function middleware(req: NextRequest) {
  // 미들웨어 비활성화 - 클라이언트 사이드 라우팅만 사용
  // 무한 리다이렉트 문제 해결을 위해 임시적으로 비활성화
  
  console.log('Middleware: 통과 전용 -', req.nextUrl.pathname)
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 임시로 미들웨어 완전 비활성화 - API 간섭 문제 해결
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (OAuth callback)
     */
    // '/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}
