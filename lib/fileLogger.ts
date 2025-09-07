/**
 * Winston Daily Rotate File 기반 전체 로그 캡처 시스템
 * - 모든 console.log, stdout, stderr 캡처
 * - 일별 로그 파일 자동 순환
 * - 이전 일자 자동 압축 (gzip)
 * - n일 후 자동 삭제
 * - ComfyUI 요청/응답 포함 전체 터미널 로그 저장
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { WriteStream } from 'fs';

// 런타임 환경 감지
const isNodejsRuntime = () => {
  try {
    return typeof process !== 'undefined' && 
           process.versions && 
           process.versions.node &&
           typeof require !== 'undefined';
  } catch {
    return false;
  }
};

// 로그 디렉토리 경로 (Node.js Runtime에서만)
const LOG_DIR = isNodejsRuntime() 
  ? '/Users/astro/development/side_project/ai_chat/05_project/00_log/terminal'
  : '/tmp/logs'; // Edge Runtime 폴백 (사용되지 않음)

// 로그 레벨 타입
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// 커스텀 로그 인터페이스
interface LogData {
  message: string;
  [key: string]: any;
}

// 로그 설정 상수
const LOG_RETENTION_DAYS = 30;  // 30일 후 삭제
const ERROR_LOG_RETENTION_DAYS = 60;  // 오류 로그는 60일 보관
const MAX_LOG_SIZE = '50m';  // 파일 최대 크기 50MB
const MAX_ERROR_LOG_SIZE = '20m';  // 오류 로그 최대 크기 20MB

// 원본 console 함수들과 stdout/stderr 저장
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;
let originalConsoleWarn: typeof console.warn;
let originalConsoleInfo: typeof console.info;
let originalConsoleDebug: typeof console.debug;
let originalStdoutWrite: typeof process.stdout.write;
let originalStderrWrite: typeof process.stderr.write;

// Winston 로거 인스턴스 생성
const createLogger = () => {
  // Node.js Runtime이 아닌 경우 기본 로거 반환
  if (!isNodejsRuntime()) {
    return winston.createLogger({
      level: 'info',
      transports: []
    });
  }

  try {
    // 전체 로그용 일별 순환 파일 Transport (압축 활성화)
    const dailyRotateTransport = new DailyRotateFile({
      filename: path.join(LOG_DIR, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,  // 🔥 이전 일자 자동 압축 (gzip)
      maxSize: MAX_LOG_SIZE,
      maxFiles: `${LOG_RETENTION_DAYS}d`,  // 🔥 n일 후 자동 삭제
      auditFile: path.join(LOG_DIR, 'audit.json'),
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        // 🔥 터미널과 동일한 형태로 저장
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
        })
      )
    });

  // 오류 전용 일별 순환 파일 Transport (압축 활성화)
  const errorRotateTransport = new DailyRotateFile({
    filename: path.join(LOG_DIR, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    zippedArchive: true,  // 🔥 이전 일자 자동 압축 (gzip)
    maxSize: MAX_ERROR_LOG_SIZE,
    maxFiles: `${ERROR_LOG_RETENTION_DAYS}d`,  // 🔥 오류는 더 오래 보관
    auditFile: path.join(LOG_DIR, 'audit-error.json'),
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
      })
    )
  });

    // Winston 로거 생성 (Console Transport 제거 - stdout 캡처로 대체)
    const logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      transports: [
        dailyRotateTransport,
        errorRotateTransport
        // 🔥 Console Transport 제거 - 모든 출력을 직접 캡처
      ]
    });

  // 파일 순환 이벤트 리스너
  dailyRotateTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('로그 파일 순환됨', { oldFilename, newFilename });
  });

  errorRotateTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('오류 로그 파일 순환됨', { oldFilename, newFilename });
  });

  // 로그 파일 보관 완료 이벤트
  dailyRotateTransport.on('archive', (zipFilename) => {
    logger.info('로그 파일 아카이브됨', { zipFilename });
  });

  // 파일 삭제 완료 이벤트
  dailyRotateTransport.on('logRemoved', (removedFilename) => {
    logger.info(`${LOG_RETENTION_DAYS}일 경과로 로그 파일 삭제됨`, { removedFilename });
  });

    errorRotateTransport.on('logRemoved', (removedFilename) => {
      logger.info(`${ERROR_LOG_RETENTION_DAYS}일 경과로 오류 로그 파일 삭제됨`, { removedFilename });
    });

    return logger;

  } catch (error) {
    console.warn('Winston 로거 초기화 실패, 기본 로거 사용:', error);
    // Winston 초기화 실패 시 기본 로거 반환
    return winston.createLogger({
      level: 'info',
      transports: []
    });
  }
};

/**
 * 전체 로그 캡처 시스템 초기화
 * - 모든 console.* 함수 오버라이드
 * - process.stdout, process.stderr 캡처
 */
