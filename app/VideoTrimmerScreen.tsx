import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import VideoTrimmer from './VideoTrimmer';

const VideoTrimmerScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { videoUri, videoName, videoType } = params as { videoUri: string, videoName: string, videoType: string };

  const handleTrimComplete = useCallback((result: { startTime: number; endTime: number; uri: string }) => {
    // Navigate back to the previous screen (VideoUploadInterface) and pass the trimmed video data
    router.replace({
      pathname: 'VideoUpload', // Assuming VideoUpload is the previous screen's route
      params: {
        trimmedVideoUri: result.uri,
        trimmedVideoStartTime: result.startTime.toString(),
        trimmedVideoEndTime: result.endTime.toString(),
        hasBeenTrimmed: 'true',
        originalVideoName: videoName,
        originalVideoType: videoType,
      },
    });
  }, [router, videoName, videoType]);

  const handleCancel = useCallback(() => {
    router.back(); // Go back without trimming
  }, [router]);

  if (!videoUri) {
    // Handle case where videoUri is not provided, maybe show an error or go back
    return (
      <SafeAreaView style={styles.container}>
        {/* You might want to add an error message here */}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <VideoTrimmer
        videoUri={videoUri}
        onCancel={handleCancel}
        onTrimComplete={handleTrimComplete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default VideoTrimmerScreen;
