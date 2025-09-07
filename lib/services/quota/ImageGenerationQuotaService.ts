/**
 * Image Generation Quota Service
 * 
 * Extends the existing quota system to specifically handle image generation requests.
 * Provides specialized quota checking, consumption, and reporting for image generation.
 */

import { 
  QuotaType,
  QuotaDisplay,
  QuotaConsumeResult,
  QuotaError,
  QuotaValidationResult,
  QUOTA_CONFIGS
} from '@/types/quota';
import { QuotaService, IQuotaService } from '@/lib/quota/QuotaService';
import { QuotaRepository } from '@/lib/quota/QuotaRepository';
import { QuotaValidator } from '@/lib/quota/QuotaValidator';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

export interface ImageGenerationQuotaInfo {
  canGenerate: boolean;
  remainingImages: number;
  totalLimit: number;
  usedToday: number;
  resetTime: Date | null;
  resetInHours: number | null;
  subscriptionLevel: 'free' | 'premium';
}

export interface ImageGenerationQuotaCheck {
  allowed: boolean;
  reason?: string;
  quotaInfo: ImageGenerationQuotaInfo;
  recommendedAction?: string;
}

export interface ImageGenerationUsageStats {
  today: {
    used: number;
    limit: number;
    percentage: number;
  };
  thisWeek: {
    totalGenerated: number;
    avgPerDay: number;
    peakDay: { date: string; count: number };
  };
  thisMonth: {
    totalGenerated: number;
    avgPerDay: number;
    remainingDays: number;
  };
  subscriptionInfo: {
    level: 'free' | 'premium';
    benefits: string[];
    upgradeOptions?: {
      newLimit: number;
      cost: string;
    };
  };
}

export class ImageGenerationQuotaService {
  private quotaService: IQuotaService;

  constructor() {
    // Initialize with existing quota service components
    const supabase = createSupabaseServiceClient();
    const repository = new QuotaRepository(supabase);
    const validator = new QuotaValidator();
    this.quotaService = new QuotaService(repository, validator);
  }

  /**
   * Check if user can generate an image
   * Returns detailed information about quota status
   */
  async checkImageGenerationQuota(userId: string): Promise<ImageGenerationQuotaCheck> {
    try {
      console.log(`[ImageGenerationQuotaService] Checking quota for user: ${userId}`);

      const quotaDisplay = await this.quotaService.checkQuotaAvailability(
        userId, 
        QuotaType.CHAT_IMAGE_GENERATION
      );

      const canGenerate = quotaDisplay.canUse && quotaDisplay.used < quotaDisplay.limit;
      const remainingImages = Math.max(0, quotaDisplay.limit - quotaDisplay.used);

      const quotaInfo: ImageGenerationQuotaInfo = {
        canGenerate,
        remainingImages,
        totalLimit: quotaDisplay.limit,
        usedToday: quotaDisplay.used,
        resetTime: quotaDisplay.nextResetAt,
        resetInHours: quotaDisplay.resetInHours,
        subscriptionLevel: this.getSubscriptionLevel(quotaDisplay.limit)
      };

      let reason: string | undefined;
      let recommendedAction: string | undefined;

      if (!canGenerate) {
        if (quotaDisplay.used >= quotaDisplay.limit) {
          reason = 'Daily image generation limit reached';
          recommendedAction = quotaDisplay.resetInHours 
            ? `Wait ${quotaDisplay.resetInHours} hours for quota reset`
            : 'Upgrade to premium for higher limits';
        } else if (!quotaDisplay.canUse) {
          reason = 'Image generation quota temporarily unavailable';
          recommendedAction = 'Please try again later';
        }
      }

      return {
        allowed: canGenerate,
        reason,
        quotaInfo,
        recommendedAction
      };
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Error checking quota:', error);
      throw new QuotaError(
        'Failed to check image generation quota',
        'DB_ERROR'
      );
    }
  }

