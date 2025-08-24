import { t } from '@/utils/i18n';
import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import VideoTrimmerUI from 'react-native-video-trimmer-ui';
import VideoTrimmer from 'react-native-video-trimmer-core';

interface VideoTrimmerProps {
  videoUri: string;
  onCancel: () => void;
  onSave: (startTime: number, endTime: number, outputPath: string) => Promise<void>;
  onTrimComplete: (videoData: { startTime: number, endTime: number, uri: string }) => void;
}

const NewVideoTrimmer: React.FC<VideoTrimmerProps> = ({
  videoUri,
  onCancel,
  onSave,
  onTrimComplete,
}) => {
  const [isTrimming, setIsTrimming] = useState(false);

  const handleTrim = async (startTime: number, endTime: number) => {
    if (isTrimming) {
      return;
    }

    setIsTrimming(true);
    try {
      const trimmer = new VideoTrimmer();
      const outputPath = await trimmer.trimVideo(videoUri, startTime, endTime);
      
      await onSave(startTime, endTime, outputPath);
      onTrimComplete({ startTime, endTime, uri: outputPath });

    } catch (error) {
      console.error('Error trimming video:', error);
      Alert.alert(
        t('alerts.trimmingErrorTitle', { defaultValue: 'Trimming Error' }),
        t('alerts.trimmingErrorMessageGeneric', { defaultValue: 'An error occurred while trimming the video.' }),
        [{ text: t('alerts.ok', { defaultValue: 'OK' }), onPress: onCancel }]
      );
    } finally {
      setIsTrimming(false);
    }
  };

  return (
    <View style={styles.container}>
      {isTrimming ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loaderText}>{t('videoTrimmer.processing', { defaultValue: 'Processing video...' })}</Text>
        </View>
      ) : (
        <VideoTrimmerUI
          source={{ uri: videoUri }}
          onSelected={(start, end) => handleTrim(start, end)}
          onCancel={onCancel}
          containerStyle={styles.trimmerContainer}
          sliderContainerStyle={styles.sliderContainer}
          tintColor="#f0ad4e"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    color: '#ffffff',
    marginTop: 10,
    fontSize: 16,
  },
  trimmerContainer: {
    flex: 1,
  },
  sliderContainer: {
    marginHorizontal: 20,
  },
});

export default NewVideoTrimmer;
