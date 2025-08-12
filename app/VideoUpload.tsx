// VideoUploadInterface.tsx - Complete Implementation with Better Progress (Translated)
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import videoApiService from '../services/videoApiService';
import VideoCompressionService from '../services/videoCompressionService';
import { t } from '../utils/i18n';
import VideoTrimmer from './VideoTrimmer';

const { width } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30.1;

enum UploadState {
  IDLE = 'idle',
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete'
}

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

const normalizeUri = (uri: string): string => {
  // Ensure consistent file:// protocol for Expo FileSystem
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

const ensureVideoIsPersistent = async (temporaryUri: string): Promise<string> => {
  try {
    const videoFilesDirectory = await initializeVideoFilesDirectory();
    const fileName = `video_${Date.now()}.mp4`;
    const permanentUri = `${videoFilesDirectory}${fileName}`;

    const sourceUri = normalizeUri(temporaryUri);
    const destUri = normalizeUri(permanentUri);

    await FileSystem.copyAsync({ from: sourceUri, to: destUri });

    const fileInfo = await FileSystem.getInfoAsync(destUri);
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Failed to copy video to persistent storage.');
    }
    return destUri;
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
  isFromRecording?: boolean;
}

const VideoUploadInterface: React.FC<VideoUploadProps> = ({
  initialVideo,
  onCancel,
  onComplete,
  isFromRecording,
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
  
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<string>('');
  const progressAnimation = useRef(new Animated.Value(0)).current;

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

        if (durationSeconds > MAX_VIDEO_DURATION) {
          setNeedsTrimming(true);
        } else {
          setNeedsTrimming(false);
        }
        
        if (!hasBeenTrimmed) {
            setOriginalDuration(durationSeconds);
        }
      }
    });

    return () => subscription?.remove();
  }, [player, videoLoaded, selectedVideo, showTrimmer, hasBeenTrimmed]);

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
        return uploadPhase || t('videoUploadInterface.compressingVideo');
      case UploadState.UPLOADING: 
        return uploadPhase || t('videoUploadInterface.uploadingVideo');
      case UploadState.PROCESSING: 
        return uploadPhase || t('videoUploadInterface.processingVideo');
      case UploadState.COMPLETE: 
        return t('videoUploadInterface.uploadComplete');
      default: 
        return t('videoUploadInterface.uploadButton');
    }
  };

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.playing ? player.pause() : player.play();
  }, [player]);

  const handleSelectVideo = async () => {
    try {
      // Request media library permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          t('videoUploadInterface.alertError'), 
          t('cameraScreen.mediaLibraryPermissionMessage')
        );
        return;
      }

      console.log('Launching image library picker...');

      // Launch the image library with video-only option
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300, // Optional: limit video duration in seconds
      });

      console.log('ImagePicker result:', JSON.stringify(result, null, 2));

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        console.log('Selected asset:', JSON.stringify(asset, null, 2));
        
        if (!asset.uri) throw new Error('No URI in selected video');

        const persistentUri = await ensureVideoIsPersistent(asset.uri);
        console.log('Video made persistent:', persistentUri);

        // Get file info to determine proper MIME type and name
        const fileInfo = await FileSystem.getInfoAsync(persistentUri);
        console.log('File info:', fileInfo);
        
        // Create a proper filename if one doesn't exist
        const fileName = asset.fileName || `video_${Date.now()}.mp4`;
        
        // Determine MIME type based on file extension or use default
        let mimeType = 'video/mp4';
        
        if (asset.type && asset.type.includes('/')) {
          mimeType = asset.type;
        } else if (asset.type === 'video') {
          if (fileName.toLowerCase().endsWith('.mov')) {
            mimeType = 'video/quicktime';
          } else if (fileName.toLowerCase().endsWith('.avi')) {
            mimeType = 'video/x-msvideo';
          } else {
            mimeType = 'video/mp4';
          }
        } else if (fileName.toLowerCase().endsWith('.mov')) {
          mimeType = 'video/quicktime';
        } else if (fileName.toLowerCase().endsWith('.avi')) {
          mimeType = 'video/x-msvideo';
        }
        
        console.log('Determined MIME type:', mimeType, 'from asset.type:', asset.type);

        const videoFile: VideoFile = {
          uri: persistentUri,
          name: fileName,
          type: mimeType,
          mimeType: mimeType,
        };

        console.log('Created video file object:', videoFile);

        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setVideoLoaded(false);
        setVideoDuration(0);
        setSelectedVideo(videoFile);
        setUploadState(UploadState.IDLE);
        setUploadProgress(0);
        setUploadPhase('');
        animateProgress(0);
      }
    } catch (error) {
      console.error('Error in handleSelectVideo:', error);
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        t('videoUploadInterface.alertFailedSelectVideo')
      );
    }
  };

  const handleTrimSave = async (startTime: number, endTime: number, persistentUri: string) => {
    if (!persistentUri) {
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        t('alerts.trimmingErrorMessageGeneric')
      );
      setShowTrimmer(false);
      return;
    }
    
    try {
      console.log('Trim save completed and file made persistent:', { persistentUri });

      if (selectedVideo) {
        const updatedVideo: VideoFile = {
          ...selectedVideo,
          uri: persistentUri,
          name: `trimmed_${selectedVideo.name}`,
        };

        setHasBeenTrimmed(true);
        setVideoLoaded(false);
        setVideoDuration(0);
        setSelectedVideo(updatedVideo);
      }
    } catch (error) {
      console.error("Failed to process trimmed video", error);
      Alert.alert(t('alerts.error'), t('alerts.saveErrorMessageGeneric'));
    }
  };

  const handleTrimComplete = (videoData: { startTime: number, endTime: number, uri: string }) => {
    setShowTrimmer(false);
  };

  const handleTrimCancel = () => {
    setShowTrimmer(false);
  };

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        t('videoUploadInterface.alertEnterTitle')
      );
      return;
    }
    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        t('videoUploadInterface.alertSelectVideoUri')
      );
      return;
    }
    if (needsTrimming) {
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        t('videoUploadInterface.videoTooLongError')
      );
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    animateProgress(0);
    
    try {
      console.log('Starting complete upload process with video:', selectedVideo);

      // Phase 1: Compression (0% - 50%)
      setUploadState(UploadState.COMPRESSING);
      setUploadPhase(t('cameraScreen.preparingVideo'));
      
      // Add file existence check before compression
      const videoExists = await FileSystem.getInfoAsync(selectedVideo.uri);
      console.log('Video file exists before compression:', videoExists);
      
      if (!videoExists.exists) {
        throw new Error('Video file not found before compression');
      }
      
      setUploadPhase(t('videoUploadInterface.compressingVideo'));
      
      const compressedUri = await VideoCompressionService.createCompressedCopy(selectedVideo.uri, {
        maxSizeMB: 15,
        progressCallback: (progress: number) => {
          // Map compression progress to 0-50% of total progress
          const progressPercentage = Math.round(progress * 50);
          setUploadProgress(progressPercentage);
          animateProgress(progressPercentage);
          
          if (progress > 0.1) {
            setUploadPhase(`${t('videoUploadInterface.compressingVideo')} ${Math.round(progress * 100)}%`);
          }
        },
      });
      
      console.log('Video compressed successfully:', compressedUri);
      
      // Verify compressed file exists
      const compressedExists = await FileSystem.getInfoAsync(compressedUri);
      if (!compressedExists.exists) {
        throw new Error('Compressed video file not found after compression');
      }
      
      // Ensure we're at 50% after compression
      setUploadProgress(50);
      animateProgress(50);
      setUploadPhase(t('videoUploadInterface.uploadComplete'));
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // Phase 2: Upload (50% - 90%) + Processing (90% - 100%)
      const metadata = {
        name: selectedVideo.name,
        title: videoTitle.trim(),
        caption: '',
        originalDuration: originalDuration,
        wasTrimmed: hasBeenTrimmed,
      };

      // Create the video object for upload
      const videoToUpload = {
        uri: compressedUri,
        name: selectedVideo.name,
        type: selectedVideo.type,
        mimeType: selectedVideo.mimeType || selectedVideo.type,
      };

      console.log('Starting upload with comprehensive tracking:', { videoToUpload, metadata });
      
      // Upload with comprehensive progress tracking using Expo FileSystem
      const response = await videoApiService.uploadVideo(videoToUpload, metadata, {
        onUploadProgress: (progressEvent) => {
          // Map upload progress to 50-90% of total progress (40% range)
          const uploadProgressPercent = (progressEvent.progress / 100) * 40;
          const totalProgress = 50 + uploadProgressPercent;
          
          console.log(`Upload progress: ${progressEvent.progress}% -> Total: ${Math.round(totalProgress)}%`);
          setUploadProgress(Math.round(totalProgress));
          animateProgress(Math.round(totalProgress));
          
          // Update phase text with actual progress
          if (progressEvent.progress > 0) {
            setUploadPhase(`${t('videoUploadInterface.uploadingVideo')} ${Math.round(progressEvent.progress)}%`);
          }
        },
        onStateChange: (state) => {
          console.log('Upload state changed:', state);
          
          switch (state) {
            case 'preparing':
              setUploadPhase(t('cameraScreen.preparingVideo'));
              // Already at 50% from compression
              break;
            case 'uploading':
              setUploadState(UploadState.UPLOADING);
              setUploadPhase(t('videoUploadInterface.uploadingVideo'));
              break;
            case 'processing':
              setUploadState(UploadState.PROCESSING);
              setUploadPhase(t('videoUploadInterface.processingVideo'));
              
              // Gradual processing progress from 90% to 98%
              let processingProgress = 90;
              const processingInterval = setInterval(() => {
                processingProgress += 1;
                if (processingProgress >= 98) {
                  processingProgress = 98;
                  clearInterval(processingInterval);
                }
                setUploadProgress(processingProgress);
                animateProgress(processingProgress);
                setUploadPhase(`${t('videoUploadInterface.processingVideo')} ${processingProgress}%`);
              }, 300);
              break;
            case 'complete':
              setUploadState(UploadState.COMPLETE);
              setUploadProgress(100);
              animateProgress(100);
              setUploadPhase(t('videoUploadInterface.uploadComplete'));
              break;
          }
        },
        timeout: 300000, // 5 minutes timeout
      });

      console.log('Upload response received:', response);

      if (response.success) {
        // Show completion state briefly before showing success dialog
        setTimeout(() => {
          setIsLoading(false);
          Alert.alert(
            t('videoUploadInterface.alertSuccess'), 
            t('videoUploadInterface.alertVideoUploaded'), 
            [
              { 
                text: t('languageScreen.okButton'), 
                onPress: () => onComplete(response.data) 
              }
            ]
          );
        }, 1000); // Give user time to see 100% completion
      } else {
        throw new Error(response.error || t('alerts.unexpectedError'));
      }
      
    } catch (error: any) {
      console.error('VideoUpload - Complete upload process error:', error);
      
      // Reset all states on error
      setIsLoading(false);
      setUploadState(UploadState.IDLE);
      setUploadProgress(0);
      setUploadPhase('');
      animateProgress(0);
      
      // Show error alert with specific message
      let errorMessage = t('alerts.unexpectedError');
      if (error.message) {
        if (error.message.includes('Authentication')) {
          errorMessage = t('alerts.authRequired');
        } else if (error.message.includes('timeout')) {
          errorMessage = t('alerts.trimmingErrorMessageTimeout');
        } else if (error.message.includes('Network') || error.message.includes('network')) {
          errorMessage = t('forgotPassword.alertNetworkError');
        } else if (error.message.includes('cancel')) {
          errorMessage = t('alerts.cancel');
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        errorMessage
      );
    }
  };

  // Cancel upload function
  const handleCancelUpload = () => {
    Alert.alert(
      t('videoActions.cancel'),
      t('videoActions.cancel'), // Need to add proper cancel upload confirmation text
      [
        {
          text: t('videoUploadInterface.uploadButton'),
          style: 'cancel',
        },
        {
          text: t('alerts.cancel'),
          style: 'destructive',
          onPress: () => {
            videoApiService.cancelUpload();
            setIsLoading(false);
            setUploadState(UploadState.IDLE);
            setUploadProgress(0);
            setUploadPhase('');
            animateProgress(0);
          },
        },
      ]
    );
  };

  const renderUploadProgress = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressText}>{getUploadStateText()}</Text>
            {uploadPhase && (
              <Text style={styles.progressPhase}>{uploadPhase}</Text>
            )}
          </View>
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
                  extrapolate: 'clamp' 
                }) 
              },
            ]}
          />
        </View>
        
        {/* Show cancel button during upload */}
        {(uploadState === UploadState.UPLOADING || uploadState === UploadState.PROCESSING) && (
          <TouchableOpacity 
            style={styles.cancelUploadButton} 
            onPress={handleCancelUpload}
          >
            <Text style={styles.cancelUploadText}>{t('alerts.cancel')}</Text>
          </TouchableOpacity>
        )}
        
        {/* Show upload details */}
        <View style={styles.uploadDetails}>
          <Text style={styles.uploadDetailText}>
            {uploadState === UploadState.COMPRESSING && t('videoUploadInterface.compressingVideo')}
            {uploadState === UploadState.UPLOADING && t('videoUploadInterface.uploadingVideo')}
            {uploadState === UploadState.PROCESSING && t('videoUploadInterface.processingVideo')}
            {uploadState === UploadState.COMPLETE && t('videoUploadInterface.uploadComplete')}
          </Text>
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
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={handlePlayPause}
          disabled={isLoading}
        >
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
          <TouchableOpacity 
            onPress={onCancel} 
            style={styles.closeButton}
            disabled={isLoading}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('videoUploadInterface.selectVideoTitle')}</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      {!isFromRecording && (
        <TouchableOpacity 
          style={[styles.selectVideoButton, isLoading && styles.disabledButton]} 
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
            {videoLoaded && videoDuration > 0 && (
              needsTrimming ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>
                    {t('videoUploadInterface.videoTooLong', { maxDuration: MAX_VIDEO_DURATION })}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.trimButton, isLoading && styles.disabledButton]} 
                    onPress={() => setShowTrimmer(true)}
                    disabled={isLoading}
                  >
                    <Text style={styles.trimButtonText}>{t('videoUploadInterface.trimVideo')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.durationText}>
                  {t('videoUploadInterface.duration', { 
                    duration: videoDuration.toFixed(1)
                  })}
                  {hasBeenTrimmed ? ` (${t('profile.readLess')})` : ''}
                </Text>
              )
            )}
          </View>

          {!showTrimmer && (
            <>
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{t('videoUploadInterface.titleLabel')}</Text>
                <TextInput
                  style={[styles.titleInput, isLoading && styles.disabledInput]}
                  placeholder={t('videoUploadInterface.enterTitlePlaceholder')}
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  editable={!isLoading}
                />
              </View>

              {renderUploadProgress()}

              <View style={styles.uploadSection}>
                <TouchableOpacity
                  style={[
                    styles.uploadButton, 
                    (!videoTitle.trim() || isLoading || needsTrimming) && styles.disabledButton
                  ]}
                  onPress={handleSave}
                  disabled={!videoTitle.trim() || isLoading || needsTrimming}
                >
                  {isLoading ? (
                    <View style={styles.uploadButtonLoading}>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                      <Text style={styles.uploadButtonText}>{getUploadStateText()}</Text>
                    </View>
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
          onTrimComplete={handleTrimComplete}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
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
  closeButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  placeholder: { width: 34 },
  selectVideoButton: { 
    backgroundColor: '#3260ad', 
    marginHorizontal: 20, 
    marginVertical: 20, 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  selectVideoText: { color: 'white', fontSize: 16, fontWeight: '600' },
  previewSection: { marginHorizontal: 20, marginBottom: 20 },
  videoContainer: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    overflow: 'hidden', 
    position: 'relative' 
  },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
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
    marginTop: 15 
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
    padding: 10, 
    marginTop: 15 
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
  placeholderText: { marginTop: 10, color: '#666', fontSize: 16 },
  trimButton: { 
    backgroundColor: '#FF6B35', 
    paddingVertical: 12, 
    paddingHorizontal: 20, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  trimButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  inputSection: { marginHorizontal: 20, marginBottom: 20 },
  inputLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  titleInput: { 
    backgroundColor: 'white', 
    borderRadius: 8, 
    paddingHorizontal: 15, 
    paddingVertical: 12, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#e0e0e0' 
  },
  disabledInput: { 
    backgroundColor: '#f8f9fa', 
    color: '#6c757d' 
  },
  uploadSection: { marginHorizontal: 20, marginBottom: 20 },
  uploadButton: { 
    backgroundColor: '#3260ad', 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  uploadButtonLoading: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  disabledButton: { backgroundColor: '#bdc3c7' },
  progressContainer: { 
    backgroundColor: 'white', 
    marginHorizontal: 20, 
    marginBottom: 20, 
    borderRadius: 12, 
    padding: 15, 
    borderWidth: 1, 
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  progressHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  progressTextContainer: { flex: 1, paddingRight: 10 },
  progressText: { fontSize: 14, fontWeight: '500', color: '#333' },
  progressPhase: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 2,
    fontStyle: 'italic' 
  },
  progressPercentage: { fontSize: 14, fontWeight: '600', color: '#3260ad' },
  progressBarContainer: { 
    height: 8, 
    backgroundColor: '#e9ecef', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBar: { height: '100%', backgroundColor: '#3260ad', borderRadius: 4 },
  cancelUploadButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'center',
    marginTop: 10,
  },
  cancelUploadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  uploadDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  uploadDetailText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VideoUploadInterface;