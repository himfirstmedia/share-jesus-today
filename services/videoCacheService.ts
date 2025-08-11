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
 * @param url The remote URL.
 * @param temp A boolean to indicate if the temporary file path is needed.
 */
const getFilePath = (url: string, temp: boolean = false) => {
  const filename = url.split('/').pop()?.replace(/[^a-zA-Z0-9.-]/g, '_') || `video_${Date.now()}`;
  return CACHE_DIR + filename + (temp ? '.tmp' : '');
};

class VideoCacheService {
  constructor() {
    ensureDirExists();
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
   * Caches a video from a remote URL. It streams the video if caching fails.
   * It won't re-download if the video is already cached or if a download is in progress.
   * @param remoteUrl The remote URL of the video to cache.
   * @returns A promise that resolves to the local file URI or the remote URL if caching fails.
   */
  async getVideoUri(remoteUrl: string): Promise<string> {
    try {
      const cachedUri = await this.getCachedVideoUri(remoteUrl);
      if (cachedUri) {
        console.log(`[Cache] Hit for: ${remoteUrl}`);
        return cachedUri;
      }

      if (ongoingDownloads.has(remoteUrl)) {
        console.log(`[Cache] Download already in progress for: ${remoteUrl}`);
        return await ongoingDownloads.get(remoteUrl)!;
      }

      const finalFilePath = getFilePath(remoteUrl);
      const tempFilePath = getFilePath(remoteUrl, true);
      console.log(`[Cache] Miss, starting download: ${remoteUrl}`);

      const downloadPromise = (async () => {
        try {
          const { uri } = await FileSystem.downloadAsync(remoteUrl, tempFilePath);
          await FileSystem.moveAsync({ from: uri, to: finalFilePath });
          console.log(`[Cache] Download successful, stored at: ${finalFilePath}`);
          return finalFilePath;
        } catch (e) {
          console.error('[Cache] Download error:', e);
          // If download fails, fall back to streaming the remote URL
          return remoteUrl;
        } finally {
          ongoingDownloads.delete(remoteUrl);
        }
      })();

      ongoingDownloads.set(remoteUrl, downloadPromise);
      return await downloadPromise;
    } catch (error) {
      console.error('[Cache] General error in getVideoUri:', error);
      // Fallback to remote URL in case of any unexpected error
      return remoteUrl;
    }
  }
}

const videoCacheService = new VideoCacheService();
export default videoCacheService;
