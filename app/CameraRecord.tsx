import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
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
  } catch (error: any) { // Typed error as any
    console.error('ERROR: Failed to initialize videofiles directory:', error.message);
    throw error;
  }
};

// Deletes video files older than a specified age (default is 7 days).
const cleanupOldVideos = async (maxAge = 7 * 24 * 60 * 60 * 1000) => { // 7 days
  const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
  try {
    console.log('LOG: Starting cleanup of old videos...');
    const files = await FileSystem.readDirectoryAsync(videoFilesDirectory);
    for (const file of files) {
      const filePath = `${videoFilesDirectory}${file}`;
      // ✨ FIX: Request metadata to get modificationTime
      const fileInfo = await FileSystem.getInfoAsync(filePath, { md5: false, size: false });

      // ✨ FIX: Check for existence before accessing modificationTime
      if (fileInfo.exists && fileInfo.modificationTime && (Date.now() - (fileInfo.modificationTime * 1000)) > maxAge) {
        console.log(`LOG: Deleting old video file: ${filePath}`);
        await FileSystem.deleteAsync(filePath);
      }
    }
    console.log('LOG: Cleanup complete.');
  } catch (error: any) { // Typed error as any
    if (error.code === 'ERR_FILE_NOT_FOUND') {
      console.log('LOG: videofiles directory does not exist, skipping cleanup.');
    } else {
      console.error('ERROR: Cleanup failed:', error.message);
    }
  }
};


// Checks available disk space.
const checkStorageSpace = async () => {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    console.log(`LOG: Available storage: ${Math.round(freeDiskStorage / (1024 * 1024))} MB`);
    return freeDiskStorage;
  } catch (error: any) { // Typed error as any
    console.error('ERROR: Could not check storage:', error.message);
    return null;
  }
};


const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>('Processing...');
  const [countdown, setCountdown] = useState<number>(30);
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // --- Effects ---

  useEffect(() => {
    (async () => {
      await requestCameraPermission();
      await requestMicrophonePermission();
      await initializeVideoFilesDirectory();
      await cleanupOldVideos();
    })();
  }, [requestCameraPermission, requestMicrophonePermission]);

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
    try {
        console.log(`LOG: Recording finished. Original URI: ${originalUri}`);
        setProcessingText('Saving video...');

        const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
        await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });

        let fileExists = false;
        let attempts = 0;
        const maxAttempts = 10;
        let delay = 800;

        while (!fileExists && attempts < maxAttempts) {
            attempts++;
            console.log(`LOG: Attempt ${attempts} to access video file...`);
            try {
                // ✨ FIX: Request size metadata
                const fileInfo = await FileSystem.getInfoAsync(originalUri, { size: true });

                // ✨ FIX: Check for existence before accessing size
                if (fileInfo.exists && fileInfo.size > 0) {
                    console.log(`LOG: File found! Size: ${fileInfo.size} bytes`);
                    fileExists = true;
                    break;
                } else if (fileInfo.exists && fileInfo.size === 0) {
                    console.log(`LOG: File exists but has no content, retrying...`);
                }
            } catch (error: any) {
                 console.log(`LOG: Error checking file: ${error.message}`);
            }

            if (!fileExists && attempts < maxAttempts) {
                console.log(`LOG: File not ready, waiting ${delay}ms before retrying...`);
                await sleep(delay);
                delay = Math.min(delay * 1.2, 3000);
            }
        }

        if (!fileExists) {
            throw new Error(`File does not exist at URI after ${maxAttempts} attempts: ${originalUri}`);
        }

        const newUri = `${videoFilesDirectory}video_${Date.now()}.mp4`;

        await FileSystem.copyAsync({ from: originalUri, to: newUri });
        console.log(`LOG: Video copied successfully to: ${newUri}`);

        // ✨ FIX: Request size metadata for the copied file
        const copiedFileInfo = await FileSystem.getInfoAsync(newUri, { size: true });
        if (!copiedFileInfo.exists || copiedFileInfo.size === 0) {
            throw new Error(`Failed to copy video file properly. Copied file size: ${copiedFileInfo.exists ? copiedFileInfo.size : 'N/A'}`);
        }

        await FileSystem.deleteAsync(originalUri, { idempotent: true });

        setProcessingText('Compressing video...');
        const compressedUri = await VideoCompressionService.createCompressedCopy(newUri);
        console.log(`LOG: Compression complete. Final URI: ${compressedUri}`);

        if (compressedUri !== newUri) {
            await FileSystem.deleteAsync(newUri, { idempotent: true });
        }

        if (onRecordingComplete) {
            onRecordingComplete({ uri: compressedUri });
        } else {
            router.push({
                pathname: '/share/ShareVideo' as any,
                params: { videoUri: compressedUri },
            });
        }
    } catch (error: any) { // Typed error as any
        console.error('ERROR: Failed to process video:', error);
        Alert.alert('Processing Error', `Failed to save or compress video: ${error.message}`);
        if (onRecordingComplete) {
            onRecordingComplete(null);
        }
    } finally {
        setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || !isCameraReady) {
        Alert.alert("Camera Not Ready", "Please wait for the camera to initialize.");
        return;
    }
    if (recording) return;

    const availableSpace = await checkStorageSpace();
    if (availableSpace !== null && availableSpace < 50 * 1024 * 1024) { // 50MB threshold
        Alert.alert("Low Storage", "Not enough space to record a new video.");
        return;
    }

    if (!cameraPermission?.granted || !microphonePermission?.granted) {
        Alert.alert("Permission Required", "Camera and microphone permissions are required.");
        return;
    }

    setRecording(true);
    setCountdown(30);
    intervalRef.current = setInterval(() => setCountdown(prev => (prev > 1 ? prev - 1 : 0)), 1000);

    // ✨ FIX: Updated recording options for current expo-camera
    const recordingOptions = {
        maxDuration: 30,
        quality: 'SD', // Use 'HD' instead of '480p' - other options: 'SD', 'HD', 'FHD', '4K'
        videoBitrate: 1000000, // 1Mbps - adjust as needed
        audioBitrate: 128000,  // 128kbps for audio
        videoCodec: 'h264',    // Explicitly set codec
        audioCodec: 'aac',     // Explicitly set audio codec
    };

    try {
        console.log('LOG: Starting recording with options:', recordingOptions);
        const data = await cameraRef.current.recordAsync(recordingOptions);
        
        if (!data?.uri) {
            throw new Error("Recording failed: No video data URI returned.");
        }
        console.log(`LOG: Recording completed. Raw URI: ${data.uri}`);
        await sleep(1000);
        await processVideo(data.uri);
        
    } catch (error: any) {
        console.error('ERROR: Recording failed:', error);
        Alert.alert('Recording Error', `An error occurred: ${error.message}`);
    } finally {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRecording(false);
        setCountdown(30);
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
    onCancel ? onCancel() : router.back();
  };

  // --- Render Logic ---

  if (!cameraPermission || !microphonePermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>We need permission to use the camera and microphone.</Text>
        <TouchableOpacity
          onPress={async () => {
            await requestCameraPermission();
            await requestMicrophonePermission();
          }}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Record Video</Text>
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
                <Text style={styles.processingText}>{processingText}</Text>
            </View>
        )}
    </View>
  );
};

// Styles remain the same
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