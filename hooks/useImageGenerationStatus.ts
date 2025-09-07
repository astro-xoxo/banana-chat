/**
 * React Hook for Image Generation Status Updates
 * 
 * Provides real-time status updates for image generation with WebSocket
 * and polling fallback mechanisms.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ImageGenerationStatus,
  ImageGenerationProgress,
  StatusUpdateOptions,
  ClientToServerMessage,
  ServerToClientMessage,
  SubscribeMessage,
  UnsubscribeMessage
} from '../websockets/types';

export interface UseImageGenerationStatusOptions {
  /** Whether to automatically start monitoring */
  autoStart?: boolean;
  
  /** Whether to use WebSocket (default: true) */
  useWebSocket?: boolean;
  
  /** Whether to fall back to polling if WebSocket fails (default: true) */
  enablePollingFallback?: boolean;
  
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number;
  
  /** Maximum polling duration in milliseconds (default: 300000 - 5 minutes) */
  maxPollingDuration?: number;
  
  /** Whether to include detailed progress information */
  includeDetailedProgress?: boolean;
  
  /** Whether to include metadata in updates */
  includeMetadata?: boolean;
  
  /** Callback when status changes */
  onStatusChange?: (status: ImageGenerationStatus, progress: ImageGenerationProgress) => void;
  
  /** Callback when generation completes successfully */
  onComplete?: (progress: ImageGenerationProgress) => void;
  
  /** Callback when generation fails */
  onError?: (error: string, progress?: ImageGenerationProgress) => void;
  
  /** Callback when connection status changes */
  onConnectionChange?: (connected: boolean, method: 'websocket' | 'polling') => void;
}

export interface UseImageGenerationStatusReturn {
  /** Current generation status */
  status: ImageGenerationStatus;
  
  /** Current progress (0-100) */
  progress: number;
  
  /** Current step description */
  currentStep?: string;
  
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  
  /** Whether currently connected for updates */
  isConnected: boolean;
  
  /** Current connection method */
  connectionMethod: 'websocket' | 'polling' | 'none';
  
  /** Error message if any */
  error?: string;
  
  /** Complete progress information */
  progressInfo?: ImageGenerationProgress;
  
  /** Start monitoring for updates */
  startMonitoring: () => void;
  
  /** Stop monitoring */
  stopMonitoring: () => void;
  
  /** Manually refresh status (for polling) */
  refreshStatus: () => Promise<void>;
  
  /** Whether currently monitoring */
  isMonitoring: boolean;
}

