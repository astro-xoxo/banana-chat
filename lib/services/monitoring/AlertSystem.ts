/**
 * Alert System
 * Task 014: Monitoring and Logging Systems - Automated Alerts
 * 
 * Features:
 * - Performance alerts (response time, error rate, throughput)
 * - Availability alerts (service down, degraded performance)
 * - Usage alerts (quota exceeded, high usage spikes)
 * - System health alerts (resource exhaustion, connectivity issues)
 * - Multi-channel notifications (console, email, webhook)
 */

import { getMetricsCollector, MetricsCollector } from './MetricsCollector';
import { getStructuredLogger, StructuredLogger } from './StructuredLogger';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'availability' | 'usage' | 'system_health' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Trigger conditions
  metricType: 'usage' | 'performance' | 'quality' | 'business';
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'change_percent';
  threshold: number;
  
  // Time window for evaluation
  evaluationWindow: 'last_5min' | 'last_15min' | 'last_30min' | 'last_1hour';
  
  // Alert behavior
  cooldownMinutes: number; // Minimum time between same alerts
  escalationRules?: EscalationRule[];
  
  // Notification channels
  notificationChannels: ('console' | 'email' | 'webhook' | 'slack')[];
  
  // Additional metadata
  tags: Record<string, string>;
  enabled: boolean;
  createdAt: Date;
  lastTriggered?: Date;
}

interface EscalationRule {
  afterMinutes: number;
  severity: 'medium' | 'high' | 'critical';
  additionalChannels: string[];
}

interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  
  // Trigger details
  metricValue: number;
  threshold: number;
  condition: string;
  
  // Timing
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  
  // Context
  context: {
    metricType: string;
    metricName: string;
    evaluationWindow: string;
    additionalData?: Record<string, any>;
  };
  
  // Notification tracking
  notificationsSent: {
    channel: string;
    sentAt: Date;
    success: boolean;
    error?: string;
  }[];
  
  // Escalation tracking
  escalationLevel: number;
  lastEscalationAt?: Date;
}

interface NotificationChannel {
  name: string;
  type: 'console' | 'email' | 'webhook' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Alert Rule Manager
 * Manages alert rules and their evaluation
 */
class AlertRuleManager {
  private rules: Map<string, AlertRule> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * 기본 알림 규칙 초기화
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<AlertRule, 'id' | 'createdAt'>[] = [
      // Performance alerts
      {
        name: 'High Response Time',
        description: 'Average response time exceeds 2 minutes',
        category: 'performance',
        severity: 'high',
        metricType: 'performance',
        metricName: 'averageResponseTime',
        condition: 'greater_than',
        threshold: 120000, // 2 minutes in ms
        evaluationWindow: 'last_15min',
        cooldownMinutes: 10,
        notificationChannels: ['console', 'webhook'],
        tags: { component: 'image_generation' },
        enabled: true,
        escalationRules: [
          { afterMinutes: 30, severity: 'critical', additionalChannels: ['email'] }
        ]
      },
      
      {
        name: 'Low Cache Hit Rate',
        description: 'Cache hit rate below 5%',
        category: 'performance',
        severity: 'medium',
        metricType: 'performance',
        metricName: 'cacheHitRate',
        condition: 'less_than',
        threshold: 0.05, // 5%
        evaluationWindow: 'last_30min',
        cooldownMinutes: 30,
        notificationChannels: ['console'],
        tags: { component: 'cache' },
        enabled: true
      },

      // Availability alerts
      {
        name: 'High Queue Length',
        description: 'Queue length exceeds 50 items',
        category: 'availability',
        severity: 'medium',
        metricType: 'performance',
        metricName: 'averageQueueLength',
        condition: 'greater_than',
        threshold: 50,
        evaluationWindow: 'last_15min',
        cooldownMinutes: 15,
        notificationChannels: ['console', 'webhook'],
        tags: { component: 'queue' },
        enabled: true,
        escalationRules: [
          { afterMinutes: 30, severity: 'high', additionalChannels: ['email'] }
        ]
      },

      // Usage alerts
      {
        name: 'High Daily Usage',
        description: 'Daily generation count exceeds normal patterns',
        category: 'usage',
        severity: 'medium',
        metricType: 'usage',
        metricName: 'totalGenerations',
        condition: 'greater_than',
        threshold: 1000, // 1000 generations
        evaluationWindow: 'last_1hour',
        cooldownMinutes: 60,
        notificationChannels: ['console'],
        tags: { component: 'usage_monitoring' },
        enabled: true
      },

      {
        name: 'Quota Exceeded Events',
        description: 'High number of quota exceeded events',
        category: 'usage',
        severity: 'medium',
        metricType: 'usage',
        metricName: 'quotaExceededEvents',
        condition: 'greater_than',
        threshold: 10, // 10 events
        evaluationWindow: 'last_15min',
        cooldownMinutes: 30,
        notificationChannels: ['console'],
        tags: { component: 'quota_management' },
        enabled: true
      },

      // System health alerts
      {
        name: 'High Timeout Rate',
        description: 'Timeout rate exceeds 5%',
        category: 'system_health',
        severity: 'high',
        metricType: 'performance',
        metricName: 'timeoutRate',
        condition: 'greater_than',
        threshold: 0.05, // 5%
        evaluationWindow: 'last_15min',
        cooldownMinutes: 10,
        notificationChannels: ['console', 'webhook'],
        tags: { component: 'system' },
        enabled: true
      },

      {
        name: 'Connection Pool Saturation',
        description: 'Connection pool usage above 90%',
        category: 'system_health',
        severity: 'medium',
        metricType: 'performance',
        metricName: 'connectionPoolEfficiency',
        condition: 'greater_than',
        threshold: 90, // 90%
        evaluationWindow: 'last_15min',
        cooldownMinutes: 20,
        notificationChannels: ['console'],
        tags: { component: 'connection_pool' },
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.addRule(rule);
    }

    console.log(`📋 Initialized ${defaultRules.length} default alert rules`);
  }

