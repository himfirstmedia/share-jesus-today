// Step 1: Create the ChangePassword screen
// File: app/menuscreens/changepassword.tsx

import React from 'react';
import ChangePassword from '../../components/changePassword';
import { router } from 'expo-router';

export default function ChangePasswordScreen() {
  const handleBack = () => {
    router.navigate('/(tabs)/menu');
  };

  const handleSuccess = () => {
    // Navigate back to menu after successful password change
    router.navigate('/(tabs)/menu');
  };

  return (
    <ChangePassword 
      onBack={handleBack}
      onSuccess={handleSuccess}
    />
  );
}


