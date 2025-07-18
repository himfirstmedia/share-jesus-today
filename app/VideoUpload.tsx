// Enhanced VideoUpload.tsx with upload progress tracking
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import videoApiService from '../services/videoApiService';
import VideoTrimmerComponent from './VideoTrimmer';

// Standardized VideoFile interface
interface VideoFile {
  uri: string;
  name?: string;
  type?: string;
}

interface VideoUploadProps {
  initialFile?: VideoFile;
  onUploadComplete?: (videoData: any) => void;
  onCancel?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

const VideoUpload: React.FC<VideoUploadProps> = ({
  initialFile,
  onUploadComplete,
  onCancel,
}) => {
  const [selectedFile, setSelectedFile] = useState<VideoFile | null>(initialFile || null);
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isTrimming, setIsTrimming] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  
  // Progress tracking state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<'preparing' | 'uploading' | 'processing' | 'complete'>('preparing');
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  
  // Animation for progress bar
  const progressAnimation = useState(new Animated.Value(0))[0];
  const [lastProgressUpdate, setLastProgressUpdate] = useState(Date.now());

  // Debug logging to track the file state
  useEffect(() => {
    console.log('VideoUpload - selectedFile state:', selectedFile);
    if (selectedFile) {
      console.log('VideoUpload - selectedFile.uri:', selectedFile.uri);
    }
  }, [selectedFile]);

