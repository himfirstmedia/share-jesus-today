// services/profileService.ts - Profile API Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode } from 'react'; // Added import for ReactNode
import AuthManagerInstance from '../utils/authManager'; // Renamed import for clarity

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

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
  // Additional fields from Android
  createdby?: string;
  updatedby?: string;
  createdtimestamp?: string;
  otp?: string;
  phone?: string;
  address?: string;
  signupchurch?: string;
}

interface UserVideo {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  createdTimestamp: string;
  duration?: any; // Added optional duration
  description?: ReactNode; // Changed to ReactNode
  uploader: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface VideoResponse {
  data: UserVideo[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

class ProfileService {
  private baseURL = 'https://himfirstapis.com/api/v1';

  // Get authentication token from AuthManager
  private getAuthToken(): string | null {
    return AuthManagerInstance.getAuthToken();
  }

  // Helper method for making API requests
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      await AuthManagerInstance.ensureInitialized(); // Ensure AuthManager is initialized

      const url = `${this.baseURL}${endpoint}`;
      
      const defaultHeaders: HeadersInit = {};

      // Only add Content-Type if the body exists and it's not FormData
      // For FormData, 'Content-Type' is set automatically by fetch with the correct boundary.
      if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
      }

      // Add authorization header if token exists
      const token = this.getAuthToken();
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }

      const config: RequestInit = {
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        ...options,
      };

      console.log('ProfileService: Making request to:', url);
      const response = await fetch(url, config);
      
      console.log('ProfileService: Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          console.log('ProfileService: Error response data:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      // Try to parse as JSON, if it fails, try to read as text
      let responseData;
      try {
        // Clone the response before attempting to read its body, as it can only be consumed once.
        const clonedResponse = response.clone();
        responseData = await clonedResponse.json();
        console.log('ProfileService: Success response data (JSON):', responseData);
      } catch (jsonError) {
        console.log('ProfileService: Failed to parse response as JSON, trying as text.', jsonError);
        try {
          responseData = await response.text(); // Use the original response here
          console.log('ProfileService: Success response data (Text):', responseData);
        } catch (textError) {
          console.error('ProfileService: Failed to read response as text.', textError);
          return {
            success: false,
            error: 'Failed to parse server response',
          };
        }
      }
      
      return {
        success: true,
        data: responseData,
      };
    } catch (error) {
      console.error('ProfileService: Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Get user profile data by email (from stored data or API)
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      // First, try to get profile data from AsyncStorage
      const storedProfile = await this.getStoredProfile();
      if (storedProfile) {
        // Also fetch fresh data from API to ensure it's up to date
        const freshProfile = await this.fetchProfileFromAPI(storedProfile.email);
        return freshProfile || storedProfile;
      }
      
      return null;
    } catch (error) {
      console.error('ProfileService: Error getting user profile:', error);
      return null;
    }
  }

  // Get stored profile from AsyncStorage (similar to Android SharedPreferences)
  private async getStoredProfile(): Promise<UserProfile | null> {
    try {
      const userData: Partial<UserProfile> = {};
      
      // Get all the stored user data keys (matching Android implementation)
      const keys = [
        'id', 'firstName', 'lastName', 'email', 'gender', 'dob',
        'country', 'state', 'city', 'zipcode', 'church', 'biography',
        'profilepic', 'coverimg', 'publicemail', 'createdby', 'updatedby',
        'createdtimestamp', 'otp', 'phone', 'address', 'signupchurch'
      ];

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          // Map the keys to the correct profile properties
          switch (key) {
            case 'profilepic':
              userData.profilePicture = value;
              break;
            case 'coverimg':
              userData.coverPhoto = value;
              break;
            case 'publicemail':
              userData.churchFrom = value;
              break;
            case 'signupchurch':
              userData.church = value;
              break;
            case 'zipcode':
              userData.zipcode = value;
              break;
            default:
              (userData as any)[key] = value;
          }
        }
      }

      // Check if we have minimum required data
      if (userData.id && userData.email) {
        return userData as UserProfile;
      }

      return null;
    } catch (error) {
      console.error('ProfileService: Error getting stored profile:', error);
      return null;
    }
  }

  // Fetch fresh profile data from API
  private async fetchProfileFromAPI(email: string): Promise<UserProfile | null> {
    try {
      const response = await this.makeRequest<UserProfile>(
        `/person/sign-up/find-by-email/${encodeURIComponent(email)}`
      );

      if (response.success && response.data) {
        // Update stored profile data
        await this.updateStoredProfile(response.data);
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('ProfileService: Error fetching profile from API:', error);
      return null;
    }
  }

  // Update stored profile data
  private async updateStoredProfile(profile: UserProfile): Promise<void> {
    try {
      const updates: { [key: string]: string } = {
        id: profile.id,
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        email: profile.email || '',
        gender: profile.gender || '',
        dob: profile.dob || '',
        country: profile.country || '',
        state: profile.state || '',
        city: profile.city || '',
        zipcode: profile.zipcode || '',
        church: profile.church || '',
        biography: profile.biography || '',
        profilepic: profile.profilePicture || '',
        coverimg: profile.coverPhoto || '',
        publicemail: profile.churchFrom || '',
      };

      // Store all updates
      for (const [key, value] of Object.entries(updates)) {
        await AsyncStorage.setItem(key, value);
      }

      console.log('ProfileService: Profile data updated in storage');
    } catch (error) {
      console.error('ProfileService: Error updating stored profile:', error);
    }
  }

  // Get user's videos

  // Delete a video
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `/video/${videoId}`,
        {
          method: 'DELETE', // Android uses PUT for delete
        }
      );

      return response.success;
    } catch (error) {
      console.error('ProfileService: Error deleting video:', error);
      return false;
    }
  }

  // Update profile data
  async updateProfile(profileData: Partial<UserProfile>): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        '/person/sign-up',
        {
          method: 'PUT',
          body: JSON.stringify(profileData),
        }
      );

      if (response.success) {
        // Update local storage
        const currentProfile = await this.getStoredProfile();
        if (currentProfile) {
          await this.updateStoredProfile({ ...currentProfile, ...profileData });
        }
      }

      return response.success;
    } catch (error) {
      console.error('ProfileService: Error updating profile:', error);
      return false;
    }
  }

  // Upload profile picture
  async uploadProfilePicture(imageUri: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg', // or appropriate type based on image
        name: 'profile.jpg', // or a dynamic name
      } as any);

      const response = await this.makeRequest<{ url?: string; data?: { url?: string } }>(
        '/person/profile-picture', // Updated endpoint based on ApiServicePropic
        {
          method: 'POST',
          body: formData,
          // Content-Type is handled by makeRequest/fetch for FormData
        }
      );

      if (response.success && response.data) {
        let imageUrl: string | undefined | null = null;

        if (typeof response.data === 'string') {
          // If response.data is a plain string, use it directly as the URL
          imageUrl = response.data;
        } else if (typeof response.data === 'object' && response.data !== null) {
          // If it's an object, try to access url or data.url (as before)
          imageUrl = (response.data as any).url || (response.data as any).data?.url;
        }

        if (imageUrl) {
          await AsyncStorage.setItem('profilepic', imageUrl);
          return imageUrl;
        }
      }
      return null;
    } catch (error) {
      console.error('ProfileService: Error uploading profile picture:', error);
      return null;
    }
  }

  // Upload cover photo
  async uploadCoverPhoto(imageUri: string): Promise<string | null> {
    try {
      const formData = new FormData();
      const fileName = imageUri.split('/').pop() || 'cover.jpg'; // Extract filename or default
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg', // or appropriate type based on image
        name: fileName,
      } as any);
      // formData.append('name', fileName); // Removed this line - backend expects only 'file'

      const response = await this.makeRequest<{ url?: string; data?: { url?: string } }>(
        '/person/cover-photo',
        {
          method: 'POST',
          body: formData,
          // Content-Type is handled by makeRequest/fetch for FormData
        }
      );

      if (response.success && response.data) {
        let imageUrl: string | undefined | null = null;

        if (typeof response.data === 'string') {
          // If response.data is a plain string, use it directly as the URL
          imageUrl = response.data;
        } else if (typeof response.data === 'object' && response.data !== null) {
          // If it's an object, try to access url or data.url
          imageUrl = (response.data as any).url || (response.data as any).data?.url;
        }

        if (imageUrl) {
          await AsyncStorage.setItem('coverimg', imageUrl);
          return imageUrl;
        }
      }
      return null;
    } catch (error) {
      console.error('ProfileService: Error uploading cover photo:', error);
      return null;
    }
  }

  // Search profiles (for profile search functionality)
  async searchProfiles(query: string): Promise<UserProfile[]> {
    try {
      const response = await this.makeRequest<UserProfile[]>(
        `/person/search?query=${encodeURIComponent(query)}`
      );

      if (response.success && response.data) {
        return Array.isArray(response.data) ? response.data : [];
      }

      return [];
    } catch (error) {
      console.error('ProfileService: Error searching profiles:', error);
      return [];
    }
  }

  // Get profile by ID (for viewing other profiles)
  async getProfileById(profileId: string): Promise<UserProfile | null> {
    try {
      // Changed to /person/public/{profileId} to align with other public endpoints
      const response = await this.makeRequest<UserProfile>(
        `/person/public/${profileId}` 
      );

      if (response.success && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('ProfileService: Error getting profile by ID:', error);
      return null;
    }
  }

  // Get videos for a specific profile (for viewing other profiles)
  async getProfileVideos(profileId: string): Promise<UserVideo[]> {
    try {
      const response = await this.makeRequest<VideoResponse>(
        `/video/public/person/${profileId}?page=0&personId=${profileId}&size=100&sortBy=createdTimestamp&sortOrder=DESC`
      );

      if (response.success && response.data && response.data.data) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      console.error('ProfileService: Error getting profile videos:', error);
      return [];
    }
  }

  // Clear all profile data (for logout)
  async clearProfileData(): Promise<void> {
    try {
      const keys = [
        'id', 'firstName', 'lastName', 'email', 'gender', 'dob',
        'country', 'state', 'city', 'zipcode', 'church', 'biography',
        'profilepic', 'coverimg', 'publicemail', 'createdby', 'updatedby',
        'createdtimestamp', 'otp', 'phone', 'address', 'signupchurch'
      ];

      await AsyncStorage.multiRemove(keys);
      console.log('ProfileService: Profile data cleared');
    } catch (error) {
      console.error('ProfileService: Error clearing profile data:', error);
    }
  }

  // Format date helper (matching Android implementation)
  formatDate(dateString: string): string {
    if (!dateString) return 'Not Set';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  }

  // Generate profile share URL (matching Android implementation)
  getProfileShareUrl(profileId: string): string {
    return `https://sharejesustoday.org/profile/?sh=${profileId}`;
  }
  // Enhanced getUserVideos method with comprehensive error handling and debugging

async getUserVideos(): Promise<UserVideo[]> {
  try {
    console.log('ProfileService: Getting user videos...');
    await AuthManagerInstance.ensureInitialized(); // Ensure AuthManager is initialized
    
    // First, check if we have an auth token
    const token = this.getAuthToken();
    if (!token) {
      console.error('ProfileService: No auth token found after ensuring AuthManager initialization.');
      // It's possible initialization finished but no token was found in storage.
      // Or, if ensureInitialized had to run initialize() itself, this check is still valid.
      throw new Error('Authentication required - please login again or check session.');
    }
    console.log('✅ Auth token found');

    // Try to get profile from storage first
    const profile = await this.getStoredProfile();
    console.log('ProfileService: Stored profile check:', profile ? 'Found' : 'Not found');
    
    if (profile?.id) {
      console.log(`✅ Found user ID: ${profile.id}`);
      // We have a profile with ID, proceed with API call
      return await this.fetchUserVideosFromAPI(profile.id);
    }

    // No stored profile or missing ID - try to fetch from API
    console.log('⚠️ No stored profile or missing ID, attempting to fetch from API...');
    
    // Check if we have email to fetch profile
    const email = await AsyncStorage.getItem('email');
    if (email) {
      console.log(`📧 Found email: ${email}, fetching fresh profile...`);
      const freshProfile = await this.fetchProfileFromAPI(email);
      if (freshProfile?.id) {
        console.log('✅ Successfully fetched profile from API');
        return await this.fetchUserVideosFromAPI(freshProfile.id);
      }
    }
    
    // Still no profile - do comprehensive debugging
    await this.debugAuthAndStorage();
    throw new Error('User profile not found - please login again');

  } catch (error) {
    console.error('ProfileService: Error getting user videos:', error);
    
    // For debugging, return empty array instead of throwing
    // You can change this to throw error if you want the app to handle it
    return [];
  }
}

// Helper method to fetch videos from API
private async fetchUserVideosFromAPI(userId: string): Promise<UserVideo[]> {
  try {
    console.log(`📺 Fetching videos for user ID: ${userId}`);
    
    const response = await this.makeRequest<VideoResponse>(
      `/video/public/person/${userId}?page=0&personId=${userId}&size=100&sortBy=createdTimestamp&sortOrder=DESC`
    );

    if (response.success && response.data && response.data.data) {
      console.log(`✅ Successfully fetched ${response.data.data.length} videos`);
      return response.data.data;
    }

    console.log('ℹ️ No videos found in response or empty response');
    return [];
  } catch (error) {
    console.error('ProfileService: Error fetching videos from API:', error);
    throw error; // Re-throw to let parent handle
  }
}

// Comprehensive debugging method
private async debugAuthAndStorage(): Promise<void> {
  try {
    console.log('🔍 === COMPREHENSIVE AUTH & STORAGE DEBUG ===');
    
    // Check auth tokens
    const authToken = await AsyncStorage.getItem('authToken');
    const jwtToken = await AsyncStorage.getItem('jwt'); // Android uses 'jwt'
    console.log('🔑 Auth Tokens:');
    console.log('  authToken:', authToken ? 'Present' : 'Missing');
    console.log('  jwt:', jwtToken ? 'Present' : 'Missing');
    
    // Check user ID fields
    const userIdKeys = ['id', 'userId', 'personId', 'currentUserId'];
    console.log('👤 User ID Fields:');
    for (const key of userIdKeys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`  ${key}:`, value || 'Missing');
    }
    
    // Check basic profile data
    const profileKeys = ['firstName', 'lastName', 'email'];
    console.log('📋 Basic Profile Data:');
    for (const key of profileKeys) {
      const value = await AsyncStorage.getItem(key);
      console.log(`  ${key}:`, value || 'Missing');
    }

    // Check all storage keys
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('📚 All AsyncStorage Keys:', allKeys);
    
    // Look for any auth-related keys we might have missed
    const authRelatedKeys = allKeys.filter(key => 
      key.toLowerCase().includes('auth') || 
      key.toLowerCase().includes('token') || 
      key.toLowerCase().includes('jwt') ||
      key.toLowerCase().includes('user') ||
      key.toLowerCase().includes('person')
    );
    console.log('🔐 Auth-related keys found:', authRelatedKeys);
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

// Alternative method to get user videos if profile lookup fails
async getUserVideosByEmail(): Promise<UserVideo[]> {
  try {
    const email = await AsyncStorage.getItem('email');
    if (!email) {
      throw new Error('No email found in storage');
    }

    // First get the profile by email
    const profile = await this.fetchProfileFromAPI(email);
    if (!profile?.id) {
      throw new Error('Failed to fetch profile by email');
    }

    // Then get videos for that profile
    return await this.fetchUserVideosFromAPI(profile.id);
    
  } catch (error) {
    console.error('ProfileService: Error getting user videos by email:', error);
    return [];
  }
}
}

// Export singleton instance
export const profileService = new ProfileService();
export default profileService;