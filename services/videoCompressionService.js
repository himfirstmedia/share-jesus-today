import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { Video } from 'react-native-compressor';

const MAX_SIZE_MB_DEFAULT = 15;

// Helper function to ensure the permanent videofiles directory exists
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    console.log('VideoCompressionService: Video files directory ensured:', videoFilesDirectory);
    return videoFilesDirectory;
  } catch (error) {
    console.error('VideoCompressionService: Failed to initialize videofiles directory:', error);
    throw error;
  }
};

// Helper function to safely check if file exists and get its info with retry logic
const safeFileCheck = async (uri, maxRetries = 3, delayMs = 500) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      console.log(`VideoCompressionService: File check attempt ${attempt} for ${normalizedUri}:`, fileInfo);
      
      // If file exists, return immediately
      if (fileInfo.exists) {
        return fileInfo;
      }
      
      // If this is not the last attempt, wait before retrying
      if (attempt < maxRetries) {
        console.log(`VideoCompressionService: File not found on attempt ${attempt}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`VideoCompressionService: Error checking file ${uri} on attempt ${attempt}:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.warn(`VideoCompressionService: File ${uri} not found after ${maxRetries} attempts`);
  return { exists: false, size: 0 };
};

// Alternative file check that tries multiple URI formats
const comprehensiveFileCheck = async (uri) => {
  const urisToTry = [
    uri,
    uri.startsWith('file://') ? uri : `file://${uri}`,
    uri.startsWith('file://') ? uri.substring(7) : uri,
  ];
  
  for (const testUri of urisToTry) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(testUri);
      if (fileInfo.exists) {
        console.log(`VideoCompressionService: Found file at: ${testUri}`, fileInfo);
        return { ...fileInfo, actualUri: testUri };
      }
    } catch (error) {
      console.log(`VideoCompressionService: Could not check ${testUri}:`, error.message);
    }
  }
  
  console.warn(`VideoCompressionService: File not found in any format for: ${uri}`);
  return { exists: false, size: 0, actualUri: uri };
};

// Helper function to move the compressed file to the permanent 'videofiles' directory
const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    console.log(`VideoCompressionService: Starting to move file from cache: ${cacheUri}`);
    
    // Use comprehensive file check with retry logic
    const sourceFileInfo = await comprehensiveFileCheck(cacheUri);
    if (!sourceFileInfo.exists) {
      throw new Error(`Source file does not exist after comprehensive check: ${cacheUri}`);
    }
    
    const actualSourceUri = sourceFileInfo.actualUri;
    console.log(`VideoCompressionService: Using actual source URI: ${actualSourceUri}`);

    const permanentDir = await initializeVideoFilesDirectory();
    const fileName = `compressed_${Date.now()}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;

    console.log(`VideoCompressionService: Copying from ${actualSourceUri} to ${permanentUri}`);
    
    // Ensure both URIs are properly formatted
    const sourceUri = actualSourceUri.startsWith('file://') ? actualSourceUri : `file://${actualSourceUri}`;
    const destUri = permanentUri.startsWith('file://') ? permanentUri : `file://${permanentUri}`;
    
    // Attempt the copy operation
    await FileSystem.copyAsync({ 
      from: sourceUri, 
      to: destUri 
    });

    // Verify the copy was successful with retry logic
    const copiedFileInfo = await safeFileCheck(destUri, 5, 1000);
    if (!copiedFileInfo.exists || copiedFileInfo.size === 0) {
      throw new Error(`Failed to copy compressed file to permanent storage. Destination file ${destUri} ${!copiedFileInfo.exists ? 'does not exist' : 'is empty'}.`);
    }

    console.log(`VideoCompressionService: File successfully moved to permanent storage. Size: ${copiedFileInfo.size} bytes`);
    
    // Clean up the original cache file if it still exists and is different from destination
    try {
      if (sourceUri !== destUri) {
        const originalExists = await safeFileCheck(sourceUri, 1, 0);
        if (originalExists.exists) {
          await FileSystem.deleteAsync(sourceUri, { idempotent: true });
          console.log(`VideoCompressionService: Cleaned up original cache file: ${sourceUri}`);
        }
      }
    } catch (cleanupError) {
      console.warn('VideoCompressionService: Failed to cleanup original cache file (non-critical):', cleanupError);
    }

    return destUri;
  } catch (error) {
    console.error('VideoCompressionService: Error moving compressed file to permanent storage:', error);
    throw error;
  }
};

// Alternative approach: Compress directly to permanent directory
const compressToCustomDirectory = async (videoUri, options = {}) => {
  const {
    progressCallback = () => {},
  } = options;

  try {
    console.log('VideoCompressionService: Starting compression with custom output directory for:', videoUri);
    
    // Initialize permanent directory first
    const permanentDir = await initializeVideoFilesDirectory();
    const outputFileName = `compressed_${Date.now()}.mp4`;
    const outputPath = `${permanentDir}${outputFileName}`;
    
    // Remove file:// prefix for the output path as some compressors expect local path
    const localOutputPath = outputPath.replace('file://', '');
    
    console.log('VideoCompressionService: Target output path:', outputPath);
    console.log('VideoCompressionService: Local output path for compressor:', localOutputPath);

    // Try to compress directly to our target directory
    const result = await Video.compress(
      videoUri,
      {
        compressionMethod: 'auto',
        // Some versions of react-native-compressor support output path
        outputPath: localOutputPath,
        getCancellationId: (cancellationId) => {
          console.log('VideoCompressionService: Compression started with ID:', cancellationId);
        }
      },
      (progress) => {
        console.log(`VideoCompressionService: Compression progress: ${Math.round(progress * 100)}%`);
        if (progressCallback) {
          progressCallback(progress);
        }
      }
    );

    console.log('VideoCompressionService: Compression result:', result);

    // Check if the file was created in our target directory
    const targetFileInfo = await comprehensiveFileCheck(outputPath);
    if (targetFileInfo.exists) {
      console.log('VideoCompressionService: File successfully compressed to target directory');
      return targetFileInfo.actualUri;
    }

    // If not in target directory, fall back to moving from cache
    if (result) {
      console.log('VideoCompressionService: File not in target directory, attempting to move from cache:', result);
      return await moveCompressedFileToPermanentStorage(result);
    }

    throw new Error('Compression did not produce a valid result');

  } catch (error) {
    console.error('VideoCompressionService: Custom directory compression failed:', error);
    throw error;
  }
};

