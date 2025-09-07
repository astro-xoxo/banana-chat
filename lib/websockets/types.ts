/**
 * WebSocket Types for Image Generation Status Updates
 * 
 * Defines TypeScript interfaces for real-time status communication
 * between client and server during image generation.
 */

export type ImageGenerationStatus = 
  | 'pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface ImageGenerationProgress {
  /** Current status of the generation */
  status: ImageGenerationStatus;
  
  /** Generation progress percentage (0-100) */
  progress: number;
  
  /** Current step description */
  currentStep?: string;
  
  /** Total steps in the process */
  totalSteps?: number;
  
  /** Current step number */
  currentStepNumber?: number;
  
  /** Estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  
  /** Additional metadata */
  metadata?: {
    /** Image URL when completed */
    imageUrl?: string;
    
    /** Error message if failed */
    errorMessage?: string;
    
    /** Generation parameters used */
    parameters?: Record<string, any>;
    
    /** Processing start time */
    startedAt?: string;
    
    /** Processing completion time */
    completedAt?: string;
    
    /** Server processing the request */
    serverId?: string;
  };
}

export interface WebSocketMessage {
  /** Message type identifier */
  type: string;
  
  /** Message timestamp */
  timestamp: string;
  
  /** Message payload */
  payload: Record<string, any>;
}

export interface SubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  payload: {
    /** Message ID to subscribe to */
    messageId: string;
    
    /** User ID for authorization */
    userId: string;
    
    /** Optional subscription options */
    options?: {
      /** Include detailed progress updates */
      includeDetailedProgress?: boolean;
      
      /** Include metadata in updates */
      includeMetadata?: boolean;
    };
  };
}

export interface UnsubscribeMessage extends WebSocketMessage {
  type: 'unsubscribe';
  payload: {
    /** Message ID to unsubscribe from */
    messageId: string;
    
    /** User ID for authorization */
    userId: string;
  };
}

export interface StatusUpdateMessage extends WebSocketMessage {
  type: 'status_update';
  payload: {
    /** Message ID this update refers to */
    messageId: string;
    
    /** Updated progress information */
    progress: ImageGenerationProgress;
    
    /** Update sequence number for ordering */
    sequenceNumber: number;
  };
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  payload: {
    /** Error code */
    code: string;
    
    /** Human-readable error message */
    message: string;
    
    /** Related message ID if applicable */
    messageId?: string;
    
    /** Additional error details */
    details?: Record<string, any>;
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: 'heartbeat';
  payload: {
    /** Server timestamp */
    serverTime: string;
    
    /** Connection uptime in seconds */
    uptime: number;
    
    /** Active subscriptions count */
    activeSubscriptions: number;
  };
}

export interface ConnectionStatusMessage extends WebSocketMessage {
  type: 'connection_status';
  payload: {
    /** Connection status */
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
    
    /** Status message */
    message?: string;
    
    /** Reconnection attempt number */
    reconnectAttempt?: number;
    
    /** Next reconnection delay in seconds */
    nextReconnectDelay?: number;
  };
}

export type ClientToServerMessage = 
  | SubscribeMessage
  | UnsubscribeMessage
  | HeartbeatMessage;

export type ServerToClientMessage = 
  | StatusUpdateMessage
  | ErrorMessage
  | HeartbeatMessage
  | ConnectionStatusMessage;

export interface WebSocketConfig {
  /** WebSocket server URL */
  url: string;
  
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  
  /** Maximum reconnection attempts */
  maxReconnectAttempts: number;
  
  /** Base reconnection delay in milliseconds */
  reconnectBaseDelay: number;
  
  /** Maximum reconnection delay in milliseconds */
  reconnectMaxDelay: number;
  
  /** Whether to use exponential backoff for reconnection */
  useExponentialBackoff: boolean;
}

export interface PollingConfig {
  /** Polling interval in milliseconds */
  interval: number;
  
  /** Maximum polling duration in milliseconds */
  maxDuration: number;
  
  /** Base URL for polling endpoints */
  baseUrl: string;
  
  /** Whether to use adaptive interval based on status */
  useAdaptiveInterval: boolean;
  
  /** Intervals for different statuses */
  adaptiveIntervals?: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export interface StatusUpdateOptions {
  /** Whether to use WebSocket for real-time updates */
  useWebSocket: boolean;
  
  /** Whether to fall back to polling if WebSocket fails */
  enablePollingFallback: boolean;
  
  /** WebSocket configuration */
  websocket: WebSocketConfig;
  
  /** Polling configuration */
  polling: PollingConfig;
  
  /** Whether to include detailed progress information */
  includeDetailedProgress: boolean;
  
  /** Whether to include metadata in updates */
  includeMetadata: boolean;
}

export interface ClientSubscription {
  /** Message ID being tracked */
  messageId: string;
  
  /** User ID for authorization */
  userId: string;
  
  /** Subscription start time */
  subscribedAt: Date;
  
  /** Last update received time */
  lastUpdateAt?: Date;
  
  /** Current status */
  currentStatus: ImageGenerationStatus;
  
  /** Current progress percentage */
  currentProgress: number;
  
  /** Number of updates received */
  updateCount: number;
  
  /** Whether this subscription is active */
  isActive: boolean;
  
  /** Subscription options */
  options: {
    includeDetailedProgress: boolean;
    includeMetadata: boolean;
  };
}

export interface ServerConnection {
  /** WebSocket connection instance */
  ws: WebSocket;
  
  /** Connection ID */
  connectionId: string;
  
  /** User ID */
  userId: string;
  
  /** Connection established time */
  connectedAt: Date;
  
  /** Last heartbeat time */
  lastHeartbeat: Date;
  
  /** Active subscriptions */
  subscriptions: Map<string, ClientSubscription>;
  
  /** Connection metadata */
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    sessionId?: string;
  };
}

export interface StatusUpdateEvent {
  /** Event type */
  type: 'status_changed' | 'progress_updated' | 'completed' | 'failed' | 'cancelled';
  
  /** Message ID */
  messageId: string;
  
  /** User ID */
  userId: string;
  
  /** Previous status */
  previousStatus?: ImageGenerationStatus;
  
  /** New status */
  newStatus: ImageGenerationStatus;
  
  /** Progress information */
  progress: ImageGenerationProgress;
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Event source */
  source: 'comfyui' | 'internal' | 'user_action' | 'timeout';
}

export interface WebSocketMetrics {
  /** Total active connections */
  activeConnections: number;
  
  /** Total active subscriptions */
  activeSubscriptions: number;
  
  /** Messages sent per minute */
  messagesPerMinute: number;
  
  /** Average connection duration in minutes */
  avgConnectionDuration: number;
  
  /** Connection success rate */
  connectionSuccessRate: number;
  
  /** Message delivery success rate */
  messageDeliveryRate: number;
  
  /** Current server load percentage */
  serverLoad: number;
}
