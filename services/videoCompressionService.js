import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { Video } from 'react-native-compressor';

const MAX_SIZE_MB_DEFAULT = 15;
const ANDROID_9_API_LEVEL = 28;

// Check if we're running on Android 9 or lower
const isAndroid9OrLower = () => {
  return Platform.OS === 'android' && Platform.Version <= ANDROID_9_API_LEVEL;
};

// Android 9 specific video metadata validation
const validateVideoMetadataAndroid9 = async (videoUri) => {
  try {
    console.log('VideoCompressionService: Validating video metadata for Android 9:', videoUri);
    
    // Try to get basic file info first
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
      throw new Error('Invalid video file: file does not exist or is empty');
    }
    
    console.log('VideoCompressionService: File info valid:', { size: fileInfo.size });
    
    // For Android 9, try to access media library info to validate the video
    if (Platform.OS === 'android') {
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          // Try to get asset info from MediaLibrary which has better Android 9 support
          const asset = await MediaLibrary.createAssetAsync(videoUri);
          if (asset && asset.duration !== undefined && asset.duration > 0) {
            console.log('VideoCompressionService: MediaLibrary validation successful:', { 
              duration: asset.duration,
              mediaType: asset.mediaType 
            });
            return { isValid: true, duration: asset.duration };
          }
        }
      } catch (mediaLibError) {
        console.log('VideoCompressionService: MediaLibrary validation failed (non-critical):', mediaLibError.message);
      }
    }
    
    return { isValid: true, duration: null };
  } catch (error) {
    console.error('VideoCompressionService: Video metadata validation failed:', error);
    return { isValid: false, error: error.message };
  }
};