const initializeFullLogCapture = (logger: winston.Logger) => {
  // 원본 함수들 백업
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalConsoleWarn = console.warn;
  originalConsoleInfo = console.info;
  originalConsoleDebug = console.debug;
  originalStdoutWrite = process.stdout.write;
  originalStderrWrite = process.stderr.write;

  // 🔥 Console 함수들 오버라이드 (전체 로그 캡처)
  console.log = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.info(message);
    originalConsoleLog(...args); // 터미널에도 출력
  };

  console.error = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.error(message);
    originalConsoleError(...args); // 터미널에도 출력
  };

  console.warn = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.warn(message);
    originalConsoleWarn(...args); // 터미널에도 출력
  };

  console.info = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.info(message);
    originalConsoleInfo(...args); // 터미널에도 출력
  };

  console.debug = (...args: any[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    logger.debug(message);
    originalConsoleDebug(...args); // 터미널에도 출력
  };

  // 🔥 Process stdout 캡처 (직접 stdout.write 호출 캡처)
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    const message = chunk.toString().replace(/\n$/, ''); // 끝의 개행문자 제거
    if (message.trim()) { // 빈 메시지 제외
      logger.info(`[STDOUT] ${message}`);
    }
    return originalStdoutWrite.call(this, chunk, encoding, callback);
  };

  // 🔥 Process stderr 캡처 (직접 stderr.write 호출 캡처)
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    const message = chunk.toString().replace(/\n$/, ''); // 끝의 개행문자 제거
    if (message.trim()) { // 빈 메시지 제외
      logger.error(`[STDERR] ${message}`);
    }
    return originalStderrWrite.call(this, chunk, encoding, callback);
  };

  // 초기화 완료 로그
  logger.info('전체 로그 캡처 시스템 초기화 완료', {
    features: [
      '모든 console.* 함수 캡처',
      'process.stdout/stderr 캡처',
      '일별 로그 파일 순환',
      '이전 일자 자동 압축 (gzip)',
      `${LOG_RETENTION_DAYS}일 후 자동 삭제`,
      `최대 파일 크기: ${MAX_LOG_SIZE}`
    ]
  });
};

/**
 * 전체 로그 캡처 해제
 */
const restoreOriginalLogging = () => {
  if (originalConsoleLog) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
};

// 글로벌 로거 인스턴스
const logger = createLogger();

/**
 * 전체 로그 캡처 파일 로거 클래스
 */
export class FileLogger {
  private static instance: FileLogger;
  private logger: winston.Logger;
  private isFullCaptureActive: boolean = false;

  constructor() {
    this.logger = logger;
  }

  static getInstance(): FileLogger {
    if (!FileLogger.instance) {
      FileLogger.instance = new FileLogger();
    }
    return FileLogger.instance;
  }

  /**
   * 전체 로그 캡처 시작
   * - 모든 console.*, stdout, stderr을 파일로 저장
   */
  startFullCapture(): void {
    if (!this.isFullCaptureActive) {
      initializeFullLogCapture(this.logger);
      this.isFullCaptureActive = true;
    }
  }

  /**
   * 전체 로그 캡처 중지
   */
  stopFullCapture(): void {
    if (this.isFullCaptureActive) {
      restoreOriginalLogging();
      this.isFullCaptureActive = false;
      this.logger.info('전체 로그 캡처 시스템 해제됨');
    }
  }

  /**
   * 캡처 상태 확인
   */
  isCapturing(): boolean {
    return this.isFullCaptureActive;
  }

  /**
   * 정보 로그
   */
  info(message: string, data?: LogData): void {
    try {
      this.logger.info(message, data);
    } catch (error) {
      console.log(message, data); // 폴백
    }
  }

  /**
   * 경고 로그
   */
  warn(message: string, data?: LogData): void {
    try {
      this.logger.warn(message, data);
    } catch (error) {
      console.warn(message, data); // 폴백
    }
  }

  /**
   * 오류 로그
   */
  error(message: string, error?: Error | any, data?: LogData): void {
    try {
      const logData = {
        ...data,
        ...(error && {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : error
        })
      };
      this.logger.error(message, logData);
    } catch (err) {
      console.error(message, error, data); // 폴백
    }
  }

  /**
   * 디버그 로그
   */
  debug(message: string, data?: LogData): void {
    try {
      this.logger.debug(message, data);
    } catch (error) {
      console.debug(message, data); // 폴백
    }
  }

