import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  type EventSubscription,
} from 'react-native';
import NativeVideoTrim, { isValidFile, showEditor } from 'react-native-video-trim';

// --- Utility Functions for persistent storage ---
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory:', error);
    throw error;
  }
};

const ensureVideoIsPersistent = async (temporaryUri: string): Promise<string> => {
  try {
    const videoFilesDirectory = await initializeVideoFilesDirectory();
    const fileName = `video_${Date.now()}.mp4`;
    const permanentUri = `${videoFilesDirectory}${fileName}`;
    
    // Ensure both source and destination have proper file:// protocol
    const sourceUri = temporaryUri.startsWith('file://') ? temporaryUri : `file://${temporaryUri}`;
    const destUri = permanentUri.startsWith('file://') ? permanentUri : `file://${permanentUri}`;
    
    console.log('Copying from:', sourceUri, 'to:', destUri);
    
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const fileInfo = await FileSystem.getInfoAsync(destUri, { size: true });
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Failed to copy video to persistent storage.');
    }
    return destUri;
  } catch (error) {
    console.error('ERROR: Failed to make video persistent:', error);
    throw error;
  }
};

interface VideoTrimmerProps {
  videoUri: string;
  maxDuration: number;
  onCancel: () => void;
  onSave: (startTime: number, endTime: number, outputPath: string) => Promise<void>;
}

