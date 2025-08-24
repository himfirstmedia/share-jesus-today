import { t } from '@/utils/i18n';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'kroog-ffmpeg-kit-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import VideoTrimmerUI from 'react-native-video-trimmer-ui';

// --- Utility Functions ---
const normalizeUri = (uri: string): string => {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

const getCleanPath = (uri: string): string => {
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

interface VideoTrimmerProps {
  videoUri: string;
  maxDuration: number;
  onCancel: () => void;
  onTrimComplete: (videoData: { startTime: number, endTime: number, uri: string }) => void;
}

const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  videoUri,
  maxDuration,
  onCancel,
  onTrimComplete,
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'trimming' | 'error'>('loading');
  const [validatedVideoUri, setValidatedVideoUri] = useState<string>('');
  const [trimTimes, setTrimTimes] = useState<{ startTime: number; endTime: number } | null>(null);
  const trimmerRef = useRef(null);

  const validateAndPrepareVideo = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const isValid = await validateFilePath(uri);
      if (!isValid) {
        throw new Error(`File validation failed for URI: ${uri}`);
      }
      const normalizedUri = normalizeUri(uri);
      const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
      if (!fileInfo.exists || !fileInfo.size) {
        throw new Error(`Video file not found or is empty at: ${normalizedUri}`);
      }
      return normalizedUri;
    } catch (error) {
      console.error('Video validation failed:', error);
      Alert.alert(t('alerts.error'), t('alerts.trimmingErrorMessageFileNotFound'));
      onCancel();
      return null;
    }
  }, [onCancel]);

  useEffect(() => {
    const init = async () => {
      const preparedUri = await validateAndPrepareVideo(videoUri);
      if (preparedUri) {
        setValidatedVideoUri(preparedUri);
        setStatus('ready');
      }
    };
    init();
  }, [videoUri, validateAndPrepareVideo]);

  const handleTrim = async () => {
    if (!trimTimes || !validatedVideoUri) {
      Alert.alert(t('alerts.error'), 'Please select a trim range.');
      return;
    }

    setStatus('trimming');

    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const outputUri = `${videoFilesDirectory}trimmed_${Date.now()}.mp4`;
      const cleanInputPath = getCleanPath(validatedVideoUri);
      const cleanOutputPath = getCleanPath(outputUri);

      const command = `-i "${cleanInputPath}" -ss ${trimTimes.startTime} -to ${trimTimes.endTime} -c copy "${cleanOutputPath}"`;

      console.log('Executing FFmpeg command:', command);

      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        console.log('Trimming successful');
        const fileInfo = await FileSystem.getInfoAsync(outputUri);
        if (!fileInfo.exists || !fileInfo.size) {
          throw new Error('Trimmed file not created or is empty.');
        }
        onTrimComplete({ ...trimTimes, uri: outputUri });
      } else {
        const logs = await session.getOutput();
        console.error('FFmpeg trimming failed. Logs:', logs);
        throw new Error(`FFmpeg process failed with return code ${returnCode}.`);
      }
    } catch (error) {
      console.error('Error during trimming:', error);
      Alert.alert(t('alerts.trimmingErrorTitle'), (error as Error).message);
      setStatus('ready');
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>{t('videoTrimmer.preparing')}</Text>
      </View>
    );
  }

  if (status === 'trimming') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.statusText}>{t('videoTrimmer.processing')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {validatedVideoUri ? (
        <VideoTrimmerUI
          ref={trimmerRef}
          source={{ uri: validatedVideoUri }}
          onSelected={(startTime, endTime) => setTrimTimes({ startTime, endTime })}
          minDuration={1}
          maxDuration={maxDuration}
          tintColor="#E44D26"
        />
      ) : (
        <ActivityIndicator size="large" />
      )}
      <View style={styles.buttonContainer}>
        <Button title={t('common.cancel')} onPress={onCancel} color="#E44D26" />
        <Button title={t('common.trim')} onPress={handleTrim} disabled={!trimTimes} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  statusText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
  },
});

export default VideoTrimmer;