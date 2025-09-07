/**
 * Metrics Collector
 * Task 014: Monitoring and Logging Systems - Metrics Collection
 * 
 * Features:
 * - Usage metrics (daily/weekly/monthly generation counts, user statistics)
 * - Performance metrics (response times, throughput, cache hit rates)
 * - Quality metrics (success rates, error rates, retry rates)
 * - Business metrics (subscription conversion, user satisfaction, feature usage)
 * - Real-time metric aggregation and historical data storage
 */

interface UsageMetrics {
  // Generation metrics
  totalGenerations: number;
  uniqueUsers: number;
  averageGenerationsPerUser: number;
  peakUsageHour: string;
  
  // Quota metrics
  quotaUtilization: number;
  quotaExceededEvents: number;
  
  // Subscription breakdown
  subscriptionBreakdown: {
    free: { users: number; generations: number; quotaUtilization: number };
    premium: { users: number; generations: number; quotaUtilization: number };
  };
  
  // Time-based usage patterns
  hourlyUsagePattern: Record<string, number>; // hour -> count
  dailyUsagePattern: Record<string, number>;  // day -> count
  weeklyUsagePattern: Record<string, number>; // week -> count
  
  // Feature usage
  featureUsage: {
    presetUsage: Record<string, number>;        // preset_id -> count
    styleOverrides: number;
    customPrompts: number;
    cacheHits: number;
    backgroundProcessing: number;
  };
  
  // Geographic distribution (if available)
  geographicDistribution?: Record<string, number>; // country -> users
}

interface PerformanceMetrics {
  // Response time metrics
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  
  // Throughput metrics
  throughputPerMinute: number;
  throughputPerHour: number;
  peakThroughput: number;
  
  // Cache performance
  cacheHitRate: number;
  cacheAccessCount: number;
  averageCacheAccessTime: number;
  cacheEfficiencyScore: number;
  
  // Queue performance
  averageQueueLength: number;
  maxQueueLength: number;
  averageQueueWaitTime: number;
  queueProcessingRate: number;
  
  // Connection pool metrics
  averageConnectionUsage: number;
  peakConnectionUsage: number;
  connectionPoolEfficiency: number;
  
  // Retry and error handling
  averageRetryCount: number;
  retrySuccessRate: number;
  timeoutRate: number;
  
  // Resource utilization
  averageMemoryUsage?: number;
  peakMemoryUsage?: number;
  averageCpuUsage?: number;
  peakCpuUsage?: number;
}

interface QualityMetrics {
  // Success rates
  overallSuccessRate: number;
  successRateByPreset: Record<string, number>;
  successRateBySubscription: Record<string, number>;
  
  // Error analysis
  errorRate: number;
  errorBreakdown: Record<string, number>; // error_type -> count
  criticalErrors: number;
  
  // Performance quality
  responsesUnder30s: number;
  responsesUnder60s: number;
  responsesOver120s: number;
  
  // User experience quality
  retryRate: number;
  abandonmentRate: number;
  timeoutRate: number;
  
  // Service availability
  uptimePercentage: number;
  downtimeEvents: number;
  meanTimeBetweenFailures: number;
  meanTimeToRecovery: number;
}

interface BusinessMetrics {
  // User engagement
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  userRetentionRate: number;
  
  // Feature adoption
  featureAdoptionRate: Record<string, number>;
  advancedFeatureUsage: number;
  
  // Conversion metrics
  trialToSubscriptionConversion: number;
  freeToSubscriptionConversion: number;
  subscriptionUpgradeRate: number;
  subscriptionChurnRate: number;
  
  // Satisfaction metrics
  averageUserSatisfaction: number;
  netPromoterScore?: number;
  feedbackVolume: number;
  positiveRatingRate: number;
  
  // Revenue impact (if applicable)
  revenuePerUser?: number;
  lifetimeValue?: number;
  costPerGeneration?: number;
}

