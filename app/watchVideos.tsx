import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler, // Added BackHandler
  FlatList,
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



const WatchVideosScreen = () => {
  const [allVideos, setAllVideos] = useState<VideoModel[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<VideoModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const PAGE_SIZE = 10;

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

  const preCacheVideos = (videos: VideoModel[]) => {
    videos.forEach(video => {
      if (video.url) {
        videoCacheService.startCachingVideo(video.url).catch(e => {
          console.error(`Failed to cache video ${video.url}:`, e);
        });
      }
    });
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
        preCacheVideos(nonBlockedVideos);
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

  const handleVideoPress = (item: VideoModel, index: number) => {
    router.push({
      pathname: '/videoPlayer',
      params: {
        videos: JSON.stringify(displayedVideos),
        startIndex: index,
      },
    });
  };

  const renderVideoItem = ({ item, index }: { item: VideoModel; index: number }) => (
    <VideoCard
      video={item as any}
      onPress={() => handleVideoPress(item, index)}
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
});

export default WatchVideosScreen;