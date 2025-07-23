// app/CameraUpload.tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import videoApiService from '../services/videoApiService';
import { t } from '../utils/i18n';

interface VideoFile {
  uri: string;
  name: string; // Made required
  type: string; // Made required to match service expectation
}

const CameraUpload: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ videoUri: string; videoName?: string; videoType?: string }>();
  
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const player = useVideoPlayer(videoFile?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Fix: Extract the specific params we need and use them as dependencies
  const { videoUri, videoName, videoType } = params;

  useEffect(() => {
    console.log('CameraUpload: Component mounted. Received params:', { videoUri, videoName, videoType });
    
    if (videoUri) {
      console.log('CameraUpload - Received video URI in useEffect:', videoUri);
      const newVideoFile = {
        uri: videoUri,
        name: videoName || `recorded_video_${Date.now()}.mp4`,
        type: videoType || 'video/mp4',
      };
      setVideoFile(newVideoFile);
      console.log('CameraUpload - videoFile state set:', newVideoFile);
    } else {
      Alert.alert(t('cameraUpload.error'), t('cameraUpload.noVideoProvided'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)/post') },
      ]);
    }
  }, [videoUri, videoName, videoType, router]); // Fix: Use specific param values instead of params object

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

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert(t('cameraUpload.error'), t('cameraUpload.enterVideoTitle'));
      return;
    }
    if (!videoFile || !videoFile.uri) {
      Alert.alert(t('cameraUpload.error'), t('cameraUpload.noValidVideoToUpload'));
      return;
    }

    setIsLoading(true);
    try {
      const metadata = {
        name: videoFile.name!,
        title: videoTitle.trim(),
        caption: '', // No caption field in this simplified view
      };

      const response = await videoApiService.uploadVideo(videoFile, metadata);
      if (response.success) {
        Alert.alert(t('cameraUpload.success'), t('cameraUpload.videoUploadedSuccessfully'), [
          { text: t('common.ok'), onPress: () => router.replace('/watchVideos') },
        ]);
      } else {
        Alert.alert(t('cameraUpload.error'), response.error || t('cameraUpload.failedToUploadVideo'));
      }
    } catch (error) {
      console.error('CameraUpload - Upload error:', error);
      Alert.alert(t('cameraUpload.error'), t('cameraUpload.unexpectedUploadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderVideoPreview = () => {
    if (!videoFile || !videoFile.uri) {
      return (
        <View style={styles.videoPlaceholder}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.placeholderText}>{t('cameraUpload.loadingVideo')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          contentFit="contain"
        />
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons name={player?.playing ? 'pause' : 'play'} size={40} color="white" />
        </TouchableOpacity>
        {!videoLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4A90E2" />
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

      <View style={styles.previewSection}>
        {renderVideoPreview()}
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>{t('cameraUpload.recordVideo')}</Text>
        <TextInput
          style={styles.titleInput}
          placeholder={t('cameraUpload.enterTitlePlaceholder')}
          value={videoTitle}
          onChangeText={setVideoTitle}
          editable={!isLoading}
        />
      </View>

      <View style={styles.uploadSection}>
        <TouchableOpacity
          style={[styles.uploadButton, (!videoFile || !videoTitle.trim() || isLoading) && styles.disabledButton]}
          onPress={handleSave}
          disabled={!videoFile || !videoTitle.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>{t('cameraUpload.uploadVideo')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  closeButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  placeholder: { width: 34 },
  previewSection: { marginHorizontal: 20, marginVertical: 20 },
  videoContainer: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
  videoPlaceholder: { backgroundColor: 'white', borderRadius: 12, height: 200, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  placeholderText: { marginTop: 10, color: '#666', fontSize: 16 },
  playButton: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }], backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  inputSection: { marginHorizontal: 20, marginBottom: 20 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  titleInput: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  uploadSection: { marginHorizontal: 20, marginBottom: 20 },
  uploadButton: { backgroundColor: '#4A90E0', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  disabledButton: { backgroundColor: '#bdc3c7', opacity: 0.7 },
});

export default CameraUpload;