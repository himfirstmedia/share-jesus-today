import apiService from '@/services/apiService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Get parameters from the previous screen (matches Android Intent extras)
  const { otp, otpemail: savedEmail, firstName, lastName } = useLocalSearchParams<{
    otp: string;
    otpemail: string;
    firstName?: string;
    lastName?: string;
  }>();

  useEffect(() => {
    console.log('Reset Password mounted with:', { otp, savedEmail, firstName, lastName });
    
    // If no required parameters, go back (matches Android validation)
    if (!otp || otp === '-1') {
      Alert.alert('Error', 'OTP not found!', [
        {
          text: 'OK',
          onPress: () => {
            router.canGoBack() ? router.back() : router.replace('/login');
          }
        }
      ]);
      return;
    }

    if (!savedEmail) {
      Alert.alert('Error', 'Email not found. Please log in again.', [
        {
          text: 'OK', 
          onPress: () => {
            router.canGoBack() ? router.back() : router.replace('/login');
          }
        }
      ]);
      return;
    }
  }, [otp, savedEmail, router]);

  // Toggle password visibility - matches Android's togglePasswordVisibility
  const togglePasswordVisibility = (field: 'password' | 'confirmPassword') => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  // Reset password API call - matches Android's resetPassword method
  const resetPasswordAPI = async (email: string, newPassword: string, otpValue: string) => {
    try {
      console.log('🔐 Starting password reset API call...');
      
      // Construct the API URL with query parameters (matches Android exactly)
      // "https://himfirstapis.com/api/v1/person/sign-up/reset-password?email=" + email + "&newPassword=" + password + "&otp=" + otp
      const encodedEmail = encodeURIComponent(email);
      const encodedPassword = encodeURIComponent(newPassword);
      const encodedOtp = encodeURIComponent(otpValue);
      
      const endpoint = `/person/sign-up/reset-password?email=${encodedEmail}&newPassword=${encodedPassword}&otp=${encodedOtp}`;
      
      console.log('📡 Reset password endpoint:', endpoint);
      
      // Make PUT request (matches Android's JsonObjectRequest with PUT method)
      const response = await apiService.put(endpoint, {});
      
      console.log('📡 Reset password response:', response);

      if (response.success) {
        // Handle success (matches Android success callback)
        Alert.alert('Success', 'Password reset successfully', [
          {
            text: 'OK',
            onPress: () => {
              navigateToLogin(); // Navigate to login after success
            }
          }
        ]);
      } else {
        // Handle error response (matches Android error handling)
        let errorMessage = response.error || 'Failed to reset password';
        Alert.alert('Error', errorMessage);
        console.error('API Error:', response.error);
      }
    } catch (error) {
      // Handle network error (matches Android error callback)
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
      Alert.alert('Error', `Failed to reset password: ${errorMessage}`);
      console.error('API Error:', error);
    }
  };

  // Handle reset button click - matches Android button click listener
  const handleResetPassword = async () => {
    // Validation - matches Android validation exactly
    
    // Validate password length (matches Android: password.length() < 4)
    if (password.length < 4) {
      Alert.alert('Error', 'Password must be at least 4 characters long');
      return;
    }

    // Validate empty fields (matches Android: TextUtils.isEmpty)
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Both password fields are required');
      return;
    }

    // Check if passwords match (matches Android: !password.equals(confirmPassword))
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Start loading
    setIsLoading(true);

    try {
      // Call API to reset password (matches Android API call)
      await resetPasswordAPI(savedEmail!, password, otp!);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to login - matches Android's navigateToMainActivity
  const navigateToLogin = () => {
    // Clear form fields (similar to Android clearing SharedPreferences)
    setPassword('');
    setConfirmPassword('');
    
    // Navigate to login screen (matches Android Intent to login.class)
    router.replace('/login');
  };

  const handleBack = () => {
    router.canGoBack() ? router.back() : router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={32} color="white" />
            </View>
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.description}>
              Create a new password for your account
            </Text>
            {savedEmail && (
              <Text style={styles.email}>{savedEmail}</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('password')}
              >
                <Ionicons 
                  name={showPassword ? "eye" : "eye-off"} 
                  size={20} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm new password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => togglePasswordVisibility('confirmPassword')}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye" : "eye-off"} 
                  size={20} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset Password Button */}
          <TouchableOpacity
            style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.resetButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3260ad',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3260ad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3260ad',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resetButton: {
    backgroundColor: '#3260ad',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#3260ad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#6B7280',
    fontSize: 16,
  },
  loginLink: {
    color: '#3260ad',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default ResetPassword;