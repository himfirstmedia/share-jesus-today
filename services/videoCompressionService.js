import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { Video } from 'react-native-compressor';
import VideoDetectionService from './videoDetectionService';

const MAX_SIZE_MB_DEFAULT = 15;
const MAX_FILE_SIZE_FOR_HARDWARE_COMPRESSION = 100 * 1024 * 1024; // 100MB
const MIN_ANDROID_VERSION_FOR_RELIABLE_COMPRESSION = 23;

// Device capability detection
const getDeviceCapabilities = () => {
  const isOldAndroid = Platform.OS === 'android' && parseInt(Platform.Version) < MIN_ANDROID_VERSION_FOR_RELIABLE_COMPRESSION;
  const isLowEndDevice = Platform.OS === 'android' && parseInt(Platform.Version) < 26; // Before Android 8.0
  
  return {
    isOldAndroid,
    isLowEndDevice,
    supportsHardwareCompression: !isOldAndroid,
    maxRecommendedFileSize: isLowEndDevice ? 50 * 1024 * 1024 : MAX_FILE_SIZE_FOR_HARDWARE_COMPRESSION, // 50MB for older devices
  };
};

// Smart compression strategy selection based on file and device
const selectOptimalCompressionStrategy = (fileSize, deviceCapabilities, metadata) => {
  const fileSizeMB = fileSize / (1024 * 1024);
  
  // For very small files, don't compress
  if (fileSizeMB < 2) {
    return 'skip';
  }
  
  // For large files on older devices, use most conservative approach
  if (deviceCapabilities.isOldAndroid && fileSizeMB > 25) {
    return 'ultra_conservative';
  }
  
  // For large files, start with manual compression
  if (fileSizeMB > 50) {
    return 'manual_first';
  }
  
  // For medium files on low-end devices
  if (deviceCapabilities.isLowEndDevice && fileSizeMB > 10) {
    return 'conservative_first';
  }
  
  // Default: try auto first
  return 'auto_first';
};

// Enhanced compression options with 720p max resolution limit
const getServerCompatibleCompressionOptions = (strategy = 'auto') => {
  const deviceCapabilities = getDeviceCapabilities();
  
  const baseOptions = {
    minimumFileSizeForCompress: 1,
    getCancellationId: (cancellationId) => {
      console.log(`VideoCompressionService: ${strategy} compression started with ID:`, cancellationId);
    }
  };

  switch (strategy) {
    case 'ultra_conservative':
      return {
        ...baseOptions,
        compressionMethod: 'manual',
        bitrate: 300000, // Very low bitrate for old devices
        maxSize: 480, // 480p for maximum compatibility
        outputFileType: 'mp4',
      };
      
    case 'manual_conservative':
      return {
        ...baseOptions,
        compressionMethod: 'manual',
        bitrate: deviceCapabilities.isLowEndDevice ? 800000 : 1200000,
        maxSize: deviceCapabilities.isLowEndDevice ? 480 : 720, // Max 720p
        outputFileType: 'mp4',
      };
    
    case 'low_quality_safe':
      return {
        ...baseOptions,
        compressionMethod: 'manual',
        bitrate: 600000,
        maxSize: 720, // 720p for safe compression
        outputFileType: 'mp4',
      };
    
    case 'auto':
    default:
      return {
        ...baseOptions,
        compressionMethod: 'auto',
        maxSize: 720, // Limit auto compression to 720p max
        outputFileType: 'mp4',
      };
  }
};

