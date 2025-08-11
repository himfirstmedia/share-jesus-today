import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Video from 'react-native-video';

import { VideoModel } from '../services/videoApiService';
import videoCacheService from '../services/videoCacheService';
import { t } from '../utils/i18n';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

// Blocked Content Management
const BLOCKED_USER_IDS_KEY = 'blockedUserIds';
const BLOCKED_VIDEO_IDS_KEY = 'blockedVideoIds';

const getBlockedItemIds = async (key: string): Promise<string[]> => {
  try {
    const itemIdsJson = await AsyncStorage.getItem(key);
    return itemIdsJson ? JSON.parse(itemIdsJson) : [];
  } catch (e) {
    console.error(`Failed to load ${key} from AsyncStorage`, e);
    return [];
  }
};

const addBlockedUserId = async (userId: string) => {
  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_USER_IDS_KEY);
    if (!currentBlocked.includes(userId)) {
      await AsyncStorage.setItem(BLOCKED_USER_IDS_KEY, JSON.stringify([...currentBlocked, userId]));
    }
  } catch (error) {
    console.error('Failed to add blocked user ID:', error);
    throw error;
  }
};

const addBlockedVideoId = async (videoId: string) => {
  try {
    const currentBlocked = await getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY);
    if (!currentBlocked.includes(videoId)) {
      await AsyncStorage.setItem(BLOCKED_VIDEO_IDS_KEY, JSON.stringify([...currentBlocked, videoId]));
    }
  } catch (error) {
    console.error('Failed to add blocked video ID:', error);
    throw error;
  }
};

const reportUser = async (userId: string) => {
  try {
    // TODO: Implement actual reporting to your backend
    console.log('Reporting user:', userId);
    // You would make an API call here to report the user
    // await apiService.reportUser(userId);
  } catch (error) {
    console.error('Failed to report user:', error);
    throw error;
  }
};

// Block Menu Component
interface BlockMenuProps {
  visible: boolean;
  onClose: () => void;
  video: VideoModel;
  onVideoBlocked: () => void;
  onUserBlocked: () => void;
}

