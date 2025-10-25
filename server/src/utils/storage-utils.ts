import { R2Storage } from '../storage/r2-storage';
import { User, userOps, PLAN_LIMITS, UserPlan } from '../db/database';

/**
 * Calculate total storage used by a user
 */
export async function calculateUserStorage(userId: number): Promise<number> {
  try {
    const files = await R2Storage.listFilesWithMetadata(userId);
    const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);

    // Update database
    userOps.updateStorageUsed.run(totalBytes, userId);

    return totalBytes;
  } catch (error) {
    console.error('Failed to calculate storage:', error);
    return 0;
  }
}

/**
 * Check if user has enough storage quota
 */
export function hasStorageQuota(user: User, additionalBytes: number): boolean {
  const limit = PLAN_LIMITS[user.plan].storage;
  return (user.storage_used + additionalBytes) <= limit;
}

/**
 * Get storage quota information for a user
 */
export function getStorageInfo(user: User): {
  used: number;
  limit: number;
  available: number;
  percentUsed: number;
  plan: string;
} {
  const limit = PLAN_LIMITS[user.plan].storage;
  const used = user.storage_used;
  const available = Math.max(0, limit - used);
  const percentUsed = (used / limit) * 100;

  return {
    used,
    limit,
    available,
    percentUsed,
    plan: PLAN_LIMITS[user.plan].name
  };
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate ASCII progress bar for Discord
 */
export function generateProgressBar(percentUsed: number, length: number = 20): string {
  const filled = Math.round((percentUsed / 100) * length);
  const empty = length - filled;

  const fillChar = '█';
  const emptyChar = '░';

  return fillChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Check if user can use a specific feature based on their plan
 */
export function canUseFeature(user: User, feature: 'games' | 'apps' | 'custom'): boolean {
  switch (user.plan) {
    case 'free':
      return feature === 'games';
    case 'plus':
      return feature === 'games' || feature === 'apps';
    case 'premium':
      return true;
    default:
      return false;
  }
}

/**
 * Get user plan features
 */
export function getPlanFeatures(plan: UserPlan): string[] {
  return PLAN_LIMITS[plan].features;
}
