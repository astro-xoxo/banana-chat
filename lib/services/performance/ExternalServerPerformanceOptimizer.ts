/**
 * External Server Performance Optimizer
 * Task 013: Performance Optimization - Unified Service
 * 
 * Integrates all performance optimization components:
 * - OptimizedComfyUIClient for connection management
 * - ImageCacheManager for intelligent caching
 * - BackgroundJobProcessor for queue management
 * - PerformanceMonitor for metrics tracking
 */

import { OptimizedComfyUIClient, createOptimizedComfyUIClient, type OptimizedComfyUIRequest } from '../../comfyui/optimized-client';
import { ImageCacheManager, createImageCacheManager } from './ImageCacheManager';
import { getJobProcessor, type ImageGenerationJobService, createImageGenerationJobService } from './BackgroundJobProcessor';
import { getPerformanceMonitor, recordImageGenerationMetric, recordCacheMetric } from './PerformanceMonitor';
import type { ComfyUIResponse } from '../../comfyui/client';

interface OptimizedGenerationRequest {
  // Core request parameters
  user_image_url: string | null;
  preset_id: string;
  user_id: string;
  
  // Optional parameters
  environment?: string;
  chatbot_name?: string;
  custom_prompt?: string;
  negative_prompt?: string;
  metadata?: any;
  
  // Optimization parameters
  priority?: 'low' | 'normal' | 'high' | 'premium';
  use_cache?: boolean;
  use_background_processing?: boolean;
  timeout?: number;
  correlation_id?: string;
  message_id?: string;
}

interface OptimizedGenerationResult {
  // Core result
  success: boolean;
  result?: ComfyUIResponse;
  error?: string;
  
  // Performance metrics
  metrics: {
    total_time: number;
    cache_hit: boolean;
    cache_access_time?: number;
    network_latency?: number;
    server_processing_time?: number;
    queue_wait_time?: number;
    retry_count: number;
  };
  
  // Processing info
  processing_info: {
    request_id: string;
    correlation_id: string;
    job_id?: string;
    cache_key?: string;
    optimization_applied: string[];
    background_processed: boolean;
  };
  
  // System status
  system_status: {
    queue_length: number;
    cache_hit_rate: number;
    system_health: 'healthy' | 'degraded' | 'critical';
  };
}

/**
 * External Server Performance Optimizer
 * Main service that coordinates all performance optimization features
 */
export class ExternalServerPerformanceOptimizer {
  private readonly comfyuiClient: OptimizedComfyUIClient;
  private readonly cacheManager: ImageCacheManager;
  private readonly jobService: ImageGenerationJobService;
  private readonly performanceMonitor;
  private readonly defaultTimeout: number = 300000; // 5분

  constructor() {
    this.comfyuiClient = createOptimizedComfyUIClient();
    this.cacheManager = createImageCacheManager();
    this.jobService = createImageGenerationJobService();
    this.performanceMonitor = getPerformanceMonitor();
    
    console.log('🚀 ExternalServerPerformanceOptimizer initialized');
  }

  /**
   * 최적화된 이미지 생성 (메인 엔트리 포인트)
   */
  async optimizedGenerate(request: OptimizedGenerationRequest): Promise<OptimizedGenerationResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    const correlationId = request.correlation_id || requestId;
    
    console.log(`🚀 OptimizedGenerate: Starting request ${requestId}`);
    
    const optimizationApplied: string[] = [];
    let cacheHit = false;
    let cacheAccessTime: number | undefined;
    let queueWaitTime: number | undefined;
    let jobId: string | undefined;
    let cacheKey: string | undefined;

