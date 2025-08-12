import { Asset } from 'expo-asset';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, TouchableOpacity, Text } from 'react-native';

const videoAsset = Asset.fromModule(require('../assets/video/sharejesustoday.mp4'));

export default function AppIntroScreen({ onIntroFinish }: { onIntroFinish: () => void }) {
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    const loadAsset = async () => {
      await videoAsset.downloadAsync();
      setVideoUri(videoAsset.uri);
    };
    loadAsset();
  }, []);

  const player = useVideoPlayer(videoUri, (player) => {
    player.play();
  });

  useEffect(() => {
    if (!player) return;
    const subscription = player.addListener('playbackStatusChange', (status) => {
      if (status.isFinished) {
        onIntroFinish();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, onIntroFinish]);

  const handleSkip = () => {
    player.pause();
    onIntroFinish();
  };

  if (!videoUri) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen={false}
      />
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Skip Intro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: '80%',
    height: '80%',
  },
  skipButton: {
    position: 'absolute',
    bottom: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3260ad',
    borderRadius: 5,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});