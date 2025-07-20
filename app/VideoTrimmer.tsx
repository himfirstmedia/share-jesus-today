import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Alert,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
// This component uses a native module that requires a custom development client for Expo.
import { isValidFile, showEditor } from 'react-native-video-trim';

const IS_VALID_FILE_TIMEOUT = 15000; // 15 seconds
const { VideoTrim } = NativeModules;
const videoTrimEmitter = new NativeEventEmitter(VideoTrim);

interface VideoTrimmerProps {
  videoUri: string;
  maxDuration: number;
  onCancel: () => void;
  onSave: (startTime: number, endTime: number, outputPath: string) => Promise<void>;
}

const VideoTrimmerComponent: React.FC<VideoTrimmerProps> = ({
  videoUri,
  maxDuration,
  onCancel,
  onSave,
}) => {
  const isMountedRef = useRef(true);
  const callbackExecutedRef = useRef(false);

  const validateOutputFile = useCallback(async (outputPath: string): Promise<string> => {
    try {
      const cleanPath = outputPath.startsWith('file://') ? outputPath.substring(7) : outputPath;
      await new Promise(resolve => setTimeout(resolve, 500));
      const fileInfo = await FileSystem.getInfoAsync(cleanPath);
      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error('Output file is invalid or empty.');
      }
      return `file://${cleanPath}`;
    } catch (error) {
      console.error('Output file validation failed:', error);
      throw error;
    }
  }, []);

  const safeOnCancel = useCallback(() => {
    if (isMountedRef.current && !callbackExecutedRef.current) {
      callbackExecutedRef.current = true;
      onCancel();
    }
  }, [onCancel]);

  const safeOnSave = useCallback(async (outputPath: string) => {
    if (isMountedRef.current && !callbackExecutedRef.current) {
      callbackExecutedRef.current = true;
      try {
        await onSave(0, 0, outputPath);
      } catch (error) {
        console.error('Error in onSave callback:', error);
        // If the save fails, we should still cancel to close the modal
        safeOnCancel();
      }
    }
  }, [onSave, safeOnCancel]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!videoUri) {
      Alert.alert('Error', 'No video file provided.', [{ text: 'OK', onPress: safeOnCancel }]);
      return;
    }

    const eventListener = videoTrimEmitter.addListener('VideoTrim', async (event: any) => {
      console.log('VideoTrim Event:', event.name, event);
      if (!isMountedRef.current || callbackExecutedRef.current) return;

      switch (event.name) {
        case 'onFinishTrimming':
          try {
            const validatedPath = await validateOutputFile(event.outputPath);
            await safeOnSave(validatedPath);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to process trimmed video.';
            Alert.alert('Processing Error', message, [{ text: 'OK', onPress: safeOnCancel }]);
          }
          break;
        case 'onCancelTrimming':
          safeOnCancel();
          break;
        case 'onError':
          Alert.alert('Trimmer Error', event.message || 'An unknown error occurred.', [{ text: 'OK', onPress: safeOnCancel }]);
          break;
      }
    });

    const initialize = async () => {
      try {
        const cleanUri = videoUri.startsWith('file://') ? videoUri.substring(7) : videoUri;
        const isValid = await Promise.race([
          isValidFile(cleanUri),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Validation timed out')), IS_VALID_FILE_TIMEOUT)),
        ]);

        if (!isValid) {
          throw new Error('Invalid or corrupted video file.');
        }
        
        showEditor(cleanUri, { maxDuration });

      } catch (error) {
        if (isMountedRef.current) {
          const message = error instanceof Error ? error.message : 'Failed to initialize trimmer.';
          Alert.alert('Trimmer Error', message, [{ text: 'OK', onPress: safeOnCancel }]);
        }
      }
    };

    // A small delay to allow the modal to animate in before launching the native editor
    const timer = setTimeout(initialize, 200);

    return () => {
      clearTimeout(timer);
      eventListener.remove();
    };
  }, [videoUri, maxDuration, validateOutputFile, safeOnCancel, safeOnSave]);

  // This component is headless and renders nothing.
  return null;
};

export default VideoTrimmerComponent;