    try {
      // 1. 캐시 확인 (활성화된 경우)
      let cachedResult: any = null;
      if (request.use_cache !== false && request.custom_prompt) {
        const cacheStartTime = Date.now();
        
        const cacheResult = await this.cacheManager.findSimilarImage(
          request.custom_prompt,
          request.user_id,
          request.preset_id
        );
        
        cacheAccessTime = Date.now() - cacheStartTime;
        
        if (cacheResult.cachedImage) {
          cachedResult = this.convertCachedToResponse(cacheResult.cachedImage);
          cacheHit = true;
          cacheKey = cacheResult.cachedImage.promptHash;
          optimizationApplied.push('cache_hit');
          
          // 캐시 메트릭 기록
          recordCacheMetric(requestId, cacheStartTime, Date.now(), {
            cacheHit: true,
            cacheKey,
            userId: request.user_id
          });
          
          console.log(`✅ Cache HIT: ${requestId} (${cacheAccessTime}ms)`);
        } else {
          optimizationApplied.push('cache_miss');
          
          // 캐시 미스 메트릭 기록
          recordCacheMetric(requestId, cacheStartTime, Date.now(), {
            cacheHit: false,
            userId: request.user_id
          });
        }
      }

      let finalResult: ComfyUIResponse;
      let networkLatency: number | undefined;
      let serverProcessingTime: number | undefined;
      let retryCount = 0;

      // 2. 캐시된 결과가 있으면 사용, 없으면 생성
      if (cachedResult) {
        finalResult = cachedResult;
        optimizationApplied.push('cache_served');
      } else {
        // 3. 백그라운드 처리 또는 직접 처리 결정
        if (request.use_background_processing && request.priority !== 'premium') {
          // 백그라운드 처리
          const queueStartTime = Date.now();
          
          const queueResult = await this.jobService.submitImageGeneration(
            request.user_id,
            {
              user_image_url: request.user_image_url,
              preset_id: request.preset_id,
              custom_prompt: request.custom_prompt,
              negative_prompt: request.negative_prompt,
              environment: request.environment,
              chatbot_name: request.chatbot_name,
              metadata: request.metadata
            },
            {
              priority: request.priority || 'normal',
              messageId: request.message_id
            }
          );
          
          jobId = queueResult.jobId;
          queueWaitTime = Date.now() - queueStartTime;
          optimizationApplied.push('background_queued');
          
          // 큐에 추가된 상태로 일단 응답 (실제 구현에서는 폴링이나 WebSocket 필요)
          throw new Error('Background processing not fully implemented in this version');
          
        } else {
          // 직접 처리 (최적화된 클라이언트 사용)
          optimizationApplied.push('optimized_client');
          
          const optimizedRequest: OptimizedComfyUIRequest = {
            user_image_url: request.user_image_url,
            preset_id: request.preset_id,
            user_id: request.user_id,
            environment: request.environment,
            chatbot_name: request.chatbot_name,
            custom_prompt: request.custom_prompt,
            negative_prompt: request.negative_prompt,
            metadata: request.metadata,
            priority: request.priority || 'normal',
            timeout: request.timeout || this.defaultTimeout,
            correlationId: correlationId
          };

          const clientResult = await this.comfyuiClient.generateImage(optimizedRequest);
          finalResult = clientResult.result;
          networkLatency = clientResult.metrics.networkLatency;
          serverProcessingTime = clientResult.metrics.serverProcessingTime;
          retryCount = clientResult.metrics.retryCount;
          
          if (clientResult.metrics.retryCount > 0) {
            optimizationApplied.push('retry_with_backoff');
          }
          
          // 4. 캐시에 저장 (성공한 경우에만)
          if (finalResult.success && request.custom_prompt && request.use_cache !== false) {
            await this.cacheManager.storeImage(
              request.custom_prompt,
              {
                imageUrl: finalResult.profile_image_url || finalResult.chat_image_url || '',
                chatImageUrl: finalResult.chat_image_url,
                profileImageUrl: finalResult.profile_image_url,
                generationJobId: finalResult.generation_job_id,
                userId: request.user_id,
                presetId: request.preset_id,
                environment: request.environment,
                chatbotName: request.chatbot_name,
                negativePrompt: request.negative_prompt,
                processingTime: serverProcessingTime || 0,
                metadata: request.metadata
              }
            );
            optimizationApplied.push('cache_stored');
          }
        }
      }

      const totalTime = Date.now() - startTime;

      // 5. 성능 메트릭 기록
      recordImageGenerationMetric(requestId, startTime, Date.now(), {
        userId: request.user_id,
        success: finalResult.success,
        error: finalResult.error,
        cacheHit,
        retryCount,
        networkLatency,
        serverProcessingTime,
        queueWaitTime,
        metadata: {
          preset_id: request.preset_id,
          optimization_applied: optimizationApplied,
          background_processed: !!jobId
        }
      });

      // 6. 시스템 상태 조회
      const systemHealth = this.performanceMonitor.getSystemHealth();
      const queueMetrics = this.jobService.getQueueStatus();
      const cacheMetrics = await this.cacheManager.getMetrics();

      console.log(`✅ OptimizedGenerate completed: ${requestId} (${totalTime}ms, optimizations: ${optimizationApplied.join(', ')})`);

      return {
        success: finalResult.success,
        result: finalResult,
        error: finalResult.error,
        metrics: {
          total_time: totalTime,
          cache_hit: cacheHit,
          cache_access_time: cacheAccessTime,
          network_latency: networkLatency,
          server_processing_time: serverProcessingTime,
          queue_wait_time: queueWaitTime,
          retry_count: retryCount
        },
        processing_info: {
          request_id: requestId,
          correlation_id: correlationId,
          job_id: jobId,
          cache_key: cacheKey,
          optimization_applied: optimizationApplied,
          background_processed: !!jobId
        },
        system_status: {
          queue_length: queueMetrics.pendingJobs,
          cache_hit_rate: cacheMetrics.hitRate,
          system_health: systemHealth.status
        }
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 실패 메트릭 기록
      recordImageGenerationMetric(requestId, startTime, Date.now(), {
        userId: request.user_id,
        success: false,
        error: errorMessage,
        cacheHit,
        retryCount,
        networkLatency,
        serverProcessingTime,
        queueWaitTime
      });

      console.error(`❌ OptimizedGenerate failed: ${requestId} (${totalTime}ms) - ${errorMessage}`);

      // 시스템 상태 조회 (오류 시에도)
      const systemHealth = this.performanceMonitor.getSystemHealth();
      const queueMetrics = this.jobService.getQueueStatus();
      const cacheMetrics = await this.cacheManager.getMetrics();

      return {
        success: false,
        error: errorMessage,
        metrics: {
          total_time: totalTime,
          cache_hit: cacheHit,
          cache_access_time: cacheAccessTime,
          network_latency: networkLatency,
          server_processing_time: serverProcessingTime,
          queue_wait_time: queueWaitTime,
          retry_count: retryCount
        },
        processing_info: {
          request_id: requestId,
          correlation_id: correlationId,
          job_id: jobId,
          cache_key: cacheKey,
          optimization_applied: optimizationApplied,
          background_processed: !!jobId
        },
        system_status: {
          queue_length: queueMetrics.pendingJobs,
          cache_hit_rate: cacheMetrics.hitRate,
          system_health: systemHealth.status
        }
      };
    }
  }

