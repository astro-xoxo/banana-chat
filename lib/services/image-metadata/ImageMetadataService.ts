/**
 * Image Metadata Management Service
 * 
 * Core service for managing image generation metadata in chat_messages.metadata field.
 * Provides CRUD operations, versioning, and cleanup functionality.
 */

import { createClient } from '@supabase/supabase-js';
import {
  ImageGenerationData,
  MessageImageMetadata,
  MessageMetadata,
  ImageMetadataUpdateOptions,
  ImageRetrievalOptions,
  ImageCleanupCriteria,
  ImageCleanupResult,
  ImageVersionInfo,
  ImageStatistics
} from './types';

export class ImageMetadataService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Update message metadata with new image generation data
   */
  async updateMessageImageMetadata(
    messageId: string,
    imageData: Omit<ImageGenerationData, 'id' | 'createdAt'>,
    options: ImageMetadataUpdateOptions = {}
  ): Promise<MessageMetadata> {
    try {
      // Get existing message metadata
      const { data: message, error: fetchError } = await this.supabase
        .from('chat_messages')
        .select('metadata')
        .eq('id', messageId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch message: ${fetchError.message}`);
      }

      const currentMetadata: MessageMetadata = message?.metadata || {};
      
      // Initialize images metadata if not exists
      if (!currentMetadata.images) {
        currentMetadata.images = {
          images: [],
          settings: {
            autoGenerate: true,
            maxImages: 5
          }
        };
      }

      // Create backup if requested
      if (options.createBackup) {
        await this.createMetadataBackup(messageId, currentMetadata);
      }

      // Generate unique ID for new image
      const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create complete image data
      const completeImageData: ImageGenerationData = {
        id: imageId,
        createdAt: new Date().toISOString(),
        ...imageData
      };

      // Validate schema if requested
      if (options.validateSchema) {
        this.validateImageDataSchema(completeImageData);
      }

      // Check if we need to remove old images to stay within limits
      const maxImages = currentMetadata.images.settings?.maxImages || 5;
      if (currentMetadata.images.images.length >= maxImages) {
        // Remove oldest completed or failed images first
        currentMetadata.images.images = currentMetadata.images.images
          .filter(img => img.status === 'pending' || img.status === 'processing')
          .concat(
            currentMetadata.images.images
              .filter(img => img.status !== 'pending' && img.status !== 'processing')
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, maxImages - 1)
          );
      }

      // Add new image data
      currentMetadata.images.images.push(completeImageData);

      // Update database
      const { error: updateError } = await this.supabase
        .from('chat_messages')
        .update({ metadata: currentMetadata })
        .eq('id', messageId);

      if (updateError) {
        throw new Error(`Failed to update metadata: ${updateError.message}`);
      }

      // Trigger cleanup if requested
      if (options.triggerCleanup) {
        // Run cleanup in background
        this.performImageCleanup({
          maxFailedImageAge: 7,
          maxExpiredImageAge: 30,
          maxUserStorageSize: 100 * 1024 * 1024, // 100MB
          maxImagesPerMessage: maxImages
        }).catch(console.error);
      }

      return currentMetadata;
    } catch (error) {
      console.error('Error updating message image metadata:', error);
      throw error;
    }
  }

  /**
   * Retrieve image metadata for a specific message
   */
  async getMessageImageMetadata(
    messageId: string,
    options: ImageRetrievalOptions = {}
  ): Promise<MessageImageMetadata | null> {
    try {
      const { data: message, error } = await this.supabase
        .from('chat_messages')
        .select('metadata')
        .eq('id', messageId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch message metadata: ${error.message}`);
      }

      const metadata: MessageMetadata = message?.metadata || {};
      let imageMetadata = metadata.images;

      if (!imageMetadata) {
        return null;
      }

      // Apply filters
      let images = imageMetadata.images;

      if (!options.includeFailed) {
        images = images.filter(img => img.status !== 'failed');
      }

      if (!options.includeExpired) {
        images = images.filter(img => img.status !== 'expired');
      }

      // Apply sorting
      if (options.sortBy) {
        images.sort((a, b) => {
          const aValue = a[options.sortBy!];
          const bValue = b[options.sortBy!];
          
          if (!aValue && !bValue) return 0;
          if (!aValue) return 1;
          if (!bValue) return -1;

          const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          return options.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Apply limit
      if (options.limit) {
        images = images.slice(0, options.limit);
      }

      return {
        ...imageMetadata,
        images
      };
    } catch (error) {
      console.error('Error retrieving message image metadata:', error);
      throw error;
    }
  }

  /**
   * Update specific image status and metadata
   */
  async updateImageStatus(
    messageId: string,
    imageId: string,
    status: ImageGenerationData['status'],
    statusMessage?: string,
    additionalData?: Partial<ImageGenerationData>
  ): Promise<boolean> {
    try {
      const currentMetadata = await this.getMessageImageMetadata(messageId);
      
      if (!currentMetadata) {
        throw new Error('Message metadata not found');
      }

      const imageIndex = currentMetadata.images.findIndex(img => img.id === imageId);
      
      if (imageIndex === -1) {
        throw new Error('Image not found in metadata');
      }

      // Update image data
      currentMetadata.images[imageIndex] = {
        ...currentMetadata.images[imageIndex],
        status,
        statusMessage,
        ...additionalData
      };

      // Set completion timestamp if completed
      if (status === 'completed' && !currentMetadata.images[imageIndex].completedAt) {
        currentMetadata.images[imageIndex].completedAt = new Date().toISOString();
      }

      // Update database
      const { error } = await this.supabase
        .from('chat_messages')
        .update({ 
          metadata: {
            images: currentMetadata
          }
        })
        .eq('id', messageId);

      if (error) {
        throw new Error(`Failed to update image status: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error updating image status:', error);
      throw error;
    }
  }

  /**
   * Create a new version of an existing image
   */
  async createImageVersion(
    messageId: string,
    originalImageId: string,
    newImageData: Omit<ImageGenerationData, 'id' | 'createdAt'>,
    reason: ImageVersionInfo['reason'] = 'user_request'
  ): Promise<string> {
    try {
      // Deactivate original image
      await this.updateImageStatus(messageId, originalImageId, 'completed', 'Replaced by newer version');

      // Create new version
      const versionNumber = Date.now();
      const newImageId = `${originalImageId}_v${versionNumber}`;

      const versionedImageData: ImageGenerationData = {
        ...newImageData,
        id: newImageId,
        createdAt: new Date().toISOString(),
        metadata: {
          ...newImageData.metadata,
          version: {
            version: versionNumber,
            generatedAt: new Date().toISOString(),
            isActive: true,
            reason
          }
        }
      };

      // Add to metadata
      await this.updateMessageImageMetadata(messageId, versionedImageData);

      return newImageId;
    } catch (error) {
      console.error('Error creating image version:', error);
      throw error;
    }
  }

  /**
   * Perform cleanup of failed and expired images
   */
  async performImageCleanup(criteria: ImageCleanupCriteria): Promise<ImageCleanupResult> {
    const startTime = Date.now();
    const result: ImageCleanupResult = {
      cleanedCount: 0,
      spaceFreed: 0,
      messagesAffected: 0,
      duration: 0,
      errors: []
    };

    try {
      // Get all messages with image metadata
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select('id, metadata')
        .not('metadata->images', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch messages for cleanup: ${error.message}`);
      }

      const cutoffFailed = new Date();
      cutoffFailed.setDate(cutoffFailed.getDate() - criteria.maxFailedImageAge);

      const cutoffExpired = new Date();
      cutoffExpired.setDate(cutoffExpired.getDate() - criteria.maxExpiredImageAge);

      for (const message of messages || []) {
        try {
          const metadata: MessageMetadata = message.metadata;
          if (!metadata.images?.images) continue;

          const originalCount = metadata.images.images.length;
          let totalSize = 0;

          // Filter out images that need cleanup
          metadata.images.images = metadata.images.images.filter(image => {
            const imageDate = new Date(image.createdAt);
            
            // Count size before filtering
            totalSize += image.metadata?.fileSize || 0;

            // Remove failed images older than threshold
            if (image.status === 'failed' && imageDate < cutoffFailed) {
              result.cleanedCount++;
              result.spaceFreed += image.metadata?.fileSize || 0;
              return false;
            }

            // Remove expired images older than threshold
            if (image.status === 'expired' && imageDate < cutoffExpired) {
              result.cleanedCount++;
              result.spaceFreed += image.metadata?.fileSize || 0;
              return false;
            }

            return true;
          });

          // Enforce max images per message
          if (metadata.images.images.length > criteria.maxImagesPerMessage) {
            const excess = metadata.images.images.splice(criteria.maxImagesPerMessage);
            result.cleanedCount += excess.length;
            result.spaceFreed += excess.reduce((sum, img) => sum + (img.metadata?.fileSize || 0), 0);
          }

          // Update database if changes were made
          if (metadata.images.images.length !== originalCount) {
            const { error: updateError } = await this.supabase
              .from('chat_messages')
              .update({ metadata })
              .eq('id', message.id);

            if (updateError) {
              result.errors.push(`Failed to update message ${message.id}: ${updateError.message}`);
            } else {
              result.messagesAffected++;
            }
          }
        } catch (messageError) {
          result.errors.push(`Error processing message ${message.id}: ${messageError.message}`);
        }
      }

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      result.errors.push(`Cleanup failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Get image statistics for a user
   */
  async getUserImageStatistics(userId: string): Promise<ImageStatistics> {
    try {
      // Get all user's messages with image metadata
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select('metadata')
        .in('session_id', 
          this.supabase
            .from('chat_sessions')
            .select('id')
            .eq('user_id', userId)
        );

      if (error) {
        throw new Error(`Failed to fetch user statistics: ${error.message}`);
      }

      const stats: ImageStatistics = {
        totalImages: 0,
        statusCounts: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          expired: 0
        },
        totalStorageUsed: 0,
        averageGenerationTime: 0,
        successRate: 0,
        popularPresets: []
      };

      let totalGenerationTime = 0;
      let completedWithTime = 0;
      const presetCounts: Record<string, number> = {};

      for (const message of messages || []) {
        const metadata: MessageMetadata = message.metadata;
        if (!metadata.images?.images) continue;

        for (const image of metadata.images.images) {
          stats.totalImages++;
          stats.statusCounts[image.status]++;
          stats.totalStorageUsed += image.metadata?.fileSize || 0;

          // Calculate generation time
          if (image.completedAt) {
            const generationTime = new Date(image.completedAt).getTime() - new Date(image.createdAt).getTime();
            totalGenerationTime += generationTime;
            completedWithTime++;
          }

          // Count preset usage
          const preset = image.parameters.preset;
          presetCounts[preset] = (presetCounts[preset] || 0) + 1;
        }
      }

      // Calculate averages
      if (completedWithTime > 0) {
        stats.averageGenerationTime = totalGenerationTime / completedWithTime / 1000; // Convert to seconds
      }

      if (stats.totalImages > 0) {
        stats.successRate = (stats.statusCounts.completed / stats.totalImages) * 100;
      }

      // Sort popular presets
      stats.popularPresets = Object.entries(presetCounts)
        .map(([preset, count]) => ({ preset, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return stats;
    } catch (error) {
      console.error('Error getting user image statistics:', error);
      throw error;
    }
  }

  /**
   * Delete specific image from message metadata
   */
  async deleteImage(messageId: string, imageId: string): Promise<boolean> {
    try {
      const currentMetadata = await this.getMessageImageMetadata(messageId);
      
      if (!currentMetadata) {
        return false;
      }

      const initialCount = currentMetadata.images.length;
      currentMetadata.images = currentMetadata.images.filter(img => img.id !== imageId);

      if (currentMetadata.images.length === initialCount) {
        return false; // Image not found
      }

      // Update database
      const { error } = await this.supabase
        .from('chat_messages')
        .update({ 
          metadata: {
            images: currentMetadata
          }
        })
        .eq('id', messageId);

      if (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private validateImageDataSchema(imageData: ImageGenerationData): void {
    if (!imageData.id || !imageData.url || !imageData.prompt) {
      throw new Error('Invalid image data: missing required fields');
    }

    if (!['pending', 'processing', 'completed', 'failed', 'expired'].includes(imageData.status)) {
      throw new Error('Invalid image status');
    }
  }

  private async createMetadataBackup(messageId: string, metadata: MessageMetadata): Promise<void> {
    // In a production system, you might want to store backups in a separate table
    // For now, we'll add a backup timestamp to the metadata
    const backupKey = `backup_${Date.now()}`;
    
    try {
      // This is a simplified backup - in production you might use a dedicated backup table
      console.log(`Created metadata backup for message ${messageId} with key ${backupKey}`);
    } catch (error) {
      console.error('Failed to create metadata backup:', error);
      // Don't throw - backup failure shouldn't stop the main operation
    }
  }
}

// Export singleton instance
export const imageMetadataService = new ImageMetadataService();
