// services/profileSearchService.ts - Enhanced Profile Search API Service

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileSearch, ProfileSearchApiResponse, ProfileSearchParams, ProfileSearchUtils } from '../types/ProfileSearch';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ConnectionRequest {
  recipientId: string;
  senderId?: string;
  message?: string;
}

interface ConnectionResponse {
  id: string;
  senderId: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED';
  createdTimestamp: string;
  message?: string;
}

interface BlockUserRequest {
  targetUserId: string;
  reason?: string;
}

class ProfileSearchService {
  private baseURL = 'https://himfirstapis.com/api/v1';
  private authToken: string | null = null;
  private cache: Map<string, { data: ProfileSearch[]; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  constructor() {
    this.initializeAuthToken();
  }

  // Initialize authentication token
  private async initializeAuthToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        this.authToken = token;
      }
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  // Get authentication token
  private async getAuthToken(): Promise<string | null> {
    if (!this.authToken) {
      await this.initializeAuthToken();
    }
    return this.authToken;
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Clear authentication token and cache
  clearAuth(): void {
    this.authToken = null;
    this.clearCache();
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Check if cache is valid
  private isCacheValid(cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheTimeout;
  }

  // Get cached data
  private getCachedData(cacheKey: string): ProfileSearch[] | null {
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)?.data || null;
    }
    return null;
  }

  // Set cache data
  private setCacheData(cacheKey: string, data: ProfileSearch[]): void {
    this.cache.set(cacheKey, {
      data: [...data],
      timestamp: Date.now()
    });
  }

  // Make API request with proper error handling
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add authorization header if token is available
      const token = await this.getAuthToken();
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Fetch all public profiles (matching Android implementation)
   */
  async fetchAllProfiles(params: Partial<ProfileSearchParams> = {}): Promise<ApiResponse<ProfileSearch[]>> {
    const cacheKey = `all_profiles_${JSON.stringify(params)}`;
    
    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return {
        success: true,
        data: cachedData,
      };
    }

    const queryParams = new URLSearchParams({
      page: '0',
      size: '100',
      sortBy: 'createdTimestamp',
      sortOrder: 'DESC',
    });