// Android 9 compatible compression with fallback strategies
const compressVideoAndroid9Compatible = async (videoUri, options = {}) => {
  const { progressCallback = () => {} } = options;
  
  console.log('VideoCompressionService: Starting Android 9 compatible compression for:', videoUri);
  
  // Strategy 1: Use minimal compression settings for Android 9
  const android9CompressionConfig = {
    compressionMethod: 'manual', // More reliable than 'auto' on Android 9
    quality: 'medium',
    bitrate: 1000, // Lower bitrate for compatibility
    minimumFileSizeForCompress: 1, // Force compression even for small files
    getCancellationId: (cancellationId) => {
      console.log('VideoCompressionService: Android 9 compression started with ID:', cancellationId);
    }
  };
  
  try {
    console.log('VideoCompressionService: Attempting Strategy 1 - Manual compression');
    
    const result = await Video.compress(
      videoUri,
      android9CompressionConfig,
      (progress) => {
        // Validate progress value for Android 9
        const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
        console.log(`VideoCompressionService: Android 9 compression progress: ${Math.round(validProgress * 100)}%`);
        if (progressCallback) {
          progressCallback(validProgress);
        }
      }
    );
    
    if (result && typeof result === 'string') {
      console.log('VideoCompressionService: Strategy 1 successful:', result);
      return result;
    }
    
    throw new Error('Strategy 1 failed: Invalid result');
    
  } catch (strategy1Error) {
    console.log('VideoCompressionService: Strategy 1 failed:', strategy1Error.message);
    
    // Strategy 2: Try with even lower settings
    try {
      console.log('VideoCompressionService: Attempting Strategy 2 - Low quality compression');
      
      const lowQualityConfig = {
        compressionMethod: 'manual',
        quality: 'low',
        bitrate: 500,
        minimumFileSizeForCompress: 1,
        getCancellationId: (cancellationId) => {
          console.log('VideoCompressionService: Strategy 2 compression started with ID:', cancellationId);
        }
      };
      
      const result = await Video.compress(
        videoUri,
        lowQualityConfig,
        (progress) => {
          const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
          console.log(`VideoCompressionService: Strategy 2 progress: ${Math.round(validProgress * 100)}%`);
          if (progressCallback) {
            progressCallback(validProgress);
          }
        }
      );
      
      if (result && typeof result === 'string') {
        console.log('VideoCompressionService: Strategy 2 successful:', result);
        return result;
      }
      
      throw new Error('Strategy 2 failed: Invalid result');
      
    } catch (strategy2Error) {
      console.log('VideoCompressionService: Strategy 2 failed:', strategy2Error.message);
      
      // Strategy 3: Copy without compression for Android 9 as last resort
      console.log('VideoCompressionService: Attempting Strategy 3 - Copy without compression');
      
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      const fileSizeMB = fileInfo.size / (1024 * 1024);
      
      if (fileSizeMB <= MAX_SIZE_MB_DEFAULT) {
        console.log('VideoCompressionService: File is small enough, copying without compression');
        
        const permanentDir = await initializeVideoFilesDirectory();
        const fileName = `android9_copy_${Date.now()}.mp4`;
        const permanentUri = `${permanentDir}${fileName}`;
        
        await FileSystem.copyAsync({ 
          from: normalizeUri(videoUri), 
          to: normalizeUri(permanentUri) 
        });
        
        // Simulate progress for UI consistency
        for (let i = 0; i <= 100; i += 10) {
          if (progressCallback) {
            progressCallback(i / 100);
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log('VideoCompressionService: Strategy 3 successful (copy):', permanentUri);
        return permanentUri;
      } else {
        throw new Error(`File too large (${fileSizeMB.toFixed(1)}MB) and compression failed on Android 9`);
      }
    }
  }
};

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

// Helper function to normalize URIs
const normalizeUri = (uri) => {
  if (!uri) return uri;
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

// Enhanced file check with Android 9 compatibility
const safeFileCheck = async (uri, maxRetries = 3, delayMs = 500) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const normalizedUri = normalizeUri(uri);
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      console.log(`VideoCompressionService: File check attempt ${attempt} for ${normalizedUri}:`, fileInfo);
      
      if (fileInfo.exists && fileInfo.size > 0) {
        return fileInfo;
      }
      
      if (attempt < maxRetries) {
        console.log(`VideoCompressionService: File not ready on attempt ${attempt}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`VideoCompressionService: Error checking file ${uri} on attempt ${attempt}:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.warn(`VideoCompressionService: File ${uri} not found or invalid after ${maxRetries} attempts`);
  return { exists: false, size: 0 };
};

// Move compressed file to permanent storage with Android 9 compatibility
const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    console.log(`VideoCompressionService: Moving file from cache (Android 9): ${cacheUri}`);
    
    const sourceFileInfo = await safeFileCheck(cacheUri, 5, 1000);
    if (!sourceFileInfo.exists || sourceFileInfo.size === 0) {
      throw new Error(`Source file does not exist or is empty: ${cacheUri}`);
    }
    
    const permanentDir = await initializeVideoFilesDirectory();
    const fileName = `compressed_android9_${Date.now()}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;
    
    const sourceUri = normalizeUri(cacheUri);
    const destUri = normalizeUri(permanentUri);
    
    console.log(`VideoCompressionService: Copying from ${sourceUri} to ${destUri}`);
    
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    
    // Extra verification for Android 9
    await new Promise(resolve => setTimeout(resolve, 1000));
    const copiedFileInfo = await safeFileCheck(destUri, 5, 1000);
    
    if (!copiedFileInfo.exists || copiedFileInfo.size === 0) {
      throw new Error(`Failed to copy to permanent storage. File ${destUri} ${!copiedFileInfo.exists ? 'does not exist' : 'is empty'}.`);
    }
    
    console.log(`VideoCompressionService: File successfully moved to permanent storage. Size: ${copiedFileInfo.size} bytes`);
    
    // Cleanup original cache file
    try {
      if (sourceUri !== destUri) {
        await FileSystem.deleteAsync(sourceUri, { idempotent: true });
        console.log(`VideoCompressionService: Cleaned up cache file: ${sourceUri}`);
      }
    } catch (cleanupError) {
      console.warn('VideoCompressionService: Failed to cleanup cache file (non-critical):', cleanupError);
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
      console.log('VideoCompressionService: Android version check:', {
        platform: Platform.OS,
        version: Platform.Version,
        isAndroid9OrLower: isAndroid9OrLower()
      });
      
      // Validate source video
      const sourceFileInfo = await safeFileCheck(videoUri, 1, 0);
      if (!sourceFileInfo.exists || sourceFileInfo.size === 0) {
        throw new Error(`Source video file does not exist or is empty: ${videoUri}`);
      }
      
      console.log(`VideoCompressionService: Source video verified. Size: ${sourceFileInfo.size} bytes`);
      
      // Android 9 specific validation
      if (isAndroid9OrLower()) {
        console.log('VideoCompressionService: Performing Android 9 specific validation');
        
        const validation = await validateVideoMetadataAndroid9(videoUri);
        if (!validation.isValid) {
          throw new Error(`Android 9 video validation failed: ${validation.error}`);
        }
        
        console.log('VideoCompressionService: Android 9 validation passed');
        
        // Use Android 9 compatible compression
        compressedCacheUri = await compressVideoAndroid9Compatible(videoUri, { progressCallback });
        compressionSuccessful = true;
        
      } else {
        // Use standard compression for newer Android versions
        console.log('VideoCompressionService: Using standard compression for newer Android');
        
        const result = await Video.compress(
          videoUri,
          {
            compressionMethod: 'auto',
            getCancellationId: (cancellationId) => {
              console.log('VideoCompressionService: Standard compression started with ID:', cancellationId);
            }
          },
          (progress) => {
            const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
            console.log(`VideoCompressionService: Standard compression progress: ${Math.round(validProgress * 100)}%`);
            if (progressCallback) {
              progressCallback(validProgress);
            }
          }
        );
        
        if (!result || typeof result !== 'string') {
          throw new Error('Standard compression failed to return a valid path.');
        }
        
        compressedCacheUri = result;
        compressionSuccessful = true;
      }
      
      console.log('VideoCompressionService: Compression completed, temp file:', compressedCacheUri);
      
      // Add extra wait time for Android 9
      const waitTime = isAndroid9OrLower() ? 2000 : 1000;
      console.log(`VideoCompressionService: Waiting ${waitTime}ms for filesystem sync...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Verify compressed file exists
      const compressedFileInfo = await safeFileCheck(compressedCacheUri, 5, 1000);
      if (!compressedFileInfo.exists || compressedFileInfo.size === 0) {
        throw new Error(`Compressed file was not created or is empty: ${compressedCacheUri}`);
      }
      
      console.log(`VideoCompressionService: Compressed file verified. Size: ${compressedFileInfo.size} bytes`);
      
      // Move to permanent storage
      const permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      
      console.log('VideoCompressionService: File successfully moved to permanent location:', permanentUri);
      
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Video compression failed:', error);

      // Enhanced cleanup for Android 9
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
      
      // Handle Android 9 specific errors
      let userMessage = 'Failed to compress video. Please try again.';
      
      if (error.message) {
        if (error.message.includes('NumberFormatException') || error.message.includes('-9223372036854775808')) {
          userMessage = 'Video format not supported on this Android version. Please try a different video or record a new one.';
        } else if (error.message.includes('Android 9')) {
          userMessage = 'Video processing failed on Android 9. Please try recording a shorter video or use a different format.';
        } else if (error.message.includes('too large')) {
          userMessage = error.message;
        } else if (error.message.includes('cancel')) {
          Alert.alert('Cancelled', 'Video compression was cancelled.');
          return null; 
        } else if (error.message.includes('does not exist')) {
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
    console.log('VideoCompressionService: Compression cancellation requested.');
  },

  // Enhanced compression info for Android 9
  async getCompressionInfo(videoUri) {
    try {
      const fileInfo = await safeFileCheck(videoUri, 1, 0);
      const result = {
        exists: fileInfo.exists,
        size: fileInfo.size || 0,
        sizeInMB: fileInfo.size ? (fileInfo.size / (1024 * 1024)).toFixed(2) : 0,
        platform: Platform.OS,
        androidVersion: Platform.Version,
        isAndroid9Compatible: isAndroid9OrLower()
      };
      
      console.log('VideoCompressionService: Compression info:', result);
      return result;
    } catch (error) {
      console.error('VideoCompressionService: Error getting compression info:', error);
      return { 
        exists: false, 
        size: 0, 
        sizeInMB: 0,
        platform: Platform.OS,
        androidVersion: Platform.Version,
        isAndroid9Compatible: isAndroid9OrLower(),
        error: error.message
      };
    }
  },
};

export default VideoCompressionService;