const BlockMenu: React.FC<BlockMenuProps> = ({
  visible,
  onClose,
  video,
  onVideoBlocked,
  onUserBlocked,
}) => {
  const handleBlockVideo = async () => {
    try {
      await addBlockedVideoId(video.id);
      Alert.alert(t('alerts.success'), t('videoActions.videoBlockedSuccess'), [
        { text: t('alerts.ok'), onPress: onVideoBlocked },
      ]);
    } catch (error) {
      Alert.alert(t('alerts.error'), t('videoActions.failedToBlockVideo'));
    }
    onClose();
  };

  const handleBlockUser = async () => {
    try {
      await addBlockedUserId(video.uploader.id);
      Alert.alert(t('alerts.success'), t('videoActions.userBlockedSuccess'), [
        { text: t('alerts.ok'), onPress: onUserBlocked },
      ]);
    } catch (error) {
      Alert.alert(t('alerts.error'), t('videoActions.failedToBlockUser'));
    }
    onClose();
  };

  const handleReportUser = async () => {
    Alert.alert(
      t('videoActions.reportUserConfirmTitle'),
      t('videoActions.reportUserConfirmMessage'),
      [
        { text: t('videoActions.cancel'), style: 'cancel' },
        {
          text: t('videoActions.report'),
          style: 'destructive',
          onPress: async () => {
            try {
              await reportUser(video.uploader.id);
              Alert.alert(t('alerts.success'), t('videoActions.userReportedSuccess'));
            } catch (error) {
              Alert.alert(t('alerts.error'), t('videoActions.failedToReportUser'));
            }
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>{t('videoActions.reportAndBlock')}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleBlockVideo}>
            <Ionicons name="eye-off-outline" size={20} color="#333" />
            <Text style={styles.menuItemText}>{t('videoActions.blockThisVideo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
            <Ionicons name="person-remove-outline" size={20} color="#333" />
            <Text style={styles.menuItemText}>
              {t('videoActions.blockUser', {
                firstName: video.uploader.firstName,
                lastName: video.uploader.lastName,
              })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleReportUser}>
            <Ionicons name="flag-outline" size={20} color="#e74c3c" />
            <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>
              {t('videoActions.reportUser', {
                firstName: video.uploader.firstName,
                lastName: video.uploader.lastName,
              })}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>{t('videoActions.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const VideoPlayer = ({
  video,
  isActive,
  onShowBlockMenu,
}: {
  video: VideoModel;
  isActive: boolean;
  onShowBlockMenu: () => void;
}) => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLaidOut, setIsLaidOut] = useState(false);
  const videoRef = useRef<Video>(null);
  const router = useRouter();

  useEffect(() => {
    if (isActive && isLaidOut && video.url) {
      setIsLoading(true);
      setVideoUri(video.url); // Start streaming immediately
      videoCacheService.getVideoUri(video.url).then((uri) => {
        if (uri !== video.url) {
          // If the video was cached, we can use the local URI for future plays
          // but for now, we continue streaming
        }
      });
    }
  }, [isActive, isLaidOut, video.url]);

  const onBuffer = (buffer: { isBuffering: boolean }) => {
    setIsLoading(buffer.isBuffering);
  };

  const onError = (error: any) => {
    console.error('Video Error:', error);
    setIsLoading(false);
  };

  const onLoad = () => {
    setIsLoading(false);
  };

  const handleProfilePress = () => {
    router.push(`/userProfile?userId=${video.uploader.id}`);
  };

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

  return (
    <View style={styles.videoContainer} onLayout={() => setIsLaidOut(true)}>
      {/* Video Content */}
      {isLaidOut && videoUri ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri }}
          style={styles.video}
          resizeMode="contain"
          paused={!isActive}
          repeat
          onLoad={onLoad}
          onBuffer={onBuffer}
          onError={onError}
          playInBackground={false}
          playWhenInactive={false}
        />
      ) : (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
      
      {/* Loading Overlay */}
      {isLoading && isLaidOut && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}
      
      {/* Header Controls */}
      <View style={styles.headerControls}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onShowBlockMenu} style={styles.flagButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* Bottom Info Section - Fixed positioning and styling */}
      <View style={styles.infoSection}>
        <Text 
          style={styles.videoTitle}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {video.title}
        </Text>
        <View style={styles.uploaderInfo}>
          <TouchableOpacity
            style={styles.uploaderContainer}
            onPress={handleProfilePress}
            activeOpacity={0.7}>
            {video.uploader.profilePicture ? (
              <Image
                source={{ uri: video.uploader.profilePicture }}
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
          <TouchableOpacity style={styles.shareButton} onPress={shareVideo} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const VideoPlayerScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { videos: videosJson, startIndex: startIndexString } = params;

  const [videos, setVideos] = useState<VideoModel[]>([]);
  const [initialIndex, setInitialIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (videosJson && typeof videosJson === 'string') {
      setVideos(JSON.parse(videosJson));
    }
    if (startIndexString && typeof startIndexString === 'string') {
      const index = parseInt(startIndexString, 10);
      setInitialIndex(index);
      setActiveIndex(index);
    }
  }, [videosJson, startIndexString]);

  const handleVideoBlocked = () => {
    const newVideos = videos.filter((v) => v.id !== videos[activeIndex].id);
    if (newVideos.length === 0) {
      router.back();
      return;
    }
    setVideos(newVideos);
  };

  const handleUserBlocked = () => {
    const blockedUserId = videos[activeIndex].uploader.id;
    const newVideos = videos.filter((v) => v.uploader.id !== blockedUserId);
    if (newVideos.length === 0) {
      router.back();
      return;
    }
    setVideos(newVideos);
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  if (videos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={({ item, index }) => (
          <VideoPlayer
            video={item}
            isActive={index === activeIndex}
            onShowBlockMenu={() => setShowBlockMenu(true)}
          />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_data, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
      />
      {showBlockMenu && videos[activeIndex] && (
        <BlockMenu
          visible={showBlockMenu}
          onClose={() => setShowBlockMenu(false)}
          video={videos[activeIndex]}
          onVideoBlocked={handleVideoBlocked}
          onUserBlocked={handleUserBlocked}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerControls: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 60,
    left: 0,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    marginLeft: 10,
  },
  flagButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '90%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  infoSection: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 0, // Move up from bottom edge
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24, // Consistent padding for both platforms
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    zIndex: 1,
    // Add shadow for better visibility
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    minHeight: 200, // Ensure minimum height for content
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16, // Increased margin for better spacing
    lineHeight: 22, // Better line height for 2-line text
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
    marginRight: 10, // Add some space from share button
  },
  uploaderImage: {
    width: 40, // Slightly larger for better visibility
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#e0e0e0',
  },
  uploaderImagePlaceholder: {
    width: 40, // Match the image size
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  uploaderName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1, // Allow text to take available space
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  cancelButton: {
    marginTop: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});

export default VideoPlayerScreen;