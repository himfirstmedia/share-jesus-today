import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
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
import CameraCompressionService from '../services/cameraCompressionService';
import videoApiService from '../services/videoApiService';
import { t } from '../utils/i18n';

// --- Enums and Interfaces ---

enum UploadState {
  IDLE = 'idle',
  SECURING = 'securing', // New state for securing the video file
  COMPRESSING = 'compressing',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
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
  const [secureVideoUri, setSecureVideoUri] = useState<string | null>(null); // New state for secured video
  const [videoTitle, setVideoTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // --- Enhanced State for Progress UI ---
  const [uploadState, setUploadState] = useState<UploadState>(UploadState.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<string>('');
  const progressAnimation = useRef(new Animated.Value(0)).current;

  // Use secureVideoUri for video player if available, otherwise use original
  const playerUri = secureVideoUri || videoFile?.uri || '';
  const player = useVideoPlayer(playerUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  const { videoUri, videoName, videoType } = params;

  // --- New function to secure the video file immediately ---
  const secureVideoFile = async (originalUri: string): Promise<string> => {
    try {
      console.log('LOG: Securing camera recording immediately');
      
      // Create a secure copy in our app's document directory
      const secureFileName = `secure_${Date.now()}.mp4`;
      const secureDirectory = `${FileSystem.documentDirectory}videofiles/`;
      
      // Ensure directory exists
      await FileSystem.makeDirectoryAsync(secureDirectory, { intermediates: true });
      
      const securePath = `${secureDirectory}${secureFileName}`;
      
      // Check if source file exists before copying
      const sourceInfo = await FileSystem.getInfoAsync(originalUri, { size: true });
      if (!sourceInfo.exists) {
        throw new Error('Source camera file no longer exists');
      }
      
      console.log(`LOG: Copying camera file to secure location: ${securePath}`);
      
      // Copy the file to our secure location
      await FileSystem.copyAsync({
        from: originalUri,
        to: securePath,
      });
      
      // Verify the copy
      const secureInfo = await FileSystem.getInfoAsync(securePath, { size: true });
      if (!secureInfo.exists || secureInfo.size === 0) {
        throw new Error('Failed to create secure copy');
      }
      
      console.log(`LOG: Video secured successfully: ${securePath} (${secureInfo.size} bytes)`);
      return securePath;
      
    } catch (error) {
      console.error('ERROR: Failed to secure video file:', error);
      throw error;
    }
  };

  useEffect(() => {
    const initializeVideo = async () => {
      if (videoUri) {
        const newVideoFile = {
          uri: videoUri,
          name: videoName || `recorded_video_${Date.now()}.mp4`,
          type: videoType || 'video/mp4',
        };
        setVideoFile(newVideoFile);
        
        // Immediately secure the video file
        try {
          setUploadState(UploadState.SECURING);
          setUploadPhase('Securing video file...');
          
          const securedUri = await secureVideoFile(videoUri);
          setSecureVideoUri(securedUri);
          
          console.log('LOG: Video file secured for processing');
          setUploadState(UploadState.IDLE);
          setUploadPhase('');
          
        } catch (error) {
          console.error('ERROR: Failed to secure video file:', error);
          Alert.alert(
            t('videoUploadInterface.alertError'), 
            'Failed to secure video file. Please try recording again.',
            [{ text: t('alerts.ok'), onPress: () => router.replace('/(tabs)/post') }]
          );
        }
      } else {
        Alert.alert(t('videoUploadInterface.alertError'), t('cameraUpload.noVideoProvided'), [
          { text: t('alerts.ok'), onPress: () => router.replace('/(tabs)/post') },
        ]);
      }
    };

    initializeVideo();
  }, [videoUri, videoName, videoType, router]);

  useEffect(() => {
    if (!player || !playerUri) return;
    const subscription = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay' && !videoLoaded) {
        setVideoLoaded(true);
      }
      setIsPlaying(status.isPlaying);
    });
    return () => subscription?.remove();
  }, [player, playerUri, videoLoaded]);

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    player.playing ? player.pause() : player.play();
  }, [player]);

  // --- Enhanced Progress and State Management Functions ---

  const animateProgress = (progress: number) => {
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const getUploadStateText = () => {
    switch (uploadState) {
      case UploadState.SECURING:
        return 'Securing video...';
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

  const handleSave = async () => {
    if (!videoTitle.trim() || !videoFile || !secureVideoUri) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.enterVideoTitle'));
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);
    setUploadPhase('');
    animateProgress(0);

    try {
      console.log('Starting complete upload process with secured video:', secureVideoUri);

      // --- Phase 1: Compression (0% - 50%) ---
      setUploadState(UploadState.COMPRESSING);
      setUploadPhase(t('cameraScreen.preparingVideo'));
      
      setUploadPhase(t('videoUploadInterface.compressingVideo'));
      
      // Use the secured video URI for compression
      const compressedUri = await CameraCompressionService.createCompressedCopy(secureVideoUri, {
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
      
      // Ensure we're at 50% after compression
      setUploadProgress(50);
      animateProgress(50);
      setUploadPhase(t('videoUploadInterface.uploadComplete'));
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // --- Phase 2: Upload (50% - 90%) + Processing (90% - 100%) ---
      const metadata = { 
        name: videoFile.name, 
        title: videoTitle.trim(), 
        caption: '',
        originalDuration: 0,
        wasTrimmed: false,
      };
      
      const fileToUpload = { 
        ...videoFile, 
        uri: compressedUri, // Use the compressed/secured URI
        mimeType: videoFile.type,
      };

      console.log('Starting upload with comprehensive tracking:', { fileToUpload, metadata });
      
      // Upload with comprehensive progress tracking
      const response = await videoApiService.uploadVideo(fileToUpload, metadata, {
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
        // Clean up secured files after successful upload
        try {
          if (secureVideoUri) {
            await FileSystem.deleteAsync(secureVideoUri, { idempotent: true });
            console.log('LOG: Cleaned up secured video file');
          }
          if (compressedUri && compressedUri !== secureVideoUri) {
            await FileSystem.deleteAsync(compressedUri, { idempotent: true });
            console.log('LOG: Cleaned up compressed video file');
          }
        } catch (cleanupError) {
          console.warn('WARN: Failed to cleanup files:', cleanupError);
        }
        
        // Show completion state briefly before navigating
        setTimeout(() => {
          setIsLoading(false);
          router.replace('/watchVideos');
        }, 1000); // Give user time to see 100% completion
      } else {
        throw new Error(response.error || t('alerts.unexpectedError'));
      }

    } catch (error: any) {
      console.error('CameraUpload - Complete upload process error:', error);
      
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
      
      Alert.alert(t('videoUploadInterface.alertError'), errorMessage);
    }
  };

  const renderUploadProgress = () => {
    if (!isLoading && uploadState === UploadState.IDLE) return null;
    
    // Use the more specific 'uploadPhase' if available, otherwise fallback to the general state text.
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

  const renderVideoPreview = () => {
    if (!videoFile || !playerUri) {
      return (
        <View style={styles.videoPlaceholder}>
          <ActivityIndicator size="large" color="#3260a0" />
          <Text style={styles.placeholderText}>{
            uploadState === UploadState.SECURING ? 
            'Securing video...' : 
            t('cameraUpload.loadingVideo')
          }</Text>
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
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="white" />
        </TouchableOpacity>
        {!videoLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3260a0" />
          </View>
        )}
      </View>
    );
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Clean up secured file if component unmounts without successful upload
      if (secureVideoUri) {
        FileSystem.deleteAsync(secureVideoUri, { idempotent: true }).catch(error => {
          console.warn('WARN: Failed to cleanup on unmount:', error);
        });
      }
    };
  }, [secureVideoUri]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/post')} 
          style={styles.closeButton}
          disabled={isLoading}
        >
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
              style={[styles.titleInput, isLoading && styles.disabledInput]}
              placeholder={t('videoUploadInterface.enterTitlePlaceholder')}
              value={videoTitle}
              onChangeText={setVideoTitle}
              editable={!isLoading && uploadState !== UploadState.SECURING}
            />
          </View>

          {renderUploadProgress()}

          <View style={styles.uploadSection}>
            <TouchableOpacity
              style={[
                styles.uploadButton, 
                (!videoFile || !videoTitle.trim() || isLoading || !secureVideoUri) && styles.disabledButton
              ]}
              onPress={handleSave}
              disabled={!videoFile || !videoTitle.trim() || isLoading || !secureVideoUri}
            >
              {isLoading || uploadState === UploadState.SECURING ? (
                <View style={styles.uploadButtonLoading}>
                  <ActivityIndicator size="small" color="white" style={{ marginRight: 10 }} />
                  <Text style={styles.uploadButtonText}>{getUploadStateText()}</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="white" style={styles.buttonIcon} />
                  <Text style={styles.uploadButtonText}>{t('videoUploadInterface.uploadButton')}</Text>
                </>
              )}
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
  scrollContainer: { paddingBottom: 20 },
  previewSection: { marginHorizontal: 20, marginTop: 20 },
  videoContainer: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    overflow: 'hidden', 
    position: 'relative' 
  },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
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
  inputSection: { marginHorizontal: 20, marginTop: 20 },
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
  uploadSection: { marginHorizontal: 20, marginTop: 20 },
  uploadButton: { 
    backgroundColor: '#3260ad', 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center' 
  },
  uploadButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  uploadButtonLoading: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  recordButton: { 
    backgroundColor: '#e0e0e0', 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 15, 
    flexDirection: 'row', 
    justifyContent: 'center' 
  },
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
  progressText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333', 
    flex: 1
  },
  progressBarContainer: { 
    height: 8, 
    backgroundColor: '#e9ecef', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBar: { height: '100%', backgroundColor: '#3260ad', borderRadius: 4 },
});

export default CameraUpload;