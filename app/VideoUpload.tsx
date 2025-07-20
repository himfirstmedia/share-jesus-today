// Enhanced VideoUpload.tsx optimized for expo-video
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import videoApiService from '../services/videoApiService';
import VideoCompressionService from '../services/videoCompressionService';
import { t } from '../utils/i18n';
import VideoTrimmer from './VideoTrimmer';

const { width, height } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30; // 30 seconds

// --- Utility Functions ---

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
    
    await FileSystem.copyAsync({ from: temporaryUri, to: permanentUri });

    const fileInfo = await FileSystem.getInfoAsync(permanentUri, { size: true });
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Failed to copy video to persistent storage.');
    }
    return permanentUri;
  } catch (error) {
    console.error('ERROR: Failed to make video persistent:', error);
    throw error;
  }
};

// --- Interfaces ---

interface VideoFile {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string;
}

interface VideoUploadProps {
  onCancel?: () => void;
  onComplete: (videoData?: any) => void;
}

// --- Component ---

const VideoUpload: React.FC<VideoUploadProps> = ({ 
  onCancel, 
  onComplete 
}) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);
  
  const player = useVideoPlayer(selectedVideo?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  useEffect(() => {
    if (!player || !selectedVideo || showTrimmer) return;

    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && !videoLoaded && !showTrimmer) {
        setVideoLoaded(true);
        const durationSeconds = player.duration || 0;
        setVideoDuration(durationSeconds);
        
        if (!hasBeenTrimmed && durationSeconds > MAX_VIDEO_DURATION + 0.1) {
          setOriginalDuration(durationSeconds);
          setNeedsTrimming(true);
        } else if (!hasBeenTrimmed) {
          setOriginalDuration(durationSeconds);
          setNeedsTrimming(false);
        }
      }
    });

    return () => subscription?.remove();
  }, [player, videoLoaded, hasBeenTrimmed, originalDuration, selectedVideo, showTrimmer]);

  const handleSelectVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (!asset.uri) throw new Error('No URI in selected video');

        const persistentUri = await ensureVideoIsPersistent(asset.uri);
        const videoFile: VideoFile = {
          uri: persistentUri,
          name: asset.name || `video_${Date.now()}.mp4`,
          type: asset.mimeType || 'video/mp4',
        };

        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setNeedsTrimming(false);
        setVideoLoaded(false);
        setVideoDuration(0);
        setSelectedVideo(videoFile);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    if (!outputPath) {
      Alert.alert('Error', 'Trimming failed to produce an output file.');
      setShowTrimmer(false);
      return;
    }
    
    if (selectedVideo) {
      const updatedVideo: VideoFile = {
        ...selectedVideo,
        uri: outputPath,
      };
      
      setHasBeenTrimmed(true);
      setNeedsTrimming(false);
      setShowTrimmer(false);
      setVideoLoaded(false);
      
      // Let the player determine the new duration upon reload
      setVideoDuration(0); 
      
      setSelectedVideo(updatedVideo);
    }
  };

  const handleTrimCancel = () => {
    setShowTrimmer(false);
  };

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.playing ? player.pause() : player.play();
  }, [player]);

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert('Error', 'Please enter a video title.');
      return;
    }
    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert('Error', 'Please select a video.');
      return;
    }

    setIsLoading(true);
    try {
      const compressedUri = await VideoCompressionService.createCompressedCopy(selectedVideo.uri);

      const metadata = {
        name: selectedVideo.name!,
        title: videoTitle.trim(),
        caption: '',
        originalDuration: originalDuration || videoDuration,
        wasTrimmed: hasBeenTrimmed,
      };

      const videoToUpload = { ...selectedVideo, uri: compressedUri };

      const response = await videoApiService.uploadVideo(videoToUpload, metadata);
      if (response.success) {
        Alert.alert('Success', 'Video uploaded successfully!', [
          { text: 'OK', onPress: () => onComplete(response.data) }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to upload video.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during upload.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderVideoPreview = () => {
    if (!selectedVideo) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={80} color="#4A90E2" />
          <Text style={styles.placeholderText}>No video selected</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <VideoView style={styles.video} player={player} contentFit="contain" />
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons name={player?.playing ? "pause" : "play"} size={40} color="white" />
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
      {onCancel && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Video</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      <TouchableOpacity style={styles.selectVideoButton} onPress={handleSelectVideo} disabled={isLoading}>
        <Text style={styles.selectVideoText}>{selectedVideo ? 'SELECT A DIFFERENT VIDEO' : 'SELECT VIDEO FROM LIBRARY'}</Text>
      </TouchableOpacity>

      {selectedVideo && (
        <>
          <View style={styles.previewSection}>
            {renderVideoPreview()}
            {videoDuration > 0 && (
              needsTrimming ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>Video is longer than {MAX_VIDEO_DURATION}s. Please trim.</Text>
                  <TouchableOpacity style={styles.trimButton} onPress={() => setShowTrimmer(true)}>
                    <Text style={styles.trimButtonText}>TRIM VIDEO</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.durationText}>
                  Duration: {Math.floor(videoDuration)}s ✓ {hasBeenTrimmed && '(Trimmed)'}
                </Text>
              )
            )}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Title:</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Enter a title for your video"
              value={videoTitle}
              onChangeText={setVideoTitle}
              editable={!isLoading}
            />
          </View>

          <View style={styles.uploadSection}>
            <TouchableOpacity 
              style={[styles.uploadButton, (!videoTitle.trim() || isLoading || needsTrimming) && styles.disabledButton]}
              onPress={handleSave}
              disabled={!videoTitle.trim() || isLoading || needsTrimming}
            >
              {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.uploadButtonText}>UPLOAD VIDEO</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}

      {showTrimmer && selectedVideo && (
        <VideoTrimmer
          videoUri={selectedVideo.uri}
          maxDuration={MAX_VIDEO_DURATION}
          onCancel={handleTrimCancel}
          onSave={handleTrimSave}
        />
      )}
    </View>
  );
};
// Add styles here...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  closeButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  placeholder: { width: 34 },
  selectVideoButton: { backgroundColor: '#4A90E2', marginHorizontal: 20, marginVertical: 20, paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  selectVideoText: { color: 'white', fontSize: 16, fontWeight: '600' },
  previewSection: { marginHorizontal: 20, marginBottom: 20 },
  videoContainer: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
  videoPlaceholder: { backgroundColor: 'white', borderRadius: 12, height: 200, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  placeholderText: { marginTop: 10, color: '#666', fontSize: 16 },
  playButton: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -25 }, { translateY: -25 }], backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  warningContainer: { backgroundColor: '#fff3cd', borderColor: '#ffeaa7', borderWidth: 1, borderRadius: 8, padding: 15, marginBottom: 15 },
  warningText: { color: '#856404', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  durationText: { color: '#28a745', fontSize: 14, textAlign: 'center', backgroundColor: '#d4edda', borderColor: '#c3e6cb', borderWidth: 1, borderRadius: 8, padding: 10 },
  trimButton: { backgroundColor: '#FF6B35', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, alignItems: 'center' },
  trimButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  inputSection: { marginHorizontal: 20, marginBottom: 20 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  titleInput: { backgroundColor: 'white', borderRadius: 8, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  uploadSection: { marginHorizontal: 20, marginBottom: 20 },
  uploadButton: { backgroundColor: '#4A90E0', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  disabledButton: { backgroundColor: '#bdc3c7', opacity: 0.7 },
});

export default VideoUpload;
