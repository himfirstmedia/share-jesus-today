import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { Video } from 'react-native-compressor';

const MAX_SIZE_MB_DEFAULT = 15;
const ANDROID_9_API_LEVEL = 28;

// Enhanced error code mapping for better diagnostics
const ERROR_CODES = {
  '0xffffec77': 'CODEC_ERROR',
  '0xffffec78': 'INVALID_PARAMETER',
  '0xffffec79': 'INVALID_STATE',
  '0xffffec7a': 'INSUFFICIENT_RESOURCES'
};

// Check if we're running on Android 9 or lower
const isAndroid9OrLower = () => {
  return Platform.OS === 'android' && Platform.Version <= ANDROID_9_API_LEVEL;
};

// Enhanced video validation with codec checks
const validateVideoFile = async (videoUri) => {
  try {
    console.log('VideoCompressionService: Validating video file:', videoUri);
    
    // Basic file validation
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!fileInfo.exists || !fileInfo.size || fileInfo.size === 0) {
      throw new Error('Invalid video file: file does not exist or is empty');
    }
    
    // Check file size (videos larger than 500MB often cause codec issues)
    const fileSizeMB = fileInfo.size / (1024 * 1024);
    console.log(`VideoCompressionService: File size: ${fileSizeMB.toFixed(2)}MB`);
    
    if (fileSizeMB > 500) {
      throw new Error(`Video file too large (${fileSizeMB.toFixed(1)}MB). Maximum supported size is 500MB.`);
    }
    
    // Try to get video metadata using MediaLibrary for additional validation
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(videoUri);
        if (asset && asset.duration !== undefined) {
          console.log('VideoCompressionService: Video metadata:', { 
            duration: asset.duration,
            mediaType: asset.mediaType,
            width: asset.width,
            height: asset.height
          });
          
          // Check for extremely long videos (over 30 minutes can cause issues)
          if (asset.duration > 1800) { // 30 minutes
            console.warn('VideoCompressionService: Very long video detected, may cause compression issues');
          }
          
          return { 
            isValid: true, 
            duration: asset.duration,
            size: fileInfo.size,
            width: asset.width,
            height: asset.height
          };
        }
      }
    } catch (mediaLibError) {
      console.log('VideoCompressionService: MediaLibrary validation failed (non-critical):', mediaLibError.message);
    }
    
    return { isValid: true, duration: null, size: fileInfo.size };
  } catch (error) {
    console.error('VideoCompressionService: Video validation failed:', error);
    return { isValid: false, error: error.message };
  }
};

