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

// Helper function to safely check if file exists and get its info
const safeFileCheck = async (uri) => {
  try {
    const normalizedUri = uri.startsWith('file://') ? uri : `file://${uri}`;
    const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
    console.log(`VideoCompressionService: File check for ${normalizedUri}:`, fileInfo);
    return fileInfo;
  } catch (error) {
    console.error(`VideoCompressionService: Error checking file ${uri}:`, error);
    return { exists: false, size: 0 };
  }
};

// Helper function to move the compressed file to the permanent 'videofiles' directory
const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    console.log(`VideoCompressionService: Starting to move file from cache: ${cacheUri}`);
    
    // First, check if the source file actually exists
    const sourceFileInfo = await safeFileCheck(cacheUri);
    if (!sourceFileInfo.exists) {
      // Try without file:// prefix in case that's the issue
      const alternativeUri = cacheUri.replace('file://', '');
      const altFileInfo = await safeFileCheck(alternativeUri);
      if (!altFileInfo.exists) {
        throw new Error(`Source file does not exist: ${cacheUri}. Also checked: ${alternativeUri}`);
      }
      // Use the alternative URI that exists
      cacheUri = alternativeUri;
      console.log(`VideoCompressionService: Using alternative URI: ${cacheUri}`);
    }

    const permanentDir = await initializeVideoFilesDirectory();
    const fileName = `compressed_${Date.now()}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;

    console.log(`VideoCompressionService: Copying from ${cacheUri} to ${permanentUri}`);
    
    // Ensure both URIs are properly formatted
    const sourceUri = cacheUri.startsWith('file://') ? cacheUri : `file://${cacheUri}`;
    const destUri = permanentUri.startsWith('file://') ? permanentUri : `file://${permanentUri}`;
    
    // Attempt the copy operation
    await FileSystem.copyAsync({ 
      from: sourceUri, 
      to: destUri 
    });

    // Verify the copy was successful
    const copiedFileInfo = await safeFileCheck(destUri);
    if (!copiedFileInfo.exists || copiedFileInfo.size === 0) {
      throw new Error(`Failed to copy compressed file to permanent storage. Destination file ${destUri} ${!copiedFileInfo.exists ? 'does not exist' : 'is empty'}.`);
    }

    console.log(`VideoCompressionService: File successfully moved to permanent storage. Size: ${copiedFileInfo.size} bytes`);
    
    // Clean up the original cache file if it still exists and is different from destination
    try {
      if (sourceUri !== destUri) {
        const originalExists = await safeFileCheck(sourceUri);
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
      const sourceFileInfo = await safeFileCheck(videoUri);
      if (!sourceFileInfo.exists) {
        throw new Error(`Source video file does not exist: ${videoUri}`);
      }
      
      console.log(`VideoCompressionService: Source video verified. Size: ${sourceFileInfo.size} bytes`);

      // Perform compression - this will create a file in cache directory
      const result = await Video.compress(
        videoUri,
        {
          compressionMethod: 'auto',
          // Add some additional options that might help with consistency
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

      // Verify the compressed file exists immediately after compression
      const compressedFileInfo = await safeFileCheck(compressedCacheUri);
      if (!compressedFileInfo.exists) {
        throw new Error(`Compressed file was not created or was immediately deleted: ${compressedCacheUri}`);
      }
      
      console.log(`VideoCompressionService: Compressed file verified. Size: ${compressedFileInfo.size} bytes`);

      // Move the file to the existing 'videofiles' directory immediately
      const permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      
      console.log('VideoCompressionService: File successfully moved to permanent location:', permanentUri);
      
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Video compression failed:', error);

      // Clean up the cached file if it exists and compression was successful
      if (compressedCacheUri && compressionSuccessful) {
        try {
          const cacheFileExists = await safeFileCheck(compressedCacheUri);
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
      const fileInfo = await safeFileCheck(videoUri);
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