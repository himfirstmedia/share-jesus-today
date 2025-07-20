// Enhanced VideoUploadInterface.tsx optimized for expo-video
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import videoApiService from '../services/videoApiService';
import { t } from '../utils/i18n';
import VideoTrimmer from './VideoTrimmer';

const { width, height } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30; // 30 seconds

// --- Utility Functions ---

// Initializes the directory where videos will be stored.
const initializeVideoFilesDirectory = async () => {
  try {
    const videoFilesDirectory = `${FileSystem.documentDirectory}videofiles/`;
    await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
    console.log(`LOG: videofiles directory initialized: ${videoFilesDirectory}`);
    return videoFilesDirectory;
  } catch (error: any) {
    console.error('ERROR: Failed to initialize videofiles directory:', error.message);
    throw error;
  }
};

// Copies the selected video to a persistent location.
const ensureVideoIsPersistent = async (temporaryUri: string): Promise<string> => {
  try {
    const videoFilesDirectory = await initializeVideoFilesDirectory();
    const fileName = `video_${Date.now()}.mp4`;
    const permanentUri = `${videoFilesDirectory}${fileName}`;
    
    console.log(`LOG: Copying video from ${temporaryUri} to ${permanentUri}`);
    await FileSystem.copyAsync({
      from: temporaryUri,
      to: permanentUri,
    });

    const fileInfo = await FileSystem.getInfoAsync(permanentUri, { size: true });
    if (!fileInfo.exists || !fileInfo.size) {
      throw new Error('Failed to copy video to persistent storage or file is empty.');
    }

    console.log(`LOG: Video copied successfully. New URI: ${permanentUri}`);
    return permanentUri;
  } catch (error: any) {
    console.error('ERROR: Failed to make video persistent:', error.message);
    throw error;
  }
};

// Standardized VideoFile interface
interface VideoFile {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string;
}

interface VideoUploadInterfaceProps {
  initialVideo?: VideoFile;
  onCancel: () => void;
  onComplete: (videoData?: any) => void;
}

