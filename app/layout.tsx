import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AnonymousProvider } from '@/components/auth/AnonymousProvider'
import { Toaster } from 'sonner'

// 터미널 로그 자동 저장 시스템 초기화
if (typeof window === 'undefined') {
  // 서버 사이드에서만 실행
  import('@/lib/fileLogger').then(({ fileLogger }) => {
    console.log('[FileLogger] 터미널 로그 자동 저장 시스템 활성화됨')
  }).catch(err => {
    console.error('[FileLogger] 초기화 실패:', err)
  })
}

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Banana Chat',
  description: 'AI 캐릭터와 자유롭게 채팅하고 이미지를 생성하는 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log('RootLayout 렌더링 시작')
  
  return (
    <html lang="ko" className="h-full">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="theme-color" content="#FFB805" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={`${inter.className} h-full overscroll-none`}>
        <div id="app-root" className="h-full relative">
          <AnonymousProvider>
            <main className="h-full">
              {children}
            </main>
          </AnonymousProvider>
          <Toaster 
            position="top-center"
            toastOptions={{
              className: 'bg-background border-border text-text-primary shadow-md',
              duration: 3000,
            }}
          />
        </div>
      </body>
    </html>
  )
}
