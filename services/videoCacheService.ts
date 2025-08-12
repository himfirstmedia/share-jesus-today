import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.cacheDirectory + 'video-cache/';

class VideoCacheService {
  constructor() {
    // The constructor is now empty as we are not using caching.
  }

  /**
   * Returns the remote URL for direct streaming, bypassing any cache logic.
   * @param remoteUrl The remote URL of the video.
   * @returns A promise that resolves to the remote URL.
   */
  async getVideoUriForPlayback(remoteUrl: string): Promise<string> {
    console.log(`[Cache Disabled] Streaming directly from: ${remoteUrl}`);
    return remoteUrl;
  }

  /**
   * This function is now a no-op as caching is disabled.
   * @param remoteUrl The remote URL of the video.
   * @returns A promise that resolves to the remote URL.
   */
  async startCachingVideo(remoteUrl: string): Promise<string> {
    // Caching is disabled, so we do nothing and return the remote URL.
    return remoteUrl;
  }

  /**
   * Returns null as caching is disabled.
   * @param remoteUrl The remote URL of the video.
   * @returns A promise that resolves to null.
   */
  async getCachedVideoUri(remoteUrl: string): Promise<string | null> {
    return null;
  }
}

const videoCacheService = new VideoCacheService();
export default videoCacheService;
