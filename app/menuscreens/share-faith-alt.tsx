import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ShareFaithScreen() {
  const [testimony, setTestimony] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleBackPress = () => {
    router.back();
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    Alert.alert(
      "Start Recording",
      "Video recording functionality will be implemented here."
    );
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    Alert.alert(
      "Recording Stopped",
      "Your video testimony has been recorded successfully!"
    );
  };

  const handleUploadVideo = () => {
    Alert.alert(
      "Upload Video",
      "Select a video from your gallery to share your testimony."
    );
  };

  const handleShareTestimony = () => {
    if (testimony.trim() === '') {
      Alert.alert("Please write your testimony", "Share how you touched someone with Jesus' love today.");
      return;
    }
    
    Alert.alert(
      "Share Testimony",
      "Your testimony will be shared with the community!",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Share", 
          onPress: () => {
            // Handle sharing logic here
            setTestimony('');
            Alert.alert("Success", "Your testimony has been shared!");
          }
        }
      ]
    );
  };

  const handleQuickShare = (type) => {
    Alert.alert(
      `Share ${type}`,
      `Quick share ${type.toLowerCase()} functionality coming soon!`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="white" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Your Faith</Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Introduction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Jesus&apos; Love Today</Text>
          <Text style={styles.sectionText}>
            Every person you meet is an appointment by God, not a coincidence! Share how you touched someone with the love of Jesus today.
          </Text>
        </View>

        {/* Video Recording Section */}
        <View style={styles.videoSection}>
          <Text style={styles.videoTitle}>Record Your Video Testimony</Text>
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={48} color="#3260ad" />
            <Text style={styles.videoPlaceholderText}>
              {isRecording ? "Recording..." : "Tap to start recording"}
            </Text>
          </View>
          
          <View style={styles.videoButtons}>
            <TouchableOpacity 
              style={[styles.videoButton, isRecording && styles.recordingButton]} 
              onPress={isRecording ? handleStopRecording : handleStartRecording}
            >
              <Ionicons 
                name={isRecording ? "stop" : "videocam"} 
                size={20} 
                color="white" 
              />
              <Text style={styles.videoButtonText}>
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.uploadButton} onPress={handleUploadVideo}>
              <Ionicons name="cloud-upload" size={20} color="#3260ad" />
              <Text style={styles.uploadButtonText}>Upload Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Written Testimony Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Write Your Testimony</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell us how you shared Jesus' love today. How did the person respond? What was their reaction?"
            value={testimony}
            onChangeText={setTestimony}
            multiline={true}
            numberOfLines={6}
            textAlignVertical="top"
          />
          
          <TouchableOpacity style={styles.shareButton} onPress={handleShareTestimony}>
            <Ionicons name="send" size={20} color="white" />
            <Text style={styles.shareButtonText}>Share Testimony</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Share Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Share Options</Text>
          <View style={styles.quickShareGrid}>
            <TouchableOpacity 
              style={styles.quickShareItem} 
              onPress={() => handleQuickShare('App')}
            >
              <Ionicons name="phone-portrait" size={24} color="#3260ad" />
              <Text style={styles.quickShareText}>Share App</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickShareItem} 
              onPress={() => handleQuickShare('Profile')}
            >
              <Ionicons name="person" size={24} color="#3260ad" />
              <Text style={styles.quickShareText}>Share Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickShareItem} 
              onPress={() => handleQuickShare('Verse')}
            >
              <Ionicons name="book" size={24} color="#3260ad" />
              <Text style={styles.quickShareText}>Share Verse</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickShareItem} 
              onPress={() => handleQuickShare('Prayer')}
            >
              <Ionicons name="heart" size={24} color="#3260ad" />
              <Text style={styles.quickShareText}>Share Prayer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tips for Sharing</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3260ad" />
            <Text style={styles.tipText}>Keep videos to 30 seconds or less</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3260ad" />
            <Text style={styles.tipText}>Share genuine, personal experiences</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3260ad" />
            <Text style={styles.tipText}>Focus on love and positive interactions</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={20} color="#3260ad" />
            <Text style={styles.tipText}>Respect others' privacy and consent</Text>
          </View>
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
  },
  videoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  videoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 16,
  },
  videoPlaceholder: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  videoPlaceholderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  videoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  videoButton: {
    backgroundColor: '#3260ad',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
  },
  recordingButton: {
    backgroundColor: '#D32F2F',
  },
  videoButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#3260ad',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
  },
  uploadButtonText: {
    color: '#3260ad',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1e1b1b',
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
    minHeight: 120,
  },
  shareButton: {
    backgroundColor: '#3260ad',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickShareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  quickShareItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    width: (width - 60) / 2,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickShareText: {
    fontSize: 14,
    color: '#1e1b1b',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
});