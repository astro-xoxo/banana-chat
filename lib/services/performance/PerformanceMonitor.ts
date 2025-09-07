/**
 * Performance Monitor
 * Task 013: Performance Optimization - Monitoring System
 * 
 * Features:
 * - Real-time performance metrics collection
 * - Response time tracking (average, P95, P99)
 * - Throughput metrics (requests per minute, concurrent requests)
 * - Success rate monitoring (success rate, error rate, timeout rate)
 * - Cache performance metrics
 * - System resource monitoring
 */

interface PerformanceMetrics {
  requestId: string;
  correlationId?: string;
  userId?: string;
  operation: 'image_generation' | 'cache_lookup' | 'queue_processing';
  
  // Timing metrics
  startTime: number;
  endTime: number;
  totalTime: number;
  networkLatency?: number;
  serverProcessingTime?: number;
  queueWaitTime?: number;
  cacheAccessTime?: number;
  
  // Status metrics
  success: boolean;
  retryCount: number;
  error?: string;
  statusCode?: number;
  
  // Resource metrics
  memoryUsage?: number;
  cpuUsage?: number;
  
  // Cache metrics
  cacheHit: boolean;
  cacheKey?: string;
  
  // Queue metrics
  queueLength?: number;
  priority?: string;
  
  // Custom metadata
  metadata?: Record<string, any>;
  
  timestamp: Date;
}

interface AggregatedMetrics {
  timeWindow: {
    start: Date;
    end: Date;
    durationMinutes: number;
  };
  
  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  errorRate: number;
  timeoutRate: number;
  
  // Timing metrics
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  
  // Throughput metrics
  requestsPerMinute: number;
  requestsPerSecond: number;
  peakConcurrentRequests: number;
  averageConcurrentRequests: number;
  
  // Cache metrics
  cacheHitRate: number;
  cacheAccessCount: number;
  averageCacheAccessTime: number;
  
  // Queue metrics
  averageQueueLength: number;
  maxQueueLength: number;
  averageQueueWaitTime: number;
  
  // Error breakdown
  errorBreakdown: Record<string, number>;
  timeoutCount: number;
  retryCount: number;
  
  // Resource metrics
  averageMemoryUsage?: number;
  peakMemoryUsage?: number;
  averageCpuUsage?: number;
  peakCpuUsage?: number;
}

interface PerformanceAlert {
  id: string;
  type: 'response_time' | 'error_rate' | 'timeout_rate' | 'queue_length' | 'resource_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Performance Data Store
 * Handles storage and retrieval of performance metrics
 */
class PerformanceDataStore {
  private rawMetrics: PerformanceMetrics[] = [];
  private aggregatedData: Map<string, AggregatedMetrics> = new Map();
  private readonly maxRawMetrics = 10000; // 최대 10,000개 원시 메트릭 보관
  private readonly aggregationInterval = 5 * 60 * 1000; // 5분 간격으로 집계

  /**
   * 원시 메트릭 저장
   */
  storeMetric(metric: PerformanceMetrics): void {
    this.rawMetrics.push(metric);
    
    // 메모리 관리: 오래된 메트릭 제거
    if (this.rawMetrics.length > this.maxRawMetrics) {
      this.rawMetrics = this.rawMetrics.slice(-this.maxRawMetrics);
    }
    
    console.log(`📊 Metric stored: ${metric.operation} (${metric.totalTime}ms, success: ${metric.success})`);
  }

  /**
   * 시간 범위별 원시 메트릭 조회
   */
  getMetricsInTimeRange(start: Date, end: Date): PerformanceMetrics[] {
    return this.rawMetrics.filter(metric => 
      metric.timestamp >= start && metric.timestamp <= end
    );
  }

  /**
   * 집계 데이터 저장
   */
  storeAggregatedData(key: string, data: AggregatedMetrics): void {
    this.aggregatedData.set(key, data);
    console.log(`📈 Aggregated data stored for: ${key}`);
  }

  /**
   * 집계 데이터 조회
   */
  getAggregatedData(key: string): AggregatedMetrics | null {
    return this.aggregatedData.get(key) || null;
  }

  /**
   * 최근 메트릭 조회 (개수 제한)
   */
  getRecentMetrics(count: number = 100): PerformanceMetrics[] {
    return this.rawMetrics.slice(-count);
  }

