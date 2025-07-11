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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { profileService } from '../services/profileService'; // Assuming profileService can fetch and update

interface UserProfileForm {
  firstName: string;
  lastName: string;
  gender?: string;
  dob?: string; // Consider using a date picker for better UX
  country?: string;
  state?: string;
  city?: string;
  zipcode?: string;
  church?: string;
  biography?: string;
}

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        // Assuming profileService.getUserProfile() fetches the necessary data
        const userData = await profileService.getUserProfile();
        if (userData) {
          setProfile({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            gender: userData.gender || '',
            dob: userData.dob || '', // May need formatting if it's a Date object
            country: userData.country || '',
            state: userData.state || '',
            city: userData.city || '',
            zipcode: userData.zipcode || '',
            church: userData.church || '',
            biography: userData.biography || '',
          });
        } else {
          Alert.alert('Error', 'Could not load profile data.');
        }
      } catch (error) {
        console.error('Failed to load profile data:', error);
        Alert.alert('Error', 'Failed to load profile data. Please try again.');
        router.back(); // Go back if data can't be loaded
      } finally {
        setLoading(false);
      }
    };
    loadProfileData();
  }, []);

  const handleInputChange = (field: keyof UserProfileForm, value: string) => {
    setProfile(prev => (prev ? { ...prev, [field]: value } : null));
  };

  const handleSave = async () => {
    if (!profile) {
      Alert.alert('Error', 'No profile data to save.');
      return;
    }
    setSaving(true);
    try {
      // Assuming profileService.updateUserProfile takes the profile data
      // You might need to map `profile` back to the expected UserProfile structure if they differ
      const success = await profileService.updateProfile(profile); 
      if (success) {
        Alert.alert('Success', 'Profile updated successfully.');
        router.back(); // Navigate back to the profile screen
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
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    // This case should ideally be handled by the loading error, but as a fallback:
    return (
      <SafeAreaView style={styles.container}>
         <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={saving}>
            <Ionicons name="arrow-back" size={24} color="#1e1b1b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.content}>
          <Text>Could not load profile data.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
      <ScrollView style={styles.scrollView}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput
              style={styles.input}
              value={profile.firstName}
              onChangeText={text => handleInputChange('firstName', text)}
              placeholder="Enter first name"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={profile.lastName}
              onChangeText={text => handleInputChange('lastName', text)}
              placeholder="Enter last name"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TextInput
              style={styles.input}
              value={profile.gender}
              onChangeText={text => handleInputChange('gender', text)}
              placeholder="e.g., Male, Female, Other"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={profile.dob} // Consider a DatePicker component here
              onChangeText={text => handleInputChange('dob', text)}
              placeholder="YYYY-MM-DD"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={profile.country}
              onChangeText={text => handleInputChange('country', text)}
              placeholder="Enter country"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>State/Province</Text>
            <TextInput
              style={styles.input}
              value={profile.state}
              onChangeText={text => handleInputChange('state', text)}
              placeholder="Enter state or province"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={profile.city}
              onChangeText={text => handleInputChange('city', text)}
              placeholder="Enter city"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Zip/Postal Code</Text>
            <TextInput
              style={styles.input}
              value={profile.zipcode}
              onChangeText={text => handleInputChange('zipcode', text)}
              placeholder="Enter zip or postal code"
              keyboardType="numeric"
              editable={!saving}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Church</Text>
            <TextInput
              style={styles.input}
              value={profile.church}
              onChangeText={text => handleInputChange('church', text)}
              placeholder="Enter church name (optional)"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Biography</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={profile.biography}
              onChangeText={text => handleInputChange('biography', text)}
              placeholder="Tell us a bit about yourself..."
              multiline
              numberOfLines={4}
              editable={!saving}
            />
          </View>
        </View>
      </ScrollView>
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
  },
  content: { // Fallback content style if needed
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
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
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB', // A light gray
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#F9FAFB', // A very light gray for input background
    color: '#111827', // Darker text for readability
  },
  textArea: {
    height: 100, // Adjust as needed
    textAlignVertical: 'top', // Important for multiline
  },
});
