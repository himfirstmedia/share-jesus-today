import * as FileSystem from 'expo-file-system';
import { FFmpegKit, FFmpegKitConfig, ReturnCode } from 'expo-ffmpeg-kit';

// --- Type Definitions ---
type ExistingVideoInfo = {
  uri: string;
  exists: true;
  size: number;
  sizeMB: number;
};

type NonExistingVideoInfo = {
  uri: string;
  exists: false;
};

type VideoInfo = ExistingVideoInfo | NonExistingVideoInfo;

interface CompressionOptions {
  maxSizeMB?: number;
  progressCallback?: (progress: number) => void;
}

// --- Helper Functions ---
const getCleanPath = (uri: string): string => {
  return uri.replace(/^file:\/\//, '');
};

const initializeVideoFilesDirectory = async (): Promise<string> => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    return videoFilesDirectory;
  } catch (error) {
    console.error('ERROR: Failed to initialize videofiles directory:', error);
    throw error;
  }
};

class FfmpegCompressionService {
  public async getVideoInfo(uri: string): Promise<VideoInfo> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists || fileInfo.size === 0) {
        return { uri, exists: false };
      }
      return {
        uri,
        exists: true,
        size: fileInfo.size,
        sizeMB: Math.round((fileInfo.size / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      console.error('ERROR: Failed to get video info:', error);
      return { uri, exists: false };
    }
  }

  public async createCompressedCopy(sourceUri: string, options: CompressionOptions = {}): Promise<string> {
    const { maxSizeMB = 15, progressCallback } = options;

    try {
      const sourceInfo = await this.getVideoInfo(sourceUri);
      if (!sourceInfo.exists) {
        console.error('ERROR: Source video not found:', sourceUri);
        return sourceUri;
      }

      if (sourceInfo.sizeMB <= maxSizeMB) {
        console.log(`LOG: Video size (${sourceInfo.sizeMB}MB) already within target range`);
        return sourceUri;
      }

      console.log(`LOG: Starting FFmpeg compression: ${sourceInfo.sizeMB}MB -> target: ~${maxSizeMB}MB`);

      const videoFilesDirectory = await initializeVideoFilesDirectory();
      const compressedUri = `${videoFilesDirectory}compressed_${Date.now()}.mp4`;
      const cleanInputPath = getCleanPath(sourceUri);
      const cleanOutputPath = getCleanPath(compressedUri);

      // This is a basic command. For more advanced use cases, you might need two-pass encoding
      // to hit a specific target size. For now, we use CRF for a good quality/size balance.
      // A higher CRF value means lower quality and smaller file size. 28 is a reasonable value.
      const command = `-i "${cleanInputPath}" -c:v libx264 -crf 28 -preset ultrafast -c:a aac -b:a 128k "${cleanOutputPath}"`;

      console.log('Executing FFmpeg command:', command);

      // expo-ffmpeg-kit provides a way to handle progress, but for now we will keep it simple.
      // The `execute` method is asynchronous and we can await it.
      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (ReturnCode.isSuccess(returnCode)) {
        if (progressCallback) {
          progressCallback(1); // Indicate completion
        }
        const compressedInfo = await this.getVideoInfo(compressedUri);
        if (!compressedInfo.exists) {
          throw new Error('Compressed file verification failed');
        }
        console.log(`LOG: FFmpeg compression successful! ${sourceInfo.sizeMB}MB -> ${compressedInfo.sizeMB}MB`);
        return compressedUri;
      } else {
        const logs = await session.getOutput();
        console.error('FFmpeg compression failed. Logs:', logs);
        throw new Error(`FFmpeg process failed with return code ${await returnCode.getValue()}.`);
      }
    } catch (error: any) {
      console.error('ERROR: Compression process failed:', error.message);
      return sourceUri; // Return original URI on failure
    }
  }
}

export default new FfmpegCompressionService();
