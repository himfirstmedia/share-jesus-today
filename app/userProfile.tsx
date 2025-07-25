// app/userProfile.tsx - Read-only Profile Screen for other users
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { t } from '../utils/i18n';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoModal } from '../components/video/VideoModal';
import { profileService } from '../services/profileService';

const { width } = Dimensions.get('window');

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  gender?: string;
  dob?: string;
  country?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  church?: string;
  biography?: string;
  profilePicture?: string;
  coverPhoto?: string;
}

interface UserVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  createdTimestamp: string;
  duration: any;
  description?: React.ReactNode;
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false); // New state for bio expansion

  // Video Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UserVideo | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const loadProfileData = useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID is missing.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const userData = await profileService.getProfileById(userId);
      if (userData) {
        setProfile(userData);
      } else {
        Alert.alert('Error', 'Could not load profile data.');
      }
    } catch (error) {
      console.error(`Error loading profile for user ${userId}:`, error);
      Alert.alert('Error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadUserVideosData = useCallback(async () => {
    if (!userId) {
      setVideosLoading(false);
      return;
    }
    try {
      setVideosLoading(true);
      const userVideos = await profileService.getProfileVideos(userId);
      if (userVideos) {
        setVideos(userVideos.map(v => ({ ...v, duration: v.duration ?? 0 })));
      }
    } catch (error) {
      console.error(`Error loading videos for user ${userId}:`, error);
      Alert.alert('Error', 'Failed to load user videos.');
    } finally {
      setVideosLoading(false);
    }
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfileData(), loadUserVideosData()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfileData, loadUserVideosData]);

  useEffect(() => {
    if (userId) {
      loadProfileData();
      loadUserVideosData();
    }
  }, [userId, loadProfileData, loadUserVideosData]);
  
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        console.log(`User Profile screen (userId: ${userId}) focused, reloading data.`);
        loadProfileData();
        loadUserVideosData();
      }
      return () => {
        console.log(`User Profile screen (userId: ${userId}) unfocused.`);
      };
    }, [userId, loadProfileData, loadUserVideosData])
  );

  const formatDate = (dateString?: string): string => {
    if (!dateString) return t('userProfileScreen.notSet');
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return t('userProfileScreen.invalidDate');
    }
  };

  const handleShareProfile = async () => {
    if (!profile?.id) return;
    try {
      await Share.share({
        message: `Check out ${profile.firstName} ${profile.lastName}'s profile on Share Jesus Today: ${profileService.getProfileShareUrl(profile.id)}`,
        title: `Share ${profile.firstName}'s Profile`,
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const openVideoModal = (video: UserVideo, index: number) => {
    setSelectedVideo(video);
    setCurrentVideoIndex(index);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedVideo(null);
  };

  const handleNextVideo = () => {
    if (videos && currentVideoIndex < videos.length - 1) {
      const nextIndex = currentVideoIndex + 1;
      setSelectedVideo(videos[nextIndex]);
      setCurrentVideoIndex(nextIndex);
    }
  };

  const handlePreviousVideo = () => {
    if (videos && currentVideoIndex > 0) {
      const prevIndex = currentVideoIndex - 1;
      setSelectedVideo(videos[prevIndex]);
      setCurrentVideoIndex(prevIndex);
    }
  };

  // Helper functions for bio truncation (same as profile.tsx)
  const shouldTruncateBio = (text: string) => {
    return text && text.length > 120; // Approximate 3 lines worth of characters
  };

  const getTruncatedBio = (text: string) => {
    if (!text) return '';
    if (text.length <= 120) return text;
    return text.substring(0, 120) + '...';
  };

  const renderVideoItem = ({ item, index }: { item: UserVideo; index: number }) => (
    <View style={styles.videoItem}>
      <TouchableOpacity
        style={styles.videoThumbnail}
        onPress={() => openVideoModal(item, index)}
      >
        <Image
          source={{
            uri: item.thumbnailUrl || 'https://via.placeholder.com/150x100?text=No+Thumbnail',
          }}
          style={styles.thumbnailImage}
          contentFit="cover"
        />
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play-circle" size={40} color="rgba(255, 255, 255, 0.9)" />
        </View>
      </TouchableOpacity>
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title || t('userProfileScreen.untitledVideo')}
        </Text>
        <Text style={styles.videoDate}>
          {formatDate(item.createdTimestamp)}
        </Text>
      </View>
    </View>
  );

  // Helper function to check if a value is set and not empty
  const isValueSet = (value?: string): boolean => {
    return value !== undefined && value !== null && value.trim() !== '';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/search')}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('userProfileScreen.loadingProfile')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3260AD" />
          <Text style={styles.loadingText}>{t('userProfileScreen.loadingProfile')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/search')}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('userProfileScreen.profileNotFound')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('userProfileScreen.couldNotLoadProfile')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfileData}>
            <Text style={styles.retryButtonText}>{t('userProfileScreen.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Check if we have any profile information to display
  const hasProfileInfo = isValueSet(profile.gender) || 
                         isValueSet(profile.country) || 
                         isValueSet(profile.state) || 
                         isValueSet(profile.city) || 
                         isValueSet(profile.zipcode) || 
                         isValueSet(profile.church);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/search')}>
          <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          {profile.firstName ? `${profile.firstName} ${profile.lastName}` : t('userProfileScreen.userProfile')}
        </Text>
        <TouchableOpacity onPress={handleShareProfile}>
          <Ionicons name="share-outline" size={24} color="#1e1b1b" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.coverContainer}>
          <Image
            source={{
              uri: profile.coverPhoto || '../assets/images/profile.png',
            }}
            style={styles.coverImage}
          />
        </View>

        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{
                uri: profile.profilePicture || '../assets/images/profile.png',
              }}
              style={styles.profileImage}
            />
          </View>

          <Text style={styles.profileName}>
            {profile.firstName} {profile.lastName}
          </Text>

          {/* Biography Section - Now under username */}
          {profile.biography && (
            <View style={styles.biographyContainer}>
              <Text style={styles.biographyText}>
                {isBioExpanded || !shouldTruncateBio(profile.biography) 
                  ? profile.biography 
                  : getTruncatedBio(profile.biography)
                }
              </Text>
              {shouldTruncateBio(profile.biography) && (
                <TouchableOpacity 
                  onPress={() => setIsBioExpanded(!isBioExpanded)}
                  style={styles.readMoreButton}
                >
                  <Text style={styles.readMoreText}>
                    {isBioExpanded ? t('userProfileScreen.readLess') : t('userProfileScreen.readMore')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Only show the details section if there's at least one piece of profile information */}
        {hasProfileInfo && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t('userProfileScreen.profileInformation')}</Text>
            
            {isValueSet(profile.gender) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.gender')}:</Text>
                <Text style={styles.detailValue}>{profile.gender}</Text>
              </View>
            )}
            
            {isValueSet(profile.country) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.country')}:</Text>
                <Text style={styles.detailValue}>{profile.country}</Text>
              </View>
            )}
            
            {isValueSet(profile.state) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.state')}:</Text>
                <Text style={styles.detailValue}>{profile.state}</Text>
              </View>
            )}
            
            {isValueSet(profile.city) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.city')}:</Text>
                <Text style={styles.detailValue}>{profile.city}</Text>
              </View>
            )}
            
            {isValueSet(profile.zipcode) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.zipcode')}:</Text>
                <Text style={styles.detailValue}>{profile.zipcode}</Text>
              </View>
            )}
            
            {isValueSet(profile.church) && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>{t('userProfileScreen.church')}:</Text>
                <Text style={styles.detailValue}>{profile.church}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.videosSection}>
          <Text style={styles.sectionTitle}>
            {profile.firstName ? `${profile.firstName}'s Videos` : t('userProfileScreen.usersVideos')}
          </Text>
          {videosLoading ? (
            <ActivityIndicator size="large" color="#3260AD" style={styles.videosLoading} />
          ) : videos.length > 0 ? (
            <FlatList
              data={videos}
              renderItem={renderVideoItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.videoRow}
            />
          ) : (
            <View style={styles.noVideosContainer}>
              <Text style={styles.noVideosText}>{t('userProfileScreen.noVideosAvailable')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {selectedVideo && (
        <VideoModal
          visible={isModalVisible}
          video={
            selectedVideo
              ? {
                ...selectedVideo,
                duration: selectedVideo.duration ?? 0,
                description: selectedVideo.description ?? "",
              }
              : null
          }
          isLoading={false}
          onClose={handleCloseModal}
          onVideoLoad={() => console.log('Video loaded in modal')}
          onVideoError={(err) => console.error('Video modal error:', err)}
          onPlaybackStatusUpdate={(status) => console.log('Playback status:', status)}
          videoList={videos.map(v => ({
            ...v,
            description: v.description ?? "",
            duration: v.duration ?? 0,
          }))}
          currentVideoIndex={currentVideoIndex}
          onNextVideo={handleNextVideo}
          onPreviousVideo={handlePreviousVideo}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    flexShrink: 1,
    marginHorizontal: 10,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3260AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  coverContainer: {
    position: 'relative',
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  profileImageContainer: {
    position: 'relative',
    marginTop: -60,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#f0f0f0',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginTop: 16,
    textAlign: 'center',
  },
  // New biography styles
  biographyContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  biographyText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  readMoreButton: {
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 16,
    color: '#3260AD',
    fontWeight: '600',
  },
  emailContainer: {
    marginTop: 8,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1b1b',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  videosSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  videosLoading: {
    marginTop: 20,
  },
  noVideosContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noVideosText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  videoRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  videoItem: {
    flexDirection: 'column',
    width: (width - 60) / 2,
  },
  videoThumbnail: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  videoInfo: {},
  videoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e1b1b',
    marginBottom: 2,
  },
  videoDate: {
    fontSize: 13,
    color: '#666',
  },
});