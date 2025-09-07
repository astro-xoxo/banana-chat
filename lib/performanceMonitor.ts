/**
 * 성능 모니터링 유틸리티
 * 주요 작업의 성능 지표 수집 및 분석
 */

import { logInfo, logWarning, logError } from '@/lib/errorLogger'

export interface PerformanceMetric {
  operation: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
  context?: {
    user_id?: string
    chatbot_id?: string
    session_id?: string
    file_size?: number
    api_endpoint?: string
  }
  metadata?: Record<string, any>
}

export interface SystemHealth {
  timestamp: string
  memory_usage: number
  api_response_times: { [endpoint: string]: number[] }
  error_rates: { [category: string]: number }
  active_sessions: number
  database_performance: {
    avg_query_time: number
    slow_queries: number
    connection_pool: number
  }
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private activeOperations: Map<string, PerformanceMetric> = new Map()
  private completedOperations: PerformanceMetric[] = []
  private systemMetrics: SystemHealth[] = []
  private isEnabled: boolean = true

  // 성능 임계값 설정
  private readonly THRESHOLDS = {
    API_RESPONSE_TIME: 5000,      // 5초
    DATABASE_QUERY_TIME: 3000,   // 3초
    IMAGE_PROCESSING_TIME: 30000, // 30초
    MEMORY_USAGE_PERCENTAGE: 80,  // 80%
    ERROR_RATE_PERCENTAGE: 10     // 10%
  }