export function useImageGenerationStatus(
  messageId: string,
  userId: string,
  options: UseImageGenerationStatusOptions = {}
): UseImageGenerationStatusReturn {
  const {
    autoStart = true,
    useWebSocket = true,
    enablePollingFallback = true,
    pollingInterval = 2000,
    maxPollingDuration = 300000,
    includeDetailedProgress = false,
    includeMetadata = false,
    onStatusChange,
    onComplete,
    onError,
    onConnectionChange
  } = options;

  // State
  const [status, setStatus] = useState<ImageGenerationStatus>('pending');
  const [progress, setProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string | undefined>();
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionMethod, setConnectionMethod] = useState<'websocket' | 'polling' | 'none'>('none');
  const [error, setError] = useState<string | undefined>();
  const [progressInfo, setProgressInfo] = useState<ImageGenerationProgress | undefined>();
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  // WebSocket URL
  const wsUrl = useRef<string>('');
  
  // Initialize WebSocket URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.current = `${protocol}//${window.location.host}/ws/image-status`;
    }
  }, []);

  // Update progress information
  const updateProgress = useCallback((newProgress: ImageGenerationProgress) => {
    console.log(`[useImageGenerationStatus] Status update for ${messageId}:`, newProgress);

    setStatus(newProgress.status);
    setProgress(newProgress.progress);
    setCurrentStep(newProgress.currentStep);
    setEstimatedTimeRemaining(newProgress.estimatedTimeRemaining);
    setProgressInfo(newProgress);

    // Clear error on successful update
    if (error && newProgress.status !== 'failed') {
      setError(undefined);
    }

    // Set error if status is failed
    if (newProgress.status === 'failed' && newProgress.metadata?.errorMessage) {
      setError(newProgress.metadata.errorMessage);
    }

    // Trigger callbacks
    onStatusChange?.(newProgress.status, newProgress);

    if (newProgress.status === 'completed') {
      onComplete?.(newProgress);
      stopMonitoring();
    } else if (newProgress.status === 'failed') {
      onError?.(newProgress.metadata?.errorMessage || 'Generation failed', newProgress);
      stopMonitoring();
    }
  }, [messageId, error, onStatusChange, onComplete, onError]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!useWebSocket || !wsUrl.current) {
      return false;
    }

    try {
      console.log(`[useImageGenerationStatus] Connecting to WebSocket: ${wsUrl.current}`);
      
      const ws = new WebSocket(wsUrl.current);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[useImageGenerationStatus] WebSocket connected for ${messageId}`);
        setIsConnected(true);
        setConnectionMethod('websocket');
        reconnectAttempts.current = 0;
        
        // Subscribe to message updates
        const subscribeMessage: SubscribeMessage = {
          type: 'subscribe',
          timestamp: new Date().toISOString(),
          payload: {
            messageId,
            userId,
            options: {
              includeDetailedProgress,
              includeMetadata
            }
          }
        };

        ws.send(JSON.stringify(subscribeMessage));
        onConnectionChange?.(true, 'websocket');
      };

      ws.onmessage = (event) => {
        try {
          const message: ServerToClientMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'status_update':
              if (message.payload.messageId === messageId) {
                updateProgress(message.payload.progress);
              }
              break;
            case 'error':
              console.error(`[useImageGenerationStatus] WebSocket error:`, message.payload);
              setError(message.payload.message);
              break;
            case 'connection_status':
              console.log(`[useImageGenerationStatus] Connection status:`, message.payload);
              break;
            case 'heartbeat':
              // Handle heartbeat if needed
              break;
          }
        } catch (err) {
          console.error(`[useImageGenerationStatus] Failed to parse WebSocket message:`, err);
        }
      };

      ws.onclose = () => {
        console.log(`[useImageGenerationStatus] WebSocket disconnected for ${messageId}`);
        setIsConnected(false);
        onConnectionChange?.(false, 'websocket');
        
        // Attempt reconnection or fall back to polling
        if (isMonitoring && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`[useImageGenerationStatus] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        } else if (isMonitoring && enablePollingFallback) {
          console.log(`[useImageGenerationStatus] Falling back to polling for ${messageId}`);
          startPolling();
        }
      };

      ws.onerror = (err) => {
        console.error(`[useImageGenerationStatus] WebSocket error for ${messageId}:`, err);
        if (enablePollingFallback && isMonitoring) {
          startPolling();
        }
      };

      return true;
    } catch (err) {
      console.error(`[useImageGenerationStatus] Failed to connect WebSocket:`, err);
      return false;
    }
  }, [useWebSocket, messageId, userId, includeDetailedProgress, includeMetadata, enablePollingFallback, isMonitoring, onConnectionChange, updateProgress]);

  // Polling mechanism
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    console.log(`[useImageGenerationStatus] Starting polling for ${messageId}`);
    setConnectionMethod('polling');
    setIsConnected(true);
    onConnectionChange?.(true, 'polling');

    const poll = async () => {
      try {
        console.log(`[useImageGenerationStatus] Polling status for ${messageId}`);
        
        const response = await fetch(`/api/chat/image-status/${messageId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.progress) {
          updateProgress(data.progress);
        }

        // Stop polling if generation is complete or failed
        if (['completed', 'failed', 'cancelled', 'expired'].includes(data.progress?.status)) {
          stopMonitoring();
        }
      } catch (err) {
        console.error(`[useImageGenerationStatus] Polling error for ${messageId}:`, err);
        setError(err instanceof Error ? err.message : 'Polling failed');
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, pollingInterval);

    // Stop polling after maximum duration
    setTimeout(() => {
      if (pollingIntervalRef.current && isMonitoring) {
        console.log(`[useImageGenerationStatus] Polling timeout reached for ${messageId}`);
        stopMonitoring();
      }
    }, maxPollingDuration);
  }, [messageId, pollingInterval, maxPollingDuration, isMonitoring, onConnectionChange, updateProgress]);

  // Manual refresh
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/chat/image-status/${messageId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.progress) {
        updateProgress(data.progress);
      }
    } catch (err) {
      console.error(`[useImageGenerationStatus] Manual refresh failed:`, err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
    }
  }, [messageId, updateProgress]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) {
      return;
    }

    console.log(`[useImageGenerationStatus] Starting monitoring for ${messageId}`);
    setIsMonitoring(true);
    setError(undefined);
    startTimeRef.current = Date.now();

    // Try WebSocket first, fall back to polling if necessary
    const wsConnected = connectWebSocket();
    if (!wsConnected && enablePollingFallback) {
      startPolling();
    }
  }, [isMonitoring, messageId, connectWebSocket, enablePollingFallback, startPolling]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    console.log(`[useImageGenerationStatus] Stopping monitoring for ${messageId}`);
    
    setIsMonitoring(false);
    setIsConnected(false);
    setConnectionMethod('none');

    // Clean up WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const unsubscribeMessage: UnsubscribeMessage = {
          type: 'unsubscribe',
          timestamp: new Date().toISOString(),
          payload: {
            messageId,
            userId
          }
        };
        wsRef.current.send(JSON.stringify(unsubscribeMessage));
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clean up polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Clean up reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    onConnectionChange?.(false, 'none');
  }, [messageId, userId, onConnectionChange]);

  // Auto-start monitoring
  useEffect(() => {
    if (autoStart && messageId && userId) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [autoStart, messageId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    status,
    progress,
    currentStep,
    estimatedTimeRemaining,
    isConnected,
    connectionMethod,
    error,
    progressInfo,
    startMonitoring,
    stopMonitoring,
    refreshStatus,
    isMonitoring
  };
}
