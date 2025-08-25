import { t } from '@/utils/i18n';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Button,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import VideoTrimmerUI from 'react-native-video-trimmer-ui';

// Import our native module
import Media3VideoTrimmer, { VideoInfo, VideoTrimOptions } from '../src/modules/Media3VideoTrimmer';

// --- Utility Functions ---
const normalizeUri = (uri: string): string => {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
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

const Media3VideoTrimmerComponent: React.FC<VideoTrimmerProps> = ({
  videoUri,
  maxDuration,
  onCancel,
  onTrimComplete,
}) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'trimming' | 'error'>('loading');
  const [validatedVideoUri, setValidatedVideoUri] = useState<string>('');
  const [trimTimes, setTrimTimes] = useState<{ startTime: number; endTime: number } | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isMedia3Available, setIsMedia3Available] = useState<boolean>(false);
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

  const checkMedia3Availability = useCallback(() => {
    try {
      const available = Platform.OS === 'android' && !!Media3VideoTrimmer;
      setIsMedia3Available(available);
      console.log('Media3VideoTrimmer availability:', available);
      return available;
    } catch (error) {
      console.error('Error checking Media3 availability:', error);
      setIsMedia3Available(false);
      return false;
    }
  }, []);

  const getVideoInformation = useCallback(async (uri: string) => {
    if (!isMedia3Available) return;

    try {
      console.log('Getting video info for:', uri);
      const info = await Media3VideoTrimmer.getVideoInfo(uri);
      setVideoInfo(info);
      console.log('Video info:', info);
    } catch (error) {
      console.warn('Could not get video info:', error);
      // Don't throw error, just continue without video info
    }
  }, [isMedia3Available]);

  useEffect(() => {
    const init = async () => {
      const media3Ready = checkMedia3Availability();
      
      if (!media3Ready) {
        Alert.alert(
          'Android Only',
          'Media3 video trimming is only available on Android devices.',
          [{ text: 'OK', onPress: onCancel }]
        );
        return;
      }

      const preparedUri = await validateAndPrepareVideo(videoUri);
      if (preparedUri) {
        setValidatedVideoUri(preparedUri);
        await getVideoInformation(preparedUri);
        setStatus('ready');
      }
    };
    init();
  }, [videoUri, validateAndPrepareVideo, checkMedia3Availability, getVideoInformation, onCancel]);

  const handleTrim = async () => {
    if (!trimTimes || !validatedVideoUri) {
      Alert.alert(t('alerts.error'), 'Please select a trim range.');
      return;
    }

    if (!isMedia3Available) {
      Alert.alert('Error', 'Media3VideoTrimmer is not available.');
      return;
    }

    setStatus('trimming');

    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const outputUri = `${videoFilesDirectory}trimmed_${Date.now()}.mp4`;

      console.log('Starting Media3 video trimming:');
      console.log('- Input:', validatedVideoUri);
      console.log('- Output:', outputUri);
      console.log('- Start time:', trimTimes.startTime, 's');
      console.log('- End time:', trimTimes.endTime, 's');

      const trimOptions: VideoTrimOptions = {
        inputUri: validatedVideoUri,
        outputUri,
        startTimeMs: Math.floor(trimTimes.startTime * 1000),
        endTimeMs: Math.floor(trimTimes.endTime * 1000),
      };

      const result = await Media3VideoTrimmer.trimVideo(trimOptions);
      
      console.log('Media3 trimming result:', result);

      if (result.success) {
        // Verify the output file exists
        const fileInfo = await FileSystem.getInfoAsync(result.outputUri);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log('Media3 trimming successful, file size:', fileInfo.size);
          onTrimComplete({ 
            startTime: trimTimes.startTime,
            endTime: trimTimes.endTime,
            uri: result.outputUri 
          });
        } else {
          throw new Error('Output file was not created or is empty');
        }
      } else {
        throw new Error(result.message || 'Media3 trimming failed');
      }

    } catch (error) {
      console.error('Error during Media3 trimming:', error);
      Alert.alert(
        t('alerts.trimmingErrorTitle'), 
        `Media3 trimming failed: ${(error as Error).message}`
      );
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
        <ActivityIndicator size="large" color="#4caf50" />
        <Text style={styles.statusText}>Processing with Android Media3...</Text>
        <Text style={styles.subStatusText}>Native hardware acceleration</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>🎬 Android Media3 Video Trimmer</Text>
        <Text style={styles.subHeaderText}>Native • Fast • Reliable</Text>
      </View>

      {videoInfo && (
        <View style={styles.videoInfoContainer}>
          <Text style={styles.videoInfoTitle}>Video Information</Text>
          <Text style={styles.videoInfoText}>
            Duration: {Math.round(videoInfo.duration / 1000)}s | 
            Size: {videoInfo.width}×{videoInfo.height} | 
            Bitrate: {Math.round(videoInfo.bitrate / 1000)}kbps
          </Text>
        </View>
      )}
      
      {validatedVideoUri ? (
        <VideoTrimmerUI
          ref={trimmerRef}
          source={{ uri: validatedVideoUri }}
          onSelected={(startTime, endTime) => {
            setTrimTimes({ startTime, endTime });
            console.log(`Selected trim range: ${startTime}s - ${endTime}s`);
          }}
          minDuration={1}
          maxDuration={maxDuration}
          tintColor="#4caf50"
        />
      ) : (
        <ActivityIndicator size="large" />
      )}
      
      <View style={styles.buttonContainer}>
        <Button title={t('common.cancel')} onPress={onCancel} color="#f44336" />
        <Button 
          title="✂️ Trim Video" 
          onPress={handleTrim} 
          disabled={!trimTimes}
          color="#4caf50"
        />
      </View>
      
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Media3 Advantages:</Text>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>⚡</Text>
          <Text style={styles.featureText}>Hardware accelerated processing</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>📱</Text>
          <Text style={styles.featureText}>Native Android MediaMuxer</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🏋️</Text>
          <Text style={styles.featureText}>Lightweight (no external libs)</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureIcon}>🔧</Text>
          <Text style={styles.featureText}>Always available on Android</Text>
        </View>
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
    color: '#333',
  },
  subStatusText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  headerContainer: {
    backgroundColor: '#4caf50',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  videoInfoContainer: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    margin: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2196f3',
  },
  videoInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 4,
  },
  videoInfoText: {
    fontSize: 12,
    color: '#1976d2',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    margin: 10,
    borderRadius: 8,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
  },
  featureText: {
    fontSize: 12,
    color: '#6c757d',
    flex: 1,
  },
});

export default Media3VideoTrimmerComponent;