  private constructor() {
    // 브라우저 환경에서만 실행
    if (typeof window !== 'undefined') {
      // 주기적인 시스템 메트릭 수집 (5분마다)
      setInterval(() => this.collectSystemMetrics(), 5 * 60 * 1000)
      
      // 페이지 언로드 시 메트릭 저장
      window.addEventListener('beforeunload', () => this.saveMetrics())
    }
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * 작업 시작 추적
   */
  startOperation(
    operationId: string,
    operationName: string,
    context?: PerformanceMetric['context'],
    metadata?: Record<string, any>
  ): string {
    if (!this.isEnabled) return operationId

    const metric: PerformanceMetric = {
      operation: operationName,
      startTime: performance.now(),
      success: false,
      context,
      metadata
    }

    this.activeOperations.set(operationId, metric)

    logInfo('PERFORMANCE', `Operation started: ${operationName}`, {
      user_id: context?.user_id
    }, {
      operation_id: operationId,
      start_time: metric.startTime,
      ...metadata
    })

    return operationId
  }

  /**
   * 작업 완료 추적
   */
  endOperation(
    operationId: string,
    success: boolean = true,
    errorMessage?: string,
    additionalMetadata?: Record<string, any>
  ): PerformanceMetric | null {
    if (!this.isEnabled) return null

    const metric = this.activeOperations.get(operationId)
    if (!metric) {
      logWarning('PERFORMANCE', `Operation not found: ${operationId}`)
      return null
    }

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime
    metric.success = success

    // 메모리 사용량 측정 (브라우저 환경)
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      metric.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }

    // 추가 메타데이터 병합
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata }
    }

    // 완료된 작업에 추가
    this.completedOperations.push({ ...metric })
    this.activeOperations.delete(operationId)

    // 성능 이슈 감지 및 로깅
    this.checkPerformanceIssues(metric, errorMessage)

    // 작업 완료 로깅
    logInfo('PERFORMANCE', `Operation completed: ${metric.operation}`, {
      user_id: metric.context?.user_id
    }, {
      operation_id: operationId,
      duration_ms: metric.duration,
      success,
      memory_usage_mb: metric.memoryUsage ? Math.round(metric.memoryUsage.used / 1024 / 1024) : undefined,
      error_message: errorMessage,
      ...additionalMetadata
    })

    return metric
  }

  /**
   * Claude API 성능 모니터링
   */
  monitorClaudeAPI(
    operationId: string,
    messageLength: number,
    context?: { user_id?: string, chatbot_id?: string }
  ): string {
    return this.startOperation(
      operationId,
      'claude_api_call',
      context,
      {
        message_length: messageLength,
        api_provider: 'claude'
      }
    )
  }

  /**
   * 이미지 생성 성능 모니터링
   */
  monitorImageGeneration(
    operationId: string,
    imageSize: number,
    presetId: string,
    context?: { user_id?: string }
  ): string {
    return this.startOperation(
      operationId,
      'image_generation',
      context,
      {
        image_size_bytes: imageSize,
        preset_id: presetId,
        service: 'comfyui'
      }
    )
  }

  /**
   * 데이터베이스 쿼리 성능 모니터링
   */
  monitorDatabaseQuery(
    operationId: string,
    queryType: string,
    tableName: string,
    context?: { user_id?: string }
  ): string {
    return this.startOperation(
      operationId,
      'database_query',
      context,
      {
        query_type: queryType,
        table_name: tableName,
        database: 'supabase'
      }
    )
  }

  /**
   * 페이지 로딩 성능 모니터링
   */
  monitorPageLoad(
    operationId: string,
    pageName: string,
    context?: { user_id?: string }
  ): string {
    return this.startOperation(
      operationId,
      'page_load',
      context,
      {
        page_name: pageName,
        navigation_type: typeof window !== 'undefined' ? performance.navigation?.type : undefined
      }
    )
  }

  /**
   * 파일 업로드 성능 모니터링
   */
  monitorFileUpload(
    operationId: string,
    fileSize: number,
    fileType: string,
    context?: { user_id?: string }
  ): string {
    return this.startOperation(
      operationId,
      'file_upload',
      {
        ...context,
        file_size: fileSize
      },
      {
        file_size_mb: Math.round(fileSize / 1024 / 1024 * 100) / 100,
        file_type: fileType
      }
    )
  }

  /**
   * 성능 이슈 감지
   */
  private checkPerformanceIssues(metric: PerformanceMetric, errorMessage?: string): void {
    if (!metric.duration) return

    const operation = metric.operation
    let threshold = this.THRESHOLDS.API_RESPONSE_TIME

    // 작업별 임계값 설정
    switch (operation) {
      case 'claude_api_call':
        threshold = this.THRESHOLDS.API_RESPONSE_TIME
        break
      case 'database_query':
        threshold = this.THRESHOLDS.DATABASE_QUERY_TIME
        break
      case 'image_generation':
        threshold = this.THRESHOLDS.IMAGE_PROCESSING_TIME
        break
      case 'file_upload':
        threshold = this.THRESHOLDS.API_RESPONSE_TIME
        break
      case 'page_load':
        threshold = 3000 // 페이지 로드는 3초
        break
      default:
        threshold = this.THRESHOLDS.API_RESPONSE_TIME
    }

    // 느린 작업 감지
    if (metric.duration > threshold) {
      logWarning('PERFORMANCE', `Slow operation detected: ${operation}`, {
        user_id: metric.context?.user_id
      }, {
        operation,
        duration_ms: metric.duration,
        threshold_ms: threshold,
        slowness_factor: Math.round((metric.duration / threshold) * 100) / 100,
        context: metric.context
      })
    }

    // 메모리 사용량 이슈 감지
    if (metric.memoryUsage && metric.memoryUsage.percentage > this.THRESHOLDS.MEMORY_USAGE_PERCENTAGE) {
      logWarning('PERFORMANCE', `High memory usage detected: ${operation}`, {
        user_id: metric.context?.user_id
      }, {
        operation,
        memory_usage_percentage: metric.memoryUsage.percentage,
        memory_used_mb: Math.round(metric.memoryUsage.used / 1024 / 1024),
        threshold_percentage: this.THRESHOLDS.MEMORY_USAGE_PERCENTAGE
      })
    }

    // 실패한 작업 로깅
    if (!metric.success) {
      logError('PERFORMANCE', `Failed operation: ${operation}`, 
        errorMessage ? new Error(errorMessage) : undefined, 
        {
          user_id: metric.context?.user_id
        }
      )
    }
  }

  /**
   * 시스템 메트릭 수집
   */
  private collectSystemMetrics(): void {
    if (!this.isEnabled || typeof window === 'undefined') return

    try {
      const now = new Date().toISOString()
      let memoryUsage = 0

      // 메모리 사용량 수집
      if ('memory' in performance) {
        const memory = (performance as any).memory
        memoryUsage = memory.usedJSHeapSize
      }

      // API 응답 시간 통계 계산
      const apiResponseTimes: { [endpoint: string]: number[] } = {}
      const errorRates: { [category: string]: number } = {}

      // 최근 완료된 작업들 분석 (지난 5분간)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const recentOperations = this.completedOperations.filter(op => 
        op.endTime && op.endTime > fiveMinutesAgo
      )

      // API 응답 시간 집계
      recentOperations.forEach(op => {
        if (op.operation && op.duration) {
          if (!apiResponseTimes[op.operation]) {
            apiResponseTimes[op.operation] = []
          }
          apiResponseTimes[op.operation].push(op.duration)
        }

        // 에러율 계산
        const category = op.operation || 'unknown'
        if (!errorRates[category]) {
          errorRates[category] = 0
        }
        if (!op.success) {
          errorRates[category]++
        }
      })

      const systemHealth: SystemHealth = {
        timestamp: now,
        memory_usage: memoryUsage,
        api_response_times: apiResponseTimes,
        error_rates: errorRates,
        active_sessions: this.activeOperations.size,
        database_performance: {
          avg_query_time: this.calculateAverageQueryTime(recentOperations),
          slow_queries: this.countSlowQueries(recentOperations),
          connection_pool: 0 // 클라이언트에서는 측정 불가
        }
      }

      this.systemMetrics.push(systemHealth)

      // 시스템 메트릭 보관 개수 제한 (최근 24시간)
      if (this.systemMetrics.length > 288) { // 5분 * 288 = 24시간
        this.systemMetrics = this.systemMetrics.slice(-144) // 최근 12시간만 유지
      }

      // 시스템 상태 로깅
      logInfo('SYSTEM_HEALTH', 'System metrics collected', undefined, {
        memory_usage_mb: Math.round(memoryUsage / 1024 / 1024),
        active_operations: this.activeOperations.size,
        recent_operations_count: recentOperations.length,
        avg_api_response_time: this.calculateOverallAverageResponseTime(apiResponseTimes)
      })

    } catch (error) {
      logError('PERFORMANCE', 'Failed to collect system metrics', error as Error)
    }
  }

  /**
   * 평균 쿼리 시간 계산
   */
  private calculateAverageQueryTime(operations: PerformanceMetric[]): number {
    const dbQueries = operations.filter(op => op.operation === 'database_query' && op.duration)
    if (dbQueries.length === 0) return 0

    const totalTime = dbQueries.reduce((sum, op) => sum + (op.duration || 0), 0)
    return Math.round(totalTime / dbQueries.length)
  }

  /**
   * 느린 쿼리 개수 계산
   */
  private countSlowQueries(operations: PerformanceMetric[]): number {
    return operations.filter(op => 
      op.operation === 'database_query' && 
      op.duration && 
      op.duration > this.THRESHOLDS.DATABASE_QUERY_TIME
    ).length
  }

  /**
   * 전체 평균 응답 시간 계산
   */
  private calculateOverallAverageResponseTime(apiResponseTimes: { [endpoint: string]: number[] }): number {
    const allTimes = Object.values(apiResponseTimes).flat()
    if (allTimes.length === 0) return 0

    const totalTime = allTimes.reduce((sum, time) => sum + time, 0)
    return Math.round(totalTime / allTimes.length)
  }

  /**
   * 메트릭 저장 (로컬 스토리지 또는 서버)
   */
  private saveMetrics(): void {
    try {
      // 개발 환경에서는 콘솔에 요약 출력
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 성능 모니터링 요약:', {
          완료된_작업: this.completedOperations.length,
          활성_작업: this.activeOperations.size,
          시스템_메트릭: this.systemMetrics.length,
          느린_작업: this.completedOperations.filter(op => 
            op.duration && op.duration > this.THRESHOLDS.API_RESPONSE_TIME
          ).length
        })
      }

      // 실제 환경에서는 서버로 전송하거나 다른 저장소에 저장
      // await this.sendMetricsToServer()

    } catch (error) {
      console.error('메트릭 저장 실패:', error)
    }
  }

  /**
   * 성능 통계 조회
   */
  getPerformanceStats(): {
    totalOperations: number
    averageResponseTime: number
    successRate: number
    slowOperations: number
    memoryUsage?: number
    topSlowOperations: Array<{ operation: string, duration: number }>
  } {
    const completed = this.completedOperations
    const totalOperations = completed.length
    
    if (totalOperations === 0) {
      return {
        totalOperations: 0,
        averageResponseTime: 0,
        successRate: 100,
        slowOperations: 0,
        topSlowOperations: []
      }
    }

    const totalTime = completed.reduce((sum, op) => sum + (op.duration || 0), 0)
    const successfulOperations = completed.filter(op => op.success).length
    const slowOperations = completed.filter(op => 
      op.duration && op.duration > this.THRESHOLDS.API_RESPONSE_TIME
    ).length

    // 가장 느린 작업들 상위 5개
    const topSlowOperations = completed
      .filter(op => op.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5)
      .map(op => ({
        operation: op.operation,
        duration: op.duration || 0
      }))

    return {
      totalOperations,
      averageResponseTime: Math.round(totalTime / totalOperations),
      successRate: Math.round((successfulOperations / totalOperations) * 100),
      slowOperations,
      memoryUsage: this.systemMetrics.length > 0 ? 
        this.systemMetrics[this.systemMetrics.length - 1].memory_usage : undefined,
      topSlowOperations
    }
  }

  /**
   * 특정 작업 타입의 성능 통계
   */
  getOperationStats(operationType: string): {
    count: number
    averageTime: number
    successRate: number
    slowCount: number
  } {
    const operations = this.completedOperations.filter(op => op.operation === operationType)
    const count = operations.length

    if (count === 0) {
      return { count: 0, averageTime: 0, successRate: 100, slowCount: 0 }
    }

    const totalTime = operations.reduce((sum, op) => sum + (op.duration || 0), 0)
    const successfulCount = operations.filter(op => op.success).length
    const slowCount = operations.filter(op => 
      op.duration && op.duration > this.THRESHOLDS.API_RESPONSE_TIME
    ).length

    return {
      count,
      averageTime: Math.round(totalTime / count),
      successRate: Math.round((successfulCount / count) * 100),
      slowCount
    }
  }

  /**
   * 성능 모니터링 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  /**
   * 메트릭 초기화
   */
  reset(): void {
    this.activeOperations.clear()
    this.completedOperations = []
    this.systemMetrics = []
  }
}

