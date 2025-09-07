'use client'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * 환경변수 검증
 */
export const validateClientEnvironment = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return { supabaseUrl, supabaseAnonKey }
}

// 싱글톤 인스턴스 저장
let supabaseClientInstance: ReturnType<typeof createClient<Database>> | null = null

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 (싱글톤)
 */
export const createSupabaseClient = () => {
  // 서버 사이드에서는 새 인스턴스 생성
  if (typeof window === 'undefined') {
    const { supabaseUrl, supabaseAnonKey } = validateClientEnvironment()
    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storage: undefined
      }
    })
  }

  // 이미 인스턴스가 있으면 재사용 (클라이언트에서만)
  if (supabaseClientInstance) {
    return supabaseClientInstance
  }

  const { supabaseUrl, supabaseAnonKey } = validateClientEnvironment()
  
  supabaseClientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: window.localStorage
    }
  })

  console.log('Created new Supabase client instance')
  return supabaseClientInstance
}

// 서비스 클라이언트 싱글톤 인스턴스 저장
let supabaseServiceClientInstance: ReturnType<typeof createClient<Database>> | null = null

/**
 * 서비스 역할 클라이언트 (관리자 작업용 - 클라이언트에서 사용 시) - 싱글톤
 * 주의: 클라이언트에서 서비스 키 사용은 보안상 권장하지 않음
 */
export const createSupabaseServiceClient = () => {
  // 이미 인스턴스가 있으면 재사용
  if (supabaseServiceClientInstance) {
    return supabaseServiceClientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service environment variables')
  }
  
  supabaseServiceClientInstance = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return supabaseServiceClientInstance
}

/**
 * 클라이언트 인스턴스 정리 (개발용 - 필요시 인스턴스 초기화)
 */
export const resetSupabaseClients = () => {
  supabaseClientInstance = null
  supabaseServiceClientInstance = null
  console.log('Supabase client instances reset')
}
