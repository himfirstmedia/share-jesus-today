// services/cameraApiService.ts - Dedicated Camera/Recording API Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface CameraFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

interface CompressionOptions {
  quality?: 'low' | 'medium' | 'high';
  maxDuration?: number; // in seconds
  maxSize?: number; // in MB
}

interface RecordingMetadata {
  duration: number;
  size: number;
  resolution: string;
  timestamp: string;
}

class CameraApiService {
  private baseURL = 'https://himfirstapis.com';
  private authToken: string | null = null;

  // Get authentication token from AsyncStorage
  private async getAuthToken(): Promise<string | null> {
    if (this.authToken) {
      return this.authToken;
    }

    try {
      // Try 'authToken' first, then 'jwt' for Android compatibility
      let token = await AsyncStorage.getItem('authToken');
      if (!token) {
        token = await AsyncStorage.getItem('jwt');
      }
      
      if (token) {
        this.authToken = token;
        return token;
      }
    } catch (e) {
      console.error('CameraAPI: Failed to load auth token from AsyncStorage', e);
    }
    
    return null;
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.authToken = token;
  }

  // Clear authentication token
  clearAuthToken() {
    this.authToken = null;
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
      }

      const config: RequestInit = {
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        ...options,
      };

      console.log('CameraAPI: Making request to:', url);

      const response = await fetch(url, config);
      
      console.log('CameraAPI: Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          console.log('CameraAPI: Error response data:', errorData);
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
      console.log('CameraAPI: Success response data:', data);
      
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('CameraAPI: Network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // Validate recorded video file
  async validateRecording(file: CameraFile, retryCount: number = 5, delayMs: number = 200): Promise<ApiResponse<RecordingMetadata>> {
    try {
      console.log('CameraAPI: Attempting to get info for URI:', file.uri);
      let fileInfo = await FileSystem.getInfoAsync(file.uri);
      let attempts = 0;

      while (!fileInfo.exists && attempts < retryCount) {
        console.warn(`CameraAPI: File not found on attempt ${attempts + 1}. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        fileInfo = await FileSystem.getInfoAsync(file.uri);
        attempts++;
      }
      
      if (!fileInfo.exists) {
        return {
          success: false,
          error: 'Recording file does not exist after multiple attempts',
        };
      }

      // Basic validation
      const maxSize = 100 * 1024 * 1024; // 100MB
      const minSize = 1 * 1024; // 1KB
      
      if (fileInfo.size && fileInfo.size > maxSize) {
        return {
          success: false,
          error: 'Recording file is too large (max 100MB)',
        };
      }

      if (fileInfo.size && fileInfo.size < minSize) {
        return {
          success: false,
          error: 'Recording file is too small or corrupted',
        };
      }

      const metadata: RecordingMetadata = {
        duration: 0, // Will be calculated if needed
        size: fileInfo.size || 0,
        resolution: 'unknown',
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      console.error('CameraAPI: Validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  // Save recording metadata to backend
  async saveRecordingMetadata(
    fileId: string,
    metadata: RecordingMetadata
  ): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/recording/metadata', {
      method: 'POST',
      body: JSON.stringify({
        fileId,
        ...metadata,
      }),
    });
  }

  // Upload thumbnail for video
  async uploadThumbnail(
    videoId: string,
    thumbnailFile: CameraFile
  ): Promise<ApiResponse<any>> {
    try {
      const formData = new FormData();
      
      formData.append('thumbnail', {
        uri: thumbnailFile.uri,
        name: thumbnailFile.name,
        type: 'image/jpeg',
      } as any);

      formData.append('videoId', videoId);

      const token = await this.getAuthToken();
      if (!token) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      const response = await fetch(`${this.baseURL}/api/v1/camera/thumbnail/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Thumbnail upload failed';
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
        data: data,
      };
    } catch (error) {
      console.error('CameraAPI: Thumbnail upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail upload failed',
      };
    }
  }

  // Get camera settings/preferences
  async getCameraSettings(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/settings', {
      method: 'GET',
    });
  }

  // Save camera settings/preferences
  async saveCameraSettings(settings: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Get recording history
  async getRecordingHistory(limit: number = 50): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
    });

    return this.makeRequest<any[]>(
      `/api/v1/camera/recordings?${queryParams.toString()}`,
      {
        method: 'GET',
      }
    );
  }

  // Delete recording from server
  async deleteRecording(recordingId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/v1/camera/recordings/${recordingId}`, {
      method: 'DELETE',
    });
  }

  // Process/compress video (if backend supports it)
  async requestVideoProcessing(
    videoId: string,
    options: CompressionOptions
  ): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/process', {
      method: 'POST',
      body: JSON.stringify({
        videoId,
        options,
      }),
    });
  }

  // Get processing status
  async getProcessingStatus(jobId: string): Promise<ApiResponse<any>> {
    return this.makeRequest(`/api/v1/camera/process/${jobId}/status`, {
      method: 'GET',
    });
  }

  // Upload recording session data (for analytics)
  async uploadSessionData(sessionData: any): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/session', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  // Check storage quota
  async checkStorageQuota(): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/storage/quota', {
      method: 'GET',
    });
  }

  // Generate video preview/GIF
  async generatePreview(videoId: string): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/v1/camera/preview/generate', {
      method: 'POST',
      body: JSON.stringify({ videoId }),
    });
  }

  // Local file management utilities
  async cleanupTempFiles(): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        const videoFiles = files.filter(file => 
          file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')
        );

        for (const file of videoFiles) {
          const filePath = `${cacheDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          // Delete files older than 24 hours
          if (fileInfo.exists && fileInfo.modificationTime) {
            const ageInHours = (Date.now() - fileInfo.modificationTime) / (1000 * 60 * 60);
            if (ageInHours > 24) {
              await FileSystem.deleteAsync(filePath);
              console.log('CameraAPI: Cleaned up temp file:', file);
            }
          }
        }
      }
    } catch (error) {
      console.error('CameraAPI: Cleanup error:', error);
    }
  }

  // Get local cache usage
  async getCacheUsage(): Promise<{ totalSize: number; fileCount: number }> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        return { totalSize: 0, fileCount: 0 };
      }

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      let totalSize = 0;
      let fileCount = 0;

      for (const file of files) {
        if (file.endsWith('.mp4') || file.endsWith('.mov') || file.endsWith('.avi')) {
          const filePath = `${cacheDir}${file}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
            fileCount++;
          }
        }
      }

      return { totalSize, fileCount };
    } catch (error) {
      console.error('CameraAPI: Cache usage calculation error:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }
}

// Create and export a singleton instance
const cameraApiService = new CameraApiService();

export default cameraApiService;

// Export types for use in components
export type {
    ApiResponse,
    CameraFile,
    CompressionOptions,
    RecordingMetadata
};
