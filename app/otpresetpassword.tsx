import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const OTPResetPassword = () => {
  const [otp, setOtp] = useState(['', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const router = useRouter();
  
  // Get parameters from the previous screen (matches Android Intent extras)
  const { otp: otpFromIntent, otpemail: savedEmail, firstName, lastName } = useLocalSearchParams<{
    otp: string;
    otpemail: string;
    firstName?: string;
    lastName?: string;
  }>();

  useEffect(() => {
    console.log('OTP Reset Password mounted with:', { otpFromIntent, savedEmail, firstName, lastName });
    
    // Focus first input on mount
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
    
    // If no required parameters, go back
    if (!otpFromIntent || !savedEmail) {
      console.error('Missing required parameters, going back');
      router.canGoBack() ? router.back() : router.replace('/login');
    }
  }, [otpFromIntent, savedEmail, router]);

  // Handle input change - matches Android's GenericTextWatcher
  const handleInputChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) {
      value = value.slice(-1);
    }
    
    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input (matches Android auto-focus logic)
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle key press - matches Android's GenericKeyEvent
  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace (matches Android delete key handling)
    if (key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // If current field is empty, clear previous field and focus it
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        // If current field has value, just clear it
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  // Handle paste from clipboard - matches Android's enableClipboardPaste
  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      
      // Validate pasted data (should be 5 digits) - matches Android validation
      if (!/^\d{5}$/.test(clipboardContent)) {
        Alert.alert('Invalid OTP', 'Please paste a valid 5-digit OTP');
        return;
      }

      // Show toast with pasted OTP (matches Android Toast)
      Alert.alert('OTP Pasted', `OTP pasted: ${clipboardContent}`);

      // Distribute digits across inputs - matches Android's distributeDigits
      const newOtp = clipboardContent.split('');
      setOtp(newOtp);
      
      // Focus last input (matches Android focus behavior)
      inputRefs.current[4]?.focus();
      
      setSuccess('OTP pasted successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  // Verify OTP - matches Android's verifyOtp method exactly
  const verifyOtp = async () => {
    // Concatenate entered OTP (matches Android logic)
    const enteredOtp = otp.join('');
    
    // Validation - matches Android validation
    if (enteredOtp.length !== 5) {
      Alert.alert('Error', 'Please enter a 5-digit OTP');
      return;
    }

    // Compare entered OTP with OTP from intent (matches Android comparison)
    if (parseInt(enteredOtp) !== parseInt(otpFromIntent!)) {
      Alert.alert('Error', 'Invalid OTP. Please try again.');
      return;
    }

    // Show success message (matches Android Toast)
    Alert.alert('Success', 'OTP Verified Successfully', [
      {
        text: 'OK',
        onPress: () => {
          // Navigate to reset password screen (matches Android Intent)
          router.push({
            pathname: '/resetPassword',
            params: {
              otp: otpFromIntent,
              otpemail: savedEmail,
              firstName,
              lastName
            }
          });
        }
      }
    ]);
  };

  const handleBack = () => {
    router.canGoBack() ? router.back() : router.replace('/login');
  };

  // Handle long press for paste (matches Android's setupLongPressBehavior)
  const handleLongPress = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      
      if (clipboardContent && clipboardContent.trim() !== '') {
        const pastedOtp = clipboardContent.trim();
        
        // Show toast with pasted OTP (matches Android)
        Alert.alert('OTP Pasted', `OTP pasted: ${pastedOtp}`);
        
        // Validate and distribute OTP digits (matches Android logic)
        if (pastedOtp.match(/^\d{5}$/)) {
          const newOtp = pastedOtp.split('');
          setOtp(newOtp);
          inputRefs.current[4]?.focus();
        } else {
          Alert.alert('Invalid OTP', 'Invalid OTP pasted. Please paste a valid 5-digit OTP.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to access clipboard');
    }
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
              <Ionicons name="shield-checkmark" size={32} color="white" />
            </View>
          </View>

          {/* Title and Description */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.description}>
              OTP verification sent to
            </Text>
            <Text style={styles.email}>{savedEmail}</Text>
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

          {/* OTP Input Fields */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : {},
                  error ? styles.otpInputError : {},
                ]}
                value={digit}
                onChangeText={(value: string) => handleInputChange(index, value)}
                onKeyPress={({ nativeEvent }: { nativeEvent: { key: string } }) => 
                  handleKeyPress(index, nativeEvent.key)
                }
                onPress={handleLongPress}
                keyboardType="numeric"
                maxLength={1}
                selectTextOnFocus
                editable={!isLoading}
              />
            ))}
          </View>

          {/* Paste Button */}
          <TouchableOpacity onPress={handlePaste} style={styles.pasteButton} disabled={isLoading}>
            <Text style={styles.pasteButtonText}>Paste from Clipboard</Text>
          </TouchableOpacity>

          {/* Verify Button */}
          <TouchableOpacity 
            onPress={verifyOtp} 
            style={[
              styles.verifyButton,
              isLoading && styles.verifyButtonDisabled
            ]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Having trouble? </Text>
            <TouchableOpacity onPress={() => router.replace('/login')}>
              <Text style={styles.loginLink}>Go back to Login</Text>
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
  successContainer: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    backgroundColor: '#fff',
  },
  otpInputFilled: {
    borderColor: '#3260ad',
    backgroundColor: '#EFF6FF',
  },
  otpInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  pasteButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pasteButtonText: {
    color: '#3260ad',
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  verifyButton: {
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
  verifyButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
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

export default OTPResetPassword;