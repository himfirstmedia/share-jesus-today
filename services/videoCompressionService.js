// services/videoCompressionService.js - Fixed version with proper file handling
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

// Helper function to verify file exists and is valid - FIXED to handle cache files properly
const verifyFileWithRetry = async (uri, maxRetries = 5, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 1000) { // At least 1KB
        console.log(`LOG: File verified on attempt ${attempt}: ${uri} (${fileInfo.size} bytes)`);
        return fileInfo;
      } else {
        console.warn(`WARN: File check failed on attempt ${attempt}: exists=${fileInfo.exists}, size=${fileInfo.size}`);
      }
    } catch (error) {
      console.warn(`WARN: File verification attempt ${attempt} failed:`, error.message);
    }

    if (attempt < maxRetries) {
      console.log(`LOG: Waiting ${delayMs}ms before retry attempt ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return null;
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
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      if (!fileInfo.size || fileInfo.size === 0) {
        throw new Error('Video file is empty');
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
   * FIXED: Properly handles cache files and moves them to persistent storage
   */
  async createCompressedCopy(sourceUri, options = {}) {
    let compressedTempUri = null;

    try {
      const {
        compressionMethod = 'auto', // 'auto', 'manual', or 'off'
        maxSizeMB = 15,
        minFileSizeForCompression = 1, // Don't compress files smaller than 1MB
        progressCallback,
      } = options;

      if (compressionMethod === 'off') {
        console.log('LOG: Compression is turned off.');
        return sourceUri;
      }

      // Verify source file exists and is valid
      const sourceInfo = await this.getVideoInfo(sourceUri);
      if (!sourceInfo.exists || sourceInfo.size === 0) {
        console.error('ERROR: Source video file not found or empty for compression:', sourceUri);
        return null;
      }

      if (sourceInfo.sizeMB < minFileSizeForCompression) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) is below threshold (${minFileSizeForCompression}MB), skipping compression.`);
        return sourceUri;
      }

      console.log(`LOG: Starting compression for: ${sourceUri} (${sourceInfo.sizeMB}MB)`);

      // Perform compression - this will create a file in cache directory
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
        console.error('ERROR: Video compression failed to return a valid path.');
        return null;
      }

      compressedTempUri = result;
      console.log(`LOG: Compression completed, temp file in cache: ${compressedTempUri}`);
      // ✅ FIX: Delay before checking file existence to allow disk write to complete
      await new Promise(resolve => setTimeout(resolve, 1000));


      // CRITICAL FIX: Verify the compressed file exists in cache with immediate retry
      const compressedFileInfo = await verifyFileWithRetry(compressedTempUri, 5, 500);
      if (!compressedFileInfo) {
        console.error('ERROR: Compressed video file is invalid or empty in cache after retries.');
        return null;
      }

      const compressedSizeMB = Math.round(compressedFileInfo.size / 1024 / 1024 * 100) / 100;
      console.log(`LOG: Compression verification successful in cache: ${compressedTempUri} (${compressedSizeMB}MB)`);

      // Initialize persistent directory
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `compressed_video_${Date.now()}.mp4`;
      const persistentCompressedUri = `${videoFilesDirectory}${fileName}`;

      // CRITICAL FIX: Copy from cache to persistent storage immediately
      console.log(`LOG: Moving compressed file from cache to persistent storage: ${persistentCompressedUri}`);
      await FileSystem.copyAsync({
        from: compressedTempUri,
        to: persistentCompressedUri
      });

      // Verify the copy was successful in persistent storage
      const persistentFileInfo = await verifyFileWithRetry(persistentCompressedUri, 3, 500);
      if (!persistentFileInfo) {
        console.error('ERROR: Failed to copy compressed file to persistent storage');

        // Clean up the temp file before returning null
        try {
          await FileSystem.deleteAsync(compressedTempUri, { idempotent: true });
          console.log(`LOG: Cleaned up temp file after copy failure: ${compressedTempUri}`);
        } catch (cleanupError) {
          console.warn('WARN: Failed to delete temp file after copy failure:', cleanupError);
        }

        return null;
      }

      console.log(`LOG: Successfully moved compressed video to persistent storage: ${persistentCompressedUri}`);

      // Clean up the temporary compressed file in cache
      try {
        await FileSystem.deleteAsync(compressedTempUri, { idempotent: true });
        console.log(`LOG: Deleted temporary compressed file from cache: ${compressedTempUri}`);
      } catch (cleanupError) {
        console.warn('WARN: Failed to delete temporary compressed file from cache:', cleanupError);
      }

      // Optional: Delete the original source file if it's in a temp/cache directory
      if (sourceUri.includes(FileSystem.cacheDirectory) || sourceUri.includes('/cache/')) {
        try {
          await FileSystem.deleteAsync(sourceUri, { idempotent: true });
          console.log(`LOG: Deleted temporary source file: ${sourceUri}`);
        } catch (cleanupError) {
          console.warn('WARN: Failed to delete temporary source file:', cleanupError);
        }
      }

      return persistentCompressedUri;

    } catch (error) {
      console.error('ERROR: Video compression failed:', error);

      // Clean up any temporary files on error
      if (compressedTempUri) {
        try {
          await FileSystem.deleteAsync(compressedTempUri, { idempotent: true });
          console.log(`LOG: Cleaned up temp file after error: ${compressedTempUri}`);
        } catch (cleanupError) {
          console.warn('WARN: Failed to cleanup temp file after error:', cleanupError);
        }
      }

      // Return null to indicate compression failed
      // The calling code should handle this and use the original file
      return null;
    }
  }

  /**
   * Clean up temporary video files
   */
  async cleanupTempFiles() {
    try {
      // Clean up both document directory and cache directory
      const directories = [
        FileSystem.documentDirectory,
        FileSystem.cacheDirectory
      ];

      for (const directory of directories) {
        if (!directory) continue;

        try {
          const files = await FileSystem.readDirectoryAsync(directory);

          const videoFiles = files.filter(file =>
            file.includes('compressed_') ||
            file.includes('recording_') ||
            file.includes('temp_video_') ||
            file.endsWith('.mp4')
          );

          for (const file of videoFiles) {
            try {
              const filePath = `${directory}${file}`;
              const fileInfo = await FileSystem.getInfoAsync(filePath);

              // Delete files older than 1 hour
              const oneHourAgo = Date.now() - (60 * 60 * 1000);
              if (fileInfo.modificationTime && (fileInfo.modificationTime * 1000) < oneHourAgo) {
                await FileSystem.deleteAsync(filePath, { idempotent: true });
                console.log(`LOG: Cleaned up old video file: ${file}`);
              }
            } catch (error) {
              console.warn(`WARN: Could not clean up file ${file}:`, error);
            }
          }
        } catch (dirError) {
          console.warn(`WARN: Could not read directory ${directory}:`, dirError);
        }
      }
    } catch (error) {
      console.warn('WARN: Error during cleanup:', error);
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