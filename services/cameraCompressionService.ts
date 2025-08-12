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
}

// --- Helper Functions ---
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const initializeVideoFilesDirectory = async (): Promise<string> => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory:', error);
    throw error;
  }
};

/**
 * PRODUCTION FIX: Transfer compressed file from native cache to Expo accessible directory
 * Uses base64 encoding as a bridge between native and Expo file systems
 */
const transferCompressedFile = async (
  compressedCacheUri: string, 
  targetUri: string,
  progressCallback?: (progress: number) => void
): Promise<boolean> => {
  try {
    console.log(`LOG: Starting file transfer from cache to accessible directory`);
    console.log(`LOG: Source (cache): ${compressedCacheUri}`);
    console.log(`LOG: Target (accessible): ${targetUri}`);

    if (progressCallback) progressCallback(0.1);

    // Method 1: Direct copy attempt (sometimes works)
    try {
      await FileSystem.copyAsync({
        from: compressedCacheUri,
        to: targetUri,
      });
      
      const verifyInfo = await FileSystem.getInfoAsync(targetUri, { size: true });
      if (verifyInfo.exists && verifyInfo.size > 0) {
        console.log(`LOG: Direct copy successful: ${verifyInfo.size} bytes`);
        if (progressCallback) progressCallback(1.0);
        return true;
      }
    } catch (directCopyError) {
      console.log(`LOG: Direct copy failed, trying alternative methods`);
    }

    if (progressCallback) progressCallback(0.3);

    // Method 2: Base64 bridge (most reliable for cache -> document transfer)
    try {
      console.log(`LOG: Attempting base64 transfer method`);
      
      // Read the compressed file as base64 (this can access native cache)
      const base64Content = await FileSystem.readAsStringAsync(compressedCacheUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Content || base64Content.length === 0) {
        throw new Error('Failed to read compressed file as base64');
      }

      console.log(`LOG: Successfully read compressed file as base64: ${base64Content.length} chars`);
      if (progressCallback) progressCallback(0.7);

      // Write the base64 content to accessible directory
      await FileSystem.writeAsStringAsync(targetUri, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Verify the written file
      const finalCheck = await FileSystem.getInfoAsync(targetUri, { size: true });
      if (finalCheck.exists && finalCheck.size > 0) {
        console.log(`LOG: Base64 transfer successful: ${finalCheck.size} bytes`);
        if (progressCallback) progressCallback(1.0);
        return true;
      }

    } catch (base64Error) {
      console.error('ERROR: Base64 transfer failed:', base64Error);
    }

    // Method 3: Try with URI variations
    const uriVariations = [
      compressedCacheUri.replace('file://', ''),
      `file://${compressedCacheUri.replace('file://', '')}`,
      compressedCacheUri.replace(/^file:\/\//, ''),
    ];

    for (const uri of uriVariations) {
      try {
        console.log(`LOG: Trying URI variation: ${uri}`);
        
        const base64Content = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (base64Content && base64Content.length > 0) {
          await FileSystem.writeAsStringAsync(targetUri, base64Content, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const verifyInfo = await FileSystem.getInfoAsync(targetUri, { size: true });
          if (verifyInfo.exists && verifyInfo.size > 0) {
            console.log(`LOG: URI variation transfer successful: ${verifyInfo.size} bytes`);
            if (progressCallback) progressCallback(1.0);
            return true;
          }
        }
      } catch (variationError) {
        console.warn(`WARN: URI variation ${uri} failed:`, variationError.message);
        continue;
      }
    }

    console.error('ERROR: All transfer methods failed');
    return false;

  } catch (error) {
    console.error('ERROR: Transfer process failed:', error);
    return false;
  }
};

class ProductionCameraCompressionService {

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
   * PRODUCTION VERSION: Real video compression with proper file transfer
   */
  public async createCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    const {
      minFileSizeForCompression = 1,
      maxSizeMB = 15,
      progressCallback,
    } = options;

    try {
      // 1. Validate source
      const sourceInfo = await this.getVideoInfo(sourceUri);
      if (!sourceInfo.exists) {
        console.error('ERROR: Source video not found:', sourceUri);
        return sourceUri;
      }

      if (sourceInfo.sizeMB < minFileSizeForCompression) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) below compression threshold`);
        return sourceUri;
      }

      console.log(`LOG: Starting PRODUCTION compression: ${sourceUri} (${sourceInfo.sizeMB}MB)`);

      // 2. Compress using react-native-compressor (80% of progress)
      let compressedCacheUri: string;
      try {
        compressedCacheUri = await Video.compress(
          sourceUri,
          { 
            compressionMethod: 'auto',
            // Specify output directory as the app's cache (where compressor can write)
            outputExtension: '.mp4',
            // Additional options for better compression
            includeAudio: true,
            minimumFileSizeForCompress: minFileSizeForCompression,
          },
          (progress) => {
            if (progressCallback) {
              // Reserve 20% progress for file transfer
              progressCallback(progress * 0.8);
            }
          }
        );

        if (!compressedCacheUri) {
          throw new Error('Video compression returned null result');
        }

        console.log(`LOG: Compression completed. Cache file: ${compressedCacheUri}`);

      } catch (compressionError) {
        console.error('ERROR: Video compression failed:', compressionError);
        throw compressionError;
      }

      // 3. Set up target location in accessible directory
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `compressed_${Date.now()}.mp4`;
      const accessibleUri = `${videoFilesDirectory}${fileName}`;

      // 4. Transfer from cache to accessible directory (20% of progress)
      console.log(`LOG: Starting file transfer from cache to accessible location`);
      
      const transferSuccess = await transferCompressedFile(
        compressedCacheUri, 
        accessibleUri,
        (transferProgress) => {
          if (progressCallback) {
            // Map transfer progress to the final 20%
            const totalProgress = 0.8 + (transferProgress * 0.2);
            progressCallback(totalProgress);
          }
        }
      );

      if (!transferSuccess) {
        console.error('ERROR: Failed to transfer compressed file to accessible directory');
        throw new Error('File transfer from cache failed');
      }

      // 5. Verify final result
      const finalInfo = await this.getVideoInfo(accessibleUri);
      if (!finalInfo.exists) {
        console.error('ERROR: Final compressed file verification failed');
        throw new Error('Compressed file verification failed');
      }

      const compressionRatio = ((sourceInfo.sizeMB - finalInfo.sizeMB) / sourceInfo.sizeMB * 100).toFixed(1);
      console.log(`LOG: PRODUCTION compression successful!`);
      console.log(`LOG: ${sourceInfo.sizeMB}MB -> ${finalInfo.sizeMB}MB (${compressionRatio}% reduction)`);

      // 6. Cleanup: The cache file will be cleaned up by the system
      // We don't need to manually delete it as it's outside our accessible directory

      return accessibleUri;

    } catch (error: any) {
      console.error('ERROR: Production compression pipeline failed:', error.message);
      console.log('LOG: Falling back to original, uncompressed video');
      
      // In production, you might want to try alternative compression or show error
      return sourceUri;
    }
  }

  /**
   * Alternative compression with different settings if first attempt fails
   */
  public async createCompressedCopyWithFallback(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    try {
      // First attempt with standard settings
      const result = await this.createCompressedCopy(sourceUri, options);
      
      // If we got back the original URI, compression failed
      if (result === sourceUri) {
        console.log('LOG: Attempting compression with fallback settings');
        
        // Try with more aggressive compression settings
        const fallbackResult = await Video.compress(
          sourceUri,
          { 
            compressionMethod: 'manual',
            // More aggressive settings for fallback
            quality: 'low',
            outputExtension: '.mp4',
          },
          options.progressCallback
        );
        
        if (fallbackResult && fallbackResult !== sourceUri) {
          const videoFilesDirectory = await initializeVideoFilesDirectory();
          const fileName = `fallback_compressed_${Date.now()}.mp4`;
          const targetUri = `${videoFilesDirectory}${fileName}`;
          
          const transferSuccess = await transferCompressedFile(fallbackResult, targetUri);
          if (transferSuccess) {
            console.log('LOG: Fallback compression successful');
            return targetUri;
          }
        }
      } else {
        return result;
      }
      
    } catch (error) {
      console.error('ERROR: All compression attempts failed:', error);
    }
    
    return sourceUri;
  }

  public async cleanup(): Promise<void> {
    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith('compressed_') || file.startsWith('fallback_compressed_')) {
          const filePath = `${videoFilesDirectory}${file}`;
          try {
            const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
            if (fileInfo.exists && fileInfo.modificationTime && fileInfo.modificationTime < oneDayAgo) {
              await FileSystem.deleteAsync(filePath, { idempotent: true });
              console.log(`LOG: Cleaned up old compressed file: ${file}`);
            }
          } catch (cleanupError) {
            console.warn(`WARN: Failed to cleanup file ${file}:`, cleanupError);
          }
        }
      }
    } catch (error) {
      console.warn('WARN: Cleanup operation failed:', error);
    }
  }
}

export default new ProductionCameraCompressionService();