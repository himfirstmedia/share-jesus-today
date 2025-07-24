// app/profile.tsx - Updated Profile Screen with Translation Placeholders
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoModal } from '../components/video/VideoModal';
import { profileService } from '../services/profileService';
import AuthManager from '../utils/authManager';
import { t } from '../utils/i18n';
import ProfilePicturePage from './ProfilePicturePage';

const { width } = Dimensions.get('window');

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
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
  churchFrom?: string;
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

export default function ProfileScreen() {
  // ALL STATE HOOKS MUST BE DECLARED FIRST - IN THE SAME ORDER EVERY RENDER
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false); // New state for bio expansion

  // Video Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<UserVideo | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  // ALL useCallback HOOKS - CONSISTENT DEPENDENCY ARRAYS
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const userData = await profileService.getUserProfile();
      if (userData) {
        setProfile(userData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('alerts.error'), t('alerts.failedLoadProfile'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserVideos = useCallback(async () => {
    try {
      setVideosLoading(true);

      console.log('🔍 Profile Screen: Loading user videos...');

      const authToken = await AsyncStorage.getItem('authToken');
      const jwtToken = await AsyncStorage.getItem('jwt');
      const userId = await AsyncStorage.getItem('id');
      const email = await AsyncStorage.getItem('email');

      console.log('🔍 Profile Debug:');
      console.log('  Auth Token:', authToken ? 'Present' : 'Missing');
      console.log('  JWT Token:', jwtToken ? 'Present' : 'Missing');
      console.log('  User ID:', userId || 'Missing');
      console.log('  Email:', email || 'Missing');

      if (!authToken && !jwtToken) {
        Alert.alert(
          t('alerts.authRequired'),
          t('alerts.loginToViewVideos'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('alerts.login'), onPress: () => router.replace('/login') }
          ]
        );
        return;
      }

      // Try method 1: Use ProfileService
      try {
        console.log('📹 Attempting to load videos via ProfileService...');
        const userVideos = await profileService.getUserVideos();

        if (userVideos && userVideos.length >= 0) {
          console.log(`✅ Successfully loaded ${userVideos.length} videos`);
          setVideos(userVideos.map(v => ({ ...v, duration: v.duration ?? 0 })));
          return;
        }
      } catch (profileServiceError) {
        console.warn('⚠️ ProfileService method failed:', profileServiceError);
      }

      // Method 2: Try alternative email-based approach
      if (email && !userId) {
        try {
          console.log('📧 Attempting email-based video loading...');
          const userVideos = await profileService.getUserVideosByEmail();

          if (userVideos && userVideos.length >= 0) {
            console.log(`✅ Email-based loading successful: ${userVideos.length} videos`);
            setVideos(userVideos.map(v => ({ ...v, duration: v.duration ?? 0 })));
            return;
          }
        } catch (emailError) {
          console.warn('⚠️ Email-based method failed:', emailError);
        }
      }

      // Method 3: Direct API call with stored user ID
      if (userId) {
        try {
          console.log('🎯 Attempting direct API call with stored user ID...');
          const directVideos = await profileService.getProfileVideos(userId);

          if (directVideos && directVideos.length >= 0) {
            console.log(`✅ Direct API call successful: ${directVideos.length} videos`);
            setVideos(directVideos.map(v => ({ ...v, duration: v.duration ?? 0 })));
            return;
          }
        } catch (directError) {
          console.warn('⚠️ Direct API call failed:', directError);
        }
      }

      console.error('❌ All video loading methods failed');

      if (!userId && !email) {
        Alert.alert(
          t('alerts.profileDataMissing'),
          t('alerts.profileIncomplete'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('alerts.logoutLogin'),
              onPress: async () => {
                await AsyncStorage.clear();
                await AuthManager.clearAuthToken();
                router.replace('/login');
              }
            }
          ]
        );
      } else {
        Alert.alert(
          t('alerts.unableToLoadVideos'),
          t('alerts.videoLoadProblem'),
          [
            { text: t('common.ok'), style: 'default' },
            { text: t('common.refresh'), onPress: () => loadUserVideos() }
          ]
        );
      }

      setVideos([]);

    } catch (error) {
      console.error('❌ Critical error in loadUserVideos:', error);
      Alert.alert(
        t('common.error'),
        t('alerts.unexpectedError'),
        [{ text: t('common.ok') }]
      );
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfile(), loadUserVideos()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile, loadUserVideos]);

  const debugAllStorage = useCallback(async () => {
    try {
      console.log('🗂️ === COMPLETE STORAGE DEBUG ===');
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('📋 All keys:', allKeys);

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        console.log(`  ${key}:`, value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'null');
      }
      console.log('🗂️ === END STORAGE DEBUG ===');
    } catch (error) {
      console.error('❌ Storage debug error:', error);
    }
  }, []);

  // SINGLE useEffect HOOK WITH CONSISTENT DEPENDENCY ARRAY
  useEffect(() => {
    const initializeProfile = async () => {
      if (__DEV__) {
        await debugAllStorage();
      }
      await loadProfile();
      await loadUserVideos();
    };

    initializeProfile();
  }, [debugAllStorage, loadProfile, loadUserVideos]);

  // Add useFocusEffect to reload data when the screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Profile screen focused, reloading data.');
      loadProfile(); 
      loadUserVideos();
      
      return () => {
        console.log('Profile screen unfocused.');
      };
    }, [loadProfile, loadUserVideos])
  );

  // EVENT HANDLERS
  const formatDate = (dateString: string): string => {
    if (!dateString) return t('common.notSet');
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return t('common.invalidDate');
    }
  };

  const handleShareProfile = async () => {
    if (!profile?.id) return;

    try {
      await Share.share({
        message: t('profile.shareMessage', { 
          profileUrl: `https://sharejesustoday.org/profile/?sh=${profile.id}` 
        }),
        title: t('profile.shareTitle')
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const handleDeleteVideo = (videoId: string) => {
    Alert.alert(
      t('video.confirmDelete'),
      t('video.deleteConfirmation'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await profileService.deleteVideo(videoId);
              loadUserVideos();
              Alert.alert(t('common.success'), t('video.deleteSuccess'));
            } catch (error) {
              Alert.alert(t('common.error'), t('video.deleteError'));
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    router.push('/editProfile');
  };

  const handleEditCover = () => {
    router.push('/EditCoverPhotoScreen');
  };

  const handleEditProfilePicture = () => {
    setShowProfilePicModal(true);
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

  // Helper function to check if bio text exceeds 3 lines
  const shouldTruncateBio = (text: string) => {
    return text && text.length > 120; // Approximate 3 lines worth of characters
  };

  const getTruncatedBio = (text: string) => {
    if (!text) return '';
    if (text.length <= 120) return text;
    return text.substring(0, 120) + '...';
  };

  // Helper function to check if any profile details exist
  const hasProfileDetails = () => {
    if (!profile) return false;
    return !!(
      profile.gender ||
      profile.country ||
      profile.state ||
      profile.city ||
      profile.zipcode ||
      profile.church
    );
  };

  // Helper function to render profile detail item only if value exists
  const renderDetailItem = (labelKey: string, value?: string) => {
    if (!value || value.trim() === '') return null;
    
    return (
      <View style={styles.detailItem}>
        <Text style={styles.detailLabel}>{t(labelKey)}:</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  const renderVideoItem = ({ item, index }: { item: UserVideo; index: number }) => (
    <View style={styles.videoItem}>
      <TouchableOpacity
        style={styles.videoThumbnail}
        onPress={() => openVideoModal(item, index)}
      >
        <Image
          source={{
            uri: item.thumbnailUrl || 'https://via.placeholder.com/150x100?text=No+Thumbnail'
          }}
          style={styles.thumbnailImage}
        />
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play-circle" size={40} color="rgba(255, 255, 255, 0.9)" />
        </View>
      </TouchableOpacity>

      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title || t('video.untitled')}
        </Text>
        <Text style={styles.videoDate}>
          {formatDate(item.createdTimestamp)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteVideo(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color="#D32F2F" />
      </TouchableOpacity>
    </View>
  );

  // LOADING STATE
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3260AD" />
          <Text style={styles.loadingText}>{t('profile.loadingProfile')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ERROR STATE
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('profile.failedToLoad')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // MAIN RENDER
  return (
    <SafeAreaView style={styles.container}>
       <StatusBar backgroundColor="#3260ad" barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity onPress={handleShareProfile}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Cover Photo */}
        <View style={styles.coverContainer}>
          <Image
            source={{
              uri: profile.coverPhoto || 'https://via.placeholder.com/400x200?text=No+Cover+Photo'
            }}
            style={styles.coverImage}
          />
          <TouchableOpacity style={styles.editCoverButton} onPress={handleEditCover}>
            <Ionicons name="camera-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Profile Picture and Basic Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{
                uri: profile.profilePicture || '../../assets/images/profile.png'
              }}
              style={styles.profileImage}
            />
            <TouchableOpacity
              style={styles.editProfileImageButton}
              onPress={handleEditProfilePicture}
            >
              <Ionicons name="camera-outline" size={16} color="#fff" />
            </TouchableOpacity>
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
                    {isBioExpanded ? t('profile.readLess') : t('profile.readMore')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {profile.churchFrom === 'yes' && (
            <View style={styles.emailContainer}>
              <Text style={styles.profileEmail}>{t('profile.email')}: {profile.email}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
            <Text style={styles.editProfileButtonText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Details - Only render if details exist */}
        {hasProfileDetails() && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>{t('profile.profileInformation')}</Text>

            {renderDetailItem('profile.gender', profile.gender)}
            {renderDetailItem('profile.country', profile.country)}
            {renderDetailItem('profile.state', profile.state)}
            {renderDetailItem('profile.city', profile.city)}
            {renderDetailItem('profile.zipcode', profile.zipcode)}
            {renderDetailItem('profile.church', profile.church)}
          </View>
        )}

        {/* Videos Section */}
        <View style={styles.videosSection}>
          <Text style={styles.sectionTitle}>{t('profile.myVideos')}</Text>
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
              <Text style={styles.noVideosText}>{t('profile.noVideos')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Video Modal */}
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

      {/* Profile Picture Modal */}
      <Modal visible={showProfilePicModal} animationType="slide">
        <ProfilePicturePage
          currentImageUri={profile?.profilePicture}
          onImageSaved={(newImageUri) => {
            setProfile(prev => prev ? { ...prev, profilePicture: newImageUri } : null);
            setShowProfilePicModal(false);
          }}
          onCancel={() => setShowProfilePicModal(false)}
        />
      </Modal>
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
    backgroundColor: '#3260AD', // Blue background
    borderBottomWidth: 1,
    borderBottomColor: '#2855A8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff', // White text
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
  editCoverButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
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
  editProfileImageButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#3260AD',
    borderRadius: 16,
    padding: 8,
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
    marginTop: 12,
  },
  profileEmail: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  editProfileButton: {
    backgroundColor: '#3260AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  editProfileButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 4,
    zIndex: 10,
  },
});