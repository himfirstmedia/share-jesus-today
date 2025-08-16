// app/login.tsx - Updated to match the design
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import apiService from '@/services/apiService';
import AuthManager from '@/utils/authManager';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { t } from '@/utils/i18n';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { height: screenHeight } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Initialize AuthManager when component mounts
  useEffect(() => {
    const initAuth = async () => {
      try {
        await AuthManager.initialize();

        // Check if already authenticated
        if (AuthManager.isAuthenticated()) {
          console.log('✅ Already authenticated, redirecting...');
          router.replace('/' as any);
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    const backAction = () => {
      BackHandler.exitApp(); // Exits the app
      return true; // Prevent default behavior (going back)
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => backHandler.remove();
  }, []);

  // Updated login handler that properly stores user profile data
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('login.error'), t('login.pleaseFillAllFields'));
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Attempting login...');

      const response = await apiService.login({
        userName: email, // Using email as username
        password: password,
      });

      if (response.success && response.data && response.data.jwt) {
        console.log('✅ Login successful, setting up authentication...');
        console.log('📋 Full login response:', response.data);

        // Store JWT token using AuthManager
        await AuthManager.setAuthToken(response.data.jwt);

        // CRITICAL: Store user profile data from login response
        if (response.data.person) {
          const person = response.data.person;
          console.log('👤 Storing user profile data:', person);

          // Store all user profile data (matching Android implementation)
          const userDataToStore = {
            id: person.id,
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            email: person.email || '',
            gender: person.gender || '',
            dob: person.dob || '',
            country: person.country || '',
            state: person.state || '',
            city: person.city || '',
            zipcode: person.zipcode || person.zipCode || '', // Handle both cases
            church: person.church || person.signupchurch || '',
            biography: person.biography || '',
            profilepic: person.profilePicture || '',
            coverimg: person.coverPhoto || '',
            publicemail: person.churchFrom || '',
            phone: person.phone || '',
            address: person.address || '',
            signupchurch: person.church || '',
            createdby: person.createdby || person.createdBy || '',
            updatedby: person.updatedby || person.updatedBy || '',
            createdtimestamp: person.createdtimestamp || person.createdTimestamp || '',
            otp: person.otp ? person.otp.toString() : '',
          };

          // Store each field individually (matching Android SharedPreferences approach)
          for (const [key, value] of Object.entries(userDataToStore)) {
            if (value !== null && value !== undefined) {
              await AsyncStorage.setItem(key, value.toString());
            }
          }

          // Also store currentUserId for compatibility
          await AsyncStorage.setItem('currentUserId', person.id);

          console.log('✅ User profile data stored successfully');

          // Debug storage
          if (__DEV__) {
            console.log('🔍 Verifying stored data:');
            const storedId = await AsyncStorage.getItem('id');
            const storedEmail = await AsyncStorage.getItem('email');
            console.log('  Stored ID:', storedId);
            console.log('  Stored Email:', storedEmail);
            await AuthManager.debugAuthStatus();
          }
        } else {
          console.warn('⚠️ No person data in login response - this might cause profile issues');
        }

        router.replace('/');
      } else {
        const errorMessage = response.error || t('login.loginFailedCheckCredentials');
        Alert.alert(t('login.loginFailed'), errorMessage);
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      Alert.alert(t('login.error'), t('login.anErrorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Add debug function for development
  const debugAuth = async () => {
    if (__DEV__) {
      console.log('🔍 Manual Auth Debug:');
      await AuthManager.debugAuthStatus();

      // Also run the existing auth debugger
      const { AuthDebugger } = await import('@/utils/authDebug');
      await AuthDebugger.runCompleteAuthDiagnostic();
    }
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'white',
    },
    header: {
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 20,
      backgroundColor: 'white',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      alignSelf: 'flex-start',
    },
    backText: {
      fontSize: 18,
      color: '#37455cff',
      marginLeft: 8,
      fontWeight: '500',
    },
    scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 30,
      paddingBottom: 40,
      backgroundColor: 'white',
      minHeight: screenHeight - 120,
    },
    contentContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    logo: {
      width: 280,
      height: 200,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 40,
      color: '#333',
    },
    inputContainer: {
      marginBottom: 20,
      width: '100%',
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
      color: '#666',
    },
    input: {
      borderWidth: 2,
      borderColor: '#333',
      borderRadius: 25,
      padding: 15,
      paddingHorizontal: 20,
      fontSize: 16,
      backgroundColor: 'white',
      color: '#333',
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#333',
      borderRadius: 25,
      backgroundColor: 'white',
    },
    passwordInput: {
      flex: 1,
      padding: 15,
      paddingHorizontal: 20,
      fontSize: 16,
      color: '#333',
    },
    eyeIcon: {
      paddingHorizontal: 15,
    },
    forgotPasswordContainer: {
      alignSelf: 'flex-end',
      marginBottom: 30,
      marginTop: 10,
    },
    forgotPassword: {
      color: '#333',
      fontSize: 14,
      fontWeight: '500',
    },
    loginButton: {
      backgroundColor: '#4472C4',
      borderRadius: 25,
      padding: 15,
      alignItems: 'center',
      marginBottom: 15,
      width: '100%',
    },
    loginButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    createAccountButton: {
      backgroundColor: '#4472C4',
      borderRadius: 25,
      padding: 15,
      alignItems: 'center',
      width: '100%',
    },
    createAccountButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 10,
      textTransform: 'uppercase',
    },
    debugButton: {
      backgroundColor: '#FF6B6B',
      borderRadius: 25,
      padding: 10,
      alignItems: 'center',
      marginTop: 10,
      width: '100%',
    },
    debugButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });

  const handleBack = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with Back Button */}
        <View style={dynamicStyles.header}>
          <TouchableOpacity onPress={handleBack} style={dynamicStyles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#37455cff" />
            <Text style={dynamicStyles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>

        {/* Scrollable content area */}
        <ScrollView
          contentContainerStyle={dynamicStyles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={dynamicStyles.contentContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={dynamicStyles.logo}
              resizeMode="contain"
            />

            <Text style={dynamicStyles.title}>{t('login.signInToContinue')}</Text>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.label}>{t('login.emailLabel')}</Text>
              <TextInput
                style={dynamicStyles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            <View style={dynamicStyles.inputContainer}>
              <Text style={dynamicStyles.label}>{t('login.password')}</Text>
              <View style={dynamicStyles.passwordInputContainer}>
                <TextInput
                  style={dynamicStyles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('login.enterYourPassword')}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={togglePasswordVisibility}
                  style={dynamicStyles.eyeIcon}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={dynamicStyles.forgotPasswordContainer}
              onPress={() => router.push('/forgotpassword')}
            >
              <Text style={dynamicStyles.forgotPassword}>
                {t('login.forgotPassword')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={dynamicStyles.loadingContainer}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={dynamicStyles.loadingText}>{t('login.signingIn')}</Text>
                </View>
              ) : (
                <Text style={dynamicStyles.loginButtonText}>{t('login.signIn')}</Text>
              )}
            </TouchableOpacity>

            <Text style={{color: '#333', marginBottom: 10, marginTop: 10, textAlign: 'center'}}>{t('login.noAccount')}</Text>
            <TouchableOpacity
              style={dynamicStyles.createAccountButton}
              onPress={() => router.push('/Signup')}
              disabled={loading}
            >
              <Text style={dynamicStyles.createAccountButtonText}>{t('menu.createAccount')}</Text>
            </TouchableOpacity>

            {/* Debug button for development */}
            {/* {__DEV__ && (
              <TouchableOpacity
                style={dynamicStyles.debugButton}
                onPress={debugAuth}
              >
                <Text style={dynamicStyles.debugButtonText}>Debug Auth</Text>
              </TouchableOpacity>
            )} */}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}