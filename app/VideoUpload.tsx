// VideoUploadInterface.tsx - Updated with VideoDetectionService
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Video, { OnLoadData } from 'react-native-video';
import videoApiService from '../services/videoApiService';
import VideoCompressionService from '../services/videoCompressionService';
import VideoDetectionService from '../services/videoDetectionService'; // NEW IMPORT
import { t } from '../utils/i18n';
import VideoTrimmer from './VideoTrimmer';

const { width } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30.5;
const ANDROID_9_API_LEVEL = 28;

enum UploadState {
  IDLE = 'idle',
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
}

// Check if we're on Android 9 or lower
const isAndroid9OrLower = (): boolean => {
  return Platform.OS === 'android' && Platform.Version <= ANDROID_9_API_LEVEL;
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

const normalizeUri = (uri: string): string => {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
};

// Updated validation using VideoDetectionService
const validateVideoWithService = async (uri: string): Promise<{ isValid: boolean; error?: string; duration?: number }> => {
  try {
    console.log('VideoUpload: Validating video with VideoDetectionService:', uri);

    // First do basic file validation
    const fileValidation = await VideoDetectionService.validateVideoFile(uri);
    if (!fileValidation.isValid) {
      return { isValid: false, error: fileValidation.error };
    }

    // Then try to get metadata
    const metadata = await VideoDetectionService.getVideoMetadata(uri);
    if (!metadata.isValid) {
      // If metadata detection fails but file is valid, we'll let the video player handle it
      console.log('VideoUpload: Metadata detection failed, but file is valid. Will rely on video player.');
      return { isValid: true, duration: -1 }; // -1 indicates duration unknown
    }

    console.log('VideoUpload: Validation successful via VideoDetectionService');
    return { isValid: true, duration: metadata.duration };

  } catch (error) {
    console.error('VideoUpload: VideoDetectionService validation failed:', error);
    return { isValid: false, error: error.message };
  }
};

const ensureVideoIsPersistent = async (temporaryUri: string, retries = 3, delay = 500): Promise<string> => {
  for (let i = 0; i < retries; i++) {
    try {
      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const fileName = `video_${Date.now()}.mp4`;
      const permanentUri = `${videoFilesDirectory}${fileName}`;

      const sourceUri = normalizeUri(temporaryUri);
      const destUri = normalizeUri(permanentUri);

      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      if (!sourceInfo.exists || sourceInfo.size === 0) {
        throw new Error('Source video file does not exist or is empty.');
      }

      await FileSystem.copyAsync({ from: sourceUri, to: destUri });

      if (isAndroid9OrLower()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const fileInfo = await FileSystem.getInfoAsync(destUri);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 0) {
        console.log('VideoUpload: Video made persistent successfully');
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

const retryVideoSelection = async (maxRetries = 3): Promise<ImagePicker.ImagePickerResult> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Video selection attempt ${attempt + 1}/${maxRetries} (Android ${Platform.Version})`);
      let mediaTypeConfig;
      let additionalOptions = {};
      if (isAndroid9OrLower()) {
        console.log('VideoUpload: Using Android 9 compatible image picker settings');
        if (ImagePicker.MediaTypeOptions && ImagePicker.MediaTypeOptions.Videos) {
          mediaTypeConfig = { mediaTypes: ImagePicker.MediaTypeOptions.Videos };
        } else {
          mediaTypeConfig = { mediaTypes: 'Videos' as any };
        }
        additionalOptions = {
          quality: 0.8,
          videoMaxDuration: 120,
          allowsEditing: false,
          allowsMultipleSelection: false,
        };
      } else {
        if (ImagePicker.MediaType && ImagePicker.MediaType.Videos) {
          mediaTypeConfig = { mediaTypes: [ImagePicker.MediaType.Videos] };
        } else if (ImagePicker.MediaTypeOptions && ImagePicker.MediaTypeOptions.Videos) {
          mediaTypeConfig = { mediaTypes: ImagePicker.MediaTypeOptions.Videos };
        } else {
          mediaTypeConfig = { mediaTypes: 'Videos' as any };
        }
        additionalOptions = {
          quality: 1,
          videoMaxDuration: 300,
          allowsEditing: false,
          allowsMultipleSelection: false,
        };
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        ...mediaTypeConfig,
        ...additionalOptions,
      });
      console.log('VideoUpload: Image picker result:', {
        cancelled: result.canceled,
        hasAssets: !!result.assets,
        assetsLength: result.assets?.length,
        platform: Platform.OS,
        version: Platform.Version,
      });
      return result;
    } catch (error) {
      console.error(`Video selection attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = isAndroid9OrLower()
        ? Math.pow(2, attempt) * 1500
        : Math.pow(2, attempt) * 1000;
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
  const [isSelectingVideo, setIsSelectingVideo] = useState(false);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [android9Warning, setAndroid9Warning] = useState(false);
  const [isDetectingDuration, setIsDetectingDuration] = useState(false); // NEW STATE

  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<string>('');
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const videoPlayerRef = useRef<Video>(null);

  // Check for Android 9 on component mount
  useEffect(() => {
    if (isAndroid9OrLower()) {
      console.log('VideoUpload: Running on Android 9 or lower, enabling compatibility mode');
      setAndroid9Warning(true);
    }
  }, []);

  useEffect(() => {
    if (initialVideo) {
      setSelectedVideo(initialVideo);
    }
  }, [initialVideo]);

  // NEW: Detect video duration using service when video is selected
  useEffect(() => {
    if (selectedVideo && !videoLoaded && !showTrimmer) {
      detectVideoDuration();
    }
  }, [selectedVideo, videoLoaded, showTrimmer]);

  // NEW: Function to detect video duration using VideoDetectionService
  const detectVideoDuration = async () => {
    if (!selectedVideo || isDetectingDuration) return;

    console.log('VideoUpload: Detecting video duration...');
    setIsDetectingDuration(true);

    try {
      const metadata = await VideoDetectionService.getVideoMetadata(selectedVideo.uri);
      
      if (metadata.isValid && metadata.duration > 0) {
        console.log('VideoUpload: Duration detected by service:', metadata.duration);
        setVideoDuration(metadata.duration);
        setVideoLoaded(true);

        if (metadata.duration > MAX_VIDEO_DURATION) {
          setNeedsTrimming(true);
        } else {
          setNeedsTrimming(false);
        }

        if (!hasBeenTrimmed) {
          setOriginalDuration(metadata.duration);
        }
      } else {
        console.log('VideoUpload: Service could not detect duration, relying on video player...');
        // Duration will be detected by video player onLoad callback
        setVideoLoaded(false);
      }
    } catch (error) {
      console.error('VideoUpload: Duration detection failed:', error);
      // Fall back to video player detection
      setVideoLoaded(false);
    } finally {
      setIsDetectingDuration(false);
    }
  };

  // Updated handleVideoLoad - now works as backup when service fails
  const handleVideoLoad = (data: OnLoadData) => {
    console.log('VideoUpload: Video player onLoad called with duration:', data.duration);
    
    // Only use video player data if service detection failed
    if (!videoLoaded && !isDetectingDuration) {
      setVideoLoaded(true);
      const durationSeconds = data.duration;
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
  };

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
    setIsPlaying(prevIsPlaying => !prevIsPlaying);
  }, []);

  const handleSelectVideo = async () => {
    try {
      setIsSelectingVideo(true);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert(t('videoUploadInterface.alertError'), t('cameraScreen.mediaLibraryPermissionMessage'));
        return;
      }

      if (isAndroid9OrLower()) {
        try {
          const cacheDir = `${FileSystem.cacheDirectory}ImagePicker/`;
          const cacheInfo = await FileSystem.getInfoAsync(cacheDir);
          if (cacheInfo.exists) {
            await FileSystem.deleteAsync(cacheDir, { idempotent: true });
          }
        } catch (cacheError) {
          console.log('Cache clear failed (non-critical):', cacheError);
        }
      }

      const result = await retryVideoSelection(3);

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (!asset.uri) throw new Error('No URI in selected video');

        // Use VideoDetectionService for validation
        const validation = await validateVideoWithService(asset.uri);
        if (!validation.isValid) {
          throw new Error(`Video validation failed: ${validation.error}`);
        }

        const persistentUri = await ensureVideoIsPersistent(asset.uri, 5, 1000);
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

        // Reset states
        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setVideoLoaded(false);
        setVideoDuration(0);
        setNeedsTrimming(false);
        setSelectedVideo(videoFile);
        setUploadState(UploadState.IDLE);
        setUploadProgress(0);
        setUploadPhase('');
        animateProgress(0);
        setIsPlaying(false);
        setIsDetectingDuration(false);
      }
    } catch (error: any) {
      console.error('Error in handleSelectVideo:', error);
      let errorMessage = t('videoUploadInterface.alertFailedSelectVideo');
      if (isAndroid9OrLower() && (
        error.message?.includes('NumberFormatException') ||
        error.message?.includes('-9223372036854775808') ||
        error.message?.includes('Android 9')
      )) {
        errorMessage = 'Video format not supported on Android 9. Please try recording a new video or choose a different one.';
      } else if (error.message?.includes('rejected') || error.message?.includes('Failed to write')) {
        errorMessage = 'Failed to access video file. Please try again or choose a different video.';
      } else if (error.message?.includes('Permission')) {
        errorMessage = 'Permission denied. Please check app permissions in Settings.';
      }
      Alert.alert(
        t('videoUploadInterface.alertError'),
        errorMessage,
        [
          { text: 'Retry', onPress: () => setTimeout(() => handleSelectVideo(), 1000) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } finally {
      setIsSelectingVideo(false);
    }
  };

  const handleTrimSave = async (startTime: number, endTime: number, persistentUri: string) => {
    if (!persistentUri) {
      Alert.alert(t('videoUploadInterface.alertError'), t('alerts.trimmingErrorMessageGeneric'));
      setShowTrimmer(false);
      return;
    }
    try {
      if (selectedVideo) {
        const updatedVideo: VideoFile = {
          ...selectedVideo,
          uri: persistentUri,
          name: `trimmed_${selectedVideo.name}`,
        };
        setHasBeenTrimmed(true);
        setVideoLoaded(false);
        setVideoDuration(0);
        setNeedsTrimming(false);
        setSelectedVideo(updatedVideo);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Failed to process trimmed video', error);
      Alert.alert(t('alerts.error'), t('alerts.saveErrorMessageGeneric'));
    }
  };

  const handleTrimComplete = () => setShowTrimmer(false);
  const handleTrimCancel = () => setShowTrimmer(false);

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

      const compressedUri = await VideoCompressionService.createCompressedCopy(selectedVideo.uri, {
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
            [{ text: t('languageScreen.okButton'), onPress: () => onComplete(response.data) }]
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
        if (isAndroid9OrLower() && (
          error.message.includes('NumberFormatException') ||
          error.message.includes('-9223372036854775808')
        )) {
          errorMessage = 'Video compression failed on Android 9. Please try a different video or record a new one.';
        } else if (error.message.includes('Authentication')) {
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
      Alert.alert(t('videoUploadInterface.alertError'), errorMessage);
    }
  };

  const renderUploadProgress = () => {
    if (!isLoading) return null;
    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>{uploadPhase || getUploadStateText()}</Text>
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

  // Updated renderVideoPreview with detection status
  const renderVideoPreview = () => {
    if (!selectedVideo) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={80} color="#3260a0" />
          <Text style={styles.placeholderText}>{t('videoUploadInterface.noVideoSelected')}</Text>
        </View>
      );
    }

    const showLoadingOverlay = isSelectingVideo || isDetectingDuration || (!videoLoaded && !isDetectingDuration);

    return (
      <View style={styles.videoContainer}>
        <Video
          ref={videoPlayerRef}
          source={{ uri: selectedVideo.uri }}
          style={styles.video}
          resizeMode="contain"
          paused={!isPlaying}
          onLoad={handleVideoLoad}
          onEnd={() => setIsPlaying(false)}
          onError={(e) => console.error('Video Player Error:', e)}
        />
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          disabled={isLoading || showLoadingOverlay}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="white" />
        </TouchableOpacity>
        {showLoadingOverlay && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3260a0" />
            <Text style={styles.loadingOverlayText}>
              {isSelectingVideo && (t('videoUploadInterface.loadingVideo') || 'Loading video...')}
              {isDetectingDuration && 'Analyzing video...'}
              {!videoLoaded && !isDetectingDuration && !isSelectingVideo && 'Loading...'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const isAnyLoading = isLoading || isSelectingVideo || isDetectingDuration;

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

      {android9Warning && !selectedVideo && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            Running on Android 9. Some video formats may have limited compatibility.
          </Text>
        </View>
      )}

      {!isFromRecording && (
        <TouchableOpacity
          style={[styles.selectVideoButton, isAnyLoading && styles.disabledButton]}
          onPress={handleSelectVideo}
          disabled={isAnyLoading}
        >
          {isSelectingVideo ? (
            <View style={styles.buttonLoading}>
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

      {selectedVideo && (
        <>
          <View style={styles.previewSection}>
            {renderVideoPreview()}
            {videoLoaded && videoDuration > 0 && !isSelectingVideo && !isDetectingDuration && (
              <>
                {needsTrimming && (
                  <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>
                      {t('videoUploadInterface.videoTooLong', { maxDuration: MAX_VIDEO_DURATION })}
                    </Text>
                    <TouchableOpacity
                      style={[styles.trimButton, isAnyLoading && styles.disabledButton]}
                      onPress={() => setShowTrimmer(true)}
                      disabled={isAnyLoading}
                    >
                      <Text style={styles.trimButtonText}>{t('videoUploadInterface.trimVideo')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[
                  styles.durationText,
                  hasBeenTrimmed && styles.trimmedDurationText
                ]}>
                  {hasBeenTrimmed
                    ? `${videoDuration.toFixed(1)}s (trimmed from ${originalDuration.toFixed(1)}s)`
                    : `${videoDuration.toFixed(1)}s`
                  }
                </Text>
              </>
            )}
          </View>
          {!showTrimmer && !needsTrimming && !isSelectingVideo && !isDetectingDuration && (
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
              <TouchableOpacity
                style={[
                  styles.uploadButton,
                  (!videoTitle.trim() || isAnyLoading || needsTrimming) && styles.disabledButton
                ]}
                onPress={handleSave}
                disabled={!videoTitle.trim() || isAnyLoading || needsTrimming}
              >
                {isLoading ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                    <Text style={styles.uploadButtonText}>{getUploadStateText()}</Text>
                  </View>
                ) : (
                  <Text style={styles.uploadButtonText}>{t('videoUploadInterface.uploadButton')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </>
      )}
      {showTrimmer && selectedVideo && !isSelectingVideo && !isDetectingDuration && (
        <VideoTrimmer
          videoUri={selectedVideo.uri}
          maxDuration={30}
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
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
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
    marginHorizontal: 20,
    marginBottom: 15,
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
  uploadButton: {
    backgroundColor: '#3260ad',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20
  },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
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
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBar: { height: '100%', backgroundColor: '#3260ad', borderRadius: 4 },
  trimmedDurationText: { 
    backgroundColor: '#d1ecf1', 
    borderColor: '#bee5eb',
    color: '#0c5460'
  },
});

export default VideoUploadInterface;