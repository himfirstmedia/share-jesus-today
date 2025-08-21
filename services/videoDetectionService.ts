// VideoDetectionService.ts - Cross-platform video metadata detection
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

interface VideoMetadata {
  duration: number;
  width?: number;
  height?: number;
  size?: number;
  isValid: boolean;
  error?: string;
}

const ANDROID_9_API_LEVEL = 28;

class VideoDetectionService {
  private static instance: VideoDetectionService;
  
  public static getInstance(): VideoDetectionService {
    if (!VideoDetectionService.instance) {
      VideoDetectionService.instance = new VideoDetectionService();
    }
    return VideoDetectionService.instance;
  }

  private isAndroid9OrLower(): boolean {
    return Platform.OS === 'android' && Platform.Version <= ANDROID_9_API_LEVEL;
  }

  /**
   * Normalize URI for Android to use content:// instead of file://
   */
  public normalizeUri(uri: string): string {
    if (Platform.OS === "android" && uri.startsWith("file://")) {
      return uri.replace("file://", "content://");
    }
    return uri;
  }

  /**
   * Get video metadata using multiple fallback methods
   */
  public async getVideoMetadata(videoUri: string, retries: number = 3): Promise<VideoMetadata> {
    console.log(`VideoDetectionService: Getting metadata for ${videoUri}`);
    
    // First verify the file exists
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists || (fileInfo.exists && 'size' in fileInfo && (!fileInfo.size || fileInfo.size === 0))) {
        return {
          duration: 0,
          isValid: false,
          error: 'File does not exist or is empty'
        };
      }
    } catch (error) {
      console.error('VideoDetectionService: File check failed:', error);
      return {
        duration: 0,
        isValid: false,
        error: 'Failed to access file'
      };
    }

    // Try different methods based on platform
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`VideoDetectionService: Attempt ${attempt + 1}/${retries}`);
        
        if (this.isAndroid9OrLower()) {
          // Android 9 specific detection methods with fallbacks
          const result = await this.detectVideoMetadataAndroid9(videoUri);
          if (result.isValid && result.duration > 0) {
            console.log(`VideoDetectionService: Android 9 detection successful on attempt ${attempt + 1}`);
            return result;
          }
        } else {
          // Modern Android/iOS detection
          const result = await this.detectVideoMetadataModern(videoUri);
          if (result.isValid && result.duration > 0) {
            console.log(`VideoDetectionService: Modern detection successful on attempt ${attempt + 1}`);
            return result;
          }
        }

        // Fallback: Try MediaLibrary method
        const fallbackResult = await this.detectVideoMetadataFallback(videoUri);
        if (fallbackResult.isValid && fallbackResult.duration > 0) {
          console.log(`VideoDetectionService: Fallback detection successful on attempt ${attempt + 1}`);
          return fallbackResult;
        }

        // Wait before retry
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`VideoDetectionService: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        console.error(`VideoDetectionService: Attempt ${attempt + 1} failed:`, error);
        if (attempt === retries - 1) {
          return {
            duration: 0,
            isValid: false,
            error: `All detection methods failed: ${error.message}`
          };
        }
      }
    }

    return {
      duration: 0,
      isValid: false,
      error: 'Failed to detect video metadata after all retries'
    };
  }

  /**
   * Android 9 specific video detection using MediaLibrary with fallbacks
   */
  private async detectVideoMetadataAndroid9(videoUri: string): Promise<VideoMetadata> {
    let tempFileCreated = false;
    let destUri = '';
    
    try {
      console.log('VideoDetectionService: Using Android 9 detection method');
      
      // Request MediaLibrary permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('VideoDetectionService: MediaLibrary permission not granted, trying thumbnail hack...');
        return await this.tryThumbnailHackFallback(videoUri);
      }

      // Workaround: Copy file to cache directory before creating asset
      destUri = `${FileSystem.cacheDirectory}tempvideo-${Date.now()}.mp4`;
      await FileSystem.copyAsync({ from: videoUri, to: destUri });
      tempFileCreated = true;
      console.log('VideoDetectionService: File copied to cache directory for Android 9 workaround.');

      // Create asset from URI
      const asset = await MediaLibrary.createAssetAsync(destUri);
      
      if (!asset) {
        console.log('VideoDetectionService: Failed to create MediaLibrary asset, trying thumbnail hack...');
        return await this.tryThumbnailHackFallback(videoUri);
      }

      // Get asset info with additional details
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
      
      if (!assetInfo) {
        console.log('VideoDetectionService: Failed to get asset info, trying thumbnail hack...');
        return await this.tryThumbnailHackFallback(videoUri);
      }

      console.log('VideoDetectionService: Android 9 asset info:', {
        duration: assetInfo.duration,
        width: assetInfo.width,
        height: assetInfo.height
      });

      if (assetInfo.duration && assetInfo.duration > 0) {
        return {
          duration: assetInfo.duration,
          width: assetInfo.width,
          height: assetInfo.height,
          isValid: true
        };
      }

      // MediaLibrary gave invalid duration, try thumbnail hack
      console.log('VideoDetectionService: Android 9 MediaLibrary gave invalid duration, falling back to thumbnail hack...');
      const thumbnailResult = await this.tryThumbnailHackFallback(videoUri);
      if (thumbnailResult.isValid && thumbnailResult.duration > 0) {
        return {
          ...thumbnailResult,
          width: assetInfo.width,
          height: assetInfo.height,
        };
      }

      throw new Error('Invalid duration from MediaLibrary and thumbnail hack failed');

    } catch (error) {
      console.error('VideoDetectionService: Android 9 detection failed:', error);
      
      // Last resort: try thumbnail hack
      try {
        const thumbnailResult = await this.tryThumbnailHackFallback(videoUri);
        if (thumbnailResult.isValid) {
          return thumbnailResult;
        }
      } catch (thumbnailError) {
        console.error('VideoDetectionService: Thumbnail hack also failed:', thumbnailError);
      }
      
      throw error;
    } finally {
      // Cleanup the temporary file
      if (tempFileCreated && destUri) {
        try {
          await FileSystem.deleteAsync(destUri, { idempotent: true });
        } catch (cleanupError) {
          console.warn('VideoDetectionService: Failed to cleanup temp file:', cleanupError);
        }
      }
    }
  }

  /**
   * Try thumbnail hack as fallback for Android 9
   */
  private async tryThumbnailHackFallback(videoUri: string): Promise<VideoMetadata> {
    const duration = await this.getDurationWithThumbnailHack(videoUri);
    if (duration > 0) {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;
      
      return {
        duration,
        size: fileSize,
        isValid: true
      };
    }

    // If thumbnail hack fails, try file size estimation as last resort
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (fileInfo.exists && 'size' in fileInfo && fileInfo.size) {
      const estimatedDuration = this.estimateDurationFromFileSize(fileInfo.size);
      console.log(`VideoDetectionService: Using estimated duration: ${estimatedDuration}s`);
      
      return {
        duration: estimatedDuration,
        size: fileInfo.size,
        isValid: true
      };
    }

    throw new Error('All Android 9 fallback methods failed');
  }

  /**
   * Modern platform video detection using FFProbe-like approach
   */
  private async detectVideoMetadataModern(videoUri: string): Promise<VideoMetadata> {
    try {
      console.log('VideoDetectionService: Using modern detection method');
      
      // First try MediaLibrary approach (works on modern versions too)
      const result = await this.detectVideoMetadataFallback(videoUri);
      if (result.isValid) {
        return result;
      }

      // Fallback to thumbnail hack
      const duration = await this.getDurationWithThumbnailHack(videoUri);
      if (duration > 0) {
        console.log('VideoDetectionService: Modern detection successful with thumbnail hack.');
        return {
          duration,
          isValid: true,
        };
      }

      throw new Error('Modern detection methods failed');

    } catch (error) {
      console.error('VideoDetectionService: Modern detection failed:', error);
      throw error;
    }
  }

  /**
   * Fallback detection using MediaLibrary (cross-platform)
   */
  private async detectVideoMetadataFallback(videoUri: string): Promise<VideoMetadata> {
    try {
      console.log('VideoDetectionService: Using fallback detection method');
      
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('VideoDetectionService: MediaLibrary permission not granted, trying alternative...');
        return await this.detectVideoMetadataAlternative(videoUri);
      }

      // Try to create asset
      const asset = await MediaLibrary.createAssetAsync(videoUri);
      
      if (asset && asset.duration !== undefined && asset.duration > 0) {
        console.log('VideoDetectionService: Fallback detection successful');
        return {
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
          isValid: true
        };
      }

      throw new Error('Invalid asset or duration');

    } catch (error) {
      console.error('VideoDetectionService: Fallback detection failed:', error);
      // Try alternative method
      return await this.detectVideoMetadataAlternative(videoUri);
    }
  }

  /**
   * Alternative detection when MediaLibrary fails
   */
  private async detectVideoMetadataAlternative(videoUri: string): Promise<VideoMetadata> {
    try {
      console.log('VideoDetectionService: Using alternative detection method');

      // 1. Use the VideoThumbnails hack to get duration
      const thumbnailDuration = await this.getDurationWithThumbnailHack(videoUri);

      if (thumbnailDuration > 0) {
        const fileInfo = await FileSystem.getInfoAsync(videoUri);
        const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;
        return {
          duration: thumbnailDuration,
          size: fileSize,
          isValid: true,
        };
      }
      
      // 2. Fallback to basic file validation if the thumbnail hack fails
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      
      if (!fileInfo.exists || (fileInfo.exists && 'size' in fileInfo && !fileInfo.size)) {
        throw new Error('File validation failed');
      }
      
      console.log('VideoDetectionService: File is accessible, duration detection will be handled by video player');
      
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;
      return {
        duration: -1, // Indicates that duration detection should be handled elsewhere
        size: fileSize,
        isValid: true
      };

    } catch (error) {
      console.error('VideoDetectionService: Alternative detection failed:', error);
      throw error;
    }
  }

  /**
   * Use expo-video-thumbnails with binary search to find actual duration
   */
  private async getDurationWithThumbnailHack(uri: string): Promise<number> {
    try {
      console.log('VideoDetectionService: Starting binary search thumbnail hack...');
      
      let low = 0;
      let high = 60 * 60 * 3 * 1000; // assume max 3 hours in milliseconds
      let duration = 0;
      let attempts = 0;
      const maxAttempts = 15; // Limit binary search attempts
      
      while (low <= high && attempts < maxAttempts) {
        attempts++;
        const mid = Math.floor((low + high) / 2);
        
        try {
          const result = await VideoThumbnails.getThumbnailAsync(uri, { 
            time: mid,
            quality: 0.1 // Use lowest quality for faster processing
          });
          
          if (result && result.uri) {
            // Thumbnail was generated successfully, video is at least this long
            duration = mid;
            low = mid + 1000; // Try 1 second higher
          } else {
            // Failed to generate thumbnail, video is shorter
            high = mid - 1000; // Try 1 second lower
          }
        } catch (thumbnailError) {
          // Error generating thumbnail, video is probably shorter
          high = mid - 1000;
        }
        
        // Break early if we're getting close
        if (high - low < 2000) { // Less than 2 seconds difference
          break;
        }
      }
      
      const finalDuration = duration / 1000; // Convert to seconds
      console.log(`VideoDetectionService: Binary search completed in ${attempts} attempts. Duration: ${finalDuration}s`);
      
      return finalDuration;
    } catch (e) {
      console.error('VideoDetectionService: Binary search thumbnail hack failed:', e);
      
      // Fallback to old method
      try {
        const result = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 99999999, // forces it to clamp to the end of the video
          quality: 0.1
        });
        
        // Cast to any to access potentially undocumented duration property
        const duration = (result as any).duration;
        if (duration && duration > 0) {
          console.log('VideoDetectionService: Fallback thumbnail hack successful');
          return duration;
        }
      } catch (fallbackError) {
        console.error('VideoDetectionService: Fallback thumbnail hack also failed:', fallbackError);
      }
      
      return 0;
    }
  }

  /**
   * Quick file validation without metadata detection
   */
  public async validateVideoFile(videoUri: string): Promise<{ isValid: boolean; error?: string; size?: number }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      
      if (!fileInfo.exists) {
        return { isValid: false, error: 'File does not exist' };
      }
      
      const fileSize = 'size' in fileInfo ? fileInfo.size : undefined;
      
      if (!fileSize || fileSize === 0) {
        return { isValid: false, error: 'File is empty' };
      }

      // Basic file size validation (e.g., minimum 1KB for a valid video)
      if (fileSize < 1024) {
        return { isValid: false, error: 'File too small to be a valid video' };
      }

      return { 
        isValid: true, 
        size: fileSize 
      };

    } catch (error: any) {
      console.error('VideoDetectionService: File validation failed:', error);
      return { 
        isValid: false, 
        error: error.message || 'File validation failed' 
      };
    }
  }

  /**
   * Estimate duration from file size (very rough approximation)
   * This is a last resort when no other method works
   */
  public estimateDurationFromFileSize(fileSizeBytes: number, quality: 'low' | 'medium' | 'high' = 'medium'): number {
    // Very rough estimates based on typical bitrates
    const bitratesKbps = {
      low: 500,    // 500 kbps
      medium: 1500, // 1.5 Mbps
      high: 3000   // 3 Mbps
    };

    const bitrate = bitratesKbps[quality];
    const fileSizeKb = fileSizeBytes / 1024;
    const estimatedDurationSeconds = (fileSizeKb * 8) / bitrate;

    console.log(`VideoDetectionService: Estimated duration: ${estimatedDurationSeconds}s (${quality} quality assumption)`);
    
    return Math.max(0, estimatedDurationSeconds);
  }
}

export default VideoDetectionService.getInstance();