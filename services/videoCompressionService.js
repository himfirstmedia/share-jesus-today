import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { Video } from 'react-native-compressor';

const MAX_SIZE_MB_DEFAULT = 15;

const validateSourceFile = async (sourceUri, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`VideoCompressionService: Validating file (attempt ${attempt}): ${sourceUri}`);
      
      const fileInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
      console.log(`VideoCompressionService: File validation info:`, fileInfo);
      
      if (fileInfo.exists && fileInfo.size > 0) {
        if (fileInfo.size < 50) {
          console.warn(`VideoCompressionService: File too small (${fileInfo.size} bytes), likely corrupted`);
          return false;
        }
        return true;
      }
      
      if (attempt < retries) {
        console.log(`VideoCompressionService: File validation failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`VideoCompressionService: File validation error (attempt ${attempt}):`, error);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.warn(`VideoCompressionService: File validation failed after ${retries} attempts`);
  return false;
};

const getReliableStorageDirectory = async () => {
  try {
    if (Platform.OS === 'android') {
      console.log('VideoCompressionService: Using Android-specific storage strategy');
      
      try {
        const externalFilesDir = `${FileSystem.documentDirectory}../files/CompressedVideos/`;
        await FileSystem.makeDirectoryAsync(externalFilesDir, { intermediates: true });
        
        const testFile = `${externalFilesDir}test_${Date.now()}.tmp`;
        await FileSystem.writeAsStringAsync(testFile, 'test');
        await FileSystem.deleteAsync(testFile, { idempotent: true });
        
        console.log('VideoCompressionService: Using external files directory:', externalFilesDir);
        return externalFilesDir;
      } catch (externalError) {
        console.log('VideoCompressionService: External files directory failed:', externalError.message);
      }
      
      try {
        const internalFilesDir = `${FileSystem.documentDirectory}CompressedVideos/`;
        await FileSystem.makeDirectoryAsync(internalFilesDir, { intermediates: true });
        console.log('VideoCompressionService: Using internal files directory:', internalFilesDir);
        return internalFilesDir;
      } catch (internalError) {
        console.log('VideoCompressionService: Internal files directory failed:', internalError.message);
      }
    }
    
    const defaultDir = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(defaultDir, { intermediates: true });
    console.log('VideoCompressionService: Using default directory:', defaultDir);
    return defaultDir;
    
  } catch (error) {
    console.error('VideoCompressionService: All storage options failed:', error);
    const cacheDir = `${FileSystem.cacheDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    console.log('VideoCompressionService: Emergency fallback to cache:', cacheDir);
    return cacheDir;
  }
};

const tryCompressionWithFallbacks = async (sourceUri, options, progressCallback) => {
  const compressionStrategies = [
    {
      name: 'auto',
      config: {
        compressionMethod: 'auto',
        minimumFileSizeForCompress: 1,
        includeAudio: true,
        ...(Platform.OS === 'android' && {
          optimizeForNetworkUse: false
        })
      }
    },
    {
      name: 'manual-medium',
      config: {
        compressionMethod: 'manual',
        quality: 'medium',
        minimumFileSizeForCompress: 1,
        includeAudio: true
      }
    },
    {
      name: 'manual-low',
      config: {
        compressionMethod: 'manual',
        quality: 'low',
        minimumFileSizeForCompress: 1,
        includeAudio: true
      }
    }
  ];

  for (const strategy of compressionStrategies) {
    try {
      console.log(`VideoCompressionService: Trying compression strategy: ${strategy.name}`);
      
      const isValid = await validateSourceFile(sourceUri, 1);
      if (!isValid) {
        console.error(`VideoCompressionService: Source file invalid for strategy ${strategy.name}`);
        continue;
      }

      const result = await Video.compress(
        sourceUri,
        {
          ...strategy.config,
          getCancellationId: (cancellationId) => {
            console.log(`VideoCompressionService: Compression started with ID (${strategy.name}):`, cancellationId);
          }
        },
        (progress) => {
          const percentage = Math.round(progress * 100);
          console.log(`VideoCompressionService: Compression progress (${strategy.name}): ${percentage}%`);
          if (progressCallback) {
            progressCallback(progress);
          }
        }
      );

      if (result && result !== sourceUri) {
        const resultValid = await validateSourceFile(result, 2);
        if (resultValid) {
          console.log(`VideoCompressionService: Strategy ${strategy.name} successful:`, result);
          return result;
        } else {
          console.warn(`VideoCompressionService: Strategy ${strategy.name} produced invalid result`);
        }
      } else {
        console.warn(`VideoCompressionService: Strategy ${strategy.name} returned no result or same file`);
      }

    } catch (error) {
      console.warn(`VideoCompressionService: Strategy ${strategy.name} failed:`, error.message);
      
      if (error.message && error.message.includes('NumberFormatException')) {
        console.error(`VideoCompressionService: NumberFormatException detected in strategy ${strategy.name}, continuing to next strategy`);
        continue;
      }
    }
  }

  return null;
};

const normalizeFileUri = (uri) => {
  if (!uri) return null;
  
  console.log(`VideoCompressionService: Normalizing URI: ${uri}`);
  
  let normalized = uri.toString();
  normalized = normalized.replace(/^file:\/\/+/g, '');
  
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  
  normalized = normalized.replace(/\/+/g, '/');
  normalized = `file://${normalized}`;
  
  console.log(`VideoCompressionService: Normalized to: ${normalized}`);
  return normalized;
};

const safeFileCheck = async (uri, retries = 3) => {
  const normalizedUri = normalizeFileUri(uri);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`VideoCompressionService: Checking file (attempt ${attempt}): ${normalizedUri}`);
      
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      console.log(`VideoCompressionService: File info:`, fileInfo);
      
      if (fileInfo.exists && fileInfo.size > 0) {
        return { 
          exists: true, 
          size: fileInfo.size, 
          uri: normalizedUri,
          info: fileInfo 
        };
      }
      
      if (attempt < retries) {
        console.log(`VideoCompressionService: File check failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`VideoCompressionService: File check error (attempt ${attempt}):`, error);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  console.warn(`VideoCompressionService: File not found after ${retries} attempts: ${normalizedUri}`);
  return { exists: false, size: 0, uri: normalizedUri };
};

const moveFile = async (sourceUri, destinationUri) => {
  try {
    console.log(`VideoCompressionService: Moving file from ${sourceUri} to ${destinationUri}`);
    
    const sourceCheck = await safeFileCheck(sourceUri);
    if (!sourceCheck.exists) {
      throw new Error(`Source file does not exist: ${sourceUri}`);
    }
    
    const normalizedSource = sourceCheck.uri;
    const normalizedDest = normalizeFileUri(destinationUri);
    
    const destDir = normalizedDest.substring(0, normalizedDest.lastIndexOf('/'));
    const destDirClean = destDir.replace('file://', '');
    await FileSystem.makeDirectoryAsync(`file://${destDirClean}`, { intermediates: true });
    
    console.log(`VideoCompressionService: Copying from ${normalizedSource} to ${normalizedDest}`);
    
    await FileSystem.copyAsync({
      from: normalizedSource,
      to: normalizedDest
    });
    
    const destCheck = await safeFileCheck(normalizedDest, 5);
    if (!destCheck.exists) {
      throw new Error('File copy verification failed');
    }
    
    try {
      await FileSystem.deleteAsync(normalizedSource, { idempotent: true });
      console.log('VideoCompressionService: Source file cleaned up');
    } catch (cleanupError) {
      console.warn('VideoCompressionService: Could not clean up source (non-critical):', cleanupError);
    }
    
    return normalizedDest;
    
  } catch (error) {
    console.error('VideoCompressionService: File move operation failed:', error);
    throw error;
  }
};

const VideoCompressionService = {
  async createCompressedCopy(videoUri, options = {}) {
    const {
      maxSizeMB = MAX_SIZE_MB_DEFAULT,
      progressCallback = () => {},
    } = options;

    let tempCompressedUri = null;

    try {
      console.log('VideoCompressionService: Starting enhanced Android 9 compatible compression');
      console.log('VideoCompressionService: Input video URI:', videoUri);
      
      const sourceValid = await validateSourceFile(videoUri, 5);
      if (!sourceValid) {
        throw new Error(`Source video file does not exist or is corrupted: ${videoUri}`);
      }
      
      const sourceCheck = await safeFileCheck(videoUri);
      if (!sourceCheck.exists) {
        throw new Error(`Source video file does not exist: ${videoUri}`);
      }
      
      const sourceUri = sourceCheck.uri;
      console.log(`VideoCompressionService: Source verified. Size: ${sourceCheck.size} bytes`);
      console.log(`VideoCompressionService: Using source URI: ${sourceUri}`);

      const storageDir = await getReliableStorageDirectory();
      const outputFileName = `compressed_${Date.now()}.mp4`;
      const finalOutputPath = `${storageDir}${outputFileName}`;
      
      console.log('VideoCompressionService: Target storage directory:', storageDir);
      console.log('VideoCompressionService: Final output path:', finalOutputPath);

      console.log('VideoCompressionService: Starting compression with fallback strategies');
      
      tempCompressedUri = await tryCompressionWithFallbacks(
        sourceUri,
        options,
        progressCallback
      );

      if (!tempCompressedUri) {
        console.warn('VideoCompressionService: All compression strategies failed, creating copy instead');
        
        try {
          const copyFileName = `original_copy_${Date.now()}.mp4`;
          const copyPath = `${storageDir}${copyFileName}`;
          
          console.log('VideoCompressionService: Creating copy from source to:', copyPath);
          
          await FileSystem.copyAsync({
            from: sourceUri,
            to: copyPath
          });
          
          const copyCheck = await safeFileCheck(copyPath, 3);
          if (copyCheck.exists) {
            console.log('VideoCompressionService: Copy created successfully:', copyPath);
            console.log(`VideoCompressionService: Copy size: ${copyCheck.size} bytes`);
            
            if (progressCallback) progressCallback(1.0);
            return copyPath;
          } else {
            throw new Error('Copy verification failed');
          }
          
        } catch (copyError) {
          console.error('VideoCompressionService: Copy creation also failed:', copyError);
          throw new Error(`All compression strategies and copy fallback failed: ${copyError.message}`);
        }
      }

      console.log('VideoCompressionService: Compression completed. Temp file:', tempCompressedUri);

      console.log('VideoCompressionService: Waiting for file system sync...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const compressedCheck = await safeFileCheck(tempCompressedUri, 5);
      if (!compressedCheck.exists) {
        throw new Error(`Compressed file was not created or is inaccessible: ${tempCompressedUri}`);
      }

      console.log(`VideoCompressionService: Compressed file verified. Size: ${compressedCheck.size} bytes`);

      const permanentUri = await moveFile(tempCompressedUri, finalOutputPath);
      
      console.log('VideoCompressionService: File successfully stored at:', permanentUri);
      
      const finalCheck = await safeFileCheck(permanentUri);
      if (!finalCheck.exists) {
        throw new Error('Final file verification failed');
      }
      
      console.log(`VideoCompressionService: Final verification passed. File size: ${finalCheck.size} bytes`);
      
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Compression process failed:', error);

      if (tempCompressedUri) {
        try {
          const tempExists = await safeFileCheck(tempCompressedUri, 1);
          if (tempExists.exists) {
            await FileSystem.deleteAsync(tempExists.uri, { idempotent: true });
            console.log('VideoCompressionService: Cleaned up temporary file');
          }
        } catch (cleanupError) {
          console.warn('VideoCompressionService: Cleanup failed (non-critical):', cleanupError);
        }
      }
      
      let userMessage = 'Video compression failed. Please try again.';
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('does not exist') || msg.includes('not found')) {
          userMessage = 'Video file not found. Please select the video again.';
        } else if (msg.includes('permission') || msg.includes('denied')) {
          userMessage = 'Storage permission issue. Please restart the app and try again.';
        } else if (msg.includes('space') || msg.includes('storage')) {
          userMessage = 'Not enough storage space. Please free up space and try again.';
        } else if (msg.includes('numberformat') || msg.includes('compression')) {
          userMessage = 'Video format issue. Try selecting a different video.';
        } else if (msg.includes('cancelled') || msg.includes('cancel')) {
          userMessage = 'Compression was cancelled.';
          return null;
        } else if (msg.includes('corrupted') || msg.includes('unsupported')) {
          userMessage = 'Video file appears to be corrupted or in an unsupported format.';
        } else if (msg.includes('copy fallback failed')) {
          userMessage = 'Unable to process video file. Please try a different video.';
        }
      }
      
      Alert.alert('Compression Error', userMessage);
      throw error;
    }
  },

  async createCompressedCopyOrOriginal(videoUri, options = {}) {
    try {
      return await this.createCompressedCopy(videoUri, options);
    } catch (error) {
      console.warn('VideoCompressionService: Compression failed, attempting direct copy fallback');
      
      try {
        const sourceValid = await validateSourceFile(videoUri, 3);
        if (!sourceValid) {
          throw new Error('Source file is not accessible');
        }
        
        const storageDir = await getReliableStorageDirectory();
        const copyFileName = `fallback_original_${Date.now()}.mp4`;
        const copyPath = `${storageDir}${copyFileName}`;
        
        await FileSystem.copyAsync({
          from: normalizeFileUri(videoUri),
          to: copyPath
        });
        
        const copyCheck = await safeFileCheck(copyPath, 3);
        if (copyCheck.exists) {
          console.log('VideoCompressionService: Fallback copy successful:', copyPath);
          return copyPath;
        }
        
        throw new Error('Fallback copy also failed');
        
      } catch (fallbackError) {
        console.error('VideoCompressionService: All operations failed:', fallbackError);
        throw error;
      }
    }
  },

  async validateVideoFile(videoUri) {
    return await validateSourceFile(videoUri, 3);
  },

  async checkStorageInfo() {
    try {
      const storageDir = await getReliableStorageDirectory();
      const testFile = `${storageDir}storage_test_${Date.now()}.tmp`;
      
      await FileSystem.writeAsStringAsync(testFile, 'storage test');
      const testCheck = await safeFileCheck(testFile);
      await FileSystem.deleteAsync(testFile, { idempotent: true });
      
      return {
        available: testCheck.exists,
        directory: storageDir,
        platform: Platform.OS,
        writable: true
      };
    } catch (error) {
      console.error('VideoCompressionService: Storage check failed:', error);
      return {
        available: false,
        directory: null,
        platform: Platform.OS,
        writable: false,
        error: error.message
      };
    }
  },

  async getFileInfo(videoUri) {
    try {
      const fileCheck = await safeFileCheck(videoUri);
      return {
        exists: fileCheck.exists,
        size: fileCheck.size,
        sizeInMB: fileCheck.size ? (fileCheck.size / (1024 * 1024)).toFixed(2) : 0,
        normalizedUri: fileCheck.uri
      };
    } catch (error) {
      console.error('VideoCompressionService: File info check failed:', error);
      return { 
        exists: false, 
        size: 0, 
        sizeInMB: 0, 
        normalizedUri: null,
        error: error.message 
      };
    }
  },

  cancelCompression() {
    console.log('VideoCompressionService: Compression cancellation requested');
  }
};

export default VideoCompressionService;