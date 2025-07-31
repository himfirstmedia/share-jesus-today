import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import videoApiService from '../services/videoApiService'; // Import actual service
import VideoCompressionService from '../services/videoCompressionService'; // Import actual service
import { t } from '../utils/i18n'; // Import t
import VideoTrimmer from './VideoTrimmer'; // Our new native video trimmer

const { width } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30.10; // 30 seconds

// Upload progress states
enum UploadState {
  IDLE = 'idle',
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete'
}

// Utility Functions
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

    const fileInfo = await FileSystem.getInfoAsync(permanentUri);
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Failed to copy video to persistent storage.');
    }
    return permanentUri;
  } catch (error) {
    console.error('ERROR: Failed to make video persistent:', error);
    throw error;
  }
};

interface VideoFile {
  uri: string;
  name: string;
  type: string;
  mimeType?: string;
}

interface VideoUploadProps {
  initialVideo?: VideoFile;
  onCancel?: () => void;
  onComplete: (videoData?: any) => void;
  isFromRecording?: boolean; // Add this prop
}

const VideoUploadInterface: React.FC<VideoUploadProps> = ({
  initialVideo,
  onCancel,
  onComplete,
  isFromRecording, // Use the new prop
}) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(initialVideo || null);
  const [videoTitle, setVideoTitle] = useState('');
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);
  
  // Upload progress states
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnimation = new Animated.Value(0);

  const player = useVideoPlayer(selectedVideo?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  useEffect(() => {
    if (initialVideo) {
      setSelectedVideo(initialVideo);
    }
  }, [initialVideo]);

  useEffect(() => {
    if (!player || !selectedVideo || showTrimmer) return;

    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && !videoLoaded && !showTrimmer) {
        setVideoLoaded(true);
        const durationSeconds = player.duration || 0;
        setVideoDuration(durationSeconds);

        if (durationSeconds > MAX_VIDEO_DURATION + 0.1) {
          setNeedsTrimming(true);
        } else {
          setNeedsTrimming(false);
        }
        setOriginalDuration(durationSeconds);
      }
    });

    return () => subscription?.remove();
  }, [player, videoLoaded, selectedVideo, showTrimmer]);

  // Animate progress bar
  const animateProgress = (progress: number) => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  };

  // Simulate progress updates for different stages
  const simulateProgress = async (state: UploadState) => {
    setUploadState(state);
    
    switch (state) {
      case UploadState.COMPRESSING:
        // Simulate compression progress
        for (let i = 0; i <= 30; i += 5) {
          setUploadProgress(i);
          animateProgress(i);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        break;
        
      case UploadState.UPLOADING:
        // Simulate upload progress
        for (let i = 30; i <= 80; i += 10) {
          setUploadProgress(i);
          animateProgress(i);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        break;
        
      case UploadState.PROCESSING:
        // Simulate server processing
        for (let i = 80; i <= 95; i += 5) {
          setUploadProgress(i);
          animateProgress(i);
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        break;
        
      case UploadState.COMPLETE:
        setUploadProgress(100);
        animateProgress(100);
        break;
    }
  };

  const getUploadStateText = () => {
    switch (uploadState) {
      case UploadState.COMPRESSING:
        return t('videoUploadInterface.compressingVideo') || 'Compressing video...';
      case UploadState.UPLOADING:
        return t('videoUploadInterface.uploadingVideo') || 'Uploading video...';
      case UploadState.PROCESSING:
        return t('videoUploadInterface.processingVideo') || 'Processing video...';
      case UploadState.COMPLETE:
        return t('videoUploadInterface.uploadComplete') || 'Upload complete!';
      default:
        return '';
    }
  };

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.playing ? player.pause() : player.play();
  }, [player]);

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
          mimeType: asset.mimeType,
        };

        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setVideoLoaded(false);
        setVideoDuration(0);
        setSelectedVideo(videoFile);
        // Reset upload progress
        setUploadState(UploadState.IDLE);
        setUploadProgress(0);
        progressAnimation.setValue(0);
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.failedToSelectVideo'));
    }
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    if (!outputPath) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.trimmingFailedOutput'));
      setShowTrimmer(false);
      return;
    }

    if (selectedVideo) {
      console.log('Trim save completed:', { startTime, endTime, outputPath });

      setShowTrimmer(false);

      const updatedVideo: VideoFile = {
        ...selectedVideo,
        uri: outputPath,
        name: `trimmed_${selectedVideo.name}`,
      };

      setHasBeenTrimmed(true);
      setVideoLoaded(false);
      setVideoDuration(0);
      setSelectedVideo(updatedVideo);
    }
  };

  const handleTrimCancel = () => {
    setShowTrimmer(false);
  };

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.enterVideoTitle'));
      return;
    }
    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.SelectVideoTitle'));
      return;
    }

    setIsLoading(true);
    
    try {
      // Step 1: Compression
      await simulateProgress(UploadState.COMPRESSING);
      const compressedUri = await VideoCompressionService.createCompressedCopy(selectedVideo.uri);
      
      // Step 2: Upload
      await simulateProgress(UploadState.UPLOADING);
      const metadata = {
        name: selectedVideo.name,
        title: videoTitle.trim(),
        caption: '',
        originalDuration: originalDuration,
        wasTrimmed: hasBeenTrimmed,
      };
      const videoToUpload = { ...selectedVideo, uri: compressedUri };
      
      // Step 3: Server Processing
      await simulateProgress(UploadState.PROCESSING);
      const response = await videoApiService.uploadVideo(videoToUpload, metadata);

      // Step 4: Complete
      await simulateProgress(UploadState.COMPLETE);
      
      if (response.success) {
        // Small delay to show completion
        setTimeout(() => {
          Alert.alert(t('videoUploadInterface.alertSuccess'), t('videoUploadInterface.alertVideoUploaded'), [
            { text: t('languageScreen.okButton'), onPress: () => onComplete(response.data) }
          ]);
        }, 1000);
      } else {
        Alert.alert(t('videoUploadInterface.alertError'), response.error || t('alerts.unexpectedError'));
      }
    } catch (error) {
      console.error(error);
      Alert.alert(t('videoUploadInterface.alertError'), t('alerts.unexpectedError'));
      // Reset progress on error
      setUploadState(UploadState.IDLE);
      setUploadProgress(0);
      progressAnimation.setValue(0);
    } finally {
      setIsLoading(false);
    }
  };

  const renderUploadProgress = () => {
    if (!isLoading || uploadState === UploadState.IDLE) return null;

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>{getUploadStateText()}</Text>
          <Text style={styles.progressPercentage}>{uploadProgress}%</Text>
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
        
        <View style={styles.progressSteps}>
          <View style={[styles.progressStep, uploadProgress >= 30 && styles.progressStepActive]}>
            <Ionicons 
              name={uploadProgress >= 30 ? "checkmark-circle" : "ellipse-outline"} 
              size={16} 
              color={uploadProgress >= 30 ? "#28a745" : "#bdc3c7"} 
            />
            <Text style={[styles.progressStepText, uploadProgress >= 30 && styles.progressStepTextActive]}>
              {t('videoUploadInterface.compress') || 'Compress'}
            </Text>
          </View>
          
          <View style={[styles.progressStep, uploadProgress >= 80 && styles.progressStepActive]}>
            <Ionicons 
              name={uploadProgress >= 80 ? "checkmark-circle" : "ellipse-outline"} 
              size={16} 
              color={uploadProgress >= 80 ? "#28a745" : "#bdc3c7"} 
            />
            <Text style={[styles.progressStepText, uploadProgress >= 80 && styles.progressStepTextActive]}>
              {t('videoUploadInterface.upload') || 'Upload'}
            </Text>
          </View>
          
          <View style={[styles.progressStep, uploadProgress >= 100 && styles.progressStepActive]}>
            <Ionicons 
              name={uploadProgress >= 100 ? "checkmark-circle" : "ellipse-outline"} 
              size={16} 
              color={uploadProgress >= 100 ? "#28a745" : "#bdc3c7"} 
            />
            <Text style={[styles.progressStepText, uploadProgress >= 100 && styles.progressStepTextActive]}>
              {t('videoUploadInterface.process') || 'Process'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderVideoPreview = () => {
    if (!selectedVideo) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={80} color="#3260a0" />
          <Text style={styles.placeholderText}>{t('videoUploadInterface.noVideoSelected')}</Text>
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
            <ActivityIndicator size="large" color="#3260a0" />
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {onCancel && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('videoUploadInterface.selectVideoTitle')}</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      {!isFromRecording && (
        <TouchableOpacity
          style={styles.selectVideoButton}
          onPress={handleSelectVideo}
          disabled={isLoading}
        >
          <Text style={styles.selectVideoText}>
            {selectedVideo ? t('videoUploadInterface.selectDifferentVideoButton') : t('videoUploadInterface.selectVideoButton')}
          </Text>
        </TouchableOpacity>
      )}

      {selectedVideo && (
        <>
          <View style={styles.previewSection}>
            {renderVideoPreview()}
            {videoDuration > 0 && (
              needsTrimming ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>{t('videoUploadInterface.videoTooLong', { maxDuration: MAX_VIDEO_DURATION })}</Text>
                  <TouchableOpacity style={styles.trimButton} onPress={() => setShowTrimmer(true)}>
                    <Text style={styles.trimButtonText}>{t('videoUploadInterface.trimVideo')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.durationText}>
                  {t('videoUploadInterface.duration', { duration: Math.floor(videoDuration), trimmedStatus: hasBeenTrimmed ? t('videoUploadInterface.trimmed') : '' })}
                </Text>
              )
            )}
          </View>

          {!showTrimmer && !needsTrimming && (
            <>
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
                  style={[styles.uploadButton, (!videoTitle.trim() || isLoading) && styles.disabledButton]}
                  onPress={handleSave}
                  disabled={!videoTitle.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.uploadButtonText}>{t('videoUploadInterface.uploadButton')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  closeButton: {
    padding: 5
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  placeholder: {
    width: 34
  },
  selectVideoButton: {
    backgroundColor: '#3260ad',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  selectVideoText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  previewSection: {
    marginHorizontal: 20,
    marginBottom: 20
  },
  videoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  video: { 
    width: '100%', 
    height: 200, 
    backgroundColor: '#000' 
  },
  playButton: { 
    position: 'absolute', 
    top: '50%', 
    left: '50%', 
    transform: [{ translateX: -25 }, { translateY: -25 }], 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    borderRadius: 25, 
    width: 50, 
    height: 50, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  warningContainer: { 
    backgroundColor: '#fff3cd', 
    borderColor: '#ffeaa7', 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 15, 
    marginBottom: 15 
  },
  warningText: { 
    color: '#856404', 
    fontSize: 14, 
    textAlign: 'center', 
    marginBottom: 10 
  },
  durationText: { 
    color: '#28a745', 
    fontSize: 14, 
    textAlign: 'center', 
    backgroundColor: '#d4edda', 
    borderColor: '#c3e6cb', 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 10 
  },
  videoPlaceholder: {
    backgroundColor: 'white',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed'
  },
  placeholderText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16
  },
  actionsContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  trimButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  trimButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  titleInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  uploadSection: {
    marginHorizontal: 20,
    marginBottom: 20
  },
  uploadButton: {
    backgroundColor: '#3260ad',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center'
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  disabledButton: {
    backgroundColor: '#bdc3c7'
  },
  // Progress UI Styles
  progressContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3260ad'
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3260ad',
    borderRadius: 4
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressStep: {
    alignItems: 'center',
    flex: 1
  },
  progressStepActive: {},
  progressStepText: {
    fontSize: 12,
    color: '#bdc3c7',
    marginTop: 5,
    textAlign: 'center'
  },
  progressStepTextActive: {
    color: '#28a745',
    fontWeight: '600'
  }
});

export default VideoUploadInterface;