  /**
   * 작업별 메트릭 조회
   */
  getMetricsByOperation(operation: string, limit: number = 1000): PerformanceMetrics[] {
    return this.rawMetrics
      .filter(metric => metric.operation === operation)
      .slice(-limit);
  }

  /**
   * 사용자별 메트릭 조회
   */
  getMetricsByUser(userId: string, limit: number = 1000): PerformanceMetrics[] {
    return this.rawMetrics
      .filter(metric => metric.userId === userId)
      .slice(-limit);
  }

  /**
   * 데이터 정리
   */
  cleanup(olderThanMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    this.rawMetrics = this.rawMetrics.filter(metric => 
      metric.timestamp > cutoffTime
    );
    
    // 집계 데이터도 정리 (24시간 이상 된 것)
    const aggregationCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [key, data] of this.aggregatedData) {
      if (data.timeWindow.end < aggregationCutoff) {
        this.aggregatedData.delete(key);
      }
    }
    
    console.log(`🧹 Performance data cleanup completed`);
  }
}

/**
 * Metrics Aggregator
 * Processes raw metrics into aggregated statistics
 */
class MetricsAggregator {
  /**
   * 시간 범위별 메트릭 집계
   */
  aggregateMetrics(metrics: PerformanceMetrics[], timeWindow: { start: Date; end: Date }): AggregatedMetrics {
    if (metrics.length === 0) {
      return this.getEmptyAggregatedMetrics(timeWindow);
    }

    const durationMinutes = (timeWindow.end.getTime() - timeWindow.start.getTime()) / (1000 * 60);
    
    // 기본 통계
    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter(m => m.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const errorRate = 1 - successRate;
    
    // 타임아웃 메트릭
    const timeoutRequests = metrics.filter(m => 
      m.error && m.error.toLowerCase().includes('timeout')
    ).length;
    const timeoutRate = totalRequests > 0 ? timeoutRequests / totalRequests : 0;
    
    // 응답 시간 통계
    const responseTimes = metrics.map(m => m.totalTime).sort((a, b) => a - b);
    const responseTimeStats = this.calculateTimeStatistics(responseTimes);
    
    // 처리량 메트릭
    const requestsPerMinute = durationMinutes > 0 ? totalRequests / durationMinutes : 0;
    const requestsPerSecond = requestsPerMinute / 60;
    
    // 동시 요청 메트릭 (근사치)
    const concurrentRequests = this.estimateConcurrentRequests(metrics);
    
    // 캐시 메트릭
    const cacheMetrics = this.calculateCacheMetrics(metrics);
    
    // 큐 메트릭
    const queueMetrics = this.calculateQueueMetrics(metrics);
    
    // 오류 분석
    const errorBreakdown = this.analyzeErrors(metrics);
    
    // 재시도 통계
    const retryCount = metrics.reduce((sum, m) => sum + m.retryCount, 0);
    
    return {
      timeWindow: {
        start: timeWindow.start,
        end: timeWindow.end,
        durationMinutes
      },
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      errorRate,
      timeoutRate,
      averageResponseTime: responseTimeStats.average,
      medianResponseTime: responseTimeStats.median,
      p95ResponseTime: responseTimeStats.p95,
      p99ResponseTime: responseTimeStats.p99,
      minResponseTime: responseTimeStats.min,
      maxResponseTime: responseTimeStats.max,
      requestsPerMinute,
      requestsPerSecond,
      peakConcurrentRequests: concurrentRequests.peak,
      averageConcurrentRequests: concurrentRequests.average,
      cacheHitRate: cacheMetrics.hitRate,
      cacheAccessCount: cacheMetrics.accessCount,
      averageCacheAccessTime: cacheMetrics.averageAccessTime,
      averageQueueLength: queueMetrics.averageLength,
      maxQueueLength: queueMetrics.maxLength,
      averageQueueWaitTime: queueMetrics.averageWaitTime,
      errorBreakdown,
      timeoutCount: timeoutRequests,
      retryCount
    };
  }

  /**
   * 시간 통계 계산
   */
  private calculateTimeStatistics(values: number[]) {
    if (values.length === 0) {
      return { average: 0, median: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const median = values[Math.floor(values.length / 2)];
    const p95 = values[Math.floor(values.length * 0.95)];
    const p99 = values[Math.floor(values.length * 0.99)];
    const min = values[0];
    const max = values[values.length - 1];

    return { average, median, p95, p99, min, max };
  }

  /**
   * 동시 요청 수 추정
   */
  private estimateConcurrentRequests(metrics: PerformanceMetrics[]) {
    // 시간별 활성 요청 수 계산
    const timeSlots: Map<number, number> = new Map();
    
    for (const metric of metrics) {
      const startSlot = Math.floor(metric.startTime / 1000); // 초 단위
      const endSlot = Math.floor((metric.startTime + metric.totalTime) / 1000);
      
      for (let slot = startSlot; slot <= endSlot; slot++) {
        timeSlots.set(slot, (timeSlots.get(slot) || 0) + 1);
      }
    }
    
    const concurrentCounts = Array.from(timeSlots.values());
    const peak = Math.max(...concurrentCounts, 0);
    const average = concurrentCounts.length > 0 
      ? concurrentCounts.reduce((a, b) => a + b, 0) / concurrentCounts.length 
      : 0;
    
    return { peak, average };
  }

  /**
   * 캐시 메트릭 계산
   */
  private calculateCacheMetrics(metrics: PerformanceMetrics[]) {
    const cacheAccessCount = metrics.filter(m => m.cacheAccessTime !== undefined).length;
    const cacheHits = metrics.filter(m => m.cacheHit).length;
    const hitRate = cacheAccessCount > 0 ? cacheHits / cacheAccessCount : 0;
    
    const cacheAccessTimes = metrics
      .filter(m => m.cacheAccessTime !== undefined)
      .map(m => m.cacheAccessTime!);
    
    const averageAccessTime = cacheAccessTimes.length > 0
      ? cacheAccessTimes.reduce((a, b) => a + b, 0) / cacheAccessTimes.length
      : 0;
    
    return { hitRate, accessCount: cacheAccessCount, averageAccessTime };
  }

  /**
   * 큐 메트릭 계산
   */
  private calculateQueueMetrics(metrics: PerformanceMetrics[]) {
    const queueLengths = metrics
      .filter(m => m.queueLength !== undefined)
      .map(m => m.queueLength!);
    
    const averageLength = queueLengths.length > 0
      ? queueLengths.reduce((a, b) => a + b, 0) / queueLengths.length
      : 0;
    
    const maxLength = Math.max(...queueLengths, 0);
    
    const queueWaitTimes = metrics
      .filter(m => m.queueWaitTime !== undefined)
      .map(m => m.queueWaitTime!);
    
    const averageWaitTime = queueWaitTimes.length > 0
      ? queueWaitTimes.reduce((a, b) => a + b, 0) / queueWaitTimes.length
      : 0;
    
    return { averageLength, maxLength, averageWaitTime };
  }

  /**
   * 오류 분석
   */
  private analyzeErrors(metrics: PerformanceMetrics[]): Record<string, number> {
    const errorBreakdown: Record<string, number> = {};
    
    for (const metric of metrics) {
      if (!metric.success && metric.error) {
        const errorType = this.categorizeError(metric.error);
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      }
    }
    
    return errorBreakdown;
  }

  /**
   * 오류 카테고리화
   */
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout')) return 'timeout';
    if (errorLower.includes('network') || errorLower.includes('connection')) return 'network';
    if (errorLower.includes('5')) return 'server_error'; // 5xx errors
    if (errorLower.includes('4')) return 'client_error'; // 4xx errors
    if (errorLower.includes('quota') || errorLower.includes('limit')) return 'quota_exceeded';
    if (errorLower.includes('auth')) return 'authentication';
    
    return 'other';
  }

  /**
   * 빈 집계 메트릭 생성
   */
  private getEmptyAggregatedMetrics(timeWindow: { start: Date; end: Date }): AggregatedMetrics {
    const durationMinutes = (timeWindow.end.getTime() - timeWindow.start.getTime()) / (1000 * 60);
    
    return {
      timeWindow: {
        start: timeWindow.start,
        end: timeWindow.end,
        durationMinutes
      },
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      errorRate: 0,
      timeoutRate: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      requestsPerMinute: 0,
      requestsPerSecond: 0,
      peakConcurrentRequests: 0,
      averageConcurrentRequests: 0,
      cacheHitRate: 0,
      cacheAccessCount: 0,
      averageCacheAccessTime: 0,
      averageQueueLength: 0,
      maxQueueLength: 0,
      averageQueueWaitTime: 0,
      errorBreakdown: {},
      timeoutCount: 0,
      retryCount: 0
    };
  }
}

/**
 * Alert Manager
 * Manages performance alerts and notifications
 */
class PerformanceAlertManager {
  private alerts: Map<string, PerformanceAlert> = new Map();
  private alertThresholds = {
    responseTime: 120000, // 2분
    errorRate: 0.1,       // 10%
    timeoutRate: 0.05,    // 5%
    queueLength: 50,      // 50개
    cacheHitRate: 0.05    // 5% 미만
  };

  /**
   * 메트릭 기반 알림 확인
   */
  checkAlerts(metrics: AggregatedMetrics): PerformanceAlert[] {
    const triggeredAlerts: PerformanceAlert[] = [];
    
    // 응답 시간 알림
    if (metrics.averageResponseTime > this.alertThresholds.responseTime) {
      const alert = this.createAlert(
        'response_time',
        'high',
        `Average response time (${(metrics.averageResponseTime / 1000).toFixed(1)}s) exceeds threshold`,
        this.alertThresholds.responseTime,
        metrics.averageResponseTime
      );
      triggeredAlerts.push(alert);
    }

    // 오류율 알림
    if (metrics.errorRate > this.alertThresholds.errorRate) {
      const alert = this.createAlert(
        'error_rate',
        'high',
        `Error rate (${(metrics.errorRate * 100).toFixed(1)}%) exceeds threshold`,
        this.alertThresholds.errorRate,
        metrics.errorRate
      );
      triggeredAlerts.push(alert);
    }

    // 타임아웃율 알림
    if (metrics.timeoutRate > this.alertThresholds.timeoutRate) {
      const alert = this.createAlert(
        'timeout_rate',
        'medium',
        `Timeout rate (${(metrics.timeoutRate * 100).toFixed(1)}%) exceeds threshold`,
        this.alertThresholds.timeoutRate,
        metrics.timeoutRate
      );
      triggeredAlerts.push(alert);
    }

    // 큐 길이 알림
    if (metrics.averageQueueLength > this.alertThresholds.queueLength) {
      const alert = this.createAlert(
        'queue_length',
        'medium',
        `Queue length (${metrics.averageQueueLength.toFixed(0)}) exceeds threshold`,
        this.alertThresholds.queueLength,
        metrics.averageQueueLength
      );
      triggeredAlerts.push(alert);
    }

    // 캐시 히트율 낮음 알림
    if (metrics.cacheAccessCount > 10 && metrics.cacheHitRate < this.alertThresholds.cacheHitRate) {
      const alert = this.createAlert(
        'cache_hit_rate',
        'low',
        `Cache hit rate (${(metrics.cacheHitRate * 100).toFixed(1)}%) is below threshold`,
        this.alertThresholds.cacheHitRate,
        metrics.cacheHitRate
      );
      triggeredAlerts.push(alert);
    }

    // 새로운 알림 저장
    for (const alert of triggeredAlerts) {
      this.alerts.set(alert.id, alert);
    }

    return triggeredAlerts;
  }

  /**
   * 알림 생성
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    threshold: number,
    currentValue: number
  ): PerformanceAlert {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    return {
      id,
      type,
      severity,
      message,
      threshold,
      currentValue,
      triggeredAt: new Date()
    };
  }

  /**
   * 활성 알림 조회
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolvedAt);
  }

  /**
   * 알림 해결 처리
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      console.log(`✅ Alert resolved: ${alertId}`);
    }
  }

  /**
   * 임계값 업데이트
   */
  updateThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    console.log('📊 Alert thresholds updated:', this.alertThresholds);
  }
}

/**
 * Performance Monitor
 * Main class for performance monitoring and metrics collection
 */
export class PerformanceMonitor {
  private readonly dataStore: PerformanceDataStore;
  private readonly aggregator: MetricsAggregator;
  private readonly alertManager: PerformanceAlertManager;
  private aggregationTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataStore = new PerformanceDataStore();
    this.aggregator = new MetricsAggregator();
    this.alertManager = new PerformanceAlertManager();
    
