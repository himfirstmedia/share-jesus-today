import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
// Import react-native-video and its types
import Video, { OnLoadData, OnProgressData } from 'react-native-video';

import videoCacheService from '@/services/videoCacheService';
import { t } from '@/utils/i18n';

// Platform check to ensure native only
if (Platform.OS === 'web') {
  throw new Error('VideoModal is not supported on web platform. Please use native iOS or Android.');
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define proper types for video
interface VideoType {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  createdTimestamp?: string;
}

interface VideoModalProps {
  visible: boolean;
  video: VideoType | null;
  isLoading: boolean;
  onClose: () => void;
  onVideoLoad: () => void;
  onVideoError: (error: any) => void;
  onPlaybackStatusUpdate: (status: any) => void;
  videoList?: VideoType[];
  currentVideoIndex: number;
  onNextVideo?: () => void;
  onPreviousVideo?: () => void;
  profileImageUrl?: string;
  userId?: string;
  onFlagPress?: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  visible,
  video,
  isLoading,
  onClose,
  onVideoLoad,
  onVideoError,
  onPlaybackStatusUpdate,
  videoList,
  currentVideoIndex,
  onNextVideo,
  onPreviousVideo,
  profileImageUrl,
  userId,
  onFlagPress,
}) => {
  const [showControls, setShowControls] = React.useState(true);
  const [showLoading, setShowLoading] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playerReady, setPlayerReady] = React.useState(false);
  const [videoUri, setVideoUri] = React.useState<string | null>(null);
  const router = useRouter();

  // Ref for the react-native-video component
  const videoPlayerRef = React.useRef<Video>(null);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reanimated shared values for swipe animation
  const translateX = useSharedValue(0);
  const isSwipeInProgress = useSharedValue(false);

  // Handle video load success
  const handleVideoLoad = React.useCallback(
    (data: OnLoadData) => {
      console.log('Video loaded successfully');
      setDuration(data.duration);
      setPlayerReady(true);
      // Defer hiding the loader slightly to prevent flicker
      setTimeout(() => setShowLoading(false), 100);
      onVideoLoad();
    },
    [onVideoLoad]
  );

  // Handle video error
  const handleVideoError = React.useCallback(
    async (error: any) => {
      console.error('Video error:', error);
      setShowLoading(false);
      setPlayerReady(false);
      onVideoError(error);

      // Fallback to cached version if available
      if (video?.url) {
        const cachedUri = await videoCacheService.getCachedVideoUri(video.url);
        if (cachedUri && cachedUri !== videoUri) {
          console.log('Retrying with cached URI:', cachedUri);
          setVideoUri(cachedUri);
          setShowLoading(true); // Show loader for the retry
          setIsPlaying(true);
        }
      }
    },
    [onVideoError, video?.url, videoUri]
  );

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Show/hide controls on tap
  const toggleControls = React.useCallback(() => {
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  // Toggle play/pause by updating state
  const togglePlayPause = React.useCallback(() => {
    if (playerReady) {
      setIsPlaying((prev) => !prev);
      resetControlsTimeout();
    }
  }, [playerReady, resetControlsTimeout]);

  // Format time for display
  const formatTime = (timeInSeconds: number): string => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Share video with native Share API
  const shareVideo = async () => {
    if (!video) return;
    try {
      const originalUrl = video.url;
      const videoUrlToShare = originalUrl.replace(
        'https://storage.googleapis.com/share_jesus_today_bucket/',
        'https://sharejesustoday.org/videos/?vd='
      );
      const result = await Share.share({
        message: t('videoModal.shareVideoMessage', { videoUrl: videoUrlToShare }),
        title: video.title,
        ...(Platform.OS === 'ios' && { url: videoUrlToShare }),
      });
      if (result.action === Share.sharedAction) {
        console.log('Video shared successfully');
      }
    } catch (error) {
      console.error('Error sharing video:', error);
    }
  };

  // Handle swipe to next video
  const handleSwipeToNext = React.useCallback(() => {
    if (onNextVideo && videoList && currentVideoIndex < videoList.length - 1) {
      console.log('Executing swipe to next video');
      setIsPlaying(false);
      setShowLoading(true);
      setPlayerReady(false);
      setCurrentTime(0);
      setDuration(0);
      onNextVideo();
    }
  }, [onNextVideo, videoList, currentVideoIndex]);

  // Handle swipe to previous video
  const handleSwipeToPrevious = React.useCallback(() => {
    if (onPreviousVideo && currentVideoIndex > 0) {
      console.log('Executing swipe to previous video');
      setIsPlaying(false);
      setShowLoading(true);
      setPlayerReady(false);
      setCurrentTime(0);
      setDuration(0);
      onPreviousVideo();
    }
  }, [onPreviousVideo, currentVideoIndex]);

  // Reset states when video changes or modal opens/closes
  React.useEffect(() => {
    if (visible && video?.url) {
      console.log('Video changed or modal opened:', video.url);
      setShowLoading(true);
      setShowControls(true);
      setPlayerReady(false);
      setIsPlaying(true); // Auto-play
      setCurrentTime(0);
      setDuration(0);
      resetControlsTimeout();
      translateX.value = 0;
      isSwipeInProgress.value = false;
    } else if (!visible) {
      setIsPlaying(false);
      setShowControls(true);
      setShowLoading(true);
      setPlayerReady(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [visible, video?.id, resetControlsTimeout]);

  React.useEffect(() => {
    if (video?.url) {
      // Prioritize streaming
      setVideoUri(video.url);
      
      // Start caching in the background
      videoCacheService.startCachingVideo(video.url).catch(err => {
        console.warn('Background caching failed:', err);
      });
    }
  }, [video?.url]);

  // Player status monitoring
  React.useEffect(() => {
    if (!visible || !playerReady) return;
    const interval = setInterval(() => {
      onPlaybackStatusUpdate({
        isLoaded: playerReady,
        isPlaying: isPlaying,
        positionMillis: currentTime * 1000,
        durationMillis: duration * 1000,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, playerReady, isPlaying, currentTime, duration, onPlaybackStatusUpdate]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Native-optimized swipe gesture
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-60, 60])
    .onStart(() => {
      isSwipeInProgress.value = true;
    })
    .onUpdate((event) => {
      const { translationX } = event;
      const resistanceFactor = Platform.OS === 'ios' ? 0.15 : 0.2;
      const canSwipeLeft = onNextVideo && videoList && currentVideoIndex < videoList.length - 1;
      const canSwipeRight = onPreviousVideo && currentVideoIndex > 0;

      if ((translationX > 0 && !canSwipeRight) || (translationX < 0 && !canSwipeLeft)) {
        translateX.value = translationX * resistanceFactor;
      } else {
        translateX.value = translationX;
      }
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      const swipeThreshold = screenWidth * (Platform.OS === 'ios' ? 0.15 : 0.2);
      const velocityThreshold = Platform.OS === 'ios' ? 500 : 600;
      const isSignificantSwipe =
        Math.abs(translationX) > swipeThreshold || Math.abs(velocityX) > velocityThreshold;

      const finishSwipe = (targetX: number, callback: () => void) => {
        translateX.value = withTiming(
          targetX,
          { duration: 250, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) {
              runOnJS(callback)();
              translateX.value = 0;
            }
          }
        );
      };

      const bounceBack = () => {
        translateX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      };

      if (isSignificantSwipe) {
        if (translationX > 0 && onPreviousVideo && currentVideoIndex > 0) {
          finishSwipe(screenWidth, handleSwipeToPrevious);
        } else if (
          translationX < 0 &&
          onNextVideo &&
          videoList &&
          currentVideoIndex < videoList.length - 1
        ) {
          finishSwipe(-screenWidth, handleSwipeToNext);
        } else {
          bounceBack();
        }
      } else {
        bounceBack();
      }
      isSwipeInProgress.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!visible || !video) {
    return null;
  }

  const currentUserId = userId || video.uploader?.id;
  const currentProfileImageUrl = profileImageUrl || video.uploader?.profilePicture;
  const canSwipeLeft = onNextVideo && videoList && currentVideoIndex < videoList.length - 1;
  const canSwipeRight = onPreviousVideo && currentVideoIndex > 0;

  const handleProfilePress = () => {
    if (currentUserId) {
      onClose();
      router.push(`/userProfile?userId=${currentUserId}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.videoContentWrapper, animatedStyle]}>
              <View style={styles.videoContainer}>
                {visible && videoUri && (
                  <Video
                    ref={videoPlayerRef}
                    source={{ uri: videoUri }}
                    style={styles.video}
                    paused={!isPlaying}
                    controls={false}
                    resizeMode="contain"
                    repeat={false}
                    onLoadStart={() => setShowLoading(true)}
                    onLoad={handleVideoLoad}
                    onError={handleVideoError}
                    onProgress={(data: OnProgressData) => setCurrentTime(data.currentTime)}
                    onReadyForDisplay={() => {
                      setShowLoading(false);
                      setPlayerReady(true);
                    }}
                    onEnd={() => setIsPlaying(false)}
                    playInBackground={false}
                    playWhenInactive={false}
                  />
                )}

                {showLoading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#fff" animating />
                    <Text style={styles.loadingText}>{t('videoModal.loadingVideo')}</Text>
                  </View>
                )}

                <View style={styles.persistentControls}>
                  <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.rightControls}>
                    {onFlagPress && (
                      <TouchableOpacity
                        style={styles.flagButton}
                        onPress={onFlagPress}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {showControls && (
                  <View style={styles.controlsOverlay}>
                    <TouchableOpacity
                      style={StyleSheet.absoluteFill}
                      onPress={toggleControls}
                      activeOpacity={1}
                    />
                    <View style={styles.topControls}>
                      <Text style={styles.swipeInstruction}>
                        {t('videoModal.swipeInstruction')}
                      </Text>
                    </View>

                    {playerReady && (
                      <View style={styles.centerControls}>
                        <TouchableOpacity
                          style={styles.playPauseButton}
                          onPress={togglePlayPause}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={isPlaying ? 'pause' : 'play'} size={50} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.bottomControls}>
                      {playerReady && duration > 0 && (
                        <View style={styles.progressContainer}>
                          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                          <View style={styles.progressBar}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${(currentTime / duration) * 100}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.timeText}>{formatTime(duration)}</Text>
                        </View>
                      )}
                      <View style={styles.navigationIndicators}>
                        <Text style={styles.navIndicatorText}>
                          {canSwipeRight ? t('videoModal.previous') : ''}
                        </Text>
                        <Text style={styles.navIndicatorText}>
                          {canSwipeLeft ? t('videoModal.next') : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.infoSection}>
                <Text style={styles.videoTitle}>{video.title}</Text>
                <View style={styles.uploaderInfo}>
                  <TouchableOpacity
                    style={styles.uploaderContainer}
                    onPress={handleProfilePress}
                    activeOpacity={0.7}
                  >
                    {currentProfileImageUrl ? (
                      <Image
                        source={{ uri: currentProfileImageUrl }}
                        style={styles.uploaderImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.uploaderImagePlaceholder}>
                        <Ionicons name="person" size={20} color="#666" />
                      </View>
                    )}
                    <Text style={styles.uploaderName}>
                      {video.uploader.firstName} {video.uploader.lastName}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={shareVideo}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-outline" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.0)',
    zIndex: 1,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  persistentControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  controlsOverlay: {
    display:'none',
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 5,
    
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 70,
    paddingHorizontal: 20,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  rightControls: {
    alignItems: 'flex-end',
  },
  swipeInstruction: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
    backgroundColor: 'rgba(0, 0, 0, 0.0)',
    padding: 8,
    borderRadius: 12,
  },
  flagButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  centerControls: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 6,
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    padding: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3260ad',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center',
  },
  navigationIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navIndicatorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: 60,
  },
  infoSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: Platform.OS === 'ios' ? 15 : 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -16,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  uploaderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  uploaderImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  uploaderImagePlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  uploaderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  shareButton: {
    padding: 8,
  },
});

export default VideoModal;