import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.cacheDirectory + 'video-cache/';
const MAX_RETRIES = 3;
const RETRY_DELAY = 100; // ms

// A map to track ongoing downloads to prevent duplicate requests
const ongoingDownloads = new Map<string, Promise<string>>();

/**
 * A robust function to ensure the cache directory exists, with retries.
 */
const ensureDirExistsWithRetries = async (attempt = 1): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists && dirInfo.isDirectory) {
      return; // Directory already exists
    }

    console.log(`[Cache] Directory check failed (exists: ${dirInfo.exists}, isDirectory: ${dirInfo.isDirectory}). Creating...`);
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

    // Verify creation
    const newDirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!newDirInfo.exists || !newDirInfo.isDirectory) {
      throw new Error('Cache directory verification failed after creation attempt.');
    }
    console.log('[Cache] Cache directory created and verified.');

  } catch (error) {
    console.error(`[Cache] Error on attempt ${attempt} to ensure directory exists:`, error);
    if (attempt < MAX_RETRIES) {
      console.log(`[Cache] Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return ensureDirExistsWithRetries(attempt + 1);
    } else {
      console.error('[Cache] Max retries reached for directory creation. Giving up.');
      throw error; // Re-throw the error after max retries
    }
  }
};


/**
 * Generates a consistent, unique local file path from a remote URL using a hash.
 */
const getFilePath = (url: string) => {
  const hash = url.split('').reduce((acc, char) => {
    const charCode = char.charCodeAt(0);
    return ((acc << 5) - acc) + charCode;
  }, 0);
  
  const extension = url.split('.').pop()?.split('?')[0] || 'mp4';
  const filename = `${Math.abs(hash)}.${extension}`;
  
  return CACHE_DIR + filename;
};

class VideoCacheService {
  constructor() {
    // Kick off an initial, non-blocking check to create the directory early.
    ensureDirExistsWithRetries().catch(err => {
      console.error("[Cache] Initial directory creation failed on startup:", err);
    });
  }

  /**
   * Checks if a video is already cached and returns its local URI.
   * @param remoteUrl The remote URL of the video.
   * @returns The local file URI if cached, otherwise null.
   */
  async getCachedVideoUri(remoteUrl: string): Promise<string | null> {
    try {
      await ensureDirExistsWithRetries();
      const filePath = getFilePath(remoteUrl);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists ? filePath : null;
    } catch (e) {
      console.error('[Cache] Error checking for cached file:', e);
      return null;
    }
  }

  /**
   * Starts caching a video from a remote URL. This is the main function to call.
   * It won't re-download if the video is already cached or if a download is in progress.
   * @param remoteUrl The remote URL of the video to cache.
   * @returns A promise that resolves to the local file URI.
   */
  async startCachingVideo(remoteUrl: string): Promise<string> {
    const cachedUri = await this.getCachedVideoUri(remoteUrl);
    if (cachedUri) {
      return cachedUri;
    }

    if (ongoingDownloads.has(remoteUrl)) {
      return ongoingDownloads.get(remoteUrl)!;
    }

    const filePath = getFilePath(remoteUrl);
    
    const downloadPromise = (async () => {
      try {
        // Final check before download
        await ensureDirExistsWithRetries();
        console.log(`[Cache] Miss, starting download for ${remoteUrl} to ${filePath}`);
        const { uri } = await FileSystem.downloadAsync(remoteUrl, filePath);
        console.log(`[Cache] Download successful, stored at: ${uri}`);
        return uri;
      } catch (e) {
        console.error(`[Cache] Download failed for ${remoteUrl}:`, e);
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
