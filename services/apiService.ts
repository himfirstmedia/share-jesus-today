// services/apiService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode } from "react";

interface LoginRequest {
  userName: string;
  password: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface Video {
  duration: any;
  description: ReactNode;
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  createdTimestamp: string;
}

interface PastVideosParams {
  size?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Add interface for signup data to match Android implementation
interface SignUpRequest {
  active: boolean;
  address: string;
  biography: string;
  church: string;
  churchFrom: string;
  city: string;
  country: string;
  dob: string;
  email: string;
  firstName: string;
  gender: string;
  lastName: string;
  otp: number;
  otpVerified: boolean;
  phone: string;
  state: string;
  zipCode: string;
  howDidYouKnowAboutUs: string;
  otherSpecify: string;
}

class ApiService {
  private baseURL = 'https://himfirstapis.com/api/v1';
  // private baseURL = 'http://192.168.100.223:8087/api/v1';
  private authToken: string | null = null;

  // Set authentication token
  setAuthToken(token: string) {
    this.authToken = token;
  }

  // Get authentication token
  getAuthToken(): string | null {
    return this.authToken;
  }

  // Initialize token from AsyncStorage - FIXED METHOD
  async initializeAuthToken(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        this.authToken = token;
        console.log('Auth token initialized from AsyncStorage');
      }
    } catch (e) {
      console.error('Failed to load auth token from AsyncStorage', e);
      throw new Error('Authentication initialization failed');
    }
  }

  // Helper method to make API requests - FIXED HEADERS
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      // Only add Content-Type for requests with body (and not FormData)
      const defaultHeaders: HeadersInit = {};
      
