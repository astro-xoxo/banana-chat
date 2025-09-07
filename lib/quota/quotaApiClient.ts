// 파일 위치: /lib/quota/quotaApiClient.ts

import { NextRequest } from 'next/server';
import { QuotaType } from '@/types/quota';

/**
 * 쿼터 API 응답 인터페이스
 */
interface QuotaApiResponse {
  success: boolean;
  remaining: number;
  error?: string;
  quota_info?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

/**
 * 쿼터 조회 응답 인터페이스
 */
interface QuotaCheckResponse {
  canUse: boolean;
  remaining: number;
  quotas?: Array<{
    type: string;
    used: number;
    limit: number;
    canUse: boolean;
    nextResetAt: string | null;
  }>;
}

/**
 * 쿼터 API 클라이언트
 * 
 * 모든 쿼터 관련 작업을 중앙 API를 통해 처리합니다.
 * 환경변수 의존성을 제거하고 일관된 인터페이스를 제공합니다.
 * 
 * @example
 * // 쿼터 소진
 * const result = await QuotaApiClient.consume(request, QuotaType.PROFILE_IMAGE_GENERATION);
 * 
 * // 쿼터 확인
 * const status = await QuotaApiClient.check(request, QuotaType.CHAT_MESSAGES);
 */
export class QuotaApiClient {
  /**
   * 쿼터 소진
   * 
   * @param request - Next.js 요청 객체 (인증 쿠키 포함)
   * @param quotaType - 소진할 쿼터 타입
   * @param amount - 소진할 양 (기본값: 1)
   * @returns 쿼터 소진 결과
   */
  static async consume(
    request: NextRequest,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<QuotaApiResponse> {
    try {
      console.log(`[QuotaApiClient] 쿼터 소진 요청: ${quotaType}, 수량: ${amount}`);
      
      const cookies = request.headers.get('cookie') || '';
      const authorization = request.headers.get('authorization') || '';
      const baseUrl = this.getBaseUrl();
      
      // URL 유효성 검증
      if (baseUrl.includes('localhost') && process.env.VERCEL_ENV === 'production') {
        console.error('[QuotaApiClient] Critical: localhost URL in production!');
        throw new Error('Invalid BASE_URL in production environment');
      }
      
      console.log(`[QuotaApiClient] 쿼터 소진 요청: ${quotaType}, 수량: ${amount}, URL: ${baseUrl}`);
      console.log(`[QuotaApiClient] 🔐 Authorization 헤더 포함:`, !!authorization);
      
      // Authorization 헤더와 쿠키 모두 포함하여 전달
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cookie': cookies, // 인증 정보 전달 (기존 호환성)
      };
      
      // Authorization 헤더가 있으면 포함 (Google OAuth 지원)
      if (authorization) {
        headers['Authorization'] = authorization;
      }
      
      const response = await fetch(`${baseUrl}/api/quota/consume`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          quota_type: quotaType,
          amount
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('[QuotaApiClient] 쿼터 소진 실패:', result);
        return {
          success: false,
          remaining: result.quota_info?.remaining || 0,
          error: result.message || '쿼터 처리 중 오류가 발생했습니다.'
        };
      }

      console.log('[QuotaApiClient] 쿼터 소진 성공:', result.quota_info);
      return {
        success: true,
        remaining: result.quota_info?.remaining || 0,
        quota_info: result.quota_info
      };
      
    } catch (error) {
      console.error('[QuotaApiClient] 상세 오류 정보:', {
        error: error instanceof Error ? error.message : error,
        baseUrl: this.getBaseUrl(),
        environment: process.env.VERCEL_ENV,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        remaining: 0,
        error: '쿼터 API 연결에 실패했습니다.'
      };
    }
  }

  /**
   * 쿼터 조회
   * 
   * @param request - Next.js 요청 객체 (인증 쿠키 포함)
   * @param quotaType - 조회할 특정 쿼터 타입 (선택사항)
   * @returns 쿼터 상태 정보
   */
  static async check(
    request: NextRequest,
    quotaType?: QuotaType
  ): Promise<QuotaCheckResponse> {
    try {
      console.log(`[QuotaApiClient] 쿼터 조회 요청: ${quotaType || '전체'}`);
      
      const cookies = request.headers.get('cookie') || '';
      const authorization = request.headers.get('authorization') || '';
      const baseUrl = this.getBaseUrl();
      
      console.log(`[QuotaApiClient] 쿼터 조회 요청: ${quotaType || '전체'}`);
      console.log(`[QuotaApiClient] 🔐 Authorization 헤더 포함:`, !!authorization);
      
      // Authorization 헤더와 쿠키 모두 포함하여 전달
      const headers: Record<string, string> = {
        'Cookie': cookies, // 인증 정보 전달 (기존 호환성)
      };
      
      // Authorization 헤더가 있으면 포함 (Google OAuth 지원)
      if (authorization) {
        headers['Authorization'] = authorization;
      }
      
      const response = await fetch(`${baseUrl}/api/quota`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('[QuotaApiClient] 쿼터 조회 실패:', result);
        return {
          canUse: false,
          remaining: 0
        };
      }

      // 특정 쿼터 타입만 필터링
      if (quotaType) {
        const quota = result.quotas?.find((q: any) => q.type === quotaType);
        return {
          canUse: quota?.canUse || false,
          remaining: quota ? (quota.limit - quota.used) : 0,
          quotas: result.quotas
        };
      }

      // 전체 쿼터 정보 반환
      return {
        canUse: true,
        remaining: 0,
        quotas: result.quotas
      };
      
    } catch (error) {
      console.error('[QuotaApiClient] 쿼터 조회 실패:', error);
      return {
        canUse: false,
        remaining: 0
      };
    }
  }

  /**
   * 베이스 URL 결정 (환경별 자동 설정)
   * 
   * 우선순위:
   * 1. 프로덕션 환경: 확정된 도메인 사용
   * 2. 개발 환경: localhost 사용
   * 3. 안전장치: localhost 기본값
   * 
   * @returns API 베이스 URL
   */
  private static getBaseUrl(): string {
    // 디버깅 로그
    const environment = {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
    };
    
    console.log('[QuotaApiClient] Environment check:', environment);
    
    // 프로덕션 환경 (확실한 도메인)
    if (process.env.VERCEL_ENV === 'production') {
      const prodUrl = 'https://ai-face-chatbot.vercel.app';
      console.log('[QuotaApiClient] Using production URL:', prodUrl);
      return prodUrl;
    }
    
    // 개발 환경
    if (process.env.NODE_ENV === 'development') {
      const devUrl = 'http://localhost:3000';
      console.log('[QuotaApiClient] Using development URL:', devUrl);
      return devUrl;
    }
    
    // 기본값 (안전장치)
    const defaultUrl = 'http://localhost:3000';
    console.log('[QuotaApiClient] Using fallback URL:', defaultUrl);
    return defaultUrl;
  }

  /**
   * 쿼터 롤백 (실패 시 사용)
   * 
   * @param request - Next.js 요청 객체
   * @param quotaType - 롤백할 쿼터 타입
   * @param amount - 롤백할 양
   * @returns 롤백 성공 여부
   */
  static async rollback(
    request: NextRequest,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<boolean> {
    console.log(`[QuotaApiClient] 쿼터 롤백 요청: ${quotaType}, 수량: ${amount}`);
    
    // API 기반 시스템에서는 트랜잭션이 자동으로 롤백되므로
    // 별도의 롤백 API가 필요한 경우에만 구현
    // 현재는 로깅만 수행
    
    return true;
  }
}

/**
 * 쿼터 API 헬퍼 함수들 (간편 사용을 위한 래퍼)
 */

/**
 * 프로필 이미지 생성 쿼터 소진
 */
export async function consumeProfileImageQuota(request: NextRequest): Promise<QuotaApiResponse> {
  return QuotaApiClient.consume(request, QuotaType.PROFILE_IMAGE_GENERATION);
}

/**
 * 채팅 메시지 쿼터 소진
 */
export async function consumeChatMessageQuota(request: NextRequest): Promise<QuotaApiResponse> {
  return QuotaApiClient.consume(request, QuotaType.CHAT_MESSAGES);
}

/**
 * 챗봇 생성 쿼터 소진
 */
export async function consumeChatbotCreationQuota(request: NextRequest): Promise<QuotaApiResponse> {
  return QuotaApiClient.consume(request, QuotaType.CHATBOT_CREATION);
}
