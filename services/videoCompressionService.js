// services/videoCompressionService.js
import * as FileSystem from 'expo-file-system';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';

// Utility Functions for persistent storage
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory in compression service:', error);
    throw error;
  }
};

class VideoCompressionService {
  constructor() {
    this.maxFileSize = 15 * 1024 * 1024; // 15MB default limit
    this.compressionQuality = {
      high: { videoBitrate: 2000000, audioBitrate: 192000 },
      medium: { videoBitrate: 1000000, audioBitrate: 128000 },
      low: { videoBitrate: 500000, audioBitrate: 96000 }
    };
  }

  /**
   * Get video file information including duration, size, and dimensions
   */
  async getVideoInfo(uri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      // Try to get video metadata using thumbnail generation
      let metadata = null;
      try {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 0,
          quality: 0.1,
        });
        
        if (thumbnail.uri) {
          // Video is valid, we can work with it
          metadata = {
            isValid: true,
            thumbnail: thumbnail.uri
          };
        }
      } catch (thumbnailError) {
        console.warn('Could not generate thumbnail:', thumbnailError);
        metadata = { isValid: false };
      }

      return {
        ...fileInfo,
        sizeMB: Math.round(fileInfo.size / 1024 / 1024 * 100) / 100,
        metadata
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      throw error;
    }
  }

  /**
   * Determine if video needs compression based on file size
   */
  needsCompression(videoInfo, maxSizeMB = null) {
    const limit = maxSizeMB || (this.maxFileSize / 1024 / 1024);
    return videoInfo.sizeMB > limit;
  }

  /**
   * Calculate optimal recording settings to stay under size limit
   */
  getOptimalRecordingSettings(durationSeconds, targetSizeMB = 15) {
    // Calculate required bitrate to stay under target size
    // Formula: File Size (MB) = (Video Bitrate + Audio Bitrate) * Duration (s) / 8 / 1024 / 1024
    
    const targetBytes = targetSizeMB * 1024 * 1024;
    const audioBitrate = 128000; // 128 kbps audio
    const overhead = 0.1; // 10% overhead for container and metadata
    
    const availableBitsPerSecond = (targetBytes * 8 / durationSeconds) * (1 - overhead);
    const videoBitrate = Math.max(300000, availableBitsPerSecond - audioBitrate); // Min 300kbps
    
    let quality = 'low';
    if (videoBitrate >= 1500000) {
      quality = 'high';
    } else if (videoBitrate >= 800000) {
      quality = 'medium';
    }

    return {
      quality,
      videoBitrate: Math.round(videoBitrate),
      audioBitrate,
      estimatedSizeMB: Math.round((videoBitrate + audioBitrate) * durationSeconds / 8 / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Basic video validation
   */
  async validateVideo(uri) {
    try {
      const info = await this.getVideoInfo(uri);
      
      const validations = {
        fileExists: info.exists,
        hasValidSize: info.size > 0,
        isNotTooLarge: info.sizeMB <= 50, // Hard limit of 50MB
        isVideoValid: info.metadata?.isValid !== false
      };

      const isValid = Object.values(validations).every(v => v === true);

      return {
        isValid,
        info,
        validations,
        errors: Object.entries(validations)
          .filter(([key, value]) => !value)
          .map(([key]) => this.getValidationErrorMessage(key))
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  getValidationErrorMessage(validationType) {
    const messages = {
      fileExists: 'Video file not found',
      hasValidSize: 'Video file is empty or corrupted',
      isNotTooLarge: 'Video file is too large (over 50MB)',
      isVideoValid: 'Video format is not supported or file is corrupted'
    };
    return messages[validationType] || 'Unknown validation error';
  }

  /**
   * Compresses a video using react-native-compressor.
   */
  async createCompressedCopy(sourceUri, options = {}) {
    try {
      const {
        compressionMethod = 'auto', // 'auto', 'manual', or 'off'
        maxSizeMB = 15,
        minFileSizeForCompression = 1, // Don't compress files smaller than 1MB
        progressCallback,
      } = options;

      if (compressionMethod === 'off') {
        console.log('Compression is turned off.');
        return sourceUri;
      }

      const sourceInfo = await this.getVideoInfo(sourceUri);
      if (!sourceInfo.exists) {
        throw new Error('Source video file not found for compression.');
      }
      
      if (sourceInfo.sizeMB < minFileSizeForCompression) {
        console.log(`Video size (${sourceInfo.sizeMB}MB) is below threshold (${minFileSizeForCompression}MB), skipping compression.`);
        return sourceUri;
      }

      console.log(`Starting compression for: ${sourceUri} (${sourceInfo.sizeMB}MB)`);

      const result = await Video.compress(
        sourceUri,
        {
          compressionMethod: 'auto',
        },
        (progress) => {
          if (progressCallback) {
            progressCallback(progress);
          }
          console.log('Compression Progress: ', progress);
        }
      );


      if (!result) {
        throw new Error('Video compression failed to return a valid path.');
      }

      const compressedTempUri = result;

      // Add retry logic for getVideoInfo on the temporary compressed file
      let compressedInfo = null;
      const MAX_INFO_RETRIES = 5;
      const INFO_RETRY_DELAY_MS = 500; // 0.5 seconds

      for (let i = 0; i < MAX_INFO_RETRIES; i++) {
        try {
          compressedInfo = await this.getVideoInfo(compressedTempUri);
          if (compressedInfo.exists && compressedInfo.size > 0) {
            console.log(`LOG: Compressed file info retrieved successfully after ${i + 1} attempts.`);
            break;
          }
        } catch (infoError) {
          console.warn(`WARN: Attempt ${i + 1} to get compressed file info failed:`, infoError);
        }
        await new Promise(resolve => setTimeout(resolve, INFO_RETRY_DELAY_MS));
      }

      if (!compressedInfo || !compressedInfo.exists || compressedInfo.size === 0) {
        throw new Error('Compressed video file is invalid or empty after retries.');
      }

      console.log(`Compression successful: ${compressedTempUri} (${compressedInfo.sizeMB}MB)`);

      // Define the persistent directory and ensure it exists
      const videoFilesDirectory = await initializeVideoFilesDirectory();

      // Create a unique file name for the persistent compressed video
      const fileName = `compressed_video_${Date.now()}.mp4`;
      const persistentCompressedUri = `${videoFilesDirectory}${fileName}`;

      // Copy the compressed video from the temporary cache to the persistent directory
      await FileSystem.copyAsync({ from: compressedTempUri, to: persistentCompressedUri });
      console.log(`LOG: Moved compressed video to persistent storage: ${persistentCompressedUri}`);

      // Clean up the temporary compressed file from cache
      await FileSystem.deleteAsync(compressedTempUri, { idempotent: true });
      console.log(`LOG: Deleted temporary compressed file from cache: ${compressedTempUri}`);

      // Optional: Delete the original source file if it's in a temp directory
      if (sourceUri.includes(FileSystem.cacheDirectory)) {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
        console.log(`LOG: Deleted temporary source file: ${sourceUri}`);
      }

      return persistentCompressedUri;
    } catch (error) {
      console.error('Video compression failed:', error);
      // Fallback to returning the original URI if compression fails
      return sourceUri;
    }
  }

  /**
   * Clean up temporary video files
   */
  async cleanupTempFiles() {
    try {
      const documentDir = FileSystem.documentDirectory;
      const files = await FileSystem.readDirectoryAsync(documentDir);
      
      const videoFiles = files.filter(file => 
        file.includes('compressed_') || 
        file.includes('recording_') ||
        file.includes('temp_video_')
      );

      for (const file of videoFiles) {
        try {
          const filePath = `${documentDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          // Delete files older than 1 hour
          const oneHourAgo = Date.now() - (60 * 60 * 1000);
          if (fileInfo.modificationTime < oneHourAgo) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            console.log(`Cleaned up old video file: ${file}`);
          }
        } catch (error) {
          console.warn(`Could not clean up file ${file}:`, error);
        }
      }
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  }

  /**
   * Get recommended camera settings for recording
   */
  getRecommendedCameraSettings(maxDurationSeconds = 30, targetSizeMB = 15) {
    const settings = this.getOptimalRecordingSettings(maxDurationSeconds, targetSizeMB);
    
    return {
      maxDuration: maxDurationSeconds,
      quality: settings.quality === 'high' ? '720p' : settings.quality === 'medium' ? '480p' : '360p',
      videoBitrate: settings.videoBitrate,
      audioBitrate: settings.audioBitrate,
      videoCodec: 'h264',
      audioCodec: 'aac',
      estimatedSizeMB: settings.estimatedSizeMB
    };
  }
}

export default new VideoCompressionService();