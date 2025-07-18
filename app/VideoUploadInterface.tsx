// Corrected VideoUploadInterface.tsx
import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VideoTrimmer from './VideoTrimmer';
import videoApiService from '../services/videoApiService';

const { width, height } = Dimensions.get('window');

// Standardized VideoFile interface
interface VideoFile {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string; // Alternative naming from DocumentPicker
}

interface VideoUploadInterfaceProps {
  initialVideo?: VideoFile; // Video from camera recording
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
  const [trimEnd, setTrimEnd] = useState(30);
  const [needsTrimming, setNeedsTrimming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<Video | null>(null);

  // Effect to handle the initial video passed via props
  React.useEffect(() => {
    if (initialVideo?.uri) {
      console.log('VideoUploadInterface - Setting initial video:', initialVideo);
      setSelectedVideo(initialVideo);
    }
  }, [initialVideo]);

  // Resets all video-related state.
  // Crucial for ensuring a clean slate when a new video is selected.
  const resetVideoState = () => {
    console.log('Resetting all video state.');
    setVideoTitle('');
    setVideoCaption('');
    setVideoDuration(0);
    setNeedsTrimming(false);
    setTrimStart(0);
    setTrimEnd(30);
    setIsPlaying(false);
    if (videoRef.current) {
        videoRef.current.unloadAsync();
    }
  };

  const handleSelectVideo = async () => {
    try {
      console.log('VideoUploadInterface - Starting video selection...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      console.log('VideoUploadInterface - DocumentPicker result:', result);

      if (!result.canceled && result.assets?.[0]?.uri) {
        // *** FIX: Reset all previous state before setting the new video.
        // This prevents issues like keeping the old title or trimming status.
        resetVideoState();

        const asset = result.assets[0];
        console.log('VideoUploadInterface - Selected asset:', asset);

        const videoFile: VideoFile = {
          uri: asset.uri,
          name: asset.name || `video_${Date.now()}.mp4`,
          type: asset.mimeType || 'video/mp4',
        };

        console.log('VideoUploadInterface - Setting new video file:', videoFile);
        setSelectedVideo(videoFile);
      } else {
        console.log('VideoUploadInterface - Video selection cancelled');
      }
    } catch (error) {
      console.error('VideoUploadInterface - Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  };

  // This function now handles all playback status updates, not just the initial load.
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Video is not loaded or has unloaded.
      return;
    }

    // Set playing status
    setIsPlaying(status.isPlaying);

    // When the video finishes playing, seek to the beginning.
    if (status.didJustFinish) {
        videoRef.current?.setPositionAsync(0);
    }

    // *** FIX: Only set duration and trimming info ONCE on initial load.
    // We check if videoDuration is 0 to ensure this only runs once per video.
    if (videoDuration === 0 && status.durationMillis) {
        const durationSeconds = status.durationMillis / 1000;
        console.log(`Video loaded. Duration: ${durationSeconds}s`);
        setVideoDuration(durationSeconds);
        
        if (durationSeconds > 30.1) {
            console.log('Video needs trimming.');
            setNeedsTrimming(true);
            setTrimEnd(30);
        } else {
            console.log('Video is within the duration limit.');
            setNeedsTrimming(false);
            setTrimEnd(durationSeconds);
        }
    }
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    console.log('VideoUploadInterface - Trim save:', { startTime, endTime, outputPath });
    
    setTrimStart(startTime);
    setTrimEnd(endTime);
    
    // Update the selected video to use the new trimmed output URI
    if (outputPath && selectedVideo) {
      const updatedVideo: VideoFile = {
        ...selectedVideo,
        uri: outputPath,
      };
      
      console.log('VideoUploadInterface - Updated video after trim:', updatedVideo);
      setSelectedVideo(updatedVideo);
    }
    
    // After trimming, the video no longer "needs trimming"
    setNeedsTrimming(false); 
    setShowTrimmer(false);
    
    // Update video duration to reflect the new trimmed length
    setVideoDuration(endTime - startTime);
  };

    const handleTrimChange = (startTime: number, endTime: number) => {
    // This function receives live updates from the trimmer component.
    console.log('VideoUploadInterface - Trim values changing:', { startTime, endTime });
    setTrimStart(startTime);
    setTrimEnd(endTime);
  };

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert('Error', 'Please enter a video title');
      return;
    }

    if (!selectedVideo?.uri) {
      Alert.alert('Error', 'Please select a video');
      return;
    }

    // This check is redundant due to the button's disabled state, but it's good practice.
    if (needsTrimming) {
        Alert.alert('Error', 'Please trim the video before uploading.');
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
        wasTrimmed: trimStart > 0 || trimEnd < videoDuration,
        // You can add more metadata if needed
      };

      console.log('VideoUploadInterface - Uploading video:', videoFile);
      console.log('VideoUploadInterface - With metadata:', metadata);

      const response = await videoApiService.uploadVideo(videoFile, metadata);
      
      if (response.success) {
        Alert.alert('Success', 'Video uploaded successfully!', [
          { text: 'OK', onPress: () => onComplete(response.data) }
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to upload video');
      }
    } catch (error) {
      console.error('VideoUploadInterface - Upload error:', error);
      Alert.alert('Error', 'Failed to upload video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
        videoRef.current.pauseAsync();
    } else {
        videoRef.current.playAsync();
    }
  };

  const renderVideoPreview = () => {
    if (!selectedVideo?.uri) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="film-outline" size={80} color="#cccccc" />
          <Text style={styles.placeholderText}>Select a video to begin</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: selectedVideo.uri }}
          style={styles.video}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        />
        <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" />
        </TouchableOpacity>
        <Text style={styles.uriText} numberOfLines={1}>
          URI: {selectedVideo.uri.split('/').pop()}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Video</Text>
        <View style={styles.placeholder} />
      </View>

      <TouchableOpacity 
        style={styles.selectVideoButton}
        onPress={handleSelectVideo}
        disabled={isLoading}
      >
        <Text style={styles.selectVideoText}>
          {selectedVideo ? 'SELECT A DIFFERENT VIDEO' : 'SELECT VIDEO FROM LIBRARY'}
        </Text>
      </TouchableOpacity>

      <View style={styles.previewSection}>
        {renderVideoPreview()}
        
        {needsTrimming && !showTrimmer && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              Video is longer than 30 seconds. Please trim it to continue.
            </Text>
            <TouchableOpacity 
              style={styles.trimButton}
              onPress={() => {
                if (selectedVideo?.uri) {
                  console.log('VideoUploadInterface - Opening trimmer for:', selectedVideo.uri);
                  setShowTrimmer(true);
                } else {
                  Alert.alert('Error', 'Cannot trim. No valid video has been selected.');
                }
              }}
            >
              <Text style={styles.trimButtonText}>TRIM VIDEO</Text>
            </TouchableOpacity>
          </View>
        )}

        {!needsTrimming && videoDuration > 0 && (
          <Text style={styles.durationText}>
            Duration: {Math.floor(videoDuration)}s ✓ (Ready to upload)
          </Text>
        )}
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="e.g., My Awesome Vacation"
          value={videoTitle}
          onChangeText={setVideoTitle}
          editable={!isLoading}
        />
      </View>
      
      {/* Uncomment if you need the caption field */}
      {/*
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Caption (optional)</Text>
        <TextInput
          style={[styles.titleInput, styles.captionInput]}
          placeholder="Enter video caption"
          value={videoCaption}
          onChangeText={setVideoCaption}
          editable={!isLoading}
          multiline
        />
      </View>
      */}

      <View style={styles.uploadSection}>
        <TouchableOpacity 
          style={[
            styles.uploadButton,
            (!selectedVideo?.uri || !videoTitle.trim() || isLoading || needsTrimming) && styles.disabledButton
          ]}
          onPress={handleSave}
          disabled={!selectedVideo?.uri || !videoTitle.trim() || isLoading || needsTrimming}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>UPLOAD</Text>
          )}
        </TouchableOpacity>
      </View>

      {showTrimmer && selectedVideo?.uri && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <VideoTrimmer
            videoUri={selectedVideo.uri}
            videoDuration={videoDuration}
            maxDuration={30}
            onTrimChange={handleTrimChange}
            onCancel={() => {
              // *** FIX: Simply close the trimmer modal. Do NOT reset the selected video.
              // The user should be able to cancel trimming and still see their
              // long video with the warning, not be forced to re-select it.
              console.log('Trimmer cancelled by user.');
              setShowTrimmer(false);
            }}
            onSave={handleTrimSave}
          />
        </Modal>
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
    paddingTop: 50, // Added for notch/status bar
    paddingBottom: 15,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    position: 'relative',
    borderColor: '#ddd',
    borderWidth: 1,
  },
  video: {
    width: '100%',
    height: 200,
  },
  videoPlaceholder: {
    backgroundColor: '#f0f0f0',
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
    borderRadius: 30,
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
    borderRadius: 4,
    fontFamily: 'monospace',
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
    fontWeight: '500',
  },
  durationText: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '500',
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
    marginTop: 'auto', // Push to bottom
    marginBottom: 40,
  },
  uploadButton: {
    backgroundColor: '#4A90E0',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0,
  },
});

export default VideoUploadInterface;
