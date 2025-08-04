import { t } from '@/utils/i18n';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert, Platform, StyleSheet,
  Text,
  View,
  type EventSubscription
} from 'react-native';
import NativeVideoTrim, { isValidFile, showEditor } from 'react-native-video-trim';

// --- Utility Functions ---
const normalizeUri = (uri: string): string => {
  // Ensure consistent file:// protocol for Expo FileSystem
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

const getCleanPath = (uri: string): string => {
  // Remove file:// for native library compatibility
  return uri.replace(/^file:\/\//, '');
};

const validateFilePath = async (uri: string): Promise<boolean> => {
  try {
    const normalizedUri = normalizeUri(uri);
    const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
    return fileInfo.exists && (fileInfo.size || 0) > 0;
  } catch {
    return false;
  }
};

// --- Persistent Storage Functions ---
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
    const fileName = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
    const permanentUri = `${videoFilesDirectory}${fileName}`;
    
    const sourceUri = normalizeUri(temporaryUri);
    const destUri = normalizeUri(permanentUri);
    
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
  const tempFilesRef = useRef<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'processing' | 'saving' | 'error'>('loading');
  const [validatedVideoUri, setValidatedVideoUri] = useState<string>('');

  // Cleanup temporary files
  const cleanupTempFiles = useCallback(async (filePaths: string[]) => {
    for (const path of filePaths) {
      try {
        const normalized = normalizeUri(path); // ensure file:// for deletion (fix)
        if (normalized && normalized.includes(FileSystem.documentDirectory || '')) {
          await FileSystem.deleteAsync(normalized, { idempotent: true });
          console.log('Cleaned up temp file:', normalized);
        }
      } catch (error) {
        console.log('Failed to cleanup file:', path, error);
      }
    }
  }, []);

  // Function to verify and prepare video file for trimming
  const validateAndPrepareVideo = useCallback(async (uri: string): Promise<string> => {
    try {
      console.log('Validating video file at:', uri);
      
      // Normalize the URI for consistent handling
      const normalizedUri = normalizeUri(uri);
      console.log('Normalized URI:', normalizedUri);
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      console.log('File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error(`Video file not found at: ${normalizedUri}`);
      }
      
      if (!fileInfo.size || fileInfo.size === 0) {
        throw new Error('Invalid video file: file is empty');
      }
      
      // For iOS, always copy to a safe location in documents directory
      // Also copy if file is in cache/temp directories for stability
      if (normalizedUri.includes('tmp') || 
          normalizedUri.includes('cache') || 
          normalizedUri.includes('Library/Caches') ||
          !normalizedUri.includes(FileSystem.documentDirectory || '')) {
        
        console.log('Copying file to documents directory for compatibility...');
        
        const fileName = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`;
        const documentsPath = `${FileSystem.documentDirectory}${fileName}`;
        
        try {
          await FileSystem.copyAsync({ 
            from: normalizedUri, 
            to: documentsPath 
          });
          
          // Verify the copy succeeded
          const copiedInfo = await FileSystem.getInfoAsync(documentsPath);
          if (!copiedInfo.exists || !copiedInfo.size) {
            throw new Error('Failed to copy video file');
          }
          
          console.log('File successfully copied to:', documentsPath);
          
          // Track temp file for cleanup
          tempFilesRef.current.push(documentsPath);
          
          return documentsPath;
          
        } catch (copyError) {
          console.error('Copy failed:', copyError);
          // If copy fails, try to use original if it's accessible
          try {
            await FileSystem.getInfoAsync(normalizedUri, { size: true });
            return normalizedUri;
          } catch {
            throw new Error('Cannot access video file');
          }
        }
      }
      
      return normalizedUri;
      
    } catch (error) {
      console.error('Video validation failed:', error);
      throw error;
    }
  }, []);

  // Safe wrapper for the onSave callback
  const safeOnSave = useCallback(async (startTime: number, endTime: number, outputPath: string) => {
    if (callbackExecutedRef.current || processingRef.current) {
      console.log('onSave already executed or processing, skipping...');
      return;
    }

    callbackExecutedRef.current = true;
    processingRef.current = true;
    setStatus('saving');

    setTimeout(async () => {
      try {
        console.log('Executing onSave callback safely:', { startTime, endTime, outputPath });
        
        if (!outputPath || typeof outputPath !== 'string') {
          throw new Error('Invalid output path provided');
        }

        if (typeof startTime !== 'number' || typeof endTime !== 'number') {
          throw new Error('Invalid time parameters provided');
        }

        const outputPathWithProtocol = normalizeUri(outputPath);
        const trimmedFileInfo = await FileSystem.getInfoAsync(outputPathWithProtocol);
        
        if (!trimmedFileInfo.exists) {
          throw new Error(`Trimmed video file not found at: ${outputPath}`);
        }

        console.log('Trimmed video file exists, size:', trimmedFileInfo.size);

        const persistentTrimmedUri = await ensureVideoIsPersistent(outputPath);
        console.log('Trimmed video moved to persistent storage:', persistentTrimmedUri);

        await onSave(startTime, endTime, persistentTrimmedUri);
        console.log('onSave callback completed successfully');
        
      } catch (error) {
        console.error('Error in onSave callback:', error);
        
        Alert.alert(
          t('alerts.saveErrorTitle',),
          t('alerts.saveErrorMessageGeneric'),
          [
            {
              text: t('alerts.ok'),
              onPress: () => {
                if (isMountedRef.current) {
                  onCancel();
                }
              }
            }
          ]
        );
      } finally {
        setTimeout(() => {
          processingRef.current = false;
          if (isMountedRef.current) {
            setStatus('ready');
          }
        }, 500);
      }
    }, Platform.OS === 'ios' ? 400 : 300);
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

  const executeOnce = useCallback((callback: () => void, delay = 0) => {
    if (callbackExecutedRef.current || processingRef.current || !isMountedRef.current) {
      console.log('Execution blocked - already processed or unmounted');
      return;
    }
    
    callbackExecutedRef.current = true;
    processingRef.current = true;
    
    setTimeout(callback, delay);
  }, []);

  const setupEventListeners = useCallback(() => {
    try {
      console.log('Setting up video trim event listeners...');

      listenerSubscription.current.onLoad = NativeVideoTrim.onLoad(
        ({ duration }) => {
          console.log('VideoTrim onLoad', duration);
          if (isMountedRef.current && !callbackExecutedRef.current) {
            setStatus('ready');
          }
        }
      );

      listenerSubscription.current.onShow = NativeVideoTrim.onShow(() => {
        console.log('VideoTrim onShow - Trimmer modal shown');
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('ready');
        }
      });

      listenerSubscription.current.onStartTrimming = NativeVideoTrim.onStartTrimming(() => {
        console.log('VideoTrim onStartTrimming - Trimming process started');
        if (isMountedRef.current && !callbackExecutedRef.current) {
          setStatus('processing');
        }
      });

      listenerSubscription.current.onFinishTrimming = NativeVideoTrim.onFinishTrimming(
        ({ outputPath, startTime, endTime, duration }) => {
          console.log('VideoTrim onFinishTrimming', { outputPath, startTime, endTime, duration });
          
          if (!outputPath || typeof outputPath !== 'string') {
            console.error('Invalid output path received:', outputPath);
            Alert.alert(
              t('alerts.error'), 
              t('alerts.trimmingErrorMessageGeneric'),
              [{ text: t('alerts.ok'), onPress: () => safeOnCancel() }]
            );
            return;
          }
          safeOnSave(startTime || 0, endTime || 0, outputPath);
        }
      );

      listenerSubscription.current.onCancelTrimming = NativeVideoTrim.onCancelTrimming(() => {
        console.log('VideoTrim onCancelTrimming - User cancelled trimming');
        safeOnCancel();
      });

      listenerSubscription.current.onCancel = NativeVideoTrim.onCancel(() => {
        console.log('VideoTrim onCancel - General cancel event');
        safeOnCancel();
      });

      listenerSubscription.current.onHide = NativeVideoTrim.onHide(() => {
        console.log('VideoTrim onHide - Trimmer modal hidden');
      });

      listenerSubscription.current.onError = NativeVideoTrim.onError(
        ({ message, errorCode }) => {
          console.error('VideoTrim onError', { message, errorCode });
          
          executeOnce(() => {
            let errorMessage = message || 'An error occurred during video trimming.';
            if (message && message.includes('No such file or directory')) {
              errorMessage = t('alerts.trimmingErrorMessageFileNotFound', { defaultValue: 'Video file not found. Please select the video again.' });
            } else if (message && (message.includes('Command failed') || message.includes('codec'))) {
              errorMessage = t('alerts.trimmingErrorMessageInvalidFile', { defaultValue: 'Video processing failed. The file might be corrupted or in an unsupported format.' });
            } else if (message && message.includes('permission')) {
              errorMessage = t('alerts.trimmingErrorMessagePermission', { defaultValue: 'Permission denied. Cannot access the video file.' });
            }
            
            Alert.alert(
              t('alerts.trimmingErrorTitle', { defaultValue: 'Trimming Error' }), 
              errorMessage, 
              [{ text: t('alerts.ok', { defaultValue: 'OK' }), onPress: () => safeOnCancel() }]
            );
          }, 200);
        }
      );

      console.log('Event listeners setup completed');

    } catch (error) {
      console.error('Error setting up event listeners:', error);
      if (isMountedRef.current) {
        setStatus('error');
        safeOnCancel();
      }
    }
  }, [executeOnce, safeOnSave, safeOnCancel]);

  // Initialize trimmer
  const initializeTrimmer = useCallback(async () => {
    try {
      console.log('Initializing video trimmer for:', videoUri);
      
      const preparedUri = await validateAndPrepareVideo(videoUri);
      setValidatedVideoUri(preparedUri);
      
      console.log('Video file prepared:', preparedUri);
      
      const cleanUriForValidation = getCleanPath(preparedUri);
      
      const validationTimeout = Platform.OS === 'ios' ? 10000 : 15000;
      
      const isValid = await Promise.race([
        isValidFile(cleanUriForValidation),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), validationTimeout)
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
        ...(Platform.OS === 'ios' && {
          quality: 'medium',
          frameRate: 30,
        })
      };

      console.log('VideoTrimmer - Using config:', trimmerConfig);
      
      // FIX: Use file:// on iOS, plain path on Android when calling showEditor
      const editorInput = Platform.OS === 'ios'
        ? normalizeUri(preparedUri)
        : getCleanPath(preparedUri);

      await showEditor(editorInput, trimmerConfig);
      
    } catch (error) {
      console.error('Error initializing video trimmer:', error);
      
      if (isMountedRef.current && !callbackExecutedRef.current) {
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        let userMessage = t('alerts.trimmingErrorMessageGeneric', { defaultValue: 'Unable to load video for trimming' });
        
        if (errorMessage.includes('No such file or directory') || errorMessage.includes('not found')) {
          userMessage = t('alerts.trimmingErrorMessageFileNotFound', { defaultValue: 'Video file not found. Please select the video again.' });
        } else if (errorMessage.includes('timeout')) {
          userMessage = t('alerts.trimmingErrorMessageTimeout', { defaultValue: 'Video loading timed out. Please try again.' });
        } else if (errorMessage.includes('Invalid') || errorMessage.includes('corrupted') || errorMessage.includes('format')) {
          userMessage = t('alerts.trimmingErrorMessageInvalidFile', { defaultValue: 'This video format is not supported or the file is corrupted.' });
        } else if (errorMessage.includes('copy') || errorMessage.includes('permission') || errorMessage.includes('access')) {
          userMessage = t('alerts.trimmingErrorMessagePermission', { defaultValue: 'Cannot access the video file. Please check permissions and try again.' });
        }
        
        Alert.alert(
          t('alerts.error', { defaultValue: 'Error' }), 
          userMessage, 
          [{ text: t('alerts.ok', { defaultValue: 'OK' }), onPress: () => safeOnCancel() }]
        );
      }
    }
  }, [videoUri, maxDuration, validateAndPrepareVideo, safeOnCancel]);

  // Main effect for component initialization
  useEffect(() => {
    console.log('VideoTrimmer component mounted');
    isMountedRef.current = true;
    callbackExecutedRef.current = false;
    processingRef.current = false;
    tempFilesRef.current = [];
    setStatus('loading');

    setupEventListeners();
    initializeTrimmer();

    return () => {
      console.log('VideoTrimmer cleanup initiated');
      isMountedRef.current = false;
      
      Object.keys(listenerSubscription.current).forEach(key => {
        try {
          listenerSubscription.current[key]?.remove();
          console.log(`Removed ${key} subscription`);
        } catch (error) {
          console.log(`Error removing ${key} subscription:`, error);
        }
      });
      
      listenerSubscription.current = {};
      
      if (tempFilesRef.current.length > 0) {
        cleanupTempFiles(tempFilesRef.current);
      }
    };
  }, [setupEventListeners, initializeTrimmer, cleanupTempFiles]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      callbackExecutedRef.current = false;
      processingRef.current = false;
      
      Object.keys(listenerSubscription.current).forEach(key => {
        try {
          listenerSubscription.current[key]?.remove();
        } catch (error) {
          console.log(`Final cleanup error for ${key}:`, error);
        }
      });
      
      listenerSubscription.current = {};
      
      if ((global as any).gc && Platform.OS === 'ios') {
        try {
          (global as any).gc();
        } catch (e) {
          // Ignore if gc is not available
        }
      }
    };
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'loading': return t('videoTrimmer.preparing', { defaultValue: 'Preparing video for trimming...' });
      case 'ready': return t('videoTrimmer.ready', { defaultValue: 'Ready to trim' });
      case 'processing': return t('videoTrimmer.processing', { defaultValue: 'Processing video...' });
      case 'saving': return t('videoTrimmer.saving', { defaultValue: 'Saving trimmed video...' });
      case 'error': return t('videoTrimmer.error', { defaultValue: 'Error occurred' });
      default: return t('videoTrimmer.loading', { defaultValue: 'Loading...' });
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
          {t('videoTrimmer.pleaseWait', { defaultValue: 'Please wait, do not close the app...' })}
        </Text>
      )}
      {status === 'loading' && (
        <Text style={styles.helpText}>
          {t('videoTrimmer.validating', { defaultValue: 'Validating video file and preparing trimmer...' })}
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
    paddingHorizontal: 20,
  },
  warningText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
  helpText: {
    marginTop: 8,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default VideoTrimmer;