// services/videoApiService.ts - Complete Implementation with Expo FileSystem
import * as FileSystem from 'expo-file-system';
import { ReactNode } from "react";
import 'react-native-url-polyfill/auto';
import AuthManager from '../utils/authManager';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface VideoUploadMetadata {
  name: string;
  title: string;
  caption: string;
  originalDuration?: number;
  wasTrimmed?: boolean;
}

interface VideoFile {
  uri: string;
  name: string;
  type: string;
  mimeType?: string;
}

interface UploadProgressEvent {
  loaded: number;
  total: number;
  progress: number;
}

interface UploadOptions {
  onUploadProgress?: (progressEvent: UploadProgressEvent) => void;
  onStateChange?: (state: 'preparing' | 'uploading' | 'processing' | 'complete') => void;
  timeout?: number;
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
  description: ReactNode;
}

export interface VideoPage {
  data: VideoModel[];
  totalPages: number;
  totalElements: number;
  size: number; 
  number: number; 
}

class VideoApiService {
  private baseURL = 'https://himfirstapis.com';
  private unsubscribeAuth: (() => void) | null = null;
  private activeUploads = new Map<string, FileSystem.UploadTask>();

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

  // Helper method for making API requests (for non-upload requests)
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
        
        // For debugging, show auth status only in development mode
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
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  // Enhanced upload method with Expo FileSystem progress tracking
  private async uploadWithExpoFileSystem(
    url: string,
    videoFile: VideoFile,
    metadata: VideoUploadMetadata,
    options: UploadOptions = {}
  ): Promise<ApiResponse<VideoModel>> {
    return new Promise(async (resolve) => {
      try {
        const token = await this.getAuthToken();
        const uploadId = Date.now().toString();
        
        console.log('VideoAPI: Starting Expo FileSystem upload preparation');
        options.onStateChange?.('preparing');

        // Prepare headers
        const headers: { [key: string]: string } = {};
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('VideoAPI: Added auth header to upload');
        }

        // Prepare upload parameters
        const uploadParams = {
          title: metadata.title,
          caption: metadata.caption || '',
        };

        // Add optional metadata if available
        if (metadata.originalDuration !== undefined) {
          uploadParams['originalDuration'] = metadata.originalDuration.toString();
        }
        if (metadata.wasTrimmed !== undefined) {
          uploadParams['wasTrimmed'] = metadata.wasTrimmed.toString();
        }

        console.log('VideoAPI: Upload parameters:', uploadParams);
        console.log('VideoAPI: Video file details:', {
          uri: videoFile.uri,
          name: videoFile.name,
          type: videoFile.type,
        });

        // Create upload task with progress tracking
        const uploadTask = FileSystem.createUploadTask(
          url,
          videoFile.uri,
          {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            parameters: uploadParams,
            headers: headers,
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND, // Enable background uploads
          },
          (uploadProgressData) => {
            const { totalBytesSent, totalBytesExpectedToSend } = uploadProgressData;
            
            // Calculate progress percentage
            const progress = totalBytesExpectedToSend > 0 
              ? Math.round((totalBytesSent / totalBytesExpectedToSend) * 100)
              : 0;
            
            const progressEvent: UploadProgressEvent = {
              loaded: totalBytesSent,
              total: totalBytesExpectedToSend,
              progress: progress,
            };
            
            console.log(`VideoAPI: Upload progress: ${progress}% (${totalBytesSent}/${totalBytesExpectedToSend})`);
            
            // Notify upload state change when upload actually starts
            if (totalBytesSent > 0 && progress > 0) {
              options.onStateChange?.('uploading');
            }
            
            options.onUploadProgress?.(progressEvent);
          }
        );

        // Store the task for potential cancellation
        this.activeUploads.set(uploadId, uploadTask);

        console.log('VideoAPI: Starting upload task execution');

        try {
          // Execute the upload
          const response = await uploadTask.uploadAsync();
          
          // Remove from active uploads
          this.activeUploads.delete(uploadId);
          
          console.log('VideoAPI: Upload completed, response:', {
            status: response?.status,
            headers: response?.headers,
            bodyLength: response?.body?.length,
          });

          // Check response status
          if (response && response.status >= 200 && response.status < 300) {
            console.log('VideoAPI: Upload successful');
            options.onStateChange?.('processing');
            
            let responseData;
            try {
              responseData = response.body ? JSON.parse(response.body) : {};
              console.log('VideoAPI: Parsed response data:', responseData);
            } catch (parseError) {
              console.error('VideoAPI: Error parsing response body:', parseError);
              console.log('VideoAPI: Raw response body:', response.body);
              responseData = {}; // Fallback to empty object
            }
            
            // Simulate processing delay
            setTimeout(() => {
              options.onStateChange?.('complete');
              resolve({
                success: true,
                data: responseData,
              });
            }, 1000);
            
          } else {
            console.error('VideoAPI: Upload failed with status:', response?.status);
            let errorMessage = 'Upload failed';
            
            try {
              if (response?.body) {
                const errorData = JSON.parse(response.body);
                errorMessage = errorData.message || errorData.error || errorMessage;
              }
            } catch {
              errorMessage = response?.status ? `HTTP ${response.status}` : 'Upload failed';
            }

            // Handle auth errors
            if (response?.status === 401) {
              console.error('VideoAPI: Authentication failed during upload');
              await AuthManager.clearAuthToken();
              errorMessage = 'Authentication failed. Please login again.';
            }

            resolve({
              success: false,
              error: errorMessage,
            });
          }
        } catch (uploadError: any) {
          // Remove from active uploads on error
          this.activeUploads.delete(uploadId);
          
          console.error('VideoAPI: Upload execution error:', uploadError);
          
          let errorMessage = 'Upload failed';
          if (uploadError.message) {
            if (uploadError.message.includes('canceled') || uploadError.message.includes('cancelled')) {
              errorMessage = 'Upload cancelled';
            } else if (uploadError.message.includes('timeout')) {
              errorMessage = 'Upload timeout';
            } else if (uploadError.message.includes('network') || uploadError.message.includes('connection')) {
              errorMessage = 'Network error during upload';
            } else {
              errorMessage = uploadError.message;
            }
          }

          resolve({
            success: false,
            error: errorMessage,
          });
        }

      } catch (error: any) {
        console.error('VideoAPI: Upload setup error:', error);
        resolve({
          success: false,
          error: error.message || 'Upload setup failed',
        });
      }
    });
  }

  // Upload video with progress support using Expo FileSystem
  async uploadVideo(
    videoFile: VideoFile,
    metadata: VideoUploadMetadata,
    options: UploadOptions = {}
  ): Promise<ApiResponse<VideoModel>> {
    try {
      // Check authentication first
      if (!this.isAuthenticated()) {
        console.error('VideoAPI: Not authenticated for upload');
        
        // Debug auth status in development
        if (__DEV__) {
          await AuthManager.debugAuthStatus();
        }
        
        return {
          success: false,
          error: 'Authentication required. Please login first.',
        };
      }

      console.log('VideoAPI: Starting video upload with Expo FileSystem:', {
        fileName: videoFile.name,
        fileType: videoFile.type,
        title: metadata.title,
        caption: metadata.caption,
        isAuthenticated: this.isAuthenticated(),
        hasProgressCallback: !!options.onUploadProgress,
        hasStateCallback: !!options.onStateChange,
      });

      const uploadUrl = `${this.baseURL}/api/v1/video/upload`;

      // Use Expo FileSystem upload with progress tracking
      return await this.uploadWithExpoFileSystem(uploadUrl, videoFile, metadata, options);

    } catch (error) {
      console.error('VideoAPI: Upload error:', error);
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Upload failed',
      };
    }
  }

  // Cancel active upload
  cancelUpload(uploadId?: string): void {
    if (uploadId && this.activeUploads.has(uploadId)) {
      const uploadTask = this.activeUploads.get(uploadId);
      uploadTask?.cancelAsync();
      this.activeUploads.delete(uploadId);
      console.log('VideoAPI: Upload cancelled:', uploadId);
    } else {
      // Cancel all active uploads
      this.activeUploads.forEach(async (uploadTask, id) => {
        await uploadTask.cancelAsync();
        console.log('VideoAPI: Upload cancelled:', id);
      });
      this.activeUploads.clear();
      console.log('VideoAPI: All active uploads cancelled');
    }
  }

  // Get active upload count
  getActiveUploadCount(): number {
    return this.activeUploads.size;
  }

  // Get all public videos
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
  async getMyVideos(page: number = 0, size: number = 10): Promise<ApiResponse<VideoModel[]>> {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        error: 'Authentication required to fetch your videos.',
      };
    }

    return this.makeRequest<VideoModel[]>(`/api/v1/video/my-videos?page=${page}&size=${size}`, {
      method: 'GET',
    });
  }

  // Cleanup subscription and cancel uploads when service is destroyed
  destroy(): void {
    // Cancel all active uploads
    this.cancelUpload();
    
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
      this.unsubscribeAuth = null;
    }
    
    console.log('VideoAPI: Service destroyed and cleaned up');
  }
}

// Create and export singleton instance
const videoApiService = new VideoApiService();
export default videoApiService;