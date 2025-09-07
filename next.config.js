/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'thnboxxfxahwkawzgcjj.supabase.co'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // admin 폴더를 빌드에서 제외 (개발 전용 페이지)
  experimental: {
    typedRoutes: false,
  },
  typescript: {
    // 빌드 시 타입 체크를 조건부로 제외
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
}

module.exports = nextConfig
