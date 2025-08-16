import { Ionicons } from '@expo/vector-icons';
import { CameraView, PermissionStatus, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { t } from '../utils/i18n';

// --- Interfaces and Helper Functions (Unchanged) ---
interface RecordingData {
  uri: string;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Utility Functions (Unchanged) ---
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
      const fileInfo = await FileSystem.getInfoAsync(filePath);

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

const verifyRecordingIsStable = async (
  uri: string,
  initialDelayMs = 500,
  maxRetries = 15
): Promise<FileSystem.FileInfo | null> => {
  console.log(`LOG: Starting STABILITY verification for recording: ${uri}`);
  await sleep(initialDelayMs);

  let previousSize = -1;
  let stableChecks = 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

      if (fileInfo.exists) {
        if (fileInfo.size > 1000) {
          if (fileInfo.size === previousSize) {
            stableChecks++;
            if (stableChecks >= 2) {
              console.log(`LOG: Recording verification successful and stable on attempt ${attempt}: ${uri} (${fileInfo.size} bytes)`);
              return fileInfo;
            }
          } else {
            stableChecks = 0;
            previousSize = fileInfo.size;
          }
        } else {
            console.warn(`WARN: Recording check failed on attempt ${attempt}: file exists but size is too small (${fileInfo.size} bytes).`);
        }
      } else {
        console.warn(`WARN: Recording check failed on attempt ${attempt}: file does not exist.`);
      }
    } catch (error: any) {
      console.warn(`WARN: Recording verification attempt ${attempt} threw an error:`, error.message);
    }
    
    await sleep(400 * attempt);
  }

  console.error(`ERROR: Recording verification failed after ${maxRetries} attempts for URI: ${uri}`);
  return null;
};

// --- Updated Component ---
const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions();
  
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>(t('cameraScreen.processing'));
  const [countdown, setCountdown] = useState<number>(30);
  const [showBigCountdown, setShowBigCountdown] = useState<boolean>(false);
  const [bigCountdownValue, setBigCountdownValue] = useState<number>(5);
  const [videoFilesDirectory, setVideoFilesDirectory] = useState<string>('');
  
  // --- NEW: State for camera facing direction and flash mode ---
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');

  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { fromCameraUpload } = params;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        console.log('LOG: Initializing component and checking permissions...');
        if (cameraPermission?.status === PermissionStatus.UNDETERMINED) await requestCameraPermission();
        if (microphonePermission?.status === PermissionStatus.UNDETERMINED) await requestMicrophonePermission();
        if (mediaLibraryPermission?.status === PermissionStatus.UNDETERMINED) await requestMediaLibraryPermission();
        
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
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
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
  }, [bigCountdownValue, showBigCountdown]);

  // --- NEW: Handlers for toggling camera and flash ---
  const toggleFacing = () => {
    if (recording) return; // Prevent switching during recording
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    if (recording) return; // Prevent toggling during recording
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const copyRecordedFile = async (originalUri: string): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recording_${timestamp}.mp4`;
    const targetUri = `${videoFilesDirectory}${fileName}`;
    
    console.log(`LOG: Copying verified file from ${originalUri} to ${targetUri}`);
    await FileSystem.copyAsync({ from: originalUri, to: targetUri });
    
    const copyInfo = await FileSystem.getInfoAsync(targetUri);
    if (!copyInfo.exists) {
      throw new Error(`Failed to copy recorded file to target directory: ${targetUri}`);
    }
    
    console.log(`LOG: File copied successfully to: ${targetUri}`);
    return targetUri;
  };

  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);
    let finalUri: string | null = null;
    
    try {
      setProcessingText(t('cameraScreen.preparingVideo'));
      const stableFileInfo = await verifyRecordingIsStable(originalUri);
      if (!stableFileInfo) {
        throw new Error(`Initial recorded file is not stable or could not be found: ${originalUri}`);
      }
      console.log(`LOG: Initial recording file is stable. Size: ${stableFileInfo.size} bytes.`);

      finalUri = await copyRecordedFile(originalUri);
      
      if (mediaLibraryPermission?.granted) {
        try {
          setProcessingText(t('cameraScreen.finalizing') || 'Saving to gallery...');
          await MediaLibrary.saveToLibraryAsync(finalUri);
          console.log('LOG: Video saved to Media Library successfully.');
        } catch (mediaLibraryError: any) {
          console.warn('WARN: Failed to save video to Media Library:', mediaLibraryError.message);
        }
      } else {
        console.warn('WARN: Media Library permission not granted. Cannot save to gallery.');
      }

      await sleep(200);

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
      if (finalUri) {
        await FileSystem.deleteAsync(finalUri, { idempotent: true }).catch(() => {});
      }
      Alert.alert(t('cameraScreen.alertFailedToSaveVideo'), t('cameraScreen.alertFailedToSaveVideo', { message: error.message }));
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
      setProcessingText(t('cameraScreen.processing'));
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady || recording) return;
    if (!videoFilesDirectory) {
      Alert.alert('Error', 'Video directory not initialized.');
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
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRecording(false);
      setShowBigCountdown(false);
      if (!data?.uri) throw new Error('No URI returned from camera recording');
      console.log(`LOG: Recording completed. Original temp URI: ${data.uri}`);
      await processVideo(data.uri);
    } catch (error: any) {
      console.error('ERROR: Recording failed:', error);
      Alert.alert(t('cameraScreen.recordingErrorTitle'), t('cameraScreen.recordingErrorMessage', { message: error.message }));
      if (intervalRef.current) clearInterval(intervalRef.current);
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
    if (recording) stopRecording();
    if (fromCameraUpload === 'true') {
      router.replace('/CameraUpload');
    } else if (onCancel) {
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
        <TouchableOpacity style={styles.permissionButton} onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
            await requestMediaLibraryPermission();
          }}>
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
            // --- UPDATED: Pass state to control camera ---
            facing={facing}
            flash={flash}
            mode="video"
            onCameraReady={() => setIsCameraReady(true)}
            onMountError={(error) => Alert.alert('Camera Error', 'Failed to initialize camera: ' + error.message)}
        >
            {isProcessing && (
                <View style={styles.processingOverlay}><Text style={styles.processingText}>{processingText}</Text></View>
            )}
            {showBigCountdown && (
                <View style={styles.bigCountdownContainer}>
                    <Animated.Text style={[styles.bigCountdownText, { transform: [{ scale: scaleAnim }] }]}>
                        {bigCountdownValue}
                    </Animated.Text>
                </View>
            )}
            
            {/* --- UPDATED: Top bar with new controls --- */}
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

// --- Updated Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  camera: { flex: 1 },
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
  // --- NEW: Generic style for icon buttons and a container for them ---
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
    gap: 12, // Adds space between the flash and reverse camera buttons
  },
  countdownContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countdownText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  bottomControls: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: 'white' },
  recordButtonActive: { borderColor: '#ff4444' },
  recordButtonDisabled: { opacity: 0.5 },
  recordButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff4444' },
  recordButtonInnerActive: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#ff4444' },
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  processingText: { color: 'white', fontSize: 18, textAlign: 'center' },
  bigCountdownContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  bigCountdownText: { fontSize: 120, fontWeight: 'bold', color: 'white', textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 4 },
});

export default CameraRecord;