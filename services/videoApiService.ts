// services/videoApiService.ts - Updated with Progress Tracking Support
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

interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number;
}

interface UploadOptions {
  onUploadProgress?: (progressEvent: UploadProgressEvent) => void;
  onStateChange?: (state: 'preparing' | 'uploading' | 'processing' | 'complete') => void;
}

export interface UploaderProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
}

export interface VideoModel {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string | null;
  duration?: number;
  createdTimestamp: string;
  uploader: UploaderProfile;
}

export interface VideoPage {
  data: Video[];
  totalPages: number;
  totalElements: number;
  size?: number; 
  number?: number; 
}

class VideoApiService {
  private baseURL = 'https://himfirstapis.com';
  private unsubscribeAuth: (() => void) | null = null;
  private activeUploads = new Map<string, AbortController>();

  constructor() {
    // Subscribe to auth token changes
    this.unsubscribeAuth = AuthManager.subscribe((token) => {
      console.log('VideoAPI: Auth token updated:', token ? 'Present' : 'Cleared');
    });
  }

  // Get authentication token from AuthManager (now async)
  private async getAuthToken(): Promise<string | null> {
    await AuthManager.ensureInitialized();
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

  // Enhanced upload method with progress tracking using XMLHttpRequest
  private async uploadWithProgress(
    url: string,
    formData: FormData,
    options: UploadOptions = {}
  ): Promise<ApiResponse<any>> {
    return new Promise(async (resolve) => {
      try {
        const token = await this.getAuthToken();
        const uploadId = Date.now().toString();
        const abortController = new AbortController();
        this.activeUploads.set(uploadId, abortController);

        // Notify state change to preparing
        options.onStateChange?.('preparing');

        const xhr = new XMLHttpRequest();

        // Handle upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            const progressEvent: UploadProgressEvent = {
              loaded: event.loaded,
              total: event.total,
              progress: progress
            };
            
            console.log('VideoAPI: Upload progress:', progressEvent);
            options.onUploadProgress?.(progressEvent);
          }
        });

        // Handle load start (uploading begins)
        xhr.upload.addEventListener('loadstart', () => {
          console.log('VideoAPI: Upload started');
          options.onStateChange?.('uploading');
        });

        // Handle successful completion
        xhr.addEventListener('load', async () => {
          this.activeUploads.delete(uploadId);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('VideoAPI: Upload completed successfully');
            options.onStateChange?.('processing');
            
            try {
              const responseData = JSON.parse(xhr.responseText);
              console.log('VideoAPI: Upload response:', responseData);
              
              // Simulate processing delay
              setTimeout(() => {
                options.onStateChange?.('complete');
                resolve({
                  success: true,
                  data: responseData
                });
              }, 1000);
            } catch (error) {
              console.error('VideoAPI: Error parsing response:', error);
              resolve({
                success: false,
                error: 'Invalid response from server'
              });
            }
          } else {
            console.error('VideoAPI: Upload failed with status:', xhr.status);
            let errorMessage = 'Upload failed';
            
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage = errorData.message || errorData.error || errorMessage;
            } catch {
              errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
            }

            // Special handling for auth errors
            if (xhr.status === 401) {
              console.error('VideoAPI: Authentication failed during upload');
              await AuthManager.clearAuthToken();
              errorMessage = 'Authentication failed. Please login again.';
            }

            resolve({
              success: false,
              error: errorMessage
            });
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          this.activeUploads.delete(uploadId);
          console.error('VideoAPI: Upload network error');
          resolve({
            success: false,
            error: 'Network error during upload'
          });
        });

        // Handle abort
        xhr.addEventListener('abort', () => {
          this.activeUploads.delete(uploadId);
          console.log('VideoAPI: Upload aborted');
          resolve({
            success: false,
            error: 'Upload cancelled'
          });
        });

        // Handle timeout
        xhr.addEventListener('timeout', () => {
          this.activeUploads.delete(uploadId);
          console.error('VideoAPI: Upload timeout');
          resolve({
            success: false,
            error: 'Upload timeout'
          });
        });

        // Set up abort signal
        abortController.signal.addEventListener('abort', () => {
          xhr.abort();
        });

        // Configure and send request
        xhr.open('POST', url);
        xhr.timeout = 300000; // 5 minutes timeout

        // Set auth header if available
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          console.log('VideoAPI: Added auth header to XMLHttpRequest');
        }

        console.log('VideoAPI: Starting XMLHttpRequest upload to:', url);
        xhr.send(formData);

      } catch (error) {
        console.error('VideoAPI: Upload setup error:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Upload setup failed'
        });
      }
    });
  }

  // Upload video with progress support
  async uploadVideo(
    videoFile: VideoFile,
    metadata: VideoUploadMetadata,
    options: UploadOptions = {}
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
        hasProgressCallback: !!options.onUploadProgress,
      });

      const uploadUrl = `${this.baseURL}/api/v1/video/upload`;

      // Use progress-enabled upload if callback provided
      if (options.onUploadProgress || options.onStateChange) {
        return await this.uploadWithProgress(uploadUrl, formData, options);
      } else {
        // Fallback to regular upload
        return await this.makeRequest('/api/v1/video/upload', {
          method: 'POST',
          body: formData,
        });
      }

    } catch (error) {
      console.error('VideoAPI: Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  // Cancel active upload
  cancelUpload(uploadId?: string): void {
    if (uploadId && this.activeUploads.has(uploadId)) {
      const controller = this.activeUploads.get(uploadId);
      controller?.abort();
      this.activeUploads.delete(uploadId);
      console.log('VideoAPI: Upload cancelled:', uploadId);
    } else {
      // Cancel all active uploads
      this.activeUploads.forEach((controller, id) => {
        controller.abort();
        console.log('VideoAPI: Upload cancelled:', id);
      });
      this.activeUploads.clear();
    }
  }

  // Get active upload count
  getActiveUploadCount(): number {
    return this.activeUploads.size;
  }

  // Get all videos
  async fetchPublicVideos(
    page: number = 0, 
    size: number = 10, 
    sortBy: string = 'createdTimestamp', 
    sortOrder: string = 'DESC'
  ): Promise<ApiResponse<VideoPage>> {
    const endpoint = `/api/v1/video/public/all?page=${page}&size=${size}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
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
    // Cancel all active uploads
    this.cancelUpload();
    
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
  }
}

// Create and export singleton instance
const videoApiService = new VideoApiService();
export default videoApiService;