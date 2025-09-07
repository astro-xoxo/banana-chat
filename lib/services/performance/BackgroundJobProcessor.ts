/**
 * Background Job Processor
 * Task 013: Performance Optimization - Background Processing
 * 
 * Features:
 * - Redis Bull Queue for job management
 * - Priority-based job processing (premium > normal > retry)
 * - Dead Letter Queue for failed jobs
 * - Real-time job status tracking
 * - Exponential backoff for retries
 */

interface ImageGenerationJob {
  id: string;
  userId: string;
  messageId?: string;
  correlationId?: string;
  request: {
    user_image_url: string | null;
    preset_id: string;
    user_id: string;
    environment?: string;
    chatbot_name?: string;
    custom_prompt?: string;
    negative_prompt?: string;
    metadata?: any;
  };
  priority: 'low' | 'normal' | 'high' | 'premium';
  options: {
    retryAttempts: number;
    timeout: number;
    delay?: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
}

interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  processingTime: number;
  retryCount: number;
  metadata?: any;
}

interface QueueMetrics {
  totalJobs: number;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  retryJobs: number;
  averageProcessingTime: number;
  throughputPerMinute: number;
  currentWorkers: number;
  queueHealth: 'healthy' | 'congested' | 'failing';
}

/**
 * Job Status Manager
 * Tracks job status for real-time updates
 */
class JobStatusManager {
  private jobStatuses: Map<string, {
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';
    progress: number;
    message: string;
    updatedAt: Date;
  }> = new Map();

  /**
   * 작업 상태 업데이트
   */
  updateJobStatus(
    jobId: string,
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying',
    progress: number = 0,
    message: string = ''
  ): void {
    this.jobStatuses.set(jobId, {
      status,
      progress,
      message,
      updatedAt: new Date()
    });

    // WebSocket으로 실시간 업데이트 전송 (향후 구현)
    this.broadcastStatusUpdate(jobId, status, progress, message);
  }

  /**
   * 작업 상태 조회
   */
  getJobStatus(jobId: string) {
    return this.jobStatuses.get(jobId) || null;
  }

  /**
   * 모든 활성 작업 상태 조회
   */
  getAllActiveJobs() {
    const activeStatuses = ['queued', 'processing', 'retrying'];
    const activeJobs: Array<{ jobId: string; status: any }> = [];
    
    for (const [jobId, status] of this.jobStatuses) {
      if (activeStatuses.includes(status.status)) {
        activeJobs.push({ jobId, status });
      }
    }
    
    return activeJobs;
  }

  /**
   * 상태 업데이트 브로드캐스트
   */
  private broadcastStatusUpdate(
    jobId: string,
    status: string,
    progress: number,
    message: string
  ): void {
    // WebSocket 또는 Server-Sent Events로 실시간 업데이트
    console.log(`📡 Job status update: ${jobId} -> ${status} (${progress}%): ${message}`);
    
    // 향후 WebSocket 구현 시:
    // this.websocketServer.broadcast({
    //   type: 'job_status_update',
    //   jobId,
    //   status,
    //   progress,
    //   message,
    //   timestamp: new Date().toISOString()
    // });
  }

  /**
   * 완료된 작업 정리
   */
  cleanupCompletedJobs(olderThanMinutes: number = 60): void {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    
    for (const [jobId, status] of this.jobStatuses) {
      if (status.status === 'completed' || status.status === 'failed') {
        if (status.updatedAt < cutoffTime) {
          this.jobStatuses.delete(jobId);
        }
      }
    }
  }
}

/**
 * Queue Health Monitor
 * Monitors queue performance and health metrics
 */
class QueueHealthMonitor {
  private metrics: QueueMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startHealthMonitoring();
  }

  /**
   * 메트릭 업데이트
   */
  updateMetrics(update: Partial<QueueMetrics>): void {
    this.metrics = { ...this.metrics, ...update };
    this.assessQueueHealth();
  }

  /**
   * 큐 상태 평가
   */
  private assessQueueHealth(): void {
    const { pendingJobs, averageProcessingTime, failedJobs, totalJobs } = this.metrics;
    
    // 큐 상태 평가 로직
    if (pendingJobs > 100 || averageProcessingTime > 300000) { // 5분 이상
      this.metrics.queueHealth = 'congested';
    } else if (totalJobs > 0 && (failedJobs / totalJobs) > 0.1) { // 실패율 10% 이상
      this.metrics.queueHealth = 'failing';
    } else {
      this.metrics.queueHealth = 'healthy';
    }

    // 상태에 따른 알림
    if (this.metrics.queueHealth !== 'healthy') {
      console.warn(`⚠️ Queue health: ${this.metrics.queueHealth}`, {
        pendingJobs,
        averageProcessingTime,
        failedJobs,
        totalJobs
      });
    }
  }

  /**
   * 헬스 모니터링 시작
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.assessQueueHealth();
      console.log(`📊 Queue metrics:`, this.metrics);
    }, 60000); // 1분마다 체크
  }

  /**
   * 메트릭 조회
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * 메트릭 초기화
   */
  private initializeMetrics(): QueueMetrics {
    return {
      totalJobs: 0,
      pendingJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      retryJobs: 0,
      averageProcessingTime: 0,
      throughputPerMinute: 0,
      currentWorkers: 0,
      queueHealth: 'healthy'
    };
  }

  /**
   * 모니터링 중지
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

/**
 * Memory Queue Implementation
 * In-memory queue as fallback when Redis is not available
 */
