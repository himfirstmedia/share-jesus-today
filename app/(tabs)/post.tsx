// app/post.tsx - Updated to use VideoUploadInterface
import { t } from '@/utils/i18n';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AuthManager from '../../utils/authManager';
import CameraRecord from '../camera';
import VideoUploadInterface from '../VideoUpload'; // Import the new component

type PostMode = 'options' | 'upload' | 'record';

const { width, height } = Dimensions.get('window');

export default function PostVideoScreen() {
  const [mode, setMode] = useState<PostMode>('options');
  const [videoToUpload, setVideoToUpload] = useState<any>(null);

  useEffect(() => {
    if (!AuthManager.isAuthenticated()) {
      router.replace('/(tabs)/AuthLanding');
    }
  }, []);

  const handleRecordingComplete = (videoFile: any) => {
    if (videoFile && videoFile.uri) {
      // Directly navigate to CameraUpload with the recorded video data
      router.replace({
        pathname: '/CameraUpload',
        params: {
          videoUri: videoFile.uri,
          videoName: videoFile.name || `recorded_video_${Date.now()}.mp4`,
          videoType: videoFile.type || 'video/mp4',
        },
      });
    } else {
      setMode('options'); // Go back to options if recording failed or was cancelled
    }
  };

  const handleRecordAgain = () => {
    setVideoToUpload(null);
    setMode('record');
  };

  const handleUploadCancelled = () => {
    setVideoToUpload(null);
    setMode('options');
  };

  const handleUploadComplete = () => {
    setVideoToUpload(null);
    setMode('options');
    router.push('/watchVideos'); // Navigate to watch videos screen after successful upload
  };

  const renderContent = () => {
    switch (mode) {
      case 'options':
        return (
          <View style={styles.optionsContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#333333" />
              </TouchableOpacity>
              <Text style={styles.title}>{t('postScreen.title')}</Text>
            </View>
            
            <View style={styles.noticeContainer}>
              <Text style={styles.noticeText}>
                {t('postScreen.notice1')}
                 {t('postScreen.notice2')}
              </Text>
   
            </View>
            
            <View style={styles.buttonsContainer}>
              <OptionButton
                title={t('postScreen.uploadButton')}
                iconName="cloud-upload-outline"
                onPress={() => {
                  setVideoToUpload(null);
                  setMode('upload');
                }}
              />
              
              <OptionButton
                title={t('postScreen.recordButton')}
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
      <StatusBar backgroundColor="#3260AD" barStyle="light-content" />
      <View style={styles.container}>
        {renderContent()}
      </View>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#3260AD',
  },
  fullScreenView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    alignContent:'center',
    justifyContent:'center',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerBackButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  noticeContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  noticeText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    marginBottom:1,
    textAlign: 'left',
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