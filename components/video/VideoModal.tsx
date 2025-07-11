// components/video/VideoModal.tsx
import { useNavigation } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { type Video as VideoType } from '../../services/apiService';
import { videoStyles } from '../../styles/VideoStyles';

// Custom control styles
const customControlStyles = {
  customControlsContainer: {
    position: 'absolute' as 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row' as 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    zIndex: 10,
  },
  playPauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 15,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#3260ad',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'center' as 'center',
  },
};

type UserProfileRouteParams = {
  userId: string;
};

interface VideoModalProps {
  visible: boolean;
  video: VideoType | null;
  isLoading: boolean;
  onClose: () => void;
  onVideoLoad: () => void;
  onVideoError: (error: any) => void;
  onPlaybackStatusUpdate: (status: any) => void;
  videoList: VideoType[];
  currentVideoIndex: number;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
  profileImageUrl?: string;
  userId?: string;
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
}) => {
  const navigation = useNavigation();

  const currentUserId = userId || video?.uploader?.id;
  const currentProfileImageUrl = profileImageUrl || video?.uploader?.profilePicture;

  // State management
  const [showMenu, setShowMenu] = React.useState(false);
  const [showLoading, setShowLoading] = React.useState(true);
  const [showControls, setShowControls] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playerReady, setPlayerReady] = React.useState(false);

  // Initialize video player - simplified logic
  const player = useVideoPlayer(
    visible && video?.url ? video.url : null,
    player => {
      if (player) {
        player.loop = false;
        player.muted = false;
      }
    }
  );

  // Refs
  const isMountedRef = React.useRef(true);
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when modal visibility changes
  React.useEffect(() => {
    if (visible && video?.url) {
      setShowLoading(true);
      setShowControls(true);
      setShowMenu(false);
      setPlayerReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    } else if (!visible) {
      setShowMenu(false);
      setShowLoading(true);
      setShowControls(true);
      setPlayerReady(false);
      setIsPlaying(false);
      
      // Clear timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [visible, video?.url]);

  // Auto-hide controls
  const resetControlsTimeout = React.useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000) as unknown as NodeJS.Timeout;
  }, []);

  // Handle player status updates
  React.useEffect(() => {
    if (!player || !visible) return;

    const statusListener = player.addListener('statusChange', (status) => {
      if (!isMountedRef.current) return;

      console.log('Player status:', status.status); // Debug log

      // Handle different statuses
      switch (status.status) {
        case 'readyToPlay':
          setPlayerReady(true);
          setShowLoading(false);
          onVideoLoad();
          break;
        case 'loading':
          setShowLoading(true);
          break;
        case 'error':
          console.error('Video player error:', status.error);
          setShowLoading(false);
          setPlayerReady(false);
          onVideoError(status.error || 'Video failed to load');
          break;
      }

      // Call parent callback with available status info
      onPlaybackStatusUpdate({
        status: status.status,
        currentTime: currentTime,
        duration: duration,
        isPlaying: isPlaying,
      });
    });

    return () => {
      statusListener.remove();
    };
  }, [player, visible, onPlaybackStatusUpdate, onVideoLoad, onVideoError, currentTime, duration, isPlaying]);

  // Separate effect for tracking time and playing state
  React.useEffect(() => {
    if (!player || !playerReady) return;

    const interval = setInterval(() => {
      try {
        // Get current time from player
        const time = player.currentTime || 0;
        const dur = player.duration || 0;
        const playing = player.playing || false;

        setCurrentTime(time);
        setDuration(dur);
        setIsPlaying(playing);
      } catch (error) {
        console.log('Error getting player time:', error);
      }
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [player, playerReady]);

  // Auto-play when player is ready
  React.useEffect(() => {
    if (playerReady && player && visible) {
      const timer = setTimeout(() => {
        try {
          player.play();
          resetControlsTimeout();
        } catch (error) {
          console.error('Auto-play error:', error);
        }
      }, 500); // Small delay to ensure player is fully ready

      return () => clearTimeout(timer);
    }
  }, [playerReady, player, visible, resetControlsTimeout]);

  // Play/pause toggle function
  const togglePlayPause = React.useCallback(() => {
    if (!player || !playerReady) {
      console.log('Player not ready for play/pause');
      return;
    }
    
    try {
      if (isPlaying) {
        console.log('Pausing video');
        player.pause();
      } else {
        console.log('Playing video');
        player.play();
      }
      resetControlsTimeout();
    } catch (error) {
      console.error('Play/pause error:', error);
    }
  }, [player, playerReady, isPlaying, resetControlsTimeout]);

  // Handle video tap to show/hide controls
  const handleVideoTap = React.useCallback(() => {
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Swipe gesture handlers
  const onSwipeGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    // Continuous updates during swipe if needed
  };

  const onSwipeHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      const swipeThreshold = 100;
      const velocityThreshold = 800;
      
      if (
        Math.abs(translationX) > swipeThreshold || 
        Math.abs(velocityX) > velocityThreshold
      ) {
        if (translationX > 0) {
          if (currentVideoIndex > 0) {
            onPreviousVideo();
          }
        } else {
          if (currentVideoIndex < videoList.length - 1) {
            onNextVideo();
          }
        }
      }
    }
  };

  // Menu handlers
  const handleBlockVideo = () => {
    setShowMenu(false);
    console.log('Block video');
  };

  const handleBlockUser = () => {
    setShowMenu(false);
    console.log('Block user');
  };

  const handleReportUser = () => {
    setShowMenu(false);
    console.log('Report user');
  };

  const handleShare = async () => {
    if (!currentUserId) {
      console.log('User ID not available to share profile.');
      return;
    }
    try {
      const profileUrl = `https://sharejesustoday.org/profile/?sh=${currentUserId}`;
      const result = await Share.share({
        message: `Check out this profile: ${profileUrl}`,
        url: profileUrl,
        title: 'Share Profile',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log(`Profile shared via ${result.activityType}`);
        } else {
          console.log('Profile shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share action dismissed');
      }
    } catch (error: any) {
      console.error('Error sharing profile:', error.message);
    }
  };

  const handleProfile = () => {
    if (currentUserId) {
      // @ts-ignore
      navigation.navigate('userProfile', { userId: currentUserId });
      onClose();
    } else {
      console.log('User ID not available for profile navigation.');
    }
  };

  if (!video) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={videoStyles.modalContainer}>
          {/* Header */}
          <View style={videoStyles.modalHeader}>
            <Text style={videoStyles.swipeInstruction}>
              Swipe left/right to view next or previous video.
            </Text>
            <TouchableOpacity style={videoStyles.closeButton} onPress={onClose}>
              <Text style={videoStyles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          {/* Video Player Container with Swipe Gesture */}
          <PanGestureHandler
            onGestureEvent={onSwipeGestureEvent}
            onHandlerStateChange={onSwipeHandlerStateChange}
            activeOffsetX={[-10, 10]}
            failOffsetY={[-5, 5]}
          >
            <View style={videoStyles.videoPlayerContainer}>
              {/* Loading indicator */}
              {showLoading && (
                <View style={videoStyles.videoLoadingContainer}>
                  <ActivityIndicator size="large" color="#3260ad" />
                  <Text style={videoStyles.videoLoadingText}>Loading video...</Text>
                </View>
              )}
              
              {/* Video Player */}
              <TouchableOpacity 
                style={{ flex: 1, width: '100%' }}
                onPress={handleVideoTap}
                activeOpacity={1}
              >
                {visible && video?.url && player && (
                  <VideoView
                    key={`video-${video.id}-${visible}`}
                    player={player}
                    style={videoStyles.videoPlayer}
                    allowsFullscreen={false}
                    allowsPictureInPicture={true}
                    nativeControls={false}
                  />
                )}
              </TouchableOpacity>

              {/* Custom Video Controls */}
              {showControls && playerReady && (
                <View style={customControlStyles.customControlsContainer}>
                  <TouchableOpacity 
                    style={customControlStyles.playPauseButton}
                    onPress={togglePlayPause}
                  >
                    <Text style={customControlStyles.playPauseText}>
                      {isPlaying ? '⏸' : '▶'}
                    </Text>
                  </TouchableOpacity>
                  
                  <Text style={customControlStyles.timeText}>
                    {formatTime(currentTime)}
                  </Text>
                  
                  <View style={customControlStyles.progressContainer}>
                    <View 
                      style={[
                        customControlStyles.progressBar,
                        { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }
                      ]}
                    />
                  </View>
                  
                  <Text style={customControlStyles.timeText}>
                    {formatTime(duration)}
                  </Text>
                </View>
              )}

              {/* Side Controls */}
              <View style={[videoStyles.sideControls, { bottom: 120 }]}>
                <TouchableOpacity 
                  style={videoStyles.sideButton}
                  onPress={handleProfile}
                >
                  <Image
                    source={currentProfileImageUrl ? { uri: currentProfileImageUrl } : require('../../assets/images/default-avatar.png')}
                    style={videoStyles.profileImage}
                  />
                  <Text style={videoStyles.sideButtonLabel}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={videoStyles.sideButton}
                  onPress={handleShare}
                >
                  <View style={videoStyles.shareIcon}>
                    <Text style={videoStyles.shareIconText}>↗</Text>
                  </View>
                  <Text style={videoStyles.sideButtonLabel}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={videoStyles.sideButton}
                  onPress={() => setShowMenu(!showMenu)}
                >
                  <View style={videoStyles.flagIcon}>
                    <Text style={videoStyles.flagIconText}>🏴</Text>
                  </View>
                  <Text style={videoStyles.sideButtonLabel}>Flag</Text>
                </TouchableOpacity>
              </View>

              {/* Menu Dropdown */}
              {showMenu && (
                <View style={videoStyles.menuDropdown}>
                  <TouchableOpacity 
                    style={videoStyles.menuItem}
                    onPress={handleBlockVideo}
                  >
                    <Text style={videoStyles.menuItemText}>Block Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={videoStyles.menuItem}
                    onPress={handleBlockUser}
                  >
                    <Text style={videoStyles.menuItemText}>Block User</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={videoStyles.menuItem}
                    onPress={handleReportUser}
                  >
                    <Text style={videoStyles.menuItemText}>Report User</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Video Title Overlay */}
              <View style={[videoStyles.videoTitleOverlay, { bottom: 180 }]}>
                <Text style={videoStyles.videoTitleText}>{video.title}</Text>
              </View>
            </View>
          </PanGestureHandler>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};