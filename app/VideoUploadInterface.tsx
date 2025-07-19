import { t } from '@/utils/i18';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
  React.useEffect(() => {
    if (selectedVideo?.uri) {
      player.replace(selectedVideo.uri);
    }
  }, [selectedVideo?.uri, player]);

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

    // Listen to playing state changes using the correct event
    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => {
      console.log('VideoUploadInterface - Playing state changed:', isPlaying);
      setIsPlaying(isPlaying);
    });

    return () => {
      statusSubscription?.remove();
      playingSubscription?.remove();
    };
  }, [player]);

  // Helper function to copy videos to permanent storage
  const copyToPermanentLocation = async (tempUri: string, originalName: string): Promise<string> => {
    try {
      // Create the videos directory if it doesn't exist
      const videoFilesDirectory = `${FileSystem.documentDirectory}videos/`;
      const dirInfo = await FileSystem.getInfoAsync(videoFilesDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(videoFilesDirectory, { intermediates: true });
      }

      // Generate a unique filename
      const timestamp = Date.now();
      const fileExtension = originalName.split('.').pop() || 'mp4';
      const permanentFileName = `selected_video_${timestamp}.${fileExtension}`;
      const permanentPath = `${videoFilesDirectory}${permanentFileName}`;

      console.log('Copying video from temp to permanent location:');
      console.log('From:', tempUri);
      console.log('To:', permanentPath);

      // Copy the file to permanent storage
      await FileSystem.copyAsync({
        from: tempUri,
        to: permanentPath,
      });

      // Verify the copied file exists and is valid
      const copiedFileInfo = await FileSystem.getInfoAsync(permanentPath);
      if (!copiedFileInfo.exists || copiedFileInfo.isDirectory || !copiedFileInfo.size) {
        throw new Error('Failed to copy video file to permanent storage');
      }

      console.log('Video copied successfully:', {
        path: permanentPath,
        size: copiedFileInfo.size,
        exists: copiedFileInfo.exists
      });

      return permanentPath;
    } catch (error) {
      console.error('Failed to copy video to permanent location:', error);
      throw new Error('Failed to save video to permanent storage');
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

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        console.log('VideoUploadInterface - Selected asset:', asset);

        // Create a permanent copy of the video file
        const permanentVideoUri = await copyToPermanentLocation(asset.uri, asset.name || 'selected_video.mp4');

        const videoFile: VideoFile = {
          uri: permanentVideoUri,
          name: asset.name || 'selected_video.mp4',
          type: asset.mimeType || 'video/mp4',
        };

        console.log('VideoUploadInterface - Setting video file:', videoFile);
        setSelectedVideo(videoFile);
      }
    } catch (error: any) {
      console.error('VideoUploadInterface - Error selecting video:', error);
      Alert.alert(t('videoUploadInterface.alertError'), error.message || t('videoUploadInterface.alertSelectionFailed'));
    }
  };

  const handleTrimCancel = () => {
    console.log('VideoUploadInterface - Trim cancelled');
    setShowTrimmer(false);
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string) => {
    try {
      console.log('VideoUploadInterface - Trim completed:', { startTime, endTime, outputPath });
      
      // Update the selected video with the trimmed version
      const trimmedVideo: VideoFile = {
        uri: outputPath,
        name: selectedVideo?.name || 'trimmed_video.mp4',
        type: selectedVideo?.type || 'video/mp4',
      };

      setSelectedVideo(trimmedVideo);
      setTrimStart(startTime);
      setTrimEnd(endTime);
      setNeedsTrimming(false);
      setShowTrimmer(false);
      
      console.log('VideoUploadInterface - Updated with trimmed video:', trimmedVideo);
    } catch (error) {
      console.error('VideoUploadInterface - Error handling trim save:', error);
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertTrimSaveFailed'));
    }
  };

  const handleSave = async () => {
    if (!selectedVideo || !selectedVideo.uri || !videoTitle.trim()) {
      Alert.alert(t('videoUploadInterface.alertError'), t('videoUploadInterface.alertMissingFields'));
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('VideoUploadInterface - Starting upload:', {
        uri: selectedVideo.uri,
        title: videoTitle,
        caption: videoCaption,
      });

      const uploadResult = await videoApiService.uploadVideo({
        uri: selectedVideo.uri,
        name: selectedVideo.name || 'video.mp4',
        type: selectedVideo.type || 'video/mp4',
      }, {
        title: videoTitle,
        caption: videoCaption,
        name: ''
      });

      console.log('VideoUploadInterface - Upload result:', uploadResult);

      if (uploadResult.success) {
        Alert.alert(
          t('videoUploadInterface.alertSuccess'),
          t('videoUploadInterface.alertVideoUploaded'),
          [{ text: 'OK', onPress: () => onComplete(uploadResult.data) }]
        );
      } else {
        throw new Error(uploadResult.error || t('videoUploadInterface.alertUploadFailed'));
      }
    } catch (error: any) {
      console.error('VideoUploadInterface - Upload error:', error);
      Alert.alert(t('videoUploadInterface.alertError'), error.message || t('videoUploadInterface.alertUploadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const renderVideoPreview = () => {
    if (!selectedVideo || !selectedVideo.uri) {
      return (
        <View style={styles.noVideoContainer}>
          <Ionicons name="videocam-outline" size={60} color="#ccc" />
          <Text style={styles.noVideoText}>{t('videoUploadInterface.noVideoSelected')}</Text>
          {!isFromRecording && (
            <TouchableOpacity style={styles.selectButton} onPress={handleSelectVideo}>
              <Text style={styles.selectButtonText}>{t('videoUploadInterface.selectVideo')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
        />
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => {
            if (isPlaying) {
              player.pause();
            } else {
              player.play();
            }
          }}
        >
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
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.uploadButtonText}>{t('videoUploadInterface.saveVideo')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>{t('videoUploadInterface.cancel')}</Text>
        </TouchableOpacity>
      </View>

      {/* Video Trimmer Modal */}
      <Modal
        visible={showTrimmer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowTrimmer(false)}
      >
        {selectedVideo && selectedVideo.uri && (
          <VideoTrimmer
            videoUri={selectedVideo.uri}
            videoDuration={videoDuration}
            maxDuration={30}
            onTrimChange={(start, end) => {
              setTrimStart(start);
              setTrimEnd(end);
            }}
            onCancel={handleTrimCancel}
            onSave={handleTrimSave}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  instructionsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    margin: 10,
    borderRadius: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  previewSection: {
    flex: 1,
    padding: 20,
  },
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    minHeight: 200,
  },
  noVideoText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    marginBottom: 20,
  },
  selectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  selectButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  videoContainer: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 200,
  },
  video: {
    width: '100%',
    height: 200,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 10,
  },
  uriText: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    right: 5,
    color: 'white',
    fontSize: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 2,
    borderRadius: 3,
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    marginBottom: 10,
  },
  trimButton: {
    backgroundColor: '#ffc107',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  trimButtonText: {
    color: '#856404',
    fontWeight: 'bold',
  },
  durationText: {
    color: '#28a745',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  captionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  uploadSection: {
    padding: 20,
    paddingBottom: 40,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VideoUploadInterface;