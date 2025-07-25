// app/CreatePassword.tsx
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
  View,
} from 'react-native';
import apiService from '../services/apiService';
import { t } from '../utils/i18n';

const CreatePassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  useEffect(() => {
    // If no email, go back
    if (!email) {
      router.back();
    }
  }, [email, router]);

  const validatePassword = (pwd: string) => {
    const errors = [];
    
    if (pwd.length < 8) {
      errors.push(t('createPassword.reqLength'));
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push(t('createPassword.reqUppercase'));
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push(t('createPassword.reqLowercase'));
    }
    if (!/\d/.test(pwd)) {
      errors.push(t('createPassword.reqNumber'));
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
      errors.push(t('createPassword.reqSpecialChar'));
    }
    
    return errors;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError('');
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setError('');
  };

  const createPassword = async () => {
    // Validate password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setError(`${t('createPassword.passwordRequirements')}: ${passwordErrors.join(', ')}`);
      return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      setError(t('createPassword.alertPasswordMismatch'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('Setting password for email:', email);
      
      const response = await apiService.setPassword(email!, password);

      console.log('Set password response:', response);

      if (response.success) {
        setSuccess(t('createPassword.alertSuccessTitle'));
        setTimeout(() => {
          // Navigate to login screen
          Alert.alert(
            t('createPassword.alertSuccessTitle'),
            t('createPassword.alertSuccessMessage'),
            [
              {
                text: t('createPassword.alertOk'),
                onPress: () => {
                  // Navigate to home/login screen using Expo Router
                  router.replace('/login');
                }
              }
            ]
          );
        }, 1500);
      } else {
        setError(response.error || t('createPassword.alertFailedToCreate'));
      }
    } catch (error) {
      console.error('Set password error:', error);
      setError(t('createPassword.alertNetworkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const passwordErrors = validatePassword(password);
  const isPasswordValid = passwordErrors.length === 0;
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={32} color="#2563EB" />
          </View>
        </View>

        {/* Title and Description */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{t('createPassword.title')}</Text>
          <Text style={styles.description}>
            {t('createPassword.description')}
          </Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Success Message */}
        {success ? (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('createPassword.passwordLabel')}</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={[
                styles.passwordInput,
                password ? (isPasswordValid ? styles.inputValid : styles.inputInvalid) : {}
              ]}
              placeholder={t('createPassword.passwordPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#6B7280" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>{t('createPassword.confirmPasswordLabel')}</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={[
                styles.passwordInput,
                confirmPassword ? (doPasswordsMatch ? styles.inputValid : styles.inputInvalid) : {}
              ]}
              placeholder={t('createPassword.confirmPasswordPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons 
                name={showConfirmPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#6B7280" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>{t('createPassword.passwordRequirements')}:</Text>
          {[
            { text: t('createPassword.reqLength'), valid: password.length >= 8 },
            { text: t('createPassword.reqUppercase'), valid: /[A-Z]/.test(password) },
            { text: t('createPassword.reqLowercase'), valid: /[a-z]/.test(password) },
            { text: t('createPassword.reqNumber'), valid: /\d/.test(password) },
            { text: t('createPassword.reqSpecialChar'), valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
          ].map((requirement, index) => (
            <View key={index} style={styles.requirementItem}>
              <Ionicons 
                name={requirement.valid ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={requirement.valid ? "#10B981" : "#9CA3AF"} 
              />
              <Text style={[
                styles.requirementText,
                requirement.valid && styles.requirementTextValid
              ]}>
                {requirement.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Create Password Button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (!isPasswordValid || !doPasswordsMatch || isLoading) && styles.createButtonDisabled
          ]}
          onPress={createPassword}
          disabled={!isPasswordValid || !doPasswordsMatch || isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={[styles.createButtonText, { marginLeft: 8 }]}>Creating...</Text>
            </View>
          ) : (
            <Text style={styles.createButtonText}>Create Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Add your existing styles here
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
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
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
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
    fontWeight: '500',
    color: '#2563EB',
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  successText: {
    color: '#166534',
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  inputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  inputInvalid: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 17,
    padding: 2,
  },
  requirementsContainer: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  requirementTextValid: {
    color: '#10B981',
  },
  createButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default CreatePassword;