    this.startPeriodicAggregation();
    this.startPeriodicCleanup();
    
    console.log('📊 PerformanceMonitor initialized');
  }

  /**
   * 성능 메트릭 기록
   */
  recordMetric(
    operation: 'image_generation' | 'cache_lookup' | 'queue_processing',
    startTime: number,
    endTime: number,
    options: {
      requestId: string;
      correlationId?: string;
      userId?: string;
      success: boolean;
      retryCount?: number;
      error?: string;
      statusCode?: number;
      networkLatency?: number;
      serverProcessingTime?: number;
      queueWaitTime?: number;
      cacheAccessTime?: number;
      cacheHit?: boolean;
      cacheKey?: string;
      queueLength?: number;
      priority?: string;
      memoryUsage?: number;
      cpuUsage?: number;
      metadata?: Record<string, any>;
    }
  ): void {
    const metric: PerformanceMetrics = {
      requestId: options.requestId,
      correlationId: options.correlationId,
      userId: options.userId,
      operation,
      startTime,
      endTime,
      totalTime: endTime - startTime,
      networkLatency: options.networkLatency,
      serverProcessingTime: options.serverProcessingTime,
      queueWaitTime: options.queueWaitTime,
      cacheAccessTime: options.cacheAccessTime,
      success: options.success,
      retryCount: options.retryCount || 0,
      error: options.error,
      statusCode: options.statusCode,
      memoryUsage: options.memoryUsage,
      cpuUsage: options.cpuUsage,
      cacheHit: options.cacheHit || false,
      cacheKey: options.cacheKey,
      queueLength: options.queueLength,
      priority: options.priority,
      metadata: options.metadata,
      timestamp: new Date()
    };

    this.dataStore.storeMetric(metric);
  }