// Pre-flight device and video compatibility check
const checkCompressionCompatibility = async (videoUri) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    const deviceCapabilities = getDeviceCapabilities();
    const metadata = await VideoDetectionService.getVideoMetadata(videoUri);
    
    const compatibility = {
      isCompatible: true,
      issues: [],
      recommendations: []
    };
    
    // Check file size limits
    const fileSizeMB = fileInfo.size / (1024 * 1024);
    if (fileSizeMB > deviceCapabilities.maxRecommendedFileSize / (1024 * 1024)) {
      compatibility.issues.push(`File size (${fileSizeMB.toFixed(1)}MB) exceeds device capability`);
      compatibility.recommendations.push('Try recording a shorter video');
    }
    
    // Check duration limits
    if (metadata.duration > 300) { // 5 minutes
      compatibility.issues.push('Video duration is very long');
      compatibility.recommendations.push('Consider trimming the video');
    }
    
    // Device-specific checks
    if (deviceCapabilities.isOldAndroid && fileSizeMB > 25) {
      compatibility.issues.push('Large file on older Android device');
      compatibility.recommendations.push('Use a smaller video or newer device');
    }
    
    // Check available storage
    const storageInfo = await FileSystem.getFreeDiskStorageAsync();
    const requiredSpace = fileInfo.size * 2; // Original + compressed
    if (storageInfo < requiredSpace) {
      compatibility.issues.push('Insufficient storage space');
      compatibility.recommendations.push('Free up device storage');
      compatibility.isCompatible = false;
    }
    
    if (compatibility.issues.length > 0) {
      console.warn('VideoCompressionService: Compatibility issues detected:', compatibility);
    }
    
    return compatibility;
  } catch (error) {
    console.error('VideoCompressionService: Error checking compatibility:', error);
    return {
      isCompatible: true, // Default to allowing attempt
      issues: ['Could not verify compatibility'],
      recommendations: [],
      error: error.message
    };
  }
};