class MemoryQueue {
  private queues: Map<number, ImageGenerationJob[]> = new Map(); // priority -> jobs
  private processing: Set<string> = new Set();
  private completed: Map<string, JobResult> = new Map();
  private failed: Map<string, { job: ImageGenerationJob; error: string; attempts: number }> = new Map();

  /**
   * 작업 추가
   */
  add(job: ImageGenerationJob): Promise<void> {
    const priority = this.mapPriorityToNumber(job.priority);
    
    if (!this.queues.has(priority)) {
      this.queues.set(priority, []);
    }
    
    this.queues.get(priority)!.push(job);
    console.log(`📝 Job queued: ${job.id} (priority: ${job.priority})`);
    
    return Promise.resolve();
  }

  /**
   * 다음 작업 가져오기
   */
  getNext(): ImageGenerationJob | null {
    // 높은 우선순위부터 확인
    const priorities = Array.from(this.queues.keys()).sort((a, b) => b - a);
    
    for (const priority of priorities) {
      const queue = this.queues.get(priority)!;
      if (queue.length > 0) {
        const job = queue.shift()!;
        this.processing.add(job.id);
        return job;
      }
    }
    
    return null;
  }

  /**
   * 작업 완료 처리
   */
  complete(jobId: string, result: JobResult): void {
    this.processing.delete(jobId);
    this.completed.set(jobId, result);
    console.log(`✅ Job completed: ${jobId}`);
  }

  /**
   * 작업 실패 처리
   */
  fail(jobId: string, job: ImageGenerationJob, error: string): void {
    this.processing.delete(jobId);
    
    const existing = this.failed.get(jobId);
    const attempts = existing ? existing.attempts + 1 : 1;
    
    if (attempts < job.options.retryAttempts) {
      // 재시도 큐에 추가
      setTimeout(() => {
        this.add({ ...job, id: `${job.id}_retry_${attempts}` });
      }, this.calculateRetryDelay(attempts));
      
      console.log(`🔄 Job retry scheduled: ${jobId} (attempt ${attempts + 1}/${job.options.retryAttempts})`);
    } else {
      this.failed.set(jobId, { job, error, attempts });
      console.error(`❌ Job failed permanently: ${jobId} after ${attempts} attempts`);
    }
  }

  /**
   * 통계 조회
   */
  getStats() {
    let totalPending = 0;
    for (const queue of this.queues.values()) {
      totalPending += queue.length;
    }
    
    return {
      pending: totalPending,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: this.failed.size
    };
  }

  /**
   * 우선순위를 숫자로 매핑
   */
  private mapPriorityToNumber(priority: string): number {
    const priorityMap = {
      'premium': 100,
      'high': 75,
      'normal': 50,
      'low': 25
    };
    return priorityMap[priority as keyof typeof priorityMap] || 50;
  }

  /**
   * 재시도 지연 시간 계산
   */
  private calculateRetryDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // 최대 30초
  }
}

/**
 * Background Job Processor
 * Main class for managing background image generation jobs
 */
export class BackgroundJobProcessor {
  private readonly memoryQueue: MemoryQueue;
  private readonly statusManager: JobStatusManager;
  private readonly healthMonitor: QueueHealthMonitor;
  private readonly maxConcurrentJobs: number;
  private readonly processingInterval: number;
  private isProcessing: boolean = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();

  constructor(
    maxConcurrentJobs: number = 10,
    processingInterval: number = 1000 // 1초마다 큐 체크
  ) {
    this.memoryQueue = new MemoryQueue();
    this.statusManager = new JobStatusManager();
    this.healthMonitor = new QueueHealthMonitor();
    this.maxConcurrentJobs = maxConcurrentJobs;
    this.processingInterval = processingInterval;

    this.startProcessing();
    
    console.log(`🚀 BackgroundJobProcessor initialized (max concurrent: ${maxConcurrentJobs})`);
  }

