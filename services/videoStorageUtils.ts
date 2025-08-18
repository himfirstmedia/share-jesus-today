// VideoStorageUtils.ts - Comprehensive video cleanup utilities
import * as FileSystem from 'expo-file-system';
import React from 'react';
import { Alert } from 'react-native';

const VIDEO_DIRECTORY = `${FileSystem.documentDirectory}videofiles/`;
const MAX_VIDEO_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_STORAGE_SIZE = 100 * 1024 * 1024; // 100MB max for video cache

export interface VideoFileInfo {
  name: string;
  path: string;
  size: number;
  modificationTime: number;
  age: number;
}

export class VideoStorageManager {
  
  /**
   * Get detailed information about all videos in the directory
   */
  static async getVideoFiles(): Promise<VideoFileInfo[]> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(VIDEO_DIRECTORY);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(VIDEO_DIRECTORY);
      const videoFiles: VideoFileInfo[] = [];
      const now = Date.now();

      for (const fileName of files) {
        const filePath = `${VIDEO_DIRECTORY}${fileName}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && fileInfo.size) {
          videoFiles.push({
            name: fileName,
            path: filePath,
            size: fileInfo.size,
            modificationTime: fileInfo.modificationTime || 0,
            age: now - (fileInfo.modificationTime || 0) * 1000,
          });
        }
      }

      return videoFiles.sort((a, b) => b.modificationTime - a.modificationTime);
    } catch (error) {
      console.error('Failed to get video files:', error);
      return [];
    }
  }

  /**
   * Calculate total storage used by video files
   */
  static async getStorageUsage(): Promise<{ totalSize: number; fileCount: number }> {
    const files = await this.getVideoFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return { totalSize, fileCount: files.length };
  }

  /**
   * Clean up old videos based on age
   */
  static async cleanupOldVideos(maxAge: number = MAX_VIDEO_AGE): Promise<number> {
    try {
      const files = await this.getVideoFiles();
      let deletedCount = 0;

      for (const file of files) {
        if (file.age > maxAge) {
          await FileSystem.deleteAsync(file.path, { idempotent: true });
          deletedCount++;
          console.log(`Deleted old video: ${file.name} (${(file.age / (24 * 60 * 60 * 1000)).toFixed(1)} days old)`);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup old videos:', error);
      return 0;
    }
  }

  /**
   * Clean up videos to stay under storage limit
   */
  static async cleanupBySize(maxSize: number = MAX_STORAGE_SIZE): Promise<number> {
    try {
      const files = await this.getVideoFiles();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      
      if (totalSize <= maxSize) {
        return 0;
      }

      // Sort by age (oldest first) and delete until under limit
      const sortedByAge = [...files].sort((a, b) => a.modificationTime - b.modificationTime);
      let currentSize = totalSize;
      let deletedCount = 0;

      for (const file of sortedByAge) {
        if (currentSize <= maxSize) break;
        
        await FileSystem.deleteAsync(file.path, { idempotent: true });
        currentSize -= file.size;
        deletedCount++;
        console.log(`Deleted video for storage: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup videos by size:', error);
      return 0;
    }
  }

  /**
   * Clear all videos in the directory
   */
  static async clearAllVideos(): Promise<number> {
    try {
      const files = await this.getVideoFiles();
      let deletedCount = 0;

      for (const file of files) {
        await FileSystem.deleteAsync(file.path, { idempotent: true });
        deletedCount++;
      }

      console.log(`Cleared all videos: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      console.error('Failed to clear all videos:', error);
      return 0;
    }
  }

  /**
   * Delete specific video file
   */
  static async deleteVideo(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.log(`Deleted video: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete video ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Comprehensive cleanup (combines age and size cleanup)
   */
  static async performMaintenance(): Promise<{ deletedByAge: number; deletedBySize: number }> {
    console.log('Starting video storage maintenance...');
    
    const deletedByAge = await this.cleanupOldVideos();
    const deletedBySize = await this.cleanupBySize();
    
    const { totalSize, fileCount } = await this.getStorageUsage();
    console.log(`Maintenance complete. ${fileCount} files remaining, ${(totalSize / 1024 / 1024).toFixed(1)}MB used`);
    
    return { deletedByAge, deletedBySize };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Show storage usage alert with cleanup options
   */
  static async showStorageAlert(): Promise<void> {
    const { totalSize, fileCount } = await this.getStorageUsage();
    const sizeText = this.formatFileSize(totalSize);

    Alert.alert(
      'Video Storage',
      `${fileCount} video files using ${sizeText}\n\nWould you like to clean up old files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clean Old Files', 
          onPress: async () => {
            const deleted = await this.cleanupOldVideos();
            Alert.alert('Cleanup Complete', `Deleted ${deleted} old video files`);
          }
        },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Clear All Videos',
              'This will delete all cached video files. Are you sure?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete All', 
                  style: 'destructive',
                  onPress: async () => {
                    const deleted = await this.clearAllVideos();
                    Alert.alert('All Videos Cleared', `Deleted ${deleted} video files`);
                  }
                }
              ]
            );
          }
        }
      ]
    );
  }
}

// Hook for easy integration with React components
export const useVideoStorage = () => {
  const [storageInfo, setStorageInfo] = React.useState({ totalSize: 0, fileCount: 0 });
  const [isLoading, setIsLoading] = React.useState(false);

  const refreshStorageInfo = async () => {
    setIsLoading(true);
    try {
      const info = await VideoStorageManager.getStorageUsage();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to refresh storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    refreshStorageInfo();
  }, []);

  return {
    storageInfo,
    isLoading,
    refreshStorageInfo,
    clearAllVideos: VideoStorageManager.clearAllVideos,
    cleanupOldVideos: VideoStorageManager.cleanupOldVideos,
    showStorageAlert: VideoStorageManager.showStorageAlert,
  };
};