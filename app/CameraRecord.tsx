import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import VideoCompressionService from '../services/videoCompressionService'; // Your compression service

// Define interfaces for better type safety
interface RecordingData {
  uri: string;
}

interface CameraRecordProps {
  onRecordingComplete?: (data: RecordingData | null) => void;
  onCancel?: () => void;
}

interface RecordingOptions {
  quality: '720p' | '1080p' | '480p';
  maxDuration: number;
}

const CameraRecord: React.FC<CameraRecordProps> = ({ onRecordingComplete, onCancel }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingText, setProcessingText] = useState<string>('Processing...');
  const [countdown, setCountdown] = useState<number>(30);
  const cameraRef = useRef<CameraView>(null);
  const intervalRef = useRef<number | null>(null);
  const router = useRouter();

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

  /**
   * Waits for a file to be available and have content.
   * This is crucial to ensure the file is fully written before we try to compress it.
   */
  const waitForFile = async (uri: string, attempts: number = 40, delay: number = 500): Promise<boolean> => {
    for (let i = 0; i < attempts; i++) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 0) {
          console.log(`LOG  File is ready: ${uri}, size: ${fileInfo.size}`);
          return true;
        }
        const size = 'size' in fileInfo ? fileInfo.size : 0;
        console.log(`LOG  File not ready on attempt ${i + 1}. Exists: ${fileInfo.exists}, Size: ${size}`);
      } catch (error) {
        console.error('Error checking file info:', error);
      }
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
    console.error('LOG  waitForFile timed out after 20 seconds.');
    return false;
  };

  const startRecording = (): void => {
    if (cameraRef.current && !recording && isCameraReady) {
      setRecording(true);
      setCountdown(30);
      console.log('LOG  Starting video recording for a max of 30 seconds...');

      intervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const recordingOptions: RecordingOptions = {
        quality: '720p',
        maxDuration: 30,
      };

      const recordPromise = cameraRef.current.recordAsync(recordingOptions);

      recordPromise.then(async (data: { uri: string; } | undefined) => {
        console.log('LOG  Recording completed with data:', JSON.stringify(data, null, 2));
        setProcessingText('Processing...');
        setIsProcessing(true);

        if (!data || !data.uri) {
          throw new Error("Recording data is invalid.");
        }

        // First, wait for the original file to be fully saved.
        const fileReady = await waitForFile(data.uri);

        if (fileReady) {
          console.log('LOG  File verified. Now starting compression...');
          setProcessingText('Compressing...'); // Update UI text

          // Now that the file is ready, compress it.
          const compressedUri = await VideoCompressionService.createCompressedCopy(data.uri);
          console.log(`LOG  Compression complete. New URI: ${compressedUri}`);

          if (onRecordingComplete) {
            onRecordingComplete({ uri: compressedUri });
          } else {
            router.push({
              pathname: '/share/ShareVideo' as any,
              params: { videoUri: compressedUri },
            });
          }
        } else {
          // If the file never becomes available, throw an error.
          throw new Error("File not available after multiple attempts");
        }
      }).catch((error: Error) => {
        console.error('ERROR  Recording failed:', error);
        Alert.alert('Recording Error', `Failed to save or compress video: ${error.message}`);
        if (onRecordingComplete) {
          onRecordingComplete(null);
        }
      }).finally(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsProcessing(false);
        setRecording(false);
        setCountdown(30);
      });
    } else if (!isCameraReady) {
      Alert.alert("Camera Not Ready", "Please wait a moment for the camera to initialize.");
    }
  };

  const stopRecording = (): void => {
    if (cameraRef.current && recording) {
      console.log('LOG  Stopping video recording manually...');
      cameraRef.current.stopRecording();
    }
  };

  const handleRecordButtonPress = (): void => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleBackPress = (): void => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', color: 'white' }}>
          We need your permission to show the camera
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
        onCameraReady={() => setIsCameraReady(true)}
      />

      <View style={styles.controlsContainer}>
        {recording && (
          <Text style={styles.timerText}>
            0:{countdown.toString().padStart(2, '0')}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.button, !isCameraReady && styles.disabledButton]}
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
  permissionButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#007BFF',
    borderRadius: 5,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    textAlign: 'center',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  processingText: {
    color: 'white',
    fontSize: 20,
  },
});

export default CameraRecord;