interface MetricDataPoint {
  timestamp: Date;
  metricType: 'usage' | 'performance' | 'quality' | 'business';
  metricName: string;
  value: number;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

/**
 * Time Window Manager
 * Manages different time windows for metric aggregation
 */
class TimeWindowManager {
  /**
   * 시간 범위 생성
   */
  getTimeWindow(window: 'last_hour' | 'last_24h' | 'last_7d' | 'last_30d' | 'custom', customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    
    switch (window) {
      case 'last_hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'last_24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last_7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!customStart || !customEnd) {
          throw new Error('Custom time window requires start and end dates');
        }
        start = customStart;
        return { start, end: customEnd };
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return { start, end: now };
  }

  /**
   * 시간 버킷으로 그룹화
   */
  groupByTimeBucket(dataPoints: { timestamp: Date; value: number }[], interval: 'minute' | 'hour' | 'day'): Record<string, number[]> {
    const groups: Record<string, number[]> = {};
    
    for (const point of dataPoints) {
      const bucketKey = this.getBucketKey(point.timestamp, interval);
      if (!groups[bucketKey]) {
        groups[bucketKey] = [];
      }
      groups[bucketKey].push(point.value);
    }
    
    return groups;
  }

  /**
   * 버킷 키 생성
   */
  private getBucketKey(date: Date, interval: 'minute' | 'hour' | 'day'): string {
    switch (interval) {
      case 'minute':
        return date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:mm
      case 'hour':
        return date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      case 'day':
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
    }
  }
}

/**
 * Metric Storage
 * Handles storage and retrieval of metric data points
 */
class MetricStorage {
  private dataPoints: MetricDataPoint[] = [];
  private readonly maxStorageSize = 100000; // 최대 10만개 데이터 포인트

  /**
   * 메트릭 데이터 포인트 저장
   */
  store(dataPoint: MetricDataPoint): void {
    this.dataPoints.push(dataPoint);
    
    // 메모리 관리
    if (this.dataPoints.length > this.maxStorageSize) {
      this.dataPoints = this.dataPoints.slice(-this.maxStorageSize);
    }
  }

