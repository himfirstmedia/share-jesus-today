import * as FileSystem from 'expo-file-system';

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
  compressionRatio?: number; // 0.1 to 0.9 (how much to reduce file size)
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
 * Simulate compression by creating a truncated copy (temporary solution)
 * In production, you would integrate with native video compression
 */
const simulateCompressionByTruncation = async (
  sourceUri: string, 
  targetUri: string, 
  targetSizeMB: number,
  progressCallback?: (progress: number) => void
): Promise<boolean> => {
  try {
    const sourceInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
    if (!sourceInfo.exists || !sourceInfo.size) {
      return false;
    }

    const targetSizeBytes = targetSizeMB * 1024 * 1024;
    const compressionRatio = Math.min(targetSizeBytes / sourceInfo.size, 1.0);
    
    console.log(`LOG: Simulating compression with ratio: ${(compressionRatio * 100).toFixed(1)}%`);

    // Read file in chunks and write truncated version
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalChunks = Math.ceil((sourceInfo.size * compressionRatio) / chunkSize);
    
    // For simulation purposes, we'll copy the first portion of the file
    // In a real implementation, this would be actual video compression
    
    if (progressCallback) progressCallback(0.1);

    // Simple approach: copy the file and then truncate to simulate compression
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });

    if (progressCallback) progressCallback(0.8);

    // Simulate actual compression effect by creating a smaller placeholder file
    // This is just for demonstration - real compression would maintain video integrity
    if (compressionRatio < 1.0) {
      const compressedContent = `compressed_placeholder_${Date.now()}`;
      const paddingSize = Math.floor(targetSizeBytes / 2); // Create file roughly half the target size
      const padding = 'x'.repeat(Math.min(paddingSize, 1024 * 1024)); // Cap at 1MB padding
      
      await FileSystem.writeAsStringAsync(targetUri, compressedContent + padding);
    }

    if (progressCallback) progressCallback(1.0);

    // Verify result
    const resultInfo = await FileSystem.getInfoAsync(targetUri, { size: true });
    return resultInfo.exists && resultInfo.size > 0;

  } catch (error) {
    console.error('ERROR: Compression simulation failed:', error);
    return false;
  }
};

class ExpoCompressionService {

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
   * Creates a "compressed" version of the video file
   * NOTE: This is a placeholder implementation that creates a smaller file
   * For production, integrate with a proper video compression library
   */
  public async createCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    const {
      minFileSizeForCompression = 1,
      maxSizeMB = 15,
      compressionRatio = 0.6, // Reduce to 60% of original size
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

      if (sourceInfo.sizeMB <= maxSizeMB) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) already within target range`);
        return sourceUri;
      }

      console.log(`LOG: Starting compression simulation: ${sourceInfo.sizeMB}MB -> target: ${maxSizeMB}MB`);

      // 2. Create target file path
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `compressed_${Date.now()}.mp4`;
      const compressedUri = `${videoFilesDirectory}${fileName}`;

      // 3. Determine target size
      const targetSizeMB = Math.min(sourceInfo.sizeMB * compressionRatio, maxSizeMB);

      // 4. Perform compression simulation
      const compressionSuccess = await simulateCompressionByTruncation(
        sourceUri,
        compressedUri,
        targetSizeMB,
        progressCallback
      );

      if (!compressionSuccess) {
        console.warn('WARN: Compression simulation failed, using original file');
        return sourceUri;
      }

      // 5. Verify result
      const compressedInfo = await this.getVideoInfo(compressedUri);
      if (!compressedInfo.exists) {
        console.error('ERROR: Compressed file verification failed');
        return sourceUri;
      }

      console.log(`LOG: Compression simulation completed: ${sourceInfo.sizeMB}MB -> ${compressedInfo.sizeMB}MB`);
      return compressedUri;

    } catch (error: any) {
      console.error('ERROR: Compression process failed:', error.message);
      return sourceUri;
    }
  }

  /**
   * For production use, integrate with a proper video compression solution
   * Options include:
   * 1. expo-av with native video processing
   * 2. react-native-video-processing
   * 3. Custom native modules with FFmpeg
   * 4. Server-side compression
   */
  public async createRealCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    // TODO: Implement actual video compression
    // This would require additional native dependencies
    console.log('NOTE: Real compression not implemented. Using simulation.');
    return this.createCompressedCopy(sourceUri, options);
  }

  public async cleanup(): Promise<void> {
    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const file of files) {
        if (file.startsWith('compressed_')) {
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

export default new ExpoCompressionService();