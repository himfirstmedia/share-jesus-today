// app/post.tsx - Updated to use VideoUploadInterface
import { t } from '@/utils/i18';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CameraRecord from '../CameraRecord';
import VideoUploadInterface from '../VideoUploadInterface'; // Import the new component

type PostMode = 'options' | 'upload' | 'record';

const { width, height } = Dimensions.get('window');

export default function PostVideoScreen() {
  const [mode, setMode] = useState<PostMode>('options');
  const [videoToUpload, setVideoToUpload] = useState<any>(null);

  const handleRecordingComplete = (videoFile: any) => {
    if (videoFile) {
      setVideoToUpload(videoFile);
      setMode('upload'); // Switch to upload mode with the recorded file
    } else {
      setMode('options');
    }
  };

  const handleUploadCancelled = () => {
    setVideoToUpload(null);
    setMode('options');
  };

  const handleUploadComplete = (uploadedVideoData?: any) => {
    setVideoToUpload(null);
    setMode('options');
    if (uploadedVideoData) {
      console.log('Video uploaded successfully:', uploadedVideoData);
      // You can navigate to the video feed or show success message here
    }
  };

  const OptionButton = ({ title, iconName, onPress }: {
    title: string;
    iconName: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.optionButton}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        <Ionicons name={iconName} size={24} color="#666666" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    switch (mode) {
      case 'options':
        return (
          <View style={styles.optionsContainer}>
            <Text style={styles.title}>Video Options</Text>
            
            <View style={styles.noticeContainer}>
              <Text style={styles.noticeText}>
                All videos uploaded can be a maximum length of 30 seconds.
              </Text>
              <Text style={styles.noticeText}>
                If video is longer you will be given option to trim to 30 seconds.
              </Text>
            </View>
            
            <View style={styles.buttonsContainer}>
              <OptionButton
                title="Upload Video"
                iconName="cloud-upload-outline"
                onPress={() => {
                  setVideoToUpload(null);
                  setMode('upload');
                }}
              />
              
              <OptionButton
                title={t('post.recordVideo')}
                iconName="camera-outline"
                onPress={() => {
                  setVideoToUpload(null);
                  setMode('record');
                }}
              />
            </View>
          </View>
        );
      case 'upload':
        return (
          <VideoUploadInterface
            initialVideo={videoToUpload} // Pass recorded video if available
            onCancel={handleUploadCancelled}
            onComplete={handleUploadComplete}
          />
        );
      case 'record':
        return (
          <View style={styles.fullScreenView}>
            <CameraRecord
              onRecordingComplete={handleRecordingComplete}
              onCancel={() => setMode('options')}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fullScreenView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 32,
    paddingLeft: 4,
  },
  noticeContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  noticeText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 4,
  },
  buttonsContainer: {
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  buttonIcon: {
    marginRight: 16,
  },
  buttonText: {
    fontSize: 18,
    color: '#333333',
    fontWeight: '400',
  },
});