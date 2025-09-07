/**
 * AI Face Chat Lite - 인증 헬퍼 함수들
 * Task 3: Google OAuth Authentication with Supabase
 * 작성일: 2025-07-01
 * 수정일: 2025-07-02 - Multiple GoTrueClient 인스턴스 문제 해결
 */

import { createSupabaseClient } from '@/lib/supabase-client'
import { User, Session } from '@supabase/supabase-js'

// 글로벌 클라이언트 인스턴스 (싱글톤 보장)
let globalSupabaseClient: ReturnType<typeof createSupabaseClient> | null = null

/**
 * 글로벌 Supabase 클라이언트 인스턴스 가져오기 (싱글톤)
 */
const getSupabaseClient = () => {
  if (!globalSupabaseClient) {
    globalSupabaseClient = createSupabaseClient()
    console.log('Global Supabase client instance created')
  }
  return globalSupabaseClient
}

/**
 * 인증 상태 타입 정의
 */
export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
}

/**
 * 사용자 프로필 타입 정의
 */
export interface UserProfile {
  id: string
  email: string
  name: string | null
  profile_image_used: boolean
  daily_chat_count: number
  quota_reset_time: string | null
  created_at: string
  updated_at: string
}

/**
 * Google OAuth로 로그인
 */
export async function signInWithGoogle() {
  const supabase = getSupabaseClient()
  
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    })

    if (error) {
      console.error('Google 로그인 오류:', error)
      throw error
    }

    return { success: true, data }
  } catch (error) {
    console.error('signInWithGoogle 실패:', error)
    return { success: false, error }
  }
}

/**
 * 로그아웃
 */
export async function signOut() {
  const supabase = getSupabaseClient()
  
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('로그아웃 오류:', error)
      throw error
    }

    // 로컬 스토리지 클리어
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }

    return { success: true }
  } catch (error) {
    console.error('signOut 실패:', error)
    return { success: false, error }
  }
}

/**
 * 현재 세션 가져오기
 */
export async function getCurrentSession(): Promise<{ session: Session | null; user: User | null }> {
  const supabase = getSupabaseClient()
  
  try {
    console.log('getCurrentSession: 세션 조회 시작')
    
    // 타임아웃과 함께 세션 조회
    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
    )
    
    const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any
    
    if (error) {
      console.error('세션 조회 오류:', error)
      return { session: null, user: null }
    }

    console.log('getCurrentSession: 세션 조회 완료', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email
    })

    return { session, user: session?.user || null }
  } catch (error) {
    console.error('getCurrentSession 실패:', error)
    
    // 타임아웃이나 다른 오류 시 기본값 반환
    return { session: null, user: null }
  }
}

/**
 * 사용자 프로필 자동 생성 (첫 로그인 시)
 */
export async function createUserProfileIfNotExists(user: User): Promise<UserProfile | null> {
  const supabase = getSupabaseClient()
  
  try {
    // 기존 프로필 확인
    const { data: existingProfile, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = 데이터 없음 (정상)
      console.error('기존 프로필 조회 오류:', selectError)
      throw selectError
    }

    if (existingProfile) {
      console.log('기존 프로필 존재:', existingProfile.email)
      return existingProfile
    }

    // 새 프로필 생성 - 클라이언트에서는 일반 클라이언트만 사용
    const newProfile: Partial<UserProfile> = {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.user_metadata?.full_name || null,
      profile_image_used: false,
      daily_chat_count: 0,
      quota_reset_time: null
    }

    const { data: createdProfile, error: insertError } = await supabase
      .from('users')
      .insert([newProfile])
      .select()
      .single()

    if (insertError) {
      console.error('프로필 생성 오류:', insertError)
      
      // RLS 정책으로 인한 권한 오류인 경우, API 엔드포인트 사용
      if (insertError.code === '42501' || insertError.message.includes('policy')) {
        console.log('RLS 정책으로 인해 API 엔드포인트를 통해 프로필 생성 시도')
        try {
          const response = await fetch('/api/users/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProfile)
          })
          
          if (response.ok) {
            const apiCreatedProfile = await response.json()
            console.log('API를 통한 프로필 생성 완료:', apiCreatedProfile.email)
            return apiCreatedProfile
          }
        } catch (apiError) {
          console.error('API 프로필 생성 실패:', apiError)
        }
      }
      
      throw insertError
    }

    console.log('새 사용자 프로필 생성 완료:', createdProfile.email)
    return createdProfile
  } catch (error) {
    console.error('createUserProfileIfNotExists 실패:', error)
    return null
  }
}

/**
 * 사용자 프로필 업데이트
 */
