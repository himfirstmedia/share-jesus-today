// CameraRecord.js - INTEGRATED WITH CAMERA SERVICE
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import cameraApiService from 'services/cameraApiService'; // Adjust path as needed
import videoCompressionService from 'services/videoCompressionService'; // Add this import

const CameraRecord = ({ onRecordingComplete, onCancel }) => {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [cameraType, setCameraType] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const isRecordingRef = useRef(false);
  const recordingPromiseRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!cameraPermission?.granted) {
        await requestCameraPermission();
      }
      if (!microphonePermission?.granted) {
        await requestMicrophonePermission();
      }
      
      // Initialize camera service and cleanup old temp files
      try {
        await cameraApiService.cleanupTempFiles();
        await videoCompressionService.cleanupTempFiles();
        console.log('Camera service initialized and temp files cleaned');
      } catch (error) {
        console.warn('Camera service initialization warning:', error);
      }
    })();
  }, []);

  // Timer effect
  useEffect(() => {
    if (isRecording && isRecordingRef.current) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
          const newTime = prevTime + 1;
          // Auto-stop at 30 seconds
          if (newTime >= 29) {
            setTimeout(() => {
              handleStopRecording();
            }, 100); // 100ms delay
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [isRecording]);

  const handleFlipCamera = () => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  };

  // Helper function to wait for file to be available
  const waitForFile = async (uri, maxAttempts = 10, delay = 500) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log(`File found on attempt ${attempt}:`, fileInfo);
          return fileInfo;
        }
      } catch (error) {
        console.log(`File check attempt ${attempt} failed:`, error);
      }
      
      if (attempt < maxAttempts) {
        console.log(`File not ready on attempt ${attempt}, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`File not available after ${maxAttempts} attempts`);
  };

  // Helper function to compress video using the compression service
  const compressVideo = async (sourceUri) => {
    try {
      setProcessingStatus('Analyzing video...');
      
      // Validate and get video info
      const validation = await videoCompressionService.validateVideo(sourceUri);
      if (!validation.isValid) {
        throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
      }
      
      console.log('Video info:', validation.info);
      
      // Check if compression is needed
      const maxSizeMB = 15; // Server upload limit
      if (!videoCompressionService.needsCompression(validation.info, maxSizeMB)) {
        console.log('Video is already under size limit, no compression needed');
        return sourceUri;
      }
      
      setProcessingStatus('Compressing video...');
      console.log(`Video needs compression: ${validation.info.sizeMB}MB > ${maxSizeMB}MB`);
      
      // Attempt compression
      const compressedUri = await videoCompressionService.createCompressedCopy(sourceUri, maxSizeMB);
      
      // Validate compressed result
      const compressedInfo = await videoCompressionService.getVideoInfo(compressedUri);
      console.log('Compressed video info:', compressedInfo);
      
      return compressedUri;
      
    } catch (error) {
      console.error('Video compression failed:', error);
      throw new Error(`Video compression failed: ${error.message}`);
    }
  };
  const copyToPermamentLocation = async (sourceUri) => {
    try {
      const timestamp = Date.now();
      const fileName = `recording_${timestamp}.mp4`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      
      console.log('Copying file from:', sourceUri);
      console.log('Copying file to:', permanentUri);
      
      await FileSystem.copyAsync({
        from: sourceUri,
        to: permanentUri
      });
      
      // Verify the copy was successful
      const fileInfo = await FileSystem.getInfoAsync(permanentUri);
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('File copy failed or resulted in empty file');
      }
      
      console.log('File copied successfully:', fileInfo);
      return permanentUri;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || isRecording || !isCameraReady || isRecordingRef.current || isProcessing) {
      console.log('Cannot start recording:', { 
        hasCamera: !!cameraRef.current, 
        isRecording, 
        isCameraReady,
        isRecordingRef: isRecordingRef.current,
        isProcessing 
      });
      return;
    }

    try {
      console.log('Starting video recording...');
      
      // Set recording state BEFORE starting recording
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingTime(0);

      // Get optimal camera settings to prevent large files
      const recommendedSettings = videoCompressionService.getRecommendedCameraSettings(29, 15); // 29 seconds, 15MB target
      console.log('Recommended camera settings:', recommendedSettings);
      
      let recordingOptions = {
        maxDuration: 29, // 29 seconds max
        quality: recommendedSettings.quality,
        videoBitrate: recommendedSettings.videoBitrate,
        videoCodec: recommendedSettings.videoCodec,
        audioBitrate: recommendedSettings.audioBitrate,
        audioCodec: recommendedSettings.audioCodec,
      };
      
      try {
        const settingsResponse = await cameraApiService.getCameraSettings();
        // Apply server settings if available
        if (settingsResponse.success && settingsResponse.data) {
          recordingOptions = {
            ...recordingOptions,
            ...settingsResponse.data.recordingOptions,
          };
        }
      } catch (error) {
        console.log('Using default camera settings:', error.message);
      }

      console.log('Recording options:', recordingOptions);
      
      // Start recording and store the promise
      recordingPromiseRef.current = cameraRef.current.recordAsync(recordingOptions);
      
      // Wait for recording to complete (either by manual stop or timeout)
      const data = await recordingPromiseRef.current;
      
      console.log('Recording completed with data:', data);
      
      // Only process if we have valid data and haven't already processed
      if (data && data.uri && isRecordingRef.current) {
        await handleRecordingComplete(data);
      }
      
    } catch (error) {
      console.error('Failed to record video:', error);
      handleRecordingError(error);
    }
  };

  const handleStopRecording = async () => {
    if (!cameraRef.current || !isRecording || !isRecordingRef.current) {
      console.log('Cannot stop recording:', { 
        hasCamera: !!cameraRef.current, 
        isRecording,
        isRecordingRef: isRecordingRef.current 
      });
      return;
    }

    try {
      console.log('Stopping video recording...');
      
      // Stop the recording - this will resolve the promise in handleStartRecording
      await cameraRef.current.stopRecording();
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      handleRecordingError(error);
    }
  };

  const handleRecordingComplete = async (data) => {
    console.log('Processing recording completion...');
    
    // Set processing state
    setIsProcessing(true);
    setProcessingStatus('Processing recording...');
    
    // Reset recording states
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingTime(0);
    recordingPromiseRef.current = null;
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (!data || !data.uri) {
      console.error('Recording data is invalid:', data);
      setIsProcessing(false);
      setProcessingStatus('');
      Alert.alert('Recording Error', 'Failed to save the recorded video. Please try again.');
      onRecordingComplete(null);
      return;
    }

    try {
      // Wait for the file to be available
      setProcessingStatus('Waiting for file to be ready...');
      await waitForFile(data.uri);
      
      setProcessingStatus('Securing recording...');
      const permanentUri = await copyToPermamentLocation(data.uri);
      
      // Compress the video to reduce file size
      setProcessingStatus('Optimizing video size...');
      const compressedUri = await compressVideo(permanentUri);
      
      // Get final file info
      const finalFileInfo = await FileSystem.getInfoAsync(compressedUri);
      const fileSizeMB = Math.round(finalFileInfo.size / 1024 / 1024 * 100) / 100;
      console.log('Final video file size:', fileSizeMB, 'MB');
      
      // Check if file is still too large (server limit check)
      const maxUploadSizeMB = 20; // Adjust based on your server limits
      if (fileSizeMB > maxUploadSizeMB) {
        console.error(`File too large: ${fileSizeMB}MB > ${maxUploadSizeMB}MB`);
        setIsProcessing(false);
        setProcessingStatus('');
        Alert.alert(
          'File Too Large', 
          `Video file (${fileSizeMB}MB) exceeds the ${maxUploadSizeMB}MB limit. Try recording a shorter video.`
        );
        onRecordingComplete(null);
        return;
      }
      
      const fileName = `video_${Date.now()}.mp4`;
      const fileType = 'video/mp4';
      
      const videoFile = {
        uri: compressedUri, // Use compressed URI
        name: fileName,
        type: fileType,
        size: finalFileInfo.size, // Include file size
      };

      // Validate the recording using the camera service
      setProcessingStatus('Validating file...');
      const validationResponse = await cameraApiService.validateRecording(videoFile);
      
      if (!validationResponse.success) {
        console.error('Recording validation failed:', validationResponse.error);
        setIsProcessing(false);
        setProcessingStatus('');
        Alert.alert('Recording Error', validationResponse.error || 'Recording validation failed');
        onRecordingComplete(null);
        return;
      }

      console.log('Recording validated successfully:', validationResponse.data);

      // Save recording metadata to the service
      setProcessingStatus('Saving metadata...');
      const fileId = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      if (validationResponse.data) {
        try {
          const metadataResponse = await cameraApiService.saveRecordingMetadata(
            fileId,
            validationResponse.data
          );
          
          if (metadataResponse.success) {
            console.log('Metadata saved successfully');
          } else {
            console.warn('Failed to save metadata:', metadataResponse.error);
            // Don't fail the whole process, just log the warning
          }
        } catch (error) {
          console.warn('Error saving metadata:', error);
        }
      }

      // Upload session data for analytics
      setProcessingStatus('Saving session data...');
      const sessionData = {
        sessionId: fileId,
        recordingDuration: recordingTime,
        cameraType: cameraType,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        quality: 'standard', // Could be dynamic based on settings
      };

      try {
        const sessionResponse = await cameraApiService.uploadSessionData(sessionData);
        if (sessionResponse.success) {
          console.log('Session data saved successfully');
        } else {
          console.warn('Failed to save session data:', sessionResponse.error);
        }
      } catch (error) {
        console.warn('Error saving session data:', error);
      }

      // Prepare the complete file object with additional metadata
      const completeVideoFile = {
        ...videoFile,
        fileId: fileId,
        metadata: validationResponse.data,
        sessionData: sessionData,
      };

      setIsProcessing(false);
      setProcessingStatus('');
      
      console.log('Calling onRecordingComplete with:', completeVideoFile);
      onRecordingComplete(completeVideoFile);

      // Clean up the original temporary file
      try {
        await FileSystem.deleteAsync(data.uri, { idempotent: true });
        console.log('Cleaned up temporary file');
      } catch (error) {
        console.warn('Failed to clean up temporary file:', error);
      }

    } catch (error) {
      console.error('Error processing recording:', error);
      setIsProcessing(false);
      setProcessingStatus('');
      
      let errorMessage = 'Failed to process the recorded video. Please try again.';
      if (error.message.includes('File not available')) {
        errorMessage = 'Recording file is not ready. Please try recording again.';
      } else if (error.message.includes('copy failed')) {
        errorMessage = 'Failed to save recording. Please check storage space and try again.';
      }
      
      Alert.alert('Processing Error', errorMessage);
      onRecordingComplete(null);
    }
  };

  const handleRecordingError = (error) => {
    console.error('Recording error occurred:', error);
    
    // Reset all recording states
    setIsRecording(false);
    isRecordingRef.current = false;
    setRecordingTime(0);
    recordingPromiseRef.current = null;
    setIsProcessing(false);
    setProcessingStatus('');
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Show user-friendly error message
    let errorMessage = 'Failed to record video. Please try again.';
    
    if (error.message) {
      if (error.message.includes('stopped before any data')) {
        errorMessage = 'Recording was too short. Please record for at least 1 second.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Camera or microphone permission denied. Please check your permissions.';
      } else if (error.message.includes('busy') || error.message.includes('use')) {
        errorMessage = 'Camera is busy. Please close other camera apps and try again.';
      }
    }
    
    Alert.alert('Recording Error', errorMessage);
  };

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (isRecordingRef.current && cameraRef.current) {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          console.log('Cleanup recording stop error:', e);
        }
      }
    };
  }, []);

  // Permission checks
  if (!cameraPermission || !microphonePermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!cameraPermission.granted || !microphonePermission.granted) {
    return (
      <View style={styles.permissionDeniedContainer}>
        <Text style={styles.permissionText}>
          Camera and microphone access are needed to record video.
        </Text>
        <View style={styles.buttonContainer}>
          <Button 
            title="Grant Permissions" 
            onPress={async () => {
              await requestCameraPermission();
              await requestMicrophonePermission();
            }} 
          />
          <View style={styles.buttonSpacer} />
          <Button title="Cancel" onPress={onCancel} color="#888" />
        </View>
      </View>
    );
  }

  // Format recordingTime into MM:SS
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.cameraPreview}
        facing={cameraType}
        ref={cameraRef}
        mode="video"
        onCameraReady={() => {
          console.log('Camera is ready for video recording');
          setIsCameraReady(true);
        }}
        onMountError={(error) => {
          console.error('Camera mount error:', error);
          Alert.alert('Camera Error', 'Failed to initialize camera. Please try again.');
        }}
      />
      
      {/* Top Controls Overlay */}
      <View style={styles.topControlsOverlay} pointerEvents="box-none">
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={onCancel}
          disabled={isRecording || isProcessing}
        >
          <Ionicons 
            name="close" 
            size={30} 
            color={(isRecording || isProcessing) ? "#888" : "white"} 
          />
        </TouchableOpacity>
        
        {isRecording && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              {formatTime(recordingTime)} / 00:30
            </Text>
            <View style={styles.recordingIndicator} />
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={handleFlipCamera}
          disabled={isRecording || isProcessing}
        >
          <Ionicons 
            name="camera-reverse" 
            size={30} 
            color={(isRecording || isProcessing) ? "#888" : "white"} 
          />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Controls Overlay */}
      <View style={styles.bottomControlsOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording ? styles.recordButtonRecording : {},
            (!isCameraReady || isProcessing) ? styles.recordButtonDisabled : {},
          ]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!isCameraReady || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="large" color="white" />
          ) : (
            <Ionicons
              name={isRecording ? "stop-circle" : "radio-button-on"}
              size={70}
              color={isRecording ? "red" : "white"}
            />
          )}
        </TouchableOpacity>
        
        {(!isCameraReady || isProcessing) && (
          <Text style={styles.statusText}>
            {!isCameraReady ? 'Initializing camera...' : processingStatus}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  bottomControlsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  controlButton: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  recordButton: {
    alignSelf: 'center',
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 10,
    padding: 10,
  },
  recordButtonRecording: {
    backgroundColor: 'rgba(255,0,0,0.3)',
  },
  recordButtonDisabled: {
    opacity: 0.5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  permissionDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'black',
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
    color: 'white',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
  },
  buttonSpacer: {
    height: 10,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  timerText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'red',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
});

export default CameraRecord;