      // Only add Content-Type if we have a body to send and it's not FormData
      if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
      }

      // Add authorization header if token exists
      if (this.authToken) {
        defaultHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      const config: RequestInit = {
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        ...options,
      };

      console.log('API Request - URL:', url);
      console.log('API Request - Method:', config.method || 'GET');
      console.log('API Request - Headers:', config.headers);
      if (config.body && typeof config.body === 'string') {
        console.log('API Request - Body (JSON):', config.body);
      }

      const response = await fetch(url, config);
      
      console.log('API Response - Status:', response.status);
      console.log('API Response - Headers:', response.headers);

      if (!response.ok) {
        let errorMessage = 'Request failed';
        let errorDetails = {};
        try {
          const errorData = await response.json();
          errorDetails = errorData;
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          console.error('API Error - Failed to parse error JSON:', jsonError);
        }
        console.error('API Error - Response details:', errorDetails);
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      console.log('API Success - Response data:', data);
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Authentication Methods
  async login(credentials: LoginRequest): Promise<ApiResponse<any>> {
    const response = await this.makeRequest<any>('/authenticate', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data && response.data.token) {
      this.setAuthToken(response.data.token);
      try {
        await AsyncStorage.setItem('authToken', response.data.token);
        console.log('Auth token stored in AsyncStorage');
      } catch (e) {
        console.error('Failed to save auth token to AsyncStorage', e);
      }
    }
    return response;
  }

  async logout(): Promise<void> {
    this.authToken = null;
    try {
      await AsyncStorage.removeItem('authToken');
      console.log('Auth token removed from AsyncStorage');
    } catch (e) {
      console.error('Failed to remove auth token from AsyncStorage', e);
    }
  }

  // User Registration Methods
  async signUp(userData: SignUpRequest | any): Promise<ApiResponse<any>> {
    console.log('Signup request data:', userData);
    return this.makeRequest('/person/sign-up', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async register(userData: any): Promise<ApiResponse<any>> {
    const signupData: SignUpRequest = {
      active: true,
      address: userData.address || '',
      biography: userData.biography || '',
      church: userData.church || '',
      churchFrom: userData.churchFrom || '',
      city: userData.city || '',
      country: userData.country || '',
      dob: userData.dob || '',
      email: userData.email,
      firstName: userData.firstName,
      gender: userData.gender || 'male',
      lastName: userData.lastName,
      otp: 0,
      otpVerified: true,
      phone: userData.phone || '',
      state: userData.state || '',
      zipCode: userData.zipCode || '',
      howDidYouKnowAboutUs: userData.howDidYouKnowAboutUs || '',
      otherSpecify: userData.otherSpecify || '',
    };

    return this.signUp(signupData);
  }

  // Video Methods
  async getAllPublicVideos(): Promise<ApiResponse<Video[]>> {
    return this.makeRequest<Video[]>('/video/public/all', {
      method: 'GET',
    });
  }

  async getPastVideos(
    date: string,
    params: PastVideosParams = {}
  ): Promise<ApiResponse<Video[]>> {
    const {
      size = 100,
      sortBy = 'createdTimestamp',
      sortOrder = 'DESC'
    } = params;

    const queryParams = new URLSearchParams({
      size: size.toString(),
      sortBy,
      sortOrder,
    });

    return this.makeRequest<Video[]>(
      `/video/public/prev-videos/${date}?${queryParams.toString()}`,
      {
        method: 'GET',
      }
    );
  }

  async getVideoById(videoId: string): Promise<ApiResponse<Video>> {
    return this.makeRequest<Video>(`/video/${videoId}`, {
      method: 'GET',
    });
  }

  // FIXED VIDEO UPLOAD METHOD
  async uploadVideo(
    videoFile: { uri: string; name: string; type: string },
    metadata: {
      title: string;
      caption: string;
    }
  ): Promise<ApiResponse<any>> {
    try {
      const formData = new FormData();
      
      // Append the video file - React Native expects this format
      formData.append('file', {
        uri: videoFile.uri,
        name: videoFile.name,
        type: videoFile.type,
      } as any);

      formData.append('title', metadata.title);
      formData.append('caption', metadata.caption);

      console.log('Uploading video with FormData');

      // Don't set Content-Type header for FormData - let fetch handle it
      const headers: HeadersInit = {};
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await fetch(`${this.baseURL}/video/upload`, {
        method: 'POST',
        headers: headers,
        body: formData,
      });

      console.log('Video Upload Response - Status:', response.status);
      console.log('Video Upload Response - Headers:', response.headers);

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        let errorDetails = {};
        try {
          const errorData = await response.json();
          errorDetails = errorData;
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (jsonError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          console.error('Video Upload Error - Failed to parse error JSON:', jsonError);
        }
        console.error('Video Upload Error - Response details:', errorDetails);
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      console.log('Video Upload Success - Response data:', data);
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload error occurred',
      };
    }
  }

  async deleteVideo(videoId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/video/${videoId}`, {
      method: 'DELETE',
    });
  }

  // Person/Profile Methods
  async updatePerson(personId: string, userDetails: any): Promise<ApiResponse<any>> {
    return this.makeRequest(`/person/${personId}`, {
      method: 'PUT',
      body: JSON.stringify(userDetails),
    });
  }

  async uploadCoverImage(
    imageFile: File,
    fileName: string
  ): Promise<ApiResponse<string>> {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('name', fileName);

      const response = await fetch(`${this.baseURL}/person/cover-photo`, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken ? `Bearer ${this.authToken}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
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

      const imageUrl = await response.text();
      
      return {
        success: true,
        data: imageUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload error occurred',
      };
    }
  }

  // Password Reset Methods
  async resetPassword(email: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Search Methods
  async searchProfiles(query: string, params: any = {}): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams({
      q: query,
      ...params,
    });

    return this.makeRequest<any[]>(`/person/search?${queryParams.toString()}`, {
      method: 'GET',
    });
  }

  // Generic methods for future endpoints
  async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
    const queryParams = new URLSearchParams(params);
    const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
    
    return this.makeRequest<T>(url, {
      method: 'GET',
    });
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Additional methods
  async resendOtp(email: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/person/sign-up/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async setPassword(email: string, password: string): Promise<ApiResponse<any>> {
    const encodedEmail = encodeURIComponent(email);
    const encodedPassword = encodeURIComponent(password);
    const endpoint = `/person/sign-up/set-password?email=${encodedEmail}&password=${encodedPassword}`;
    
    return this.makeRequest(endpoint, {
      method: 'PUT',
      headers: {
        'accept': '*/*',
      },
    });
  }

  async loginPerson(email: string, password: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/person/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<ApiResponse<any>> {
    const encodedEmail = encodeURIComponent(email);
    const encodedOtp = encodeURIComponent(otp);
    const endpoint = `/person/sign-up/verify-otp?email=${encodedEmail}&otp=${encodedOtp}`;
    
    return this.makeRequest(endpoint, {
      method: 'PUT',
    });
  }

  async getPersonProfile(personId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/person/${personId}`, {
      method: 'GET',
    });
  }
}

// Create and export a singleton instance
const apiService = new ApiService();

export default apiService;

// Export types for use in components
export type { ApiResponse, LoginRequest, PastVideosParams, SignUpRequest, Video };