  /**
   * 실시간 메트릭 조회
   */
  getRealTimeMetrics(): {
    last5Minutes: AggregatedMetrics;
    last15Minutes: AggregatedMetrics;
    lastHour: AggregatedMetrics;
  } {
    const now = new Date();
    const last5Min = new Date(now.getTime() - 5 * 60 * 1000);
    const last15Min = new Date(now.getTime() - 15 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const metrics5Min = this.dataStore.getMetricsInTimeRange(last5Min, now);
    const metrics15Min = this.dataStore.getMetricsInTimeRange(last15Min, now);
    const metricsHour = this.dataStore.getMetricsInTimeRange(lastHour, now);

    return {
      last5Minutes: this.aggregator.aggregateMetrics(metrics5Min, { start: last5Min, end: now }),
      last15Minutes: this.aggregator.aggregateMetrics(metrics15Min, { start: last15Min, end: now }),
      lastHour: this.aggregator.aggregateMetrics(metricsHour, { start: lastHour, end: now })
    };
  }

  /**
   * 사용자별 메트릭 조회
   */
  getUserMetrics(userId: string, hours: number = 24): AggregatedMetrics {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const userMetrics = this.dataStore.getMetricsByUser(userId);
    const filteredMetrics = userMetrics.filter(m => m.timestamp >= start);
    
    return this.aggregator.aggregateMetrics(filteredMetrics, { start, end: now });
  }

  /**
   * 작업별 메트릭 조회
   */
  getOperationMetrics(operation: string, hours: number = 24): AggregatedMetrics {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
    const operationMetrics = this.dataStore.getMetricsByOperation(operation);
    const filteredMetrics = operationMetrics.filter(m => m.timestamp >= start);
    
    return this.aggregator.aggregateMetrics(filteredMetrics, { start, end: now });
  }

  /**
   * 성능 알림 조회
   */
  getPerformanceAlerts(): PerformanceAlert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * 알림 임계값 설정
   */
  setAlertThresholds(thresholds: {
    responseTime?: number;
    errorRate?: number;
    timeoutRate?: number;
    queueLength?: number;
    cacheHitRate?: number;
  }): void {
    this.alertManager.updateThresholds(thresholds);
  }

  /**
   * 시스템 상태 요약
   */
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    metrics: AggregatedMetrics;
    alerts: PerformanceAlert[];
  } {
    const realtimeMetrics = this.getRealTimeMetrics();
    const last15MinMetrics = realtimeMetrics.last15Minutes;
    const alerts = this.getPerformanceAlerts();
    
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const issues: string[] = [];
    
    // 상태 평가
    if (last15MinMetrics.errorRate > 0.2) {
      status = 'critical';
      issues.push(`High error rate: ${(last15MinMetrics.errorRate * 100).toFixed(1)}%`);
    } else if (last15MinMetrics.errorRate > 0.1) {
      status = 'degraded';
      issues.push(`Elevated error rate: ${(last15MinMetrics.errorRate * 100).toFixed(1)}%`);
    }
    
    if (last15MinMetrics.averageResponseTime > 180000) { // 3분
      status = 'critical';
      issues.push(`Very slow response time: ${(last15MinMetrics.averageResponseTime / 1000).toFixed(1)}s`);
    } else if (last15MinMetrics.averageResponseTime > 120000) { // 2분
      if (status !== 'critical') status = 'degraded';
      issues.push(`Slow response time: ${(last15MinMetrics.averageResponseTime / 1000).toFixed(1)}s`);
    }
    
    if (alerts.filter(a => a.severity === 'critical').length > 0) {
      status = 'critical';
    } else if (alerts.filter(a => a.severity === 'high').length > 0) {
      if (status !== 'critical') status = 'degraded';
    }
    
    return {
      status,
      issues,
      metrics: last15MinMetrics,
      alerts
    };
  }

