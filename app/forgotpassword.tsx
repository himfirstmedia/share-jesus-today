import apiService from '@/services/apiService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { t } from '../utils/i18n';

// Types matching the Android implementation
interface PasswordResetResponse {
  otp: number;
  firstName: string;
  lastName: string;
}

interface PasswordResetRequest {
  email: string;
}

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  

  // API service call using correct endpoint - matches Android's ApiServicePasswordReset
  const submitResetRequest = async () => {
    // Show loading state
    setIsLoading(true);

    const emailValue = email.trim();

    // Validation - exact same as Android
    if (emailValue === '') {
      Alert.alert(t('forgotPassword.alertError'), t('forgotPassword.alertEnterEmail'));
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔐 Starting password reset for email:', emailValue);

      // Use the correct endpoint that matches Android's ApiServicePasswordReset
      // @PUT("api/v1/person/sign-up/resend-otp") with @Query("email")
      const encodedEmail = encodeURIComponent(emailValue);
      const endpoint = `/person/sign-up/resend-otp?email=${encodedEmail}`;
      
      const response = await apiService.put<PasswordResetResponse>(endpoint, {});

      console.log('📡 Password reset response:', response);

      if (response.success && response.data) {
        const { otp, firstName, lastName } = response.data;

        // Show success message - matches Android toast
        Alert.alert(t('forgotPassword.alertSuccess'), t('forgotPassword.alertOtpSent'), [
          {
            text: t('forgotPassword.alertOk'),
            onPress: () => {
              // Navigate to OTP verification screen - matches Android Intent
              router.push({
                pathname: '/otpresetpassword',
                params: {
                  otp: otp.toString(),
                  otpemail: emailValue,
                  firstName: firstName || '',
                  lastName: lastName || ''
                }
              });
            }
          }
        ]);
      } else {
        // Handle API service error response
        let errorMessage = response.error || t('forgotPassword.alertFailedToSendOtp');
        
        // Handle specific error cases
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          errorMessage = t('forgotPassword.alertEmailNotFound');
        } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          errorMessage = t('forgotPassword.alertUnableToProcess');
        } else if (errorMessage.includes('500') || errorMessage.includes('server')) {
          errorMessage = t('forgotPassword.alertServerError');
        }
        
        Alert.alert(t('forgotPassword.alertError'), errorMessage);
        console.error('API Error:', response.error);
      }
    } catch (error) {
      // Handle network failure - matches Android onFailure
      const errorMessage = error instanceof Error ? error.message : t('forgotPassword.alertNetworkError');
            Alert.alert(t('forgotPassword.alertError'), `${t('forgotPassword.alertGenericError')}${errorMessage}`);
      console.error('API Error:', error);
    } finally {
      setIsLoading(false);
    }
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
              <Ionicons name="lock-closed" size={32} color="white" />
            </View>
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t('forgotPassword.title')}</Text>
            <Text style={styles.description}>
              {t('forgotPassword.description')}
            </Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t('forgotPassword.emailLabel')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('forgotPassword.emailPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
            onPress={submitResetRequest}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.resetButtonText}>{t('forgotPassword.sendResetCode')}</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>{t('forgotPassword.rememberPassword')} </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>{t('forgotPassword.signIn')}</Text>
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
    lineHeight: 24,
    paddingHorizontal: 20,
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
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
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

export default ForgotPassword;