import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Define proper types for video player status
interface VideoPlayerStatusPayload {
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'readyToPlay';
  error?: any;
}

interface VideoPlayerTimePayload {
  currentTime: number;
}

interface VideoPlayerPlayingPayload {
  isPlaying: boolean;
}

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

  // Fixed: Use number type for React Native timeouts
  const controlsTimeoutRef = React.useRef<number | null>(null);
  const loadingTimeoutRef = React.useRef<number | null>(null);
  const cleanupFunctionsRef = React.useRef<(() => void)[]>([]);

  // Reanimated shared values for swipe animation
  const translateX = useSharedValue(0);
  const isSwipeInProgress = useSharedValue(false);

  // Create a new video source when video changes
  const videoSource = React.useMemo(() => {
    if (visible && video?.url) {
      console.log('Creating new video source for:', video.url);
      return { uri: video.url };
    }
    return null;
  }, [visible, video?.url]);

  // Initialize video player with proper source handling
  const player = useVideoPlayer(videoSource, (player) => {
    if (player && videoSource) {
      console.log('Player initialized with source:', videoSource.uri);
      player.loop = false;
      player.muted = false;
      
      // Clear previous event listeners
      cleanupFunctionsRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.error('Error cleaning up previous event listener:', error);
        }
      });
      cleanupFunctionsRef.current = [];
      
      // Add event listeners with proper error handling
      const addEventListeners = () => {
        try {
          // Time update listener
          const timeUpdateListener = player.addListener('timeUpdate', (payload: VideoPlayerTimePayload) => {
            if (payload.currentTime !== undefined && player.duration !== undefined) {
              runOnJS(setCurrentTime)(payload.currentTime);
              runOnJS(setDuration)(player.duration);
            }
          });

          // Playing state listener
          const playingListener = player.addListener('playingChange', (payload: VideoPlayerPlayingPayload) => {
            runOnJS(setIsPlaying)(payload.isPlaying);
            if (payload.isPlaying) {
              runOnJS(setShowLoading)(false);
              runOnJS(setPlayerReady)(true);
            }
          });

          // Status change listener - Fixed type handling
          const statusListener = player.addListener('statusChange', (payload: VideoPlayerStatusPayload) => {
            console.log('Player status changed:', payload.status);
            // Use proper type checking for status
            if (payload.status === 'loaded' || payload.status === 'readyToPlay') {
              runOnJS(setShowLoading)(false);
              runOnJS(setPlayerReady)(true);
              runOnJS(handleVideoLoad)();
            } else if (payload.status === 'error') {
              runOnJS(setShowLoading)(false);
              runOnJS(handleVideoError)(payload.error || 'Unknown video error');
            } else if (payload.status === 'loading') {
              runOnJS(setShowLoading)(true);
            }
          });

          // Store cleanup functions
          cleanupFunctionsRef.current = [
            () => timeUpdateListener?.remove?.(),
            () => playingListener?.remove?.(),
            () => statusListener?.remove?.(),
          ];
        } catch (error) {
          console.error('Error adding event listeners:', error);
          runOnJS(setShowLoading)(false);
          runOnJS(handleVideoError)(error);
        }
      };

      addEventListeners();
    }
  });

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

  // Toggle play/pause with error handling
  const togglePlayPause = React.useCallback(() => {
    if (player && playerReady) {
      try {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      } catch (error) {
        console.error('Error toggling play/pause:', error);
      }
    }
  }, [player, playerReady, isPlaying]);

  // Format time for display
  const formatTime = (timeInSeconds: number): string => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Share video with error handling
  const shareVideo = async () => {
    if (!video) return;

    try {
      const originalUrl = video.url;
      const videoUrlToShare = originalUrl.replace(
        "https://storage.googleapis.com/share_jesus_today_bucket/",
        "https://sharejesustoday.org/videos/?vd="
      );

      await Share.share({
        message: `Check out this video: \n${videoUrlToShare}`,
        title: video.title,
      });
    } catch (error) {
      console.error('Error sharing video:', error);
    }
  };

  // Handle video load success
  const handleVideoLoad = React.useCallback(() => {
    console.log('Video loaded successfully');
    setShowLoading(false);
    setPlayerReady(true);
    onVideoLoad();
    
    // Clear loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, [onVideoLoad]);

  // Handle video error
  const handleVideoError = React.useCallback((error: any) => {
    console.error('Video error:', error);
    setShowLoading(false);
    setPlayerReady(false);
    onVideoError(error);
    
    // Clear loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, [onVideoError]);

  // Handle swipe to next video - Fixed to properly trigger callback
  const handleSwipeToNext = React.useCallback(() => {
    if (onNextVideo && videoList && currentVideoIndex < videoList.length - 1) {
      console.log('Executing swipe to next video');
      // Reset player state before switching
      setShowLoading(true);
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      
      // Pause current player if playing
      if (player && isPlaying) {
        try {
          player.pause();
        } catch (error) {
          console.error('Error pausing player before next video:', error);
        }
      }
      
      // Trigger the next video callback
      onNextVideo();
    }
  }, [onNextVideo, videoList, currentVideoIndex, player, isPlaying]);

  // Handle swipe to previous video - Fixed to properly trigger callback
  const handleSwipeToPrevious = React.useCallback(() => {
    if (onPreviousVideo && currentVideoIndex > 0) {
      console.log('Executing swipe to previous video');
      // Reset player state before switching
      setShowLoading(true);
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      
      // Pause current player if playing
      if (player && isPlaying) {
        try {
          player.pause();
        } catch (error) {
          console.error('Error pausing player before previous video:', error);
        }
      }
      
      // Trigger the previous video callback
      onPreviousVideo();
    }
  }, [onPreviousVideo, currentVideoIndex, player, isPlaying]);

  // Fixed: Reset states when video changes (not just when modal opens)
  React.useEffect(() => {
    if (visible && video?.url) {
      console.log('Video changed or modal opened:', video.url);
      setShowLoading(true);
      setShowControls(true);
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      resetControlsTimeout();
      translateX.value = 0;
      isSwipeInProgress.value = false;

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      // Fallback timeout for loading
      loadingTimeoutRef.current = setTimeout(() => {
        console.log('Loading timeout reached, setting player ready');
        setShowLoading(false);
        setPlayerReady(true);
      }, 8000); // Increased timeout
    } else if (!visible) {
      setShowControls(true);
      setShowLoading(true);
      setPlayerReady(false);
      setIsPlaying(false);
      
      // Safely pause player
      if (player) {
        try {
          player.pause();
        } catch (error) {
          console.error('Error pausing player:', error);
        }
      }

      // Clear timeouts
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }
  }, [visible, video?.url, video?.id, resetControlsTimeout, player]); // Added video?.id to dependencies

  // Player status monitoring
  React.useEffect(() => {
    if (!player || !visible || !playerReady) return;

    const interval = setInterval(() => {
      try {
        const status = {
          isLoaded: playerReady,
          isPlaying: isPlaying,
          positionMillis: currentTime * 1000,
          durationMillis: duration * 1000,
        };
        onPlaybackStatusUpdate(status);
      } catch (error) {
        console.error('Error updating playback status:', error);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [player, visible, playerReady, isPlaying, currentTime, duration, onPlaybackStatusUpdate]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Clear timeouts
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      // Clean up event listeners
      cleanupFunctionsRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error) {
          console.error('Error cleaning up event listener:', error);
        }
      });
      cleanupFunctionsRef.current = [];
    };
  }, []);

  // Improved swipe gesture with proper threshold and velocity handling
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Slightly increased sensitivity
    .failOffsetY([-60, 60]) // Allow more vertical movement before failing
    .onStart(() => {
      isSwipeInProgress.value = true;
      console.log('Swipe gesture started');
    })
    .onUpdate((event) => {
      // Only update translateX if we're not at the boundaries
      const { translationX } = event;
      
      // Limit the translation based on available videos
      const canSwipeLeft = onNextVideo && videoList && currentVideoIndex < videoList.length - 1;
      const canSwipeRight = onPreviousVideo && currentVideoIndex > 0;
      
      if (translationX > 0 && !canSwipeRight) {
        // Swiping right but can't go to previous - add resistance
        translateX.value = translationX * 0.2;
      } else if (translationX < 0 && !canSwipeLeft) {
        // Swiping left but can't go to next - add resistance
        translateX.value = translationX * 0.2;
      } else {
        translateX.value = translationX;
      }
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      
      // Define thresholds - Made more lenient
      const swipeThreshold = screenWidth * 0.2; // 20% of screen width
      const velocityThreshold = 600; // pixels per second
      
      const isSignificantSwipe = 
        Math.abs(translationX) > swipeThreshold || 
        Math.abs(velocityX) > velocityThreshold;
      
      console.log('Swipe end:', { 
        translationX, 
        velocityX, 
        isSignificantSwipe,
        swipeThreshold,
        velocityThreshold 
      });
      
      if (isSignificantSwipe) {
        if (translationX > 0) {
          // Swiping right - go to previous video
          const canSwipeRight = onPreviousVideo && currentVideoIndex > 0;
          if (canSwipeRight) {
            console.log('Triggering previous video - animation start');
            translateX.value = withSpring(screenWidth, {
              damping: 15,
              stiffness: 200
            }, (finished) => {
              if (finished) {
                console.log('Previous video animation finished, calling handler');
                runOnJS(handleSwipeToPrevious)();
                translateX.value = 0;
              }
            });
          } else {
            console.log('Cannot swipe right, bouncing back');
            translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        } else {
          // Swiping left - go to next video
          const canSwipeLeft = onNextVideo && videoList && currentVideoIndex < videoList.length - 1;
          if (canSwipeLeft) {
            console.log('Triggering next video - animation start');
            translateX.value = withSpring(-screenWidth, {
              damping: 15,
              stiffness: 200
            }, (finished) => {
              if (finished) {
                console.log('Next video animation finished, calling handler');
                runOnJS(handleSwipeToNext)();
                translateX.value = 0;
              }
            });
          } else {
            console.log('Cannot swipe left, bouncing back');
            translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
          }
        }
      } else {
        // Not a significant swipe - bounce back
        console.log('Not a significant swipe, bouncing back');
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
      
      isSwipeInProgress.value = false;
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  if (!visible || !video) {
    return null;
  }

  const currentUserId = userId || video.uploader?.id;
  const currentProfileImageUrl = profileImageUrl || video.uploader?.profilePicture;

  // Check if navigation is available
  const canSwipeLeft = onNextVideo && videoList && currentVideoIndex < videoList.length - 1;
  const canSwipeRight = onPreviousVideo && currentVideoIndex > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.container}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.videoContentWrapper, animatedStyle]}>
              <View style={styles.videoContainer}>
                {/* Video Player */}
                <TouchableOpacity
                  style={styles.videoPlayerContainer}
                  activeOpacity={1}
                  onPress={toggleControls}
                >
                  {visible && video?.url && player && (
                    <VideoView
                      style={styles.video}
                      player={player}
                      allowsFullscreen={false}
                      allowsPictureInPicture={false}
                      nativeControls={false}
                      onLoad={handleVideoLoad}
                      onError={handleVideoError}
                    />
                  )}

                  {/* Loading indicator */}
                  {showLoading && (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={styles.loadingText}>Loading video...</Text>
                    </View>
                  )}

                  {/* Controls overlay */}
                  {showControls && (
                    <View style={styles.controlsOverlay}>
                      {/* Top controls */}
                      <View style={styles.topControls}>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                          <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.rightControls}>
                          {/* Swipe instruction */}
                          <Text style={styles.swipeInstruction}>
                            Swipe left/right to view next or previous video
                          </Text>
                          
                          {onFlagPress && (
                            <TouchableOpacity
                              style={styles.flagButton}
                              onPress={onFlagPress}
                            >
                              <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Center play/pause button */}
                      {playerReady && (
                        <View style={styles.centerControls}>
                          <TouchableOpacity
                            style={styles.playPauseButton}
                            onPress={togglePlayPause}
                          >
                            <Ionicons
                              name={isPlaying ? "pause" : "play"}
                              size={50}
                              color="#fff"
                            />
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Bottom controls */}
                      <View style={styles.bottomControls}>
                        {/* Progress bar */}
                        {playerReady && duration > 0 && (
                          <View style={styles.progressContainer}>
                            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                            <View style={styles.progressBar}>
                              <View
                                style={[
                                  styles.progressFill,
                                  { width: `${(currentTime / duration) * 100}%` }
                                ]}
                              />
                            </View>
                            <Text style={styles.timeText}>{formatTime(duration)}</Text>
                          </View>
                        )}

                        {/* Video navigation indicators */}
                        <View style={styles.navigationIndicators}>
                          <View style={styles.navIndicator}>
                            <Text style={styles.navIndicatorText}>
                              {canSwipeRight ? '← Previous' : ''}
                            </Text>
                          </View>
                          
                          <Text style={styles.videoCounter}>
                            {currentVideoIndex + 1} of {videoList?.length || 1}
                          </Text>
                          
                          <View style={styles.navIndicator}>
                            <Text style={styles.navIndicatorText}>
                              {canSwipeLeft ? 'Next →' : ''}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Video info section */}
              <View style={styles.infoSection}>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle}>{video.title}</Text>

                  <View style={styles.uploaderInfo}>
                    <TouchableOpacity style={styles.uploaderContainer}>
                      {currentProfileImageUrl ? (
                        <Image
                          source={{ uri: currentProfileImageUrl }}
                          style={styles.uploaderImage}
                          onError={() => console.log('Error loading profile image')}
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

                    <TouchableOpacity style={styles.shareButton} onPress={shareVideo}>
                      <Ionicons name="share-outline" size={24} color="#333" />
                    </TouchableOpacity>
                  </View>
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
    paddingVertical: 5,
  },
  videoContentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoContainer: {
    flex: 1,
  },
  videoPlayerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  rightControls: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: 20,
  },
  swipeInstruction: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    paddingBottom: 20,
    paddingHorizontal: 20,
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
  },
  progressFill: {
    height: 4,
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
    alignItems: 'center',
  },
  navIndicator: {
    minWidth: 80,
  },
  navIndicatorText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 6,
    borderRadius: 8,
  },
  videoCounter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 8,
    borderRadius: 12,
    minWidth: 80,
  },
  infoSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  videoInfo: {
    // Space for video info
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    lineHeight: 24,
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