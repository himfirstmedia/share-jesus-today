import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { profileService } from '../services/profileService';

const { width, height } = Dimensions.get('window');

interface ProfilePicturePageProps {
  currentImageUri?: string;
  onImageSaved?: (imageUri: string) => void;
  onCancel?: () => void;
}

const ProfilePicturePage: React.FC<ProfilePicturePageProps> = ({
  currentImageUri,
  onImageSaved,
  onCancel,
}) => {
  // ALL STATE HOOKS MUST BE DECLARED FIRST - NO CONDITIONALS BEFORE THESE
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImageUri || null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  // ALL HOOK CALLS MUST BE IN THE SAME ORDER EVERY RENDER
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // ALL useEffect HOOKS MUST BE DECLARED WITH CONSISTENT DEPENDENCY ARRAYS
  useEffect(() => {
    setSelectedImage(currentImageUri || null);
  }, [currentImageUri]);

  const requestPermissions = async () => {
    // Request camera permissions
    if (!cameraPermission?.granted) {
      const cameraResponse = await requestCameraPermission();
      if (!cameraResponse.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please enable photo library access to select images.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  };

  const pickImageFromLibrary = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setShowOptions(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image from library');
    }
  };

  const takePicture = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      setShowCamera(true);
      setShowOptions(false);
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const capturePhoto = async () => {
    try {
      if (!cameraRef.current) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo) {
        setSelectedImage(photo.uri);
        setShowCamera(false);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const uploadProfilePicture = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    try {
      setIsUploading(true);

      // Upload the image using the profile service
      const uploadedImageUrl = await profileService.uploadProfilePicture(selectedImage);

      if (uploadedImageUrl) {
        // Update the stored profile picture URL
        await AsyncStorage.setItem('profilepic', uploadedImageUrl);
        
        // Call the callback with the new image URL
        onImageSaved?.(uploadedImageUrl);
        
        Alert.alert('Success', 'Profile picture updated successfully!');
      } else {
        Alert.alert('Error', 'Failed to upload profile picture');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const removeCurrentImage = () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your current profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSelectedImage(null);
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    setSelectedImage(currentImageUri || null);
    onCancel?.();
  };

  const renderImagePreview = () => {
    return (
      <View style={styles.imagePreviewContainer}>
        <View style={styles.imageContainer}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Ionicons name="person-outline" size={60} color="#9CA3AF" />
              <Text style={styles.placeholderText}>No Profile Picture</Text>
            </View>
          )}
        </View>
        
        {selectedImage && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={removeCurrentImage}
            disabled={isUploading}
          >
            <Ionicons name="close-circle" size={30} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderActionButtons = () => {
    return (
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.selectImageButton}
          onPress={() => setShowOptions(true)}
          disabled={isUploading}
        >
          <Ionicons name="images-outline" size={24} color="#4F46E5" />
          <Text style={styles.selectImageButtonText}>
            {selectedImage ? 'Change Photo' : 'Add Photo'}
          </Text>
        </TouchableOpacity>

        {selectedImage && (
          <TouchableOpacity
            style={[styles.saveButton, isUploading && styles.disabledButton]}
            onPress={uploadProfilePicture}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark-outline" size={24} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>
              {isUploading ? 'Uploading...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderOptionsModal = () => {
    return (
      <Modal
        visible={showOptions}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Select Photo</Text>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={takePicture}
            >
              <Ionicons name="camera-outline" size={24} color="#4F46E5" />
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={pickImageFromLibrary}
            >
              <Ionicons name="images-outline" size={24} color="#4F46E5" />
              <Text style={styles.optionText}>Choose from Library</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelOptionButton}
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.cancelOptionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCameraModal = () => {
    return (
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <SafeAreaView style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.cameraCloseButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Take Profile Picture</Text>
          </View>

          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={capturePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Picture</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionTitle}>Update Your Profile Picture</Text>
          <Text style={styles.instructionText}>
            Choose a clear photo of yourself to help others recognize you.
          </Text>
        </View>

        {renderImagePreview()}
        {renderActionButtons()}
      </ScrollView>

      {renderOptionsModal()}
      {renderCameraModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  instructionContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  instructionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  imageContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
  },
  actionButtonsContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  selectImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4F46E5',
    gap: 8,
  },
  selectImageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  optionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  cancelOptionButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#EF4444',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  cameraCloseButton: {
    padding: 8,
  },
  cameraTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
});

export default ProfilePicturePage;