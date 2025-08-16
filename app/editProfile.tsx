import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { profileService } from '../services/profileService';
import i18n from '../utils/i18n';

interface UserProfileForm {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender?: string;
  dob?: string;
  country?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  church?: string;
  biography?: string;
  phone?: string;
  address?: string;
  churchFrom?: string;
  howDidYouKnowAboutUs?: string;
  otherSpecify?: string;
  profilePicture?: string;
  coverPhoto?: string;
  createdBy?: string;
  updatedBy?: string;
  createdTimestamp?: string;
}

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => {
    // Initialize selectedDate when profile loads
    if (profile?.dob) {
      const dateFromProfile = new Date(profile.dob);
      if (!isNaN(dateFromProfile.getTime())) {
        setSelectedDate(dateFromProfile);
      }
    }
  }, [profile?.dob]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      console.log('Loading profile data...');
      
      const userData = await profileService.getUserProfile();
      console.log('Profile data loaded:', userData);
      
      if (userData) {
        setProfile({
          id: userData.id || '',
          email: userData.email || '',
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          gender: userData.gender || '',
          dob: userData.dob || '',
          country: userData.country || '',
          state: userData.state || '',
          city: userData.city || '',
          zipCode: userData.zipCode || userData.zipcode || '',
          church: userData.church || '',
          biography: userData.biography || '',
          phone: userData.phone || '',
          address: userData.address || '',
          churchFrom: userData.churchFrom || '',
          howDidYouKnowAboutUs: userData.howDidYouKnowAboutUs || '',
          otherSpecify: userData.otherSpecify || '',
          profilePicture: userData.profilePicture || '',
          coverPhoto: userData.coverPhoto || '',
          createdBy: userData.createdby || userData.createdBy || '',
          updatedBy: userData.updatedby || userData.updatedBy || '',
          createdTimestamp: userData.createdtimestamp || userData.createdTimestamp || '',
        });
      } else {
        Alert.alert(i18n.t('editProfileScreen.errorTitle'), i18n.t('editProfileScreen.profileNotFoundMessage'));
        router.canGoBack() ? router.back() : router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert(i18n.t('editProfileScreen.errorTitle'), i18n.t('editProfileScreen.errorMessage'));
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserProfileForm, value: string) => {
    setProfile(prev => (prev ? { ...prev, [field]: value } : null));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (date) {
      setSelectedDate(date);
      const formattedDate = date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      handleInputChange('dob', formattedDate);
    }
  };

  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return i18n.t('editProfileScreen.dobPlaceholder');
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return i18n.t('editProfileScreen.dobPlaceholder');
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return i18n.t('editProfileScreen.dobPlaceholder');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!profile?.email?.trim()) {
      newErrors.email = i18n.t('editProfileScreen.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(profile.email)) {
      newErrors.email = i18n.t('editProfileScreen.invalidEmail');
    }

    if (!profile?.firstName?.trim()) {
      newErrors.firstName = i18n.t('editProfileScreen.firstNameRequired');
    }

    if (!profile?.lastName?.trim()) {
      newErrors.lastName = i18n.t('editProfileScreen.lastNameRequired');
    }

    // Validate date of birth
    if (profile?.dob && profile.dob.trim()) {
      const dobDate = new Date(profile.dob);
      const today = new Date();
      
      if (isNaN(dobDate.getTime())) {
        newErrors.dob = i18n.t('editProfileScreen.invalidDob');
      } else if (dobDate > today) {
        newErrors.dob = i18n.t('editProfileScreen.dobInFuture');
      } else if (today.getFullYear() - dobDate.getFullYear() > 120) {
        newErrors.dob = i18n.t('editProfileScreen.invalidDobRange');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Create a direct API call method that matches the Android implementation
  const updateProfileDirect = async (profileData: any): Promise<boolean> => {
    try {
      const userId = await AsyncStorage.getItem('id');
      const bearerToken = await AsyncStorage.getItem('jwt') || await AsyncStorage.getItem('authToken');
      
      if (!userId || !bearerToken) {
        throw new Error('Missing user ID or auth token');
      }

      const url = `https://himfirstapis.com/api/v1/person/${userId}`;
      
      console.log('Making direct API call to:', url);
      console.log('Payload:', JSON.stringify(profileData, null, 2));

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', errorData);
        return false;
      }

      const responseData = await response.json();
      console.log('API Response:', responseData);
      
      // Update local storage like Android does
      await updateLocalStorage(profileData);
      
      return true;
    } catch (error) {
      console.error('Direct API call error:', error);
      return false;
    }
  };

  const updateLocalStorage = async (profileData: any) => {
    try {
      const updates = {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: profileData.email || '',
        gender: profileData.gender || '',
        dob: profileData.dob || '',
        country: profileData.country || '',
        state: profileData.state || '',
        city: profileData.city || '',
        zipcode: profileData.zipCode || '', // Store as zipcode for consistency
        biography: profileData.biography || '',
        signupchurch: profileData.church || '',
        publicemail: profileData.churchFrom || '',
        signupother: profileData.otherSpecify || '',
        signupabout: profileData.howDidYouKnowAboutUs || '',
      };

      // Update AsyncStorage
      for (const [key, value] of Object.entries(updates)) {
        await AsyncStorage.setItem(key, value);
      }
      
      console.log('Local storage updated successfully');
    } catch (error) {
      console.error('Error updating local storage:', error);
    }
  };

  const handleSave = async () => {
    if (!profile) {
      Alert.alert(i18n.t('editProfileScreen.errorTitle'), i18n.t('editProfileScreen.noProfileError'));
      return;
    }

    if (!validateForm()) {
      Alert.alert(i18n.t('editProfileScreen.validationErrorTitle'), i18n.t('editProfileScreen.validationErrorMessage'));
      return;
    }

    setSaving(true);
    try {
      console.log('Saving profile data:', profile);
      
      // Get additional data from AsyncStorage like Android does
      const profilepic = await AsyncStorage.getItem('profilepic') || '';
      const coverimg = await AsyncStorage.getItem('coverimg') || '';
      const createdby = await AsyncStorage.getItem('createdby') || '';
      const updatedby = await AsyncStorage.getItem('updatedby') || '';
      const createdtimestamp = await AsyncStorage.getItem('createdtimestamp') || '';
      const userId = await AsyncStorage.getItem('id') || '';

      // Create the exact payload structure that Android sends
      const updatePayload = {
        active: true,
        address: null,
        biography: profile.biography || '',
        church: profile.church || '',
        churchFrom: profile.churchFrom || '',
        city: profile.city || '',
        country: profile.country || '',
        coverPhoto: profile.coverPhoto || coverimg,
        createdBy: profile.createdBy || createdby,
        createdTimestamp: profile.createdTimestamp || createdtimestamp,
        dob: profile.dob || '',
        email: profile.email.trim(),
        firstName: profile.firstName.trim(),
        gender: profile.gender || '',
        howDidYouKnowAboutUs: profile.howDidYouKnowAboutUs || '',
        id: profile.id,
        lastName: profile.lastName.trim(),
        otherSpecify: profile.otherSpecify || '',
        otp: 0,
        otpVerified: true,
        phone: profile.phone || null,
        profilePicture: profile.profilePicture || profilepic,
        state: profile.state || '',
        updatedBy: userId,
        zipCode: profile.zipCode || '',
      };

      console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

      // Use direct API call instead of profileService
      const success = await updateProfileDirect(updatePayload);
      
      if (success) {
        Alert.alert(
          i18n.t('editProfileScreen.successTitle'), 
          i18n.t('editProfileScreen.successMessage'),
          [
            {
              text: 'OK',
              onPress: () => router.canGoBack() ? router.back() : router.replace('/(tabs)')
            }
          ]
        );
      } else {
        Alert.alert(i18n.t('editProfileScreen.errorTitle'), i18n.t('editProfileScreen.errorMessage'));
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert(i18n.t('editProfileScreen.errorTitle'), i18n.t('editProfileScreen.errorMessage'));
    } finally {
      setSaving(false);
    }
  };

  const renderInputField = (
    label: string,
    field: keyof UserProfileForm,
    placeholder: string,
    options?: {
      required?: boolean;
      multiline?: boolean;
      keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    }
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label} {options?.required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          options?.multiline && styles.textArea,
          errors[field] && styles.inputError
        ]}
        value={profile?.[field] || ''}
        onChangeText={text => handleInputChange(field, text)}
        placeholder={placeholder}
        multiline={options?.multiline}
        numberOfLines={options?.multiline ? 4 : 1}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.autoCapitalize || 'sentences'}
        editable={!saving}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
      />
      {errors[field] && (
        <Text style={styles.errorText}>{errors[field]}</Text>
      )}
    </View>
  );

  const renderDatePicker = () => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{i18n.t('editProfileScreen.dobLabel')}</Text>
      <TouchableOpacity
        style={[
          styles.datePickerButton,
          errors.dob && styles.inputError
        ]}
        onPress={() => setShowDatePicker(true)}
        disabled={saving}
      >
        <Text style={[
          styles.datePickerText,
          !profile?.dob && styles.datePickerPlaceholder
        ]}>
          {formatDateForDisplay(profile?.dob || '')}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#666" />
      </TouchableOpacity>
      {errors.dob && (
        <Text style={styles.errorText}>{errors.dob}</Text>
      )}
      
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
        />
      )}
      
      {/* iOS: Show done button */}
      {showDatePicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          style={styles.datePickerDoneButton}
          onPress={() => setShowDatePicker(false)}
        >
          <Text style={styles.datePickerDoneText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{i18n.t('editProfileScreen.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3260AD" />
          <Text style={styles.loadingText}>{i18n.t('editProfileScreen.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{i18n.t('editProfileScreen.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>{i18n.t('editProfileScreen.profileNotFound')}</Text>
          <Text style={styles.errorMessage}>
            {i18n.t('editProfileScreen.profileNotFoundMessage')}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadProfileData}
          >
            <Text style={styles.retryButtonText}>{i18n.t('editProfileScreen.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3260ad"  barStyle="light-content" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{i18n.t('editProfileScreen.title')}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="save-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* Required Fields Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{i18n.t('editProfileScreen.requiredInfo')}</Text>
              
              {renderInputField(i18n.t('editProfileScreen.emailLabel'), 'email', i18n.t('editProfileScreen.emailPlaceholder'), {
                required: true,
                keyboardType: 'email-address',
                autoCapitalize: 'none'
              })}

              {renderInputField(i18n.t('editProfileScreen.firstNameLabel'), 'firstName', i18n.t('editProfileScreen.firstNamePlaceholder'), {
                required: true,
                autoCapitalize: 'words'
              })}

              {renderInputField(i18n.t('editProfileScreen.lastNameLabel'), 'lastName', i18n.t('editProfileScreen.lastNamePlaceholder'), {
                required: true,
                autoCapitalize: 'words'
              })}
            </View>

            {/* Personal Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{i18n.t('editProfileScreen.personalInfo')}</Text>
              
              {renderInputField(i18n.t('editProfileScreen.genderLabel'), 'gender', i18n.t('editProfileScreen.genderPlaceholder'))}

              {renderDatePicker()}

              {renderInputField(i18n.t('editProfileScreen.phoneLabel'), 'phone', i18n.t('editProfileScreen.phonePlaceholder'), {
                keyboardType: 'phone-pad'
              })}

              {renderInputField(i18n.t('editProfileScreen.bioLabel'), 'biography', i18n.t('editProfileScreen.bioPlaceholder'), {
                multiline: true
              })}
            </View>

            {/* Location Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{i18n.t('editProfileScreen.locationInfo')}</Text>
              
              {renderInputField(i18n.t('editProfileScreen.countryLabel'), 'country', i18n.t('editProfileScreen.countryPlaceholder'), {
                autoCapitalize: 'words'
              })}

              {renderInputField(i18n.t('editProfileScreen.stateLabel'), 'state', i18n.t('editProfileScreen.statePlaceholder'), {
                autoCapitalize: 'words'
              })}

              {renderInputField(i18n.t('editProfileScreen.cityLabel'), 'city', i18n.t('editProfileScreen.cityPlaceholder'), {
                autoCapitalize: 'words'
              })}

              {renderInputField(i18n.t('editProfileScreen.zipLabel'), 'zipCode', i18n.t('editProfileScreen.zipPlaceholder'), {
                keyboardType: 'numeric'
              })}

              {renderInputField(i18n.t('editProfileScreen.addressLabel'), 'address', i18n.t('editProfileScreen.addressPlaceholder'), {
                multiline: true
              })}
            </View>

            {/* Church Information Section */}
            {/* <View style={styles.section}>
              <Text style={styles.sectionTitle}>{i18n.t('editProfileScreen.churchInfo')}</Text>
              
              {renderInputField(i18n.t('editProfileScreen.churchLabel'), 'church', i18n.t('editProfileScreen.churchPlaceholder'), {
                autoCapitalize: 'words'
              })}

              {renderInputField(i18n.t('editProfileScreen.churchFromLabel'), 'churchFrom', i18n.t('editProfileScreen.churchFromPlaceholder'))}
            </View> */}

            {/* Additional Information Section */}
            {/* <View style={styles.section}>
              <Text style={styles.sectionTitle}>{i18n.t('editProfileScreen.additionalInfo')}</Text>
              
              {renderInputField(i18n.t('editProfileScreen.howDidYouKnowLabel'), 'howDidYouKnowAboutUs', i18n.t('editProfileScreen.howDidYouKnowPlaceholder'))}

              {renderInputField(i18n.t('editProfileScreen.otherSpecifyLabel'), 'otherSpecify', i18n.t('editProfileScreen.otherSpecifyPlaceholder'))}
            </View> */}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{i18n.t('editProfileScreen.saveButton')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#3260AD',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3260AD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e1b1b',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e1b1b',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  datePickerText: {
    fontSize: 16,
    color: '#111827',
  },
  datePickerPlaceholder: {
    color: '#9CA3AF',
  },
  iosDatePicker: {
    backgroundColor: '#fff',
    marginTop: 10,
  },
  datePickerDoneButton: {
    backgroundColor: '#3260AD',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  datePickerDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#3260AD',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});