// Pre-compression file analysis
const analyzeVideoForCompression = async (videoUri) => {
  try {
    console.log('VideoCompressionService: Analyzing video for optimal compression strategy');
    
    const fileInfo = await FileSystem.getInfoAsync(videoUri);
    const metadata = await VideoDetectionService.getVideoMetadata(videoUri);
    const deviceCapabilities = getDeviceCapabilities();
    
    const analysis = {
      fileSize: fileInfo.size,
      fileSizeMB: fileInfo.size / (1024 * 1024),
      duration: metadata.duration,
      deviceCapabilities,
      recommendedStrategy: selectOptimalCompressionStrategy(fileInfo.size, deviceCapabilities, metadata),
      shouldSkipCompression: false,
      warnings: []
    };
    
    // Add warnings for problematic scenarios
    if (analysis.fileSizeMB > 100) {
      analysis.warnings.push('Very large file - compression may fail on some devices');
    }
    
    if (deviceCapabilities.isOldAndroid && analysis.fileSizeMB > 25) {
      analysis.warnings.push('Large file on older Android - using ultra-conservative compression');
    }
    
    if (analysis.fileSizeMB < 2) {
      analysis.shouldSkipCompression = true;
      analysis.warnings.push('File is already small - skipping compression');
    }
    
    console.log('VideoCompressionService: Analysis complete:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('VideoCompressionService: Error analyzing video:', error);
    return {
      fileSize: 0,
      fileSizeMB: 0,
      deviceCapabilities: getDeviceCapabilities(),
      recommendedStrategy: 'auto_first',
      shouldSkipCompression: false,
      warnings: ['Could not analyze video - using default strategy'],
      error: error.message
    };
  }
};

// Enhanced compression strategy sequence based on analysis
const getCompressionStrategies = (analysis) => {
  const { recommendedStrategy, deviceCapabilities } = analysis;
  
  switch (recommendedStrategy) {
    case 'skip':
      return []; // No compression needed
      
    case 'ultra_conservative':
      return [
        { name: 'ultra_conservative', options: getServerCompatibleCompressionOptions('ultra_conservative') },
        { name: 'low_quality_safe', options: getServerCompatibleCompressionOptions('low_quality_safe') }
      ];
      
    case 'manual_first':
      return [
        { name: 'manual_conservative', options: getServerCompatibleCompressionOptions('manual_conservative') },
        { name: 'low_quality_safe', options: getServerCompatibleCompressionOptions('low_quality_safe') },
        { name: 'ultra_conservative', options: getServerCompatibleCompressionOptions('ultra_conservative') }
      ];
      
    case 'conservative_first':
      return [
        { name: 'low_quality_safe', options: getServerCompatibleCompressionOptions('low_quality_safe') },
        { name: 'manual_conservative', options: getServerCompatibleCompressionOptions('manual_conservative') },
        { name: 'ultra_conservative', options: getServerCompatibleCompressionOptions('ultra_conservative') }
      ];
      
    case 'auto_first':
    default:
      if (deviceCapabilities.isOldAndroid) {
        // Skip auto for old Android, go straight to manual
        return [
          { name: 'manual_conservative', options: getServerCompatibleCompressionOptions('manual_conservative') },
          { name: 'low_quality_safe', options: getServerCompatibleCompressionOptions('low_quality_safe') },
          { name: 'ultra_conservative', options: getServerCompatibleCompressionOptions('ultra_conservative') }
        ];
      }
      
      return [
        { name: 'auto', options: getServerCompatibleCompressionOptions('auto') },
        { name: 'manual_conservative', options: getServerCompatibleCompressionOptions('manual_conservative') },
        { name: 'low_quality_safe', options: getServerCompatibleCompressionOptions('low_quality_safe') }
      ];
  }
};

// Enhanced validation function for compressed videos
const validateCompressedVideo = async (compressedUri, skipMetadataCheck = false) => {
  try {
    console.log('VideoCompressionService: Validating compressed video:', compressedUri);
    
    // Check if file exists first
    const fileInfo = await FileSystem.getInfoAsync(compressedUri);
    if (!fileInfo.exists) {
      throw new Error('Compressed file does not exist');
    }
    
    if (!fileInfo.size || fileInfo.size < 1000) {
      throw new Error(`Compressed file is too small: ${fileInfo.size} bytes`);
    }
    
    console.log(`VideoCompressionService: File exists with size: ${fileInfo.size} bytes`);
    
    // For basic validation (like checking if we should skip compression), we can skip metadata
    if (skipMetadataCheck) {
      return { isValid: true, size: fileInfo.size, duration: null };
    }
    
    // Try video detection service validation
    try {
      const validation = await VideoDetectionService.validateVideoFile(compressedUri);
      if (!validation.isValid) {
        throw new Error(`Video validation failed: ${validation.error}`);
      }
      
      const metadata = await VideoDetectionService.getVideoMetadata(compressedUri);
      if (!metadata.isValid || !metadata.duration || metadata.duration <= 0) {
        throw new Error('Invalid metadata or missing duration');
      }
      
      console.log('VideoCompressionService: Compressed file validation successful:', {
        size: fileInfo.size,
        duration: metadata.duration
      });
      
      return { isValid: true, size: fileInfo.size, duration: metadata.duration };
    } catch (metadataError) {
      console.warn('VideoCompressionService: Metadata validation failed, but file exists:', metadataError.message);
      
      // If metadata fails but file exists and has reasonable size, it might still be usable
      if (fileInfo.size > 10000) { // At least 10KB
        console.log('VideoCompressionService: Accepting file based on size despite metadata issues');
        return { isValid: true, size: fileInfo.size, duration: null, warning: metadataError.message };
      }
      
      throw metadataError;
    }
  } catch (error) {
    console.error('VideoCompressionService: Compressed file validation failed:', error);
    throw error;
  }
};

// Get the best available directory for the device
const getBestStorageDirectory = async () => {
  try {
    const directories = [
      Platform.OS === 'android' ? FileSystem.storageDirectory : FileSystem.documentDirectory,
      FileSystem.documentDirectory,
      FileSystem.cacheDirectory,
    ].filter(Boolean);

    console.log('VideoCompressionService: Available directories:', directories);

    for (const baseDir of directories) {
      try {
        const testDir = `${baseDir}videofiles/`;
        await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });
        
        const testFile = `${testDir}test_${Date.now()}.txt`;
        await FileSystem.writeAsStringAsync(testFile, 'test');
        await FileSystem.deleteAsync(testFile, { idempotent: true });
        
        console.log('VideoCompressionService: Successfully verified directory:', testDir);
        return testDir;
      } catch (dirError) {
        console.warn(`VideoCompressionService: Directory ${baseDir} not accessible:`, dirError.message);
        continue;
      }
    }
    
    throw new Error('No accessible storage directory found');
  } catch (error) {
    console.error('VideoCompressionService: Failed to find accessible directory:', error);
    throw error;
  }
};

