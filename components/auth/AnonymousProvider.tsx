/**
 * Banana Chat - 익명 사용자 세션 관리 프로바이더
 * 로그인 없이 브라우저 세션 기반으로 사용자 관리
 */

'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'

/**
 * 익명 사용자 세션 타입 정의
 */
interface AnonymousSession {
  sessionId: string        // UUID 기반 세션 ID
  createdAt: Date         // 세션 생성 시간
  lastActivity: Date      // 마지막 활동 시간
}

/**
 * 익명 인증 컨텍스트 타입 정의
 */
interface AnonymousContextType {
  session: AnonymousSession | null    // 현재 익명 세션
  isLoading: boolean                  // 초기화 로딩 상태
  isReady: boolean                   // 세션 사용 준비 완료
  refreshSession: () => void         // 세션 갱신
  clearSession: () => void          // 세션 초기화
}

// 기본값
const defaultContext: AnonymousContextType = {
  session: null,
  isLoading: true,
  isReady: false,
  refreshSession: () => {},
  clearSession: () => {}
}

const AnonymousContext = createContext<AnonymousContextType>(defaultContext)

// localStorage 키 상수
const SESSION_KEY = 'banana_chat_session'
const SESSION_DURATION = parseInt(process.env.NEXT_PUBLIC_ANONYMOUS_SESSION_DURATION || '86400000', 10) // 24시간

/**
 * 익명 사용자 세션 관리 프로바이더
 */
export function AnonymousProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AnonymousSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)

  /**
   * localStorage에서 세션 정보 로드
   */
  const loadSession = (): AnonymousSession | null => {
    if (typeof window === 'undefined') return null

    try {
      const storedSession = localStorage.getItem(SESSION_KEY)
      if (!storedSession) return null

      const parsed = JSON.parse(storedSession)
      const session: AnonymousSession = {
        sessionId: parsed.sessionId,
        createdAt: new Date(parsed.createdAt),
        lastActivity: new Date(parsed.lastActivity)
      }

      // 세션 만료 확인 (24시간)
      const now = new Date()
      const timeDiff = now.getTime() - session.lastActivity.getTime()
      
      if (timeDiff > SESSION_DURATION) {
        console.log('🕐 익명 세션 만료됨:', session.sessionId)
        localStorage.removeItem(SESSION_KEY)
        return null
      }

      console.log('✅ 기존 익명 세션 로드됨:', session.sessionId)
      return session
    } catch (error) {
      console.error('❌ 세션 로드 실패:', error)
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  }

  /**
   * 새 익명 세션 생성
   */
  const createSession = async (): Promise<AnonymousSession> => {
    const now = new Date()
    const newSession: AnonymousSession = {
      sessionId: uuidv4(),
      createdAt: now,
      lastActivity: now
    }

    console.log('🆕 새 익명 세션 생성:', newSession.sessionId)
    
    // localStorage에 저장
    saveSession(newSession)
    
    // DB에도 저장 시도 (실패해도 세션은 유지)
    const dbSaveResult = await saveSessionToDB(newSession)
    if (!dbSaveResult) {
      console.warn('⚠️ DB 저장 실패했지만 localStorage 세션으로 계속 진행:', newSession.sessionId)
    }
    
    return newSession
  }

  /**
   * 세션을 데이터베이스에 저장
   */
  const saveSessionToDB = async (sessionData: AnonymousSession): Promise<boolean> => {
    try {
      console.log('💾 세션 DB 저장 시작:', sessionData.sessionId)
      
      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionData.sessionId,
          created_at: sessionData.createdAt.toISOString(),
          last_activity: sessionData.lastActivity.toISOString()
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ 세션 DB 저장 성공:', result.session_id)
        return true
      } else {
        console.error('❌ 세션 DB 저장 실패:', result.error)
        return false
      }
    } catch (error) {
      console.error('❌ 세션 DB 저장 API 호출 실패:', error)
      return false
    }
  }

  /**
   * 세션 정보를 localStorage에 저장
   */
  const saveSession = (sessionData: AnonymousSession) => {
    if (typeof window === 'undefined') return

    try {
      const serialized = JSON.stringify({
        sessionId: sessionData.sessionId,
        createdAt: sessionData.createdAt.toISOString(),
        lastActivity: sessionData.lastActivity.toISOString()
      })
      
      localStorage.setItem(SESSION_KEY, serialized)
      console.log('💾 익명 세션 저장 완료:', sessionData.sessionId)
    } catch (error) {
      console.error('❌ 세션 저장 실패:', error)
    }
  }

  /**
   * 세션 활동 시간 갱신
   */
  const refreshSession = () => {
    if (!session) return

    const updatedSession: AnonymousSession = {
      ...session,
      lastActivity: new Date()
    }

    setSession(updatedSession)
    saveSession(updatedSession)
    console.log('🔄 세션 활동 시간 갱신:', session.sessionId)
  }

  /**
   * 세션 완전 초기화
   */
  const clearSession = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY)
    }
    setSession(null)
    setIsReady(false)
    console.log('🗑️ 익명 세션 초기화 완료')
  }

  /**
   * 컴포넌트 마운트 시 세션 초기화
   */
  useEffect(() => {
    const initializeSession = async () => {
      console.log('🔄 AnonymousProvider 초기화 시작')

      // 기존 세션 로드 시도
      let currentSession = loadSession()

      // 세션이 없으면 새로 생성
      if (!currentSession) {
        currentSession = await createSession()
      } else {
        // 기존 세션의 활동 시간 갱신
        currentSession.lastActivity = new Date()
        saveSession(currentSession)
        
        // 기존 세션도 DB에 저장 (DB에 없을 수 있으므로)
        await saveSessionToDB(currentSession)
      }

      setSession(currentSession)
      setIsReady(true)
      setIsLoading(false)

      console.log('✅ AnonymousProvider 초기화 완료:', currentSession.sessionId)
    }

    initializeSession().catch(error => {
      console.error('❌ AnonymousProvider 초기화 실패:', error)
      setIsLoading(false)
    })
  }, [])

  /**
   * 페이지 언로드 시 세션 정리
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session) {
        refreshSession()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session])

  /**
   * 주기적 세션 활동 갱신 (5분마다)
   */
  useEffect(() => {
    if (!session || !isReady) return

    const interval = setInterval(() => {
      refreshSession()
    }, 5 * 60 * 1000) // 5분

    return () => clearInterval(interval)
  }, [session, isReady])

  const value: AnonymousContextType = {
    session,
    isLoading,
    isReady,
    refreshSession,
    clearSession
  }

  return (
    <AnonymousContext.Provider value={value}>
      {children}
    </AnonymousContext.Provider>
  )
}

/**
 * 익명 세션 Hook
 */
export function useAnonymousSession() {
  const context = useContext(AnonymousContext)
  
  if (!context) {
    throw new Error('useAnonymousSession은 AnonymousProvider 내부에서 사용해야 합니다')
  }
  
  return context
}