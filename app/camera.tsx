// app/camera.tsx - Complete fixed version with compression handling and file management
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VideoCompressionService from '../services/videoCompressionService';
import { t } from '../utils/i18n';

// Define interfaces for better type safety
interface RecordingData {
  uri: string;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

// Helper function to introduce a short delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Utility Functions ---
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    console.log(`LOG: videofiles directory initialized: ${videoFilesDirectory}`);
    return videoFilesDirectory;
  } catch (error: any) {
    console.error('ERROR: Failed to initialize videofiles directory:', error.message);
    throw error;
  }
};

const cleanupOldVideos = async (maxAge = 7 * 24 * 60 * 60 * 1000) => {
  const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
  try {
    console.log('LOG: Starting cleanup of old videos...');
    const dirInfo = await FileSystem.getInfoAsync(videoFilesDirectory);
    if (!dirInfo.exists) {
      console.log('LOG: videofiles directory does not exist, skipping cleanup.');
      return;
    }
    
    const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
    for (const file of files) {
      const filePath = `${videoFilesDirectory}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath, { md5: false, size: false });

      if (fileInfo.exists && fileInfo.modificationTime && (Date.now() - (fileInfo.modificationTime * 1000)) > maxAge) {
        console.log(`LOG: Deleting old video file: ${filePath}`);
        await FileSystem.deleteAsync(filePath);
      }
    }
    console.log('LOG: Cleanup complete.');
  } catch (error: any) {
    console.error('ERROR: Cleanup failed:', error.message);
  }
};

const checkStorageSpace = async () => {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    console.log(`LOG: Available storage: ${Math.round(freeDiskStorage / (1024 * 1024))} MB`);
    return freeDiskStorage;
  } catch (error: any) {
    console.error('ERROR: Could not check storage:', error.message);
    return null;
  }
};

// Enhanced file verification function with longer delays for compression
const verifyFileExists = async (uri: string, maxRetries = 5, delayMs = 500): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log(`LOG: File verified (attempt ${i + 1}): ${uri}, size: ${fileInfo.size}`);
        return true;
      }
    } catch (error) {
      console.warn(`WARN: File verification attempt ${i + 1} failed:`, error);
    }
    
    if (i < maxRetries - 1) {
      console.log(`LOG: Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }
  }
  return false;
};

