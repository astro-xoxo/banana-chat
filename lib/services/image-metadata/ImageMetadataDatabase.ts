/**
 * Database Utility Functions for Image Metadata
 * 
 * Helper functions for common database operations related to image metadata.
 * Provides optimized queries and transaction handling.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  MessageMetadata, 
  ImageGenerationData, 
  ImageCleanupResult,
  ImageStatistics
} from './types';

export class ImageMetadataDatabase {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Batch update multiple messages with image metadata
   * Useful for bulk operations and migrations
   */
  async batchUpdateImageMetadata(
    updates: Array<{
      messageId: string;
      imageData: Omit<ImageGenerationData, 'id' | 'createdAt'>;
    }>
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const result = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process in chunks to avoid overwhelming the database
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      
      try {
        await this.processBatchChunk(chunk, result);
      } catch (error) {
        result.errors.push(`Batch chunk failed: ${error.message}`);
        result.failed += chunk.length;
      }
    }

    return result;
  }

  /**
   * Get messages with pending or processing images
   * Useful for monitoring and cleanup operations
   */
  async getMessagesWithActiveImageGeneration(
    userId?: string,
    limit: number = 100
  ): Promise<Array<{
    messageId: string;
    sessionId: string;
    userId: string;
    activeImages: ImageGenerationData[];
  }>> {
    try {
      let query = this.supabase
        .from('chat_messages')
        .select(`
          id,
          session_id,
          metadata,
          chat_sessions!inner(user_id)
        `)
        .not('metadata->images->images', 'is', null)
        .limit(limit);

      if (userId) {
        query = query.eq('chat_sessions.user_id', userId);
      }

      const { data: messages, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch active image generations: ${error.message}`);
      }

      const results = [];

      for (const message of messages || []) {
        const metadata: MessageMetadata = message.metadata;
        if (!metadata.images?.images) continue;

        const activeImages = metadata.images.images.filter(
          img => img.status === 'pending' || img.status === 'processing'
        );

        if (activeImages.length > 0) {
          results.push({
            messageId: message.id,
            sessionId: message.session_id,
            userId: message.chat_sessions.user_id,
            activeImages
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching messages with active image generation:', error);
      throw error;
    }
  }

  /**
   * Get image generation statistics across all users
   * Useful for admin dashboards and monitoring
   */
  async getGlobalImageStatistics(): Promise<{
    totalImages: number;
    totalUsers: number;
    statusBreakdown: Record<string, number>;
    storageUsed: number;
    averageImagesPerUser: number;
    topPresets: Array<{ preset: string; count: number }>;
  }> {
    try {
      // Get all messages with image metadata
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select(`
          metadata,
          chat_sessions!inner(user_id)
        `)
        .not('metadata->images->images', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch global statistics: ${error.message}`);
      }

      const stats = {
        totalImages: 0,
        totalUsers: new Set<string>(),
        statusBreakdown: {} as Record<string, number>,
        storageUsed: 0,
        averageImagesPerUser: 0,
        topPresets: [] as Array<{ preset: string; count: number }>
      };

      const presetCounts: Record<string, number> = {};

      for (const message of messages || []) {
        const metadata: MessageMetadata = message.metadata;
        if (!metadata.images?.images) continue;

        stats.totalUsers.add(message.chat_sessions.user_id);

        for (const image of metadata.images.images) {
          stats.totalImages++;
          
          // Count status
          stats.statusBreakdown[image.status] = (stats.statusBreakdown[image.status] || 0) + 1;
          
          // Count storage
          stats.storageUsed += image.metadata?.fileSize || 0;
          
          // Count presets
          const preset = image.parameters.preset;
          presetCounts[preset] = (presetCounts[preset] || 0) + 1;
        }
      }

      // Calculate averages
      const userCount = stats.totalUsers.size;
      stats.averageImagesPerUser = userCount > 0 ? stats.totalImages / userCount : 0;

      // Sort top presets
      stats.topPresets = Object.entries(presetCounts)
        .map(([preset, count]) => ({ preset, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        ...stats,
        totalUsers: userCount
      };
    } catch (error) {
      console.error('Error fetching global image statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned image metadata
   * Removes image references that no longer have corresponding files
   */
  async cleanupOrphanedImageMetadata(
    verifyFileExists: (url: string) => Promise<boolean>
  ): Promise<ImageCleanupResult> {
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
        .not('metadata->images->images', 'is', null);

      if (error) {
        throw new Error(`Failed to fetch messages for orphan cleanup: ${error.message}`);
      }

      for (const message of messages || []) {
        try {
          const metadata: MessageMetadata = message.metadata;
          if (!metadata.images?.images) continue;

          const originalCount = metadata.images.images.length;
          const validImages = [];

          for (const image of metadata.images.images) {
            try {
              const exists = await verifyFileExists(image.url);
              if (exists) {
                validImages.push(image);
              } else {
                result.cleanedCount++;
                result.spaceFreed += image.metadata?.fileSize || 0;
              }
            } catch (verifyError) {
              // If we can't verify, keep the image but log the error
              validImages.push(image);
              result.errors.push(`Could not verify file ${image.url}: ${verifyError.message}`);
            }
          }

          // Update if any images were removed
          if (validImages.length !== originalCount) {
            metadata.images.images = validImages;

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
      result.errors.push(`Orphan cleanup failed: ${error.message}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Archive old image metadata to reduce database size
   * Moves old metadata to an archive table or file storage
   */
  async archiveOldImageMetadata(
    archiveOlderThanDays: number = 90
  ): Promise<{
    archivedCount: number;
    messagesAffected: number;
    errors: string[];
  }> {
    const result = {
      archivedCount: 0,
      messagesAffected: 0,
      errors: [] as string[]
    };

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - archiveOlderThanDays);

      // Get messages with old image metadata
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select('id, metadata, created_at')
        .not('metadata->images->images', 'is', null)
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch messages for archiving: ${error.message}`);
      }

      for (const message of messages || []) {
        try {
          const metadata: MessageMetadata = message.metadata;
          if (!metadata.images?.images) continue;

          // In a production system, you would save to an archive table/storage here
          // For now, we'll just remove the image metadata but keep a summary

          const archiveSummary = {
            archivedAt: new Date().toISOString(),
            imageCount: metadata.images.images.length,
            totalSize: metadata.images.images.reduce((sum, img) => sum + (img.metadata?.fileSize || 0), 0),
            lastImageDate: Math.max(...metadata.images.images.map(img => new Date(img.createdAt).getTime()))
          };

          // Replace detailed image data with summary
          const newMetadata = {
            ...metadata,
            images: {
              ...metadata.images,
              archived: archiveSummary,
              images: [] // Clear the detailed image data
            }
          };

          const { error: updateError } = await this.supabase
            .from('chat_messages')
            .update({ metadata: newMetadata })
            .eq('id', message.id);

          if (updateError) {
            result.errors.push(`Failed to archive message ${message.id}: ${updateError.message}`);
          } else {
            result.archivedCount += metadata.images.images.length;
            result.messagesAffected++;
          }
        } catch (messageError) {
          result.errors.push(`Error archiving message ${message.id}: ${messageError.message}`);
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Archive operation failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Get detailed image metadata for analysis
   * Returns comprehensive data for reporting and analytics
   */
  async getDetailedImageAnalysis(
    userId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    images: Array<{
      messageId: string;
      imageId: string;
      userId: string;
      sessionId: string;
      status: string;
      prompt: string;
      preset: string;
      createdAt: string;
      completedAt?: string;
      fileSize?: number;
      generationTime?: number;
    }>;
    summary: {
      totalImages: number;
      avgGenerationTime: number;
      successRate: number;
      mostUsedPreset: string;
    };
  }> {
    try {
      let query = this.supabase
        .from('chat_messages')
        .select(`
          id,
          session_id,
          metadata,
          created_at,
          chat_sessions!inner(user_id)
        `)
        .not('metadata->images->images', 'is', null);

      if (userId) {
        query = query.eq('chat_sessions.user_id', userId);
      }

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      }

      const { data: messages, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch detailed analysis: ${error.message}`);
      }

      const images = [];
      let totalGenerationTime = 0;
      let completedCount = 0;
      let successCount = 0;
      const presetCounts: Record<string, number> = {};

      for (const message of messages || []) {
        const metadata: MessageMetadata = message.metadata;
        if (!metadata.images?.images) continue;

        for (const image of metadata.images.images) {
          const generationTime = image.completedAt
            ? new Date(image.completedAt).getTime() - new Date(image.createdAt).getTime()
            : undefined;

          images.push({
            messageId: message.id,
            imageId: image.id,
            userId: message.chat_sessions.user_id,
            sessionId: message.session_id,
            status: image.status,
            prompt: image.prompt,
            preset: image.parameters.preset,
            createdAt: image.createdAt,
            completedAt: image.completedAt,
            fileSize: image.metadata?.fileSize,
            generationTime: generationTime ? Math.round(generationTime / 1000) : undefined
          });

          // Count statistics
          if (generationTime) {
            totalGenerationTime += generationTime;
            completedCount++;
          }

          if (image.status === 'completed') {
            successCount++;
          }

          // Count presets
          const preset = image.parameters.preset;
          presetCounts[preset] = (presetCounts[preset] || 0) + 1;
        }
      }

      // Calculate summary
      const avgGenerationTime = completedCount > 0 ? Math.round(totalGenerationTime / completedCount / 1000) : 0;
      const successRate = images.length > 0 ? Math.round((successCount / images.length) * 100) : 0;
      const mostUsedPreset = Object.entries(presetCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

      return {
        images,
        summary: {
          totalImages: images.length,
          avgGenerationTime,
          successRate,
          mostUsedPreset
        }
      };
    } catch (error) {
      console.error('Error fetching detailed image analysis:', error);
      throw error;
    }
  }

  /**
   * Private helper method for processing batch chunks
   */
  private async processBatchChunk(
    chunk: Array<{
      messageId: string;
      imageData: Omit<ImageGenerationData, 'id' | 'createdAt'>;
    }>,
    result: { success: number; failed: number; errors: string[] }
  ): Promise<void> {
    // Use a transaction for batch updates
    const { data, error } = await this.supabase.rpc('batch_update_image_metadata', {
      updates: chunk.map(update => ({
        message_id: update.messageId,
        image_data: {
          ...update.imageData,
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString()
        }
      }))
    });

    if (error) {
      throw error;
    }

    result.success += chunk.length;
  }
}

// Export singleton instance
export const imageMetadataDatabase = new ImageMetadataDatabase();
