// services/videoApiService.ts - Updated with Auth Manager
import { ReactNode } from "react";
import AuthManager from '../utils/authManager';

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

interface VideoUploadMetadata {
  name: string;
  title: string;
  caption: string;
}

interface VideoFile {
  uri: string;
  name: string;
  type: string;
}

export interface UploaderProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
  // Add other uploader fields if needed from the JSON
}

export interface VideoModel {
  id: string;
  title: string;
  url:string;
  thumbnailUrl?: string | null;
  duration?: number;
  createdTimestamp: string;
  uploader: UploaderProfile;
  // Add other video fields like visibility, reported, caption if needed
}

class VideoApiService {
  private baseURL = 'https://himfirstapis.com';
  private unsubscribeAuth: (() => void) | null = null;

  constructor() {
    // Subscribe to auth token changes
    this.unsubscribeAuth = AuthManager.subscribe((token) => {
      console.log('VideoAPI: Auth token updated:', token ? 'Present' : 'Cleared');
    });
  }

  // Get authentication token from AuthManager (now async)
  private async getAuthToken(): Promise<string | null> {
    await AuthManager.ensureInitialized(); // Ensure AuthManager has loaded token
    return AuthManager.getAuthToken();
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return AuthManager.isAuthenticated();
  }

  // Helper method for making API requests
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const defaultHeaders: HeadersInit = {};
      
      // Only add Content-Type for JSON requests (not FormData)
      if (options.body && !(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
      }

      // Add authorization header if token exists
      const token = await this.getAuthToken();
      if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
        console.log('VideoAPI: Added auth header with Bearer token');
      } else {
        console.warn('VideoAPI: No auth token available for request');
        
        // For debugging, show auth status
        if (__DEV__) {
          await AuthManager.debugAuthStatus();
        }
      }

      const config: RequestInit = {
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        ...options,
      };

      console.log('VideoAPI: Making request to:', url);
      console.log('VideoAPI: Request headers:', config.headers);

      const response = await fetch(url, config);
      
      console.log('VideoAPI: Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          console.log('VideoAPI: Error response data:', errorData);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        // Special handling for auth errors
        if (response.status === 401) {
          console.error('VideoAPI: Authentication failed - clearing token');
          await AuthManager.clearAuthToken();
          errorMessage = 'Authentication failed. Please login again.';
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      console.log('VideoAPI: Success response data:', data);
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('VideoAPI: Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Upload video (Fixed and Complete)
  async uploadVideo(
    videoFile: VideoFile,
    metadata: VideoUploadMetadata
  ): Promise<ApiResponse<any>> {
    try {
      // Check authentication first
      if (!this.isAuthenticated()) {
        console.error('VideoAPI: Not authenticated for upload');
        
        // Debug auth status
        if (__DEV__) {
          await AuthManager.debugAuthStatus();
        }
        
        return {
          success: false,
          error: 'Authentication required. Please login first.',
        };
      }

      const formData = new FormData();
      
      // Append the video file
      formData.append('file', {
        uri: videoFile.uri,
        name: videoFile.name,
        type: videoFile.type,
      } as any);

      // Add metadata fields
      if (metadata.title) {
        formData.append('title', metadata.title);
      }
      
      if (metadata.caption) {
        formData.append('caption', metadata.caption);
      }

      console.log('VideoAPI: Uploading video with metadata:', {
        fileName: videoFile.name,
        fileType: videoFile.type,
        title: metadata.title,
        caption: metadata.caption,
        isAuthenticated: this.isAuthenticated(),
      });

      // Make the upload request
      return await this.makeRequest('/api/v1/video/upload', {
        method: 'POST',
        body: formData,
      });

    } catch (error) {
      console.error('VideoAPI: Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Get all videos
    async fetchPublicVideos(page: number = 0, size: number = 10, sortBy: string = 'createdTimestamp', sortOrder: string = 'DESC'): Promise<ApiResponse<VideoPage>> {
    const endpoint = `/api/v1/video/public/all?page=${page}&size=${size}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    // This is a public endpoint, so auth token is not strictly required but will be sent if available by makeRequest
    return this.makeRequest<VideoPage>(endpoint, {
      method: 'GET',
    });
  }


  // Get user's videos
  async getMyVideos(page: number = 0, size: number = 10): Promise<ApiResponse<Video[]>> {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        error: 'Authentication required to fetch your videos.',
      };
    }

    return this.makeRequest<Video[]>(`/api/v1/video/my-videos?page=${page}&size=${size}`, {
      method: 'GET',
    });
  }

  // Cleanup subscription when service is destroyed
  destroy(): void {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }


}
  export interface VideoPage {
  data: Video[];
  totalPages: number;
  totalElements: number;
  size?: number; 
  number?: number; 
}
// Create and export singleton instance
const videoApiService = new VideoApiService();
export default videoApiService;