const VideoUploadInterface: React.FC<VideoUploadInterfaceProps> = ({ 
  initialVideo, 
  onCancel, 
  onComplete 
}) => {
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(initialVideo || null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoCaption, setVideoCaption] = useState('');
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_VIDEO_DURATION);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [hasBeenTrimmed, setHasBeenTrimmed] = useState(false);
  const [originalDuration, setOriginalDuration] = useState(0); // Track original duration
  
  // Create video player instance with proper expo-video hooks
  const player = useVideoPlayer(selectedVideo?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Debug logging
  React.useEffect(() => {
    console.log('VideoUploadInterface - selectedVideo state:', selectedVideo);
    if (selectedVideo) {
      console.log('VideoUploadInterface - selectedVideo.uri:', selectedVideo.uri);
    }
  }, [selectedVideo]);

  // Initialize with recorded video if provided
  React.useEffect(() => {
    if (initialVideo) {
      console.log('VideoUploadInterface - Setting initial video:', initialVideo);
      
      if (initialVideo.uri) {
        setSelectedVideo(initialVideo);
      } else {
        console.error('VideoUploadInterface - Initial video has no URI:', initialVideo);
        Alert.alert('Error', 'The provided video file has no valid URI');
      }
    }
  }, [initialVideo]);

  // Handle video player status changes
  React.useEffect(() => {
    if (!player || !selectedVideo || showTrimmer) return; // Don't process if trimmer is open

    const subscription = player.addListener('statusChange', (status) => {
      console.log('Video player status:', status);
      console.log('Current state - hasBeenTrimmed:', hasBeenTrimmed, 'originalDuration:', originalDuration, 'showTrimmer:', showTrimmer);
      
      // Check if video is ready to play
      if (status.status === 'readyToPlay' && !videoLoaded && !showTrimmer) {
        setVideoLoaded(true);
        
        // Get duration from player directly
        const durationSeconds = player.duration || 0;
        console.log('Video duration from player:', durationSeconds);
        
        setVideoDuration(durationSeconds);
        
        // Only check for trimming needs if this is a new video that hasn't been trimmed
        // and we don't already have an original duration set
        if (!hasBeenTrimmed && originalDuration === 0 && durationSeconds > MAX_VIDEO_DURATION + 0.1) {
          console.log('Video needs trimming - setting up trim state');
          setOriginalDuration(durationSeconds); // Store the original duration
          setNeedsTrimming(true);
          setTrimEnd(MAX_VIDEO_DURATION);
        } else if (!hasBeenTrimmed && originalDuration === 0) {
          // Video is within acceptable duration
          console.log('Video is within acceptable duration');
          setOriginalDuration(durationSeconds);
          setNeedsTrimming(false);
          setTrimEnd(durationSeconds);
        } else if (hasBeenTrimmed) {
          // This is a trimmed video, don't trigger trimming again
          console.log('Video has been trimmed, not checking for trim needs');
          setNeedsTrimming(false);
          setTrimEnd(durationSeconds);
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [player, videoLoaded, hasBeenTrimmed, originalDuration, selectedVideo, showTrimmer]);

  const handleSelectVideo = async () => {
    try {
      console.log('VideoUploadInterface - Starting video selection...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      console.log('VideoUploadInterface - DocumentPicker result:', result);

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        console.log('VideoUploadInterface - Selected asset:', asset);

        if (!asset.uri) {
          throw new Error('No URI in selected video');
        }

        // Ensure the video is in a persistent location
        const persistentUri = await ensureVideoIsPersistent(asset.uri);

        const videoFile: VideoFile = {
          uri: persistentUri,
          name: asset.name || `video_${Date.now()}.mp4`,
          type: asset.mimeType || 'video/mp4',
        };

        console.log('VideoUploadInterface - Setting video file:', videoFile);
        
        // Reset all states for new video
        setHasBeenTrimmed(false);
        setOriginalDuration(0);
        setNeedsTrimming(false);
        setVideoLoaded(false);
        setVideoDuration(0);
        setTrimStart(0);
        setTrimEnd(MAX_VIDEO_DURATION);
        
        setSelectedVideo(videoFile);
      } else {
        console.log('VideoUploadInterface - Video selection cancelled');
      }
    } catch (error) {
      console.error('VideoUploadInterface - Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video. Please check your permissions and try again.');
    }
  };

  const handleTrimChange = (startTime: number, endTime: number) => {
    console.log('VideoUploadInterface - Trim change:', startTime, endTime);
    setTrimStart(startTime);
    setTrimEnd(endTime);
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    console.log('VideoUploadInterface - Trim save:', { startTime, endTime, outputPath });
    
    if (!outputPath) {
      Alert.alert('Error', 'Trimming failed to produce an output file. Please try again.');
      setShowTrimmer(false);
      return;
    }
    
    if (selectedVideo) {
      const updatedVideo: VideoFile = {
        ...selectedVideo,
        uri: outputPath,
        name: selectedVideo.name || `trimmed_video_${Date.now()}.mp4`,
        type: selectedVideo.type || 'video/mp4',
      };
      
      console.log('VideoUploadInterface - Updated video after trim:', updatedVideo);
      
      // Mark as trimmed and prevent further trimming checks
      setHasBeenTrimmed(true);
      setNeedsTrimming(false);
      setShowTrimmer(false);
      setVideoLoaded(false); // Reset to reload trimmed video
      
      // Since the native trimmer doesn't provide actual trim times,
      // we'll let the video player determine the new duration
      // But we can estimate based on maxDuration if needed
      if (startTime === 0 && endTime === 0) {
        // Native trimmer doesn't provide times, estimate based on max duration
        const estimatedDuration = Math.min(originalDuration || videoDuration, MAX_VIDEO_DURATION);
        setVideoDuration(estimatedDuration);
        setTrimStart(0);
        setTrimEnd(estimatedDuration);
      } else {
        // Use provided times
        setTrimStart(startTime);
        setTrimEnd(endTime);
        const newDuration = endTime > 0 ? endTime - startTime : 0;
        setVideoDuration(newDuration);
      }
      
      setSelectedVideo(updatedVideo);
    }
  };

  const handleTrimCancel = () => {
    console.log('VideoUploadInterface - Trim cancelled');
    setShowTrimmer(false);
    // Don't reset hasBeenTrimmed or other states, just close the trimmer
  };

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player]);

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert('Error', 'Please enter a video title');
      return;
    }

    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert('Error', 'Please select a video with a valid URI');
      return;
    }

    setIsLoading(true);
    
    try {
      const videoFile = {
        uri: selectedVideo.uri,
        name: selectedVideo.name || `video_${Date.now()}.mp4`,
        type: selectedVideo.type || 'video/mp4',
      };

      const metadata = {
        name: videoFile.name,
        title: videoTitle.trim(),
        caption: videoCaption.trim(),
        originalDuration: originalDuration || videoDuration,
        trimStart: trimStart,
        trimEnd: trimEnd,
        wasTrimmed: hasBeenTrimmed,
      };

      console.log('VideoUploadInterface - Uploading video:', videoFile);
      console.log('VideoUploadInterface - With metadata:', metadata);

      // The videoApiService is expected to handle the actual upload
      // and return a promise that resolves with the server's response.
      const response = await videoApiService.uploadVideo(videoFile, metadata);
      
      if (response.success) {
        Alert.alert('Success', 'Video uploaded successfully!', [
          // The onComplete callback is called with the response data
          // to notify the parent component of the successful upload.
          { text: 'OK', onPress: () => onComplete(response.data) }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to upload video');
      }
    } catch (error) {
      console.error('VideoUploadInterface - Upload error:', error);
      Alert.alert('Error', 'An unexpected error occurred during upload. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderVideoPreview = () => {
    if (!selectedVideo || !selectedVideo.uri) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={80} color="#4A90E2" />
          <Text style={styles.placeholderText}>No video selected</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          nativeControls={false}
          contentFit="contain"
        />
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons 
            name={player?.playing ? "pause" : "play"} 
            size={40} 
            color="white" 
          />
        </TouchableOpacity>
        <Text style={styles.uriText} numberOfLines={1}>
          {selectedVideo.uri}
        </Text>
        {!videoLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        )}
      </View>
    );
  };

  // Cleanup player on unmount
  React.useEffect(() => {
    return () => {
      if (player) {
        player.release();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Video To Upload</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Select Video Button */}
      <TouchableOpacity 
        style={styles.selectVideoButton}
        onPress={handleSelectVideo}
        disabled={isLoading}
      >
        <Text style={styles.selectVideoText}>
          {selectedVideo ? 'SELECT DIFFERENT VIDEO' : 'SELECT VIDEO'}
        </Text>
      </TouchableOpacity>

      {/* Video Preview */}
      <View style={styles.previewSection}>
        {renderVideoPreview()}
        
        {videoDuration > 0 && (
          needsTrimming && !showTrimmer ? (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                Video is longer than {MAX_VIDEO_DURATION} seconds. Please trim.
              </Text>
              <TouchableOpacity 
                style={styles.trimButton}
                onPress={() => {
                  if (selectedVideo && selectedVideo.uri) {
                    console.log('VideoUploadInterface - Opening trimmer for:', selectedVideo.uri);
                    setShowTrimmer(true);
                  } else {
                    Alert.alert('Error', 'No valid video URI to trim');
                  }
                }}
              >
                <Text style={styles.trimButtonText}>TRIM VIDEO</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.durationText}>
              Duration: {Math.floor(videoDuration)}s ✓
              {hasBeenTrimmed && ' (Trimmed)'}
            </Text>
          )
        )}
      </View>

      {/* Title Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Title:</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Enter Title"
          value={videoTitle}
          onChangeText={setVideoTitle}
          editable={!isLoading}
        />
      </View>

      {/* Caption Input - Commented out but available */}
      {/*
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Caption (optional):</Text>
        <TextInput
          style={[styles.titleInput, styles.captionInput]}
          placeholder="Enter video caption"
          value={videoCaption}
          onChangeText={setVideoCaption}
          editable={!isLoading}
          multiline
          numberOfLines={3}
        />
      </View>
      */}

      {/* Upload Button */}
      <View style={styles.uploadSection}>
        <TouchableOpacity 
          style={[
            styles.uploadButton,
            (!selectedVideo || !selectedVideo.uri || !videoTitle.trim() || isLoading || needsTrimming) && styles.disabledButton
          ]}
          onPress={handleSave}
          disabled={!selectedVideo || !selectedVideo.uri || !videoTitle.trim() || isLoading || needsTrimming}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>{t('videouploadinterface.savevideo')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 
        The VideoTrimmer component is expected to be implemented in a separate file.
        It should take the video URI, duration, and max duration as props,
        and provide callbacks for trim changes, cancellation, and saving.
      */}
      {showTrimmer && selectedVideo && selectedVideo.uri && (
        <VideoTrimmer
          videoUri={selectedVideo.uri}
          maxDuration={MAX_VIDEO_DURATION}
          onCancel={handleTrimCancel}
          onSave={handleTrimSave}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  selectVideoButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectVideoText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  videoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    backgroundColor: 'white',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    marginBottom: 15,
  },
  placeholderText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uriText: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 10,
    padding: 4,
    fontFamily: 'monospace',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  durationText: {
    color: '#28a745',
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  trimButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  trimButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  captionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#4A90E0',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    opacity: 0.7,
  },
});

export default VideoUploadInterface;