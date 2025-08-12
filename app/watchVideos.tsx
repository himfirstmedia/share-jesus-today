import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler, // Added BackHandler
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { t } from '@/utils/i18n';
import VideoCardSkeleton from '../components/videoCardSkeleton';
import { VideoCard } from '../components/video/VideoCard';
import { VideoModal } from '../components/video/VideoModal';
import videoApiService, { VideoModel } from '../services/videoApiService';
import videoCacheService from '../services/videoCacheService';

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
  onUserBlocked 
}) => {
  const handleBlockVideo = async () => {
    try {
      await addBlockedVideoId(video.id);
      Alert.alert(t('alerts.success'), t('videoActions.videoBlockedSuccess'), [
        { text: t('alerts.ok'), onPress: onVideoBlocked }
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
        { text: t('alerts.ok'), onPress: onUserBlocked }
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
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>{t('videoActions.reportAndBlock')}</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleBlockVideo}>
            <Ionicons name="eye-off-outline" size={20} color="#333" />
            <Text style={styles.menuItemText}>{t('videoActions.blockThisVideo')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleBlockUser}>
            <Ionicons name="person-remove-outline" size={20} color="#333" />
            <Text style={styles.menuItemText}>
              {t('videoActions.blockUser', { firstName: video.uploader.firstName, lastName: video.uploader.lastName })}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleReportUser}>
            <Ionicons name="flag-outline" size={20} color="#e74c3c" />
            <Text style={[styles.menuItemText, { color: '#e74c3c' }]}>
              {t('videoActions.reportUser', { firstName: video.uploader.firstName, lastName: video.uploader.lastName })}
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

const WatchVideosScreen = () => {
  const [allVideos, setAllVideos] = useState<VideoModel[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<VideoModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // States for VideoModal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedVideoForModal, setSelectedVideoForModal] = useState<VideoModel | null>(null);
  const [currentVideoIndexInModal, setCurrentVideoIndexInModal] = useState(0);

  // Block Menu State
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [selectedVideoForBlocking, setSelectedVideoForBlocking] = useState<VideoModel | null>(null);

  const PAGE_SIZE = 10;

  const handleNextVideoInModal = () => {
    if (currentVideoIndexInModal < displayedVideos.length - 1) {
      const nextIndex = currentVideoIndexInModal + 1;
      setSelectedVideoForModal(displayedVideos[nextIndex]);
      setCurrentVideoIndexInModal(nextIndex);
    }
  };

  const handlePreviousVideoInModal = () => {
    if (currentVideoIndexInModal > 0) {
      const prevIndex = currentVideoIndexInModal - 1;
      setSelectedVideoForModal(displayedVideos[prevIndex]);
      setCurrentVideoIndexInModal(prevIndex);
    }
  };

  const filterOutBlockedVideos = async (videos: VideoModel[]): Promise<VideoModel[]> => {
    const [blockedUserIds, blockedVideoIds] = await Promise.all([
      getBlockedItemIds(BLOCKED_USER_IDS_KEY),
      getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY),
    ]);

    return videos.filter(
      video => 
        video.uploader && 
        !blockedUserIds.includes(video.uploader.id) && 
        !blockedVideoIds.includes(video.id)
    );
  };



  const loadInitialVideos = async () => {
    if (isLoading) return;
    console.log('Loading initial videos...');
    setIsLoading(true);
    try {
      const response = await videoApiService.fetchPublicVideos(0, PAGE_SIZE);
      if (response.success && response.data) {
        const fetchedVideos = response.data.data;
        const nonBlockedVideos = await filterOutBlockedVideos(fetchedVideos);

        setAllVideos(nonBlockedVideos);
        setDisplayedVideos(nonBlockedVideos);
        setTotalPages(response.data.totalPages);
        setCurrentPage(response.data.number !== undefined ? response.data.number : 0);
        console.log(`Initial load: Fetched ${fetchedVideos.length}, Displaying ${nonBlockedVideos.length} (after filtering).`);

      } else {
        console.error('Failed to load initial videos:', response.error);
        Alert.alert('Error', 'Failed to load videos. Please try again.');
      }
    } catch (error) {
      console.error('Failed to load initial videos:', error);
      Alert.alert('Error', 'Failed to load videos. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (isLoadingMore || (totalPages > 0 && currentPage >= totalPages - 1)) {
      console.log('Load more condition not met or already at last page');
      return;
    }
    
    const nextPageToFetch = currentPage + 1;
    console.log(`Loading more videos, page: ${nextPageToFetch}`);
    setIsLoadingMore(true);

    try {
      const response = await videoApiService.fetchPublicVideos(nextPageToFetch, PAGE_SIZE);
      if (response.success && response.data) {
        const fetchedVideos = response.data.data;
        if (fetchedVideos.length > 0) {
          const nonBlockedNewVideos = await filterOutBlockedVideos(fetchedVideos);

          if (nonBlockedNewVideos.length > 0) {
            setAllVideos(prevAllVideos => {
              const updatedAllVideos = [...prevAllVideos, ...nonBlockedNewVideos];
              if (searchTerm.trim() === '') {
                setDisplayedVideos(updatedAllVideos);
              } else {
                const filtered = updatedAllVideos.filter(video =>
                  video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  `${video.uploader.firstName} ${video.uploader.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
                );
                setDisplayedVideos(filtered);
              }
              return updatedAllVideos;
            });
            console.log(`Loaded ${nonBlockedNewVideos.length} more non-blocked videos.`);
            preCacheVideos(nonBlockedNewVideos);
          }
        }
        setCurrentPage(response.data.number !== undefined ? response.data.number : nextPageToFetch);
        setTotalPages(response.data.totalPages);
      } else {
        console.error('Failed to load more videos:', response.error);
      }
    } catch (error) {
      console.error('Failed to load more videos:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const refreshVideoList = async () => {
    // Refresh the current displayed videos by filtering out newly blocked content
    const refreshedVideos = await filterOutBlockedVideos(allVideos);
    setAllVideos(refreshedVideos);
    
    if (searchTerm.trim() === '') {
      setDisplayedVideos(refreshedVideos);
    } else {
      const filtered = refreshedVideos.filter(video =>
        video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${video.uploader.firstName} ${video.uploader.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setDisplayedVideos(filtered);
    }
  };

  const handleVideoBlocked = () => {
    refreshVideoList();
    // Close modal if the blocked video was currently being viewed
    if (selectedVideoForModal && selectedVideoForBlocking && 
        selectedVideoForModal.id === selectedVideoForBlocking.id) {
      setIsModalVisible(false);
    }
  };

  const handleUserBlocked = () => {
    refreshVideoList();
    // Close modal if the blocked user's video was currently being viewed
    if (selectedVideoForModal && selectedVideoForBlocking && 
        selectedVideoForModal.uploader.id === selectedVideoForBlocking.uploader.id) {
      setIsModalVisible(false);
    }
  };

  const handleShowBlockMenu = (video: VideoModel) => {
    setSelectedVideoForBlocking(video);
    setShowBlockMenu(true);
  };

  useEffect(() => {
    loadInitialVideos();

    const backAction = () => {
      // if (router.canGoBack()) {
      //   router.back();
      // } else {
      //   router.replace('/(tabs)');
      // }
      router.replace('/(tabs)');
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    if (text.trim() === '') {
      setDisplayedVideos(allVideos);
    } else {
      const filtered = allVideos.filter(video =>
        video.title.toLowerCase().includes(text.toLowerCase()) ||
        `${video.uploader.firstName} ${video.uploader.lastName}`.toLowerCase().includes(text.toLowerCase())
      );
      setDisplayedVideos(filtered);
    }
  };

  const renderVideoItem = ({ item }: { item: VideoModel }) => (
    <VideoCard
      video={item as any}
      onPress={() => {
        const index = displayedVideos.findIndex(v => v.id === item.id);
        setSelectedVideoForModal(item);
        setCurrentVideoIndexInModal(index >= 0 ? index : 0);
        setIsModalVisible(true);
      }}
    />
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return <ActivityIndicator style={{ marginVertical: 20 }} size="large" color="#0000ff" />;
  };

  if (isLoading && allVideos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#4472C4" barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('home.watchVideos')}</Text>
          <View style={{width: 24}} />
        </View>
        <FlatList
          data={Array.from({ length: 5 })}
          renderItem={() => <VideoCardSkeleton />}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.listContentContainer}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4472C4" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('home.watchVideos')}</Text>
        <View style={{width: 24}} />
      </View>
      
      <TextInput
        style={styles.searchInput}
        placeholder={t('searchScreen.searchPlaceholder')}
        placeholderTextColor="#666"
        value={searchTerm}
        onChangeText={handleSearch}
      />
      
      <FlatList
        data={displayedVideos}
        renderItem={renderVideoItem}
        keyExtractor={item => item.id}
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={() => (
          !isLoading && !isLoadingMore && <Text style={styles.emptyListText}>No videos found.</Text>
        )}
        contentContainerStyle={styles.listContentContainer}
      />

      {selectedVideoForModal && (
        <VideoModal
          visible={isModalVisible}
          video={selectedVideoForModal as any}
          isLoading={false}
          onClose={() => setIsModalVisible(false)}
          onVideoLoad={() => console.log('Video modal: Video loaded')}
          onVideoError={(error) => console.error('Video modal: Video error', error)}
          onPlaybackStatusUpdate={(status) => console.log('Video modal: Playback status', status)}
          videoList={displayedVideos as any[]}
          currentVideoIndex={currentVideoIndexInModal}
          onNextVideo={handleNextVideoInModal}
          onPreviousVideo={handlePreviousVideoInModal}
          onFlagPress={() => selectedVideoForModal && handleShowBlockMenu(selectedVideoForModal)}
        />
      )}

      {selectedVideoForBlocking && (
        <BlockMenu
          visible={showBlockMenu}
          video={selectedVideoForBlocking}
          onClose={() => setShowBlockMenu(false)}
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
    backgroundColor: '#f0f0f0', // Changed to a light gray
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#4472C4',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color:'white'
  },
  searchInput: {
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    margin: 15,
    backgroundColor: '#ffffff',
    fontSize: 16,
    color: '#000',
  },
  listContentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: '#fff',
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#ffffff',
  },
  // Block Menu Styles
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

export default WatchVideosScreen;