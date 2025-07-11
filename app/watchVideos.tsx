import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { VideoCard } from '../components/video/VideoCard'; // Import the actual VideoCard
import { VideoModal } from '../components/video/VideoModal'; // Import VideoModal
import videoApiService, { VideoModel } from '../services/videoApiService'; // Import real service and types

// --- Blocked Content Management (Placeholder - ideally in a separate util) ---
const BLOCKED_USER_IDS_KEY = 'blockedUserIds';
const BLOCKED_VIDEO_IDS_KEY = 'blockedVideoIds'; // Assuming we block by video ID for more robustness

const getBlockedItemIds = async (key: string): Promise<string[]> => {
  try {
    const itemIdsJson = await AsyncStorage.getItem(key);
    return itemIdsJson ? JSON.parse(itemIdsJson) : [];
  } catch (e) {
    console.error(`Failed to load ${key} from AsyncStorage`, e);
    return [];
  }
};

// Example: Functions to add items to block list (would be called elsewhere)
// const addBlockedUserId = async (userId: string) => {
//   const currentBlocked = await getBlockedItemIds(BLOCKED_USER_IDS_KEY);
//   if (!currentBlocked.includes(userId)) {
//     await AsyncStorage.setItem(BLOCKED_USER_IDS_KEY, JSON.stringify([...currentBlocked, userId]));
//   }
// };
// const addBlockedVideoId = async (videoId: string) => {
//   const currentBlocked = await getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY);
//   if (!currentBlocked.includes(videoId)) {
//     await AsyncStorage.setItem(BLOCKED_VIDEO_IDS_KEY, JSON.stringify([...currentBlocked, videoId]));
//   }
// };
// --- End Blocked Content Management ---


const WatchVideosScreen = () => {
  const [allVideos, setAllVideos] = useState<VideoModel[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<VideoModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false); // For initial load
  const [isLoadingMore, setIsLoadingMore] = useState(false); // For loading more pages

  // States for VideoModal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedVideoForModal, setSelectedVideoForModal] = useState<VideoModel | null>(null);
  const [currentVideoIndexInModal, setCurrentVideoIndexInModal] = useState(0);

  const PAGE_SIZE = 10; // Number of videos to fetch per page

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

  const loadInitialVideos = async () => {
    if (isLoading) return;
    console.log('Loading initial videos...');
    setIsLoading(true);
    try {
      const [blockedUserIds, blockedVideoIds] = await Promise.all([
        getBlockedItemIds(BLOCKED_USER_IDS_KEY),
        getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY),
      ]);

      const response = await videoApiService.fetchPublicVideos(0, PAGE_SIZE);
      if (response.success && response.data) {
        const fetchedVideos = response.data.data;
        const nonBlockedVideos = fetchedVideos.filter(
          video => video.uploader && !blockedUserIds.includes(video.uploader.id) && !blockedVideoIds.includes(video.id)
        );

        setAllVideos(nonBlockedVideos);
        setDisplayedVideos(nonBlockedVideos); // Initially display all fetched non-blocked
        setTotalPages(response.data.totalPages); // Total pages from API, filtering might affect perceived total by user
        setCurrentPage(response.data.number !== undefined ? response.data.number : 0);
        console.log(`Initial load: Fetched ${fetchedVideos.length}, Displaying ${nonBlockedVideos.length} (after filtering). Total API pages: ${response.data.totalPages}.`);
      } else {
        console.error('Failed to load initial videos:', response.error);
        // TODO: Show error message to user
      }
    } catch (error) {
      console.error('Failed to load initial videos:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreVideos = async () => {
    if (isLoadingMore || (totalPages > 0 && currentPage >= totalPages - 1)) {
      console.log('Load more condition not met or already at last page:', {isLoadingMore, currentPage, totalPages});
      if (totalPages > 0 && currentPage >= totalPages - 1) {
        console.log('Already on the last page.');
      }
      return;
    }
    
    const nextPageToFetch = currentPage + 1;
    console.log(`Loading more videos, page: ${nextPageToFetch}`);
    setIsLoadingMore(true);

    try {
      const [blockedUserIds, blockedVideoIds] = await Promise.all([
        getBlockedItemIds(BLOCKED_USER_IDS_KEY),
        getBlockedItemIds(BLOCKED_VIDEO_IDS_KEY),
      ]);

      const response = await videoApiService.fetchPublicVideos(nextPageToFetch, PAGE_SIZE);
      if (response.success && response.data) {
        const fetchedVideos = response.data.data;
        if (fetchedVideos.length > 0) {
          const nonBlockedNewVideos = fetchedVideos.filter(
            video => !blockedUserIds.includes(video.uploader.id) && !blockedVideoIds.includes(video.id)
          );

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
          } else {
            console.log('Fetched new videos, but all were blocked or empty after filtering.');
          }
        } else {
          console.log('No more new videos to load from API.');
        }
        setCurrentPage(response.data.number !== undefined ? response.data.number : nextPageToFetch);
        setTotalPages(response.data.totalPages);
      } else {
        console.error('Failed to load more videos:', response.error);
        // TODO: Show error message to user
      }
    } catch (error) {
      console.error('Failed to load more videos:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitialVideos();
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
    // @ts-ignore TODO: Resolve type incompatibility if VideoModel is not directly assignable to VideoType for VideoCard
    // This is often due to one type being a subset of another or minor differences not affecting usage.
    // For now, we assume VideoModel from videoApiService has the necessary fields for VideoCard.
    <VideoCard
      video={item as any} // Use 'as any' for now, or create a mapping function if types diverge significantly
      onPress={() => {
        const index = displayedVideos.findIndex(v => v.id === item.id);
        setSelectedVideoForModal(item);
        setCurrentVideoIndexInModal(index >= 0 ? index : 0);
        setIsModalVisible(true);
        console.log('Pressed video:', item.title, `Index in displayed: ${index}`);
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
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch Videos</Text>
        <View style={{width: 24}} />{/* Spacer */}
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search videos ..."
        placeholderTextColor="#001"
        value={searchTerm}
        onChangeText={handleSearch}
      />
      <FlatList
        data={displayedVideos}
        renderItem={renderVideoItem}
        keyExtractor={item => item.id}
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.5} // Load more when half a screen away from the end
        ListFooterComponent={renderFooter}
        ListEmptyComponent={() => (
            !isLoading && !isLoadingMore && <Text style={styles.emptyListText}>No videos found.</Text>
        )}
        contentContainerStyle={styles.listContentContainer}
      />

      {selectedVideoForModal && (
        <VideoModal
          visible={isModalVisible}
          video={selectedVideoForModal as any} // Pass VideoModel, VideoModal handles VideoType internally
          isLoading={false} // Assuming video data is part of selectedVideoForModal
          onClose={() => setIsModalVisible(false)}
          onVideoLoad={() => console.log('Video modal: Video loaded')}
          onVideoError={(error) => console.error('Video modal: Video error', error)}
          onPlaybackStatusUpdate={(status) => console.log('Video modal: Playback status', status)}
          videoList={displayedVideos as any[]} // Pass the list of currently displayed videos
          currentVideoIndex={currentVideoIndexInModal}
          onNextVideo={handleNextVideoInModal}
          onPreviousVideo={handlePreviousVideoInModal}
          // profileImageUrl and userId are derived by VideoModal from video.uploader
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchInput: {
    height: 45,
    borderColor: '#000',
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
  },
  videoCard: { // Placeholder style
    backgroundColor: '#ffffff',
    padding: 15,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  videoThumbnailText: {
    fontSize: 12,
    color: 'gray',
    marginTop: 5,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666666',
  }
});

export default WatchVideosScreen;