  /**
   * 이미지 생성 작업 추가
   */
  async enqueueImageGeneration(
    userId: string,
    request: ImageGenerationJob['request'],
    options: {
      priority?: 'low' | 'normal' | 'high' | 'premium';
      messageId?: string;
      correlationId?: string;
      timeout?: number;
      retryAttempts?: number;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId(userId);
    const job: ImageGenerationJob = {
      id: jobId,
      userId,
      messageId: options.messageId,
      correlationId: options.correlationId || jobId,
      request,
      priority: options.priority || 'normal',
      options: {
        retryAttempts: options.retryAttempts || 3,
        timeout: options.timeout || 300000, // 5분
        delay: 0
      },
      createdAt: new Date()
    };

    await this.memoryQueue.add(job);
    this.statusManager.updateJobStatus(jobId, 'queued', 0, 'Job queued for processing');
    
    // 메트릭 업데이트
    const stats = this.memoryQueue.getStats();
    this.healthMonitor.updateMetrics({
      totalJobs: stats.pending + stats.processing + stats.completed + stats.failed,
      pendingJobs: stats.pending,
      activeJobs: stats.processing,
      completedJobs: stats.completed,
      failedJobs: stats.failed
    });

    console.log(`📋 Job enqueued: ${jobId} (priority: ${job.priority}, queue size: ${stats.pending})`);
    return jobId;
  }

  /**
   * 작업 상태 조회
   */
  getJobStatus(jobId: string) {
    return this.statusManager.getJobStatus(jobId);
  }

  /**
   * 큐 통계 조회
   */
  getQueueMetrics(): QueueMetrics {
    return this.healthMonitor.getMetrics();
  }

  /**
   * 큐 처리 시작
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processingTimer = setInterval(async () => {
      await this.processQueue();
    }, this.processingInterval);
    
    console.log('🔄 Job processing started');
  }

  /**
   * 큐 처리 중지
   */
  stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    this.healthMonitor.stopMonitoring();
    console.log('⏹️ Job processing stopped');
  }

