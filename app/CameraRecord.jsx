import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Camera, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';

const CameraRecord = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!permission) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  /**
   * Waits for a file to be available and have content.
   * @param {string} uri - The URI of the file to check.
   * @param {number} attempts - The number of times to check for the file.
   * @param {number} delay - The delay in milliseconds between attempts.
   * @returns {Promise<boolean>} - True if the file is ready, false otherwise.
   */
  const waitForFile = async (uri, attempts = 20, delay = 500) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log(`LOG  File is ready: ${uri}`);
          return true; // File exists and has content
        }
      } catch (error) {
        console.error('Error checking file info:', error);
      }
      console.log(`LOG  File not ready on attempt ${i + 1}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false; // File not available after all attempts
  };

  const startRecording = async () => {
    if (cameraRef.current && !recording) {
      setRecording(true);
      console.log('LOG  Starting video recording...');
      // The `recordAsync` call is now within stopRecording
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current) {
      console.log('LOG  Stopping video recording...');
      try {
        const data = await cameraRef.current.recordAsync();
        console.log('LOG  Recording completed with data:', data);
        setRecording(false);
        setIsProcessing(true);

        const fileReady = await waitForFile(data.uri);

        if (fileReady) {
          console.log('LOG  Processing recording completion...');
          router.push({
            pathname: '/share/ShareVideo',
            params: { videoUri: data.uri },
          });
        } else {
          console.error('ERROR  Error processing recording: [Error: File not available after multiple attempts]');
          Alert.alert('Recording Failed', 'Could not save the video. Please try again.');
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('ERROR  Failed to stop recording:', error);
        setRecording(false);
        setIsProcessing(false);
      }
    }
  };

  const handleRecordButtonPress = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (!permission) {
    // Camera permissions are still loading
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>
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
      <Camera style={styles.camera} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleRecordButtonPress}>
            <Ionicons name={recording ? 'stop-circle' : 'radio-button-on'} size={80} color={recording ? 'red' : 'white'} />
          </TouchableOpacity>
        </View>
      </Camera>
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Text style={styles.processingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    margin: 20,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  button: {
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  permissionButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#007BFF',
    borderRadius: 5,
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
  },
  processingText: {
    color: 'white',
    fontSize: 20,
  },
});