  /**
   * 알림 규칙 추가
   */
  addRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fullRule: AlertRule = {
      ...rule,
      id,
      createdAt: new Date()
    };

    this.rules.set(id, fullRule);
    console.log(`📋 Added alert rule: ${rule.name} (${id})`);
    return id;
  }

  /**
   * 모든 활성 규칙 조회
   */
  getActiveRules(): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  /**
   * 알림 규칙 조회
   */
  getRule(id: string): AlertRule | null {
    return this.rules.get(id) || null;
  }

  /**
   * 규칙 마지막 트리거 시간 업데이트
   */
  updateLastTriggered(id: string): void {
    const rule = this.rules.get(id);
    if (rule) {
      rule.lastTriggered = new Date();
      this.rules.set(id, rule);
    }
  }

  /**
   * 쿨다운 확인
   */
  isInCooldown(rule: AlertRule): boolean {
    if (!rule.lastTriggered) return false;
    
    const cooldownEndTime = new Date(rule.lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000);
    return new Date() < cooldownEndTime;
  }
}

/**
 * Alert Evaluator
 * Evaluates alert rules against current metrics
 */
class AlertEvaluator {
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * 알림 규칙 평가
   */
  async evaluateRule(rule: AlertRule): Promise<{ triggered: boolean; value?: number; message?: string }> {
    try {
      // 메트릭 값 조회
      const metricValue = await this.getMetricValue(rule);
      
      if (metricValue === null) {
        return { triggered: false };
      }

      // 조건 평가
      const triggered = this.evaluateCondition(rule, metricValue);
      
      if (triggered) {
        const message = this.generateAlertMessage(rule, metricValue);
        return { triggered: true, value: metricValue, message };
      }

      return { triggered: false, value: metricValue };
    } catch (error) {
      console.error(`Error evaluating rule ${rule.name}:`, error);
      return { triggered: false };
    }
  }

