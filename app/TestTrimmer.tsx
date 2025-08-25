import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import React, { useRef, useState } from 'react';
import { Alert, Button, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import VideoTrimmerUI from 'react-native-video-trimmer-ui';
import Media3VideoTrimmer from '../src/modules/Media3VideoTrimmer';

const isMedia3Available = Platform.OS === 'android' && Media3VideoTrimmer != null;

export default function TestTrimmerScreen() {
  const [trimming, setTrimming] = useState(false);
  const [trimmedUri, setTrimmedUri] = useState<string | null>(null);
  const trimmerRef = useRef<any>(null);

  // Hardcoded video from assets for testing
  const videoAsset = Asset.fromModule(require('../assets/video/sharejesustoday.mp4'));
  const videoUri = videoAsset.uri;

  const handleTrim = async () => {
    if (trimming) return;
    setTrimming(true);
    setTrimmedUri(null);

    const selection = trimmerRef.current?.getSelection();
    if (!selection || !selection.start || !selection.end) {
      Alert.alert('Error', 'Could not get trim selection.');
      setTrimming(false);
      return;
    }
    
    const { start, end } = selection;

    try {
      const outputDir = `${FileSystem.documentDirectory}videofiles/`;
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
      const outputUri = `${outputDir}trimmed_test_${Date.now()}.mp4`;

      if (isMedia3Available) {
        console.log(`Trimming with Media3 from ${start}s to ${end}s`);
        const result = await Media3VideoTrimmer.trimVideo({
          inputUri: videoUri,
          outputUri,
          startTimeMs: Math.floor(start * 1000),
          endTimeMs: Math.floor(end * 1000),
        });
        if (!result.success) throw new Error(result.message || 'Trimming failed');
        setTrimmedUri(result.outputUri);
        Alert.alert('Success', `Video trimmed successfully to: ${result.outputUri}`);
      } else {
        // Fallback for iOS or if Media3 is not available
        console.warn('Media3 not available. Using file copy as fallback for testing.');
        // NOTE: This is not a real trim on iOS, just a copy.
        // The real app uses a different mechanism for trimming.
        // For this test, we just want to see the UI work.
        await FileSystem.copyAsync({ from: videoUri, to: outputUri });
        setTrimmedUri(outputUri);
        Alert.alert('Success (Fallback)', `Video copied to: ${outputUri}`);
      }
    } catch (error) {
      console.error('Trimming error:', error);
      Alert.alert('Trimming Error', `Failed to trim video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTrimming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Test Video Trimmer</Text>
      <VideoTrimmerUI
        ref={trimmerRef}
        source={{ uri: videoUri }}
        loop={true}
        containerStyle={{ height: 300, width: '100%' }}
        sliderContainerStyle={{ marginHorizontal: 20 }}
        tintColor="#007AFF"
        minDuration={1}
        onSelected={(start, end) => console.log(`Selected trim range: ${start} to ${end}`)}
      />
      <View style={styles.buttonContainer}>
        <Button title={trimming ? 'Trimming...' : 'Trim Video'} onPress={handleTrim} disabled={trimming} />
      </View>
      {trimmedUri && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>Trimmed Video URI:</Text>
          <Text style={styles.uriText}>{trimmedUri}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  resultContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  resultText: {
    fontWeight: 'bold',
  },
  uriText: {
    marginTop: 5,
    color: '#333',
  }
});
