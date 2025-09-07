/**
 * WebSocket Server for Image Generation Status Updates
 * 
 * Provides real-time status updates to clients during image generation.
 * Manages connections, subscriptions, and message broadcasting.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { 
  ServerConnection,
  ClientSubscription,
  StatusUpdateEvent,
  ImageGenerationProgress,
  ServerToClientMessage,
  ClientToServerMessage,
  WebSocketMetrics,
  StatusUpdateMessage,
  ErrorMessage,
  HeartbeatMessage,
  ConnectionStatusMessage
} from './types';

export class ImageStatusWebSocketServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ServerConnection> = new Map();
  private messageSubscriptions: Map<string, Set<string>> = new Map(); // messageId -> connectionIds
  private metrics: WebSocketMetrics;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = {
      activeConnections: 0,
      activeSubscriptions: 0,
      messagesPerMinute: 0,
      avgConnectionDuration: 0,
      connectionSuccessRate: 100,
      messageDeliveryRate: 100,
      serverLoad: 0
    };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    console.log('[ImageStatusWebSocketServer] Initializing WebSocket server...');

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/image-status',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));

    // Start periodic tasks
    this.startHeartbeat();
    this.startCleanup();

    console.log('[ImageStatusWebSocketServer] WebSocket server initialized successfully');
  }

  /**
   * Broadcast status update to all subscribed clients
   */
  broadcastStatusUpdate(
    messageId: string,
    userId: string,
    progress: ImageGenerationProgress
  ): void {
    console.log(`[ImageStatusWebSocketServer] Broadcasting update for message ${messageId}:`, {
      status: progress.status,
      progress: progress.progress
    });

    const subscribers = this.messageSubscriptions.get(messageId);
    if (!subscribers || subscribers.size === 0) {
      console.log(`[ImageStatusWebSocketServer] No subscribers for message ${messageId}`);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    const message: StatusUpdateMessage = {
      type: 'status_update',
      timestamp: new Date().toISOString(),
      payload: {
        messageId,
        progress,
        sequenceNumber: Date.now()
      }
    };

    subscribers.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        // Clean up stale subscription
        subscribers.delete(connectionId);
        return;
      }

      // Verify user authorization
      if (connection.userId !== userId) {
        console.warn(`[ImageStatusWebSocketServer] Unauthorized access attempt for message ${messageId}`);
        return;
      }

      try {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify(message));
          successCount++;
          
          // Update subscription info
          const subscription = connection.subscriptions.get(messageId);
          if (subscription) {
            subscription.lastUpdateAt = new Date();
            subscription.currentStatus = progress.status;
            subscription.currentProgress = progress.progress;
            subscription.updateCount++;
          }
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`[ImageStatusWebSocketServer] Failed to send update to connection ${connectionId}:`, error);
        failCount++;
      }
    });

    console.log(`[ImageStatusWebSocketServer] Broadcast complete: ${successCount} sent, ${failCount} failed`);
    
    // Update metrics
    this.updateDeliveryMetrics(successCount, failCount);
  }

  /**
   * Send error message to specific client
   */
  sendError(
    connectionId: string,
    code: string,
    message: string,
    messageId?: string
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const errorMessage: ErrorMessage = {
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: {
        code,
        message,
        messageId
      }
    };

    try {
      connection.ws.send(JSON.stringify(errorMessage));
    } catch (error) {
      console.error(`[ImageStatusWebSocketServer] Failed to send error to ${connectionId}:`, error);
    }
  }

  /**
   * Get current server metrics
   */
  getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  /**
   * Shutdown the WebSocket server
   */
  shutdown(): void {
    console.log('[ImageStatusWebSocketServer] Shutting down...');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach(ws => {
        ws.terminate();
      });
      this.wss.close();
    }

    this.connections.clear();
    this.messageSubscriptions.clear();

    console.log('[ImageStatusWebSocketServer] Shutdown complete');
  }

  /**
   * Private methods
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    // Basic verification - in production, implement proper authentication
    const userAgent = info.req.headers['user-agent'];
    
    // Reject requests without user agent (likely bots)
    if (!userAgent) {
      return false;
    }

    // Add additional verification logic as needed
    return true;
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ipAddress = request.socket.remoteAddress || 'unknown';

    console.log(`[ImageStatusWebSocketServer] New connection: ${connectionId} from ${ipAddress}`);

    const connection: ServerConnection = {
      ws,
      connectionId,
      userId: '', // Will be set when client subscribes
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      subscriptions: new Map(),
      metadata: {
        userAgent,
        ipAddress,
        sessionId: request.headers['x-session-id']?.toString()
      }
    };

    this.connections.set(connectionId, connection);
    this.metrics.activeConnections++;

    // Set up message handlers
    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleDisconnection(connectionId));
    ws.on('error', (error) => this.handleConnectionError(connectionId, error));
    ws.on('pong', () => this.handlePong(connectionId));

    // Send welcome message
    this.sendConnectionStatus(connectionId, 'connected', 'Connection established');
  }

  private handleMessage(connectionId: string, data: Buffer): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message: ClientToServerMessage = JSON.parse(data.toString());
      connection.lastHeartbeat = new Date();

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(connectionId, message.payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, message.payload);
          break;
        case 'heartbeat':
          this.handleHeartbeat(connectionId);
          break;
        default:
          this.sendError(connectionId, 'INVALID_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`[ImageStatusWebSocketServer] Invalid message from ${connectionId}:`, error);
      this.sendError(connectionId, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  private handleSubscribe(connectionId: string, payload: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, userId, options = {} } = payload;

    if (!messageId || !userId) {
      this.sendError(connectionId, 'MISSING_PARAMS', 'messageId and userId are required');
      return;
    }

    // Set userId if not already set
    if (!connection.userId) {
      connection.userId = userId;
    } else if (connection.userId !== userId) {
      this.sendError(connectionId, 'UNAUTHORIZED', 'User ID mismatch');
      return;
    }

    // Create subscription
    const subscription: ClientSubscription = {
      messageId,
      userId,
      subscribedAt: new Date(),
      currentStatus: 'pending',
      currentProgress: 0,
      updateCount: 0,
      isActive: true,
      options: {
        includeDetailedProgress: options.includeDetailedProgress || false,
        includeMetadata: options.includeMetadata || false
      }
    };

    connection.subscriptions.set(messageId, subscription);

    // Add to message subscription map
    if (!this.messageSubscriptions.has(messageId)) {
      this.messageSubscriptions.set(messageId, new Set());
    }
    this.messageSubscriptions.get(messageId)!.add(connectionId);

    this.metrics.activeSubscriptions++;

    console.log(`[ImageStatusWebSocketServer] Subscription created: ${connectionId} -> ${messageId}`);

    // Send confirmation
    this.sendConnectionStatus(connectionId, 'connected', `Subscribed to ${messageId}`);
  }

  private handleUnsubscribe(connectionId: string, payload: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { messageId, userId } = payload;

    if (connection.userId !== userId) {
      this.sendError(connectionId, 'UNAUTHORIZED', 'User ID mismatch');
      return;
    }

    // Remove subscription
    if (connection.subscriptions.delete(messageId)) {
      const subscribers = this.messageSubscriptions.get(messageId);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.messageSubscriptions.delete(messageId);
        }
      }

      this.metrics.activeSubscriptions--;
      console.log(`[ImageStatusWebSocketServer] Subscription removed: ${connectionId} -> ${messageId}`);
    }
  }

  private handleHeartbeat(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastHeartbeat = new Date();

    const heartbeat: HeartbeatMessage = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      payload: {
        serverTime: new Date().toISOString(),
        uptime: Math.floor((Date.now() - connection.connectedAt.getTime()) / 1000),
        activeSubscriptions: connection.subscriptions.size
      }
    };

    try {
      connection.ws.send(JSON.stringify(heartbeat));
    } catch (error) {
      console.error(`[ImageStatusWebSocketServer] Failed to send heartbeat to ${connectionId}:`, error);
    }
  }

  private handlePong(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastHeartbeat = new Date();
    }
  }

  private handleDisconnection(connectionId: string): void {
    console.log(`[ImageStatusWebSocketServer] Connection closed: ${connectionId}`);

    const connection = this.connections.get(connectionId);
    if (connection) {
      // Clean up subscriptions
      connection.subscriptions.forEach((_, messageId) => {
        const subscribers = this.messageSubscriptions.get(messageId);
        if (subscribers) {
          subscribers.delete(connectionId);
          if (subscribers.size === 0) {
            this.messageSubscriptions.delete(messageId);
          }
        }
      });

      this.metrics.activeSubscriptions -= connection.subscriptions.size;
      this.connections.delete(connectionId);
      this.metrics.activeConnections--;
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    console.error(`[ImageStatusWebSocketServer] Connection error for ${connectionId}:`, error);
    this.handleDisconnection(connectionId);
  }

  private handleServerError(error: Error): void {
    console.error('[ImageStatusWebSocketServer] Server error:', error);
  }

  private sendConnectionStatus(
    connectionId: string,
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error',
    message?: string
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const statusMessage: ConnectionStatusMessage = {
      type: 'connection_status',
      timestamp: new Date().toISOString(),
      payload: {
        status,
        message
      }
    };

    try {
      connection.ws.send(JSON.stringify(statusMessage));
    } catch (error) {
      console.error(`[ImageStatusWebSocketServer] Failed to send status to ${connectionId}:`, error);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30 seconds

      this.connections.forEach((connection, connectionId) => {
        const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > timeout) {
          console.log(`[ImageStatusWebSocketServer] Connection ${connectionId} timed out`);
          connection.ws.terminate();
          this.handleDisconnection(connectionId);
        } else if (connection.ws.readyState === WebSocket.OPEN) {
          // Send ping
          connection.ws.ping();
        }
      });
    }, 15000); // Check every 15 seconds
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      // Clean up empty subscription sets
      this.messageSubscriptions.forEach((subscribers, messageId) => {
        if (subscribers.size === 0) {
          this.messageSubscriptions.delete(messageId);
        }
      });

      // Update metrics
      this.updateMetrics();
    }, 60000); // Every minute
  }

  private updateMetrics(): void {
    this.metrics.activeConnections = this.connections.size;
    this.metrics.activeSubscriptions = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + conn.subscriptions.size, 0);

    // Calculate other metrics (simplified for now)
    const now = Date.now();
    const avgDuration = Array.from(this.connections.values())
      .reduce((sum, conn) => sum + (now - conn.connectedAt.getTime()), 0) / this.connections.size;
    
    this.metrics.avgConnectionDuration = avgDuration / 60000; // Convert to minutes
  }

  private updateDeliveryMetrics(successCount: number, failCount: number): void {
    const total = successCount + failCount;
    if (total > 0) {
      this.metrics.messageDeliveryRate = (successCount / total) * 100;
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const imageStatusWebSocketServer = new ImageStatusWebSocketServer();