  /**
   * 메트릭 값 조회
   */
  private async getMetricValue(rule: AlertRule): Promise<number | null> {
    const timeWindow = this.convertEvaluationWindow(rule.evaluationWindow);
    
    try {
      // 메트릭 타입에 따라 적절한 수집 메서드 호출
      switch (rule.metricType) {
        case 'usage':
          const usageMetrics = await this.metricsCollector.collectUsageMetrics(timeWindow);
          return this.extractMetricValue(usageMetrics, rule.metricName);
          
        case 'performance':
          const performanceMetrics = await this.metricsCollector.collectPerformanceMetrics(timeWindow);
          return this.extractMetricValue(performanceMetrics, rule.metricName);
          
        case 'quality':
          // Quality metrics는 실시간 메트릭에서 조회
          const realTimeMetrics = this.metricsCollector.getRealTimeMetrics();
          return this.extractRealtimeMetricValue(realTimeMetrics, rule.metricName);
          
        case 'business':
          // Business metrics 조회 (향후 구현)
          return 0; // Placeholder
          
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error getting metric value for ${rule.metricName}:`, error);
      return null;
    }
  }

  /**
   * 평가 윈도우 변환
   */
  private convertEvaluationWindow(window: string): 'last_hour' | 'last_24h' | 'last_7d' | 'last_30d' {
    switch (window) {
      case 'last_5min':
      case 'last_15min':
      case 'last_30min':
      case 'last_1hour':
        return 'last_hour';
      default:
        return 'last_hour';
    }
  }

  /**
   * 메트릭 객체에서 특정 값 추출
   */
  private extractMetricValue(metrics: any, metricName: string): number | null {
    // 중첩된 객체에서 메트릭 값 찾기
    const keys = metricName.split('.');
    let value = metrics;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }
    
    return typeof value === 'number' ? value : null;
  }

  /**
   * 실시간 메트릭에서 값 추출
   */
  private extractRealtimeMetricValue(realTimeMetrics: any, metricName: string): number | null {
    // 특정 메트릭 이름 처리
    if (metricName === 'errorRate') {
      const successRate = realTimeMetrics.current.successRate;
      return successRate ? 1 - successRate : null;
    }
    
    // 기타 메트릭
    return this.extractMetricValue(realTimeMetrics.current, metricName);
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(rule: AlertRule, value: number): boolean {
    switch (rule.condition) {
      case 'greater_than':
        return value > rule.threshold;
      case 'less_than':
        return value < rule.threshold;
      case 'equals':
        return Math.abs(value - rule.threshold) < 0.001; // Float comparison
      case 'not_equals':
        return Math.abs(value - rule.threshold) >= 0.001;
      case 'change_percent':
        // 변화율 계산 (향후 구현 필요)
        return false;
      default:
        return false;
    }
  }

  /**
   * 알림 메시지 생성
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    const formattedValue = this.formatMetricValue(rule.metricName, value);
    const formattedThreshold = this.formatMetricValue(rule.metricName, rule.threshold);
    
    return `${rule.name}: ${formattedValue} ${rule.condition.replace('_', ' ')} ${formattedThreshold}`;
  }

  /**
   * 메트릭 값 포맷팅
   */
  private formatMetricValue(metricName: string, value: number): string {
    if (metricName.includes('time') || metricName.includes('duration') || metricName.includes('Time')) {
      // 시간 메트릭은 밀리초를 초로 변환
      return `${(value / 1000).toFixed(1)}s`;
    } else if (metricName.includes('rate') || metricName.includes('percent') || metricName.includes('Rate')) {
      // 비율 메트릭은 퍼센트로 표시
      return `${(value * 100).toFixed(1)}%`;
    } else if (metricName.includes('count') || metricName.includes('length') || metricName.includes('Count')) {
      // 카운트 메트릭은 정수로 표시
      return Math.round(value).toString();
    } else {
      // 기본 소수점 2자리
      return value.toFixed(2);
    }
  }
}

/**
 * Notification Manager
 * Handles sending notifications to different channels
 */
class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();
  private logger: StructuredLogger;

  constructor(logger: StructuredLogger) {
    this.logger = logger;
    this.initializeChannels();
  }

  /**
   * 알림 채널 초기화
   */
  private initializeChannels(): void {
    // 콘솔 채널
    this.channels.set('console', {
      name: 'Console',
      type: 'console',
      config: { colorOutput: true },
      enabled: true
    });

    // 웹훅 채널 (예시)
    this.channels.set('webhook', {
      name: 'Webhook',
      type: 'webhook',
      config: { 
        url: process.env.ALERT_WEBHOOK_URL || 'https://example.com/webhook',
        timeout: 5000 
      },
      enabled: !!process.env.ALERT_WEBHOOK_URL
    });

    // 이메일 채널 (예시)
    this.channels.set('email', {
      name: 'Email',
      type: 'email',
      config: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: process.env.SMTP_PORT,
        smtpUser: process.env.SMTP_USER,
        smtpPass: process.env.SMTP_PASS,
        fromEmail: process.env.ALERT_FROM_EMAIL,
        toEmails: process.env.ALERT_TO_EMAILS?.split(',') || []
      },
      enabled: !!(process.env.SMTP_HOST && process.env.ALERT_FROM_EMAIL)
    });

    console.log(`📫 Initialized ${this.channels.size} notification channels`);
  }

  /**
   * 알림 전송
   */
  async sendNotification(
    channels: string[],
    alert: Omit<AlertEvent, 'notificationsSent'>
  ): Promise<{ channel: string; success: boolean; error?: string }[]> {
    const results: { channel: string; success: boolean; error?: string }[] = [];

    for (const channelName of channels) {
      const channel = this.channels.get(channelName);
      if (!channel || !channel.enabled) {
        results.push({
          channel: channelName,
          success: false,
          error: 'Channel not found or disabled'
        });
        continue;
      }

      try {
        await this.sendToChannel(channel, alert);
        results.push({ channel: channelName, success: true });
        
        // 성공 로그
        this.logger.log('INFO', 'alert', 'notification_sent', 
          `Alert notification sent to ${channelName}`, 
          { correlationId: alert.id },
          { alertId: alert.id, channel: channelName, severity: alert.severity }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          channel: channelName,
          success: false,
          error: errorMessage
        });

        // 실패 로그
        this.logger.log('ERROR', 'alert', 'notification_failed',
          `Failed to send alert notification to ${channelName}: ${errorMessage}`,
          { correlationId: alert.id },
          { alertId: alert.id, channel: channelName, error: errorMessage }
        );
      }
    }

    return results;
  }

  /**
   * 특정 채널로 알림 전송
   */
  private async sendToChannel(channel: NotificationChannel, alert: Omit<AlertEvent, 'notificationsSent'>): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.sendToConsole(alert);
        break;
      case 'webhook':
        await this.sendToWebhook(channel, alert);
        break;
      case 'email':
        await this.sendToEmail(channel, alert);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * 콘솔 출력
   */
  private sendToConsole(alert: Omit<AlertEvent, 'notificationsSent'>): void {
    const severityEmoji = this.getSeverityEmoji(alert.severity);
    const timestamp = alert.triggeredAt.toISOString();
    
    console.log(`\n🚨 ${severityEmoji} ALERT TRIGGERED`);
    console.log(`├─ Rule: ${alert.ruleName}`);
    console.log(`├─ Severity: ${alert.severity.toUpperCase()}`);
    console.log(`├─ Category: ${alert.category}`);
    console.log(`├─ Message: ${alert.message}`);
    console.log(`├─ Value: ${alert.metricValue} (threshold: ${alert.threshold})`);
    console.log(`├─ Time: ${timestamp}`);
    console.log(`└─ Alert ID: ${alert.id}\n`);
  }

  /**
   * 웹훅 전송
   */
  private async sendToWebhook(channel: NotificationChannel, alert: Omit<AlertEvent, 'notificationsSent'>): Promise<void> {
    const payload = {
      alertId: alert.id,
      ruleName: alert.ruleName,
      severity: alert.severity,
      category: alert.category,
      message: alert.message,
      metricValue: alert.metricValue,
      threshold: alert.threshold,
      condition: alert.condition,
      triggeredAt: alert.triggeredAt.toISOString(),
      context: alert.context
    };

    try {
      const response = await fetch(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Face-Chat-Alert-System/1.0'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(channel.config.timeout || 5000)
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Webhook request timed out');
      }
      throw error;
    }
  }

  /**
   * 이메일 전송
   */
  private async sendToEmail(channel: NotificationChannel, alert: Omit<AlertEvent, 'notificationsSent'>): Promise<void> {
    // 실제 구현에서는 nodemailer 등의 라이브러리 사용
    console.log('📧 Email notification (simulated):', {
      to: channel.config.toEmails,
      subject: `[${alert.severity.toUpperCase()}] ${alert.ruleName}`,
      body: this.generateEmailBody(alert)
    });
  }

  /**
   * 이메일 본문 생성
   */
  private generateEmailBody(alert: Omit<AlertEvent, 'notificationsSent'>): string {
    return `
Alert Notification - ${alert.ruleName}

Severity: ${alert.severity.toUpperCase()}
Category: ${alert.category}
Message: ${alert.message}

Details:
- Metric Value: ${alert.metricValue}
- Threshold: ${alert.threshold}
- Condition: ${alert.condition}
- Triggered At: ${alert.triggeredAt.toISOString()}

Context:
- Metric Type: ${alert.context.metricType}
- Metric Name: ${alert.context.metricName}
- Evaluation Window: ${alert.context.evaluationWindow}

Alert ID: ${alert.id}

---
AI Face Chat Monitoring System
    `.trim();
  }

  /**
   * 심각도별 이모지
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔥';
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return '💡';
      default: return '📢';
    }
  }

  /**
   * 활성 채널 목록 조회
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.enabled)
      .map(([name, _]) => name);
  }
}

/**
 * Alert Manager
 * Manages active alerts and their lifecycle
 */
class AlertManager {
  private activeAlerts: Map<string, AlertEvent> = new Map();
  private alertHistory: AlertEvent[] = [];
  private readonly maxHistorySize = 1000;

  /**
   * 새 알림 이벤트 생성
   */
  createAlert(
    rule: AlertRule,
    metricValue: number,
    message: string
  ): AlertEvent {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: AlertEvent = {
      id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      category: rule.category,
      message,
      metricValue,
      threshold: rule.threshold,
      condition: rule.condition,
      triggeredAt: new Date(),
      context: {
        metricType: rule.metricType,
        metricName: rule.metricName,
        evaluationWindow: rule.evaluationWindow,
        additionalData: {
          tags: rule.tags,
          description: rule.description
        }
      },
      notificationsSent: [],
      escalationLevel: 0
    };

    this.activeAlerts.set(id, alert);
    return alert;
  }

  /**
   * 알림에 노티피케이션 기록 추가
   */
  addNotificationRecord(
    alertId: string,
    channel: string,
    success: boolean,
    error?: string
  ): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.notificationsSent.push({
      channel,
      sentAt: new Date(),
      success,
      error
    });
  }

  /**
   * 활성 알림 조회
   */
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 심각도별 활성 알림 조회
   */
  getActiveAlertsBySeverity(severity: AlertEvent['severity']): AlertEvent[] {
    return this.getActiveAlerts().filter(alert => alert.severity === severity);
  }

  /**
   * 통계 조회
   */
  getAlertStatistics(): {
    activeCount: number;
    totalToday: number;
    criticalCount: number;
    averageResolutionTime: number;
    topCategories: { category: string; count: number }[];
  } {
    const active = this.getActiveAlerts();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAlerts = this.alertHistory.filter(alert => 
      alert.triggeredAt >= today
    );

    const critical = active.filter(alert => alert.severity === 'critical');

    // 해결 시간 평균 계산
    const resolvedAlerts = this.alertHistory.filter(alert => alert.resolvedAt);
    const resolutionTimes = resolvedAlerts.map(alert => 
      alert.resolvedAt!.getTime() - alert.triggeredAt.getTime()
    );
    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;

    // 카테고리별 통계
    const categoryCount: Record<string, number> = {};
    for (const alert of [...active, ...todayAlerts]) {
      categoryCount[alert.category] = (categoryCount[alert.category] || 0) + 1;
    }

    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      activeCount: active.length,
      totalToday: todayAlerts.length,
      criticalCount: critical.length,
      averageResolutionTime: averageResolutionTime / (1000 * 60), // minutes
      topCategories
    };
  }
}

/**
 * Alert System
 * Main class that orchestrates the entire alert system
 */
export class AlertSystem {
  private ruleManager: AlertRuleManager;
  private evaluator: AlertEvaluator;
  private notificationManager: NotificationManager;
  private alertManager: AlertManager;
  private logger: StructuredLogger;
  
  private evaluationTimer: NodeJS.Timeout | null = null;
  private readonly evaluationIntervalMs = 60 * 1000; // 1분마다 평가

  constructor() {
    this.logger = getStructuredLogger();
    this.ruleManager = new AlertRuleManager();
    this.evaluator = new AlertEvaluator(getMetricsCollector());
    this.notificationManager = new NotificationManager(this.logger);
    this.alertManager = new AlertManager();

    this.startPeriodicEvaluation();

    console.log('🚨 AlertSystem initialized');
  }

  /**
   * 주기적 알림 평가 시작
   */
  private startPeriodicEvaluation(): void {
    this.evaluationTimer = setInterval(async () => {
      await this.evaluateAllRules();
    }, this.evaluationIntervalMs);

    console.log(`⏰ Started periodic alert evaluation (every ${this.evaluationIntervalMs / 1000}s)`);
  }

  /**
   * 모든 알림 규칙 평가
   */
  async evaluateAllRules(): Promise<void> {
    const activeRules = this.ruleManager.getActiveRules();
    
    for (const rule of activeRules) {
      try {
        // 쿨다운 확인
        if (this.ruleManager.isInCooldown(rule)) {
          continue;
        }

        // 규칙 평가
        const evaluation = await this.evaluator.evaluateRule(rule);
        
        if (evaluation.triggered && evaluation.message) {
          await this.handleTriggeredRule(rule, evaluation.value!, evaluation.message);
        }
      } catch (error) {
        this.logger.log('ERROR', 'alert', 'rule_evaluation_error',
          `Failed to evaluate rule ${rule.name}: ${error}`,
          undefined,
          { ruleId: rule.id, ruleName: rule.name, error: String(error) }
        );
      }
    }
  }

  /**
   * 트리거된 규칙 처리
   */
  private async handleTriggeredRule(rule: AlertRule, metricValue: number, message: string): Promise<void> {
    // 알림 이벤트 생성
    const alert = this.alertManager.createAlert(rule, metricValue, message);

    // 마지막 트리거 시간 업데이트
    this.ruleManager.updateLastTriggered(rule.id);

    // 알림 로깅
    this.logger.log('WARN', 'alert', 'alert_triggered',
      `Alert triggered: ${rule.name}`,
      { correlationId: alert.id },
      {
        alertId: alert.id,
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        category: rule.category,
        metricValue,
        threshold: rule.threshold,
        condition: rule.condition
      }
    );

    // 알림 전송
    await this.sendAlert(alert, rule.notificationChannels);
  }

  /**
   * 알림 전송
   */
  private async sendAlert(alert: AlertEvent, channels: string[]): Promise<void> {
    try {
      const results = await this.notificationManager.sendNotification(channels, alert);
      
      // 전송 결과 기록
      for (const result of results) {
        this.alertManager.addNotificationRecord(
          alert.id,
          result.channel,
          result.success,
          result.error
        );
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`📤 Alert notifications sent: ${successCount}/${results.length} successful (${alert.id})`);

    } catch (error) {
      this.logger.log('ERROR', 'alert', 'notification_error',
        `Failed to send alert notifications: ${error}`,
        { correlationId: alert.id },
        { alertId: alert.id, error: String(error) }
      );
    }
  }

  /**
   * 알림 규칙 관리
   */
  getRuleManager(): AlertRuleManager {
    return this.ruleManager;
  }

  /**
   * 알림 관리
   */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  /**
   * 노티피케이션 관리
   */
  getNotificationManager(): NotificationManager {
    return this.notificationManager;
  }

  /**
   * 시스템 상태 조회
   */
  getSystemStatus(): {
    activeRules: number;
    activeAlerts: number;
    criticalAlerts: number;
    notificationChannels: string[];
    lastEvaluationTime: Date;
    statistics: ReturnType<AlertManager['getAlertStatistics']>;
  } {
    return {
      activeRules: this.ruleManager.getActiveRules().length,
      activeAlerts: this.alertManager.getActiveAlerts().length,
      criticalAlerts: this.alertManager.getActiveAlertsBySeverity('critical').length,
      notificationChannels: this.notificationManager.getActiveChannels(),
      lastEvaluationTime: new Date(),
      statistics: this.alertManager.getAlertStatistics()
    };
  }

  /**
   * 시스템 중지
   */
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }

    console.log('🚨 AlertSystem stopped');
  }
}

/**
 * Singleton instance management
 */
let globalAlertSystem: AlertSystem | null = null;

/**
 * Get or create global alert system instance
 */
export function getAlertSystem(): AlertSystem {
  if (!globalAlertSystem) {
    globalAlertSystem = new AlertSystem();
  }
  return globalAlertSystem;
}

/**
 * Helper functions for alert management
 */
export const AlertUtils = {
  /**
   * 긴급 알림 생성 (수동)
   */
  createEmergencyAlert: (message: string, severity: 'high' | 'critical' = 'high') => {
    const alertSystem = getAlertSystem();
    const ruleManager = alertSystem.getRuleManager();
    
    const emergencyRuleId = ruleManager.addRule({
      name: 'Emergency Alert',
      description: 'Manually triggered emergency alert',
      category: 'system_health',
      severity,
      metricType: 'quality',
      metricName: 'emergency_metric',
      condition: 'greater_than',
      threshold: 0,
      evaluationWindow: 'last_5min',
      cooldownMinutes: 0,
      notificationChannels: ['console', 'webhook', 'email'],
      tags: { manual: 'true', emergency: 'true' },
      enabled: true
    });

    return emergencyRuleId;
  },

  /**
   * 알림 통계 조회
   */
  getAlertStatistics: () => {
    const alertSystem = getAlertSystem();
    return alertSystem.getAlertManager().getAlertStatistics();
  },

  /**
   * 활성 알림 요약
   */
  getActiveAlertsSummary: () => {
    const alertSystem = getAlertSystem();
    const alertManager = alertSystem.getAlertManager();
    
    const active = alertManager.getActiveAlerts();
    const bySeverity = {
      critical: active.filter(a => a.severity === 'critical').length,
      high: active.filter(a => a.severity === 'high').length,
      medium: active.filter(a => a.severity === 'medium').length,
      low: active.filter(a => a.severity === 'low').length
    };

    const byCategory: Record<string, number> = {};
    for (const alert of active) {
      byCategory[alert.category] = (byCategory[alert.category] || 0) + 1;
    }

    return {
      total: active.length,
      bySeverity,
      byCategory,
      oldest: active.length > 0 ? Math.min(...active.map(a => a.triggeredAt.getTime())) : null,
      unacknowledged: active.filter(a => !a.acknowledgedAt).length
    };
  },

  /**
   * 시스템 헬스 체크
   */
  performHealthCheck: async () => {
    const alertSystem = getAlertSystem();
    const status = alertSystem.getSystemStatus();
    
    const healthCheck = {
      alertSystemStatus: 'healthy' as 'healthy' | 'degraded' | 'critical',
      issues: [] as string[],
      ...status
    };

    // 상태 평가
    if (status.criticalAlerts > 0) {
      healthCheck.alertSystemStatus = 'critical';
      healthCheck.issues.push(`${status.criticalAlerts} critical alerts active`);
    } else if (status.activeAlerts > 10) {
      healthCheck.alertSystemStatus = 'degraded';
      healthCheck.issues.push(`High number of active alerts: ${status.activeAlerts}`);
    }

    if (status.notificationChannels.length === 0) {
      healthCheck.alertSystemStatus = 'degraded';
      healthCheck.issues.push('No notification channels available');
    }

    return healthCheck;
  }
};
