// app/(tabs)/index.tsx - Updated with video navigation
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  EmptyState,
  HeaderSection,
  HeroSection,
  LoadingState
} from '@/components/HomeComponents';
import { VideoCard } from '@/components/video/VideoCard';
import apiService, { type ApiResponse, type Video } from '@/services/apiService';
import { t } from '@/utils/i18n';
import { homeStyles } from '../../styles/HomeStyles';

import AuthManager from '../../utils/authManager';
import VideoCardSkeleton from '../../components/videoCardSkeleton';

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



export default function HomeTabScreen() {
  const router = useRouter();

  

  // State Management
  const [videoList, setVideoList] = useState<Video[]>([]);
  const [pastVideoList, setPastVideoList] = useState<Video[]>([]);
  const [combinedVideoList, setCombinedVideoList] = useState<Video[]>([]); // New: combined list for navigation
  const [videosDisplayed, setVideosDisplayed] = useState(6);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [isLoadingPastVideos, setIsLoadingPastVideos] = useState(true);
  const [totalVideos, setTotalVideos] = useState(0);

  const VIDEO_LOAD_COUNT = 6;

  // Update combined video list when individual lists change
  useEffect(() => {
    const combined = [...videoList, ...pastVideoList];
    setCombinedVideoList(combined);
  }, [videoList, pastVideoList]);

  // Effects
  useEffect(() => {
    fetchVideos();
    fetchPastVideos();
  }, []);

  const filterOutBlockedContent = async (videos: Video[]): Promise<Video[]> => {
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

  // API Functions
  const fetchVideos = useCallback(async () => {
    try {
      setIsLoadingVideos(true);
      console.log('Fetching videos...');

      const response: ApiResponse<Video[]> = await apiService.getAllPublicVideos();
      console.log('All videos raw response:', response);

      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          const validVideos = response.data.filter(video =>
            video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
          );
          const nonBlockedVideos = await filterOutBlockedContent(validVideos);
          console.log('All videos non-blocked:', nonBlockedVideos);

          setVideoList(nonBlockedVideos);
          setTotalVideos(nonBlockedVideos.length);
          setVideosDisplayed(VIDEO_LOAD_COUNT);
        }
        else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data;
          if (Array.isArray(nestedData)) {
            const validVideos = nestedData.filter(video =>
              video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
            );
            const nonBlockedVideos = await filterOutBlockedContent(validVideos);
            console.log('All videos non-blocked (nested):', nonBlockedVideos);

            setVideoList(nonBlockedVideos);
            setTotalVideos(nonBlockedVideos.length);
            setVideosDisplayed(VIDEO_LOAD_COUNT);
          }
        }
      } else {
        console.error('Failed to fetch videos:', response.error);
        setVideoList([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setVideoList([]);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      }
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  const fetchPastVideos = useCallback(async () => {
    try {
      setIsLoadingPastVideos(true);
      console.log('Fetching past videos...');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const formattedDate = sevenDaysAgo.toISOString().split('T')[0];

      const response = await apiService.getPastVideos(formattedDate, {
        size: VIDEO_LOAD_COUNT,
        sortBy: 'createdTimestamp',
        sortOrder: 'DESC'
      });

      console.log('Past videos raw response:', response);

      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          const validPastVideos = response.data.filter(video =>
            video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
          );
          const nonBlockedVideos = await filterOutBlockedContent(validPastVideos);
          console.log('Past videos non-blocked:', nonBlockedVideos);
          setPastVideoList(nonBlockedVideos);
        }
        else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data;
          if (Array.isArray(nestedData)) {
            const validPastVideos = nestedData.filter(video =>
              video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
            );
            const nonBlockedVideos = await filterOutBlockedContent(validPastVideos);
            console.log('Past videos non-blocked (nested):', nonBlockedVideos);
            setPastVideoList(nonBlockedVideos);
          }
        }
      } else {
        console.error('Failed to fetch past videos:', response.error);
        setPastVideoList([]);
      }
    } catch (error) {
      console.error('Error fetching past videos:', error);
      setPastVideoList([]);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      }
    } finally {
      setIsLoadingPastVideos(false);
    }
  }, []);

  const playVideo = (video: Video, index: number) => {
    router.push({
      pathname: '/videoPlayer',
      params: {
        videos: JSON.stringify(combinedVideoList),
        startIndex: index,
      },
    });
  };

  // Navigation Functions
  const navigateToSearchProfiles = () => {
    // if (AuthManager.isAuthenticated()) {
    //   router.push('/search');
    // } else {
    //   router.push('/(tabs)/AuthLanding');
    // }
    router.push('/search')
  };

  const navigateToPostVideo = () => {
    if (AuthManager.isAuthenticated()) {
      router.push('/(tabs)/post');
    } else {
      router.push('/(tabs)/AuthLanding');
    }
  };

  const handleLoadMore = () => {
    setVideosDisplayed(prev => Math.min(prev + VIDEO_LOAD_COUNT, totalVideos));
  };

  // Refresh handler
  const handleRefresh = useCallback(() => {
    fetchVideos();
    fetchPastVideos();
  }, [fetchVideos, fetchPastVideos]);

  // Main Render
  return (
    <SafeAreaView style={homeStyles.container} edges={['top']}>
      <ScrollView
        style={homeStyles.scrollView}
        contentContainerStyle={[homeStyles.scrollViewContent]}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingVideos || isLoadingPastVideos}
            onRefresh={handleRefresh}
            colors={['#3260ad']}
            tintColor="#3260ad"
          />
        }
      >
        {/* Header */}
        <HeaderSection
          onSearchProfiles={navigateToSearchProfiles}
          onPostVideo={navigateToPostVideo}
        />

        <HeroSection />

        {/* Browse All Videos Button */}
        {/* <View style={homeStyles.browseButtonContainer}>
          <TouchableOpacity
            style={homeStyles.browseButton}
            onPress={() => router.push('/watchVideos')}
          >
            <Text style={homeStyles.browseButtonText}>Browse All Videos</Text>
          </TouchableOpacity>
        </View> */}

        {/* Video Section */}
        <View style={homeStyles.videoSection}>
          <Text style={homeStyles.sectionTitle}>
            {t('home.videosTitle')}
          </Text>

          {/* Current Videos */}
          {isLoadingVideos ? (
            <View style={homeStyles.videoGrid}>
              {[...Array(3)].map((_, index) => (
                <VideoCardSkeleton key={index} />
              ))}
            </View>
          ) : videoList.length === 0 ? (
            <EmptyState
              text={t('home.noVideos')}
              onRetry={fetchVideos}
            />
          ) : (
            <View style={homeStyles.videoGrid}>
              {videoList.slice(0, videosDisplayed).map((video, index) => (
                <VideoCard
                  key={video.id || index}
                  video={video}
                  onPress={() => playVideo(video, index)}
                />
              ))}
            </View>
          )}

          {/* Load More Button */}
          {videosDisplayed < totalVideos && !isLoadingVideos && (
            <View style={{ marginVertical: 16, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => router.push('/watchVideos')} style={homeStyles.loadMoreButton}>
                <Text style={homeStyles.loadMoreButtonText}>{t('home.watchAllVideos')}</Text>
              </TouchableOpacity>
       
            </View>
          )}

          {/* Past Videos Section */}
          {/* <Text style={homeStyles.sectionTitle}>Past Videos</Text>
          {isLoadingPastVideos ? (
            <LoadingState text="Loading past videos..." />
          ) : pastVideoList.length === 0 ? (
            <EmptyState text="No past videos available." />
          ) : (
            <View style={homeStyles.videoGrid}>
              {pastVideoList.map((video, index) => (
                <VideoCard
                  key={video.id || `past-${index}`}
                  video={video}
                  onPress={() => playVideo(video, index)}
                />
              ))}
            </View>
          )} */}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      {/* <FloatingActionButton onPress={navigateToPostVideo} /> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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