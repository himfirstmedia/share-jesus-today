import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

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
      <TouchableOpacity style={styles.closeButton} onPress={handleSkip}>
        <Ionicons name="close" size={30} color="white" />
      </TouchableOpacity>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        allowsFullscreen={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    height:'60%'
  },
  video: {
    width: '80%',
    height: '60%',
  },
  closeButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 1,
  },
});