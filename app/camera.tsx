import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../utils/i18n'; // Import t
// Import the actual VideoCompressionService
import VideoCompressionService from '../services/videoCompressionService';

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

// Initializes the directory where videos will be stored.
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

// Deletes video files older than a specified age (default is 7 days).
const cleanupOldVideos = async (maxAge = 7 * 24 * 60 * 60 * 1000) => { // 7 days
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

// Checks available disk space.
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

const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>(t('cameraScreen.processing'));
  const [countdown, setCountdown] = useState<number>(30);
  const cameraRef = useRef<CameraView>(null);
  // Fix: Use ReturnType<typeof setInterval> for cross-platform compatibility
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // --- Effects ---

  useEffect(() => {
    (async () => {
      try {
        console.log('LOG: Requesting permissions...');
        await requestCameraPermission();
        await requestMicrophonePermission();
        await requestMediaLibraryPermission();
        await initializeVideoFilesDirectory();
        await cleanupOldVideos();
        console.log('LOG: Initialization complete');
      } catch (error) {
        console.error('ERROR: Initialization failed:', error);
      }
    })();
  }, [requestCameraPermission, requestMicrophonePermission, requestMediaLibraryPermission]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // --- Recording Logic ---
  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);
    let tempUri: string | null = null;
    
    try {
      console.log(`LOG: Processing video URI: ${originalUri}`);
      setProcessingText(t('cameraScreen.preparingVideo'));

      // Verify the original file exists and has content
      const originalFileInfo = await FileSystem.getInfoAsync(originalUri, { size: true });
      if (!originalFileInfo.exists || !originalFileInfo.size || originalFileInfo.size === 0) {
        throw new Error(`Invalid original video file. Size: ${originalFileInfo.exists ? originalFileInfo.size : 'File does not exist'}`);
      }

      console.log(`LOG: Original video file verified. Size: ${originalFileInfo.size} bytes`);

      const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
      await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });

      // Create a copy in our app directory
      setProcessingText(t('cameraScreen.copyingVideo'));
      tempUri = `${videoFilesDirectory}temp_video_${Date.now()}.mp4`;
      await FileSystem.copyAsync({ from: originalUri, to: tempUri });
      
      // Verify the copied file
      const copiedFileInfo = await FileSystem.getInfoAsync(tempUri, { size: true });
      if (!copiedFileInfo.exists || !copiedFileInfo.size || copiedFileInfo.size === 0) {
        throw new Error(`Failed to copy video file properly. Copied file size: ${copiedFileInfo.exists ? copiedFileInfo.size : 'N/A'}`);
      }

      console.log(`LOG: Video copied successfully. Size: ${copiedFileInfo.size} bytes`);

      // Compress the video
      setProcessingText(t('cameraScreen.compressingVideo'));
      let finalUri: string;
      
      try {
        const compressedUri = await VideoCompressionService.createCompressedCopy(tempUri);
        
        // Handle the case where compression returns null
        if (compressedUri === null) {
          console.warn('WARN: Video compression returned null, using original');
          finalUri = tempUri;
          tempUri = null; // Don't delete since we're using it
        } else {
          finalUri = compressedUri;
          console.log(`LOG: Compression successful. Final URI: ${finalUri}`);
          
          // Clean up temp file if compression created a new file
          if (finalUri !== tempUri) {
            await FileSystem.deleteAsync(tempUri, { idempotent: true });
            tempUri = null; // Set to null since we've cleaned it up
          }
        }
      } catch (compressionError) {
        console.warn('WARN: Video compression failed, using original:', compressionError);
        finalUri = tempUri;
        tempUri = null; // Don't delete since we're using it
      }

      // Final verification
      const finalFileInfo = await FileSystem.getInfoAsync(finalUri, { size: true });
      if (!finalFileInfo.exists || !finalFileInfo.size || finalFileInfo.size === 0) {
        throw new Error(`Final video file is invalid. Size: ${finalFileInfo.exists ? finalFileInfo.size : 'N/A'}`);
      }

      console.log(`LOG: Final video ready. URI: ${finalUri}, Size: ${finalFileInfo.size} bytes`);

      // Save to Media Library if permission is granted
      if (mediaLibraryPermission?.granted) {
        try {
          await MediaLibrary.saveToLibraryAsync(finalUri);
          console.log('LOG: Video saved to Media Library.');
        } catch (mediaLibraryError: any) {
          console.warn('WARN: Failed to save video to Media Library:', mediaLibraryError.message);
          Alert.alert(t('cameraScreen.saveToGalleryErrorTitle'), t('cameraScreen.saveToGalleryErrorMessage'));
        }
      }

      setProcessingText(t('cameraScreen.finalizing'));
      await sleep(200); // Small delay for UI feedback

      // Navigate or callback
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
      
      // Clean up temp file if it exists
      if (tempUri) {
        try {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        } catch (cleanupError) {
          console.warn('WARN: Failed to cleanup temp file:', cleanupError);
        }
      }
      
      Alert.alert(t('cameraScreen.alertUploadFailed'), t('cameraScreen.alertUploadFailedMessage', { message: error.message }));
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
      setProcessingText('Processing...');
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert(t('cameraScreen.cameraNotReadyTitle'), t('cameraScreen.cameraNotReadyMessage'));
      return;
    }
    if (recording) return;

    const availableSpace = await checkStorageSpace();
    if (availableSpace !== null && availableSpace < 50 * 1024 * 1024) { // 50MB threshold
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
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Improved recording options
    const recordingOptions = {
      maxDuration: 30,
      quality: 'high' as const, // Changed from 'SD' to 'high'
      mute: false,
      videoCodec: 'h264' as const,
      audioCodec: 'aac' as const,
    };

    try {
      console.log('LOG: Starting recording...');
      const data = await cameraRef.current.recordAsync(recordingOptions);
      
      if (!data?.uri) {
        throw new Error('No URI returned from camera recording');
      }
      
      console.log(`LOG: Recording completed. URI: ${data.uri}`);
      
      // Wait a moment for the file to be fully written
      await sleep(1000);
      
      // Process the video directly without MediaLibrary first
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
      setCountdown(30);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      console.log('LOG: Manually stopping video recording...');
      cameraRef.current.stopRecording();
      
      // Clear the countdown interval when manually stopping
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Reset the recording state and countdown
      setRecording(false);
      setCountdown(30);
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
      router.replace('/(tabs)/post');
    }
  };

  // --- Render Logic ---

  if (!cameraPermission || !microphonePermission || !mediaLibraryPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>{t('cameraScreen.loadingPermissions')}</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !microphonePermission.granted || !mediaLibraryPermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          {t('cameraScreen.permissionExplanation')}
        </Text>
        <TouchableOpacity
          onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
            await requestMediaLibraryPermission();
          }}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>{t('cameraScreen.grantPermissionsButton')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cameraScreen.recordVideo')}</Text>
      </View>

      <CameraView
        style={styles.camera}
        ref={cameraRef}
        mode="video"
        facing="back"
        onCameraReady={() => {
          console.log('LOG: Camera is ready.');
          setIsCameraReady(true);
        }}
      />

      <View style={styles.controlsContainer}>
        {recording && (
          <Text style={styles.timerText}>0:{String(countdown).padStart(2, '0')}</Text>
        )}
        <TouchableOpacity
          style={[styles.button, (!isCameraReady || isProcessing) && styles.disabledButton]}
          onPress={handleRecordButtonPress}
          disabled={!isCameraReady || isProcessing}
        >
          <Ionicons
            name={recording ? 'stop-circle' : 'radio-button-on'}
            size={80}
            color={recording ? 'red' : (isCameraReady ? 'white' : 'grey')}
          />
        </TouchableOpacity>
      </View>

      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>{t('cameraScreen.recording')}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1,
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 44, // Offset for the back button to center the title
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  timerText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  permissionText: {
    textAlign: 'center',
    color: 'white',
    paddingHorizontal: 20,
    fontSize: 16,
  },
  permissionButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007BFF',
    borderRadius: 5,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  processingText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default CameraRecord;