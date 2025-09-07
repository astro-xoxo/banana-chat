// 실시간 24시간 충전 타이머 Hook
// 쿼터별 충전 시간 실시간 표시

import { useState, useEffect } from 'react'

interface QuotaTimerInfo {
  isActive: boolean
  hoursRemaining: number
  minutesRemaining: number
  formattedTime: string
}

/**
 * 실시간 쿼터 타이머 Hook
 * 
 * 기능:
 * - 24시간 충전 타이머 실시간 업데이트
 * - 시간/분 단위 표시
 * - 자동 완료 감지
 */
export const useQuotaTimer = (nextResetAt: Date | null): QuotaTimerInfo => {
  const [timerInfo, setTimerInfo] = useState<QuotaTimerInfo>({
    isActive: false,
    hoursRemaining: 0,
    minutesRemaining: 0,
    formattedTime: ''
  })

  useEffect(() => {
    if (!nextResetAt) {
      setTimerInfo({
        isActive: false,
        hoursRemaining: 0,
        minutesRemaining: 0,
        formattedTime: ''
      })
      return
    }

    const updateTimer = () => {
      const now = new Date()
      const resetTime = new Date(nextResetAt)
      const timeDiff = resetTime.getTime() - now.getTime()

      if (timeDiff <= 0) {
        // 충전 완료
        setTimerInfo({
          isActive: false,
          hoursRemaining: 0,
          minutesRemaining: 0,
          formattedTime: '충전 완료'
        })
        return
      }

      // 남은 시간 계산
      const hours = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      
      // 표시 형식 결정
      const formattedTime = hours > 0 
        ? `${hours}시간 ${minutes}분`
        : minutes > 0
          ? `${minutes}분`
          : '1분 미만'

      setTimerInfo({
        isActive: true,
        hoursRemaining: hours,
        minutesRemaining: minutes,
        formattedTime
      })
    }

    // 즉시 업데이트
    updateTimer()
    
    // 1분마다 업데이트
    const interval = setInterval(updateTimer, 60000)
    
    return () => clearInterval(interval)
  }, [nextResetAt])

  return timerInfo
}
