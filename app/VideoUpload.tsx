// VideoUploadInterface.tsx - Fixed with Retry Logic and Updated APIs
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router'; // Import useRouter and useLocalSearchParams
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
import FfmpegCompressionService from '../services/ffmpegCompressionService';
import videoApiService from '../services/videoApiService';
import { t } from '../utils/i18n';
// VideoTrimmer is now a separate screen, no longer imported directly here
// import VideoTrimmer from './VideoTrimmer';

const { width } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30.5;

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
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

const ensureVideoIsPersistent = async (temporaryUri: string, retries = 3, delay = 500): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `video_${Date.now()}.mp4`;
      const permanentUri = `${videoFilesDirectory}${fileName}`;

      const sourceUri = normalizeUri(temporaryUri);
      const destUri = normalizeUri(permanentUri);

      // Check if source file exists before copying
      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      if (!sourceInfo.exists) {
        throw new Error('Source video file does not exist.');
      }

      await FileSystem.copyAsync({ from: sourceUri, to: destUri });

      const fileInfo = await FileSystem.getInfoAsync(destUri);
      if (fileInfo.exists && fileInfo.size) {
        return destUri;
      }
      throw new Error('Failed to copy video to persistent storage.');
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ensureVideoIsPersistent:`, error);
      if (i === retries - 1) {
        console.error('ERROR: Failed to make video persistent after multiple retries:', error);
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Failed to make video persistent after multiple retries.');
};

// Retry logic for video selection with exponential backoff
const retryVideoSelection = async (maxRetries = 3): Promise<ImagePicker.ImagePickerResult> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Video selection attempt ${attempt + 1}/${maxRetries}`);
      
      // Try different API versions based on what's available
      let mediaTypeConfig;
      
      if (ImagePicker.MediaTypeOptions && ImagePicker.MediaTypeOptions.Videos) {
        // Legacy API (still widely supported)
        mediaTypeConfig = { mediaTypes: ImagePicker.MediaTypeOptions.Videos };
      } else if (ImagePicker.MediaType && ImagePicker.MediaType.Videos) {
        // New API format
        mediaTypeConfig = { mediaTypes: [ImagePicker.MediaType.Videos] };
      } else {
        // Fallback - try string value
        mediaTypeConfig = { mediaTypes: 'Videos' as any };
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        ...mediaTypeConfig,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 300,
        allowsMultipleSelection: false,
      });

      return result;
    } catch (error) {
      console.error(`Video selection attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff delay
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Failed to select video after all retries');
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
  onComplete?: (videoData?: any) => void; // Made optional with default handling
  isFromRecording?: boolean;
}

const VideoUploadInterface: React.FC<VideoUploadProps> = ({
  initialVideo,
  onCancel,
  onComplete,
  isFromRecording,
}) => {
  const router = useRouter();
  const localSearchParams = useLocalSearchParams();

  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(initialVideo || null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectingVideo, setIsSelectingVideo] = useState(false);
  const [selectionAttempt, setSelectionAttempt] = useState(0); // Track retry attempts
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
    if (!player || !selectedVideo) return;

    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && !videoLoaded) {
        setVideoLoaded(true);
        const durationSeconds = player.duration || 0;
        
        // Only update duration if it hasn't been manually set (e.g., after trimming)
        if (videoDuration === 0) {
          setVideoDuration(durationSeconds);
        }

        // Check if trimming is needed based on current duration
        const currentDuration = videoDuration > 0 ? videoDuration : durationSeconds;
        if (currentDuration > MAX_VIDEO_DURATION) {
          setNeedsTrimming(true);
        } else {
          setNeedsTrimming(false);
        }
        
        if (!hasBeenTrimmed) {
          setOriginalDuration(durationSeconds);
        }
      }
      setIsPlaying(status.status === 'playing');
    });

    return () => subscription?.remove();
  }, [player, videoLoaded, selectedVideo, hasBeenTrimmed, videoDuration]);

  // Effect to handle trimmed video data from VideoTrimmerScreen
  useEffect(() => {
    if (localSearchParams.trimmedVideoUri && localSearchParams.hasBeenTrimmed === 'true') {
      const { 
        trimmedVideoUri, 
        trimmedVideoStartTime, 
        trimmedVideoEndTime,
        originalVideoName,
        originalVideoType,
      } = localSearchParams;

      const newTrimmedDuration = parseFloat(trimmedVideoEndTime as string) - parseFloat(trimmedVideoStartTime as string);

      const updatedVideo: VideoFile = {
        uri: trimmedVideoUri as string,
        name: `trimmed_${originalVideoName || 'video.mp4'}`,
        type: originalVideoType as string,
      };

      setHasBeenTrimmed(true);
      setVideoLoaded(false);
      setVideoDuration(newTrimmedDuration);
      setSelectedVideo(updatedVideo);
      setIsPlaying(false);
      
      if (newTrimmedDuration <= MAX_VIDEO_DURATION) {
        setNeedsTrimming(false);
      } else {
        setNeedsTrimming(true);
      }

      // Clear the params so they don't trigger this effect again on subsequent renders
      router.setParams({
        trimmedVideoUri: undefined,
        trimmedVideoStartTime: undefined,
        trimmedVideoEndTime: undefined,
        hasBeenTrimmed: undefined,
        originalVideoName: undefined,
        originalVideoType: undefined,
      });
    }
  }, [localSearchParams, router]);

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
        return t('videoUploadInterface.compressingVideo');
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
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  }, [player, isPlaying]);

  const handleSelectVideo = async () => {
    try {
      setIsSelectingVideo(true);
      setSelectionAttempt(0);
      
      // Debug: Log available ImagePicker properties
      console.log('ImagePicker properties:', {
        hasMediaTypeOptions: !!ImagePicker.MediaTypeOptions,
        hasMediaType: !!ImagePicker.MediaType,
        MediaTypeOptions: ImagePicker.MediaTypeOptions,
        MediaType: ImagePicker.MediaType,
      });
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert(t('videoUploadInterface.alertError'), t('cameraScreen.mediaLibraryPermissionMessage'));
        return;
      }

      // Clear any potential cache issues
      try {
        const cacheDir = `${FileSystem.cacheDirectory}ImagePicker/`;
        const cacheInfo = await FileSystem.getInfoAsync(cacheDir);
        if (cacheInfo.exists) {
          console.log('Clearing ImagePicker cache...');
          await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        }
      } catch (cacheError) {
        console.log('Cache clear failed (non-critical):', cacheError);
      }

      const result = await retryVideoSelection(3);

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (!asset.uri) throw new Error('No URI in selected video');

        console.log('Selected video asset:', {
          uri: asset.uri,
          fileName: asset.fileName,
          type: asset.type,
          fileSize: asset.fileSize,
        });

        // Enhanced file persistence with retry
        const persistentUri = await ensureVideoIsPersistent(asset.uri, 5, 1000); // More retries for persistence
        const fileName = asset.fileName || `video_${Date.now()}.mp4`;
        
        let mimeType = 'video/mp4';
        if (asset.type && asset.type.includes('/')) {
          mimeType = asset.type;
        } else if (fileName.toLowerCase().endsWith('.mov')) {
          mimeType = 'video/quicktime';
        }

        const videoFile: VideoFile = {
          uri: persistentUri,
          name: fileName,
          type: mimeType,
          mimeType: mimeType,
        };

        console.log('Video file created successfully:', videoFile);

        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setVideoLoaded(false);
        setVideoDuration(0);
        setSelectedVideo(videoFile);
        setUploadState(UploadState.IDLE);
        setUploadProgress(0);
        setUploadPhase('');
        animateProgress(0);
        setIsPlaying(false);
        setNeedsTrimming(false); // Reset trimming state
      }
    } catch (error: any) {
      console.error('Error in handleSelectVideo:', error);
      
      let errorMessage = t('videoUploadInterface.alertFailedSelectVideo');
      
      if (error.message?.includes('rejected') || error.message?.includes('Failed to write')) {
        errorMessage = 'Failed to access video file. Please try again or choose a different video.';
      } else if (error.message?.includes('Permission')) {
        errorMessage = 'Permission denied. Please check app permissions in Settings.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Video selection timed out. Please try again.';
      } else if (error.message?.includes('Cannot read property')) {
        errorMessage = 'Video picker configuration error. Please update the app or try again.';
      }
      
      Alert.alert(
        t('videoUploadInterface.alertError'), 
        errorMessage,
        [
          { 
            text: 'Retry', 
            onPress: () => {
              // Short delay before retry
              setTimeout(() => handleSelectVideo(), 1000);
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsSelectingVideo(false);
      setSelectionAttempt(0);
    }
  };

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertEnterTitle'));
      return;
    }
    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertSelectVideoUri'));
      return;
    }
    if (needsTrimming) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.videoTooLongError'));
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    animateProgress(0);
    
    try {
      setUploadState(UploadState.COMPRESSING);
      setUploadPhase(t('cameraScreen.preparingVideo'));
      
      const videoExists = await FileSystem.getInfoAsync(selectedVideo.uri);
      if (!videoExists.exists) throw new Error('Video file not found before compression');
      
      setUploadPhase(t('videoUploadInterface.compressingVideo'));
      
      const compressedUri = await FfmpegCompressionService.createCompressedCopy(selectedVideo.uri, {
        maxSizeMB: 15,
        progressCallback: (progress: number) => {
          const progressPercentage = Math.round(progress * 50);
          setUploadProgress(progressPercentage);
          animateProgress(progressPercentage);
          if (progress > 0.1) {
            setUploadPhase(`${t('videoUploadInterface.compressingVideo')} ${Math.round(progress * 100)}%`);
          }
        },
      });
      
      const compressedExists = await FileSystem.getInfoAsync(compressedUri);
      if (!compressedExists.exists) throw new Error('Compressed video file not found after compression');
      
      setUploadProgress(50);
      animateProgress(50);
      setUploadPhase(t('videoUploadInterface.uploadComplete'));
      await new Promise(resolve => setTimeout(resolve, 500));

      const metadata = {
        name: selectedVideo.name,
        title: videoTitle.trim(),
        caption: '',
        originalDuration: originalDuration,
        wasTrimmed: hasBeenTrimmed,
      };

      const videoToUpload = {
        uri: compressedUri,
        name: selectedVideo.name,
        type: selectedVideo.type,
        mimeType: selectedVideo.mimeType || selectedVideo.type,
      };

      const response = await videoApiService.uploadVideo(videoToUpload, metadata, {
        onUploadProgress: (progressEvent) => {
          const uploadProgressPercent = (progressEvent.progress / 100) * 40;
          const totalProgress = 50 + uploadProgressPercent;
          setUploadProgress(Math.round(totalProgress));
          animateProgress(Math.round(totalProgress));
          if (progressEvent.progress > 0) {
            setUploadPhase(`${t('videoUploadInterface.uploadingVideo')} ${Math.round(progressEvent.progress)}%`);
          }
        },
        onStateChange: (state) => {
          switch (state) {
            case 'preparing':
              setUploadPhase(t('cameraScreen.preparingVideo'));
              break;
            case 'uploading':
              setUploadState(UploadState.UPLOADING);
              setUploadPhase(t('videoUploadInterface.uploadingVideo'));
              break;
            case 'processing':
              setUploadState(UploadState.PROCESSING);
              setUploadPhase(t('videoUploadInterface.processingVideo'));
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
        timeout: 300000,
      });

      if (response.success) {
        setTimeout(() => {
          setIsLoading(false);
          Alert.alert(
            t('videoUploadInterface.alertSuccess'), 
            t('videoUploadInterface.alertVideoUploaded'), 
            [{ 
              text: t('languageScreen.okButton'), 
              onPress: () => {
                // Safely call onComplete if it exists
                if (typeof onComplete === 'function') {
                  onComplete(response.data);
                } else {
                  // Fallback behavior if onComplete is not provided
                  console.log('Video upload completed successfully:', response.data);
                  // You might want to navigate back or show a different success message
                  router.push('/watchVideos')
                  if (onCancel) {
                    onCancel(); // Use onCancel as a fallback to close the screen
                  }
                }
              }
            }]
          );
        }, 1000);
      } else {
        throw new Error(response.error || t('alerts.unexpectedError'));
      }
    } catch (error: any) {
      console.error('VideoUpload - Complete upload process error:', error);
      setIsLoading(false);
      setUploadState(UploadState.IDLE);
      setUploadProgress(0);
      setUploadPhase('');
      animateProgress(0);
      setIsPlaying(false);
      let errorMessage = t('alerts.unexpectedError');
      if (error.message) {
        if (error.message.includes('Authentication')) errorMessage = t('alerts.authRequired');
        else if (error.message.includes('timeout')) errorMessage = t('alerts.trimmingErrorMessageTimeout');
        else if (error.message.includes('Network') || error.message.includes('network')) errorMessage = t('forgotPassword.alertNetworkError');
        else if (error.message.includes('cancel')) errorMessage = t('alerts.cancel');
        else errorMessage = error.message;
      }
      Alert.alert(t('videoUploadInterface.alertError'), errorMessage);
    }
  };

  const renderUploadProgress = () => {
    if (!isLoading) return null;
    
    const progressMessage = uploadPhase || getUploadStateText();

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressText}>{progressMessage}</Text>
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
      </View>
    );
  };

  const renderGalleryLoading = () => {
    if (!isSelectingVideo) return null;
    
    return (
      <View style={styles.galleryLoadingContainer}>
        <View style={styles.galleryLoadingContent}>
          <ActivityIndicator size="large" color="#3260a0" />
          <Text style={styles.galleryLoadingText}>
            {selectionAttempt > 0 
              ? `Retry attempt ${selectionAttempt}/3...`
              : t('videoUploadInterface.processingVideo') || 'Processing selected video...'
            }
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
        <VideoView style={styles.video} player={player}  contentFit="contain" />
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={handlePlayPause}
          disabled={isLoading || isSelectingVideo}
        >
          <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" />
        </TouchableOpacity>
        {(!videoLoaded || isSelectingVideo) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3260a0" />
            {isSelectingVideo && (
              <Text style={styles.loadingOverlayText}>
                {t('videoUploadInterface.loadingVideo') || 'Loading video...'}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const isAnyLoading = isLoading || isSelectingVideo;

  // Debug logging
  console.log('Current state:', {
    videoDuration,
    needsTrimming,
    hasBeenTrimmed,
    videoLoaded,
    selectedVideo: !!selectedVideo,
  });

  return (
    <ScrollView style={styles.container}>
      {onCancel && (
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onCancel} 
            style={styles.closeButton}
            disabled={isAnyLoading}
          >
            <Ionicons name="close" size={24} color={isAnyLoading ? "#999" : "#333"} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('videoUploadInterface.selectVideoTitle')}</Text>
          <View style={styles.placeholder} />
        </View>
      )}

      {!isFromRecording && (
        <TouchableOpacity 
          style={[styles.selectVideoButton, isAnyLoading && styles.disabledButton]} 
          onPress={handleSelectVideo} 
          disabled={isAnyLoading}
        >
          {isSelectingVideo ? (
            <View style={styles.selectVideoButtonLoading}>
              <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
              <Text style={styles.selectVideoText}>
                {t('loading.loadingVideos') || 'Selecting Video...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.selectVideoText}>
              {selectedVideo ? t('videoUploadInterface.selectDifferentVideoButton') : t('videoUploadInterface.selectVideoButton')}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {renderGalleryLoading()}

      {selectedVideo && (
        <>
          <View style={styles.previewSection}>
            {renderVideoPreview()}
            {videoLoaded && videoDuration > 0 && !isSelectingVideo && (
              needsTrimming ? (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>
                    {t('videoUploadInterface.videoTooLong', { maxDuration: MAX_VIDEO_DURATION })}
                  </Text>
                  <TouchableOpacity 
                    style={[styles.trimButton, isAnyLoading && styles.disabledButton]} 
                    onPress={() => router.push({ 
                      pathname: 'VideoTrimmerScreen', 
                      params: { 
                        videoUri: selectedVideo.uri,
                        videoName: selectedVideo.name,
                        videoType: selectedVideo.type,
                      } 
                    })}
                    disabled={isAnyLoading}
                  >
                    <Text style={styles.trimButtonText}>{t('videoUploadInterface.trimVideo')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.durationText}>
                  {t('videoUploadInterface.duration', { 
                    duration: videoDuration.toFixed(1)
                  })} {hasBeenTrimmed && '(Trimmed)'}
                </Text>
              )
            )}
          </View>

          {!needsTrimming && !isSelectingVideo && (
            <>
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>{t('videoUploadInterface.titleLabel')}</Text>
                <TextInput
                  style={[styles.titleInput, isAnyLoading && styles.disabledInput]}
                  placeholder={t('videoUploadInterface.enterTitlePlaceholder')}
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  editable={!isAnyLoading}
                />
              </View>

              {renderUploadProgress()}

              <View style={styles.uploadSection}>
                <TouchableOpacity
                  style={[
                    styles.uploadButton, 
                    (!videoTitle.trim() || isAnyLoading || needsTrimming) && styles.disabledButton
                  ]}
                  onPress={handleSave}
                  disabled={!videoTitle.trim() || isAnyLoading || needsTrimming}
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
  selectVideoButtonLoading: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  galleryLoadingContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  galleryLoadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryLoadingText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  previewSection: { marginHorizontal: 20, marginBottom: 20 },
  videoContainer: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    overflow: 'hidden', 
    position: 'relative' 
  },
  video: { width: '100%', height: 300, backgroundColor: '#000' },
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
  loadingOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
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
    alignItems: 'center', 
    marginBottom: 10 
  },
  progressText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333', 
    textAlign: 'center' 
  },
  progressBarContainer: { 
    height: 8, 
    backgroundColor: '#e9ecef', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBar: { height: '100%', backgroundColor: '#3260ad', borderRadius: 4 },
});

export default VideoUploadInterface;