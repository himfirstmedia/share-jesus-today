import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type EventSubscription,
} from 'react-native';
import NativeVideoTrim, { isValidFile, showEditor } from 'react-native-video-trim';

interface VideoTrimmerProps {
  videoUri: string;
  videoDuration: number;
  maxDuration: number;
  onTrimChange: (startTime: number, endTime: number) => void;
  onCancel: () => void;
  onSave: (startTime: number, endTime: number, outputPath: string) => Promise<void>;
}

const VideoTrimmerComponent: React.FC<VideoTrimmerProps> = ({
  videoUri,
  maxDuration,
  onCancel,
  onSave,
}) => {
  const listenerSubscription = useRef<Record<string, EventSubscription>>({});
  const isMountedRef = useRef(true);
  const processingRef = useRef(false);
  const callbackExecutedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'processing' | 'saving' | 'error'>('loading');
  const [validatedVideoUri, setValidatedVideoUri] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Function to verify and copy file if needed
  const validateAndPrepareVideo = useCallback(async (uri: string): Promise<string> => {
    try {
      console.log('Validating video file at:', uri);
      
      // Clean the URI - handle both file:// and plain paths
      let cleanUri = uri;
      if (uri.startsWith('file://')) {
        cleanUri = uri.substring(7); // Remove 'file://' prefix
      }
      
      console.log('Cleaned URI:', cleanUri);
      
      // Check if file exists using Expo FileSystem
      const fileInfo = await FileSystem.getInfoAsync(cleanUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error(`Video file not found at: ${cleanUri}. The file may have been moved or deleted.`);
      }
      
      // Validate file properties
      if (fileInfo.isDirectory) {
        throw new Error('Path points to a directory, not a file');
      }
      
      if (!fileInfo.size || fileInfo.size === 0) {
        throw new Error('Video file is empty');
      }
      
      console.log('File validation passed:', { 
        size: fileInfo.size, 
        isDirectory: fileInfo.isDirectory,
        exists: fileInfo.exists 
      });
      
      // If file is in cache/temp directory, copy to a more permanent location
      if (cleanUri.includes('cache') || cleanUri.includes('temp') || cleanUri.includes('tmp') || cleanUri.includes('DocumentPicker')) {
        console.log('File is in temporary location, copying to permanent location...');
        
        // Create videos directory if it doesn't exist
        const videoFilesDirectory = `${FileSystem.documentDirectory}videos/`;
        const dirInfo = await FileSystem.getInfoAsync(videoFilesDirectory);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
        }
        
        const fileName = `video_${Date.now()}.mp4`;
        const permanentPath = `${videoFilesDirectory}${fileName}`;
        
        try {
          await FileSystem.copyAsync({
            from: cleanUri,
            to: permanentPath,
          });
          
          console.log('File copied to:', permanentPath);
          
          // Verify the copied file exists and is valid
          const copiedFileInfo = await FileSystem.getInfoAsync(permanentPath);
          if (!copiedFileInfo.exists || copiedFileInfo.isDirectory || !copiedFileInfo.size) {
            throw new Error('Failed to verify copied video file');
          }
          
          return permanentPath;
        } catch (copyError) {
          console.error('Failed to copy file:', copyError);
          // If copy fails, try to use original path but warn user
          console.log('Copy failed, attempting to use original path - this may cause issues');
          return cleanUri;
        }
      }
      
      // Return with the cleaned path (without file:// prefix for the trimmer)
      return cleanUri;
      
    } catch (error) {
      console.error('Video validation failed:', error);
      throw error;
    }
  }, []);

  // Enhanced file validation for output
  const validateOutputFile = useCallback(async (outputPath: string): Promise<string> => {
    try {
      // Clean the output path
      let cleanPath = outputPath;
      if (outputPath.startsWith('file://')) {
        cleanPath = outputPath.substring(7);
      }
      
      console.log('Validating output file at:', cleanPath);
      
      // Wait a bit for file to be written completely
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(cleanPath);
      console.log('Output file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Output file does not exist');
      }
      
      if (fileInfo.isDirectory) {
        throw new Error('Output path is a directory, not a file');
      }
      
      if (!fileInfo.size || fileInfo.size === 0) {
        throw new Error('Output file is empty');
      }
      
      console.log('Output file validation passed:', {
        size: fileInfo.size,
        isDirectory: fileInfo.isDirectory,
        exists: fileInfo.exists
      });
      
      // Return with consistent file:// prefix
      return cleanPath.startsWith('file://') ? cleanPath : `file://${cleanPath}`;
      
    } catch (error) {
      console.error('Output file validation failed:', error);
      throw error;
    }
  }, []);

  // Safe callback execution
  const safeOnCancel = useCallback(() => {
    if (isMountedRef.current && !callbackExecutedRef.current) {
      callbackExecutedRef.current = true;
      onCancel();
    }
  }, [onCancel]);

  const safeOnSave = useCallback(async (startTime: number, endTime: number, outputPath: string) => {
    if (isMountedRef.current && !callbackExecutedRef.current) {
      callbackExecutedRef.current = true;
      try {
        await onSave(startTime, endTime, outputPath);
      } catch (error) {
        console.error('Error in onSave callback:', error);
      }
    }
  }, [onSave]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('VideoTrimmer - Cleaning up listeners');
    
    // Remove all event listeners
    Object.values(listenerSubscription.current).forEach(subscription => {
      try {
        subscription?.remove();
      } catch (error) {
        console.log('Error removing subscription:', error);
      }
    });
    
    listenerSubscription.current = {};
  }, []);

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  // Initialize trimmer
  useEffect(() => {
    if (!videoUri) {
      console.error('VideoTrimmer - No video URI provided');
      setStatus('error');
      setErrorMessage('No video file provided');
      return;
    }

    // Reset state for new video
    setStatus('loading');
    setProgress(0);
    setErrorMessage('');
    callbackExecutedRef.current = false;
    processingRef.current = false;

    // Setup event listeners
    listenerSubscription.current.onProcessing = NativeVideoTrim.onProcessing(
      ({ sessionId, progress }) => {
        console.log('VideoTrim Processing', `sessionId: ${sessionId}, progress: ${progress}%`);
        if (isMountedRef.current) {
          setProgress(progress);
          setStatus('processing');
        }
      }
    );

    listenerSubscription.current.onCancel = NativeVideoTrim.onCancel(
      ({ sessionId }) => {
        console.log('VideoTrim Cancelled', `sessionId: ${sessionId}`);
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('ready');
          setProgress(0);
          // Don't call safeOnCancel here as this is just trimming cancellation
        }
      }
    );

    listenerSubscription.current.onSuccess = NativeVideoTrim.onSuccess(
      async ({ sessionId, startTime, endTime, outputPath }) => {
        console.log('VideoTrim Success', {
          sessionId,
          startTime,
          endTime,
          outputPath
        });

        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('saving');
          
          try {
            // Validate the output file
            const validatedOutputPath = await validateOutputFile(outputPath);
            console.log('VideoTrimmer - Validated output path:', validatedOutputPath);
            
            // Call the save callback with validated path
            await safeOnSave(startTime, endTime, validatedOutputPath);
          } catch (error) {
            console.error('VideoTrimmer - Error processing output:', error);
            
            if (isMountedRef.current && !callbackExecutedRef.current) {
              setStatus('error');
              setErrorMessage('Failed to process trimmed video');
              
              Alert.alert(
                'Processing Error',
                'Failed to save the trimmed video. Please try again.',
                [{ text: 'OK', onPress: () => safeOnCancel() }]
              );
            }
          }
        }
      }
    );

    listenerSubscription.current.onError = NativeVideoTrim.onError(
      ({ sessionId, message }) => {
        console.log('VideoTrim Error', `sessionId: ${sessionId}, message: ${message}`);
        
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('error');
          setProgress(0);
          
          // Delay the alert to ensure proper UI state
          setTimeout(() => {
            if (isMountedRef.current && !callbackExecutedRef.current) {
              let errorMessage = 'Failed to trim video. Please try again.';
              
              // Provide more specific error messages
              if (message && message.includes('No such file or directory')) {
                errorMessage = 'Video file not found. Please select the video again.';
              } else if (message && message.includes('Command failed')) {
                errorMessage = 'Video processing failed. The file might be corrupted or in an unsupported format.';
              }
              
              Alert.alert('Trimming Error', errorMessage, [
                {
                  text: 'OK',
                  onPress: () => safeOnCancel()
                }
              ]);
            }
          }, 200);
        }
      }
    );

    // Optional: Add logging and statistics listeners for debugging
    listenerSubscription.current.onLog = NativeVideoTrim.onLog(
      ({ level, message, sessionId }) => {
        console.log('VideoTrim Log', `level: ${level}, message: ${message}, sessionId: ${sessionId}`);
      }
    );

    listenerSubscription.current.onStatistics = NativeVideoTrim.onStatistics(
      ({ sessionId, videoFrameNumber, videoFps, videoQuality, size, time, bitrate, speed }) => {
        console.log(
          'VideoTrim Statistics',
          `sessionId: ${sessionId}, frames: ${videoFrameNumber}, fps: ${videoFps}, quality: ${videoQuality}`
        );
      }
    );

    const initializeTrimmer = async () => {
      try {
        console.log('Initializing video trimmer for:', videoUri);
        
        // First validate and prepare the video file
        const preparedUri = await validateAndPrepareVideo(videoUri);
        setValidatedVideoUri(preparedUri);
        
        console.log('Video file prepared:', preparedUri);
        
        // Validate the video file with the library
        const isValid = await Promise.race([
          isValidFile(preparedUri),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout')), 15000)
          )
        ]);
        
        if (!isValid) {
          throw new Error('Invalid video file format or corrupted file');
        }

        console.log('Video file validated, showing editor...');
        
        const trimmerConfig = {
          maxDuration: maxDuration,
          outputExt: 'mp4', // Explicitly set output extension
          saveToPhoto: false, // Don't save to photo library automatically
        };

        console.log('VideoTrimmer - Using config:', trimmerConfig);
        
        // Show the editor with configuration
        await showEditor(preparedUri, trimmerConfig);
        
        if (isMountedRef.current) {
          setStatus('ready');
        }
        
      } catch (error) {
        console.error('Error initializing video trimmer:', error);
        
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('error');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          setErrorMessage(errorMessage);
          
          let userMessage = 'Failed to open video trimmer.';
          
          if (errorMessage.includes('not found')) {
            userMessage = 'Video file not found. The file may have been moved or deleted.';
          } else if (errorMessage.includes('Invalid video file')) {
            userMessage = 'Invalid video file format. Please select a different video.';
          } else if (errorMessage.includes('timeout')) {
            userMessage = 'Video validation timed out. The file may be too large or corrupted.';
          }
          
          Alert.alert(
            'Video Trimmer Error',
            userMessage,
            [{ text: 'OK', onPress: () => safeOnCancel() }]
          );
        }
      }
    };

    initializeTrimmer();
  }, [videoUri, maxDuration, validateAndPrepareVideo, validateOutputFile, safeOnCancel, safeOnSave]);

  const handleCancel = () => {
    console.log('VideoTrimmer - Manual cancel triggered');
    safeOnCancel();
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return 'Preparing video...';
      case 'ready':
        return 'Video trimmer is ready. Use the controls to trim your video.';
      case 'processing':
        return `Processing video... ${Math.round(progress)}%`;
      case 'saving':
        return 'Saving trimmed video...';
      case 'error':
        return errorMessage || 'An error occurred';
      default:
        return 'Loading...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
      case 'processing':
      case 'saving':
        return '#007AFF';
      case 'ready':
        return '#28a745';
      case 'error':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Ionicons name="close" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trim Video</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <View style={styles.statusContainer}>
          {(status === 'loading' || status === 'processing' || status === 'saving') && (
            <ActivityIndicator size="small" color={getStatusColor()} style={styles.statusIndicator} />
          )}
          {status === 'error' && (
            <Ionicons name="alert-circle" size={20} color={getStatusColor()} style={styles.statusIndicator} />
          )}
          {status === 'ready' && (
            <Ionicons name="checkmark-circle" size={20} color={getStatusColor()} style={styles.statusIndicator} />
          )}
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusMessage()}
          </Text>
        </View>
        
        {status === 'processing' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>How to use the video trimmer:</Text>
        <Text style={styles.instructionText}>• Drag the handles on the timeline to select the part you want to keep</Text>
        <Text style={styles.instructionText}>• Maximum duration: {maxDuration} seconds</Text>
        <Text style={styles.instructionText}>• Tap the play button to preview your selection</Text>
        <Text style={styles.instructionText}>• Tap "Save" when you're satisfied with your trim</Text>
      </View>

      {/* Video Info */}
      {validatedVideoUri && (
        <View style={styles.videoInfoSection}>
          <Text style={styles.videoInfoTitle}>Video File:</Text>
          <Text style={styles.videoInfoPath} numberOfLines={2}>
            {validatedVideoUri}
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {status === 'error' && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#dc3545" />
            <Text style={styles.errorTitle}>Video Trimmer Error</Text>
            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleCancel}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {status !== 'error' && (
          <View style={styles.trimmerPlaceholder}>
            <Text style={styles.placeholderText}>
              The native video trimmer will appear here once the video is loaded.
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Note: The trimmer interface is provided by the native video editing library.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelButton: {
    padding: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
  },
  headerSpacer: {
    width: 34, // Same width as cancel button to center title
  },
  statusSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#6c757d',
    minWidth: 40,
  },
  instructionsSection: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20,
  },
  videoInfoSection: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  videoInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  videoInfoPath: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginTop: 15,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  trimmerPlaceholder: {
    padding: 40,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VideoTrimmerComponent;