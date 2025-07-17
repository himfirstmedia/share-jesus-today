import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { profileService } from '../services/profileService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  useEffect(() => {
    loadProfileData();
  }, []);

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
        Alert.alert('Error', 'Could not load profile data. Please try logging in again.');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
      router.back();
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

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!profile?.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(profile.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!profile?.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!profile?.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Optional: Validate date of birth format
    if (profile?.dob && profile.dob.trim()) {
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(profile.dob)) {
        newErrors.dob = 'Date format should be YYYY-MM-DD';
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
      Alert.alert('Error', 'No profile data to save.');
      return;
    }

    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
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
          'Success', 
          'Profile updated successfully.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3260AD" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Profile Not Found</Text>
          <Text style={styles.errorMessage}>
            Could not load profile data. Please try logging in again.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadProfileData}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#3260AD" />
            ) : (
              <Ionicons name="save-outline" size={24} color="#3260AD" />
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
              <Text style={styles.sectionTitle}>Required Information</Text>
              
              {renderInputField('Email', 'email', 'Enter email address', {
                required: true,
                keyboardType: 'email-address',
                autoCapitalize: 'none'
              })}

              {renderInputField('First Name', 'firstName', 'Enter first name', {
                required: true,
                autoCapitalize: 'words'
              })}

              {renderInputField('Last Name', 'lastName', 'Enter last name', {
                required: true,
                autoCapitalize: 'words'
              })}
            </View>

            {/* Personal Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>
              
              {renderInputField('Gender', 'gender', 'e.g., Male, Female, Other')}

              {renderInputField('Date of Birth', 'dob', 'YYYY-MM-DD', {
                keyboardType: 'numeric'
              })}

              {renderInputField('Phone Number', 'phone', 'Enter phone number', {
                keyboardType: 'phone-pad'
              })}

              {renderInputField('Biography', 'biography', 'Tell us a bit about yourself...', {
                multiline: true
              })}
            </View>

            {/* Location Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location Information</Text>
              
              {renderInputField('Country', 'country', 'Enter country', {
                autoCapitalize: 'words'
              })}

              {renderInputField('State/Province', 'state', 'Enter state or province', {
                autoCapitalize: 'words'
              })}

              {renderInputField('City', 'city', 'Enter city', {
                autoCapitalize: 'words'
              })}

              {renderInputField('Zip/Postal Code', 'zipCode', 'Enter zip or postal code', {
                keyboardType: 'numeric'
              })}

              {renderInputField('Address', 'address', 'Enter full address', {
                multiline: true
              })}
            </View>

            {/* Church Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Church Information</Text>
              
              {renderInputField('Church', 'church', 'Enter church name (optional)', {
                autoCapitalize: 'words'
              })}

              {renderInputField('Church From', 'churchFrom', 'e.g., Yes, No')}
            </View>

            {/* Additional Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              
              {renderInputField('How Did You Know About Us?', 'howDidYouKnowAboutUs', 'e.g., Radio, Google, Facebook, etc.')}

              {renderInputField('Other Specify', 'otherSpecify', 'Please specify if you selected "Other"')}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e1b1b',
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