  /**
   * Consume image generation quota
   * Should be called when starting image generation
   */
  async consumeImageGenerationQuota(userId: string): Promise<QuotaConsumeResult> {
    try {
      console.log(`[ImageGenerationQuotaService] Consuming quota for user: ${userId}`);

      // First check if consumption is allowed
      const check = await this.checkImageGenerationQuota(userId);
      
      if (!check.allowed) {
        return {
          success: false,
          quota: this.convertToQuotaDisplay(check.quotaInfo),
          message: check.reason || 'Image generation not allowed',
          remaining: check.quotaInfo.remainingImages
        };
      }

      // Consume the quota
      const result = await this.quotaService.consumeQuota(
        userId, 
        QuotaType.CHAT_IMAGE_GENERATION, 
        1
      );

      console.log(`[ImageGenerationQuotaService] Quota consumed successfully:`, {
        userId,
        remaining: result.quota.limit - result.quota.used
      });

      return result;
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Error consuming quota:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage statistics for image generation
   */
  async getImageGenerationUsageStats(userId: string): Promise<ImageGenerationUsageStats> {
    try {
      const quotaDisplay = await this.quotaService.checkQuotaAvailability(
        userId, 
        QuotaType.CHAT_IMAGE_GENERATION
      );

      // For now, we'll provide basic stats. In a full implementation,
      // you might want to query historical data from a separate analytics table
      const today = {
        used: quotaDisplay.used,
        limit: quotaDisplay.limit,
        percentage: quotaDisplay.percentage
      };

      const subscriptionLevel = this.getSubscriptionLevel(quotaDisplay.limit);
      
      const stats: ImageGenerationUsageStats = {
        today,
        thisWeek: {
          // These would come from historical data in a real implementation
          totalGenerated: quotaDisplay.used * 7, // Rough estimate
          avgPerDay: quotaDisplay.used,
          peakDay: {
            date: new Date().toISOString().split('T')[0],
            count: quotaDisplay.used
          }
        },
        thisMonth: {
          totalGenerated: quotaDisplay.used * 30, // Rough estimate
          avgPerDay: quotaDisplay.used,
          remainingDays: 30
        },
        subscriptionInfo: {
          level: subscriptionLevel,
          benefits: this.getSubscriptionBenefits(subscriptionLevel),
          upgradeOptions: subscriptionLevel === 'free' ? {
            newLimit: 20,
            cost: '$9.99/month'
          } : undefined
        }
      };

      return stats;
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Check quota and provide user-friendly message
   */
  async getQuotaStatusMessage(userId: string): Promise<{
    status: 'available' | 'limited' | 'exceeded';
    message: string;
    actionButton?: {
      text: string;
      action: 'wait' | 'upgrade' | 'retry';
    };
  }> {
    try {
      const check = await this.checkImageGenerationQuota(userId);
      
      if (check.allowed) {
        const remaining = check.quotaInfo.remainingImages;
        return {
          status: 'available',
          message: remaining > 1 
            ? `You can generate ${remaining} more images today`
            : `You have 1 image generation left today`
        };
      } else {
        if (check.quotaInfo.usedToday >= check.quotaInfo.totalLimit) {
          const resetHours = check.quotaInfo.resetInHours;
          return {
            status: 'exceeded',
            message: resetHours 
              ? `Daily limit reached. Resets in ${resetHours} hours`
              : 'Daily limit reached. Resets in 24 hours',
            actionButton: check.quotaInfo.subscriptionLevel === 'free' ? {
              text: 'Upgrade to Premium',
              action: 'upgrade'
            } : {
              text: 'Try Again Later',
              action: 'wait'
            }
          };
        } else {
          return {
            status: 'limited',
            message: 'Image generation temporarily unavailable',
            actionButton: {
              text: 'Retry',
              action: 'retry'
            }
          };
        }
      }
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Error getting status message:', error);
      return {
        status: 'limited',
        message: 'Unable to check quota status',
        actionButton: {
          text: 'Retry',
          action: 'retry'
        }
      };
    }
  }

  /**
   * Admin function to override quota for specific user
   * Should be used sparingly and with proper authorization
   */
  async adminOverrideQuota(
    userId: string,
    newLimit: number,
    reason: string,
    adminId: string
  ): Promise<boolean> {
    try {
      console.log(`[ImageGenerationQuotaService] Admin override requested:`, {
        userId,
        newLimit,
        reason,
        adminId
      });

      // Log the admin action for audit purposes
      console.log(`[ADMIN_ACTION] ${adminId} overrode image generation quota for ${userId}: ${newLimit} (reason: ${reason})`);

      // In a real implementation, you would:
      // 1. Verify admin permissions
      // 2. Update the quota limit in the database
      // 3. Log the action for audit
      // 4. Notify relevant parties

      // For now, return true to indicate success
      return true;
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Admin override failed:', error);
      return false;
    }
  }

  /**
   * Get quota utilization report for analytics
   */
  async getQuotaUtilizationReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalUsers: number;
    totalGenerations: number;
    avgGenerationsPerUser: number;
    quotaExceededEvents: number;
    peakUsageHour: string;
    subscriptionBreakdown: {
      free: { users: number; generations: number };
      premium: { users: number; generations: number };
    };
  }> {
    try {
      // In a real implementation, this would query historical data
      // For now, we'll return mock data structure
      
      console.log(`[ImageGenerationQuotaService] Generating utilization report for ${startDate.toISOString()} to ${endDate.toISOString()}`);

      return {
        totalUsers: 100,
        totalGenerations: 450,
        avgGenerationsPerUser: 4.5,
        quotaExceededEvents: 25,
        peakUsageHour: '14:00',
        subscriptionBreakdown: {
          free: { users: 80, generations: 320 },
          premium: { users: 20, generations: 130 }
        }
      };
    } catch (error) {
      console.error('[ImageGenerationQuotaService] Error generating report:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private getSubscriptionLevel(limit: number): 'free' | 'premium' {
    const freeLimit = QUOTA_CONFIGS[QuotaType.CHAT_IMAGE_GENERATION].defaultLimit;
    return limit <= freeLimit ? 'free' : 'premium';
  }

  private getSubscriptionBenefits(level: 'free' | 'premium'): string[] {
    if (level === 'premium') {
      return [
        'Higher daily image generation limit',
        'Priority processing',
        'Advanced style options',
        'No watermark',
        'Download in high resolution'
      ];
    } else {
      return [
        'Basic image generation',
        'Standard quality',
        'Community support'
      ];
    }
  }

  private convertToQuotaDisplay(quotaInfo: ImageGenerationQuotaInfo): QuotaDisplay {
    return {
      type: QuotaType.CHAT_IMAGE_GENERATION,
      used: quotaInfo.usedToday,
      limit: quotaInfo.totalLimit,
      canUse: quotaInfo.canGenerate,
      nextResetAt: quotaInfo.resetTime,
      resetInHours: quotaInfo.resetInHours,
      percentage: Math.round((quotaInfo.usedToday / quotaInfo.totalLimit) * 100)
    };
  }
}

// Export singleton instance
export const imageGenerationQuotaService = new ImageGenerationQuotaService();
