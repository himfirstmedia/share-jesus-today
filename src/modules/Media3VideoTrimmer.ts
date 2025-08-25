// src/modules/Media3VideoTrimmer.ts
import { NativeModules } from 'react-native';

export interface VideoTrimOptions {
  inputUri: string;
  outputUri: string;
  startTimeMs: number;
  endTimeMs: number;
}

export interface VideoTrimResult {
  success: boolean;
  outputUri: string;
  message: string;
}

export interface VideoInfo {
  duration: number; // milliseconds
  width: number;
  height: number;
  bitrate: number;
}

export interface Media3VideoTrimmerInterface {
  /**
   * Trim a video file using Android's native MediaMuxer
   * @param options Trimming options
   * @returns Promise with result
   */
  trimVideo(options: VideoTrimOptions): Promise<VideoTrimResult>;

  /**
   * Get video file information
   * @param inputUri Path to video file
   * @returns Promise with video info
   */
  getVideoInfo(inputUri: string): Promise<VideoInfo>;
}

const { Media3VideoTrimmer } = NativeModules;

if (!Media3VideoTrimmer) {
  throw new Error('Media3VideoTrimmer native module is not available');
}

export default Media3VideoTrimmer as Media3VideoTrimmerInterface;