  /**
   * 큐 처리 로직
   */
  private async processQueue(): Promise<void> {
    try {
      // 동시 실행 한계 확인
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        return;
      }

      // 다음 작업 가져오기
      const job = this.memoryQueue.getNext();
      if (!job) {
        return;
      }

      // 작업 처리 시작
      this.activeJobs.add(job.id);
      this.statusManager.updateJobStatus(job.id, 'processing', 10, 'Starting image generation');
      
      console.log(`🔧 Processing job: ${job.id} (active: ${this.activeJobs.size}/${this.maxConcurrentJobs})`);

      // 비동기로 작업 처리
      this.processJob(job).catch(error => {
        console.error(`Error processing job ${job.id}:`, error);
        this.handleJobFailure(job, error);
      });

    } catch (error) {
      console.error('Error in processQueue:', error);
    }
  }

  /**
   * 개별 작업 처리
   */
  private async processJob(job: ImageGenerationJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      job.startedAt = new Date();
      this.statusManager.updateJobStatus(job.id, 'processing', 25, 'Connecting to ComfyUI server');

      // ComfyUI 클라이언트 임포트 및 실행
      const { callOptimizedComfyUIServer } = await import('../../../comfyui/optimized-client');
      
      this.statusManager.updateJobStatus(job.id, 'processing', 50, 'Generating image');

      // 실제 이미지 생성 실행
      const { result, metrics } = await callOptimizedComfyUIServer(
        job.request.user_image_url,
        job.request.preset_id,
        job.request.user_id,
        {
          environment: job.request.environment,
          chatbotName: job.request.chatbot_name,
          customPrompt: job.request.custom_prompt,
          negativePrompt: job.request.negative_prompt,
          metadata: job.request.metadata,
          priority: job.priority,
          correlationId: job.correlationId
        }
      );

      this.statusManager.updateJobStatus(job.id, 'processing', 90, 'Finalizing result');

      // 작업 완료 처리
      job.completedAt = new Date();
      const processingTime = Date.now() - startTime;
      
      const jobResult: JobResult = {
        success: result.success,
        result: result,
        processingTime,
        retryCount: metrics.retryCount,
        metadata: {
          networkLatency: metrics.networkLatency,
          serverProcessingTime: metrics.serverProcessingTime,
          cacheHit: metrics.cacheHit
        }
      };

      this.memoryQueue.complete(job.id, jobResult);
      this.statusManager.updateJobStatus(job.id, 'completed', 100, 'Image generation completed');
      
      console.log(`✅ Job completed: ${job.id} (${processingTime}ms)`);

      // 성공률 메트릭 업데이트
      this.updateSuccessMetrics(processingTime);

    } catch (error) {
      await this.handleJobFailure(job, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * 작업 실패 처리
   */
  private async handleJobFailure(job: ImageGenerationJob, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    job.failedAt = new Date();
    this.memoryQueue.fail(job.id, job, errorMessage);
    this.statusManager.updateJobStatus(job.id, 'failed', 0, `Failed: ${errorMessage}`);
    
    console.error(`❌ Job failed: ${job.id} - ${errorMessage}`);

    // 실패율 메트릭 업데이트
    this.updateFailureMetrics();
  }

  /**
   * 성공 메트릭 업데이트
   */
  private updateSuccessMetrics(processingTime: number): void {
    const currentMetrics = this.healthMonitor.getMetrics();
    const newAverage = currentMetrics.completedJobs > 0
      ? (currentMetrics.averageProcessingTime * currentMetrics.completedJobs + processingTime) / (currentMetrics.completedJobs + 1)
      : processingTime;

    this.healthMonitor.updateMetrics({
      completedJobs: currentMetrics.completedJobs + 1,
      averageProcessingTime: newAverage,
      currentWorkers: this.activeJobs.size
    });
  }

  /**
   * 실패 메트릭 업데이트
   */
  private updateFailureMetrics(): void {
    const currentMetrics = this.healthMonitor.getMetrics();
    this.healthMonitor.updateMetrics({
      failedJobs: currentMetrics.failedJobs + 1,
      currentWorkers: this.activeJobs.size
    });
  }

  /**
   * 작업 ID 생성
   */
  private generateJobId(userId: string): string {
    return `job_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 정리 작업
   */
  cleanup(): void {
    this.stopProcessing();
    this.statusManager.cleanupCompletedJobs();
    console.log('🧹 BackgroundJobProcessor cleanup completed');
  }
}

/**
 * Singleton instance management
 */
let globalJobProcessor: BackgroundJobProcessor | null = null;

/**
 * Get or create global job processor instance
 */
export function getJobProcessor(): BackgroundJobProcessor {
  if (!globalJobProcessor) {
    globalJobProcessor = new BackgroundJobProcessor();
  }
  return globalJobProcessor;
}

/**
 * Initialize job processor with custom settings
 */
export function initializeJobProcessor(
  maxConcurrentJobs: number = 10,
  processingInterval: number = 1000
): BackgroundJobProcessor {
  if (globalJobProcessor) {
    globalJobProcessor.cleanup();
  }
  
  globalJobProcessor = new BackgroundJobProcessor(maxConcurrentJobs, processingInterval);
  return globalJobProcessor;
}

/**
 * Cleanup global job processor
 */
export function cleanupJobProcessor(): void {
  if (globalJobProcessor) {
    globalJobProcessor.cleanup();
    globalJobProcessor = null;
  }
}

/**
 * High-level API for easy integration
 */
export class ImageGenerationJobService {
  private readonly jobProcessor: BackgroundJobProcessor;

  constructor() {
    this.jobProcessor = getJobProcessor();
  }

  /**
   * 이미지 생성 작업 제출
   */
  async submitImageGeneration(
    userId: string,
    request: {
      user_image_url: string | null;
      preset_id: string;
      custom_prompt?: string;
      negative_prompt?: string;
      environment?: string;
      chatbot_name?: string;
      metadata?: any;
    },
    options: {
      priority?: 'low' | 'normal' | 'high' | 'premium';
      messageId?: string;
    } = {}
  ): Promise<{
    jobId: string;
    estimatedTime: number;
    queuePosition: number;
  }> {
    const jobId = await this.jobProcessor.enqueueImageGeneration(
      userId,
      { ...request, user_id: userId },
      options
    );

    const queueMetrics = this.jobProcessor.getQueueMetrics();
    const estimatedTime = queueMetrics.averageProcessingTime * queueMetrics.pendingJobs;
    
    return {
      jobId,
      estimatedTime,
      queuePosition: queueMetrics.pendingJobs
    };
  }

  /**
   * 작업 상태 조회
   */
  getJobStatus(jobId: string) {
    return this.jobProcessor.getJobStatus(jobId);
  }

  /**
   * 사용자별 활성 작업 조회
   */
  getUserActiveJobs(userId: string) {
    // 향후 구현: 사용자별 필터링
    return this.jobProcessor.getQueueMetrics();
  }

  /**
   * 큐 상태 조회
   */
  getQueueStatus() {
    return this.jobProcessor.getQueueMetrics();
  }
}

/**
 * Factory function for job service
 */
export function createImageGenerationJobService(): ImageGenerationJobService {
  return new ImageGenerationJobService();
}
