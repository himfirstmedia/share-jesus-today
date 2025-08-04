import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { Video } from 'react-native-compressor';

const MAX_SIZE_MB_DEFAULT = 15;

// Helper function to move the compressed file to the persistent 'videofiles' directory
const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    const permanentDir = `${FileSystem.documentDirectory}videofiles/`;
    // Ensure the directory exists
    await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });

    const fileName = `compressed_${Date.now()}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;

    console.log(`Moving compressed file from ${cacheUri} to ${permanentUri}`);
    await FileSystem.copyAsync({ from: cacheUri, to: permanentUri });

    // Verify the copy
    const fileInfo = await FileSystem.getInfoAsync(permanentUri, { size: true });
    if (!fileInfo.exists || fileInfo.size === 0) {
      throw new Error('Failed to copy compressed file to permanent storage or file is empty.');
    }

    console.log('File moved successfully to permanent storage, new URI:', permanentUri);
    return permanentUri;
  } catch (error) {
    console.error('Error moving compressed file to permanent storage:', error);
    throw error; // Re-throw to be caught by the main function
  }
};

const VideoCompressionService = {
  async createCompressedCopy(videoUri, options = {}) {
    const {
      maxSizeMB = MAX_SIZE_MB_DEFAULT,
      progressCallback = () => {},
    } = options;

    let compressedCacheUri = null;

    try {
      console.log('Starting video compression for:', videoUri);

      // Perform compression - this will create a file in cache directory
      const result = await Video.compress(
        videoUri,
        {
          compressionMethod: 'auto',
        },
        (progress) => {
          if (progressCallback) {
            progressCallback(progress);
          }
        }
      );

      if (!result) {
        throw new Error('Video compression failed to return a valid path.');
      }

      compressedCacheUri = result;
      console.log('LOG: Compression completed, temp file in cache:', compressedCacheUri);

      // Move the file to the existing 'videofiles' directory
      const permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      
      // Clean up the original cached file
      await FileSystem.deleteAsync(compressedCacheUri, { idempotent: true });
      
      return permanentUri;

    } catch (error) {
      console.error('ERROR: Video compression failed:', error);

      // Clean up the cached file if it exists and an error occurred
      if (compressedCacheUri) {
        await FileSystem.deleteAsync(compressedCacheUri, { idempotent: true });
      }
      
      if (error.message && error.message.includes('cancel')) {
        Alert.alert('Cancelled', 'Video compression was cancelled.');
        return null; 
      }
      
      Alert.alert('Error', 'Failed to compress video. Please try again.');
      throw error;
    }
  },

  cancelCompression() {
    // react-native-compressor does not have a direct cancel method like the other library.
    // This can be handled by unmounting the component or using a state to ignore the result.
    console.log('Video compression cancellation requested. If running, the process will complete but the result will be ignored.');
  },
};

export default VideoCompressionService;