    // Only add params that are defined and are strings (URLSearchParams expects string values)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value));
      }
    });

    const response = await this.makeRequest<ProfileSearchApiResponse>(
      `/person/public/all?${queryParams.toString()}`
    );

    if (response.success && response.data?.data) {
      // Validate and transform profiles
      const profiles = response.data.data
        .filter(ProfileSearchUtils.isValidProfile)
        .map(this.transformProfile);

      // Sort alphabetically (matching Android behavior)
      const sortedProfiles = ProfileSearchUtils.sortByName(profiles);
      
      // Cache the results
      this.setCacheData(cacheKey, sortedProfiles);
      
      return {
        success: true,
        data: sortedProfiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to fetch profiles',
    };
  }

  /**
   * Search profiles by query (matching Android implementation)
   */
  async searchProfiles(query: string, params: Partial<ProfileSearchParams> = {}): Promise<ApiResponse<ProfileSearch[]>> {
    if (!query.trim()) {
      return this.fetchAllProfiles(params);
    }

    const cacheKey = `search_${query}_${JSON.stringify(params)}`;
    
    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return {
        success: true,
        data: cachedData,
      };
    }

    const queryParams = new URLSearchParams();
    queryParams.set('query', query.trim());

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value));
      }
    });

    const response = await this.makeRequest<ProfileSearch[]>(
      `/person/public/search?${queryParams.toString()}`
    );

    if (response.success && response.data) {
      // Validate and transform profiles
      const profiles = Array.isArray(response.data)
        ? response.data
            .filter(ProfileSearchUtils.isValidProfile)
            .map(this.transformProfile)
        : [];
      
      // Cache the results
      this.setCacheData(cacheKey, profiles);
      
      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Search failed',
    };
  }

  /**
   * Get a specific profile by ID
   */
  async getProfile(profileId: string): Promise<ApiResponse<ProfileSearch>> {
    const response = await this.makeRequest<ProfileSearch>(`/person/${profileId}`);

    if (response.success && response.data) {
      const profile = this.transformProfile(response.data);
      return {
        success: true,
        data: profile,
      };
    }

    return {
      success: false,
      error: response.error || 'Profile not found',
    };
  }

  /**
   * Transform API profile data to match our interface
   */
  private transformProfile(apiProfile: any): ProfileSearch {
    return {
      id: apiProfile.id || '',
      firstName: apiProfile.firstName || '',
      lastName: apiProfile.lastName || '',
      email: apiProfile.email || '',
      city: apiProfile.city || '',
      state: apiProfile.state || '',
      church: apiProfile.church || '',
      profilePicture: apiProfile.profilePicture || '',
      biography: apiProfile.biography || '',
      country: apiProfile.country || '',
      zipCode: apiProfile.zipCode || '',
      phone: apiProfile.phone || '',
      address: apiProfile.address || '',
      dob: apiProfile.dob || '',
      gender: apiProfile.gender || '',
      churchFrom: apiProfile.churchFrom || '',
      createdTimestamp: apiProfile.createdTimestamp || '',
      active: apiProfile.active ?? true,
    };
  }

  /**
   * Send a connection request to another profile
   */
  async connectWithProfile(profileId: string, message?: string): Promise<ApiResponse<ConnectionResponse>> {
    const connectionData: ConnectionRequest = {
      recipientId: profileId,
      message: message || '',
    };

    return this.makeRequest<ConnectionResponse>('/person/connection/send', {
      method: 'POST',
      body: JSON.stringify(connectionData),
    });
  }

  /**
   * Accept a connection request
   */
  async acceptConnection(connectionId: string): Promise<ApiResponse<ConnectionResponse>> {
    return this.makeRequest<ConnectionResponse>(`/person/connection/${connectionId}/accept`, {
      method: 'PUT',
    });
  }

  /**
   * Reject a connection request
   */
  async rejectConnection(connectionId: string): Promise<ApiResponse<ConnectionResponse>> {
    return this.makeRequest<ConnectionResponse>(`/person/connection/${connectionId}/reject`, {
      method: 'PUT',
    });
  }

  /**
   * Get pending connection requests (received)
   */
  async getPendingConnections(): Promise<ApiResponse<ConnectionResponse[]>> {
    return this.makeRequest<ConnectionResponse[]>('/person/connection/pending');
  }

  /**
   * Get sent connection requests
   */
  async getSentConnections(): Promise<ApiResponse<ConnectionResponse[]>> {
    return this.makeRequest<ConnectionResponse[]>('/person/connection/sent');
  }

  /**
   * Get accepted connections (friends/connections)
   */
  async getConnections(): Promise<ApiResponse<ProfileSearch[]>> {
    const response = await this.makeRequest<any[]>('/person/connection/accepted');

    if (response.success && response.data) {
      // Transform connection data to profiles
      const profiles = response.data
        .map((connection: any) => {
          // Extract profile data from connection object
          const profile = connection.recipient || connection.sender || connection.profile;
          return profile ? this.transformProfile(profile) : null;
        })
        .filter((profile: ProfileSearch | null) => profile !== null) as ProfileSearch[];

      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to fetch connections',
    };
  }

  /**
   * Remove/disconnect from a connection
   */
  async removeConnection(profileId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/person/connection/remove/${profileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Block a user
   */
  async blockUser(profileId: string, reason?: string): Promise<ApiResponse<any>> {
    const blockData: BlockUserRequest = {
      targetUserId: profileId,
      reason: reason || 'User blocked',
    };

    return this.makeRequest('/person/block', {
      method: 'POST',
      body: JSON.stringify(blockData),
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(profileId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/person/unblock/${profileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get blocked users list
   */
  async getBlockedUsers(): Promise<ApiResponse<ProfileSearch[]>> {
    const response = await this.makeRequest<any[]>('/person/blocked');

    if (response.success && response.data) {
      const profiles = response.data
        .map((blockedUser: any) => {
          const profile = blockedUser.blockedUser || blockedUser.profile;
          return profile ? this.transformProfile(profile) : null;
        })
        .filter((profile: ProfileSearch | null) => profile !== null) as ProfileSearch[];

      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to fetch blocked users',
    };
  }

  /**
   * Report a profile
   */
  async reportProfile(profileId: string, reason: string, description?: string): Promise<ApiResponse<any>> {
    const reportData = {
      reportedUserId: profileId,
      reason,
      description: description || '',
    };

    return this.makeRequest('/person/report', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  /**
   * Check connection status with a profile
   */
  async getConnectionStatus(profileId: string): Promise<ApiResponse<{
    status: 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';
    connectionId?: string;
  }>> {
    return this.makeRequest(`/person/connection/status/${profileId}`);
  }

  /**
   * Get mutual connections with a profile
   */
  async getMutualConnections(profileId: string): Promise<ApiResponse<ProfileSearch[]>> {
    const response = await this.makeRequest<any[]>(`/person/connection/mutual/${profileId}`);

    if (response.success && response.data) {
      const profiles = response.data
        .map((mutual: any) => this.transformProfile(mutual))
        .filter(ProfileSearchUtils.isValidProfile);

      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to fetch mutual connections',
    };
  }

  /**
   * Search within connections
   */
  async searchConnections(query: string): Promise<ApiResponse<ProfileSearch[]>> {
    if (!query.trim()) {
      return this.getConnections();
    }

    const encodedQuery = encodeURIComponent(query.trim());
    const response = await this.makeRequest<any[]>(`/person/connection/search?query=${encodedQuery}`);

    if (response.success && response.data) {
      const profiles = response.data
        .map((connection: any) => {
          const profile = connection.recipient || connection.sender || connection.profile;
          return profile ? this.transformProfile(profile) : null;
        })
        .filter((profile: ProfileSearch | null) => profile !== null) as ProfileSearch[];

      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Search failed',
    };
  }

  /**
   * Get connection recommendations
   */
  async getConnectionRecommendations(limit: number = 10): Promise<ApiResponse<ProfileSearch[]>> {
    const response = await this.makeRequest<any[]>(`/person/connection/recommendations?limit=${limit}`);

    if (response.success && response.data) {
      const profiles = response.data
        .filter(ProfileSearchUtils.isValidProfile)
        .map(this.transformProfile);

      return {
        success: true,
        data: profiles,
      };
    }

    return {
      success: false,
      error: response.error || 'Failed to fetch recommendations',
    };
  }

  /**
   * Send a direct message to a connected profile
   */
  async sendMessage(profileId: string, message: string): Promise<ApiResponse<any>> {
    const messageData = {
      recipientId: profileId,
      content: message,
      messageType: 'TEXT',
    };

    return this.makeRequest('/person/message/send', {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  /**
   * Get conversation with a profile
   */
  async getConversation(profileId: string, page: number = 0, size: number = 20): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });

    return this.makeRequest<any[]>(`/person/message/conversation/${profileId}?${queryParams.toString()}`);
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/person/message/read/${conversationId}`, {
      method: 'PUT',
    });
  }

  /**
   * Get all conversations
   */
  async getConversations(): Promise<ApiResponse<any[]>> {
    return this.makeRequest<any[]>('/person/message/conversations');
  }

  /**
   * Update profile visibility settings
   */
  async updateProfileVisibility(settings: {
    isPublic?: boolean;
    allowConnectionRequests?: boolean;
    allowMessages?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('/person/profile/visibility', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<ApiResponse<any>> {
    return this.makeRequest('/person/notifications/settings');
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: {
    connectionRequests?: boolean;
    messages?: boolean;
    profileViews?: boolean;
    recommendations?: boolean;
  }): Promise<ApiResponse<any>> {
    return this.makeRequest('/person/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }
}

// Create and export a singleton instance
const profileSearchService = new ProfileSearchService();

export default profileSearchService;

// Export types and classes
export {
    ProfileSearchService, type BlockUserRequest, type ConnectionRequest,
    type ConnectionResponse
};