// 싱글톤 인스턴스 내보내기
export const performanceMonitor = PerformanceMonitor.getInstance()

// 편의 함수들
export const startPerformanceTracking = (operationId: string, operationName: string, context?: any) =>
  performanceMonitor.startOperation(operationId, operationName, context)

export const endPerformanceTracking = (operationId: string, success: boolean = true, error?: string, metadata?: any) =>
  performanceMonitor.endOperation(operationId, success, error, metadata)

export const monitorClaudeAPI = (operationId: string, messageLength: number, context?: any) =>
  performanceMonitor.monitorClaudeAPI(operationId, messageLength, context)

export const monitorImageGeneration = (operationId: string, imageSize: number, presetId: string, context?: any) =>
  performanceMonitor.monitorImageGeneration(operationId, imageSize, presetId, context)

export const monitorDatabaseQuery = (operationId: string, queryType: string, tableName: string, context?: any) =>
  performanceMonitor.monitorDatabaseQuery(operationId, queryType, tableName, context)

export const monitorPageLoad = (operationId: string, pageName: string, context?: any) =>
  performanceMonitor.monitorPageLoad(operationId, pageName, context)

export const monitorFileUpload = (operationId: string, fileSize: number, fileType: string, context?: any) =>
  performanceMonitor.monitorFileUpload(operationId, fileSize, fileType, context)

