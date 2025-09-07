/**
 * AI Face Chat Lite - Stage 3: 인증 시스템 안정화 AuthProvider
 * 작성일: 2025-07-16  
 * Stage 3 개선사항: 에러 복구 메커니즘, 재시도 로직, 토큰 갱신 처리
 */

'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createSupabaseClient } from '@/lib/supabase-client'
import { enableGlobalFetchInterceptor } from '@/lib/global-fetch-interceptor'

/**
 * Stage 3: 개선된 인증 컨텍스트 타입 정의
 */
interface AuthContextType {
  user: User | null           // Supabase User 객체 (있음/없음만)
  isLoading: boolean         // 로딩 상태 (최소한만)
  connectionError: string | null // 연결 오류 상태 (Stage 3 추가)
  retryCount: number         // 재시도 횟수 (Stage 3 추가)
  login: () => Promise<void> // Google OAuth 로그인
  logout: () => Promise<void>// 로그아웃
  retry: () => Promise<void> // 수동 재시도 (Stage 3 추가)
}

// 기본값
const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  connectionError: null,
  retryCount: 0,
  login: async () => {},
  logout: async () => {},
  retry: async () => {}
}

const AuthContext = createContext<AuthContextType>(defaultAuthContext)

/**
 * Stage 3: 에러 복구 메커니즘이 포함된 AuthProvider
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  // Supabase 클라이언트 (싱글톤)
  const supabase = createSupabaseClient()

  /**
   * Stage 3: 재시도 로직이 포함된 사용자 프로필 생성 함수
   */
  const createUserProfile = async (user: User, maxRetries: number = 3) => {
    // Task 5: 프로필 존재 여부 먼저 확인 (409 무한루프 방지)
    try {
      console.log(`🔍 Task 5: 프로필 존재 여부 확인:`, user.email)
      
      const checkResponse = await fetch(`/api/users/profile?id=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (checkResponse.ok) {
        const profileData = await checkResponse.json()
        console.log('✅ Task 5: 프로필이 이미 존재함, 생성 건너뜀:', user.email)
        setConnectionError(null)
        return true
      } else if (checkResponse.status === 404) {
        console.log('ℹ️ Task 5: 프로필이 존재하지 않음, 생성 진행:', user.email)
      } else {
        console.log('⚠️ Task 5: 프로필 존재 확인 실패, 생성 시도 계속:', checkResponse.status)
      }
    } catch (error) {
      console.log('⚠️ Task 5: 프로필 존재 확인 실패, 생성 시도 계속:', error)
    }
    
    let attempt = 0
    
    while (attempt < maxRetries) {
      try {
        console.log(`🔄 Stage 3: 사용자 프로필 생성 시도 ${attempt + 1}/${maxRetries}:`, user.email)
        
        const response = await fetch('/api/users/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown User'
          })
        })
        
        if (response.ok) {
          console.log('✅ Stage 3: 사용자 프로필 생성 성공:', user.email)
          setConnectionError(null) // 성공 시 에러 상태 클리어
          return true
        } else {
          const error = await response.json()
          console.warn(`⚠️ Stage 3: 프로필 생성 응답 오류 (시도 ${attempt + 1}):`, error)
          
          // 프로필이 이미 존재하는 경우는 성공으로 처리
          if (response.status === 409) {
            console.log('ℹ️ Stage 3: 프로필이 이미 존재함:', user.email)
            setConnectionError(null)
            return true
          }
          
          // 500번대 오류는 재시도, 400번대는 즉시 실패
          if (response.status >= 500 && attempt < maxRetries - 1) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000)
            console.log(`🔄 Stage 3: ${retryDelay}ms 후 프로필 생성 재시도...`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            attempt++
            continue
          }
          
          throw new Error(`프로필 생성 실패: ${response.status}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`❌ Stage 3: 프로필 생성 시도 ${attempt + 1} 실패:`, errorMessage)
        
        if (attempt < maxRetries - 1) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000)
          console.log(`🔄 Stage 3: ${retryDelay}ms 후 프로필 생성 재시도...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          attempt++
          continue
        }
        
        // 최종 실패
        setConnectionError(`프로필 생성 실패: ${errorMessage}`)
        return false
      }
    }
    
    return false
  }

  /**
   * Stage 3: 개선된 Google OAuth 로그인
   */
  const login = async () => {
    try {
      setIsLoading(true)
      setConnectionError(null)
      
      console.log('🔐 Stage 3: Google OAuth 로그인 시작')
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })
      
      if (error) {
        console.error('❌ Stage 3: Google 로그인 오류:', error)
        setConnectionError(`로그인 실패: ${error.message}`)
        throw error
      }
      
      console.log('✅ Stage 3: Google OAuth 로그인 요청 성공')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Stage 3: login 실패:', errorMessage)
      setConnectionError(`로그인 실패: ${errorMessage}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Stage 3: 개선된 로그아웃
   */
  const logout = async () => {
    try {
      setIsLoading(true)
      setConnectionError(null)
      
      console.log('🔐 Stage 3: 로그아웃 시작')
      
      // 1. Supabase 로그아웃
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Stage 3: 로그아웃 오류:', error)
        setConnectionError(`로그아웃 실패: ${error.message}`)
        throw error
      }
      
      // 2. Google OAuth 관련 localStorage 수동 정리
      try {
        const keysToRemove = [
          'sb-thnboxxfxahwkawzgcjj-auth-token',
          'supabase.auth.token',
          'google-oauth-token'
        ]
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key)
        })
        
        console.log('✅ Stage 3: OAuth 토큰 정리 완료:', keysToRemove)
      } catch (storageError) {
        console.warn('⚠️ Stage 3: localStorage 정리 실패:', storageError)
        // localStorage 정리 실패해도 로그아웃은 진행
      }
      
      setUser(null)
      console.log('✅ Stage 3: 로그아웃 성공')
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Stage 3: logout 실패:', errorMessage)
      setConnectionError(`로그아웃 실패: ${errorMessage}`)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Stage 3: 수동 재시도 함수
   */
  const retry = async () => {
    try {
      setIsLoading(true)
      setConnectionError(null)
      setRetryCount(prev => prev + 1)
      
      console.log(`🔄 Stage 3: 수동 재시도 ${retryCount + 1} 시작`)
      
      // 현재 세션 다시 확인
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        throw new Error(`세션 확인 실패: ${error.message}`)
      }
      
      if (session?.user) {
        console.log('✅ Stage 3: 재시도 - 세션 복구됨:', session.user.email)
        setUser(session.user)
        
        // 프로필 동기화 재시도
        await createUserProfile(session.user)
      } else {
        console.log('ℹ️ Stage 3: 재시도 - 세션 없음, 로그인 필요')
        setUser(null)
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ Stage 3: 재시도 실패:', errorMessage)
      setConnectionError(`재시도 실패: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Stage 3: 안정화된 인증 상태 초기화
   */
  useEffect(() => {
    console.log('🔄 Stage 3: AuthProvider 초기화 시작')
    
    // Task 2: Global Fetch Interceptor 활성화
    try {
      enableGlobalFetchInterceptor()
      console.log('✅ Task 2: Global Fetch Interceptor 활성화 완료')
    } catch (error) {
      console.error('❌ Task 2: Global Fetch Interceptor 활성화 실패:', error)
    }
    
    const initializeAuth = async () => {
      let attempt = 0
      const maxRetries = 3
      
      while (attempt < maxRetries) {
        try {
          console.log(`🔄 Stage 3: 인증 초기화 시도 ${attempt + 1}/${maxRetries}`)
          
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error) {
            throw new Error(`세션 가져오기 실패: ${error.message}`)
          }
          
          if (session?.user) {
            console.log('✅ Stage 3: 기존 세션 발견:', session.user.email)
            setUser(session.user)
            setConnectionError(null)
            
            // Task 5: 기존 세션에서는 프로필 동기화 건너뜀 (409 무한루프 방지)
            // 초기화 시에는 프로필이 이미 존재할 가능성이 높으므로 생성 시도하지 않음
            console.log('ℹ️ Task 5: 기존 세션 - 프로필 동기화 건너뜀 (409 방지)')
          } else {
            console.log('ℹ️ Stage 3: 기존 세션 없음')
            setUser(null)
            setConnectionError(null)
          }
          
          // 성공 시 루프 종료
          break
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`❌ Stage 3: 세션 초기화 시도 ${attempt + 1} 실패:`, errorMessage)
          
          if (attempt < maxRetries - 1) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000)
            console.log(`🔄 Stage 3: ${retryDelay}ms 후 초기화 재시도...`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            attempt++
            continue
          }
          
          // 최종 실패
          setUser(null)
          setConnectionError(`인증 시스템 연결 실패: ${errorMessage}`)
        }
      }
      
      setIsLoading(false)
    }

    initializeAuth()
  }, [supabase])

  /**
   * Stage 3: 안정화된 인증 상태 변경 리스너
   */
  useEffect(() => {
    console.log('🔄 Stage 3: 인증 상태 변경 리스너 설정')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Stage 3: 인증 상태 변경:', event, session?.user?.email)
        
        // Task 6: Google OAuth 세션 상세 분석
        if (session) {
          console.log('🔍 Task 6: 세션 정보 상세 분석:', {
            event,
            userEmail: session.user?.email,
            userId: session.user?.id,
            provider: session.user?.app_metadata?.provider,
            providerId: session.user?.app_metadata?.provider_id,
            accessToken: session.access_token ? 'present' : 'missing',
            refreshToken: session.refresh_token ? 'present' : 'missing',
            expiresAt: session.expires_at,
            tokenType: session.token_type
          })
          
          // Google OAuth 토큰 localStorage 강제 저장 (필요시)
          if (session.user?.app_metadata?.provider === 'google') {
            console.log('🔍 Task 6: Google OAuth 세션 감지, localStorage 동기화 시작')
            try {
              const authData = {
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at,
                token_type: session.token_type,
                user: session.user
              }
              
              // 다중 키로 저장 (호환성 보장)
              localStorage.setItem('sb-thnboxxfxahwkawzgcjj-auth-token', JSON.stringify(authData))
              localStorage.setItem('supabase.auth.token', JSON.stringify(authData))
              localStorage.setItem('google-oauth-token', session.access_token)
              
              console.log('✅ Task 6: Google OAuth 토큰 localStorage 저장 완료')
            } catch (error) {
              console.error('🚨 Task 6: Google OAuth 토큰 저장 실패:', error)
            }
          }
        } else {
          console.log('🔍 Task 6: 세션 없음 (로그아웃 또는 만료)')
        }
        
        try {
          if (session?.user) {
            setUser(session.user)
            setConnectionError(null)
            
            // 로그인 성공 시 자동으로 프로필 생성 시도
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              console.log('🔄 Stage 3: 프로필 동기화 시작')
              await createUserProfile(session.user)
            }
          } else {
            setUser(null)
            if (event === 'SIGNED_OUT') {
              setConnectionError(null) // 정상 로그아웃은 에러가 아님
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('❌ Stage 3: 인증 상태 변경 처리 중 오류:', errorMessage)
          setConnectionError(`인증 처리 오류: ${errorMessage}`)
        }
        
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // Stage 3: 개선된 Context value
  const value: AuthContextType = {
    user,
    isLoading,
    connectionError,
    retryCount,
    login,
    logout,
    retry
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Stage 3: 개선된 useAuth Hook
 */
export function useAuth() {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다')
  }
  
  return context
}