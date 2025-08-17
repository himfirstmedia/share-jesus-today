import * as FileSystem from 'expo-file-system';
import { Video } from 'react-native-compressor';

// --- Type Definitions ---
type ExistingVideoInfo = {
  uri: string;
  exists: true;
  size: number;
  sizeMB: number;
}

type NonExistingVideoInfo = {
  uri: string;
  exists: false;
}

type VideoInfo = ExistingVideoInfo | NonExistingVideoInfo;

interface CompressionOptions {
  maxSizeMB?: number;
  minFileSizeForCompression?: number;
  progressCallback?: (progress: number) => void;
  targetDirectory?: string;
}

interface CameraCompressionResult {
  success: boolean;
  uri: string;
  originalSizeMB?: number;
  compressedSizeMB?: number;
  compressionRatio?: string;
  error?: string;
}

// --- Helper Functions ---
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const ensureVideoFilesDirectory = async (customPath?: string): Promise<string> => {
  try {
    const videoFilesDirectory = customPath || `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory:', error);
    throw error;
  }
};

/**
 * Validates that a file exists and has content before proceeding
 */
const validateSourceFile = async (sourceUri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
    const isValid = fileInfo.exists && fileInfo.size > 0;
    
    if (!isValid) {
      console.warn(`WARN: Source file validation failed: exists=${fileInfo.exists}, size=${fileInfo.size}`);
    }
    
    return isValid;
  } catch (error) {
    console.error('ERROR: Failed to validate source file:', error);
    return false;
  }
};

/**
 * Enhanced direct compression with pre-validation
 */
const compressDirectlyToDirectory = async (
  sourceUri: string,
  targetDirectory: string,
  options: CompressionOptions = {}
): Promise<string | null> => {
  try {
    // First, validate the source file still exists
    const sourceValid = await validateSourceFile(sourceUri);
    if (!sourceValid) {
      console.error('ERROR: Source file not valid for compression:', sourceUri);
      return null;
    }

    const fileName = `compressed_${Date.now()}.mp4`;
    const targetPath = `${targetDirectory}${fileName}`;
    
    console.log(`LOG: Attempting direct compression from validated source`);
    console.log(`LOG: Source: ${sourceUri}`);
    console.log(`LOG: Target: ${targetPath}`);

    const result = await Video.compress(
      sourceUri,
      {
        compressionMethod: 'auto',
        outputExtension: '.mp4',
        includeAudio: true,
        minimumFileSizeForCompress: options.minFileSizeForCompression || 1,
      },
      (progress) => {
        if (options.progressCallback) {
          options.progressCallback(progress * 0.9); // Reserve 10% for file operations
        }
      }
    );

    console.log(`LOG: Compression result URI: ${result}`);

    // Validate the compression result
    if (result && result !== sourceUri) {
      const resultValid = await validateSourceFile(result);
      if (resultValid) {
        const resultFileInfo = await FileSystem.getInfoAsync(result, { size: true });
        console.log(`LOG: Compression successful: ${result} (${resultFileInfo.size} bytes)`);
        
        // If the compressed file is not in our target directory, copy it
        if (!result.startsWith(targetDirectory)) {
          try {
            console.log(`LOG: Copying compressed file to target directory`);
            await FileSystem.copyAsync({
              from: result,
              to: targetPath,
            });
            
            const copyValid = await validateSourceFile(targetPath);
            if (copyValid) {
              console.log(`LOG: Successfully copied to: ${targetPath}`);
              
              // Clean up the temporary compressed file if it's in cache
              if (result.includes('/cache/')) {
                try {
                  await FileSystem.deleteAsync(result, { idempotent: true });
                  console.log(`LOG: Cleaned up temporary file: ${result}`);
                } catch (cleanupError) {
                  console.warn('WARN: Could not cleanup temporary file:', cleanupError);
                }
              }
              
              if (options.progressCallback) options.progressCallback(1.0);
              return targetPath;
            } else {
              console.warn('WARN: Copy validation failed');
            }
          } catch (copyError) {
            console.warn('WARN: Could not copy to target directory:', copyError);
            // Return the compressed file even if copy failed
            if (options.progressCallback) options.progressCallback(1.0);
            return result;
          }
        } else {
          // File is already in target directory
          if (options.progressCallback) options.progressCallback(1.0);
          return result;
        }
      } else {
        console.warn('WARN: Compression result validation failed');
      }
    }

    return null;
  } catch (error) {
    console.error('ERROR: Direct compression failed:', error);
    return null;
  }
};

/**
 * Fallback compression with multiple quality settings and validation
 */
const tryFallbackCompression = async (
  sourceUri: string,
  targetDirectory: string,
  options: CompressionOptions = {}
): Promise<string | null> => {
  try {
    // Validate source before attempting fallback
    const sourceValid = await validateSourceFile(sourceUri);
    if (!sourceValid) {
      console.error('ERROR: Source file not valid for fallback compression:', sourceUri);
      return null;
    }

    console.log(`LOG: Trying fallback compression methods`);

    const compressionSettings = [
      { compressionMethod: 'manual', quality: 'medium' },
      { compressionMethod: 'manual', quality: 'low' },
      { compressionMethod: 'auto' },
    ];

    for (const settings of compressionSettings) {
      try {
        console.log(`LOG: Trying compression with:`, settings);
        
        // Re-validate source before each attempt
        const stillValid = await validateSourceFile(sourceUri);
        if (!stillValid) {
          console.error(`ERROR: Source file became invalid during fallback compression`);
          return null;
        }
        
        const result = await Video.compress(
          sourceUri,
          {
            ...settings,
            outputExtension: '.mp4',
            includeAudio: true,
            minimumFileSizeForCompress: options.minFileSizeForCompression || 1,
          },
          (progress) => {
            if (options.progressCallback) {
              options.progressCallback(progress * 0.8); // Reserve 20% for file operations
            }
          }
        );

        if (result && result !== sourceUri) {
          const resultValid = await validateSourceFile(result);
          if (resultValid) {
            console.log(`LOG: Fallback compression successful: ${result}`);
            
            // Try to move to target directory if needed
            if (!result.startsWith(targetDirectory)) {
              const fileName = `fallback_compressed_${Date.now()}.mp4`;
              const targetPath = `${targetDirectory}${fileName}`;
              
              try {
                await FileSystem.copyAsync({
                  from: result,
                  to: targetPath,
                });
                
                const copyValid = await validateSourceFile(targetPath);
                if (copyValid) {
                  // Clean up original if in cache
                  if (result.includes('/cache/')) {
                    try {
                      await FileSystem.deleteAsync(result, { idempotent: true });
                    } catch (cleanupError) {
                      console.warn('WARN: Could not cleanup fallback file:', cleanupError);
                    }
                  }
                  
                  if (options.progressCallback) options.progressCallback(1.0);
                  return targetPath;
                }
              } catch (copyError) {
                console.warn('WARN: Could not copy fallback result:', copyError);
                // Return original result even if copy failed
                if (options.progressCallback) options.progressCallback(1.0);
                return result;
              }
            }
            
            if (options.progressCallback) options.progressCallback(1.0);
            return result;
          } else {
            console.warn('WARN: Fallback result validation failed');
          }
        }
      } catch (settingError) {
        console.warn(`WARN: Fallback compression failed with settings:`, settings, settingError.message);
        continue;
      }
    }

    return null;
  } catch (error) {
    console.error('ERROR: All fallback compression methods failed:', error);
    return null;
  }
};

/**
 * Smart copy function with validation
 */
const createSmartCopy = async (
  sourceUri: string,
  targetDirectory: string,
  options: CompressionOptions = {}
): Promise<string> => {
  try {
    // Validate source before copying
    const sourceValid = await validateSourceFile(sourceUri);
    if (!sourceValid) {
      throw new Error(`Source file not valid for copying: ${sourceUri}`);
    }

    const fileName = `camera_recording_${Date.now()}.mp4`;
    const targetPath = `${targetDirectory}${fileName}`;
    
    console.log(`LOG: Creating smart copy of camera recording`);
    console.log(`LOG: From: ${sourceUri} to: ${targetPath}`);
    
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetPath,
    });
    
    const copyValid = await validateSourceFile(targetPath);
    if (copyValid) {
      const copyInfo = await FileSystem.getInfoAsync(targetPath, { size: true });
      console.log(`LOG: Smart copy successful: ${targetPath} (${copyInfo.size} bytes)`);
      if (options.progressCallback) options.progressCallback(1.0);
      return targetPath;
    } else {
      throw new Error('Copy validation failed');
    }
  } catch (error) {
    console.error('ERROR: Smart copy failed:', error);
    throw error;
  }
};

class CameraCompressionService {

  public async getVideoInfo(uri: string): Promise<VideoInfo> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists || fileInfo.size === 0) {
        return { uri, exists: false };
      }
      return {
        uri,
        exists: true,
        size: fileInfo.size,
        sizeMB: Math.round((fileInfo.size / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      console.error('ERROR: Failed to get video info:', error);
      return { uri, exists: false };
    }
  }

  /**
   * Main method for camera integration - processes freshly recorded videos
   */
  public async processCameraRecording(
    sourceUri: string, 
    targetDirectory: string,
    options: CompressionOptions = {}
  ): Promise<CameraCompressionResult> {
    const {
      minFileSizeForCompression = 5, // Default 5MB for camera recordings
      maxSizeMB = 15,
      progressCallback,
    } = options;

    try {
      // 1. Validate and get source info with retries
      let sourceInfo = await this.getVideoInfo(sourceUri);
      
      // If file doesn't exist initially, wait a bit and retry (camera might still be writing)
      if (!sourceInfo.exists) {
        console.log('LOG: Source file not found, waiting for camera to finish writing...');
        await sleep(1000);
        sourceInfo = await this.getVideoInfo(sourceUri);
        
        if (!sourceInfo.exists) {
          await sleep(2000); // Wait longer
          sourceInfo = await this.getVideoInfo(sourceUri);
        }
      }
      
      if (!sourceInfo.exists) {
        return {
          success: false,
          uri: sourceUri,
          error: 'Source video not found after waiting'
        };
      }

      console.log(`LOG: Processing camera recording: ${sourceInfo.sizeMB}MB`);

      // 2. Ensure target directory exists
      const finalTargetDirectory = await ensureVideoFilesDirectory(targetDirectory);

      // 3. Check if compression is needed
      if (sourceInfo.sizeMB <= minFileSizeForCompression) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) below compression threshold, creating copy`);
        try {
          const copyResult = await createSmartCopy(sourceUri, finalTargetDirectory, { progressCallback });
          return {
            success: true,
            uri: copyResult,
            originalSizeMB: sourceInfo.sizeMB,
            compressedSizeMB: sourceInfo.sizeMB,
            compressionRatio: '0%'
          };
        } catch (copyError) {
          return {
            success: false,
            uri: sourceUri,
            error: `Failed to copy: ${copyError.message}`
          };
        }
      }

      // 4. Attempt compression with multiple strategies
      console.log(`LOG: Starting compression for ${sourceInfo.sizeMB}MB video`);
      
      const strategies = [
        () => compressDirectlyToDirectory(sourceUri, finalTargetDirectory, options),
        () => tryFallbackCompression(sourceUri, finalTargetDirectory, options),
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`LOG: Trying compression strategy ${i + 1}/${strategies.length}`);
          if (progressCallback) progressCallback(0.1 + (i * 0.1)); // Show progress for strategy attempts
          
          // Validate source is still available before each strategy
          const stillExists = await validateSourceFile(sourceUri);
          if (!stillExists) {
            console.error('ERROR: Source file disappeared during compression');
            break; // No point trying other strategies
          }
          
          const result = await strategies[i]();
          
          if (result) {
            // Verify the result
            const finalInfo = await this.getVideoInfo(result);
            if (finalInfo.exists && finalInfo.size > 0) {
              const compressionRatio = ((sourceInfo.sizeMB - finalInfo.sizeMB) / sourceInfo.sizeMB * 100).toFixed(1);
              
              console.log(`LOG: ✅ CAMERA COMPRESSION SUCCESSFUL!`);
              console.log(`LOG: Original: ${sourceInfo.sizeMB}MB → Compressed: ${finalInfo.sizeMB}MB`);
              console.log(`LOG: Reduction: ${compressionRatio}%`);
              console.log(`LOG: Final file: ${result}`);
              
              return {
                success: true,
                uri: result,
                originalSizeMB: sourceInfo.sizeMB,
                compressedSizeMB: finalInfo.sizeMB,
                compressionRatio: `${compressionRatio}%`
              };
            }
          }
        } catch (strategyError) {
          console.warn(`WARN: Strategy ${i + 1} failed:`, strategyError.message);
          continue;
        }
      }

      // 5. All compression strategies failed - create a copy as fallback
      console.warn('WARN: All compression strategies failed, creating fallback copy');
      
      // Final check if source still exists for fallback copy
      const finalSourceCheck = await validateSourceFile(sourceUri);
      if (!finalSourceCheck) {
        return {
          success: false,
          uri: sourceUri,
          originalSizeMB: sourceInfo.sizeMB,
          error: 'Source file disappeared and all compression strategies failed'
        };
      }
      
      try {
        const fallbackResult = await createSmartCopy(sourceUri, finalTargetDirectory, { progressCallback });
        return {
          success: true,
          uri: fallbackResult,
          originalSizeMB: sourceInfo.sizeMB,
          compressedSizeMB: sourceInfo.sizeMB,
          compressionRatio: '0%',
          error: 'Compression failed, used original file'
        };
      } catch (fallbackError) {
        return {
          success: false,
          uri: sourceUri,
          originalSizeMB: sourceInfo.sizeMB,
          error: `All strategies failed: ${fallbackError.message}`
        };
      }

    } catch (error: any) {
      console.error('ERROR: Camera compression pipeline failed:', error);
      return {
        success: false,
        uri: sourceUri,
        error: error.message
      };
    }
  }

  /**
   * Enhanced method for backward compatibility that checks file existence first
   */
  public async createCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    // First validate that the source file exists
    const sourceValid = await validateSourceFile(sourceUri);
    if (!sourceValid) {
      throw new Error(`Source file does not exist or is empty: ${sourceUri}`);
    }

    const targetDirectory = options.targetDirectory || `${FileSystem.documentDirectory}videofiles/`;
    const result = await this.processCameraRecording(sourceUri, targetDirectory, options);
    
    if (!result.success) {
      throw new Error(result.error || 'Compression failed');
    }
    
    return result.uri;
  }

  /**
   * Quick check if a video should be compressed
   */
  public async shouldCompress(uri: string, minSizeMB: number = 5): Promise<boolean> {
    const info = await this.getVideoInfo(uri);
    return info.exists && info.sizeMB > minSizeMB;
  }

  /**
   * Cleanup old compressed files
   */
  public async cleanup(targetDirectory?: string): Promise<void> {
    try {
      const videoFilesDirectory = await ensureVideoFilesDirectory(targetDirectory);
      const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let cleanedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('compressed_') || 
            file.startsWith('fallback_compressed_') || 
            file.startsWith('captured_') ||
            file.startsWith('camera_recording_') ||
            file.startsWith('secure_')) {
          const filePath = `${videoFilesDirectory}${file}`;
          try {
            const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
            if (fileInfo.exists && fileInfo.modificationTime && 
                (fileInfo.modificationTime * 1000) < oneDayAgo) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              cleanedCount++;
              console.log(`LOG: Cleaned up old file: ${file}`);
            }
          } catch (cleanupError) {
            console.warn(`WARN: Failed to cleanup file ${file}:`, cleanupError);
          }
        }
      }
      
      console.log(`LOG: Cleanup complete. Removed ${cleanedCount} old files.`);
    } catch (error) {
      console.warn('WARN: Cleanup operation failed:', error);
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(targetDirectory?: string): Promise<{
    totalFiles: number;
    totalSizeMB: number;
    availableSpaceMB: number;
  }> {
    try {
      const videoFilesDirectory = await ensureVideoFilesDirectory(targetDirectory);
      const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
      
      let totalSize = 0;
      let fileCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.mp4')) {
          const filePath = `${videoFilesDirectory}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
            fileCount++;
          }
        }
      }
      
      const availableSpace = await FileSystem.getFreeDiskStorageAsync();
      
      return {
        totalFiles: fileCount,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        availableSpaceMB: Math.round((availableSpace / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      console.error('ERROR: Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSizeMB: 0,
        availableSpaceMB: 0,
      };
    }
  }

  /**
   * Validate a video file exists and is accessible
   */
  public async validateVideoFile(uri: string): Promise<boolean> {
    return await validateSourceFile(uri);
  }
}

export default new CameraCompressionService();