/**
 * Image Metadata Management System Types
 * 
 * Defines TypeScript interfaces for managing image generation metadata
 * in the chat_messages.metadata JSONB field.
 */

export interface ImageGenerationData {
  /** Unique identifier for this image generation */
  id: string;
  
  /** Image URL or file path */
  url: string;
  
  /** Original prompt used for generation */
  prompt: string;
  
  /** Generation parameters */
  parameters: {
    /** ComfyUI preset used */
    preset: string;
    /** Generation seed */
    seed?: number;
    /** Image dimensions */
    width?: number;
    height?: number;
    /** Number of inference steps */
    steps?: number;
    /** Additional parameters */
    [key: string]: any;
  };
  
  /** Generation status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  
  /** Status message or error details */
  statusMessage?: string;
  
  /** Generation timestamps */
  createdAt: string;
  completedAt?: string;
  
  /** Image metadata */
  metadata?: {
    /** File size in bytes */
    fileSize?: number;
    /** MIME type */
    mimeType?: string;
    /** Image quality score (0-100) */
    qualityScore?: number;
    /** Content moderation flags */
    moderationFlags?: string[];
    /** User rating (1-5) */
    userRating?: number;
  };
}

export interface MessageImageMetadata {
  /** Array of image generations for this message */
  images: ImageGenerationData[];
  
  /** Message analysis context */
  analysis?: {
    /** Extracted keywords */
    keywords: string[];
    /** Emotion detected */
    emotion?: string;
    /** Confidence score */
    confidence: number;
    /** Analysis timestamp */
    analyzedAt: string;
  };
  
  /** Generation settings */
  settings?: {
    /** Auto-generation enabled */
    autoGenerate: boolean;
    /** Maximum images per message */
    maxImages: number;
    /** Preferred style */
    preferredStyle?: string;
  };
}

export interface MessageMetadata {
  /** Image-related metadata */
  images?: MessageImageMetadata;
  
  /** Other metadata fields */
  [key: string]: any;
}

export interface ImageCleanupCriteria {
  /** Maximum age in days for failed images */
  maxFailedImageAge: number;
  
  /** Maximum age in days for expired images */
  maxExpiredImageAge: number;
  
  /** Maximum storage size per user in bytes */
  maxUserStorageSize: number;
  
  /** Maximum images per message */
  maxImagesPerMessage: number;
}

export interface ImageMetadataUpdateOptions {
  /** Whether to create backup of existing metadata */
  createBackup?: boolean;
  
  /** Whether to validate schema before update */
  validateSchema?: boolean;
  
  /** Whether to trigger cleanup after update */
  triggerCleanup?: boolean;
}

export interface ImageRetrievalOptions {
  /** Include failed images */
  includeFailed?: boolean;
  
  /** Include expired images */
  includeExpired?: boolean;
  
  /** Maximum number of images to return */
  limit?: number;
  
  /** Sort order */
  sortBy?: 'createdAt' | 'completedAt' | 'status';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

export interface ImageCleanupResult {
  /** Number of images cleaned up */
  cleanedCount: number;
  
  /** Total space freed in bytes */
  spaceFreed: number;
  
  /** Number of messages affected */
  messagesAffected: number;
  
  /** Cleanup duration in milliseconds */
  duration: number;
  
  /** Any errors encountered */
  errors: string[];
}

export interface ImageVersionInfo {
  /** Version number */
  version: number;
  
  /** Generation timestamp */
  generatedAt: string;
  
  /** Whether this is the active version */
  isActive: boolean;
  
  /** Reason for new version */
  reason?: 'user_request' | 'quality_improvement' | 'error_recovery';
}

export interface ImageStatistics {
  /** Total images for user */
  totalImages: number;
  
  /** Images by status */
  statusCounts: Record<ImageGenerationData['status'], number>;
  
  /** Total storage used in bytes */
  totalStorageUsed: number;
  
  /** Average generation time in seconds */
  averageGenerationTime: number;
  
  /** Success rate percentage */
  successRate: number;
  
  /** Most used presets */
  popularPresets: Array<{ preset: string; count: number }>;
}
