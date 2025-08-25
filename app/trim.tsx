
import VideoTrimmer from '@/app/VideoTrimmer';
import { t } from '@/utils/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Alert } from 'react-native';

const TrimVideoScreen = () => {
  const router = useRouter();
  const { videoUri, maxDuration } = useLocalSearchParams<{ videoUri: string; maxDuration?: string }>();

  if (!videoUri) {
    // This should not happen if navigation is set up correctly
    return null;
  }

  const handleTrimSave = async (startTime: number, endTime: number, persistentUri: string) => {
    // This function is now handled by onTrimComplete, 
    // but we keep it to satisfy the VideoTrimmer props.
  };

  const handleTrimComplete = (videoData: { startTime: number; endTime: number; uri: string }) => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback if navigation history is lost
      router.replace({
        pathname: '/(tabs)/post',
        params: { trimmedUri: videoData.uri, from: 'trim' },
      });
    }
  };

  const handleTrimCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/post');
    }
  };

  return (
    <VideoTrimmer
      videoUri={videoUri}
      maxDuration={Number(maxDuration) || 30}
      onCancel={handleTrimCancel}
      onSave={handleTrimSave}
      onTrimComplete={handleTrimComplete}
    />
  );
};

export default TrimVideoScreen;