const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  // Permission hooks
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>(t('cameraScreen.processing'));
  const [countdown, setCountdown] = useState<number>(30);
  const [showBigCountdown, setShowBigCountdown] = useState<boolean>(false);
  const [bigCountdownValue, setBigCountdownValue] = useState<number>(5);
  const [videoFilesDirectory, setVideoFilesDirectory] = useState<string>('');
  
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  
  // Animated value for the big countdown animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // --- Effects ---
  useEffect(() => {
    (async () => {
      try {
        console.log('LOG: Requesting permissions...');
        await requestCameraPermission();
        await requestMicrophonePermission();
        await requestMediaLibraryPermission();
        const directory = await initializeVideoFilesDirectory();
        setVideoFilesDirectory(directory);
        await cleanupOldVideos();
        console.log('LOG: Initialization complete');
      } catch (error) {
        console.error('ERROR: Initialization failed:', error);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Animation effect for big countdown
  useEffect(() => {
    if (showBigCountdown) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [bigCountdownValue, showBigCountdown]);

  // Enhanced copy function with better error handling
  const copyRecordedFile = async (originalUri: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recording_${timestamp}.mp4`;
    const targetUri = `${videoFilesDirectory}${fileName}`;
    
    console.log(`LOG: Copying recorded file from ${originalUri} to ${targetUri}`);
    
    // Verify original file exists first
    const originalExists = await verifyFileExists(originalUri, 3, 200);
    if (!originalExists) {
      throw new Error(`Original recorded file does not exist or is empty: ${originalUri}`);
    }
    
    // Copy the file immediately while it still exists
    await FileSystem.copyAsync({ 
      from: originalUri, 
      to: targetUri 
    });
    
    // Verify the copy was successful with retries
    const copyExists = await verifyFileExists(targetUri, 3, 200);
    if (!copyExists) {
      throw new Error(`Failed to copy recorded file to target directory: ${targetUri}`);
    }
    
    console.log(`LOG: File copied successfully to: ${targetUri}`);
    return targetUri;
  };

  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);
    let copiedUri: string | null = null;
    
    try {
      console.log(`LOG: Processing video URI: ${originalUri}`);
      setProcessingText(t('cameraScreen.preparingVideo'));

      // Step 1: Copy the original file to our managed directory
      try {
        copiedUri = await copyRecordedFile(originalUri);
        console.log(`LOG: File successfully copied to managed directory: ${copiedUri}`);
      } catch (copyError: any) {
        console.error('ERROR: Failed to copy recorded file:', copyError.message);
        throw new Error(`Failed to copy recorded file: ${copyError.message}`);
      }

      // Step 2: Attempt compression with better error handling
      setProcessingText(t('cameraScreen.compressingVideo'));
      let finalUri: string = copiedUri; // Default to copied file
      
      try {
        console.log(`LOG: Starting compression for: ${copiedUri}`);
        const compressedUri = await VideoCompressionService.createCompressedCopy(copiedUri, {
          progressCallback: (progress) => {
            // Update UI with compression progress
            const percentage = Math.round(progress * 100);
            console.log(`LOG: Compression progress: ${percentage}%`);
            setProcessingText(`${t('cameraScreen.compressingVideo')} ${percentage}%`);
          },
          maxSizeMB: 15,
          minFileSizeForCompression: 1, // Only compress files larger than 1MB
        });
        
        if (compressedUri === null) {
          console.warn('WARN: Video compression failed, using original copy');
          // finalUri remains as copiedUri (original copy)
        } else if (compressedUri === copiedUri) {
          console.log('LOG: Compression was skipped (file too small or disabled), using original');
          // finalUri remains as copiedUri (original copy)
        } else {
          // Compression was successful and created a new file
          // Verify the compressed file exists with extended retry (up to 5 seconds for compression)
          const compressedExists = await verifyFileExists(compressedUri, 10, 500);
          if (compressedExists) {
            console.log(`LOG: Compression successful. Using compressed file: ${compressedUri}`);
            finalUri = compressedUri;
            
            // Clean up the uncompressed copy since we have a compressed version
            try {
              await FileSystem.deleteAsync(copiedUri, { idempotent: true });
              console.log(`LOG: Cleaned up uncompressed file: ${copiedUri}`);
              copiedUri = null; // Mark as cleaned up
            } catch (cleanupError) {
              console.warn('WARN: Failed to cleanup uncompressed file:', cleanupError);
            }
          } else {
            console.warn(`WARN: Compressed file does not exist or is invalid: ${compressedUri}`);
            console.warn('WARN: Using original copied file instead');
            // Try to clean up the failed compressed file
            try {
              await FileSystem.deleteAsync(compressedUri, { idempotent: true });
            } catch (cleanupError) {
              console.warn('WARN: Failed to cleanup failed compressed file:', cleanupError);
            }
            // finalUri remains as copiedUri (original copy)
          }
        }
      } catch (compressionError: any) {
        console.warn('WARN: Video compression failed with exception, using original copy:', compressionError.message);
        // finalUri remains as copiedUri (original copy)
      }

      // Step 3: Final verification
      const finalExists = await verifyFileExists(finalUri, 3, 200);
      if (!finalExists) {
        throw new Error(`Final video file is invalid or does not exist: ${finalUri}`);
      }

      const finalFileInfo = await FileSystem.getInfoAsync(finalUri, { size: true });
      console.log(`LOG: Final video ready. URI: ${finalUri}, Size: ${finalFileInfo.size} bytes`);

      // Step 4: Save to media library
      if (mediaLibraryPermission?.granted) {
        try {
          setProcessingText(t('cameraScreen.savingToGallery') || 'Saving to gallery...');
          await MediaLibrary.saveToLibraryAsync(finalUri);
          console.log('LOG: Video saved to Media Library.');
        } catch (mediaLibraryError: any) {
          console.warn('WARN: Failed to save video to Media Library:', mediaLibraryError.message);
          Alert.alert(t('cameraScreen.saveToGalleryErrorTitle'), t('cameraScreen.saveToGalleryErrorMessage'));
        }
      }

      setProcessingText(t('cameraScreen.finalizing'));
      await sleep(200);

      // Step 5: Complete processing
      if (onRecordingComplete) {
        onRecordingComplete({ uri: finalUri });
      } else {
        router.replace({
          pathname: '/CameraUpload',
          params: { 
            videoUri: finalUri, 
            videoName: `recorded_video_${Date.now()}.mp4`, 
            videoType: 'video/mp4' 
          },
        });
      }
    } catch (error: any) {
      console.error('ERROR: Failed to process video:', error);
      
      // Clean up any leftover files
      if (copiedUri) {
        try {
          await FileSystem.deleteAsync(copiedUri, { idempotent: true });
          console.log(`LOG: Cleaned up copied file after error: ${copiedUri}`);
        } catch (cleanupError) {
          console.warn('WARN: Failed to cleanup copied file after error:', cleanupError);
        }
      }
      
      Alert.alert(t('cameraScreen.alertUploadFailed'), t('cameraScreen.alertUploadFailedMessage', { message: error.message }));
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
      setProcessingText(t('cameraScreen.processing'));
    }
  };

  const startRecording = async () => {
    console.log(`LOG: startRecording called - cameraRef: ${!!cameraRef.current}, isCameraReady: ${isCameraReady}, recording: ${recording}`);
    
    if (!cameraRef.current) {
      console.error('ERROR: Camera ref is null');
      Alert.alert(t('cameraScreen.cameraNotReadyTitle'), 'Camera reference is not available');
      return;
    }
    
    if (!isCameraReady) {
      console.error('ERROR: Camera is not ready');
      Alert.alert(t('cameraScreen.cameraNotReadyTitle'), 'Camera is not ready yet. Please wait and try again.');
      return;
    }
    
    if (recording) {
      console.log('LOG: Already recording, ignoring start request');
      return;
    }

    // Check if directory is initialized
    if (!videoFilesDirectory) {
      Alert.alert('Error', 'Video directory not initialized. Please try again.');
      return;
    }

    const availableSpace = await checkStorageSpace();
    if (availableSpace !== null && availableSpace < 50 * 1024 * 1024) {
      Alert.alert(t('cameraScreen.lowStorageTitle'), t('cameraScreen.lowStorageMessage'));
      return;
    }

    if (!cameraPermission?.granted || !microphonePermission?.granted) {
      Alert.alert(t('cameraScreen.permissionRequiredTitle'), t('cameraScreen.cameraMicPermissionMessage'));
      return;
    }

    if (!mediaLibraryPermission?.granted) {
      Alert.alert(t('cameraScreen.permissionRequiredTitle'), t('cameraScreen.mediaLibraryPermissionMessage'));
      return;
    }

    setRecording(true);
    setCountdown(30);
    setShowBigCountdown(false);
    setBigCountdownValue(5);
    
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1;
        
        if (newValue <= 5 && newValue > 0) {
          setShowBigCountdown(true);
          setBigCountdownValue(newValue);
        } else if (newValue <= 0) {
          setShowBigCountdown(false);
          stopRecording();
          return 0;
        }
        
        return newValue;
      });
    }, 1000);

    const recordingOptions = {
      maxDuration: 30,
      quality: 'high' as const,
      mute: false,
      videoCodec: 'h264' as const,
      audioCodec: 'aac' as const,
    };

    try {
      console.log('LOG: Starting recording with options:', recordingOptions);
      console.log(`LOG: Camera ready state: ${isCameraReady}, Recording state: ${recording}`);
      
      const data = await cameraRef.current.recordAsync(recordingOptions);
      
      console.log('LOG: Recording promise resolved with data:', data);
      
      if (!data?.uri) {
        throw new Error('No URI returned from camera recording');
      }
      
      console.log(`LOG: Recording completed successfully. Original URI: ${data.uri}`);
      
      // Add a small delay to ensure file is fully written
      await sleep(100);
      
      // Process the video
      await processVideo(data.uri);
      
    } catch (error: any) {
      console.error('ERROR: Recording failed:', error);
      console.error('ERROR: Recording error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      Alert.alert(t('cameraScreen.recordingErrorTitle'), t('cameraScreen.recordingErrorMessage', { message: error.message }));
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRecording(false);
      setCountdown(30);
      setShowBigCountdown(false);
    }
  };

  const stopRecording = () => {
    console.log(`LOG: stopRecording called - cameraRef: ${!!cameraRef.current}, recording: ${recording}`);
    
    if (cameraRef.current && recording) {
      console.log('LOG: Manually stopping video recording...');
      cameraRef.current.stopRecording();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setRecording(false);
      setCountdown(30);
      setShowBigCountdown(false);
    } else {
      console.log('LOG: stopRecording called but not recording or no camera ref');
    }
  };

  const handleRecordButtonPress = () => recording ? stopRecording() : startRecording();

  const handleBackPress = () => {
    if (recording) {
      stopRecording();
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Check if all permissions are granted
  const allPermissionsGranted = cameraPermission?.granted && 
                                microphonePermission?.granted && 
                                mediaLibraryPermission?.granted;

  if (!allPermissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          {t('cameraScreen.permissionsRequired')}
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
            await requestMediaLibraryPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>
            {t('cameraScreen.grantPermissions')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="video"
        onCameraReady={() => {
          console.log('LOG: Camera is ready for video recording');
          setIsCameraReady(true);
        }}
        onMountError={(error) => {
          console.error('ERROR: Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera: ' + error.message);
        }}
      >
        {/* Processing overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>{processingText}</Text>
          </View>
        )}

        {/* Big countdown overlay */}
        {showBigCountdown && (
          <View style={styles.bigCountdownContainer}>
            <Animated.Text style={[styles.bigCountdownText, { transform: [{ scale: scaleAnim }] }]}>
              {bigCountdownValue}
            </Animated.Text>
          </View>
        )}

        {/* Top bar with back button and countdown */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          {recording && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              recording && styles.recordButtonActive,
              !isCameraReady && styles.recordButtonDisabled
            ]}
            onPress={handleRecordButtonPress}
            disabled={!isCameraReady || isProcessing}
          >
            <View style={[
              styles.recordButtonInner,
              recording && styles.recordButtonInnerActive
            ]} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    padding: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
  },
  countdownContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countdownText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'white',
  },
  recordButtonActive: {
    borderColor: '#ff4444',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ff4444',
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    backgroundColor: '#ff4444',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  bigCountdownContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigCountdownText: {
    fontSize: 120,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});

export default CameraRecord;