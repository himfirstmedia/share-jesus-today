// utils/authDebug.ts - Authentication Debug Utility
import AsyncStorage from '@react-native-async-storage/async-storage';

export class AuthDebugger {
  
  // Check all possible auth token locations
  static async checkAllTokens(): Promise<void> {
    console.log('🔍 AUTH DEBUG: Checking all possible token storage locations...');
    
    const tokenKeys = [
      'authToken',
      'jwt', 
      'token',
      'accessToken',
      'userToken',
      'bearerToken'
    ];

    for (const key of tokenKeys) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          console.log(`✅ AUTH DEBUG: Found token at key '${key}':`, value.substring(0, 20) + '...');
        } else {
          console.log(`❌ AUTH DEBUG: No token found at key '${key}'`);
        }
      } catch (error) {
        console.log(`💥 AUTH DEBUG: Error checking key '${key}':`, error);
      }
    }
  }

  // Check all AsyncStorage keys
  static async checkAllStorageKeys(): Promise<void> {
    console.log('🗂️ AUTH DEBUG: Checking all AsyncStorage keys...');
    
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log('📋 AUTH DEBUG: All storage keys:', allKeys);
      
      // Check auth-related keys
      const authRelatedKeys = allKeys.filter(key => 
        key.toLowerCase().includes('auth') || 
        key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('jwt') ||
        key.toLowerCase().includes('user')
      );
      
      console.log('🔑 AUTH DEBUG: Auth-related keys:', authRelatedKeys);
      
      for (const key of authRelatedKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          console.log(`🔐 AUTH DEBUG: ${key}:`, value ? value.substring(0, 30) + '...' : 'null');
        } catch (error) {
          console.log(`💥 AUTH DEBUG: Error reading ${key}:`, error);
        }
      }
    } catch (error) {
      console.log('💥 AUTH DEBUG: Error getting all keys:', error);
    }
  }

  // Test API authentication
  static async testAuthEndpoint(baseURL: string = 'https://himfirstapis.com'): Promise<void> {
    console.log('🌐 AUTH DEBUG: Testing API authentication...');
    
    const tokenKeys = ['authToken', 'jwt', 'token', 'accessToken'];
    
    for (const tokenKey of tokenKeys) {
      try {
        const token = await AsyncStorage.getItem(tokenKey);
        if (!token) continue;
        
        console.log(`🧪 AUTH DEBUG: Testing with token from '${tokenKey}'...`);
        
        // Test with your my-videos endpoint (requires auth)
        const response = await fetch(`${baseURL}/api/v1/video/my-videos?page=0&size=1`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log(`📡 AUTH DEBUG: Response status for '${tokenKey}':`, response.status);
        
        if (response.ok) {
          console.log(`✅ AUTH DEBUG: Authentication successful with '${tokenKey}'!`);
          const data = await response.json();
          console.log('📦 AUTH DEBUG: Response data:', data);
          return; // Success!
        } else {
          const errorText = await response.text();
          console.log(`❌ AUTH DEBUG: Auth failed with '${tokenKey}':`, errorText);
        }
      } catch (error) {
        console.log(`💥 AUTH DEBUG: Network error testing '${tokenKey}':`, error);
      }
    }
  }

  // Validate token format
  static validateTokenFormat(token: string): boolean {
    if (!token) {
      console.log('❌ AUTH DEBUG: Token is null or empty');
      return false;
    }

    console.log('🔍 AUTH DEBUG: Token length:', token.length);
    console.log('🔍 AUTH DEBUG: Token start:', token.substring(0, 10));
    console.log('🔍 AUTH DEBUG: Token end:', token.substring(token.length - 10));

    // Check if it looks like a JWT
    const parts = token.split('.');
    if (parts.length === 3) {
      console.log('✅ AUTH DEBUG: Token appears to be a valid JWT format');
      try {
        const payload = JSON.parse(atob(parts[1]));
        console.log('📦 AUTH DEBUG: JWT payload:', payload);
        
        // Check expiration
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000);
          const now = new Date();
          console.log('⏰ AUTH DEBUG: Token expires:', expDate);
          console.log('⏰ AUTH DEBUG: Current time:', now);
          
          if (expDate < now) {
            console.log('⚠️ AUTH DEBUG: Token is EXPIRED!');
            return false;
          } else {
            console.log('✅ AUTH DEBUG: Token is not expired');
          }
        }
        return true;
      } catch (error) {
        console.log('❌ AUTH DEBUG: Error parsing JWT payload:', error);
      }
    } else {
      console.log('⚠️ AUTH DEBUG: Token does not appear to be JWT format');
    }

    return token.length > 10; // Basic length check
  }

  // Complete auth diagnostic
  static async runCompleteAuthDiagnostic(): Promise<void> {
    console.log('🚀 AUTH DEBUG: Starting complete authentication diagnostic...');
    console.log('=====================================');
    
    await this.checkAllStorageKeys();
    console.log('=====================================');
    
    await this.checkAllTokens();
    console.log('=====================================');
    
    // Test the most likely token
    const token = await AsyncStorage.getItem('authToken') || await AsyncStorage.getItem('jwt');
    if (token) {
      this.validateTokenFormat(token);
      console.log('=====================================');
      
      await this.testAuthEndpoint();
    } else {
      console.log('❌ AUTH DEBUG: No tokens found to test');
    }
    
    console.log('🏁 AUTH DEBUG: Diagnostic complete');
  }
}

// Usage example:
export const debugAuth = async () => {
  await AuthDebugger.runCompleteAuthDiagnostic();
};