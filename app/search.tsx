// app/search.tsx - Enhanced search screen matching Android functionality
import { t } from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../services/apiService';

interface ProfileSearch {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  city?: string;
  state?: string;
  church?: string;
  profilePicture?: string;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileSearch[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Debounce search functionality
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all profiles from API - wrapped in useCallback
  const fetchAllProfiles = useCallback(async () => {
    setIsLoading(true);
    setNoResults(false);
    
    try {
      // Initialize auth token
      await apiService.initializeAuthToken();
      
      // Use the same API endpoint as Android
      const url = 'https://himfirstapis.com/api/v1/person/public/all?page=0&size=100&sortBy=createdTimestamp&sortOrder=DESC';
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && data.data && Array.isArray(data.data)) {
        const profiles: ProfileSearch[] = data.data.map((profile: any) => ({
          id: profile.id,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          city: profile.city || '',
          state: profile.state || '',
          church: profile.church || '',
          profilePicture: profile.profilePicture || '',
        }));

        // Sort alphabetically by name (like Android version)
        profiles.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setAllProfiles(profiles);
        setSearchResults(profiles);
        setNoResults(profiles.length === 0);
      } else {
        setAllProfiles([]);
        setSearchResults([]);
        setNoResults(true);
      }
    } catch (error) {
      console.error('Error fetching all profiles:', error);
      Alert.alert(t('searchScreen.alertError'), t('searchScreen.alertFailedLoadProfiles'));
      setAllProfiles([]);
      setSearchResults([]);
      setNoResults(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search profiles using API - wrapped in useCallback
  const searchProfiles = useCallback(async (query: string) => {
    if (!query.trim()) {
      // If search is empty, show all profiles
      setSearchResults(allProfiles);
      setNoResults(allProfiles.length === 0);
      return;
    }

    setIsLoading(true);
    setNoResults(false);

    try {
      // Initialize auth token
      await apiService.initializeAuthToken();
      
      // Encode query like Android version
      const encodedQuery = encodeURIComponent(query);
      const url = `https://himfirstapis.com/api/v1/person/public/search?query=${encodedQuery}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        const profiles: ProfileSearch[] = data.map((profile: any) => ({
          id: profile.id,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          email: profile.email || '',
          city: profile.city || '',
          state: profile.state || '',
          church: profile.church || '',
          profilePicture: profile.profilePicture || '',
        }));

        setSearchResults(profiles);
        setNoResults(profiles.length === 0);
      } else {
        setSearchResults([]);
        setNoResults(true);
      }
    } catch (error) {
      console.error('Error searching profiles:', error);
      Alert.alert(t('searchScreen.alertError'), t('searchScreen.alertSearchFailed'));
      setSearchResults([]);
      setNoResults(true);
    } finally {
      setIsLoading(false);
    }
  }, [allProfiles]);

  // Handle search input change with debounce (like Android's 500ms delay)
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout with 500ms delay (matching Android)
    searchTimeoutRef.current = setTimeout(() => {
      if (text.trim()) {
        searchProfiles(text);
      } else {
        // If search is empty, show all profiles
        setSearchResults(allProfiles);
        setNoResults(allProfiles.length === 0);
      }
    }, 500);
  }, [allProfiles, searchProfiles]);

  // Fetch all profiles when component mounts (like Android version)
  useEffect(() => {
    fetchAllProfiles();
  }, [fetchAllProfiles]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle profile item press - updated to navigate to userProfile
  const handleProfilePress = (profile: ProfileSearch) => {
    console.log('Profile card pressed, navigating to user profile:', profile.id);
    router.push({ pathname: '/userProfile', params: { userId: profile.id } });
  };

  // Handle "View Profile" button press
  const handleViewProfilePress = (profile: ProfileSearch) => {
    console.log('View Profile pressed for:', profile.id);
    router.push({ pathname: '/userProfile', params: { userId: profile.id } });
  };

  // Render profile item
  const renderProfile = ({ item }: { item: ProfileSearch }) => (
    <TouchableOpacity
      style={styles.profileCard}
      onPress={() => handleProfilePress(item)} // Keep card press for navigation as well or change if needed
      activeOpacity={0.7}
    >
      <View style={styles.profileHeader}>
        {/* Profile Picture */}
        <View style={styles.avatarContainer}>
          {item.profilePicture ? (
            <Image
              source={{ uri: item.profilePicture }}
              style={styles.avatar}
              defaultSource={require('../assets/images/default-avatar.png')}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#999" />
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {item.firstName} {item.lastName}
          </Text>
          
          {/* Show city from fetchAllProfiles, email from search */}
          {item.city && (
            <Text style={styles.profileDetail}>
              <Ionicons name="location-outline" size={12} color="#666" /> {item.city}
            </Text>
          )}
          
          {/* {item.email && (
            <Text style={styles.profileDetail}>
              <Ionicons name="mail-outline" size={12} color="#666" /> {item.email}
            </Text>
          )} */}
          
          {item.church && (
            <Text style={styles.profileDetail}>
              <Ionicons name="business-outline" size={12} color="#666" /> {item.church}
            </Text>
          )}
        </View>
      </View>

      {/* View Profile Button */}
      {/* <TouchableOpacity
        style={styles.connectButton} // Keep existing style, or rename to viewProfileButton if styles differ
        onPress={(e) => {
          e.stopPropagation(); // Prevent card's onPress from firing
          handleViewProfilePress(item);
        }}
      >
        <Text style={styles.connectButtonText}>View Profile</Text>
      </TouchableOpacity> */}
    </TouchableOpacity>
  );

  // Handle back press (like Android)
  const handleBack = () => {
    router.canGoBack() ? router.back() : router.replace('/(tabs)');
  };

  // Pull to refresh functionality
  const handleRefresh = () => {
    setSearchQuery('');
    fetchAllProfiles();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3260ad" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('searchScreen.headerTitle')}</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder={t('searchScreen.searchPlaceholder')}
            placeholderTextColor="#666"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => handleSearchChange('')}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results Container */}
      <View style={styles.resultsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3260ad" />
            <Text style={styles.loadingText}>{t('searchScreen.loadingProfiles')}</Text>
          </View>
        ) : noResults ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? t('searchScreen.noProfilesFound') : t('searchScreen.noProfilesAvailable')}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery 
                ? t('searchScreen.tryDifferentKeywords')
                : t('searchScreen.checkBackLater')
              }
            </Text>
            {searchQuery && (
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={() => handleSearchChange('')}
              >
                <Text style={styles.clearSearchText}>{t('searchScreen.showAllProfiles')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderProfile}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefresh}
            refreshing={isLoading}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2c5599',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2c5599',
    backgroundColor: '#3260ad',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 5,
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
    marginLeft: 5,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  separator: {
    height: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearSearchButton: {
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearSearchText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});