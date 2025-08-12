import { Ionicons } from '@expo/vector-icons';
import { useEvent, useEventListener } from 'expo';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../utils/i18n';

const { width } = Dimensions.get('window');

export default function HowItWorksScreen() {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const player = useVideoPlayer(require('../../assets/video/sharejesustoday.mp4'), player => {
    player.loop = false;
    player.timeUpdateEventInterval = 500; // Update every 500ms
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Listen to time updates
  useEventListener(player, 'timeUpdate', (event) => {
    setCurrentTime(event.currentTime);
  });

  // Get the duration from the player when it's available
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && player.duration) {
        setDuration(player.duration);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleRewind = () => {
    // Use seekBy for relative seeking (negative value to go back)
    player.seekBy(-10); // 10 seconds back
  };

  const handleFastForward = () => {
    // Use seekBy for relative seeking (positive value to go forward)
    player.seekBy(10); // 10 seconds forward
  };

  const handleSeekToStart = () => {
    // For absolute seeking, set currentTime directly
    player.currentTime = 0;
  };

  const handleSeekToEnd = () => {
    // For absolute seeking to end, set currentTime to duration
    if (duration > 0) {
      player.currentTime = duration;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === 0) return '00:00';
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3260ad" barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('howItWorksScreen.title')}</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Video Player */}
        <View style={styles.videoContainer}>
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
            contentFit="contain"
          />

          {/* Custom Video Controls */}
          <View style={styles.videoControls}>
            <View style={styles.controlButtons}>
              <TouchableOpacity onPress={handleRewind} style={styles.controlButton}>
                <Ionicons name="play-back" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSeekToStart} style={styles.controlButton}>
                <Ionicons name="play-skip-back" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={28}
                  color="white"
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleFastForward} style={styles.controlButton}>
                <Ionicons name="play-skip-forward" size={20} color="white" />
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSeekToEnd} style={styles.controlButton}>
                <Ionicons name="play-forward" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <View style={styles.progressBar}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: duration
                          ? `${(currentTime / duration) * 100}%`
                          : '0%'
                      }
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </View>

        {/* Content Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('howItWorksScreen.gettingStartedTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('howItWorksScreen.gettingStartedText')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('howItWorksScreen.sharingSimpleTitle')}</Text>
          <Text style={styles.sectionText}>
            {t('howItWorksScreen.sharingSimpleText')}
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
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 45,
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
    marginTop: 24,
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
    backgroundColor: '#3260ad',
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