import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.cacheDirectory + 'video-cache/';

// A map to track ongoing downloads to prevent duplicate requests
const ongoingDownloads = new Map<string, Promise<string>>();

/**
 * Ensures the cache directory exists on the device.
 */
const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
};

/**
 * Generates a consistent local file path from a remote URL.
 */
const getFilePath = (url: string) => {
  const filename = url.split('/').pop()?.replace(/[^a-zA-Z0-9.-]/g, '_') || `video_${Date.now()}`;
  return CACHE_DIR + filename;
};

class VideoCacheService {
  constructor() {
    // Calling async code in a constructor is an anti-pattern.
    // We will ensure the directory exists just-in-time.
  }

  /**
   * Checks if a video is already cached and returns its local URI.
   * @param remoteUrl The remote URL of the video.
   * @returns The local file URI if cached, otherwise null.
   */
  async getCachedVideoUri(remoteUrl: string): Promise<string | null> {
    const filePath = getFilePath(remoteUrl);
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists ? filePath : null;
  }

  /**
   * Starts caching a video from a remote URL. This is the main function to call.
   * It won't re-download if the video is already cached or if a download is in progress.
   * @param remoteUrl The remote URL of the video to cache.
   * @returns A promise that resolves to the local file URI.
   */
  async startCachingVideo(remoteUrl: string): Promise<string> {
    // Ensure the cache directory exists before any operation.
    await ensureDirExists();

    const cachedUri = await this.getCachedVideoUri(remoteUrl);
    if (cachedUri) {
      console.log(`[Cache] Hit for: ${remoteUrl}`);
      return cachedUri;
    }

    if (ongoingDownloads.has(remoteUrl)) {
      console.log(`[Cache] Download already in progress for: ${remoteUrl}`);
      return ongoingDownloads.get(remoteUrl)!;
    }

    const filePath = getFilePath(remoteUrl);
    console.log(`[Cache] Miss, starting download: ${remoteUrl}`);
    
    const downloadPromise = (async () => {
      try {
        const { uri } = await FileSystem.downloadAsync(remoteUrl, filePath);
        console.log(`[Cache] Download successful, stored at: ${uri}`);
        return uri;
      } catch (e) {
        console.error('[Cache] Download error:', e);
        throw new Error(`Failed to download video: ${remoteUrl}`);
      } finally {
        ongoingDownloads.delete(remoteUrl);
      }
    })();

    ongoingDownloads.set(remoteUrl, downloadPromise);
    return downloadPromise;
  }
}

const videoCacheService = new VideoCacheService();
export default videoCacheService;