const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
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

  // Function to verify and prepare video file for trimming
  const validateAndPrepareVideo = useCallback(async (uri: string): Promise<string> => {
    try {
      console.log('Validating video file at:', uri);
      
      // Clean the URI - handle both file:// and regular paths
      const cleanUri = uri.replace(/^file:\/\//, '');
      console.log('Cleaned URI:', cleanUri);
      
      // Check if file exists using Expo FileSystem
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error(`Video file not found at: ${uri}`);
      }
      
      if (!fileInfo.size || fileInfo.size === 0) {
        throw new Error('Invalid video file: file is empty');
      }
      
      // If file is in cache/temp directory, copy to a more permanent location
      if (cleanUri.includes('cache') || cleanUri.includes('temp')) {
        console.log('File is in cache/temp, copying to permanent location...');
        
        const fileName = `video_${Date.now()}.mp4`;
        const permanentPath = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.copyAsync({ from: uri, to: permanentPath });
        console.log('File copied to:', permanentPath);
        
        // Verify the copied file exists
        const copiedInfo = await FileSystem.getInfoAsync(permanentPath);
        if (!copiedInfo.exists) {
          throw new Error('Failed to copy video file to permanent location');
        }
        
        return permanentPath;
      }
      
      // File is already in a good location, return as-is
      return uri;
      
    } catch (error) {
      console.error('Video validation failed:', error);
      throw error;
    }
  }, []);

  // Safe wrapper for the onSave callback
  const safeOnSave = useCallback(async (startTime: number, endTime: number, outputPath: string) => {
    // Prevent multiple executions
    if (callbackExecutedRef.current || processingRef.current) {
      console.log('onSave already executed or processing, skipping...');
      return;
    }

    callbackExecutedRef.current = true;
    processingRef.current = true;
    setStatus('saving');

    // Add a small delay to ensure the modal/native component is in a stable state
    setTimeout(async () => {
      try {
        console.log('Executing onSave callback safely:', { startTime, endTime, outputPath });
        
        // Validate parameters before calling
        if (!outputPath || typeof outputPath !== 'string') {
          throw new Error('Invalid output path provided');
        }

        if (typeof startTime !== 'number' || typeof endTime !== 'number') {
          throw new Error('Invalid time parameters provided');
        }

        // Check if the trimmed video file exists first
        const outputPathWithProtocol = outputPath.startsWith('file://') ? outputPath : `file://${outputPath}`;
        const trimmedFileInfo = await FileSystem.getInfoAsync(outputPathWithProtocol);
        
        if (!trimmedFileInfo.exists) {
          throw new Error(`Trimmed video file not found at: ${outputPath}`);
        }

        console.log('Trimmed video file exists, size:', trimmedFileInfo.size);

        // Ensure the trimmed video is in a persistent location
        const persistentTrimmedUri = await ensureVideoIsPersistent(outputPath);
        console.log('Trimmed video moved to persistent storage:', persistentTrimmedUri);

        // Call the actual callback with the persistent URI
        await onSave(startTime, endTime, persistentTrimmedUri);
        console.log('onSave callback completed successfully');
        
      } catch (error) {
        console.error('Error in onSave callback:', error);
        
        // Show error to user and provide fallback
        Alert.alert(
          'Save Error',
          `Failed to save the trimmed video: ${error instanceof Error ? error.message : 'Unknown error'}`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (isMountedRef.current) {
                  onCancel();
                }
              }
            }
          ]
        );
      } finally {
        // Reset processing state after a delay
        setTimeout(() => {
          processingRef.current = false;
          setStatus('ready');
        }, 500);
      }
    }, 300); // 300ms delay to ensure modal stability
  }, [onSave, onCancel]);

  const safeOnCancel = useCallback(() => {
    if (callbackExecutedRef.current || processingRef.current) {
      console.log('Already processing or callback executed, preventing cancel...');
      return;
    }

    callbackExecutedRef.current = true;
    processingRef.current = true;

    setTimeout(() => {
      try {
        console.log('Executing onCancel callback safely');
        onCancel();
      } catch (error) {
        console.error('Error in onCancel callback:', error);
      } finally {
        processingRef.current = false;
      }
    }, 100);
  }, [onCancel]);

  useEffect(() => {
    isMountedRef.current = true;
    callbackExecutedRef.current = false;
    processingRef.current = false;
    setStatus('loading');

    // Set up all the event listeners using the NativeVideoTrim API
    listenerSubscription.current.onLoad = NativeVideoTrim.onLoad(
      ({ duration }) => {
        console.log('VideoTrim onLoad', duration);
        if (isMountedRef.current) {
          setStatus('ready');
        }
      }
    );

    listenerSubscription.current.onShow = NativeVideoTrim.onShow(() => {
      console.log('VideoTrim onShow - Trimmer modal shown');
      if (isMountedRef.current) {
        setStatus('ready');
      }
    });

    listenerSubscription.current.onStartTrimming = NativeVideoTrim.onStartTrimming(() => {
      console.log('VideoTrim onStartTrimming - Trimming process started');
      if (isMountedRef.current) {
        setStatus('processing');
      }
    });

    listenerSubscription.current.onFinishTrimming = NativeVideoTrim.onFinishTrimming(
      ({ outputPath, startTime, endTime, duration }) => {
        console.log(
          'VideoTrim onFinishTrimming',
          `outputPath: ${outputPath}, startTime: ${startTime}, endTime: ${endTime}, duration: ${duration}`
        );
        
        if (!isMountedRef.current || callbackExecutedRef.current) {
          console.log('Component unmounted or callback already executed, ignoring finish event');
          return;
        }

        // Validate the output
        if (!outputPath || typeof outputPath !== 'string') {
          console.error('Invalid output path received:', outputPath);
          Alert.alert('Error', 'Failed to get valid trimmed video path.');
          safeOnCancel();
          return;
        }

        // Add a delay before calling the save callback to ensure the modal is fully dismissed
        setTimeout(() => {
          if (isMountedRef.current && !callbackExecutedRef.current) {
            safeOnSave(startTime || 0, endTime || 0, outputPath);
          }
        }, 400); // Increased delay for modal dismissal
      }
    );

    listenerSubscription.current.onCancelTrimming = NativeVideoTrim.onCancelTrimming(() => {
      console.log('VideoTrim onCancelTrimming - User cancelled trimming');
      
      if (callbackExecutedRef.current) {
        console.log('Callback already executed, ignoring cancel event');
        return;
      }

      if (isMountedRef.current) {
        setStatus('ready');
        
        // Add delay before cancel to ensure modal is dismissed
        setTimeout(() => {
          if (isMountedRef.current && !callbackExecutedRef.current) {
            safeOnCancel();
          }
        }, 200);
      }
    });

    listenerSubscription.current.onCancel = NativeVideoTrim.onCancel(() => {
      console.log('VideoTrim onCancel - General cancel event');
      
      if (callbackExecutedRef.current) {
        console.log('Callback already executed, ignoring cancel event');
        return;
      }

      if (isMountedRef.current) {
        setStatus('ready');
        
        setTimeout(() => {
          if (isMountedRef.current && !callbackExecutedRef.current) {
            safeOnCancel();
          }
        }, 200);
      }
    });

    listenerSubscription.current.onHide = NativeVideoTrim.onHide(() => {
      console.log('VideoTrim onHide - Trimmer modal hidden');
      // Don't change status here as this might be called during normal operation
    });

    listenerSubscription.current.onError = NativeVideoTrim.onError(
      ({ message, errorCode }) => {
        console.error('VideoTrim onError', `message: ${message}, errorCode: ${errorCode}`);
        
        if (callbackExecutedRef.current) {
          console.log('Callback already executed, ignoring error event');
          return;
        }

        if (isMountedRef.current) {
          setStatus('error');
          
          setTimeout(() => {
            if (isMountedRef.current && !callbackExecutedRef.current) {
              let errorMessage = message || 'An error occurred during video trimming.';
              
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

    const initializeTrimmer = async () => {
      try {
        console.log('Initializing video trimmer for:', videoUri);
        
        // First validate and prepare the video file
        const preparedUri = await validateAndPrepareVideo(videoUri);
        setValidatedVideoUri(preparedUri);
        
        console.log('Video file prepared:', preparedUri);
        
        // Remove file:// prefix for the library validation
        const cleanUriForValidation = preparedUri.replace(/^file:\/\//, '');
        
        // Validate the video file with the library
        const isValid = await Promise.race([
          isValidFile(cleanUriForValidation),
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
          outputExt: 'mp4',
          saveToPhoto: false,
        };

        console.log('VideoTrimmer - Using config:', trimmerConfig);
        
        // Show the editor with configuration (use clean URI without file://)
        await showEditor(cleanUriForValidation, trimmerConfig);
        
      } catch (error) {
        console.error('Error initializing video trimmer:', error);
        
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('error');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          let userMessage = 'Failed to open video trimmer.';
          if (errorMessage.includes('not found') || errorMessage.includes('No such file')) {
            userMessage = 'Video file not found. Please select the video again.';
          } else if (errorMessage.includes('timeout')) {
            userMessage = 'Video validation timed out. Please try again with a smaller video file.';
          } else if (errorMessage.includes('Invalid') || errorMessage.includes('corrupted')) {
            userMessage = 'The selected video file is not valid or supported. Please try a different video.';
          } else if (errorMessage.includes('copy') || errorMessage.includes('permission')) {
            userMessage = 'Unable to access the video file. Please check permissions and try again.';
          }
          
          Alert.alert('Error', userMessage, [
            {
              text: 'OK',
              onPress: () => safeOnCancel()
            }
          ]);
        }
      }
    };

    // Initialize the trimmer
    initializeTrimmer();

    // Cleanup function
    return () => {
      console.log('VideoTrimmer cleanup initiated');
      isMountedRef.current = false;
      
      // Clean up all subscriptions
      Object.keys(listenerSubscription.current).forEach(key => {
        try {
          listenerSubscription.current[key]?.remove();
          console.log(`Removed ${key} subscription`);
        } catch (error) {
          console.log(`Error removing ${key} subscription:`, error);
        }
      });
      
      // Clear the subscriptions object
      listenerSubscription.current = {};
      
      // Clean up any temporary files we might have created
      if (validatedVideoUri && validatedVideoUri.includes(FileSystem.documentDirectory || '')) {
        const cleanPath = validatedVideoUri.replace(/^file:\/\//, '');
        FileSystem.deleteAsync(cleanPath, { idempotent: true }).catch(err => 
          console.log('Failed to cleanup temp video file:', err)
        );
      }
    };
  }, [videoUri, maxDuration, safeOnSave, safeOnCancel, validateAndPrepareVideo]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      callbackExecutedRef.current = false;
      processingRef.current = false;
      
      // Final cleanup of any remaining subscriptions
      Object.keys(listenerSubscription.current).forEach(key => {
        try {
          listenerSubscription.current[key]?.remove();
        } catch (error) {
          console.log(`Final cleanup error for ${key}:`, error);
        }
      });
      
      listenerSubscription.current = {};
    };
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'loading': return 'Preparing video for trimming...';
      case 'ready': return 'Ready to trim';
      case 'processing': return 'Processing video...';
      case 'saving': return 'Saving trimmed video...';
      case 'error': return 'Error occurred';
      default: return 'Loading...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'error': return '#ff0000';
      case 'processing': return '#ff9500';
      case 'saving': return '#007AFF';
      default: return '#4A90E2';
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={getStatusColor()} />
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {getStatusMessage()}
      </Text>
      {status === 'saving' && (
        <Text style={styles.warningText}>
          Please wait, do not close the app...
        </Text>
      )}
      {status === 'loading' && (
        <Text style={styles.helpText}>
          Validating video file and preparing trimmer...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  helpText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default VideoTrimmer;