  /**
   * ComfyUI 요청 로그 (요청 페이로드 전체 저장)
   */
  logComfyUIRequest(endpoint: string, payload: any, metadata?: any): void {
    try {
      this.info('ComfyUI 요청 시작', {
        type: 'COMFYUI_REQUEST',
        endpoint,
        payload,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('ComfyUI 요청 시작:', { endpoint, payload, metadata });
    }
  }

  /**
   * ComfyUI 응답 로그 (응답 데이터 전체 저장)
   */
  logComfyUIResponse(endpoint: string, response: any, success: boolean, processingTime: number, metadata?: any): void {
    try {
      this.info('ComfyUI 응답 수신', {
        type: 'COMFYUI_RESPONSE',
        endpoint,
        success,
        response,
        processingTime,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log('ComfyUI 응답 수신:', { endpoint, success, response, processingTime, metadata });
    }
  }

  /**
   * API 요청/응답 로그
   */
  logAPIRequest(method: string, endpoint: string, data?: any, metadata?: any): void {
    this.info('API 요청', {
      type: 'API_REQUEST',
      method,
      endpoint,
      data,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  logAPIResponse(method: string, endpoint: string, statusCode: number, responseData?: any, processingTime?: number): void {
    this.info('API 응답', {
      type: 'API_RESPONSE',
      method,
      endpoint,
      statusCode,
      responseData,
      processingTime,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 사용자 액션 로그
   */
  logUserAction(userId: string, action: string, data?: any): void {
    this.info('사용자 액션', {
      type: 'USER_ACTION',
      userId: userId.substring(0, 8) + '...',  // 개인정보 보호
      action,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 쿼터 시스템 로그
   */
  logQuotaOperation(userId: string, quotaType: string, operation: 'check' | 'consume', result: any): void {
    this.info('쿼터 시스템 작업', {
      type: 'QUOTA_OPERATION',
      userId: userId.substring(0, 8) + '...',
      quotaType,
      operation,
      result,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 데이터베이스 작업 로그
   */
  logDBOperation(table: string, operation: string, success: boolean, error?: any, metadata?: any): void {
    if (success) {
      this.info('데이터베이스 작업 성공', {
        type: 'DB_OPERATION',
        table,
        operation,
        success,
        metadata,
        timestamp: new Date().toISOString()
      });
    } else {
      this.error('데이터베이스 작업 실패', error, {
        type: 'DB_OPERATION',
        table,
        operation,
        success,
        metadata,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 성능 측정 로그
   */
  logPerformance(operation: string, duration: number, metadata?: any): void {
    this.info('성능 측정', {
      type: 'PERFORMANCE',
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    });
  }
}

// 기본 export: 싱글톤 인스턴스 (자동으로 전체 캡처 시작)
export const fileLogger = FileLogger.getInstance();

// 🔥 Node.js Runtime에서만 자동으로 전체 로그 캡처 시작
// Edge Runtime에서는 실행되지 않도록 조건부 처리
if (isNodejsRuntime()) {
  try {
    fileLogger.startFullCapture();
  } catch (error) {
    // Edge Runtime이나 제한된 환경에서는 기본 console만 사용
    console.warn('로깅 시스템 초기화 실패 (제한된 런타임 환경):', error);
  }
}

// 간편 사용을 위한 함수들 (기존 유지)
export const logInfo = (message: string, data?: LogData) => fileLogger.info(message, data);
export const logWarn = (message: string, data?: LogData) => fileLogger.warn(message, data);
export const logError = (message: string, error?: Error | any, data?: LogData) => fileLogger.error(message, error, data);
export const logDebug = (message: string, data?: LogData) => fileLogger.debug(message, data);

// ComfyUI 전용 로깅 함수들 (기존 유지 + 향상된 기능)
export const logComfyUIRequest = (endpoint: string, payload: any, metadata?: any) => 
  fileLogger.logComfyUIRequest(endpoint, payload, metadata);

export const logComfyUIResponse = (endpoint: string, response: any, success: boolean, processingTime: number, metadata?: any) => 
  fileLogger.logComfyUIResponse(endpoint, response, success, processingTime, metadata);

// 전체 캡처 제어 함수들
export const startFullLogCapture = () => fileLogger.startFullCapture();
export const stopFullLogCapture = () => fileLogger.stopFullCapture();
export const isLogCapturing = () => fileLogger.isCapturing();

// 로그 설정 정보
export const getLogConfig = () => ({
  logDir: LOG_DIR,
  retentionDays: LOG_RETENTION_DAYS,
  errorRetentionDays: ERROR_LOG_RETENTION_DAYS,
  maxLogSize: MAX_LOG_SIZE,
  maxErrorLogSize: MAX_ERROR_LOG_SIZE,
  compressionEnabled: true,
  autoDeleteEnabled: true
});

// 프로세스 종료 시 정리 작업 (Node.js Runtime에서만)
if (isNodejsRuntime()) {
  process.on('exit', () => {
    fileLogger.stopFullCapture();
  });

  process.on('SIGINT', () => {
    fileLogger.stopFullCapture();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    fileLogger.stopFullCapture();
    process.exit(0);
  });
}