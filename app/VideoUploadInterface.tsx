import { Ionicons } from '@expo/vector-icons';
import { t } from '@/utils/i18';
import * as DocumentPicker from 'expo-document-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useState } from 'react';
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
import videoApiService from '../services/videoApiService';
import VideoTrimmer from './VideoTrimmer';

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
  isFromRecording?: boolean; // New prop to indicate if the video came from recording
}

const VideoUploadInterface: React.FC<VideoUploadInterfaceProps> = ({
  initialVideo,
  onCancel,
  onComplete,
  isFromRecording = false, // Default to false
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

  // Create video player instance
  const player = useVideoPlayer(selectedVideo?.uri || '', (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Debug logging to track video state
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

      // Ensure we have a proper video object with uri
      if (initialVideo.uri) {
        setSelectedVideo(initialVideo);
      } else {
        console.error('VideoUploadInterface - Initial video has no URI:', initialVideo);
        Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertInvalidUri'));
      }
    }
  }, [initialVideo]);

  // Update player source when video changes
// Update player source when video changes
React.useEffect(() => {
  if (selectedVideo?.uri) {
    player.replace(selectedVideo.uri);
  }
}, [selectedVideo?.uri, player]); // ✅ Added 'player' to dependency array

  // Listen to player events
// Listen to player events
// Listen to player events
React.useEffect(() => {
  const statusSubscription = player.addListener('statusChange', (status) => {
    console.log('VideoUploadInterface - Player status:', status);
    
    // Access duration when video is ready
    if (status.status === 'readyToPlay' && player.duration) {
      const durationSeconds = player.duration;
      setVideoDuration(durationSeconds);

      if (durationSeconds > 31) {
        setNeedsTrimming(true);
        setTrimEnd(30);
      } else {
        setNeedsTrimming(false);
        setTrimEnd(durationSeconds);
      }
    }
  });

  // ✅ CORRECTED: Listen to playing state changes using the correct event
  const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
    console.log('VideoUploadInterface - Playing state changed:', isPlaying);
    setIsPlaying(isPlaying);
  });

  return () => {
    statusSubscription?.remove();
    playingSubscription?.remove();
  };
}, [player]);
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

        // Ensure we have a valid URI
        if (!asset.uri) {
          throw new Error('No URI in selected video');
        }

        const videoFile: VideoFile = {
          uri: asset.uri,
          name: asset.name || `video_${Date.now()}.mp4`,
          type: asset.mimeType || 'video/mp4',
        };

        console.log('VideoUploadInterface - Setting video file:', videoFile);
        setSelectedVideo(videoFile);
      } else {
        console.log('VideoUploadInterface - Video selection cancelled');
      }
    } catch (error) {
      console.error('VideoUploadInterface - Error selecting video:', error);
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertFailedSelectVideo'));
    }
  };

  const handleTrimChange = (startTime: number, endTime: number) => {
    console.log('VideoUploadInterface - Trim change:', startTime, endTime);
    setTrimStart(startTime);
    setTrimEnd(endTime);
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    console.log('VideoUploadInterface - Trim save:', { startTime, endTime, outputPath });

    setTrimStart(startTime);
    setTrimEnd(endTime);

    // Update the selected video to use the trimmed output
    if (outputPath && selectedVideo) {
      const updatedVideo: VideoFile = {
        ...selectedVideo,
        uri: outputPath,
        name: selectedVideo.name || `trimmed_video_${Date.now()}.mp4`,
        type: selectedVideo.type || 'video/mp4',
      };

      console.log('VideoUploadInterface - Updated video after trim:', updatedVideo);
      setSelectedVideo(updatedVideo);
    }

    setNeedsTrimming(false);
    setShowTrimmer(false);

    // Update video duration to reflect the trimmed length
    setVideoDuration(endTime - startTime);
  };

  const handleSave = async () => {
    if (!videoTitle.trim()) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertEnterTitle'));
      return;
    }

    if (!selectedVideo || !selectedVideo.uri) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertSelectVideoUri'));
      return;
    }

    setIsLoading(true);

    try {
      // Prepare video file for upload using your existing service
      const videoFile = {
        uri: selectedVideo.uri,
        name: selectedVideo.name || `video_${Date.now()}.mp4`,
        type: selectedVideo.type || 'video/mp4',
      };

      const metadata = {
        name: videoFile.name,
        title: videoTitle.trim(),
        caption: videoCaption.trim(),
        // Include original duration and trim info for analytics
        originalDuration: videoDuration,
        trimStart: trimStart,
        trimEnd: trimEnd,
        wasTrimmed: trimStart > 0 || trimEnd < videoDuration,
      };

      console.log('VideoUploadInterface - Uploading video:', videoFile);
      console.log('VideoUploadInterface - With metadata:', metadata);

      // Use your existing video upload service
      const response = await videoApiService.uploadVideo(videoFile, metadata);

      if (response.success) {
        Alert.alert(t('videoUploadInterface.alertSuccess'), t('videoUploadInterface.alertVideoUploaded'), [
          { text: t('alerts.ok'), onPress: () => onComplete(response.data) }
        ]);
      } else {
        Alert.alert(t('videoUploadInterface.alertError'), response.error || t('videoUploadInterface.alertFailedUpload'));
      }
    } catch (error) {
      console.error('VideoUploadInterface - Upload error:', error);
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertFailedUploadTryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const renderVideoPreview = () => {
    if (!selectedVideo || !selectedVideo.uri) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={80} color="#4A90E2" />
          <Text style={styles.placeholderText}>{t('videoUploadInterface.noVideoSelected')}</Text>
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
          <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" />
        </TouchableOpacity>
        <Text style={styles.uriText} numberOfLines={1}>
          {selectedVideo.uri}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { justifyContent: 'center' }]}>
        <Text style={styles.headerTitle}>
          {isFromRecording ? t('videoUploadInterface.postVideoTitle') : t('videoUploadInterface.selectVideoTitle')}
        </Text>
      </View>

      {isFromRecording && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsText}>
            {t('videoUploadInterface.instructions1')}
          </Text>
          <Text style={styles.instructionsText}>
            {t('videoUploadInterface.instructions2')}
          </Text>
        </View>
      )}

      

      {/* Video Preview */}
      <View style={styles.previewSection}>
        {renderVideoPreview()}

        {needsTrimming && !showTrimmer && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              {t('videoUploadInterface.videoTooLong')}
            </Text>
            <TouchableOpacity
              style={styles.trimButton}
              onPress={() => {
                if (selectedVideo && selectedVideo.uri) {
                  console.log('VideoUploadInterface - Opening trimmer for:', selectedVideo.uri);
                  setShowTrimmer(true);
                } else {
                  Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertNoValidUriToTrim'));
                }
              }}
            >
              <Text style={styles.trimButtonText}>{t('videoUploadInterface.trimVideo')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {!needsTrimming && videoDuration > 0 && (
          <Text style={styles.durationText}>
            {t('videoUploadInterface.duration')} {Math.floor(videoDuration)}s ✓
          </Text>
        )}
      </View>

      {/* Title Input */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>{t('videoUploadInterface.titleLabel')}</Text>
        <TextInput
          style={styles.titleInput}
          placeholder={t('videoUploadInterface.enterTitlePlaceholder')}
          value={videoTitle}
          onChangeText={setVideoTitle}
          editable={!isLoading}
        />
      </View>

      {/* Caption Input */}
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
            <>
              <Ionicons name="cloud-upload-outline" size={24} color="white" style={styles.buttonIcon} />
              <Text style={styles.uploadButtonText}>{t('videoUploadInterface.uploadButton')}</Text>
            </>
          )}
        </TouchableOpacity>

        {isFromRecording ? (
          <TouchableOpacity
            style={styles.recordAgainButton}
            onPress={onCancel} // Go back to options to record again
            disabled={isLoading}
          >
            <Ionicons name="camera-outline" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.recordAgainButtonText}>{t('videoUploadInterface.recordAgainButton')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.selectDifferentVideoButtonBottom}
            onPress={handleSelectVideo}
            disabled={isLoading}
          >
            <Ionicons name="folder-open-outline" size={24} color="white" style={styles.buttonIcon} />
            <Text style={styles.selectDifferentVideoButtonBottomText}>{t('videoUploadInterface.selectDifferentVideoButton')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trimmer Modal - Show only if we have a valid video URI */}
      {showTrimmer && selectedVideo && selectedVideo.uri && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <VideoTrimmer
            videoUri={selectedVideo.uri}
            videoDuration={videoDuration}
            maxDuration={30}
            onTrimChange={handleTrimChange}
            onCancel={() => {
              setShowTrimmer(false);
              setSelectedVideo(null);
              setNeedsTrimming(false);
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
  instructionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#e9ecef',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    marginBottom: 10,
  },
  instructionsText: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 20,
  },
  placeholder: {
    width: 34, // Same width as close button for centering
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
    marginTop:20
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
    transform: [{ translateX: -20 }, { translateY: -20 }],
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
    gap: 10, // Add gap for spacing between buttons
  },
  uploadButton: {
    backgroundColor: '#3260ad',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  recordAgainButton: {
    backgroundColor: '#3260ad',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  recordAgainButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  selectDifferentVideoButtonBottom: {
    backgroundColor: '#3260ad',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  selectDifferentVideoButtonBottomText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  buttonIcon: {
    marginRight: 5,
  },
  disabledButton: {
    backgroundColor: '#bdc3c7',
    opacity: 0.7,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default VideoUploadInterface;