import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Import services
import CameraCompressionService from '../services/cameraCompressionService';
import videoApiService from '../services/videoApiService';
import { t } from '../utils/i18n';

// --- Enums and Interfaces ---

enum UploadState {
  IDLE = 'idle',
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  PROCESSING = 'processing', // Added for consistency
  COMPLETE = 'complete',
}

interface VideoFile {
  uri: string;
  name: string;
  type: string;
}

// --- Component ---

const CameraUpload: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ videoUri: string; videoName?: string; videoType?: string }>();
  
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // --- State for Progress UI ---
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnimation = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(videoFile?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  const { videoUri, videoName, videoType } = params;

  useEffect(() => {
    if (videoUri) {
      const newVideoFile = {
        uri: videoUri,
        name: videoName || `recorded_video_${Date.now()}.mp4`,
        type: videoType || 'video/mp4',
      };
      setVideoFile(newVideoFile);
    } else {
      Alert.alert(t('videoUploadInterface.alertError'), t('cameraUpload.noVideoProvided'), [
        { text: t('alerts.ok'), onPress: () => router.replace('/(tabs)/post') },
      ]);
    }
  }, [videoUri, videoName, videoType, router]);

  useEffect(() => {
    if (!player || !videoFile) return;
    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && !videoLoaded) {
        setVideoLoaded(true);
      }
    });
    return () => subscription?.remove();
  }, [player, videoFile, videoLoaded]);

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.playing ? player.pause() : player.play();
  }, [player]);

  // --- Progress and State Management Functions ---

  const animateProgress = (progress: number) => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const getUploadStateText = () => {
    switch (uploadState) {
      case UploadState.COMPRESSING:
        // Using correct key from VideoUploadInterface
        return t('videoUploadInterface.compressingVideo') || 'Compressing video...';
      case UploadState.UPLOADING:
        // Using correct key from VideoUploadInterface
        return t('videoUploadInterface.uploadingVideo') || 'Uploading video...';
      case UploadState.PROCESSING:
        // Using correct key from VideoUploadInterface
        return t('videoUploadInterface.processingVideo') || 'Processing video...';
      case UploadState.COMPLETE:
        // Using correct key from VideoUploadInterface
        return t('videoUploadInterface.uploadComplete') || 'Upload complete!';
      default:
        // Default text for the button
        return t('videoUploadInterface.uploadButton') || 'Upload Video';
    }
  };

  const handleSave = async () => {
    if (!videoTitle.trim() || !videoFile) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.enterVideoTitle'));
      return;
    }

    setIsLoading(true);

    try {
      // --- Stage 1: Compression (0% -> 45%) ---
      setUploadState(UploadState.COMPRESSING);
      const compressedUri = await CameraCompressionService.createCompressedCopy(videoFile.uri, {
        maxSizeMB: 15,
        progressCallback: (progress: number) => {
          const progressPercentage = Math.round(progress * 45);
          setUploadProgress(progressPercentage);
          animateProgress(progressPercentage);
        },
      });
      setUploadProgress(45);
      animateProgress(45);

      // --- Stage 2: Uploading (45% -> 90%) ---
      setUploadState(UploadState.UPLOADING);
      const metadata = { name: videoFile.name, title: videoTitle.trim(), caption: '' };
      const fileToUpload = { ...videoFile, uri: compressedUri };
      
      const uploadPromise = videoApiService.uploadVideo(fileToUpload, metadata);
      for (let i = 46; i <= 90; i+=3) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (uploadState === UploadState.UPLOADING) {
          setUploadProgress(i);
          animateProgress(i);
        }
      }
      
      // --- Stage 3: Server Processing (90% -> 99%) ---
      setUploadState(UploadState.PROCESSING);
      animateProgress(95); // Jump to 95 to show processing has started
      const response = await uploadPromise;

      if (response.success) {
        // --- Stage 4: Complete (100%) ---
        setUploadState(UploadState.COMPLETE);
        setUploadProgress(100);
        animateProgress(100);
        setTimeout(() => {
          router.replace('/watchVideos');
        }, 1000);
      } else {
        throw new Error(response.error || t('alerts.unexpectedError'));
      }

    } catch (error: any) {
      console.error('CameraUpload - Upload error:', error);
      // Using correct alert keys from VideoUploadInterface
      Alert.alert(t('videoUploadInterface.alertError'), error.message || t('alerts.unexpectedError'));
      setIsLoading(false);
      setUploadState(UploadState.IDLE);
      setUploadProgress(0);
      animateProgress(0);
    }
  };

  const renderUploadProgress = () => {
    if (!isLoading) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>{getUploadStateText()}</Text>
          <Text style={styles.progressPercentage}>{Math.round(uploadProgress)}%</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderVideoPreview = () => {
    if (!videoFile || !videoFile.uri) {
      return (
        <View style={styles.videoPlaceholder}>
          <ActivityIndicator size="large" color="#3260a0" />
          <Text style={styles.placeholderText}>{t('cameraUpload.loadingVideo')}</Text>
        </View>
      );
    }
    return (
      <View style={styles.videoContainer}>
        <VideoView style={styles.video} player={player} contentFit="contain" />
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons name={player?.playing ? 'pause' : 'play'} size={40} color="white" />
        </TouchableOpacity>
        {!videoLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3260a0" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/post')} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('cameraUpload.recordVideo')}</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.previewSection}>{renderVideoPreview()}</View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>{t('videoUploadInterface.titleLabel')}</Text>
            <TextInput
              style={styles.titleInput}
              placeholder={t('videoUploadInterface.enterTitlePlaceholder')}
              value={videoTitle}
              onChangeText={setVideoTitle}
              editable={!isLoading}
            />
          </View>

          {renderUploadProgress()}

          <View style={styles.uploadSection}>
            <TouchableOpacity
              style={[styles.uploadButton, (!videoFile || !videoTitle.trim() || isLoading) && styles.disabledButton]}
              onPress={handleSave}
              disabled={!videoFile || !videoTitle.trim() || isLoading}
            >
              <Ionicons name="cloud-upload-outline" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.uploadButtonText}>
                {/* Using the correct key for the button text */}
                {isLoading ? getUploadStateText() : (t('videoUploadInterface.uploadButton') || 'Upload Video')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.recordButton, isLoading && styles.disabledButton]}
              onPress={() => router.replace({ pathname: '/camera', params: { fromCameraUpload: 'true' } })}
              disabled={isLoading}
            >
              <Ionicons name="camera-outline" size={24} color="#3260ad" style={styles.buttonIcon} />
              <Text style={styles.recordButtonText}>{t('videoUploadInterface.recordAgainButton') || 'Record Again'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  closeButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  placeholder: { width: 34 },
  scrollContainer: { paddingBottom: 20 },
  previewSection: { marginHorizontal: 20, marginTop: 20 },
  videoContainer: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
  videoPlaceholder: { backgroundColor: 'white', borderRadius: 12, height: 200, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  placeholderText: { marginTop: 10, color: '#666', fontSize: 16 },
  playButton: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }], backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  inputSection: { marginHorizontal: 20, marginTop: 20 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  titleInput: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  uploadSection: { marginHorizontal: 20, marginTop: 20 },
  uploadButton: { backgroundColor: '#3260ad', paddingVertical: 15, borderRadius: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  recordButton: { backgroundColor: '#e0e0e0', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 15, flexDirection: 'row', justifyContent: 'center' },
  recordButtonText: { color: '#3260ad', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  buttonIcon: { marginRight: 5 },
  disabledButton: { backgroundColor: '#bdc3c7' },
  progressContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333'
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3260ad'
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3260ad',
    borderRadius: 4
  },
});

export default CameraUpload;