// app/camera.tsx - Complete version with robust file management and Media Library integration
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

/**
 * Initializes a dedicated directory within the app's document folder to store video files.
 * This is a persistent location, not a temporary cache.
 */
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    console.log(`LOG: 'videofiles' directory initialized: ${videoFilesDirectory}`);
    return videoFilesDirectory;
  } catch (error: any) {
    console.error('ERROR: Failed to initialize videofiles directory:', error.message);
    throw error;
  }
};

/**
 * Cleans up old video files from the app's dedicated video directory to manage storage.
 * @param maxAge The maximum age of a file in milliseconds before it's deleted. Defaults to 7 days.
 */
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

/**
 * Checks the available disk space on the device.
 */
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

/**
 * Verifies that a file exists at a given URI and is not empty. Retries several times.
 * This is crucial for handling delays in file system operations, especially after recording or compression.
 */
const verifyFileExists = async (uri: string, maxRetries = 5, delayMs = 500): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log(`LOG: File verified (attempt ${i + 1}/${maxRetries}): ${uri}, size: ${fileInfo.size}`);
        return true;
      }
    } catch (error) {
      console.warn(`WARN: File verification attempt ${i + 1} failed:`, error);
    }
    
    if (i < maxRetries - 1) {
      console.log(`LOG: File not ready, waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }
  }
  console.error(`ERROR: File verification failed after ${maxRetries} attempts for URI: ${uri}`);
  return false;
};

const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  // Permission hooks
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions({ writeOnly: true });
  
  // State hooks
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>(t('cameraScreen.processing'));
  const [countdown, setCountdown] = useState<number>(30);
  const [showBigCountdown, setShowBigCountdown] = useState<boolean>(false);
  const [bigCountdownValue, setBigCountdownValue] = useState<number>(5);
  const [videoFilesDirectory, setVideoFilesDirectory] = useState<string>('');
  
  // Refs
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  
  // Animated value for the big countdown animation
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // --- Effects ---
  useEffect(() => {
    (async () => {
      try {
        console.log('LOG: Initializing component...');
        await requestCameraPermission();
        await requestMicrophonePermission();
        await requestMediaLibraryPermission();
        const directory = await initializeVideoFilesDirectory();
        setVideoFilesDirectory(directory);
        await cleanupOldVideos();
        console.log('LOG: Initialization complete.');
      } catch (error) {
        console.error('ERROR: Initialization failed:', error);
        Alert.alert('Initialization Error', 'Failed to set up the camera environment.');
      }
    })();
  }, []);

  useEffect(() => {
    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Animation effect for the big countdown
  useEffect(() => {
    if (showBigCountdown) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [bigCountdownValue, showBigCountdown]);

  /**
   * Copies the recorded video from its temporary location to our app's persistent document directory.
   * This is a critical step to prevent the OS from deleting the file before we can process it.
   */
  const copyRecordedFile = async (originalUri: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recording_${timestamp}.mp4`;
    const targetUri = `${videoFilesDirectory}${fileName}`;
    
    console.log(`LOG: Copying recorded file from temporary location ${originalUri} to persistent location ${targetUri}`);
    
    // First, verify the original file from the camera exists.
    // This is the critical fix: we give the system more time (up to 3 seconds) to
    // finish writing the file to the cache after recording stops, especially in the auto-stop case.
    const originalExists = await verifyFileExists(originalUri, 10, 300);
    if (!originalExists) {
      throw new Error(`Original recorded file does not exist or is empty: ${originalUri}`);
    }
    
    // Perform the copy
    await FileSystem.copyAsync({ from: originalUri, to: targetUri });
    
    // Second, verify the copy was successful
    const copyExists = await verifyFileExists(targetUri, 3, 200);
    if (!copyExists) {
      throw new Error(`Failed to copy recorded file to target directory: ${targetUri}`);
    }
    
    console.log(`LOG: File copied successfully to: ${targetUri}`);
    return targetUri;
  };

  /**
   * Handles the entire post-recording process: copying, compressing, and saving to the Media Library.
   */
  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);
    let copiedUri: string | null = null;
    
    try {
      console.log(`LOG: Processing video from temporary URI: ${originalUri}`);
      setProcessingText(t('cameraScreen.preparingVideo'));

      // Step 1: Secure the file by copying it to our managed directory.
      copiedUri = await copyRecordedFile(originalUri);
      
      // Step 2: Attempt to compress the secured copy.
      setProcessingText(t('cameraScreen.compressingVideo'));
      let finalUri: string = copiedUri; // Default to the uncompressed copy
      
      try {
        const compressedUri = await VideoCompressionService.createCompressedCopy(copiedUri, {
          progressCallback: (progress) => {
            const percentage = Math.round(progress * 100);
            setProcessingText(`${t('cameraScreen.compressingVideo')} ${percentage}%`);
          },
          maxSizeMB: 15,
          minFileSizeForCompression: 1,
        });
        
        if (compressedUri && compressedUri !== copiedUri) {
          // Verify the new compressed file exists before using it
          const compressedExists = await verifyFileExists(compressedUri, 10, 500);
          if (compressedExists) {
            console.log(`LOG: Compression successful. Using compressed file: ${compressedUri}`);
            finalUri = compressedUri;
            // Clean up the larger, uncompressed file
            await FileSystem.deleteAsync(copiedUri, { idempotent: true });
            console.log(`LOG: Cleaned up uncompressed file: ${copiedUri}`);
            copiedUri = null; // Mark as cleaned up
          } else {
            console.warn(`WARN: Compressed file is invalid. Using original copy.`);
          }
        } else {
           console.log('LOG: Compression skipped or failed, using original copy.');
        }
      } catch (compressionError: any) {
        console.warn('WARN: Video compression threw an exception, using original copy:', compressionError.message);
      }

      // Step 3: Verify the final file (either compressed or the original copy) is valid.
      const finalExists = await verifyFileExists(finalUri, 3, 200);
      if (!finalExists) {
        throw new Error(`Final video file is invalid or does not exist: ${finalUri}`);
      }

      // Step 4: Save the final video to the device's Media Library (Gallery).
      if (mediaLibraryPermission?.granted) {
        try {
          setProcessingText(t('cameraScreen.finalizing') || 'Saving to gallery...');
          await MediaLibrary.saveToLibraryAsync(finalUri);
          console.log('LOG: Video saved to Media Library successfully.');
        } catch (mediaLibraryError: any) {
          console.warn('WARN: Failed to save video to Media Library:', mediaLibraryError.message);
          Alert.alert(t('cameraScreen.saveToGalleryErrorTitle'), t('cameraScreen.saveToGalleryErrorMessage'));
        }
      } else {
        console.warn('WARN: Media Library permission not granted. Cannot save to gallery.');
      }

      setProcessingText(t('cameraScreen.finalizing'));
      await sleep(200);

      // Step 5: Pass the final URI to the callback or navigate.
      if (onRecordingComplete) {
        onRecordingComplete({ uri: finalUri });
      } else {
        router.replace({
          pathname: '/CameraUpload',
          params: { videoUri: finalUri },
        });
      }
    } catch (error: any) {
      console.error('ERROR: Failed to process video:', error);
      if (copiedUri) {
        await FileSystem.deleteAsync(copiedUri, { idempotent: true });
      }
      Alert.alert(t('cameraScreen.alertFailedUpload'), t('cameraScreen.alertFailedUpload', { message: error.message }));
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
      setProcessingText(t('cameraScreen.processing'));
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady || recording) {
      console.warn('WARN: Start recording called but conditions not met.');
      return;
    }

    if (!videoFilesDirectory) {
      Alert.alert('Error', 'Video directory not initialized. Please restart the app.');
      return;
    }

    const availableSpace = await checkStorageSpace();
    if (availableSpace !== null && availableSpace < 50 * 1024 * 1024) { // 50MB threshold
      Alert.alert(t('cameraScreen.lowStorageTitle'), t('cameraScreen.lowStorageMessage'));
      return;
    }

    if (!allPermissionsGranted) {
        Alert.alert(t('cameraScreen.permissionRequiredTitle'), t('cameraScreen.cameraMicPermissionMessage'));
        return;
    }

    setRecording(true);
    setCountdown(30);
    setShowBigCountdown(false);
    
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

    try {
      console.log('LOG: Starting video recording...');
      const data = await cameraRef.current.recordAsync({ maxDuration: 30 });
      await sleep(1000); 
      
      if (!data?.uri) {
        throw new Error('No URI returned from camera recording');
      }
      console.log(`LOG: Recording completed. Original temp URI: ${data.uri}`);
      
      // The explicit sleep is removed from here. The waiting logic is now
      // properly encapsulated within the verifyFileExists function.
      
      await processVideo(data.uri);
      
    } catch (error: any) {
      console.error('ERROR: Recording failed:', error);
      Alert.alert(t('cameraScreen.recordingErrorTitle'), t('cameraScreen.recordingErrorMessage', { message: error.message }));
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setRecording(false);
      setShowBigCountdown(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      console.log('LOG: Manually stopping video recording...');
      cameraRef.current.stopRecording();
    }
  };

  const handleRecordButtonPress = () => recording ? stopRecording() : startRecording();

  const handleBackPress = () => {
    if (recording) {
      stopRecording();
    }
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const allPermissionsGranted = cameraPermission?.granted && microphonePermission?.granted && mediaLibraryPermission?.granted;

  if (!allPermissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>{t('cameraScreen.permissionExplanation')}</Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
            await requestMediaLibraryPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>{t('cameraScreen.grantPermissionsButton')}</Text>
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
          console.log('LOG: Camera is ready.');
          setIsCameraReady(true);
        }}
        onMountError={(error) => {
          console.error('ERROR: Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera: ' + error.message);
        }}
      >
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>{processingText}</Text>
          </View>
        )}

        {showBigCountdown && (
          <View style={styles.bigCountdownContainer}>
            <Animated.Text style={[styles.bigCountdownText, { transform: [{ scale: scaleAnim }] }]}>
              {bigCountdownValue}
            </Animated.Text>
          </View>
        )}

        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          {recording && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[styles.recordButton, recording && styles.recordButtonActive, !isCameraReady && styles.recordButtonDisabled]}
            onPress={handleRecordButtonPress}
            disabled={!isCameraReady || isProcessing}
          >
            <View style={[styles.recordButtonInner, recording && styles.recordButtonInnerActive]} />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#ff4444',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
    zIndex: 5,
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
