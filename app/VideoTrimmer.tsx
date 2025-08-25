import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import * as FileSystem from 'expo-file-system';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Media3VideoTrimmer from '../src/modules/Media3VideoTrimmer';

const isMedia3Available = Platform.OS === 'android' && Media3VideoTrimmer != null;

// --- Helper Functions ---
const normalizeUri = (uri: string): string => {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }
  return `file://${uri}`;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// --- Interfaces ---
interface VideoState {
  duration: number;
  trimStart: number;
  trimEnd: number;
  isPlaying: boolean;
  currentTime: number;
}

// --- Component ---
function VideoTrimmer(props: any) {
  console.log('VideoTrimmer props:', props);

  // Validate props
  if (!props || !props.videoUri || !props.onCancel || !props.onTrimComplete) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorText}>Invalid props provided</Text>
        </View>
      </SafeAreaView>
    );
  }

  const videoUri = props.videoUri;
  const onCancel = props.onCancel;
  const onTrimComplete = props.onTrimComplete;

  // State
  const [status, setStatus] = useState<'initializing' | 'loading' | 'ready' | 'trimming' | 'error'>('initializing');
  const [processingMessage, setProcessingMessage] = useState<string>('Preparing video...');
  const [validatedUri, setValidatedUri] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoState, setVideoState] = useState<VideoState>({
    duration: 0,
    trimStart: 0,
    trimEnd: 0,
    isPlaying: false,
    currentTime: 0,
  });

  // Use the same video player hook as your working component
  const player = useVideoPlayer(validatedUri || '', (player) => {
    player.loop = false;
    player.muted = false;
    player.staysActiveInBackground = false;
  });

  // Effect 1: Process and validate the video URI
  useEffect(() => {
    const processVideoUri = async () => {
      setStatus('initializing');
      try {
        if (!videoUri) {
          throw new Error('No video URI provided');
        }

        console.log('Processing video URI:', videoUri);
        let workableUri = videoUri;

        // On Android, copy content:// URIs to a temporary file
        if (Platform.OS === 'android' && workableUri.startsWith('content://')) {
          console.log('Android content:// URI detected, copying to temp file...');
          setProcessingMessage('Copying file...');
          const tempDir = FileSystem.cacheDirectory + 'trimmer/';
          await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
          const tempFileUri = tempDir + `temp_${Date.now()}.mp4`;
          await FileSystem.copyAsync({ from: workableUri, to: tempFileUri });
          workableUri = tempFileUri;
          console.log('File copied to:', workableUri);
        }

        // Validate the file
        console.log('Validating file at:', workableUri);
        const info = await FileSystem.getInfoAsync(workableUri);
        console.log('File info:', info);
        
        if (!info.exists) {
          throw new Error("Video file does not exist at the specified path");
        }
        
        if (info.size === 0) {
          throw new Error("Video file is empty (0 bytes)");
        }

        const normalizedUri = normalizeUri(workableUri);
        console.log('Setting validated URI:', normalizedUri);
        setValidatedUri(normalizedUri);
        setStatus('loading');
        
      } catch (error) {
        console.error('Video initialization failed:', error);
        Alert.alert(
          'Video Loading Error', 
          `Failed to load video:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try selecting a different video.`
        );
        setStatus('error');
        onCancel();
      }
    };

    processVideoUri();
  }, [videoUri, onCancel]);

  // Effect 2: Handle player status changes
  useEffect(() => {
    if (!player || !validatedUri) return;

    console.log('Setting up player listeners...');
    
    const subscription = player.addListener('statusChange', (statusEvent) => {
      console.log('Player status changed:', statusEvent);
      
      if (statusEvent.status === 'readyToPlay' && !videoLoaded) {
        console.log('Player ready to play');
        setVideoLoaded(true);
        const durationSeconds = player.duration || 0;
        console.log('Video duration:', durationSeconds);
        
        if (durationSeconds > 0) {
          setVideoState(current => ({
            ...current,
            duration: durationSeconds,
            trimStart: 0,
            trimEnd: durationSeconds,
          }));
          setStatus('ready');
        } else {
          console.error('Player ready but duration is 0');
          Alert.alert('Video Error', 'The video file appears to be corrupted');
          setStatus('error');
          onCancel();
        }
      }
      
      setVideoState(current => ({ 
        ...current, 
        isPlaying: statusEvent.status === 'playing' 
      }));
    });

    // Handle time updates
    const timeSubscription = player.addListener('timeUpdate', (event) => {
      const newTime = event.currentTime || 0;
      setVideoState(current => {
        // Auto-pause and loop within trim bounds
        if (newTime >= current.trimEnd && current.isPlaying) {
          player.pause();
          player.seekBy(current.trimStart);
        }
        return { ...current, currentTime: newTime };
      });
    });

    return () => {
      subscription?.remove();
      timeSubscription?.remove();
    };
  }, [player, videoLoaded, validatedUri, onCancel]);

  // --- Handlers ---
  const handlePlayPause = useCallback(() => {
    if (!player) return;
    
    try {
      if (videoState.isPlaying) {
        player.pause();
      } else {
        if (videoState.currentTime < videoState.trimStart || videoState.currentTime >= videoState.trimEnd) {
          player.seekBy(videoState.trimStart);
        }
        player.play();
      }
    } catch (error) {
      console.error('Play/pause failed:', error);
    }
  }, [player, videoState]);

  const handleTrim = async () => {
    if (!validatedUri) return;
    const { trimStart, trimEnd } = videoState;
    setStatus('trimming');
    setProcessingMessage('Processing video...');

    try {
      const outputDir = `${FileSystem.documentDirectory}videofiles/`;
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
      const outputUri = `${outputDir}trimmed_${Date.now()}.mp4`;

      if (isMedia3Available) {
        const result = await Media3VideoTrimmer.trimVideo({
          inputUri: validatedUri,
          outputUri,
          startTimeMs: Math.floor(trimStart * 1000),
          endTimeMs: Math.floor(trimEnd * 1000),
        });
        if (!result.success) throw new Error(result.message || 'Trimming failed');
        onTrimComplete({ startTime: trimStart, endTime: trimEnd, uri: result.outputUri });
      } else {
        console.warn('Media3 not available. Using file copy as fallback');
        await FileSystem.copyAsync({ from: validatedUri, to: outputUri });
        onTrimComplete({ startTime: trimStart, endTime: trimEnd, uri: outputUri });
      }
    } catch (error) {
      console.error('Trimming error:', error);
      Alert.alert('Trimming Error', `Failed to trim video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStatus('ready');
    }
  };

  // Loading view
  if (status !== 'ready' || !videoLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          {status === 'error' ? (
            <>
              <Ionicons name="alert-circle" size={48} color="#d32f2f" />
              <Text style={styles.errorText}>Failed to load video</Text>
              <Text style={styles.errorSubText}>
                The video file could not be processed. This might be due to:
              </Text>
              <View style={styles.errorReasons}>
                <Text style={styles.errorReason}>• Unsupported video format</Text>
                <Text style={styles.errorReason}>• Corrupted video file</Text>
                <Text style={styles.errorReason}>• Device compatibility issue</Text>
              </View>
              <TouchableOpacity style={styles.retryButton} onPress={() => {
                console.log('Retry button pressed, restarting component...');
                setStatus('initializing');
                setValidatedUri(null);
                setVideoLoaded(false);
              }}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#3260a0" />
              <Text style={styles.statusText}>{processingMessage}</Text>
              <Text style={styles.statusSubText}>
                Status: {status}
              </Text>
            </>
          )}
          
          {status !== 'trimming' && (
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { trimStart, trimEnd, duration, isPlaying, currentTime } = videoState;
  const trimDuration = trimEnd - trimStart;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trim Video</Text>
        <TouchableOpacity 
          onPress={handleTrim}
          style={[styles.saveButton, trimDuration < 0.5 && styles.saveButtonDisabled]}
          disabled={trimDuration < 0.5}
        >
          <Text style={[styles.saveButtonText, trimDuration < 0.5 && styles.saveButtonTextDisabled]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.videoContainer}>
          <VideoView style={styles.video} player={player} contentFit="contain" />
          {!isPlaying && (
            <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
              <Ionicons name="play" size={40} color="white" />
            </TouchableOpacity>
          )}
          {!videoLoaded && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#3260a0" />
              <Text style={styles.loadingOverlayText}>Loading video...</Text>
            </View>
          )}
        </View>

        <Text style={styles.infoText}>
          Selected: {formatTime(trimStart)} - {formatTime(trimEnd)} ({trimDuration.toFixed(1)}s)
        </Text>

        <View style={styles.trimmerContainer}>
          <View style={styles.multiSliderContainer}>
            <MultiSlider
              values={[trimStart, trimEnd]}
              sliderLength={300}
              onValuesChange={(values) => {
                let [newStart, newEnd] = values;
                if (newEnd - newStart > 30) {
                  if (newStart !== videoState.trimStart) {
                    newEnd = newStart + 30;
                  } else {
                    newStart = newEnd - 30;
                  }
                }
                setVideoState(prev => ({ ...prev, trimStart: newStart, trimEnd: newEnd }));
              }}
              min={0}
              max={duration}
              step={0.5}
              allowOverlap={false}
              snapped
              onValuesChangeFinish={(values) => player.seekBy(values[0])}
              selectedStyle={{ backgroundColor: '#3260ad' }}
              unselectedStyle={{ backgroundColor: '#d3d3d3' }}
              markerStyle={{ backgroundColor: '#3260ad' }}
            />
          </View>
          <View style={styles.timeDisplay}>
            <Text style={styles.timeText}>Current: {formatTime(currentTime)}</Text>
            <Text style={styles.timeText}>Total Duration: {formatTime(duration)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingVertical: 10, flexGrow: 1 },
  centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 10, 
    paddingBottom: 10, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0' 
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  saveButton: { padding: 8 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#3260a0', fontSize: 16, fontWeight: '600' },
  saveButtonTextDisabled: { color: '#999' },
  statusText: { marginTop: 15, fontSize: 16, color: '#333', textAlign: 'center' },
  statusSubText: { marginTop: 5, fontSize: 12, color: '#666', textAlign: 'center' },
  errorText: { fontSize: 18, color: '#d32f2f', textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  errorSubText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 15 },
  errorReasons: { marginBottom: 20 },
  errorReason: { fontSize: 12, color: '#666', marginBottom: 3, textAlign: 'left' },
  retryButton: { 
    marginBottom: 10, 
    padding: 12, 
    backgroundColor: '#007AFF', 
    borderRadius: 8,
    minWidth: 100
  },
  retryButtonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  cancelButton: { marginTop: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8 },
  cancelButtonText: { color: '#666', fontSize: 16 },
  videoContainer: { 
    marginHorizontal: 20, 
    marginTop: 20, 
    borderRadius: 12, 
    overflow: 'hidden', 
    position: 'relative', 
    backgroundColor: '#000'
  },
  video: { width: '100%', height: 200, backgroundColor: '#000' },
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
    alignItems: 'center' 
  },
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingOverlayText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  infoText: { 
    textAlign: 'center', 
    fontSize: 14, 
    color: '#666', 
    marginTop: 20,
    marginBottom: 20
  },
  trimmerContainer: { 
    marginHorizontal: 20, 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  multiSliderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0'
  },
  timeText: {
    fontSize: 12,
    color: '#666'
  }
});

export default VideoTrimmer;