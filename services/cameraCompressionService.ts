import * as FileSystem from 'expo-file-system';
import { Video } from 'react-native-compressor';

// --- Type Definitions (FIXED) ---
// Using a discriminated union for VideoInfo to make it type-safe.
// If 'exists' is true, 'size' and 'sizeMB' are guaranteed to be numbers.
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

/**
 * A simple delay utility.
 * @param ms - Milliseconds to wait.
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initializes a dedicated directory within the app's document folder to store video files.
 * This is a persistent location, not a temporary cache.
 */
const initializeVideoFilesDirectory = async (): Promise<string> => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory in compression service:', error);
    throw error;
  }
};

/**
 * A highly robust file verification utility designed to handle file system race conditions.
 * It waits for a file to exist and for its size to stabilize, indicating that the
 * write operation has completed.
 *
 * @param uri The URI of the file to verify.
 * @param initialDelayMs The initial time to wait before the first check.
 * @param maxRetries The maximum number of times to check for the file.
 * @returns A promise that resolves with the file's info if stable, or null if verification fails.
 */
const verifyFileIsStable = async (
  uri: string,
  initialDelayMs = 500,
  maxRetries = 15
): Promise<FileSystem.FileInfo | null> => {
  console.log(`LOG: Starting stability verification for: ${uri}`);
  await sleep(initialDelayMs); // Initial wait for the file system to catch up.

  let previousSize = -1;
  let stableChecks = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

      // Type guard: proceed only if the file exists.
      if (fileInfo.exists) {
        // File exists and has size, now check for stability.
        if (fileInfo.size === previousSize) {
          stableChecks++;
          console.log(`LOG: File size is stable. Check ${stableChecks}/2.`);
          // Require 2 consecutive checks with the same size to be sure.
          if (stableChecks >= 2) {
            console.log(`LOG: File verification successful and stable on attempt ${attempt}: ${uri} (${fileInfo.size} bytes)`);
            return fileInfo;
          }
        } else {
          // Size has changed, reset stability counter.
          console.log(`LOG: File size changed: ${previousSize} -> ${fileInfo.size}. Resetting stability check.`);
          stableChecks = 0;
          previousSize = fileInfo.size;
        }
      } else {
        console.warn(`WARN: File check failed on attempt ${attempt}: file does not exist.`);
      }
    } catch (error: any) {
      console.warn(`WARN: File verification attempt ${attempt} threw an error:`, error.message);
    }

    // Wait before the next attempt.
    await sleep(500 * attempt); // Increasing delay (500ms, 1000ms, 1500ms...)
  }

  console.error(`ERROR: File verification failed after ${maxRetries} attempts for URI: ${uri}`);
  return null;
};


class CameraCompressionService {

  /**
   * Retrieves basic information about a video file.
   * @param uri The URI of the video file.
   * @returns A promise that resolves with the video's information.
   */
  public async getVideoInfo(uri: string): Promise<VideoInfo> {
    const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
    // Type guard: if the file doesn't exist or is empty, return the NonExistingVideoInfo type.
    if (!fileInfo.exists || fileInfo.size === 0) {
      return { uri, exists: false };
    }
    // If we get here, TypeScript knows fileInfo.exists is true and fileInfo.size is a number.
    return {
      uri,
      exists: true,
      size: fileInfo.size,
      sizeMB: Math.round((fileInfo.size / (1024 * 1024)) * 100) / 100,
    };
  }

  /**
   * Compresses a video, handling the entire lifecycle from cache to persistent storage
   * with robust verification at each step.
   *
   * @param sourceUri The original URI of the video to compress.
   * @param options Configuration for the compression process.
   * @returns The URI of the final compressed file in persistent storage, or the original URI if compression was skipped or failed.
   */
  public async createCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    const {
      minFileSizeForCompression = 1, // Don't compress files smaller than 1MB
      progressCallback,
    } = options;

    let compressedTempUri: string | null = null;

    try {
      // 1. Validate the source file before starting.
      const sourceInfo = await this.getVideoInfo(sourceUri);
      
      // **FIXED**: This check now acts as a type guard.
      // If sourceInfo.exists is false, we return.
      // If it's true, TypeScript knows `sourceInfo` is of type `ExistingVideoInfo`.
      if (!sourceInfo.exists) {
        console.error('ERROR: Source video for compression not found or is empty:', sourceUri);
        return sourceUri; // Fallback to original
      }

      // After the guard, `sourceInfo.sizeMB` is guaranteed to be a number.
      if (sourceInfo.sizeMB < minFileSizeForCompression) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) is below threshold. Skipping compression.`);
        return sourceUri;
      }

      console.log(`LOG: Starting compression for: ${sourceUri} (${sourceInfo.sizeMB}MB)`);

      // 2. Perform compression. The result is a new file in a temporary cache directory.
      const result = await Video.compress(
        sourceUri,
        { compressionMethod: 'auto' },
        (progress) => {
          if (progressCallback) {
            progressCallback(progress);
          }
        }
      );

      if (!result) {
        throw new Error('Video.compress returned a null or undefined result.');
      }
      compressedTempUri = result;
      console.log(`LOG: Compression process finished. Temp file should be at: ${compressedTempUri}`);

      // 3. **CRITICAL STEP**: Verify the compressed file is stable in the cache.
      const compressedFileInfo = await verifyFileIsStable(compressedTempUri);
      if (!compressedFileInfo) {
        throw new Error('Verification of compressed file in cache failed. The file is not stable or does not exist.');
      }

      // 4. Move the verified file from cache to our persistent directory.
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `compressed_${Date.now()}.mp4`;
      const persistentUri = `${videoFilesDirectory}${fileName}`;

      console.log(`LOG: Moving verified file from cache to persistent storage: ${persistentUri}`);
      await FileSystem.moveAsync({
        from: compressedTempUri,
        to: persistentUri,
      });

      compressedTempUri = null; // Mark as moved

      // 5. Final verification that the file exists in its new persistent home.
      const finalCheck = await FileSystem.getInfoAsync(persistentUri);
      if (!finalCheck.exists) {
        throw new Error('Failed to move compressed file to persistent storage.');
      }

      console.log(`LOG: Successfully moved and verified compressed video in persistent storage.`);
      return persistentUri;

    } catch (error: any) {
      console.error('ERROR: Video compression pipeline failed:', error.message);

      if (compressedTempUri) {
        try {
          await FileSystem.deleteAsync(compressedTempUri, { idempotent: true });
          console.log(`LOG: Cleaned up orphaned temp file after error: ${compressedTempUri}`);
        } catch (cleanupError: any) {
          console.warn('WARN: Failed to cleanup temp file after error:', cleanupError.message);
        }
      }

      console.log('LOG: Falling back to use the original, uncompressed video.');
      return sourceUri;
    }
  }
}

export default new CameraCompressionService();
