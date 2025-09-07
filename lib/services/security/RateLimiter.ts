/**
 * RateLimiter - 요청 속도 제한 서비스
 * Task 012: Implement Security and Validation Systems
 */

import type { RateLimitResult, RateLimitConfig } from './types';

interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

export class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 5분마다 만료된 항목 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 요청 속도 제한 확인
   */
  async checkRateLimit(
    userId: string,
    action: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      const key = this.generateKey(userId, action, config.keyGenerator);
      const now = new Date();

      // 기존 항목 조회
      let entry = this.cache.get(key);

      // 새로운 항목 또는 윈도우 초기화
      if (!entry || entry.resetTime <= now) {
        entry = {
          count: 0,
          resetTime: new Date(now.getTime() + config.windowMs),
          firstRequest: now
        };
      }

      // 요청 수 증가
      entry.count++;
      this.cache.set(key, entry);

      // 제한 확인
      const allowed = entry.count <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - entry.count);
      const retryAfter = allowed ? undefined : Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);

      const result: RateLimitResult = {
        allowed,
        limit: config.maxRequests,
        remaining,
        resetTime: entry.resetTime,
        retryAfter
      };

      console.log('RateLimiter: 속도 제한 확인', {
        userId,
        action,
        key: this.maskKey(key),
        count: entry.count,
        limit: config.maxRequests,
        allowed,
        remaining,
        retryAfter
      });

      return result;

    } catch (error) {
      console.error('RateLimiter: 속도 제한 확인 오류', { userId, action, error });
      
      // 오류 시 허용 (fail-open)
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  /**
   * 특정 사용자의 속도 제한 초기화
   */
  async resetRateLimit(userId: string, action: string): Promise<void> {
    try {
      const key = this.generateKey(userId, action);
      this.cache.delete(key);
      
      console.log('RateLimiter: 속도 제한 초기화', { userId, action });
      
    } catch (error) {
      console.error('RateLimiter: 속도 제한 초기화 오류', { userId, action, error });
    }
  }

  /**
   * 사용자의 현재 속도 제한 상태 조회
   */
  async getRateLimitStatus(
    userId: string,
    action: string,
    config: RateLimitConfig
  ): Promise<{
    current: number;
    limit: number;
    remaining: number;
    resetTime: Date;
    blocked: boolean;
  }> {
    try {
      const key = this.generateKey(userId, action, config.keyGenerator);
      const entry = this.cache.get(key);
      const now = new Date();

      if (!entry || entry.resetTime <= now) {
        return {
          current: 0,
          limit: config.maxRequests,
          remaining: config.maxRequests,
          resetTime: new Date(now.getTime() + config.windowMs),
          blocked: false
        };
      }

      const remaining = Math.max(0, config.maxRequests - entry.count);
      const blocked = entry.count >= config.maxRequests;

      return {
        current: entry.count,
        limit: config.maxRequests,
        remaining,
        resetTime: entry.resetTime,
        blocked
      };

    } catch (error) {
      console.error('RateLimiter: 속도 제한 상태 조회 오류', { userId, action, error });
      
      return {
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs),
        blocked: false
      };
    }
  }

  /**
   * 키 생성
   */
  private generateKey(
    userId: string,
    action: string,
    keyGenerator?: (userId: string, action: string) => string
  ): string {
    if (keyGenerator) {
      return keyGenerator(userId, action);
    }
    return `${userId}:${action}`;
  }

  /**
   * 키 파싱
   */
  private parseKey(key: string): { userId: string; action: string } {
    const [userId, action] = key.split(':');
    return { userId, action };
  }

  /**
   * 키 마스킹 (로그용)
   */
  private maskKey(key: string): string {
    const { userId, action } = this.parseKey(key);
    const maskedUserId = userId.length > 8 
      ? `${userId.substring(0, 4)}***${userId.substring(userId.length - 4)}`
      : `${userId.substring(0, 2)}***`;
    return `${maskedUserId}:${action}`;
  }

  /**
   * 만료된 항목 정리
   */
  private cleanup(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.resetTime <= now) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log('RateLimiter: 만료된 항목 정리 완료', {
        removed: removedCount,
        remaining: this.cache.size
      });
    }
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

/**
 * 기본 속도 제한 설정
 */
export const DEFAULT_RATE_LIMITS = {
  image_generation: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },
  
  image_download: {
    windowMs: 60 * 1000, // 1분  
    maxRequests: 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  style_learning: {
    windowMs: 5 * 60 * 1000, // 5분
    maxRequests: 5,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },
  
  prompt_enhancement: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 20,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  }
} as const;

/**
 * 사용자 등급별 속도 제한 설정
 */
export const TIER_BASED_RATE_LIMITS = {
  free: {
    image_generation: { windowMs: 60 * 1000, maxRequests: 5 },
    image_download: { windowMs: 60 * 1000, maxRequests: 15 },
    style_learning: { windowMs: 10 * 60 * 1000, maxRequests: 2 }
  },
  
  premium: {
    image_generation: { windowMs: 60 * 1000, maxRequests: 20 },
    image_download: { windowMs: 60 * 1000, maxRequests: 50 },
    style_learning: { windowMs: 5 * 60 * 1000, maxRequests: 10 }
  },
  
  enterprise: {
    image_generation: { windowMs: 60 * 1000, maxRequests: 100 },
    image_download: { windowMs: 60 * 1000, maxRequests: 200 },
    style_learning: { windowMs: 60 * 1000, maxRequests: 50 }
  }
} as const;
