import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../../utils/i18n';

export default function ContactUsScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBackPress = () => {
    router.navigate('/(tabs)/menu');
  };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert(t('common.error'), t('contactUsScreen.fillAllFields'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(t('common.error'), t('contactUsScreen.invalidEmail'));
      return;
    }

    // Phone validation (if provided)
    if (phone.trim()) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        Alert.alert(t('common.error'), t('contactUsScreen.invalidPhone'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const requestData = {
        email: email.trim(),
        message: message.trim(),
        name: name.trim(),
        phoneNumber: phone.trim() || ''
      };

      const response = await fetch('https://himfirstapis.com/api/v1/notifications/public/message-for-support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        const responseData = await response.json();
        Alert.alert(
          t('contactUsScreen.messageSentTitle'),
          t('contactUsScreen.messageSentText'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                // Clear form
                setName('');
                setPhone('');
                setEmail('');
                setMessage('');
              }
            }
          ]
        );
        console.log(responseData);
        
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('contactUsScreen.submissionFailed'),
        [{ text: t('common.ok') }]
      );
      console.log(error);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1e1b1b" />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Title */}
        <Text style={styles.title}>{t('contactUsScreen.title')}</Text>

        {/* Form */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>{t('contactUsScreen.nameLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('contactUsScreen.namePlaceholder')}
            value={name}
            onChangeText={setName}
            placeholderTextColor="#1e1b1b"
            editable={!isLoading}
          />

          <Text style={styles.label}>{t('contactUsScreen.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('contactUsScreen.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#1e1b1b"
            editable={!isLoading}
          />

          <Text style={styles.label}>{t('contactUsScreen.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('contactUsScreen.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholderTextColor="#1e1b1b"
            editable={!isLoading}
          />

          <Text style={styles.label}>{t('contactUsScreen.messageLabel')}</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder={t('contactUsScreen.messagePlaceholder')}
            value={message}
            onChangeText={setMessage}
            multiline={true}
            numberOfLines={5}
            textAlignVertical="top"
            placeholderTextColor="#1e1b1b"
            editable={!isLoading}
          />

          <TouchableOpacity 
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('contactUsScreen.submitButton')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#d0d0d0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 18,
    color: '#1e1b1b',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1e1b1b',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: '#1e1b1b',
    marginBottom: 8,
    marginTop: 20,
    fontWeight: '500',
  },
  input: {
    borderWidth: 2,
    borderColor: '#1e1b1b',
    borderRadius: 15,
    padding: 18,
    fontSize: 16,
    color: '#1e1b1b',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  messageInput: {
    height: 140,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3260ad',
    borderRadius: 30,
    paddingVertical: 20,
    marginTop: 40,
    alignItems: 'center',
    marginHorizontal: 0,
  },
  submitButtonDisabled: {
    backgroundColor: '#A0A0A0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
});