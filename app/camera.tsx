import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { t } from '../utils/i18n';

// --- Interfaces and Helper Functions ---
interface RecordingData {
  uri: string;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Utility Functions ---
const initializeVideoFilesDirectory = async () => {
  try {
    // Use documentDirectory for permanent storage
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    console.log(`LOG: 'videos' directory initialized: ${videoFilesDirectory}`);
    
    // Verify directory exists and is writable
    const dirInfo = await FileSystem.getInfoAsync(videoFilesDirectory);
    if (!dirInfo.exists) {
      throw new Error('Failed to create videos directory');
    }
    
    console.log(`LOG: Videos directory confirmed: ${videoFilesDirectory}`);
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videos directory:', error.message);
    throw error;
  }
};

const cleanupOldVideos = async (maxAge = 7 * 24 * 60 * 60 * 1000) => {
  const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
  try {
    console.log('LOG: Starting cleanup of old videos...');
    const dirInfo = await FileSystem.getInfoAsync(videoFilesDirectory);
    if (!dirInfo.exists) {
      console.log('LOG: videos directory does not exist, skipping cleanup.');
      return;
    }
    
    const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
    for (const file of files) {
      const filePath = `${videoFilesDirectory}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      if (fileInfo.exists && fileInfo.modificationTime && (Date.now() - (fileInfo.modificationTime * 1000)) > maxAge) {
        console.log(`LOG: Deleting old video file: ${filePath}`);
        await FileSystem.deleteAsync(filePath);
      }
    }
    console.log('LOG: Cleanup complete.');
  } catch (error) {
    console.error('ERROR: Cleanup failed:', error.message);
  }
};

const checkStorageSpace = async () => {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    console.log(`LOG: Available storage: ${Math.round(freeDiskStorage / (1024 * 1024))} MB`);
    return freeDiskStorage;
  } catch (error) {
    console.error('ERROR: Could not check storage:', error.message);
    return null;
  }
};

// --- Component ---
const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicrophonePermission, requestPermission: requestMicrophonePermission } = useMicrophonePermission();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();

  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>(t('cameraScreen.processing'));
  const [countdown, setCountdown] = useState<number>(30);
  const [showBigCountdown, setShowBigCountdown] = useState<boolean>(false);
  const [bigCountdownValue, setBigCountdownValue] = useState<number>(5);
  const [videoFilesDirectory, setVideoFilesDirectory] = useState<string>('');
  
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [isActive, setIsActive] = useState(true);

  const device = useCameraDevice(facing);
  const cameraRef = useRef<Camera>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fromCameraUpload } = params;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      setIsActive(nextAppState === 'active');
      // Stop recording when app goes to background
      if (nextAppState !== 'active' && isRecordingRef.current) {
        stopRecording();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        console.log('LOG: Initializing component and checking permissions...');
        if (!hasCameraPermission) await requestCameraPermission();
        if (!hasMicrophonePermission) await requestMicrophonePermission();
        if (mediaLibraryPermission?.status === MediaLibrary.PermissionStatus.UNDETERMINED) await requestMediaLibraryPermission();
        
        const directory = await initializeVideoFilesDirectory();
        setVideoFilesDirectory(directory);
        await cleanupOldVideos();
        console.log('LOG: Initialization complete.');
      } catch (error) {
        console.error('ERROR: Initialization failed:', error);
        Alert.alert('Initialization Error', 'Failed to set up the camera environment.');
      }
    })();
  }, [hasCameraPermission, hasMicrophonePermission, mediaLibraryPermission, requestCameraPermission, requestMicrophonePermission, requestMediaLibraryPermission]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (isRecordingRef.current) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (showBigCountdown) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [bigCountdownValue, showBigCountdown, scaleAnim]);

  const toggleFacing = () => {
    if (recording) return;
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    if (recording) return;
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  // FIXED: Use moveFile instead of read/write for better reliability
  const moveToVideosDirectory = async (originalPath: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recording_${timestamp}.mp4`;
    const targetUri = `${videoFilesDirectory}${fileName}`;
    
    console.log(`LOG: Moving video from temp location: ${originalPath} to permanent location: ${targetUri}`);
    
    try {
      // First, verify the source file exists
      const sourceInfo = await FileSystem.getInfoAsync(originalPath);
      if (!sourceInfo.exists || sourceInfo.size === 0) {
        throw new Error(`Source file does not exist or is empty: ${originalPath}`);
      }
      
      console.log(`LOG: Source file verified. Size: ${sourceInfo.size} bytes`);

      // Use FileSystem.copyAsync which is more reliable than read/write for large files
      await FileSystem.copyAsync({
        from: originalPath,
        to: targetUri
      });
      
      // Verify the file was copied successfully
      const targetInfo = await FileSystem.getInfoAsync(targetUri);
      if (!targetInfo.exists) {
        throw new Error(`Failed to copy file to target location: ${targetUri}`);
      }
      
      console.log(`LOG: Video secured in permanent location. Size: ${targetInfo.size} bytes`);
      return targetUri;
    } catch (error) {
      console.error('ERROR: Failed to secure video:', error);
      throw new Error(`Failed to handle recorded video: ${error.message}`);
    }
  };

  const processVideo = async (permanentUri: string) => {
    try {
      if (mediaLibraryPermission?.granted) {
        try {
          setIsProcessing(true);
          setProcessingText(t('cameraScreen.finalizing') || 'Saving to gallery...');
          await MediaLibrary.saveToLibraryAsync(permanentUri);
          console.log('LOG: Video saved to Media Library successfully.');
        } catch (mediaLibraryError) {
          console.warn('WARN: Failed to save video to Media Library:', mediaLibraryError.message);
        } finally {
          setIsProcessing(false);
        }
      }

      if (onRecordingComplete) {
        onRecordingComplete({ uri: permanentUri });
      } else {
        router.replace({
          pathname: '/CameraUpload',
          params: { videoUri: permanentUri },
        });
      }
    } catch (error) {
      console.error('ERROR: Failed to process video:', error);
      Alert.alert('Processing Error', 'Failed to process the recorded video: ' + error.message);
    }
  };

  const onRecordingFinished = useCallback(async (video: any) => {
    console.log(`LOG: Recording finished. Video object:`, video);
    
    // Clear interval and reset states
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setRecording(false);
    isRecordingRef.current = false;
    setShowBigCountdown(false);
    setCountdown(30);
    
    if (!video?.path) {
      console.error('ERROR: No path returned from camera recording', video);
      Alert.alert('Recording Error', 'No video file was created');
      return;
    }
    
    const videoPath = `file://${video.path}`;
    console.log(`LOG: Video saved to: ${videoPath}`);
    
    try {
      // FIXED: Add a small delay to ensure the file is fully written
      setIsProcessing(true);
      setProcessingText(t('cameraScreen.processing') || 'Processing video...');
      
      // Give the system time to fully write the file before trying to access it
      await sleep(500);
      
      const permanentUri = await moveToVideosDirectory(videoPath);
      await processVideo(permanentUri);
    } catch (error) {
      console.error('ERROR: Failed to handle recorded video:', error);
      setIsProcessing(false);
      Alert.alert('Processing Error', 'Failed to process the recorded video: ' + error.message);
    }
  }, [videoFilesDirectory, mediaLibraryPermission, onRecordingComplete, router]);

  const onRecordingError = useCallback((error: any) => {
    console.error('ERROR: Recording failed:', error);
    
    // Clear interval and reset states
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setRecording(false);
    isRecordingRef.current = false;
    setShowBigCountdown(false);
    setCountdown(30);
    
    Alert.alert(
      t('cameraScreen.recordingErrorTitle') || 'Recording Error', 
      t('cameraScreen.recordingErrorMessage') || `Recording failed: ${error?.message || 'Unknown error'}`
    );
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current || !device || isRecordingRef.current) {
      console.log('LOG: Cannot start recording - conditions not met');
      return;
    }
    
    if (!videoFilesDirectory) {
      Alert.alert('Error', 'Video directory not initialized.');
      return;
    }
    
    const availableSpace = await checkStorageSpace();
    if (availableSpace !== null && availableSpace < 50 * 1024 * 1024) { // 50MB threshold
      Alert.alert(
        t('cameraScreen.lowStorageTitle') || 'Low Storage', 
        t('cameraScreen.lowStorageMessage') || 'Not enough storage space available'
      );
      return;
    }
    
    if (!allPermissionsGranted) {
      Alert.alert(
        t('cameraScreen.permissionRequiredTitle') || 'Permission Required', 
        t('cameraScreen.cameraMicPermissionMessage') || 'Camera and microphone permissions are required'
      );
      return;
    }

    try {
      console.log('LOG: Starting video recording...');
      
      // Set recording state
      setRecording(true);
      isRecordingRef.current = true;
      setCountdown(30);
      setShowBigCountdown(false);
      
      // FIXED: Use a local variable to track if the countdown has triggered stopRecording
      let hasStoppedRecording = false;
      
      // Start countdown timer
      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          const newValue = prev - 1;
          console.log(`LOG: Countdown: ${newValue}`);
          
          if (newValue <= 5 && newValue > 0) {
            setShowBigCountdown(true);
            setBigCountdownValue(newValue);
          } else if (newValue <= 0 && !hasStoppedRecording) {
            setShowBigCountdown(false);
            console.log('LOG: Countdown reached zero, stopping recording');
            hasStoppedRecording = true; // Prevent multiple stop calls
            stopRecording();
            return 0;
          }
          return newValue;
        });
      }, 1000);
      