  // Initialize with initial file if provided
  useEffect(() => {
    if (initialFile) {
      console.log('VideoUpload - Setting initial file:', initialFile);
      setSelectedFile(initialFile);
    }
  }, [initialFile]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: uploadProgress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  const resetForm = (): void => {
    setSelectedFile(initialFile || null);
    setTitle('');
    setName('');
    setCaption('');
    setMessage('');
    setVideoDuration(0);
    setIsTrimming(false);
    resetProgressTracking();
  };

  const resetProgressTracking = (): void => {
    setUploadProgress(0);
    setIsUploading(false);
    setUploadStage('preparing');
    setUploadedBytes(0);
    setTotalBytes(0);
    setUploadSpeed(0);
    setEstimatedTimeRemaining(0);
    progressAnimation.setValue(0);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleSelectFile = async (): Promise<void> => {
    try {
      setMessage('');
      console.log('VideoUpload - Starting file selection...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      console.log('VideoUpload - DocumentPicker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        console.log('VideoUpload - Selected asset:', asset);

        // Ensure we have a valid URI
        if (!asset.uri) {
          throw new Error('No URI in selected file');
        }

        const videoFile: VideoFile = {
          uri: asset.uri,
          name: asset.name || `video_${Date.now()}.mp4`,
          type: asset.mimeType || 'video/mp4',
        };

        console.log('VideoUpload - Setting video file:', videoFile);
        setSelectedFile(videoFile);
        setMessage('File selected successfully!');
        
        // Get file size for progress tracking
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          if (fileInfo.exists && !fileInfo.isDirectory) {
            setTotalBytes(fileInfo.size || 0);
          }
        } catch (error) {
          console.log('VideoUpload - Could not get file size:', error);
        }
      } else {
        console.log('VideoUpload - File selection cancelled or failed');
        setMessage('File selection was cancelled.');
      }
    } catch (error) {
      console.error('VideoUpload - Error selecting file:', error);
      setMessage('Failed to select file. Please try again.');
    }
  };

  const getFileExtension = (uri: string): string => {
    try {
      const parts = uri.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : 'mp4';
    } catch {
      return 'mp4';
    }
  };

  const validateInputs = (): boolean => {
    if (!selectedFile) {
      setMessage('Please select or record a video file first.');
      return false;
    }
    if (!selectedFile.uri) {
      setMessage('Selected file has no valid URI.');
      return false;
    }
    if (!title.trim()) {
      setMessage('Please enter a title for your video.');
      return false;
    }
    return true;
  };

  const updateProgress = (progress: number, bytesUploaded: number): void => {
    const now = Date.now();
    const timeDiff = (now - lastProgressUpdate) / 1000; // seconds
    
    if (timeDiff > 0) {
      const bytesDiff = bytesUploaded - uploadedBytes;
      const speed = bytesDiff / timeDiff; // bytes per second
      
      setUploadSpeed(speed);
      setUploadedBytes(bytesUploaded);
      setUploadProgress(progress);
      
      // Calculate estimated time remaining
      if (speed > 0 && totalBytes > 0) {
        const remainingBytes = totalBytes - bytesUploaded;
        const estimatedTime = remainingBytes / speed;
        setEstimatedTimeRemaining(estimatedTime);
      }
      
      setLastProgressUpdate(now);
    }
  };

  const handleUploadProgress = (progressEvent: any): void => {
    const progress = progressEvent.progress;
    const bytesUploaded = progressEvent.loaded;
    updateProgress(progress, bytesUploaded);
  };

  const handleUploadStateChange = (state: 'preparing' | 'uploading' | 'processing' | 'complete'): void => {
    setUploadStage(state);
    
    if (state === 'complete') {
      setIsUploading(false);
    }
    
    // Update message based on state
    switch (state) {
      case 'preparing':
        setMessage('Preparing upload...');
        break;
      case 'uploading':
        setMessage('Uploading video...');
        break;
      case 'processing':
        setMessage('Processing video...');
        break;
      case 'complete':
        setMessage('Upload completed successfully!');
        break;
    }
  };

  // Fix for VideoUpload.tsx - Add validation before upload

const handleUpload = async (): Promise<void> => {
  if (!validateInputs()) {
    return;
  }

  setIsLoading(true);
  setIsUploading(true);
  setUploadStage('preparing');
  setMessage('Preparing upload...');
  resetProgressTracking();

  try {
    // ** ENHANCED VALIDATION FOR TRIMMED FILES **
    console.log('Validating file before upload:', selectedFile?.uri);
    
    if (!selectedFile?.uri) {
      throw new Error('No valid file URI');
    }

    // Validate the file exists and is accessible
    try {
      const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
      console.log('File validation info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Selected file no longer exists');
      }
      
      if (fileInfo.isDirectory) {
        throw new Error('Selected path is a directory, not a file');
      }
      
      if (fileInfo.size === 0) {
        throw new Error('Selected file is empty');
      }
      
      // Update total bytes with actual file size
      setTotalBytes(fileInfo.size || 0);
      
    } catch (validationError) {
      console.error('File validation failed:', validationError);
      throw new Error('The selected video file is not accessible. Please try again.');
    }

    const extension = getFileExtension(selectedFile.uri);
    const fileName = selectedFile.name || `video-${Date.now()}.${extension}`;

    // ** ENSURE PROPER FILE OBJECT STRUCTURE **
    const fileToUpload = {
      uri: selectedFile.uri,
      name: fileName,
      type: selectedFile.type || 'video/mp4',
    };

    const metadata = {
      name: name.trim() || title.trim(),
      title: title.trim(),
      caption: caption.trim(),
    };

    console.log('VideoUpload - Uploading file:', fileToUpload);
    console.log('VideoUpload - With metadata:', metadata);

    setUploadStage('uploading');
    setMessage('Uploading video...');

    // Use the enhanced upload method with progress tracking
    const response = await videoApiService.uploadVideo(fileToUpload, metadata, {
      onUploadProgress: handleUploadProgress,
      onStateChange: handleUploadStateChange,
    });

    setIsLoading(false);
    setIsUploading(false);

    if (response.success) {
      const videoData = response.data;
      setUploadStage('complete');
      setMessage(`Upload successful! Video uploaded.`);
      resetForm();
      setTimeout(() => {
        if (onUploadComplete) {
          onUploadComplete(videoData);
        }
      }, 2000);
    } else {
      const errorMessage = response.error || 'Unknown error occurred';
      resetProgressTracking();
      
      // Enhanced error handling
      if (errorMessage.includes('unsupported format')) {
        setMessage('Upload failed: Video format not supported. Please use MP4, MOV, or MP2T format.');
      } else if (errorMessage.includes('File is empty')) {
        setMessage('Upload failed: The selected file appears to be empty.');
      } else if (errorMessage.includes('Authentication')) {
        setMessage('Upload failed: Please login again.');
      } else if (errorMessage.includes('Network')) {
        setMessage('Upload failed: Network connection error. Please check your internet connection.');
      } else {
        setMessage(`Upload failed: ${errorMessage}`);
      }
    }
  } catch (error: any) {
    setIsLoading(false);
    setIsUploading(false);
    resetProgressTracking();
    console.error('VideoUpload - Upload error:', error);
    
    // Enhanced error handling with specific messages
    if (error.message && error.message.includes('Network request failed')) {
      setMessage('Upload failed: Network connection error. Please check your internet connection.');
    } else if (error.message && error.message.includes('413')) {
      setMessage('Upload failed: File too large. Please select a smaller video file.');
    } else if (error.message && error.message.includes('not accessible')) {
      setMessage('Upload failed: Cannot access the video file. Please try selecting the video again.');
    } else if (error.message && error.message.includes('empty')) {
      setMessage('Upload failed: The video file appears to be empty or corrupted.');
    } else {
      setMessage(`Upload failed: ${error.message || 'Network error or server unavailable'}`);
    }
  }
};

