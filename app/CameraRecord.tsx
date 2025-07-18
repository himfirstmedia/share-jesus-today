import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
// Assuming VideoCompressionService is in the correct path
// import VideoCompressionService from '../services/videoCompressionService';

// Mock VideoCompressionService for demonstration purposes
const VideoCompressionService = {
  createCompressedCopy: async (uri: string): Promise<string> => {
    console.log(`Compressing video at: ${uri}`);
    // In a real app, this would return a new URI for the compressed file
    // For this example, we'll just return the same URI after a short delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Compression finished.');
    return uri;
  },
};


// Define interfaces for better type safety
interface RecordingData {
  uri: string;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

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
    // Request permissions when the component mounts
    (async () => {
      if (!permission) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  useEffect(() => {
    // Clean up interval on unmount
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
    if (recording) return; // Prevent starting a new recording while one is in progress

    setRecording(true);
    setCountdown(30);

    // This interval is ONLY for updating the UI countdown.
    intervalRef.current = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    const recordingOptions = {
      quality: '720p',
      maxDuration: 30, // The camera will stop recording automatically after 30s
    };

    cameraRef.current.recordAsync(recordingOptions)
      .then(async (data) => {
        // This block executes when recording stops, either via maxDuration or a manual stop.
        if (!data?.uri) {
          throw new Error("Recording failed: No video data URI was returned.");
        }
        
        // The file is available, begin processing.
        await processVideo(data.uri);
      })
      .catch((error: Error) => {
        console.error('ERROR  Recording promise was rejected:', error);
        Alert.alert('Recording Error', `An error occurred during recording: ${error.message}`);
      })
      .finally(() => {
        // This block ensures state is cleaned up regardless of success or failure.
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
      console.log('LOG  Manually stopping video recording...');
      cameraRef.current.stopRecording();
      // The .then() block of recordAsync will handle the rest.
    }
  };

  const processVideo = async (originalUri: string) => {
    setIsProcessing(true);
    
    try {
      console.log(`LOG  Recording finished. Original URI: ${originalUri}`);
      setProcessingText('Saving video...');

      // Define a new path in a persistent directory
      const newUri = `${FileSystem.documentDirectory}video_${Date.now()}.mp4`;

      // Move the file from the temporary cache to the new path.
      // This is a crucial step to ensure the file is fully written and accessible.
      await FileSystem.moveAsync({
        from: originalUri,
        to: newUri,
      });
      console.log(`LOG  Video moved successfully to: ${newUri}`);

      setProcessingText('Compressing video...');
      const compressedUri = await VideoCompressionService.createCompressedCopy(newUri);
      console.log(`LOG  Compression complete. Final URI: ${compressedUri}`);

      // Handle the completed recording
      if (onRecordingComplete) {
        onRecordingComplete({ uri: compressedUri });
      } else {
        router.push({
          pathname: '/share/ShareVideo' as any, // Type assertion for safety
          params: { videoUri: compressedUri },
        });
      }
    } catch (error: any) {
      console.error('ERROR  Failed to process video:', error);
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
      stopRecording(); // Ensure recording is stopped before going back
    }
    
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  // --- Render Logic ---

  if (!permission) {
    // Permissions are still being checked
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    // Permissions have been denied
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

  // Permissions are granted, render the camera UI
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
          console.log('LOG  Camera is ready.');
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
    // Offset to truly center the title by accounting for the back button's space
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