// React Hook (클라이언트 사이드에서 사용)
export const usePerformanceMonitor = () => {
  return {
    startTracking: startPerformanceTracking,
    endTracking: endPerformanceTracking,
    monitorClaudeAPI,
    monitorImageGeneration,
    monitorDatabaseQuery,
    monitorPageLoad,
    monitorFileUpload,
    getStats: () => performanceMonitor.getPerformanceStats(),
    getOperationStats: (operationType: string) => performanceMonitor.getOperationStats(operationType)
  }
}

/**
 * 성능 메트릭 리포터 (개발자 도구용)
 */
export const reportPerformanceMetrics = () => {
  const stats = performanceMonitor.getPerformanceStats()
  
  console.group('🔍 성능 모니터링 리포트')
  console.log('📊 전체 통계:', stats)
  console.log('🐌 Claude API:', performanceMonitor.getOperationStats('claude_api_call'))
  console.log('🖼️  이미지 생성:', performanceMonitor.getOperationStats('image_generation'))
  console.log('🗄️  데이터베이스:', performanceMonitor.getOperationStats('database_query'))
  console.log('📄 페이지 로드:', performanceMonitor.getOperationStats('page_load'))
  console.groupEnd()
}

// 개발 환경에서 글로벌 함수로 등록
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).reportPerformanceMetrics = reportPerformanceMetrics
}