  const handleCancel = (): void => {
    if (isUploading) {
      // Cancel upload if in progress
      videoApiService.cancelUpload();
      setIsUploading(false);
      setIsLoading(false);
      resetProgressTracking();
      setMessage('Upload cancelled.');
    } else {
      resetForm();
      if (onCancel) {
        onCancel();
      }
    }
  };

  // Fixed trim-related handlers with proper logging
  const handleTrimChange = (startTime: number, endTime: number): void => {
    console.log('VideoUpload - Trim change:', startTime, endTime);
    setVideoDuration(endTime - startTime);
  };

  const handleTrimSave = async (startTime: number, endTime: number, outputPath: string): Promise<void> => {
    console.log('VideoUpload - Trim save invoked with:', { startTime, endTime, outputPath });

    if (outputPath && selectedFile) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(outputPath);
        console.log('VideoUpload - Trimmed file info:', fileInfo);

        if (!fileInfo.exists) {
          console.error('VideoUpload - Trimmed file does not exist at outputPath:', outputPath);
          setMessage('Error: Trimmed file not found. Please try again.');
          setIsTrimming(false);
          return;
        }

        if (fileInfo.isDirectory) {
          console.error('VideoUpload - outputPath is a directory, not a file:', outputPath);
          setMessage('Error: Trimmed output is a directory. Please try again.');
          setIsTrimming(false);
          return;
        }

        if (fileInfo.size === 0) {
          console.warn('VideoUpload - Trimmed file is empty:', outputPath);
        }

        const updatedFile: VideoFile = {
          ...selectedFile,
          uri: outputPath,
          name: `trimmed_${selectedFile.name || `video_${Date.now()}.${getFileExtension(outputPath)}`}`,
          type: selectedFile.type || `video/${getFileExtension(outputPath)}`,
        };
        
        console.log('VideoUpload - Updated file after trim:', updatedFile);
        setSelectedFile(updatedFile);
        setVideoDuration(endTime - startTime);
        setTotalBytes(fileInfo.size || 0); // Update total bytes for progress tracking
        setMessage('Video trimmed successfully!');
      } catch (error) {
        console.error('VideoUpload - Error getting file info for trimmed video:', error);
        setMessage('Failed to process trimmed video. Please try again.');
      } finally {
        setIsTrimming(false);
      }
    } else {
      console.error('VideoUpload - Trim save failed: outputPath or selectedFile is missing.', { outputPath, selectedFile });
      setMessage('Failed to trim video. Output path or original file is missing.');
      setIsTrimming(false);
    }
  };

  const handleTrimCancel = (): void => {
    console.log('VideoUpload - Trim cancelled');
    setIsTrimming(false);
  };

  // Progress bar component
  const ProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressInfo}>
        <Text style={styles.progressText}>
          {uploadStage === 'preparing' && 'Preparing...'}
          {uploadStage === 'uploading' && `Uploading... ${Math.round(uploadProgress)}%`}
          {uploadStage === 'processing' && 'Processing...'}
          {uploadStage === 'complete' && 'Complete!'}
        </Text>
        {uploadStage === 'uploading' && (
          <Text style={styles.progressDetails}>
            {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
          </Text>
        )}
      </View>
      
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnimation.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      </View>
      
      {uploadStage === 'uploading' && uploadSpeed > 0 && (
        <View style={styles.uploadStats}>
          <Text style={styles.uploadStatsText}>
            Speed: {formatBytes(uploadSpeed)}/s
          </Text>
          {estimatedTimeRemaining > 0 && (
            <Text style={styles.uploadStatsText}>
              ETA: {formatTime(estimatedTimeRemaining)}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  // Render trimmer if trimming and we have a valid file with URI
  if (isTrimming && selectedFile && selectedFile.uri) {
    console.log('VideoUpload - Rendering trimmer with URI:', selectedFile.uri);
    return (
      <VideoTrimmerComponent
        videoUri={selectedFile.uri}
        videoDuration={videoDuration || 60}
        maxDuration={60}
        onCancel={handleTrimCancel}
        onSave={handleTrimSave}
        onTrimChange={handleTrimChange}
      />
    );
  }

  // Main upload interface
  return (
    <View style={styles.scrollContainer}>
      <ScrollView 
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.header}>
            {initialFile ? 'Upload Recorded Video' : 'Upload Video'}
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Selected File:</Text>
            <Text style={styles.fileName}>
              {selectedFile ? selectedFile.name || 'Video File' : 'No file selected'}
            </Text>
            {selectedFile && selectedFile.uri && (
              <Text style={styles.uriText} numberOfLines={1}>
                URI: {selectedFile.uri}
              </Text>
            )}
            {totalBytes > 0 && (
              <Text style={styles.fileSizeText}>
                Size: {formatBytes(totalBytes)}
              </Text>
            )}
            
            {(!selectedFile || !initialFile) && (
              <TouchableOpacity
                style={[
                  styles.selectFileButton,
                  (isLoading || isUploading) && styles.disabledButton
                ]}
                onPress={handleSelectFile}
                disabled={isLoading || isUploading}
              >
                <Text style={styles.selectFileButtonText}>
                  {selectedFile ? 'Select Different Video' : 'Select Video File'}
                </Text>
              </TouchableOpacity>
            )}

            {selectedFile && selectedFile.uri && (
              <TouchableOpacity
                style={[
                  styles.trimButton, 
                  (isLoading || isUploading) && styles.disabledButton
                ]}
                onPress={() => {
                  console.log('VideoUpload - Starting trim for:', selectedFile.uri);
                  setIsTrimming(true);
                }}
                disabled={isLoading || isUploading}
              >
                <Text style={styles.trimButtonText}>Trim Video</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title *:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter video title"
              value={title}
              onChangeText={setTitle}
              editable={!isLoading && !isUploading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Name (optional):</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter video name"
              value={name}
              onChangeText={setName}
              editable={!isLoading && !isUploading}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Caption (optional):</Text>
            <TextInput
              style={[styles.input, styles.captionInput]}
              placeholder="Enter video caption"
              value={caption}
              onChangeText={setCaption}
              editable={!isLoading && !isUploading}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Progress Bar */}
          {isUploading && <ProgressBar />}

          {message ? (
            <View style={styles.messageContainer}>
              <Text style={[
                styles.message,
                message.includes('successful') ? styles.successMessage : styles.errorMessage
              ]}>
                {message}
              </Text>
            </View>
          ) : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={false} // Allow cancel even during upload
            >
              <Text style={styles.cancelButtonText}>
                {isUploading ? 'Cancel Upload' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.uploadButton,
                (!selectedFile || !selectedFile.uri || !title.trim() || isLoading || isUploading) && styles.disabledButton
              ]}
              onPress={handleUpload}
              disabled={!selectedFile || !selectedFile.uri || !title.trim() || isLoading || isUploading}
            >
              {isLoading || isUploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  fileName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  uriText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  fileSizeText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  captionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectFileButton: {
    backgroundColor: '#3260ad',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  selectFileButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  trimButton: {
    backgroundColor: '#FF6B35',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  trimButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Progress bar styles
  progressContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressDetails: {
    fontSize: 14,
    color: '#666',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3260ad',
    borderRadius: 3,
  },
  uploadStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadStatsText: {
    fontSize: 12,
    color: '#666',
  },
  messageContainer: {
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    padding: 10,
    borderRadius: 6,
  },
  successMessage: {
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  errorMessage: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelButton: {
    backgroundColor: '#95a5a6',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#3260ad',
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

export default VideoUpload;