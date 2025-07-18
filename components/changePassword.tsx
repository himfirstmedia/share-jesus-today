// components/ChangePassword.tsx - Using your existing API service pattern
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AuthManager from '@/utils/authManager';
import apiService from '@/services/apiService'; // Use your existing API service

interface ChangePasswordProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export default function ChangePassword({ onBack, onSuccess }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle back press similar to Android
  useEffect(() => {
    const backAction = () => {
      handleBackPress();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);

  // API call to change password - bypassing API service due to text response
  const changePasswordApiCall = async (currentPassword: string, newPassword: string) => {
    try {
      console.log('🔐 Starting password change...');
      
      // Ensure AuthManager is initialized
      await AuthManager.ensureInitialized();
      
      // Check if user is authenticated
      if (!AuthManager.isAuthenticated()) {
        Alert.alert('Error', 'Authentication token not found. Please login again.');
        return;
      }

      // Get auth token from AuthManager
      const authToken = AuthManager.getAuthToken();
      if (!authToken) {
        Alert.alert('Error', 'Authentication token not found. Please login again.');
        return;
      }

      // Make direct fetch call to handle text response properly
      const url = 'https://himfirstapis.com/api/v1/person/change-password';
      const requestBody = {
        currentPassword: currentPassword,
        newPassword: newPassword,
      };

      console.log('📡 Making direct API call to:', url);
      console.log('📡 Request body:', JSON.stringify(requestBody));

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Password change response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      if (response.ok) {
        // Handle success - API returns text, not JSON
        const responseText = await response.text();
        console.log('✅ Password change success response:', responseText);
        
        Alert.alert('Success', 'Password Changed successfully', [
          {
            text: 'OK',
            onPress: () => {
              navigateToMainActivity();
            },
          },
        ]);
      } else {
        // Handle error
        const responseText = await response.text();
        console.log('❌ Password change error response:', responseText);
        
        let errorMessage = 'Failed to change password';
        
        if (response.status === 401) {
          errorMessage = 'Current password is incorrect or session expired. Please login again.';
        } else if (response.status === 400) {
          errorMessage = 'Invalid password format. Please check your input.';
        } else if (responseText && responseText.trim()) {
          errorMessage = responseText.trim();
        }

        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('💥 Password change error:', error);
      Alert.alert('Error', 'Network error occurred. Please try again.');
    }
  };

  // Handle submit button click - matches Android validation logic
  const handleSubmit = async () => {
    // Validate inputs - exact same validation as Android
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Check if new password and confirm password match
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return;
    }

    setLoading(true);
    await changePasswordApiCall(currentPassword, newPassword);
    setLoading(false);
  };

  // Navigate to main activity - matches Android navigation
  const navigateToMainActivity = () => {
    // Clear form fields
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    // Navigate to More/Menu screen (equivalent to Android's More.class)
    if (onSuccess) {
      onSuccess();
    } else {
      router.replace('/(tabs)/menu'); // Adjust path as needed
    }
  };

  // Handle back press - matches Android back button functionality
  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Toolbar with Back Button - matches Android Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.backContainer}
          onPress={handleBackPress}
        >
          <Ionicons name="arrow-back" size={20} color="#000000" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Title - matches Android TextView */}
      <Text style={styles.title}>Change Password</Text>

      {/* Container for form fields - matches Android LinearLayout */}
      <View style={styles.formContainer}>
        {/* Current Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor="#999999"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Divider Line - matches Android View divider */}
        <View style={styles.divider} />

        {/* New Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor="#999999"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Divider Line */}
        <View style={styles.divider} />

        {/* Confirm New Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#999999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Send Button - matches Android Button */}
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.sendButtonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Toolbar styling - matches Android Toolbar
  toolbar: {
    height: 56, // Standard ActionBar height
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  backContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 20,
    color: '#000000',
    marginLeft: 8,
  },
  // Title styling - matches Android TextView
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 20,
  },
  // Form container - matches Android LinearLayout with margin
  formContainer: {
    margin: 20,
  },
  // Input container - matches Android LinearLayout for each input
  inputContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Input styling - matches Android EditText
  input: {
    flex: 1,
    height: 40,
    marginLeft: 20,
    fontSize: 16,
    color: '#000000',
    // No border to match Android's @drawable/change_password background
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  // Divider line - matches Android View divider
  divider: {
    height: 1,
    backgroundColor: '#D3D3D3',
    marginLeft: 10,
  },
  // Send button - matches Android Button
  sendButton: {
    backgroundColor: '#3260ad', // Blue color matching your theme
    height: 60,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});