  /**
   * 시간 범위별 데이터 조회
   */
  getDataPoints(
    metricType?: 'usage' | 'performance' | 'quality' | 'business',
    metricName?: string,
    start?: Date,
    end?: Date,
    tags?: Record<string, string>
  ): MetricDataPoint[] {
    return this.dataPoints.filter(point => {
      if (metricType && point.metricType !== metricType) return false;
      if (metricName && point.metricName !== metricName) return false;
      if (start && point.timestamp < start) return false;
      if (end && point.timestamp > end) return false;
      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          if (point.tags[key] !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * 메트릭별 최신 값 조회
   */
  getLatestValue(metricType: string, metricName: string, tags?: Record<string, string>): number | null {
    const points = this.getDataPoints(metricType as any, metricName, undefined, undefined, tags);
    if (points.length === 0) return null;
    
    const latest = points.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    return latest.value;
  }

  /**
   * 집계 함수
   */
  aggregate(
    dataPoints: MetricDataPoint[],
    aggregation: 'sum' | 'average' | 'min' | 'max' | 'count' | 'p95' | 'p99'
  ): number {
    if (dataPoints.length === 0) return 0;
    
    const values = dataPoints.map(p => p.value);
    
    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'average':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'p95':
        const sorted95 = values.sort((a, b) => a - b);
        return sorted95[Math.floor(sorted95.length * 0.95)];
      case 'p99':
        const sorted99 = values.sort((a, b) => a - b);
        return sorted99[Math.floor(sorted99.length * 0.99)];
      default:
        return 0;
    }
  }

  /**
   * 데이터 정리
   */
  cleanup(olderThanMinutes: number): void {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    this.dataPoints = this.dataPoints.filter(point => point.timestamp > cutoff);
  }
}

/**
 * Metrics Collector
 * Main class for collecting and aggregating various types of metrics
 */
export class MetricsCollector {
  private readonly storage: MetricStorage;
  private readonly timeWindowManager: TimeWindowManager;

  constructor() {
    this.storage = new MetricStorage();
    this.timeWindowManager = new TimeWindowManager();
  }

  /**
   * 사용량 메트릭 수집
   */
  async collectUsageMetrics(timeWindow: 'last_hour' | 'last_24h' | 'last_7d' | 'last_30d' = 'last_24h'): Promise<UsageMetrics> {
    const window = this.timeWindowManager.getTimeWindow(timeWindow);
    
    // 이미지 생성 메트릭
    const generationPoints = this.storage.getDataPoints('usage', 'image_generation', window.start, window.end);
    const totalGenerations = this.storage.aggregate(generationPoints, 'sum');
    
    // 고유 사용자 수 계산
    const uniqueUsers = new Set(generationPoints.map(p => p.tags.userId)).size;
    const averageGenerationsPerUser = uniqueUsers > 0 ? totalGenerations / uniqueUsers : 0;
    
    // 시간대별 사용 패턴
    const hourlyPattern = this.calculateHourlyUsagePattern(generationPoints);
    const peakUsageHour = this.findPeakUsageHour(hourlyPattern);
    
    // 구독 타입별 분석
    const subscriptionBreakdown = this.calculateSubscriptionBreakdown(generationPoints);
    
    // 쿼터 활용도
    const quotaPoints = this.storage.getDataPoints('usage', 'quota_utilization', window.start, window.end);
    const quotaUtilization = this.storage.aggregate(quotaPoints, 'average');
    
    // 쿼터 초과 이벤트
    const quotaExceededPoints = this.storage.getDataPoints('usage', 'quota_exceeded', window.start, window.end);
    const quotaExceededEvents = this.storage.aggregate(quotaExceededPoints, 'count');
    
    // 기능 사용량
    const featureUsage = this.calculateFeatureUsage(generationPoints);
    
    return {
      totalGenerations,
      uniqueUsers,
      averageGenerationsPerUser,
      peakUsageHour,
      quotaUtilization,
      quotaExceededEvents,
      subscriptionBreakdown,
      hourlyUsagePattern: hourlyPattern,
      dailyUsagePattern: this.calculateDailyUsagePattern(generationPoints),
      weeklyUsagePattern: this.calculateWeeklyUsagePattern(generationPoints),
      featureUsage
    };
  }

  /**
   * 성능 메트릭 수집
   */
  async collectPerformanceMetrics(timeWindow: 'last_hour' | 'last_24h' | 'last_7d' | 'last_30d' = 'last_24h'): Promise<PerformanceMetrics> {
    const window = this.timeWindowManager.getTimeWindow(timeWindow);
    
    // 응답 시간 메트릭
    const responseTimePoints = this.storage.getDataPoints('performance', 'response_time', window.start, window.end);
    
    return {
      averageResponseTime: this.storage.aggregate(responseTimePoints, 'average'),
      p50ResponseTime: this.calculatePercentile(responseTimePoints.map(p => p.value), 50),
      p95ResponseTime: this.storage.aggregate(responseTimePoints, 'p95'),
      p99ResponseTime: this.storage.aggregate(responseTimePoints, 'p99'),
      minResponseTime: this.storage.aggregate(responseTimePoints, 'min'),
      maxResponseTime: this.storage.aggregate(responseTimePoints, 'max'),
      
      // 처리량 메트릭
      throughputPerMinute: this.calculateThroughput(responseTimePoints, 'minute'),
      throughputPerHour: this.calculateThroughput(responseTimePoints, 'hour'),
      peakThroughput: this.calculatePeakThroughput(responseTimePoints),
      
      // 캐시 성능
      cacheHitRate: this.calculateCacheHitRate(window),
      cacheAccessCount: this.getCacheAccessCount(window),
      averageCacheAccessTime: this.getAverageCacheAccessTime(window),
      cacheEfficiencyScore: this.calculateCacheEfficiencyScore(window),
      
      // 큐 성능
      averageQueueLength: this.getAverageQueueLength(window),
      maxQueueLength: this.getMaxQueueLength(window),
      averageQueueWaitTime: this.getAverageQueueWaitTime(window),
      queueProcessingRate: this.calculateQueueProcessingRate(window),
      
      // 연결 풀 메트릭
      averageConnectionUsage: this.getAverageConnectionUsage(window),
      peakConnectionUsage: this.getPeakConnectionUsage(window),
      connectionPoolEfficiency: this.calculateConnectionPoolEfficiency(window),
      
      // 재시도 및 오류 처리
      averageRetryCount: this.getAverageRetryCount(window),
      retrySuccessRate: this.calculateRetrySuccessRate(window),
      timeoutRate: this.calculateTimeoutRate(window)
    };
  }

  /**
   * 메트릭 데이터 포인트 기록
   */
  recordMetric(
    metricType: 'usage' | 'performance' | 'quality' | 'business',
    metricName: string,
    value: number,
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    const dataPoint: MetricDataPoint = {
      timestamp: new Date(),
      metricType,
      metricName,
      value,
      tags,
      metadata
    };

    this.storage.store(dataPoint);
  }

  /**
   * 실시간 메트릭 조회
   */
  getRealTimeMetrics(): {
    current: {
      activeUsers: number;
      queueLength: number;
      responseTime: number;
      successRate: number;
      cacheHitRate: number;
    };
    trends: {
      responseTimeTrend: 'improving' | 'stable' | 'degrading';
      successRateTrend: 'improving' | 'stable' | 'degrading';
      usageTrend: 'increasing' | 'stable' | 'decreasing';
    };
  } {
    const now = new Date();
    const last5Min = new Date(now.getTime() - 5 * 60 * 1000);
    const last15Min = new Date(now.getTime() - 15 * 60 * 1000);

    // 현재 메트릭
    const current = {
      activeUsers: this.getActiveUsersInWindow(last5Min, now),
      queueLength: this.storage.getLatestValue('performance', 'queue_length') || 0,
      responseTime: this.storage.getLatestValue('performance', 'response_time') || 0,
      successRate: this.storage.getLatestValue('quality', 'success_rate') || 0,
      cacheHitRate: this.storage.getLatestValue('performance', 'cache_hit_rate') || 0
    };

    // 트렌드 분석
    const trends = {
      responseTimeTrend: this.calculateTrend('performance', 'response_time', last15Min, now),
      successRateTrend: this.calculateTrend('quality', 'success_rate', last15Min, now),
      usageTrend: this.calculateTrend('usage', 'image_generation', last15Min, now)
    };

    return { current, trends };
  }

  // Helper methods for calculations
  private calculateHourlyUsagePattern(points: MetricDataPoint[]): Record<string, number> {
    const pattern: Record<string, number> = {};
    for (let hour = 0; hour < 24; hour++) {
      pattern[hour.toString().padStart(2, '0')] = 0;
    }
    
    for (const point of points) {
      const hour = point.timestamp.getHours().toString().padStart(2, '0');
      pattern[hour] += point.value;
    }
    
    return pattern;
  }

  private findPeakUsageHour(hourlyPattern: Record<string, number>): string {
    let maxHour = '00';
    let maxCount = 0;
    
    for (const [hour, count] of Object.entries(hourlyPattern)) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    }
    
    return maxHour;
  }

  private calculateSubscriptionBreakdown(points: MetricDataPoint[]): UsageMetrics['subscriptionBreakdown'] {
    const freeUsers = new Set<string>();
    const premiumUsers = new Set<string>();
    let freeGenerations = 0;
    let premiumGenerations = 0;
    
    for (const point of points) {
      const subscription = point.tags.subscriptionType || 'free';
      const userId = point.tags.userId;
      
      if (subscription === 'free') {
        freeUsers.add(userId);
        freeGenerations += point.value;
      } else {
        premiumUsers.add(userId);
        premiumGenerations += point.value;
      }
    }
    
    return {
      free: {
        users: freeUsers.size,
        generations: freeGenerations,
        quotaUtilization: this.calculateQuotaUtilization('free')
      },
      premium: {
        users: premiumUsers.size,
        generations: premiumGenerations,
        quotaUtilization: this.calculateQuotaUtilization('premium')
      }
    };
  }

  private calculateFeatureUsage(points: MetricDataPoint[]): UsageMetrics['featureUsage'] {
    const presetUsage: Record<string, number> = {};
    let styleOverrides = 0;
    let customPrompts = 0;
    let cacheHits = 0;
    let backgroundProcessing = 0;
    
    for (const point of points) {
      const presetId = point.tags.presetId || 'unknown';
      presetUsage[presetId] = (presetUsage[presetId] || 0) + point.value;
      
      if (point.tags.hasStyleOverride === 'true') styleOverrides += point.value;
      if (point.tags.hasCustomPrompt === 'true') customPrompts += point.value;
      if (point.tags.cacheHit === 'true') cacheHits += point.value;
      if (point.tags.backgroundProcessed === 'true') backgroundProcessing += point.value;
    }
    
    return {
      presetUsage,
      styleOverrides,
      customPrompts,
      cacheHits,
      backgroundProcessing
    };
  }

  private calculateDailyUsagePattern(points: MetricDataPoint[]): Record<string, number> {
    const pattern: Record<string, number> = {};
    const grouped = this.timeWindowManager.groupByTimeBucket(
      points.map(p => ({ timestamp: p.timestamp, value: p.value })),
      'day'
    );
    
    for (const [day, values] of Object.entries(grouped)) {
      pattern[day] = values.reduce((sum, val) => sum + val, 0);
    }
    
    return pattern;
  }

  private calculateWeeklyUsagePattern(points: MetricDataPoint[]): Record<string, number> {
    const pattern: Record<string, number> = {};
    
    for (const point of points) {
      const week = this.getWeekKey(point.timestamp);
      pattern[week] = (pattern[week] || 0) + point.value;
    }
    
    return pattern;
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const weekNumber = Math.ceil(((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) + startOfYear.getDay()) / 7);
    return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateThroughput(points: MetricDataPoint[], interval: 'minute' | 'hour'): number {
    if (points.length === 0) return 0;
    
    const timeSpan = interval === 'minute' ? 60 * 1000 : 60 * 60 * 1000;
    const oldestTime = Math.min(...points.map(p => p.timestamp.getTime()));
    const newestTime = Math.max(...points.map(p => p.timestamp.getTime()));
    const duration = newestTime - oldestTime;
    
    if (duration === 0) return 0;
    
    const intervalsCount = Math.max(1, duration / timeSpan);
    return points.length / intervalsCount;
  }

  private calculatePeakThroughput(points: MetricDataPoint[]): number {
    const buckets = this.timeWindowManager.groupByTimeBucket(
      points.map(p => ({ timestamp: p.timestamp, value: 1 })),
      'minute'
    );
    
    let maxThroughput = 0;
    for (const values of Object.values(buckets)) {
      const throughput = values.length;
      if (throughput > maxThroughput) {
        maxThroughput = throughput;
      }
    }
    
    return maxThroughput;
  }

  // Additional helper methods (simplified implementations)
  private calculateCacheHitRate(window: { start: Date; end: Date }): number {
    const cachePoints = this.storage.getDataPoints('performance', 'cache_hit_rate', window.start, window.end);
    return this.storage.aggregate(cachePoints, 'average');
  }

  private getCacheAccessCount(window: { start: Date; end: Date }): number {
    const accessPoints = this.storage.getDataPoints('performance', 'cache_access', window.start, window.end);
    return this.storage.aggregate(accessPoints, 'sum');
  }

  private getAverageCacheAccessTime(window: { start: Date; end: Date }): number {
    const timePoints = this.storage.getDataPoints('performance', 'cache_access_time', window.start, window.end);
    return this.storage.aggregate(timePoints, 'average');
  }

  private calculateCacheEfficiencyScore(window: { start: Date; end: Date }): number {
    const hitRate = this.calculateCacheHitRate(window);
    const avgAccessTime = this.getAverageCacheAccessTime(window);
    
    const hitRateScore = hitRate * 100;
    const accessTimeScore = Math.max(0, 100 - avgAccessTime);
    
    return (hitRateScore + accessTimeScore) / 2;
  }

  private getAverageQueueLength(window: { start: Date; end: Date }): number {
    const queuePoints = this.storage.getDataPoints('performance', 'queue_length', window.start, window.end);
    return this.storage.aggregate(queuePoints, 'average');
  }

  private getMaxQueueLength(window: { start: Date; end: Date }): number {
    const queuePoints = this.storage.getDataPoints('performance', 'queue_length', window.start, window.end);
    return this.storage.aggregate(queuePoints, 'max');
  }

  private getAverageQueueWaitTime(window: { start: Date; end: Date }): number {
    const waitPoints = this.storage.getDataPoints('performance', 'queue_wait_time', window.start, window.end);
    return this.storage.aggregate(waitPoints, 'average');
  }

  private calculateQueueProcessingRate(window: { start: Date; end: Date }): number {
    const processedPoints = this.storage.getDataPoints('performance', 'queue_processed', window.start, window.end);
    return this.calculateThroughput(processedPoints, 'minute');
  }

  private getAverageConnectionUsage(window: { start: Date; end: Date }): number {
    const connectionPoints = this.storage.getDataPoints('performance', 'connection_usage', window.start, window.end);
    return this.storage.aggregate(connectionPoints, 'average');
  }

  private getPeakConnectionUsage(window: { start: Date; end: Date }): number {
    const connectionPoints = this.storage.getDataPoints('performance', 'connection_usage', window.start, window.end);
    return this.storage.aggregate(connectionPoints, 'max');
  }

  private calculateConnectionPoolEfficiency(window: { start: Date; end: Date }): number {
    const avgUsage = this.getAverageConnectionUsage(window);
    const maxCapacity = 10;
    return (avgUsage / maxCapacity) * 100;
  }

  private getAverageRetryCount(window: { start: Date; end: Date }): number {
    const retryPoints = this.storage.getDataPoints('performance', 'retry_count', window.start, window.end);
    return this.storage.aggregate(retryPoints, 'average');
  }

  private calculateRetrySuccessRate(window: { start: Date; end: Date }): number {
    const retrySuccessPoints = this.storage.getDataPoints('quality', 'retry_success_rate', window.start, window.end);
    return this.storage.aggregate(retrySuccessPoints, 'average');
  }

  private calculateTimeoutRate(window: { start: Date; end: Date }): number {
    const timeoutPoints = this.storage.getDataPoints('quality', 'timeout_rate', window.start, window.end);
    return this.storage.aggregate(timeoutPoints, 'average');
  }

  private getActiveUsersInWindow(start: Date, end: Date): number {
    const userActivityPoints = this.storage.getDataPoints('business', 'user_activity', start, end);
    const uniqueUsers = new Set(userActivityPoints.map(p => p.tags.userId));
    return uniqueUsers.size;
  }

  private calculateTrend(
    metricType: 'usage' | 'performance' | 'quality' | 'business',
    metricName: string,
    start: Date,
    end: Date
  ): 'improving' | 'stable' | 'degrading' {
    const points = this.storage.getDataPoints(metricType, metricName, start, end);
    if (points.length < 2) return 'stable';
    
    points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const midpoint = Math.floor(points.length / 2);
    const firstHalf = points.slice(0, midpoint);
    const secondHalf = points.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;
    
    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    const isGoodDirection = this.isImprovementDirection(metricName, changePercent > 0);
    
    if (Math.abs(changePercent) < 5) return 'stable';
    return isGoodDirection ? 'improving' : 'degrading';
  }

  private isImprovementDirection(metricName: string, isIncreasing: boolean): boolean {
    const increaseIsGood = [
      'success_rate', 'cache_hit_rate', 'user_satisfaction', 
      'throughput', 'uptime', 'user_activity'
    ];
    
    const decreaseIsGood = [
      'response_time', 'error_rate', 'timeout_rate', 'queue_length',
      'retry_count', 'abandonment_rate', 'churn_rate'
    ];
    
    if (increaseIsGood.some(metric => metricName.includes(metric))) {
      return isIncreasing;
    }
    
    if (decreaseIsGood.some(metric => metricName.includes(metric))) {
      return !isIncreasing;
    }
    
    return isIncreasing;
  }

  private calculateQuotaUtilization(subscriptionType: string): number {
    const quotaPoints = this.storage.getDataPoints('usage', 'quota_utilization', undefined, undefined, {
      subscriptionType
    });
    return this.storage.aggregate(quotaPoints, 'average');
  }

  /**
   * 메트릭 정리
   */
  cleanup(olderThanHours: number = 24): void {
    this.storage.cleanup(olderThanHours * 60);
    console.log(`🧹 Metrics cleanup completed (data older than ${olderThanHours} hours)`);
  }
}

/**
 * Singleton instance management
 */
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get or create global metrics collector instance
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Helper functions for easy metric recording
 */
export const MetricsRecorder = {
  // Usage metrics
  recordImageGeneration: (userId: string, presetId: string, metadata?: any) => {
    getMetricsCollector().recordMetric('usage', 'image_generation', 1, {
      userId,
      presetId,
      subscriptionType: metadata?.subscriptionType || 'free',
      hasCustomPrompt: metadata?.hasCustomPrompt ? 'true' : 'false',
      hasStyleOverride: metadata?.hasStyleOverride ? 'true' : 'false',
      cacheHit: metadata?.cacheHit ? 'true' : 'false',
      backgroundProcessed: metadata?.backgroundProcessed ? 'true' : 'false'
    }, metadata);
  },

  recordQuotaUsage: (userId: string, quotaType: string, used: number, limit: number, subscriptionType: string) => {
    const utilization = limit > 0 ? (used / limit) * 100 : 0;
    getMetricsCollector().recordMetric('usage', 'quota_utilization', utilization, {
      userId,
      quotaType,
      subscriptionType
    }, { used, limit, remaining: limit - used });
  },

  // Performance metrics
  recordResponseTime: (responseTime: number, userId?: string, metadata?: any) => {
    getMetricsCollector().recordMetric('performance', 'response_time', responseTime, {
      userId: userId || 'anonymous',
      cacheHit: metadata?.cacheHit ? 'true' : 'false',
      retryCount: metadata?.retryCount?.toString() || '0'
    }, metadata);
  },

  recordCachePerformance: (accessTime: number, hit: boolean, cacheKey?: string) => {
    getMetricsCollector().recordMetric('performance', 'cache_access_time', accessTime, {
      cacheHit: hit ? 'true' : 'false',
      cacheKey: cacheKey || 'unknown'
    });
    
    getMetricsCollector().recordMetric('performance', 'cache_hit_rate', hit ? 1 : 0, {
      cacheKey: cacheKey || 'unknown'
    });
  },

  // Quality metrics
  recordSuccess: (success: boolean, userId?: string, presetId?: string, metadata?: any) => {
    getMetricsCollector().recordMetric('quality', 'success_rate', success ? 1 : 0, {
      userId: userId || 'anonymous',
      presetId: presetId || 'unknown',
      subscriptionType: metadata?.subscriptionType || 'free'
    }, metadata);
  },

  recordError: (errorType: string, userId?: string, metadata?: any) => {
    getMetricsCollector().recordMetric('quality', 'error_rate', 1, {
      userId: userId || 'anonymous',
      errorType,
      severity: metadata?.severity || 'medium'
    }, metadata);
  },

  // Business metrics
  recordUserActivity: (userId: string, activityType: string, subscriptionType: string) => {
    getMetricsCollector().recordMetric('business', 'user_activity', 1, {
      userId,
      activityType,
      subscriptionType
    });
  },

  recordFeedback: (userId: string, rating: number, feedbackType: string) => {
    getMetricsCollector().recordMetric('business', 'user_satisfaction', rating, {
      userId,
      feedbackType
    });
    
    getMetricsCollector().recordMetric('business', 'positive_rating', rating >= 4 ? 1 : 0, {
      userId,
      rating: rating.toString()
    });
  }
};