export async function updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const supabase = getSupabaseClient()  // 클라이언트에서는 일반 클라이언트 사용
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('프로필 업데이트 오류:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('updateUserProfile 실패:', error)
    return null
  }
}

/**
 * 사용자 쿼터 정보 조회
 */
export async function getUserQuota(userId: string) {
  const supabase = getSupabaseClient()
  
  try {
    console.log('getUserQuota: 쿼터 정보 조회 시작 for userId:', userId)
    
    const { data, error } = await supabase
      .from('users')
      .select('profile_image_used, daily_chat_count, quota_reset_time')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('쿼터 조회 오류:', error)
      throw error
    }

    console.log('getUserQuota: 쿼터 원본 데이터:', data)

    // 쿼터 리셋 시간 확인
    const now = new Date()
    const resetTime = data.quota_reset_time ? new Date(data.quota_reset_time) : null
    const needsReset = resetTime && now > resetTime

    console.log('getUserQuota: 리셋 확인 - 현재시간:', now, '리셋시간:', resetTime, '리셋필요:', needsReset)

    if (needsReset) {
      // 쿼터 리셋 실행
      console.log('getUserQuota: 쿼터 리셋 실행')
      await resetDailyQuota(userId)
      return {
        profileImageUsed: data.profile_image_used,
        dailyChatCount: 0,
        quotaResetTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        chatQuotaRemaining: 10
      }
    }

    const result = {
      profileImageUsed: data.profile_image_used,
      dailyChatCount: data.daily_chat_count,
      quotaResetTime: data.quota_reset_time,
      chatQuotaRemaining: Math.max(0, 10 - data.daily_chat_count)
    }

    console.log('getUserQuota: 최종 결과:', result)
    return result
  } catch (error) {
    console.error('getUserQuota 실패:', error)
    return {
      profileImageUsed: false,
      dailyChatCount: 0,
      quotaResetTime: null,
      chatQuotaRemaining: 10
    }
  }
}

/**
 * 채팅 쿼터 사용
 */
export async function useChatQuota(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()  // 클라이언트에서는 일반 클라이언트 사용
  
  try {
    const { error } = await supabase.rpc('increment_daily_chat', {
      user_id: userId
    })

    if (error) {
      console.error('채팅 쿼터 사용 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('useChatQuota 실패:', error)
    return false
  }
}

/**
 * 프로필 이미지 쿼터 사용
 */
export async function useProfileImageQuota(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()  // 클라이언트에서는 일반 클라이언트 사용
  
  try {
    const { error } = await supabase
      .from('users')
      .update({ 
        profile_image_used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('프로필 이미지 쿼터 사용 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('useProfileImageQuota 실패:', error)
    return false
  }
}

/**
 * 일일 쿼터 리셋
 */
export async function resetDailyQuota(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient()  // 클라이언트에서는 일반 클라이언트 사용
  
  try {
    const { error } = await supabase.rpc('reset_daily_quota', {
      user_id: userId
    })

    if (error) {
      console.error('쿼터 리셋 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('resetDailyQuota 실패:', error)
    return false
  }
}

/**
 * 인증 상태 변경 리스너 설정
 */
export function onAuthStateChange(callback: (session: Session | null, user: User | null) => void) {
  const supabase = getSupabaseClient()
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      // 로그인 시 자동 프로필 생성
      if (event === 'SIGNED_IN' && session?.user) {
        await createUserProfileIfNotExists(session.user)
      }
      
      callback(session, session?.user || null)
    }
  )

  return subscription
}

/**
 * 보호된 라우트 접근 권한 확인
 */
export async function checkRouteAccess(requiredAuth: boolean = true): Promise<boolean> {
  const { user } = await getCurrentSession()
  
  if (requiredAuth && !user) {
    return false
  }
  
  if (!requiredAuth && user) {
    return false
  }
  
  return true
}

/**
 * 세션 지속성 확인 및 복구
 */
export async function ensureSessionPersistence(): Promise<{ session: Session | null; user: User | null }> {
  const supabase = getSupabaseClient()
  
  try {
    // 세션 새로고침 시도
    const { data: { session }, error } = await supabase.auth.refreshSession()
    
    if (error && error.message !== 'Auth session missing!') {
      console.error('세션 새로고침 오류:', error)
    }
    
    // 최종 세션 상태 반환
    const { data: { session: finalSession } } = await supabase.auth.getSession()
    
    return { session: finalSession, user: finalSession?.user || null }
  } catch (error) {
    console.error('ensureSessionPersistence 실패:', error)
    return { session: null, user: null }
  }
}