// Progressive compression with multiple fallback strategies
const compressVideoWithFallbacks = async (videoUri, options = {}) => {
  const { progressCallback = () => {} } = options;
  
  console.log('VideoCompressionService: Starting progressive compression for:', videoUri);
  
  // Strategy 1: High quality compression (default)
  try {
    console.log('VideoCompressionService: Attempting Strategy 1 - High quality compression');
    
    const result = await Video.compress(
      videoUri,
      {
        compressionMethod: 'auto',
        quality: 'high',
        getCancellationId: (cancellationId) => {
          console.log('VideoCompressionService: High quality compression started with ID:', cancellationId);
        }
      },
      (progress) => {
        const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
        console.log(`VideoCompressionService: High quality compression progress: ${Math.round(validProgress * 100)}%`);
        progressCallback(validProgress * 0.8); // Reserve 20% for file operations
      }
    );
    
    if (result && typeof result === 'string') {
      console.log('VideoCompressionService: Strategy 1 successful:', result);
      return result;
    }
    
    throw new Error('High quality compression returned invalid result');
    
  } catch (strategy1Error) {
    console.log('VideoCompressionService: Strategy 1 failed:', strategy1Error.message);
    
    // Check for specific error codes
    const errorMessage = strategy1Error.message || '';
    const isCodecError = Object.keys(ERROR_CODES).some(code => errorMessage.includes(code));
    
    if (isCodecError) {
      console.log('VideoCompressionService: Codec error detected, trying alternative approach');
    }
    
    // Strategy 2: Medium quality with manual settings
    try {
      console.log('VideoCompressionService: Attempting Strategy 2 - Medium quality manual compression');
      
      const result = await Video.compress(
        videoUri,
        {
          compressionMethod: 'manual',
          quality: 'medium',
          bitrate: 1500, // Conservative bitrate
          maxWidth: 1280,
          maxHeight: 720,
          getCancellationId: (cancellationId) => {
            console.log('VideoCompressionService: Medium quality compression started with ID:', cancellationId);
          }
        },
        (progress) => {
          const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
          console.log(`VideoCompressionService: Medium quality compression progress: ${Math.round(validProgress * 100)}%`);
          progressCallback(validProgress * 0.8);
        }
      );
      
      if (result && typeof result === 'string') {
        console.log('VideoCompressionService: Strategy 2 successful:', result);
        return result;
      }
      
      throw new Error('Medium quality compression returned invalid result');
      
    } catch (strategy2Error) {
      console.log('VideoCompressionService: Strategy 2 failed:', strategy2Error.message);
      
      // Strategy 3: Low quality compression (most compatible)
      try {
        console.log('VideoCompressionService: Attempting Strategy 3 - Low quality compression');
        
        const result = await Video.compress(
          videoUri,
          {
            compressionMethod: 'manual',
            quality: 'low',
            bitrate: 800,
            maxWidth: 854,
            maxHeight: 480,
            getCancellationId: (cancellationId) => {
              console.log('VideoCompressionService: Low quality compression started with ID:', cancellationId);
            }
          },
          (progress) => {
            const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
            console.log(`VideoCompressionService: Low quality compression progress: ${Math.round(validProgress * 100)}%`);
            progressCallback(validProgress * 0.8);
          }
        );
        
        if (result && typeof result === 'string') {
          console.log('VideoCompressionService: Strategy 3 successful:', result);
          return result;
        }
        
        throw new Error('Low quality compression returned invalid result');
        
      } catch (strategy3Error) {
        console.log('VideoCompressionService: Strategy 3 failed:', strategy3Error.message);
        
        // Strategy 4: Copy without compression if file is small enough
        console.log('VideoCompressionService: Attempting Strategy 4 - Copy without compression');
        
        const fileInfo = await FileSystem.getInfoAsync(videoUri);
        const fileSizeMB = fileInfo.size / (1024 * 1024);
        
        if (fileSizeMB <= MAX_SIZE_MB_DEFAULT) {
          console.log('VideoCompressionService: File is small enough, copying without compression');
          
          const permanentDir = await initializeVideoFilesDirectory();
          const fileName = `copy_${Date.now()}.mp4`;
          const permanentUri = `${permanentDir}${fileName}`;
          
          await FileSystem.copyAsync({ 
            from: normalizeUri(videoUri), 
            to: normalizeUri(permanentUri) 
          });
          
          // Simulate progress for UI consistency
          for (let i = 0; i <= 100; i += 10) {
            progressCallback(i / 100);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          console.log('VideoCompressionService: Strategy 4 successful (copy):', permanentUri);
          return permanentUri;
        } else {
          // Strategy 5: Segment and compress (for very large files)
          throw new Error(`All compression strategies failed. File size: ${fileSizeMB.toFixed(1)}MB. Original errors: [${strategy1Error.message}] [${strategy2Error.message}] [${strategy3Error.message}]`);
        }
      }
    }
  }
};

// Android 9 specific compression (kept from original)
const compressVideoAndroid9Compatible = async (videoUri, options = {}) => {
  const { progressCallback = () => {} } = options;
  
  console.log('VideoCompressionService: Starting Android 9 compatible compression for:', videoUri);
  
  const android9CompressionConfig = {
    compressionMethod: 'manual',
    quality: 'medium',
    bitrate: 1000,
    maxWidth: 1280,
    maxHeight: 720,
    minimumFileSizeForCompress: 1,
    getCancellationId: (cancellationId) => {
      console.log('VideoCompressionService: Android 9 compression started with ID:', cancellationId);
    }
  };
  
  try {
    const result = await Video.compress(
      videoUri,
      android9CompressionConfig,
      (progress) => {
        const validProgress = isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
        console.log(`VideoCompressionService: Android 9 compression progress: ${Math.round(validProgress * 100)}%`);
        progressCallback(validProgress);
      }
    );
    
    if (result && typeof result === 'string') {
      console.log('VideoCompressionService: Android 9 compression successful:', result);
      return result;
    }
    
    throw new Error('Android 9 compression failed: Invalid result');
    
  } catch (error) {
    console.log('VideoCompressionService: Android 9 compression failed, trying fallback');
    
    // Fallback to copy for Android 9
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    const fileSizeMB = fileInfo.size / (1024 * 1024);
    
    if (fileSizeMB <= MAX_SIZE_MB_DEFAULT) {
      console.log('VideoCompressionService: Android 9 fallback - copying without compression');
      
      const permanentDir = await initializeVideoFilesDirectory();
      const fileName = `android9_copy_${Date.now()}.mp4`;
      const permanentUri = `${permanentDir}${fileName}`;
      
      await FileSystem.copyAsync({ 
        from: normalizeUri(videoUri), 
        to: normalizeUri(permanentUri) 
      });
      
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        progressCallback(i / 100);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      return permanentUri;
    } else {
      throw error;
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

// Enhanced file check with better retry logic
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

// Move compressed file to permanent storage
const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    console.log(`VideoCompressionService: Moving file from cache: ${cacheUri}`);
    
    const sourceFileInfo = await safeFileCheck(cacheUri, 5, 1000);
    if (!sourceFileInfo.exists || sourceFileInfo.size === 0) {
      throw new Error(`Source file does not exist or is empty: ${cacheUri}`);
    }
    
    const permanentDir = await initializeVideoFilesDirectory();
    const fileName = `compressed_${Date.now()}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;
    
    const sourceUri = normalizeUri(cacheUri);
    const destUri = normalizeUri(permanentUri);
    
    console.log(`VideoCompressionService: Copying from ${sourceUri} to ${destUri}`);
    
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    
    // Verification
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

// Enhanced error message generation
const generateUserFriendlyErrorMessage = (error) => {
  const errorMessage = error.message || '';
  
  // Check for specific error codes
  for (const [code, type] of Object.entries(ERROR_CODES)) {
    if (errorMessage.includes(code)) {
      switch (type) {
        case 'CODEC_ERROR':
          return 'Video format not supported. Please try recording a new video or use a different format.';
        case 'INVALID_PARAMETER':
          return 'Video file is corrupted or has invalid parameters. Please select a different video.';
        case 'INVALID_STATE':
          return 'Video processing failed due to device state. Please restart the app and try again.';
        case 'INSUFFICIENT_RESOURCES':
          return 'Not enough memory to process this video. Please close other apps and try again.';
      }
    }
  }
  
  // Check for other common issues
  if (errorMessage.includes('too large')) {
    return errorMessage;
  } else if (errorMessage.includes('cancel')) {
    return 'Video compression was cancelled.';
  } else if (errorMessage.includes('does not exist')) {
    return 'Video file not found. Please select the video again.';
  } else if (errorMessage.includes('storage') || errorMessage.includes('space')) {
    return 'Not enough storage space. Please free up some space and try again.';
  } else if (errorMessage.includes('permission')) {
    return 'Permission denied. Please check app permissions.';
  } else if (errorMessage.includes('NumberFormatException') || errorMessage.includes('-9223372036854775808')) {
    return 'Video format not supported on this device. Please try a different video.';
  }
  
  return 'Failed to compress video. Please try again with a different video.';
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
      console.log('VideoCompressionService: Platform info:', {
        platform: Platform.OS,
        version: Platform.Version,
        isAndroid9OrLower: isAndroid9OrLower()
      });
      
      // Enhanced video validation
      const validation = await validateVideoFile(videoUri);
      if (!validation.isValid) {
        throw new Error(`Video validation failed: ${validation.error}`);
      }
      
      console.log('VideoCompressionService: Video validation passed');
      
      // Choose compression strategy based on Android version
      if (isAndroid9OrLower()) {
        console.log('VideoCompressionService: Using Android 9 compatible compression');
        compressedCacheUri = await compressVideoAndroid9Compatible(videoUri, { progressCallback });
      } else {
        console.log('VideoCompressionService: Using progressive compression with fallbacks');
        compressedCacheUri = await compressVideoWithFallbacks(videoUri, { progressCallback });
      }
      
      compressionSuccessful = true;
      console.log('VideoCompressionService: Compression completed, temp file:', compressedCacheUri);
      
      // Update progress to 80%
      progressCallback(0.8);
      
      // Wait for filesystem sync
      const waitTime = isAndroid9OrLower() ? 2000 : 1000;
      console.log(`VideoCompressionService: Waiting ${waitTime}ms for filesystem sync...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Verify compressed file exists
      const compressedFileInfo = await safeFileCheck(compressedCacheUri, 5, 1000);
      if (!compressedFileInfo.exists || compressedFileInfo.size === 0) {
        throw new Error(`Compressed file was not created or is empty: ${compressedCacheUri}`);
      }
      
      console.log(`VideoCompressionService: Compressed file verified. Size: ${compressedFileInfo.size} bytes`);
      
      // Update progress to 90%
      progressCallback(0.9);
      
      // Move to permanent storage (only if not already in permanent location)
      let permanentUri = compressedCacheUri;
      if (!compressedCacheUri.includes('videofiles/')) {
        permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      }
      
      // Final progress update
      progressCallback(1.0);
      
      console.log('VideoCompressionService: File successfully processed:', permanentUri);
      
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Video compression failed:', error);

      // Enhanced cleanup
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
      
      // Generate user-friendly error message
      const userMessage = generateUserFriendlyErrorMessage(error);
      
      // Don't show alert for cancellation
      if (!userMessage.includes('cancelled')) {
        Alert.alert('Compression Error', userMessage);
      }
      
      throw error;
    }
  },

  cancelCompression() {
    console.log('VideoCompressionService: Compression cancellation requested.');
  },

  async getCompressionInfo(videoUri) {
    try {
      const validation = await validateVideoFile(videoUri);
      const result = {
        exists: validation.isValid,
        size: validation.size || 0,
        sizeInMB: validation.size ? (validation.size / (1024 * 1024)).toFixed(2) : 0,
        duration: validation.duration,
        platform: Platform.OS,
        androidVersion: Platform.Version,
        isAndroid9Compatible: isAndroid9OrLower(),
        width: validation.width,
        height: validation.height
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