const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = await getBestStorageDirectory();
    console.log('VideoCompressionService: Video files directory initialized:', videoFilesDirectory);
    return videoFilesDirectory;
  } catch (error) {
    console.error('VideoCompressionService: Failed to initialize videofiles directory:', error);
    
    try {
      const fallbackDir = `${FileSystem.cacheDirectory}temp_videos/`;
      await FileSystem.makeDirectoryAsync(fallbackDir, { intermediates: true });
      console.warn('VideoCompressionService: Using fallback temporary directory:', fallbackDir);
      return fallbackDir;
    } catch (fallbackError) {
      console.error('VideoCompressionService: Even fallback directory failed:', fallbackError);
      throw new Error('Unable to create any storage directory for videos');
    }
  }
};

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

const moveCompressedFileToPermanentStorage = async (cacheUri) => {
  try {
    console.log(`VideoCompressionService: Starting to move file from cache: ${cacheUri}`);
    
    const sourceUris = [
      cacheUri,
      cacheUri.startsWith('file://') ? cacheUri : `file://${cacheUri}`,
      cacheUri.replace('file://', ''),
    ];
    
    let validSourceUri = null;
    let sourceFileInfo = null;
    
    for (const uri of sourceUris) {
      const fileInfo = await safeFileCheck(uri);
      if (fileInfo.exists && fileInfo.size > 0) {
        validSourceUri = uri;
        sourceFileInfo = fileInfo;
        console.log(`VideoCompressionService: Found valid source at: ${uri}`);
        break;
      }
    }
    
    if (!validSourceUri) {
      throw new Error(`Source file not found in any of the expected locations: ${sourceUris.join(', ')}`);
    }

    const permanentDir = await initializeVideoFilesDirectory();
    const fileName = `compressed_${Date.now()}_${Platform.OS}.mp4`;
    const permanentUri = `${permanentDir}${fileName}`;

    console.log(`VideoCompressionService: Copying from ${validSourceUri} to ${permanentUri}`);
    
    const sourceUri = validSourceUri.startsWith('file://') ? validSourceUri : `file://${validSourceUri}`;
    const destUri = permanentUri.startsWith('file://') ? permanentUri : `file://${permanentUri}`;
    
    const copyStrategies = [
      async () => await FileSystem.copyAsync({ from: sourceUri, to: destUri }),
      async () => await FileSystem.copyAsync({ 
        from: validSourceUri, 
        to: permanentUri.replace('file://', '') 
      }),
      async () => await FileSystem.moveAsync({ from: sourceUri, to: destUri }),
    ];
    
    let copySuccessful = false;
    let lastError = null;
    
    for (let i = 0; i < copyStrategies.length; i++) {
      try {
        console.log(`VideoCompressionService: Attempting copy strategy ${i + 1}`);
        await copyStrategies[i]();
        copySuccessful = true;
        break;
      } catch (strategyError) {
        console.warn(`VideoCompressionService: Copy strategy ${i + 1} failed:`, strategyError.message);
        lastError = strategyError;
        continue;
      }
    }
    
    if (!copySuccessful) {
      throw new Error(`All copy strategies failed. Last error: ${lastError?.message}`);
    }

    const copiedFileInfo = await safeFileCheck(destUri);
    if (!copiedFileInfo.exists || copiedFileInfo.size === 0) {
      throw new Error(`Copy verification failed. Destination file ${destUri} ${!copiedFileInfo.exists ? 'does not exist' : 'is empty'}.`);
    }

    console.log(`VideoCompressionService: File successfully copied to permanent storage. Size: ${copiedFileInfo.size} bytes`);
    
    // Validate the copied file before returning
    try {
      await validateCompressedVideo(destUri);
      console.log('VideoCompressionService: Copied file passed validation');
    } catch (validationError) {
      console.error('VideoCompressionService: Copied file failed validation:', validationError);
      // Delete the invalid file
      await FileSystem.deleteAsync(destUri, { idempotent: true });
      throw new Error(`Copied file failed validation: ${validationError.message}`);
    }
    
    // Clean up the original cache file if it still exists and is different from destination
    try {
      if (sourceUri !== destUri && !sourceUri.includes('temp_videos')) {
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

// Enhanced main compression function
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
      console.log('VideoCompressionService: Device info - Platform:', Platform.OS, 'Version:', Platform.Version);
      
      // Verify source video exists
      const sourceFileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!sourceFileInfo.exists) {
        throw new Error(`Source video file does not exist: ${videoUri}`);
      }
      
      console.log(`VideoCompressionService: Source video verified. Size: ${sourceFileInfo.size} bytes`);

      // Check compatibility before starting compression
      const compatibility = await checkCompressionCompatibility(videoUri);
      if (!compatibility.isCompatible) {
        const issueMessage = compatibility.issues.join(', ');
        const recommendationMessage = compatibility.recommendations.join(', ');
        throw new Error(`Cannot compress video: ${issueMessage}. ${recommendationMessage}`);
      }
      
      // Warn user about potential issues
      if (compatibility.issues.length > 0) {
        console.warn('VideoCompressionService: Potential compression issues:', compatibility.issues);
      }

      // Analyze video for optimal compression strategy
      const analysis = await analyzeVideoForCompression(videoUri);
      
      // If file is too small or analysis suggests skipping
      if (analysis.shouldSkipCompression) {
        console.log('VideoCompressionService: Skipping compression - file is already optimal size');
        
        // Validate original file and copy to permanent storage
        await validateCompressedVideo(videoUri, true); // Skip metadata check for original files
        const permanentUri = await moveCompressedFileToPermanentStorage(videoUri);
        console.log('VideoCompressionService: Original file copied to permanent location:', permanentUri);
        return permanentUri;
      }

      // Get compression strategies based on analysis
      const compressionStrategies = getCompressionStrategies(analysis);
      
      if (compressionStrategies.length === 0) {
        throw new Error('No suitable compression strategies available for this video');
      }

      // Display warnings to user if any
      if (analysis.warnings.length > 0) {
        console.warn('VideoCompressionService: Compression warnings:', analysis.warnings);
      }

      let result = null;
      let lastCompressionError = null;
      let usedStrategy = null;

      // Try each compression strategy
      for (let i = 0; i < compressionStrategies.length; i++) {
        const strategy = compressionStrategies[i];
        console.log(`VideoCompressionService: Attempting compression strategy: ${strategy.name} (${i + 1}/${compressionStrategies.length})`);
        
        try {
          result = await Video.compress(
            videoUri,
            strategy.options,
            (progress) => {
              console.log(`VideoCompressionService: ${strategy.name} compression progress: ${Math.round(progress * 100)}%`);
              if (progressCallback) {
                progressCallback(progress * 0.9); // Reserve 10% for file operations
              }
            }
          );
          
          if (result) {
            // Give the compression process time to finalize the file
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if the result file actually exists and has content
            try {
              const resultFileInfo = await FileSystem.getInfoAsync(result);
              if (!resultFileInfo.exists) {
                console.warn(`VideoCompressionService: Result file does not exist: ${result}`);
                result = null;
                lastCompressionError = new Error('Compression completed but output file is missing');
                continue;
              }
              
              if (resultFileInfo.size < 1000) {
                console.warn(`VideoCompressionService: Result file is too small: ${resultFileInfo.size} bytes`);
                result = null;
                lastCompressionError = new Error(`Compression produced file that is too small: ${resultFileInfo.size} bytes`);
                continue;
              }
              
              console.log(`VideoCompressionService: Result file confirmed: ${resultFileInfo.size} bytes`);
            } catch (fileCheckError) {
              console.error(`VideoCompressionService: Error checking result file: ${fileCheckError.message}`);
              result = null;
              lastCompressionError = fileCheckError;
              continue;
            }
            
            // Validate the compressed result
            try {
              await validateCompressedVideo(result);
              usedStrategy = strategy.name;
              console.log(`VideoCompressionService: Compression successful with strategy: ${strategy.name}`);
              break;
            } catch (validationError) {
              console.warn(`VideoCompressionService: Strategy ${strategy.name} produced invalid file:`, validationError.message);
              
              // Check if it's just a metadata issue but file is otherwise valid
              try {
                const fileInfo = await FileSystem.getInfoAsync(result);
                if (fileInfo.exists && fileInfo.size > 50000) { // At least 50KB
                  console.log(`VideoCompressionService: File seems valid despite validation error, accepting it (${fileInfo.size} bytes)`);
                  usedStrategy = strategy.name;
                  break;
                }
              } catch (fallbackCheckError) {
                console.warn('VideoCompressionService: Fallback validation also failed:', fallbackCheckError.message);
              }
              
              // Clean up invalid file
              try {
                await FileSystem.deleteAsync(result, { idempotent: true });
              } catch (cleanupError) {
                console.warn('VideoCompressionService: Failed to cleanup invalid compressed file:', cleanupError);
              }
              result = null;
              lastCompressionError = validationError;
              continue;
            }
          }
        } catch (compressionError) {
          console.warn(`VideoCompressionService: Strategy ${strategy.name} failed:`, compressionError.message);
          lastCompressionError = compressionError;
          
          // Check for specific error codes and handle appropriately
          if (compressionError.message) {
            const errorMsg = compressionError.message.toLowerCase();
            
            // Hardware/codec specific errors
            if (errorMsg.includes('0xffffec77') || 
                errorMsg.includes('0xffffec78') || 
                errorMsg.includes('codec') ||
                errorMsg.includes('hardware') ||
                errorMsg.includes('not supported') ||
                errorMsg.includes('encoder') ||
                errorMsg.includes('mediacodec')) {
              console.log(`VideoCompressionService: Hardware/codec error (${compressionError.message}) detected, trying next strategy...`);
              continue;
            }
            
            // Out of memory errors - try more conservative approach
            if (errorMsg.includes('memory') || errorMsg.includes('oom')) {
              console.log(`VideoCompressionService: Memory error detected, trying more conservative strategy...`);
              continue;
            }
            
            // File system errors - might be temporary
            if (errorMsg.includes('file') || errorMsg.includes('storage') || errorMsg.includes('permission')) {
              console.log(`VideoCompressionService: File system error detected, trying next strategy...`);
              continue;
            }
          }
          
          // For other critical errors, continue to next strategy
          continue;
        }
      }

      // If all strategies failed, try fallback approach
      if (!result) {
        console.warn('VideoCompressionService: All compression strategies failed');
        
        // Final fallback: check if original file meets size requirements
        const originalSizeMB = sourceFileInfo.size / (1024 * 1024);
        // Allow a tolerance (e.g., 2x the max size) for direct upload if compression fails
        if (originalSizeMB <= maxSizeMB * 2) { 
          console.log(`VideoCompressionService: Using original file as fallback (${originalSizeMB.toFixed(2)}MB)`);
          
          try {
            // Validate original file and copy to permanent storage
            await validateCompressedVideo(videoUri, true); // Skip metadata check for original files
            const permanentUri = await moveCompressedFileToPermanentStorage(videoUri);
            console.log('VideoCompressionService: Original file copied to permanent location as fallback:', permanentUri);
            return permanentUri;
          } catch (originalValidationError) {
            console.error('VideoCompressionService: Original file validation failed for fallback:', originalValidationError);
            // If original file also fails validation, re-throw the last compression error
            throw lastCompressionError || new Error('Video compression failed and original file is also invalid');
          }
        } else {
          // If original file is too large, proceed with upload as is
          console.warn(`VideoCompressionService: Original file (${originalSizeMB.toFixed(2)}MB) is too large, but attempting to upload as is.`);
          try {
            // Validate original file and copy to permanent storage
            await validateCompressedVideo(videoUri, true); // Skip metadata check for original files
            const permanentUri = await moveCompressedFileToPermanentStorage(videoUri);
            console.log('VideoCompressionService: Original file copied to permanent location as fallback (large file):', permanentUri);
            return permanentUri;
          } catch (originalValidationError) {
            console.error('VideoCompressionService: Original file validation failed for large fallback:', originalValidationError);
            throw lastCompressionError || new Error('Video compression failed and original large file is also invalid');
          }
        }
      }

      compressedCacheUri = result;
      compressionSuccessful = true;
      console.log(`VideoCompressionService: Compression completed with ${usedStrategy} strategy, temp file:`, compressedCacheUri);

      // Progress update for file operations
      if (progressCallback) progressCallback(0.95);

      // Move to permanent storage
      const permanentUri = await moveCompressedFileToPermanentStorage(compressedCacheUri);
      
      if (progressCallback) progressCallback(1.0);
      
      console.log('VideoCompressionService: File successfully moved to permanent location:', permanentUri);
      return permanentUri;

    } catch (error) {
      console.error('VideoCompressionService: Video compression failed:', error);

      // Enhanced cleanup
      if (compressedCacheUri && compressionSuccessful) {
        try {
          const cleanupUris = [
            compressedCacheUri,
            compressedCacheUri.startsWith('file://') ? compressedCacheUri : `file://${compressedCacheUri}`,
            compressedCacheUri.replace('file://', ''),
          ];
          
          for (const uri of cleanupUris) {
            try {
              const cacheFileExists = await safeFileCheck(uri);
              if (cacheFileExists.exists) {
                await FileSystem.deleteAsync(uri, { idempotent: true });
                console.log('VideoCompressionService: Cleaned up cache file after error:', uri);
                break;
              }
            } catch (cleanupAttemptError) {
              continue;
            }
          }
        } catch (cleanupError) {
          console.warn('VideoCompressionService: Failed to cleanup cache file after error:', cleanupError);
        }
      }

      // Enhanced error handling with device-specific messages
      let userMessage = 'Failed to compress video. Please try again.';
      
      if (error.message) {
        if (error.message.includes('0xffffec77') || error.message.includes('codec') || error.message.includes('hardware')) {
          const deviceCapabilities = getDeviceCapabilities();
          if (deviceCapabilities.isOldAndroid) {
            userMessage = 'Video compression is not supported on this older device. Please try recording a shorter video or use a different device.';
          } else {
            userMessage = 'This video format is not supported by your device. Please try a different video or record a new one.';
          }
        } else if (error.message.includes('strategies failed')) {
          userMessage = 'Unable to compress this video. Please try a shorter video or record at a lower quality.';
        } else if (error.message.includes('validation') || error.message.includes('metadata') || error.message.includes('invalid')) {
          userMessage = 'The video file appears to be corrupted or in an unsupported format. Please try a different video.';
        } else if (error.message.includes('does not exist')) {
          userMessage = 'Video file not found. Please select the video again.';
        } else if (error.message.includes('storage') || error.message.includes('space')) {
          userMessage = 'Not enough storage space available. Please free up some space and try again.';
        } else if (error.message.includes('permission')) {
          userMessage = 'Storage permission required. Please check app permissions in device settings.';
        } else if (error.message.includes('directory')) {
          userMessage = 'Unable to access storage. Please restart the app and try again.';
        } else if (error.message.includes('cancel')) {
          Alert.alert('Cancelled', 'Video compression was cancelled.');
          return null;
        }
      }
      
      Alert.alert('Compression Error', userMessage);
      throw error;
    }
  },

  // Enhanced info methods
  async getCompressionInfo(videoUri) {
    try {
      const analysis = await analyzeVideoForCompression(videoUri);
      return {
        ...analysis,
        platform: Platform.OS,
        platformVersion: Platform.Version,
      };
    } catch (error) {
      console.error('VideoCompressionService: Error getting compression info:', error);
      return { 
        error: error.message,
        platform: Platform.OS,
        platformVersion: Platform.Version,
      };
    }
  },

  cancelCompression() {
    console.log('VideoCompressionService: Compression cancellation requested.');
  },

  async getStorageInfo() {
    try {
      const storageDir = await getBestStorageDirectory();
      const dirInfo = await FileSystem.getInfoAsync(storageDir);
      
      return {
        directory: storageDir,
        exists: dirInfo.exists,
        platform: Platform.OS,
        isAccessible: true,
      };
    } catch (error) {
      console.error('VideoCompressionService: Error getting storage info:', error);
      return {
        directory: null,
        exists: false,
        platform: Platform.OS,
        isAccessible: false,
        error: error.message,
      };
    }
  },
};

export default VideoCompressionService;