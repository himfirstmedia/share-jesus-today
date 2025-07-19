// app/(tabs)/index.tsx - Updated with video navigation
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
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
import { VideoModal } from '@/components/video/VideoModal';
import apiService, { type ApiResponse, type Video } from '@/services/apiService';
import { t } from '@/utils/i18';
import { homeStyles } from '../../styles/HomeStyles';

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

  // Video playback states
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0); // New: track current video index
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoStatus, setVideoStatus] = useState({});
  const [isVideoLoading, setIsVideoLoading] = useState(false);

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

  // API Functions
  const fetchVideos = useCallback(async () => {
    try {
      setIsLoadingVideos(true);
      console.log('Fetching videos...');

      const response: ApiResponse<Video[]> = await apiService.getAllPublicVideos();
      console.log('All videos response:', response);

      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          const validVideos = response.data.filter(video =>
            video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
          );

          setVideoList(validVideos);
          setTotalVideos(validVideos.length);
          setVideosDisplayed(VIDEO_LOAD_COUNT);
        }
        else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data;
          if (Array.isArray(nestedData)) {
            const validVideos = nestedData.filter(video =>
              video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
            );

            setVideoList(validVideos);
            setTotalVideos(validVideos.length);
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

      console.log('Past videos response:', response);

      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          const validPastVideos = response.data.filter(video =>
            video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
          );
          setPastVideoList(validPastVideos);
        }
        else if (response.data && typeof response.data === 'object' && 'data' in response.data) {
          const nestedData = (response.data as any).data;
          if (Array.isArray(nestedData)) {
            const validPastVideos = nestedData.filter(video =>
              video.url && (video.url.startsWith('http') || video.url.startsWith('https'))
            );
            setPastVideoList(validPastVideos);
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

  // Video Functions
  const playVideo = useCallback((video: Video) => {
    console.log('Opening video:', video);

    if (!video.url) {
      Alert.alert('Error', 'Video URL is not available');
      return;
    }

    // Validate video URL
    try {
      const url = new URL(video.url);
      const isValidProtocol = url.protocol === 'http:' || url.protocol === 'https:';

      if (!isValidProtocol) {
        throw new Error('Invalid protocol');
      }

      // Find the index of this video in the combined list
      const videoIndex = combinedVideoList.findIndex(v => v.id === video.id);

      setSelectedVideo(video);
      setCurrentVideoIndex(videoIndex !== -1 ? videoIndex : 0);
      setShowVideoModal(true);
      setIsVideoLoading(true);
    } catch (error) {
      Alert.alert(
        'Open Video',
        'This video link may not be supported in the app. Would you like to open it in your browser?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open in Browser',
            onPress: () => {
              Linking.openURL(video.url).catch(() =>
                Alert.alert('Error', 'Could not open video')
              );
            }
          }
        ]
      );
    }
  }, [combinedVideoList]);

  // Navigation Functions
  const goToNextVideo = useCallback(() => {
    if (currentVideoIndex < combinedVideoList.length - 1) {
      const nextIndex = currentVideoIndex + 1;
      const nextVideo = combinedVideoList[nextIndex];

      setCurrentVideoIndex(nextIndex);
      setSelectedVideo(nextVideo);
      setIsVideoLoading(true);
    }
  }, [currentVideoIndex, combinedVideoList]);

  const goToPreviousVideo = useCallback(() => {
    if (currentVideoIndex > 0) {
      const prevIndex = currentVideoIndex - 1;
      const prevVideo = combinedVideoList[prevIndex];

      setCurrentVideoIndex(prevIndex);
      setSelectedVideo(prevVideo);
      setIsVideoLoading(true);
    }
  }, [currentVideoIndex, combinedVideoList]);

  const closeVideoModal = useCallback(() => {
    setShowVideoModal(false);
    setSelectedVideo(null);
    setCurrentVideoIndex(0);
    setIsVideoLoading(false);
    setVideoStatus({});
  }, []);

  const handleVideoLoad = useCallback(() => {
    setIsVideoLoading(false);
  }, []);

  const handleVideoError = useCallback((error: any) => {
    console.error('Video playback error:', error);
    setIsVideoLoading(false);

    Alert.alert(
      'Video Error',
      'Unable to play this video. Would you like to try opening it in your browser?',
      [
        { text: 'Close', onPress: closeVideoModal },
        {
          text: 'Open in Browser',
          onPress: () => {
            closeVideoModal();
            if (selectedVideo?.url) {
              Linking.openURL(selectedVideo.url);
            }
          }
        }
      ]
    );
  }, [selectedVideo?.url, closeVideoModal]);

  // Navigation Functions
  const navigateToSearchProfiles = () => {
    router.push('/search');
  };

  const navigateToPostVideo = () => {
    router.push('/post');
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
            See Videos of People who Shared &quot;Jesus Loves You&quot; With Others
          </Text>

          {/* Current Videos */}
          {isLoadingVideos ? (
            <LoadingState text="Loading videos..." />
          ) : videoList.length === 0 ? (
            <EmptyState
              text="No videos available at the moment."
              onRetry={fetchVideos}
            />
          ) : (
            <View style={homeStyles.videoGrid}>
              {videoList.slice(0, videosDisplayed).map((video, index) => (
                <VideoCard
                  key={video.id || index}
                  video={video}
                  onPress={playVideo}
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
                  onPress={playVideo}
                />
              ))}
            </View>
          )} */}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      {/* <FloatingActionButton onPress={navigateToPostVideo} /> */}

      {/* Video Modal */}
      <VideoModal
        visible={showVideoModal}
        video={selectedVideo}
        isLoading={isVideoLoading}
        onClose={closeVideoModal}
        onVideoLoad={handleVideoLoad}
        onVideoError={handleVideoError}
        onPlaybackStatusUpdate={setVideoStatus}
        // New props for navigation
        videoList={combinedVideoList}
        currentVideoIndex={currentVideoIndex}
        onNextVideo={goToNextVideo}
        onPreviousVideo={goToPreviousVideo}
      />
    </SafeAreaView>
  );
}
