import { Ionicons } from '@expo/vector-icons';
import { CameraView, PermissionStatus, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../utils/i18n';

// --- Types ---
interface RecordingData {
  uri: string;
  savedToGallery?: boolean;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

// --- Constants ---
const RECORDING_DURATION = 30000; // 30 seconds in milliseconds
const MIN_STORAGE_REQUIRED = 50 * 1024 * 1024; // 50MB
// const MAX_VIDEO_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_VIDEO_AGE = 5 * 60 * 60 * 1000; // 5 hours

const COUNTDOWN_START = 5; // Show big countdown from 5 seconds

// --- Utility Functions ---
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getVideoDirectory = () => `${FileSystem.documentDirectory}videofiles/`;

const initializeVideoDirectory = async (): Promise<string> => {
  const directory = getVideoDirectory();
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    console.log(`Video directory initialized: ${directory}`);
    return directory;
  } catch (error) {
    console.error('Failed to initialize video directory:', error);
    throw new Error('Failed to create video storage directory');
  }
};

const cleanupOldVideos = async (): Promise<void> => {
  const directory = getVideoDirectory();
  try {
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) return;

    const files = await FileSystem.readDirectoryAsync(directory);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = `${directory}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists && fileInfo.modificationTime) {
        const fileAge = now - (fileInfo.modificationTime * 1000);
        if (fileAge > MAX_VIDEO_AGE) {
          await FileSystem.deleteAsync(filePath);
          console.log(`Deleted old video: ${file}`);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup old videos:', error);
  }
};

const checkStorageSpace = async (): Promise<boolean> => {
  try {
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    return freeSpace > MIN_STORAGE_REQUIRED;
  } catch (error) {
    console.warn('Could not check storage space:', error);
    return true; // Assume we have space if we can't check
  }
};

const validateVideoFile = async (uri: string, maxRetries = 10): Promise<boolean> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log(`Video file validated: ${uri} (${fileInfo.size} bytes)`);
        return true;
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.min(500 * Math.pow(2, attempt), 3000);
      await sleep(waitTime);
    } catch (error) {
      console.warn(`File validation attempt ${attempt + 1} failed:`, error);
    }
  }
  
  console.error(`Video file validation failed after ${maxRetries} attempts: ${uri}`);
  return false;
};

// --- Main Component ---
const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  // Permission hooks
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();

  // State
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(RECORDING_DURATION / 1000);
  const [showBigCountdown, setShowBigCountdown] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Router
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fromCameraUpload } = params;

  // Check if all permissions are granted
  const allPermissionsGranted = 
    cameraPermission?.granted && 
    microphonePermission?.granted && 
    mediaLibraryPermission?.granted;

  // --- Effects ---
  useEffect(() => {
    const initialize = async () => {
      try {
        // Request permissions if needed
        if (cameraPermission?.status === PermissionStatus.UNDETERMINED) {
          await requestCameraPermission();
        }
        if (microphonePermission?.status === PermissionStatus.UNDETERMINED) {
          await requestMicrophonePermission();
        }
        if (mediaLibraryPermission?.status === PermissionStatus.UNDETERMINED) {
          await requestMediaLibraryPermission();
        }

        // Initialize storage
        await initializeVideoDirectory();
        await cleanupOldVideos();
      } catch (error) {
        console.error('Initialization failed:', error);
        Alert.alert(
          t('alerts.error'),
          t('cameraScreen.alertFailedToStartCamera')
        );
      }
    };

    initialize();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  // Handle big countdown animation
  useEffect(() => {
    if (showBigCountdown) {
      Animated.sequence([
        Animated.timing(scaleAnim, { 
          toValue: 1.3, 
          duration: 150, 
          useNativeDriver: true 
        }),
        Animated.timing(scaleAnim, { 
          toValue: 1, 
          duration: 150, 
          useNativeDriver: true 
        }),
      ]).start();
    }
  }, [countdown, showBigCountdown, scaleAnim]);

  // --- Handlers ---
  const startCountdown = useCallback(() => {
    setCountdown(RECORDING_DURATION / 1000);
    
    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        const newValue = prev - 1;
        
        // Show big countdown for last few seconds
        if (newValue <= COUNTDOWN_START && newValue > 0) {
          setShowBigCountdown(true);
        } else if (newValue <= 0) {
          setShowBigCountdown(false);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          return 0;
        }
        
        return newValue;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setShowBigCountdown(false);
  }, []);

  const processVideo = useCallback(async (videoUri: string): Promise<void> => {
    setIsProcessing(true);
    
    try {
      console.log('Processing video:', videoUri);
      
      // Validate the video file
      const isValid = await validateVideoFile(videoUri);
      if (!isValid) {
        throw new Error('Video file is invalid or corrupted');
      }

      // Save to media library if permission granted
      let savedToGallery = false;
      if (mediaLibraryPermission?.granted) {
        try {
          await MediaLibrary.saveToLibraryAsync(videoUri);
          savedToGallery = true;
          console.log('Video saved to gallery');
        } catch (error) {
          console.warn('Failed to save video to gallery:', error);
        }
      }

      // Handle completion
      const recordingData: RecordingData = { uri: videoUri, savedToGallery };
      
      if (onRecordingComplete) {
        onRecordingComplete(recordingData);
      } else {
        router.replace({
          pathname: '/CameraUpload',
          params: {
            videoUri: videoUri,
            savedToGallery: savedToGallery.toString(),
          },
        });
      }
    } catch (error) {
      console.error('Video processing failed:', error);
      Alert.alert(
        t('alerts.error'),
        t('alerts.trimmingErrorMessageGeneric')
      );
      
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [mediaLibraryPermission?.granted, onRecordingComplete, router]);

  const handleRecordingComplete = useCallback(async (data: any) => {
    console.log('Recording completed:', data);
    
    setIsRecording(false);
    stopCountdown();
    
    if (data?.uri) {
      await processVideo(data.uri);
    } else {
      console.error('No video URI received');
      Alert.alert(
        t('cameraScreen.recordingErrorTitle'),
        t('videoUploadInterface.alertInvalidUri')
      );
      
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    }
  }, [processVideo, onRecordingComplete, stopCountdown]);

  const startRecording = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isRecording || isProcessing) {
      return;
    }

    // Check storage space
    const hasSpace = await checkStorageSpace();
    if (!hasSpace) {
      Alert.alert(
        t('cameraScreen.lowStorageTitle') || 'Low Storage',
        t('cameraScreen.lowStorageMessage') || 'Not enough storage space to record video'
      );
      return;
    }

    // Check permissions
    if (!allPermissionsGranted) {
      Alert.alert(
        t('cameraScreen.permissionRequiredTitle') || 'Permission Required',
        t('cameraScreen.cameraMicPermissionMessage') || 'Camera and microphone permissions are required'
      );
      return;
    }

    try {
      console.log('Starting video recording...');
      setIsRecording(true);
      startCountdown();

      // Use expo-camera's built-in duration option for auto-stop
      const recordingOptions = {
        maxDuration: RECORDING_DURATION / 1000, // Convert to seconds
        quality: '720p' as const,
      };

      // This will automatically stop after maxDuration
      const result = await cameraRef.current.recordAsync(recordingOptions);
      await handleRecordingComplete(result);
      
    } catch (error) {
      console.error('Recording failed:', error);
      setIsRecording(false);
      stopCountdown();
      
      Alert.alert(
        t('cameraScreen.recordingErrorTitle') || 'Recording Error',
        t('cameraScreen.recordingErrorMessage') || `Failed to record video: ${error.message}`
      );
    }
  }, [
    isCameraReady, 
    isRecording, 
    isProcessing, 
    allPermissionsGranted, 
    startCountdown, 
    handleRecordingComplete, 
    stopCountdown
  ]);

  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) {
      return;
    }

    try {
      console.log('Stopping recording manually...');
      cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  }, [isRecording]);

  const toggleFacing = useCallback(() => {
    if (isRecording) return;
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, [isRecording]);

  const toggleFlash = useCallback(() => {
    if (isRecording) return;
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  }, [isRecording]);

  const handleBackPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    
    if (fromCameraUpload === 'true') {
      router.replace('/CameraUpload');
    } else if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  }, [isRecording, fromCameraUpload, onCancel, router, stopRecording]);

  const handleRecordButtonPress = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // --- Render Permission Screen ---
  if (!allPermissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          {t('cameraScreen.permissionExplanation') || 'Camera, microphone, and media library permissions are required to record videos.'}
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
            {t('cameraScreen.grantPermissionsButton') || 'Grant Permissions'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- Render Camera Screen ---
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode="video"
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(error) => {
          console.error('Camera mount error:', error);
          Alert.alert(
            t('cameraScreen.cameraErrorTitle') || 'Camera Error',
            t('cameraScreen.cameraErrorMessage') || `Failed to initialize camera: ${error.message}`
          );
        }}
      >
        {/* Processing Overlay */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <Text style={styles.processingText}>
              {t('cameraScreen.processing') || 'Processing video...'}
            </Text>
          </View>
        )}

        {/* Big Countdown */}
        {showBigCountdown && (
          <View style={styles.bigCountdownContainer} pointerEvents="none">
            <Animated.Text 
              style={[
                styles.bigCountdownText, 
                { transform: [{ scale: scaleAnim }] }
              ]}
            >
              {countdown}
            </Animated.Text>
          </View>
        )}

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBackPress}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>

          {isRecording ? (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}s</Text>
            </View>
          ) : (
            <View style={styles.topActionsContainer}>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
                <Ionicons 
                  name={flash === 'on' ? 'flash' : 'flash-off'} 
                  size={24} 
                  color="white" 
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
                <Ionicons name="camera-reverse" size={24} color="white" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              (!isCameraReady || isProcessing) && styles.recordButtonDisabled,
            ]}
            onPress={handleRecordButtonPress}
            disabled={!isCameraReady || isProcessing}
          >
            <View 
              style={[
                styles.recordButtonInner, 
                isRecording && styles.recordButtonInnerActive
              ]} 
            />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

// --- Styles ---
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
    lineHeight: 24,
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
    zIndex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
  },
  topActionsContainer: {
    flexDirection: 'row',
    gap: 12,
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
    zIndex: 1,
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