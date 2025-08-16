import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { profileService } from '../services/profileService'; // Import profileService

export default function EditCoverPhotoScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    // Request media library permissions
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You've refused to allow this app to access your photos. Please enable access in your settings.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [16, 9], // Aspect ratio for cover photo
      quality: 1, // High quality
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) {
      Alert.alert("No Image", "Please select an image first.");
      return;
    }
    setIsLoading(true);
    try {
      const uploadedImageUrl = await profileService.uploadCoverPhoto(imageUri);
      if (uploadedImageUrl) {
        Alert.alert("Success", "Cover photo uploaded successfully!");
        // In a real app, you might want to pass the new URL back or trigger a refresh
        // For now, just navigate back. The profile page should ideally refresh.
        router.back(); 
      } else {
        Alert.alert("Upload Failed", "Could not upload the cover photo. Please try again.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", `An error occurred during upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => !isLoading && router.back()} style={styles.closeButton} disabled={isLoading}>
          <Ionicons name="close" size={28} color={isLoading ? "#ccc" : "#333"} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Cover Photo</Text>
      </View>
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Uploading...</Text>
          </View>
        ) : null}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={100} color="#ccc" />
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
        <View style={styles.buttonContainer}>
          <Button title="Select New Image" onPress={pickImage} disabled={isLoading} />
          {imageUri && (
            <View style={styles.uploadButton}>
              <Button title="Save Cover Photo" onPress={handleUpload} color="#007bff" disabled={isLoading} />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8'
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 15,
    color: '#333',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    resizeMode: 'contain',
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 20,
  },
  placeholderText: {
    marginTop: 10,
    color: '#aaa',
    fontSize: 16,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 'auto', // Pushes buttons to the bottom
    paddingVertical: 10,
  },
  uploadButton: {
    marginTop: 10, // Add some space above the upload button
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1, // Ensure it's on top
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  }
});
