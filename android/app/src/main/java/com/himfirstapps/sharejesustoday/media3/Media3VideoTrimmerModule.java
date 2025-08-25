package com.himfirstapps.sharejesustoday.media3;

import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.media.MediaCodec;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;

public class Media3VideoTrimmerModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "Media3VideoTrimmer";
    private final ReactApplicationContext reactContext;
    private final Handler mainHandler;

    public Media3VideoTrimmerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void trimVideo(ReadableMap options, Promise promise) {
        try {
            String inputPath = options.getString("inputUri");
            String outputPath = options.getString("outputUri");
            int startTimeMs = options.getInt("startTimeMs");
            int endTimeMs = options.getInt("endTimeMs");

            // Remove file:// prefix if present and create final variables
            final String finalInputPath = inputPath.startsWith("file://") ? 
                inputPath.substring(7) : inputPath;
            final String finalOutputPath = outputPath.startsWith("file://") ? 
                outputPath.substring(7) : outputPath;

            // Perform trimming in background thread
            new Thread(() -> {
                try {
                    boolean success = performVideoTrim(finalInputPath, finalOutputPath, startTimeMs, endTimeMs);
                    
                    mainHandler.post(() -> {
                        if (success) {
                            WritableMap result = Arguments.createMap();
                            result.putBoolean("success", true);
                            result.putString("outputUri", "file://" + finalOutputPath);
                            result.putString("message", "Video trimmed successfully");
                            promise.resolve(result);
                        } else {
                            promise.reject("TRIM_FAILED", "Video trimming failed");
                        }
                    });
                } catch (Exception e) {
                    mainHandler.post(() -> {
                        promise.reject("TRIM_ERROR", "Error during video trimming: " + e.getMessage(), e);
                    });
                }
            }).start();

        } catch (Exception e) {
            promise.reject("INVALID_PARAMS", "Invalid parameters: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void getVideoInfo(String inputUri, Promise promise) {
        try {
            String inputPath = inputUri.startsWith("file://") ? inputUri.substring(7) : inputUri;
            
            new Thread(() -> {
                try {
                    MediaMetadataRetriever retriever = new MediaMetadataRetriever();
                    retriever.setDataSource(inputPath);
                    
                    String durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    String widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
                    String heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
                    String bitrateStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE);
                    
                    retriever.release();
                    
                    mainHandler.post(() -> {
                        WritableMap info = Arguments.createMap();
                        info.putInt("duration", durationStr != null ? Integer.parseInt(durationStr) : 0);
                        info.putInt("width", widthStr != null ? Integer.parseInt(widthStr) : 0);
                        info.putInt("height", heightStr != null ? Integer.parseInt(heightStr) : 0);
                        info.putInt("bitrate", bitrateStr != null ? Integer.parseInt(bitrateStr) : 0);
                        promise.resolve(info);
                    });
                } catch (Exception e) {
                    mainHandler.post(() -> {
                        promise.reject("VIDEO_INFO_ERROR", "Error getting video info: " + e.getMessage(), e);
                    });
                }
            }).start();
            
        } catch (Exception e) {
            promise.reject("INVALID_URI", "Invalid video URI: " + e.getMessage(), e);
        }
    }

    private boolean performVideoTrim(String inputPath, String outputPath, int startTimeMs, int endTimeMs) {
        MediaExtractor extractor = new MediaExtractor();
        MediaMuxer muxer = null;
        
        try {
            // Create output directory if it doesn't exist
            File outputFile = new File(outputPath);
            File outputDir = outputFile.getParentFile();
            if (outputDir != null && !outputDir.exists()) {
                outputDir.mkdirs();
            }

            extractor.setDataSource(inputPath);
            muxer = new MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

            int videoTrackIndex = -1;
            int audioTrackIndex = -1;
            int videoOutputTrackIndex = -1;
            int audioOutputTrackIndex = -1;

            // Find video and audio tracks
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                
                if (mime != null && mime.startsWith("video/") && videoTrackIndex == -1) {
                    videoTrackIndex = i;
                    videoOutputTrackIndex = muxer.addTrack(format);
                } else if (mime != null && mime.startsWith("audio/") && audioTrackIndex == -1) {
                    audioTrackIndex = i;
                    audioOutputTrackIndex = muxer.addTrack(format);
                }
            }

            muxer.start();

            // Process video track
            if (videoTrackIndex >= 0) {
                processTrack(extractor, muxer, videoTrackIndex, videoOutputTrackIndex, 
                           startTimeMs * 1000L, endTimeMs * 1000L);
            }

            // Process audio track
            if (audioTrackIndex >= 0) {
                processTrack(extractor, muxer, audioTrackIndex, audioOutputTrackIndex, 
                           startTimeMs * 1000L, endTimeMs * 1000L);
            }

            return true;

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        } finally {
            try {
                if (muxer != null) {
                    muxer.stop();
                    muxer.release();
                }
                extractor.release();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void processTrack(MediaExtractor extractor, MediaMuxer muxer, 
                             int inputTrackIndex, int outputTrackIndex, 
                             long startTimeUs, long endTimeUs) throws IOException {
        
        extractor.selectTrack(inputTrackIndex);
        extractor.seekTo(startTimeUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);

        ByteBuffer buffer = ByteBuffer.allocate(1024 * 1024); // 1MB buffer
        MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
        
        while (true) {
            int sampleSize = extractor.readSampleData(buffer, 0);
            if (sampleSize < 0) {
                break; // End of track
            }

            long presentationTimeUs = extractor.getSampleTime();
            
            // Stop if we've passed the end time
            if (presentationTimeUs > endTimeUs) {
                break;
            }

            // Only write samples within our time range
            if (presentationTimeUs >= startTimeUs) {
                // Adjust timestamp to start from 0
                long adjustedTimeUs = presentationTimeUs - startTimeUs;
                
                bufferInfo.offset = 0;
                bufferInfo.size = sampleSize;
                bufferInfo.flags = extractor.getSampleFlags();
                bufferInfo.presentationTimeUs = adjustedTimeUs;

                muxer.writeSampleData(outputTrackIndex, buffer, bufferInfo);
            }

            extractor.advance();
        }

        extractor.unselectTrack(inputTrackIndex);
    }
}