import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
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

const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const [permission, requestPermission] = useCameraPermissions();
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
      if (!permission) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);


  // --- Recording Logic ---

  const startRecording = () => {
    if (!cameraRef.current || !isCameraReady) {
      Alert.alert("Camera Not Ready", "Please wait for the camera to initialize.");
      return;
    }
    if (recording) return;

    setRecording(true);
    setCountdown(30);

    intervalRef.current = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    const recordingOptions = {
      quality: '720p',
      maxDuration: 30,
    };

    cameraRef.current.recordAsync(recordingOptions)
      .then(async (data) => {
        if (!data?.uri) {
          throw new Error("Recording failed: No video data URI was returned.");
        }
        await processVideo(data.uri);
      })
      .catch((error: Error) => {
        console.error('ERROR: Recording promise was rejected:', error);
        Alert.alert('Recording Error', `An error occurred during recording: ${error.message}`);
      })
      .finally(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setRecording(false);
        setCountdown(30);
      });
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      console.log('LOG: Manually stopping video recording...');
      cameraRef.current.stopRecording();
    }
  };

  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);

    try {
      console.log(`LOG: Recording finished. Original URI: ${originalUri}`);
      setProcessingText('Saving video...');

      // **[FIX]** Implement a retry mechanism to handle file system race conditions.
      let fileExists = false;
      let attempts = 0;
      const maxAttempts = 5;
      const delay = 300; // ms

      while (!fileExists && attempts < maxAttempts) {
        attempts++;
        console.log(`LOG: Attempt ${attempts} to access video file...`);
        const fileInfo = await FileSystem.getInfoAsync(originalUri);
        fileExists = fileInfo.exists;
        
        if (!fileExists) {
            if (attempts < maxAttempts) {
                console.log(`LOG: File not found, waiting ${delay}ms before retrying.`);
                await sleep(delay);
            } else {
                throw new Error(`File does not exist at URI after ${maxAttempts} attempts.`);
            }
        }
      }

      // 1. Define the destination directory and ensure it exists.
      const directory = `${FileSystem.documentDirectory}videos/`;
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const newUri = `${directory}video_${Date.now()}.mp4`;

      // 2. Copy the file (we've now confirmed it exists).
      await FileSystem.copyAsync({
        from: originalUri,
        to: newUri,
      });
      console.log(`LOG: Video copied successfully to: ${newUri}`);

      // Clean up the original file from the cache directory after copying.
      await FileSystem.deleteAsync(originalUri, { idempotent: true });

      // 3. Compress the video file using the service.
      setProcessingText('Compressing video...');
      const compressedUri = await VideoCompressionService.createCompressedCopy(newUri);
      console.log(`LOG: Compression complete. Final URI: ${compressedUri}`);

      // 4. Handle the completed recording with the compressed URI.
      if (onRecordingComplete) {
        onRecordingComplete({ uri: compressedUri });
      } else {
        router.push({
          pathname: '/share/ShareVideo' as any,
          params: { videoUri: compressedUri },
        });
      }
    } catch (error: any) {
      console.error('ERROR: Failed to process video:', error);
      Alert.alert('Processing Error', `Failed to save or compress video: ${error.message}`);
      if (onRecordingComplete) {
        onRecordingComplete(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // --- UI Handlers ---

  const handleRecordButtonPress = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

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

  // --- Render Logic ---

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          We need your permission to use the camera
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
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
          <Text style={styles.timerText}>
            0:{String(countdown).padStart(2, '0')}
          </Text>
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
    marginRight: 44, 
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