  /**
   * 캐시된 이미지를 ComfyUIResponse 형식으로 변환
   */
  private convertCachedToResponse(cachedImage: any): ComfyUIResponse {
    return {
      success: true,
      profile_image_url: cachedImage.profileImageUrl,
      chat_image_url: cachedImage.chatImageUrl || cachedImage.imageUrl,
      generation_job_id: cachedImage.generationJobId,
      processing_time: cachedImage.metadata.processingTime,
      metadata: {
        generation_job_id: cachedImage.generationJobId,
        character_type: cachedImage.metadata.presetId,
        server_version: 'cached',
        cache_hit: true,
        cached_at: cachedImage.accessStats.createdAt
      }
    };
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `opt_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 시스템 상태 조회
   */
  async getSystemStatus(): Promise<{
    health: 'healthy' | 'degraded' | 'critical';
    performance: any;
    cache: any;
    queue: any;
    alerts: any[];
  }> {
    const systemHealth = this.performanceMonitor.getSystemHealth();
    const realtimeMetrics = this.performanceMonitor.getRealTimeMetrics();
    const cacheMetrics = await this.cacheManager.getMetrics();
    const queueMetrics = this.jobService.getQueueStatus();
    const connectionStats = this.comfyuiClient.getConnectionStats();

    return {
      health: systemHealth.status,
      performance: {
        realtime: realtimeMetrics,
        connection_pool: connectionStats,
        alerts: systemHealth.alerts
      },
      cache: cacheMetrics,
      queue: queueMetrics,
      alerts: systemHealth.alerts
    };
  }

  /**
   * 캐시 관리
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clearCache();
    console.log('🧹 Cache cleared');
  }

  /**
   * 성능 메트릭 조회
   */
  getPerformanceMetrics(timeRange: 'last5min' | 'last15min' | 'lastHour' | 'last24Hours' = 'last15min') {
    switch (timeRange) {
      case 'last5min':
        return this.performanceMonitor.getRealTimeMetrics().last5Minutes;
      case 'last15min':
        return this.performanceMonitor.getRealTimeMetrics().last15Minutes;
      case 'lastHour':
        return this.performanceMonitor.getRealTimeMetrics().lastHour;
      case 'last24Hours':
        return this.performanceMonitor.getOperationMetrics('image_generation', 24);
    }
  }

  /**
   * 사용자별 성능 메트릭 조회
   */
  getUserPerformanceMetrics(userId: string, hours: number = 24) {
    return this.performanceMonitor.getUserMetrics(userId, hours);
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
    this.performanceMonitor.setAlertThresholds(thresholds);
  }
}

/**
 * Singleton instance management
 */
let globalOptimizer: ExternalServerPerformanceOptimizer | null = null;

/**
 * Get or create global optimizer instance
 */
export function getPerformanceOptimizer(): ExternalServerPerformanceOptimizer {
  if (!globalOptimizer) {
    globalOptimizer = new ExternalServerPerformanceOptimizer();
  }
  return globalOptimizer;
}

/**
 * Factory function for creating optimizer instance
 */
export function createPerformanceOptimizer(): ExternalServerPerformanceOptimizer {
  return new ExternalServerPerformanceOptimizer();
}

/**
 * High-level API for easy integration with existing code
 */
export async function callOptimizedComfyUIServer(
  userImageUrl: string | null,
  presetId: string,
  userId: string,
  options: {
    environment?: string;
    chatbotName?: string;
    customPrompt?: string;
    negativePrompt?: string;
    metadata?: any;
    priority?: 'low' | 'normal' | 'high' | 'premium';
    useCache?: boolean;
    useBackgroundProcessing?: boolean;
    timeout?: number;
    correlationId?: string;
    messageId?: string;
  } = {}
): Promise<{
  result: ComfyUIResponse;
  metrics: OptimizedGenerationResult['metrics'];
  processing_info: OptimizedGenerationResult['processing_info'];
  system_status: OptimizedGenerationResult['system_status'];
}> {
  const optimizer = getPerformanceOptimizer();
  
  const request: OptimizedGenerationRequest = {
    user_image_url: userImageUrl,
    preset_id: presetId,
    user_id: userId,
    environment: options.environment,
    chatbot_name: options.chatbotName,
    custom_prompt: options.customPrompt,
    negative_prompt: options.negativePrompt,
    metadata: options.metadata,
    priority: options.priority || 'normal',
    use_cache: options.useCache !== false, // 기본값: true
    use_background_processing: options.useBackgroundProcessing || false,
    timeout: options.timeout,
    correlation_id: options.correlationId,
    message_id: options.messageId
  };

  const result = await optimizer.optimizedGenerate(request);
  
  if (!result.success) {
    throw new Error(result.error || 'Image generation failed');
  }

  return {
    result: result.result!,
    metrics: result.metrics,
    processing_info: result.processing_info,
    system_status: result.system_status
  };
}

/**
 * Legacy compatibility wrapper
 * Maintains backward compatibility with existing callComfyUIServer function
 */
export async function callComfyUIServerOptimized(
  userImageUrl: string | null,
  presetId: string,
  userId: string,
  environment?: string,
  chatbotName?: string,
  customPrompt?: string,
  negativePrompt?: string,
  metadata?: any
): Promise<ComfyUIResponse> {
  try {
    const { result } = await callOptimizedComfyUIServer(
      userImageUrl,
      presetId,
      userId,
      {
        environment,
        chatbotName,
        customPrompt,
        negativePrompt,
        metadata,
        priority: 'normal',
        useCache: true,
        useBackgroundProcessing: false
      }
    );
    
    return result;
  } catch (error) {
    // 실패 시 기본 오류 응답 반환
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      processing_time: 0
    };
  }
}

/**
 * Performance monitoring utilities
 */
export const PerformanceUtils = {
  /**
   * 시스템 상태 조회
   */
  async getSystemStatus() {
    const optimizer = getPerformanceOptimizer();
    return await optimizer.getSystemStatus();
  },

  /**
   * 성능 메트릭 조회
   */
  getMetrics(timeRange?: 'last5min' | 'last15min' | 'lastHour' | 'last24Hours') {
    const optimizer = getPerformanceOptimizer();
    return optimizer.getPerformanceMetrics(timeRange);
  },

  /**
   * 사용자별 메트릭 조회
   */
  getUserMetrics(userId: string, hours?: number) {
    const optimizer = getPerformanceOptimizer();
    return optimizer.getUserPerformanceMetrics(userId, hours);
  },

  /**
   * 캐시 지우기
   */
  async clearCache() {
    const optimizer = getPerformanceOptimizer();
    await optimizer.clearCache();
  },

  /**
   * 알림 임계값 설정
   */
  setAlertThresholds(thresholds: {
    responseTime?: number;
    errorRate?: number;
    timeoutRate?: number;
    queueLength?: number;
    cacheHitRate?: number;
  }) {
    const optimizer = getPerformanceOptimizer();
    optimizer.setAlertThresholds(thresholds);
  }
};