  /**
   * 주기적 집계 시작
   */
  private startPeriodicAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.performAggregation();
    }, 5 * 60 * 1000); // 5분마다 실행
  }

  /**
   * 주기적 정리 시작
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.dataStore.cleanup(60); // 1시간 이상 된 데이터 정리
    }, 30 * 60 * 1000); // 30분마다 실행
  }

  /**
   * 집계 수행
   */
  private performAggregation(): void {
    try {
      const now = new Date();
      const last5Min = new Date(now.getTime() - 5 * 60 * 1000);
      
      const recentMetrics = this.dataStore.getMetricsInTimeRange(last5Min, now);
      const aggregated = this.aggregator.aggregateMetrics(recentMetrics, { start: last5Min, end: now });
      
      // 집계 데이터 저장
      const key = `aggregated_${Math.floor(now.getTime() / (5 * 60 * 1000))}`;
      this.dataStore.storeAggregatedData(key, aggregated);
      
      // 알림 확인
      const alerts = this.alertManager.checkAlerts(aggregated);
      if (alerts.length > 0) {
        console.warn(`⚠️ Performance alerts triggered:`, alerts.map(a => a.message));
      }
      
    } catch (error) {
      console.error('Error in periodic aggregation:', error);
    }
  }

  /**
   * 모니터링 중지
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    console.log('📊 PerformanceMonitor stopped');
  }
}

/**
 * Singleton instance management
 */
