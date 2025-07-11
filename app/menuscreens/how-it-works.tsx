import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function HowItWorksScreen() {
  const [status, setStatus] = useState({});
  const video = useRef(null);

  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  const handlePlayPause = () => {
    if (status.isPlaying) {
      video.current.pauseAsync();
    } else {
      video.current.playAsync();
    }
  };

  const handleRewind = () => {
    if (video.current && status.positionMillis) {
      const newPosition = Math.max(0, status.positionMillis - 10000); // 10 seconds back
      video.current.setPositionAsync(newPosition);
    }
  };

  const handleFastForward = () => {
    if (video.current && status.positionMillis && status.durationMillis) {
      const newPosition = Math.min(status.durationMillis, status.positionMillis + 10000); // 10 seconds forward
      video.current.setPositionAsync(newPosition);
    }
  };

  const formatTime = (millis) => {
    if (!millis) return '00:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How It Works</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Video Player */}
        <View style={styles.videoContainer}>
          <Video
            ref={video}
            style={styles.video}
            source={require('../../assets/video/sharejesustoday.mp4')}
            useNativeControls={false}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
            isLooping={false}
            onPlaybackStatusUpdate={status => setStatus(() => status)}
          />
          
          {/* Custom Video Controls */}
          <View style={styles.videoControls}>
            <View style={styles.controlButtons}>
              <TouchableOpacity onPress={handleRewind} style={styles.controlButton}>
                <Ionicons name="play-back" size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleRewind} style={styles.controlButton}>
                <Ionicons name="play-skip-back" size={20} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                <Ionicons 
                  name={status.isPlaying ? "pause" : "play"} 
                  size={28} 
                  color="white" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleFastForward} style={styles.controlButton}>
                <Ionicons name="play-skip-forward" size={20} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleFastForward} style={styles.controlButton}>
                <Ionicons name="play-forward" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(status.positionMillis)}</Text>
              <View style={styles.progressBar}>
                <View style={styles.progressTrack}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: status.durationMillis 
                          ? `${(status.positionMillis / status.durationMillis) * 100}%` 
                          : '0%' 
                      }
                    ]} 
                  />
                </View>
              </View>
              <Text style={styles.timeText}>{formatTime(status.durationMillis)}</Text>
            </View>
          </View>
        </View>

        {/* Content Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Getting Started:</Text>
          <Text style={styles.sectionText}>
            Start an account so you can upload your video testimonies. Record your 30 second video telling how you touched someone in Love with the Name of Jesus and how they responded. You can even include the person touched in your video, if they are agreeable. Click the share button and your video is shared to the world!
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sharing Made Simple:</Text>
          <Text style={styles.sectionText}>
            Sharing the Love of Jesus every day fulfills the great commission, fills you and others with the Joy of learning or being reminded of his great love for us all! With just a few taps, you can record, upload and share your personal experiences with a world-wide community of people who would also like to share Jesus' love today and every day!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 5,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  videoContainer: {
    backgroundColor: '#000',
    marginBottom: 24,
    position: 'relative',
    marginTop:24,
    
  },
  video: {
    width: width,
    height: width * 0.6, // 16:10 aspect ratio
  },
  videoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlButton: {
    marginHorizontal: 15,
    padding: 8,
  },
  playButton: {
    marginHorizontal: 20,
    padding: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    marginHorizontal: 12,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 1.5,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'left',
  },
});