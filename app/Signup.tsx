import { useColorScheme } from '@/hooks/useColorScheme';
import apiService from '@/services/apiService';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    city: '',
    state: '',
  });
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email } = formData;

    if (!firstName.trim() || firstName.length < 3) {
      Alert.alert('Error', 'First name must have at least 3 characters');
      return false;
    }

    if (!lastName.trim() || lastName.length < 3) {
      Alert.alert('Error', 'Last name must have at least 3 characters');
      return false;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Email address is required');
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
  
    setLoading(true);
    try {
      const signupData = {
        active: true,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        city: formData.city || '',
        state: formData.state || '',
        otp: 0,
        otpVerified: true,
      };
  
      console.log('Sending signup data:', signupData);
  
      const response = await apiService.signUp(signupData);
      
      // Enhanced debugging
      console.log('=== SIGNUP RESPONSE DEBUG ===');
      console.log('Full response:', JSON.stringify(response, null, 2));
      console.log('response.success:', response.success);
      console.log('response.data:', response.data);
      console.log('response.data.otp:', response.data?.otp);
      console.log('==============================');
  
      if (response.success) {
        // Always navigate to VerifyOtp after successful signup
        console.log('✅ Signup successful - navigating to VerifyOtp');
        
        Alert.alert(
          'Success', 
          'Signup successful! Please check your email for the OTP.',
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('Navigating to VerifyOtp with email:', formData.email);
                setTimeout(() => {
                  router.push(`/VerifyOtp?email=${encodeURIComponent(formData.email)}`);
                }, 100);
              }
            }
          ]
        );
      } else {
        // Check if the error is about email already existing with OTP sent
        const errorMessage = response.error || 'Signup failed';
        
        if (errorMessage.toLowerCase().includes('email already exists') && 
            errorMessage.toLowerCase().includes('otp sent')) {
          console.log('📧 Email exists but OTP sent - navigating to VerifyOtp');
          
          Alert.alert(
            'Account Found', 
            'Email already exists. An OTP has been sent to verify your account.',
            [
              {
                text: 'OK',
                onPress: () => {
                  console.log('Navigating to VerifyOtp with email:', formData.email);
                  setTimeout(() => {
                    router.push(`/VerifyOtp?email=${encodeURIComponent(formData.email)}`);
                  }, 100);
                }
              }
            ]
          );
        } else {
          console.error('❌ Signup failed:', errorMessage);
          Alert.alert('Error', errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  const handleBackPress = () => {
    router.canGoBack() ? router.back() : router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/images/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>All fields with (*) are required.</Text>

          {/* Form Fields */}
          <View style={styles.row}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="First Name*"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Last Name*"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.inputContainerFull}>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              placeholder="Email Address*"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* Email Privacy Radio Buttons */}
          {/* <View style={styles.radioContainer}>
            <Text style={styles.radioLabel}>Do you want your email to be public?</Text>
            <View style={styles.radioOptions}>
              <TouchableOpacity 
                style={styles.radioOption}
                onPress={() => handleRadioChange('Yes')}
              >
                <View style={[styles.radioCircle, emailPublic === 'Yes' && styles.radioSelected]}>
                  {emailPublic === 'Yes' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioText}>Yes</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.radioOption}
                onPress={() => handleRadioChange('No')}
              >
                <View style={[styles.radioCircle, emailPublic === 'No' && styles.radioSelected]}>
                  {emailPublic === 'No' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioText}>No</Text>
              </TouchableOpacity>
            </View>
          </View> */}

          {/* Location Fields */}
          <View style={styles.row}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.city}
                onChangeText={(value) => handleInputChange('city', value)}
                placeholder="City:"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.state}
                onChangeText={(value) => handleInputChange('state', value)}
                placeholder="State:"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          </View>

          {/* Church Field */}
          {/* <View style={styles.inputContainerFull}>
            <TextInput
              style={styles.input}
              value={formData.church}
              onChangeText={(value) => handleInputChange('church', value)}
              placeholder="What church do you attend?"
              placeholderTextColor="#999"
              autoCapitalize="words"
              editable={!loading}
            />
          </View> */}

          {/* Additional Fields (like Android) */}
          {/* <View style={styles.row}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.country}
                onChangeText={(value) => handleInputChange('country', value)}
                placeholder="Country"
                placeholderTextColor="#999"
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.zipCode}
                onChangeText={(value) => handleInputChange('zipCode', value)}
                placeholder="Zip Code"
                placeholderTextColor="#999"
                editable={!loading}
              />
            </View>
          </View> */}

          {/* Date of Birth */}
          {/* <View style={styles.inputContainerFull}>
            <TextInput
              style={styles.input}
              value={formData.dob}
              onChangeText={(value) => handleInputChange('dob', value)}
              placeholder="Date of Birth (YYYY-MM-DD)"
              placeholderTextColor="#999"
              editable={!loading}
            />
          </View> */}

          {/* Biography */}
          {/* <View style={styles.inputContainerFull}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.biography}
              onChangeText={(value) => handleInputChange('biography', value)}
              placeholder="Biography"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              editable={!loading}
            />
          </View> */}

          {/* Gender Picker */}
          {/* <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.gender}
              style={styles.picker}
              onValueChange={(value) => handleInputChange('gender', value)}
              enabled={!loading}
            >
              <Picker.Item label="Select Gender" value="Select Gender" color="#999" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
            </Picker>
          </View> */}

          {/* How did you hear about us Picker */}
          {/* <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.howDidYouKnowAboutUs}
              style={styles.picker}
              onValueChange={(value) => handleInputChange('howDidYouKnowAboutUs', value)}
              enabled={!loading}
            >
              <Picker.Item label="How did you hear about us?" value="How did you hear about us?" color="#999" />
              <Picker.Item label="Radio" value="Radio" />
              <Picker.Item label="Google" value="Google" />
              <Picker.Item label="Facebook" value="Facebook" />
              <Picker.Item label="Instagram" value="Instagram" />
              <Picker.Item label="Lordsbook" value="Lordsbook" />
              <Picker.Item label="Word of Mouth" value="Word of Mouth" />
              <Picker.Item label="My Church" value="My Church" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </View> */}

          {/* Other Specify Field (conditionally shown) */}
          {/* {showOtherField && (
            <View style={styles.inputContainerFull}>
              <TextInput
                style={styles.input}
                value={formData.otherSpecify}
                onChangeText={(value) => handleInputChange('otherSpecify', value)}
                placeholder="Please specify..."
                placeholderTextColor="#999"
                editable={!loading}
              />
            </View>
          )} */}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Next</Text>
            )}
          </TouchableOpacity>

          {/* Login Link */}
          <TouchableOpacity 
            style={styles.loginLink} 
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginLinkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 200,
    height: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputContainer: {
    flex: 1,
  },
  inputContainerFull: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 55,
    color: '#333',
  },
  radioContainer: {
    marginBottom: 24,
    backgroundColor: '#e8e8e8',
    padding: 16,
    borderRadius: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    fontWeight: '500',
  },
  radioOptions: {
    flexDirection: 'row',
    gap: 24,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#3260ad',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3260ad',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#3260ad',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginLinkText: {
    color: '#3260ad',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});