// utils/blockingUtils.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for AsyncStorage keys
export const BLOCKED_USER_IDS_KEY = 'blockedUserIds';
export const BLOCKED_VIDEO_IDS_KEY = 'blockedVideoIds';

// Types for better type safety
export interface VideoType {
  id: string;
  uploader: { id: string };
}

export interface BlockedItems {
  blockedUsers: string[];
  blockedVideos: string[];
}

export interface UserReport {
  userId: string;
  reason?: string;
  timestamp: string;
}

export interface LegacyBlockedItems {
  blockedUrls: string[];
  blockedUsers: string[];
}

/**
 * Get blocked item IDs from AsyncStorage
 * @param key The storage key for the blocked items
 * @returns Promise<string[]> Array of blocked IDs
 */
export const getBlockedItemIds = async (key: string): Promise<string[]> => {
  try {
    const itemIdsJson = await AsyncStorage.getItem(key);
    if (!itemIdsJson) return [];
    
    const parsed = JSON.parse(itemIdsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Failed to load ${key} from AsyncStorage`, e);
    return [];
  }
};

/**
 * Set blocked item IDs to AsyncStorage
 * @param key The storage key for the blocked items
 * @param items Array of IDs to store
 */
const setBlockedItemIds = async (key: string, items: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error(`Failed to save ${key} to AsyncStorage`, e);
    throw new Error(`Failed to save ${key}`);
  }
};

/**
 * Add a user ID to the blocked users list
 * @param userId The user ID to block
 */
export const addBlockedUserId = async (userId: string): Promise<void> => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId provided');
  }

  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_USER_IDS_KEY);
    if (!currentBlocked.includes(userId)) {
      const updatedBlocked = [...currentBlocked, userId];
      await setBlockedItemIds(BLOCKED_USER_IDS_KEY, updatedBlocked);
      console.log(`User ${userId} added to blocked list`);
    } else {
      console.log(`User ${userId} is already blocked`);
    }
  } catch (e) {
    console.error('Failed to block user:', e);
    throw new Error('Failed to block user');
  }
};

/**
 * Add a video ID to the blocked videos list
 * @param videoId The video ID to block
 */
export const addBlockedVideoId = async (videoId: string): Promise<void> => {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid videoId provided');
  }

  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY);
    if (!currentBlocked.includes(videoId)) {
      const updatedBlocked = [...currentBlocked, videoId];
      await setBlockedItemIds(BLOCKED_VIDEO_IDS_KEY, updatedBlocked);
      console.log(`Video ${videoId} added to blocked list`);
    } else {
      console.log(`Video ${videoId} is already blocked`);
    }
  } catch (e) {
    console.error('Failed to block video:', e);
    throw new Error('Failed to block video');
  }
};

/**
 * Remove a user ID from the blocked users list
 * @param userId The user ID to unblock
 */
export const removeBlockedUserId = async (userId: string): Promise<void> => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId provided');
  }

  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_USER_IDS_KEY);
    const updatedBlocked = currentBlocked.filter(id => id !== userId);
    await setBlockedItemIds(BLOCKED_USER_IDS_KEY, updatedBlocked);
    console.log(`User ${userId} removed from blocked list`);
  } catch (e) {
    console.error('Failed to unblock user:', e);
    throw new Error('Failed to unblock user');
  }
};

/**
 * Remove a video ID from the blocked videos list
 * @param videoId The video ID to unblock
 */
export const removeBlockedVideoId = async (videoId: string): Promise<void> => {
  if (!videoId || typeof videoId !== 'string') {
    throw new Error('Invalid videoId provided');
  }

  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY);
    const updatedBlocked = currentBlocked.filter(id => id !== videoId);
    await setBlockedItemIds(BLOCKED_VIDEO_IDS_KEY, updatedBlocked);
    console.log(`Video ${videoId} removed from blocked list`);
  } catch (e) {
    console.error('Failed to unblock video:', e);
    throw new Error('Failed to unblock video');
  }
};

/**
 * Check if a user is blocked
 * @param userId The user ID to check
 * @returns Promise<boolean> True if user is blocked
 */
export const isUserBlocked = async (userId: string): Promise<boolean> => {
  if (!userId || typeof userId !== 'string') {
    return false;
  }

  try {
    const blockedUsers = await getBlockedItemIds(BLOCKED_USER_IDS_KEY);
    return blockedUsers.includes(userId);
  } catch (e) {
    console.error('Failed to check if user is blocked:', e);
    return false;
  }
};

/**
 * Check if a video is blocked
 * @param videoId The video ID to check
 * @returns Promise<boolean> True if video is blocked
 */
export const isVideoBlocked = async (videoId: string): Promise<boolean> => {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }

  try {
    const blockedVideos = await getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY);
    return blockedVideos.includes(videoId);
  } catch (e) {
    console.error('Failed to check if video is blocked:', e);
    return false;
  }
};

/**
 * Get all blocked users and videos
 * @returns Promise<BlockedItems> Object containing both blocked lists
 */
export const getAllBlockedItems = async (): Promise<BlockedItems> => {
  try {
    const [blockedUsers, blockedVideos] = await Promise.all([
      getBlockedItemIds(BLOCKED_USER_IDS_KEY),
      getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY),
    ]);
    return { blockedUsers, blockedVideos };
  } catch (e) {
    console.error('Failed to get all blocked items:', e);
    return { blockedUsers: [], blockedVideos: [] };
  }
};

/**
 * Filter out blocked videos from a video list
 * @param videos Array of videos to filter
 * @returns Promise<T[]> Filtered video array
 */
export const filterOutBlockedVideos = async <T extends VideoType>(
  videos: T[]
): Promise<T[]> => {
  if (!Array.isArray(videos)) {
    console.error('Invalid videos array provided');
    return [];
  }

  try {
    const { blockedUsers, blockedVideos } = await getAllBlockedItems();
    
    return videos.filter(video => {
      // Check if video object has required properties
      if (!video || !video.id || !video.uploader?.id) {
        console.warn('Video object missing required properties:', video);
        return false;
      }
      
      return !blockedUsers.includes(video.uploader.id) && 
             !blockedVideos.includes(video.id);
    });
  } catch (e) {
    console.error('Failed to filter blocked videos:', e);
    return videos; // Return original list if filtering fails
  }
};

/**
 * Clear all blocked items (for testing or user preference)
 */
export const clearAllBlockedItems = async (): Promise<void> => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(BLOCKED_USER_IDS_KEY),
      AsyncStorage.removeItem(BLOCKED_VIDEO_IDS_KEY),
    ]);
    console.log('All blocked items cleared');
  } catch (e) {
    console.error('Failed to clear blocked items:', e);
    throw new Error('Failed to clear blocked items');
  }
};

/**
 * Alternative storage format matching SharedPreferences approach
 * This stores individual keys like "video_<videoId>" and "user_<userId>" with "blocked" value
 */
export class LegacyBlockingStorage {
  /**
   * Block a video using legacy storage format
   * @param videoUrl The video URL to block
   */
  static async blockVideo(videoUrl: string): Promise<void> {
    if (!videoUrl || typeof videoUrl !== 'string') {
      throw new Error('Invalid videoUrl provided');
    }

    try {
      const key = `video_${videoUrl}`;
      await AsyncStorage.setItem(key, 'blocked');
      console.log(`Video blocked with legacy format: ${key}`);
    } catch (e) {
      console.error('Failed to block video (legacy):', e);
      throw new Error('Failed to block video');
    }
  }

  /**
   * Block a user using legacy storage format
   * @param userId The user ID to block
   */
  static async blockUser(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId provided');
    }

    try {
      const key = `user_${userId}`;
      await AsyncStorage.setItem(key, 'blocked');
      console.log(`User blocked with legacy format: ${key}`);
    } catch (e) {
      console.error('Failed to block user (legacy):', e);
      throw new Error('Failed to block user');
    }
  }

  /**
   * Get all blocked items using legacy storage format
   * @returns Promise<LegacyBlockedItems> Object containing blocked URLs and user IDs
   */
  static async getAllBlockedItems(): Promise<LegacyBlockedItems> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const blockedUrls: string[] = [];
      const blockedUsers: string[] = [];

      if (!keys || keys.length === 0) {
        return { blockedUrls, blockedUsers };
      }

      const items = await AsyncStorage.multiGet(keys);
      
      for (const [key, value] of items) {
        if (value === 'blocked' && key) {
          if (key.startsWith('video_')) {
            blockedUrls.push(key.replace('video_', ''));
          } else if (key.startsWith('user_')) {
            blockedUsers.push(key.replace('user_', ''));
          }
        }
      }

      return { blockedUrls, blockedUsers };
    } catch (e) {
      console.error('Failed to get blocked items (legacy):', e);
      return { blockedUrls: [], blockedUsers: [] };
    }
  }

  /**
   * Check if a video URL is blocked using legacy storage
   * @param videoUrl The video URL to check
   * @returns Promise<boolean> True if blocked
   */
  static async isVideoBlocked(videoUrl: string): Promise<boolean>  {
    if (!videoUrl || typeof videoUrl !== 'string') {
      return false;
    }

    try {
      const value = await AsyncStorage.getItem(`video_${videoUrl}`);
      return value === 'blocked';
    } catch (e) {
      console.error('Failed to check video block status (legacy):', e);
      return false;
    }
  }

  /**
   * Check if a user is blocked using legacy storage
   * @param userId The user ID to check
   * @returns Promise<boolean> True if blocked
   */
  static async isUserBlocked(userId: string): Promise<boolean>  {
    if (!userId || typeof userId !== 'string') {
      return false;
    }

    try {
      const value = await AsyncStorage.getItem(`user_${userId}`);
      return value === 'blocked';
    } catch (e) {
      console.error('Failed to check user block status (legacy):', e);
      return false;
    }
  }

  /**
   * Unblock a video using legacy storage format
   * @param videoUrl The video URL to unblock
   */
  static async unblockVideo(videoUrl: string): Promise<void> {
    if (!videoUrl || typeof videoUrl !== 'string') {
      throw new Error('Invalid videoUrl provided');
    }

    try {
      const key = `video_${videoUrl}`;
      await AsyncStorage.removeItem(key);
      console.log(`Video unblocked with legacy format: ${key}`);
    } catch (e) {
      console.error('Failed to unblock video (legacy):', e);
      throw new Error('Failed to unblock video');
    }
  }

  /**
   * Unblock a user using legacy storage format
   * @param userId The user ID to unblock
   */
  static async unblockUser(userId: string): Promise<void> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId provided');
    }

    try {
      const key = `user_${userId}`;
      await AsyncStorage.removeItem(key);
      console.log(`User unblocked with legacy format: ${key}`);
    } catch (e) {
      console.error('Failed to unblock user (legacy):', e);
      throw new Error('Failed to unblock user');
    }
  }
}

/**
 * Report user functionality (placeholder for backend integration)
 * @param userId The user ID to report
 * @param reason Optional reason for reporting
 */
export const reportUser = async (userId: string, reason?: string): Promise<void> => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId provided');
  }

  try {
    // TODO: Implement actual API call to your backend
    console.log(`Reporting user ${userId}${reason ? ` for: ${reason}` : ''}`);
    
    // For now, just log the report
    // In a real implementation, you would make an API call here:
    // const response = await apiService.reportUser({ userId, reason });
    
    // Store report locally for offline support
    const reportData: UserReport = {
      userId,
      reason,
      timestamp: new Date().toISOString(),
    };
    
    // Get existing reports
    const existingReportsJson = await AsyncStorage.getItem('userReports');
    const existingReports: UserReport[] = existingReportsJson ? JSON.parse(existingReportsJson) : [];
    
    // Add new report
    const updatedReports = [...existingReports, reportData];
    await AsyncStorage.setItem('userReports', JSON.stringify(updatedReports));
    
    console.log('User report submitted successfully');
  } catch (e) {
    console.error('Failed to report user:', e);
    throw new Error('Failed to report user');
  }
};

/**
 * Get all user reports
 * @returns Promise<UserReport[]> Array of user reports
 */
export const getUserReports = async (): Promise<UserReport[]> => {
  try {
    const reportsJson = await AsyncStorage.getItem('userReports');
    return reportsJson ? JSON.parse(reportsJson) : [];
  } catch (e) {
    console.error('Failed to get user reports:', e);
    return [];
  }
};

/**
 * Clear all user reports
 */
export const clearUserReports = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('userReports');
    console.log('All user reports cleared');
  } catch (e) {
    console.error('Failed to clear user reports:', e);
    throw new Error('Failed to clear user reports');
  }
};