const VideoCompressionService = {
  async createCompressedCopy(videoUri, options = {}) {
    const {
      maxSizeMB = MAX_SIZE_MB_DEFAULT,
      progressCallback = () => {},
    } = options;

    let compressedCacheUri = null;
    let compressionSuccessful = false;

    try {
      console.log('VideoCompressionService: Starting video compression for:', videoUri);
      
      // Verify source video exists before starting compression
      const sourceFileInfo = await safeFileCheck(videoUri, 1, 0);
      if (!sourceFileInfo.exists) {
        throw new Error(`Source video file does not exist: ${videoUri}`);
      }
      
      console.log(`VideoCompressionService: Source video verified. Size: ${sourceFileInfo.size} bytes`);

      // Try the custom directory approach first
      try {
        const result = await compressToCustomDirectory(videoUri, { progressCallback });
        if (result) {
          console.log('VideoCompressionService: Successfully compressed using custom directory approach');
          return result;
        }
      } catch (customDirError) {
        console.log('VideoCompressionService: Custom directory approach failed, falling back to traditional method:', customDirError.message);
      }

      // Fallback to traditional compression method
      console.log('VideoCompressionService: Using traditional compression method');
      
      // Perform compression - this will create a file in cache directory
      const result = await Video.compress(
        videoUri,
        {
          compressionMethod: 'auto',
          getCancellationId: (cancellationId) => {
            console.log('VideoCompressionService: Compression started with ID:', cancellationId);
          }
        },
        (progress) => {
          console.log(`VideoCompressionService: Compression progress: ${Math.round(progress * 100)}%`);
          if (progressCallback) {
            progressCallback(progress);
          }
        }
      );

      if (!result) {
        throw new Error('Video compression failed to return a valid path.');
      }

      compressedCacheUri = result;
      compressionSuccessful = true;
      console.log('VideoCompressionService: Compression completed, temp file:', compressedCacheUri);

      // Add a small delay before checking the file to allow filesystem to sync
      console.log('VideoCompressionService: Waiting for filesystem sync...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify the compressed file exists with retry logic
      const compressedFileInfo = await safeFileCheck(compressedCacheUri, 5, 1000);
      if (!compressedFileInfo.exists) {
        // Try alternative approaches to find the file
        const comprehensiveCheck = await comprehensiveFileCheck(compressedCacheUri);
        if (!comprehensiveCheck.exists) {
          throw new Error(`Compressed file was not created or was immediately deleted: ${compressedCacheUri}`);
        }
        // Update the cache URI to the one that actually exists
        compressedCacheUri = comprehensiveCheck.actualUri;
      }
      
      console.log(`VideoCompressionService: Compressed file verified. Size: ${compressedFileInfo.size || comprehensiveCheck.size} bytes`);

      // Move the file to the existing 'videofiles' directory immediately
      const permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      
      console.log('VideoCompressionService: File successfully moved to permanent location:', permanentUri);
      
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Video compression failed:', error);

      // Clean up the cached file if it exists and compression was successful
      if (compressedCacheUri && compressionSuccessful) {
        try {
          const cacheFileExists = await safeFileCheck(compressedCacheUri, 1, 0);
          if (cacheFileExists.exists) {
            await FileSystem.deleteAsync(compressedCacheUri, { idempotent: true });
            console.log('VideoCompressionService: Cleaned up cache file after error:', compressedCacheUri);
          }
        } catch (cleanupError) {
          console.warn('VideoCompressionService: Failed to cleanup cache file after error:', cleanupError);
        }
      }
      
      // Handle specific error types
      if (error.message && error.message.includes('cancel')) {
        Alert.alert('Cancelled', 'Video compression was cancelled.');
        return null; 
      }
      
      // Show user-friendly error message
      let userMessage = 'Failed to compress video. Please try again.';
      if (error.message) {
        if (error.message.includes('does not exist')) {
          userMessage = 'Video file not found. Please select the video again.';
        } else if (error.message.includes('storage') || error.message.includes('space')) {
          userMessage = 'Not enough storage space. Please free up some space and try again.';
        } else if (error.message.includes('permission')) {
          userMessage = 'Permission denied. Please check app permissions.';
        }
      }
      
      Alert.alert('Compression Error', userMessage);
      throw error;
    }
  },

  cancelCompression() {
    // react-native-compressor does not have a direct cancel method
    console.log('VideoCompressionService: Compression cancellation requested. Process will complete but result will be ignored.');
  },

  // Utility method to get compression info
  async getCompressionInfo(videoUri) {
    try {
      const fileInfo = await safeFileCheck(videoUri, 1, 0);
      return {
        exists: fileInfo.exists,
        size: fileInfo.size,
        sizeInMB: fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 0,
      };
    } catch (error) {
      console.error('VideoCompressionService: Error getting compression info:', error);
      return { exists: false, size: 0, sizeInMB: 0 };
    }
  },
};

export default VideoCompressionService;