let globalPerformanceMonitor: PerformanceMonitor | null = null;

/**
 * Get or create global performance monitor instance
 */
export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}

/**
 * Helper function to record image generation metrics
 */
export function recordImageGenerationMetric(
  requestId: string,
  startTime: number,
  endTime: number,
  options: {
    userId?: string;
    success: boolean;
    error?: string;
    cacheHit?: boolean;
    retryCount?: number;
    networkLatency?: number;
    serverProcessingTime?: number;
    queueWaitTime?: number;
    metadata?: Record<string, any>;
  }
): void {
  const monitor = getPerformanceMonitor();
  monitor.recordMetric('image_generation', startTime, endTime, {
    requestId,
    ...options
  });
}

/**
 * Helper function to record cache lookup metrics
 */
export function recordCacheMetric(
  requestId: string,
  startTime: number,
  endTime: number,
  options: {
    cacheHit: boolean;
    cacheKey?: string;
    userId?: string;
  }
): void {
  const monitor = getPerformanceMonitor();
  monitor.recordMetric('cache_lookup', startTime, endTime, {
    requestId,
    success: true,
    ...options
  });
}

/**
 * Cleanup performance monitor
 */
export function cleanupPerformanceMonitor(): void {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.stop();
    globalPerformanceMonitor = null;
  }
}
