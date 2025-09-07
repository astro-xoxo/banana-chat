// 호환성 유지를 위한 재내보내기 파일
// 사용 컨텍스트에 따라 적절한 파일을 import하세요:
// - 클라이언트 컴포넌트: '@/lib/supabase-client'
// - 서버 컴포넌트: '@/lib/supabase-server'

export { 
  createSupabaseClient, 
  createSupabaseServiceClient as createSupabaseServiceClientFromClient,
  validateClientEnvironment 
} from './supabase-client'

export { 
  createSupabaseServerClient, 
  createSupabaseServiceClient,
  validateServerEnvironment 
} from './supabase-server'

// 기본 내보내기 (레거시 호환성)
export const validateEnvironment = validateServerEnvironment