      // Start camera recording
      await cameraRef.current.startRecording({
        flash: flash,
        onRecordingFinished,
        onRecordingError,
        fileType: 'mp4',
        videoBitRate: 'normal',
        videoCodec: 'h264',
      });
      
      console.log('LOG: Recording started successfully');
    } catch (error) {
      console.error('ERROR: Failed to start recording:', error);
      
      // Reset states on error
      setRecording(false);
      isRecordingRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      Alert.alert('Recording Error', `Failed to start recording: ${error.message}`);
    }
  };

  const stopRecording = async () => {
    // FIXED: Add protection against multiple stop calls
    if (!cameraRef.current || !isRecordingRef.current) {
      console.log('LOG: Cannot stop recording - not currently recording');
      return;
    }
    
    // Set isRecordingRef to false immediately to prevent multiple calls
    isRecordingRef.current = false;
    
    // Clear the interval to prevent further countdown updates
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    try {
      console.log('LOG: Manually stopping video recording...');
      await cameraRef.current.stopRecording();
      console.log('LOG: Manually stopped video recording.');
    } catch (error) {
      console.error('ERROR: Failed to stop recording:', error);
      // Reset states even if stopping fails
      setRecording(false);
    }
  };
  
  const handleRecordButtonPress = () => {
    if (isProcessing) return;
    recording ? stopRecording() : startRecording();
  };

  const handleBackPress = () => {
    if (recording) stopRecording();
    if (fromCameraUpload === 'true') {
      router.replace('/CameraUpload');
    } else if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const allPermissionsGranted = hasCameraPermission && hasMicrophonePermission && mediaLibraryPermission?.granted;
  
  if (!allPermissionsGranted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>{t('cameraScreen.permissionExplanation')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={async () => {
            if (!hasCameraPermission) await requestCameraPermission();
            if (!hasMicrophonePermission) await requestMicrophonePermission();
            if (mediaLibraryPermission?.status !== MediaLibrary.PermissionStatus.GRANTED) await requestMediaLibraryPermission();
          }}>
          <Text style={styles.permissionButtonText}>{t('cameraScreen.grantPermissionsButton')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera device not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isActive && !isProcessing}
            video={true}
            audio={true}
            onInitialized={() => {
              console.log('LOG: Camera initialized');
              setIsCameraReady(true);
            }}
            onError={(error) => {
              console.error('ERROR: Camera error:', error);
              Alert.alert('Camera Error', 'Failed to initialize camera: ' + error.message);
            }}
        />
        
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
            <TouchableOpacity style={styles.iconButton} onPress={handleBackPress}>
                <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>

            {recording ? (
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownText}>{countdown}s</Text>
                </View>
            ) : (
                <View style={styles.topActionsContainer}>
                    <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
                        <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
                        <Ionicons name="camera-reverse" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            )}
        </View>

        <View style={styles.bottomControls}>
            <TouchableOpacity
                style={[
                  styles.recordButton, 
                  recording && styles.recordButtonActive, 
                  (!isCameraReady || isProcessing) && styles.recordButtonDisabled
                ]}
                onPress={handleRecordButtonPress}
                disabled={!isCameraReady || isProcessing}
            >
                <View style={[styles.recordButtonInner, recording && styles.recordButtonInnerActive]} />
            </TouchableOpacity>
        </View>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'black', padding: 20 },
  permissionText: { color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  permissionButton: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  permissionButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
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
  countdownText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  bottomControls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  recordButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(255, 255, 255, 0.3)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 4, 
    borderColor: 'white' 
  },
  recordButtonActive: { borderColor: '#ff4444' },
  recordButtonDisabled: { opacity: 0.5 },
  recordButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff4444' },
  recordButtonInnerActive: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#ff4444' },
  processingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 10 
  },
  processingText: { color: 'white', fontSize: 18, textAlign: 'center' },
  bigCountdownContainer: { 
    ...StyleSheet.absoluteFillObject, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 5 
  },
  bigCountdownText: { 
    fontSize: 120, 
    fontWeight: 'bold', 
    color: 'white', 
    textShadowColor: 'rgba(0, 0, 0, 0.8)', 
    textShadowOffset: { width: 2, height: 2 }, 
    textShadowRadius: 4 
  },
});

export default CameraRecord;