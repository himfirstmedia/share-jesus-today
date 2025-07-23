// utils/authManager.ts - Centralized Authentication Manager
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthManager {
  private static instance: AuthManager;
  private authToken: string | null = null;
  private listeners: ((token: string | null) => void)[] = [];
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  // Initialize from AsyncStorage
  initialize(): Promise<void> {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            this.authToken = token;
            console.log('🔑 AuthManager: Token initialized from storage');
            this.notifyListeners(token);
          } else {
            console.log('🔑 AuthManager: No token found in storage during initialization.');
          }
        } catch (error) {
          console.error('❌ AuthManager: Failed to initialize token:', error);
          // We might want to reject the promise here or handle it depending on strategy
          // For now, it completes, but authToken remains null.
        }
      })();
    }
    return this.initializationPromise;
  }

  // Ensure initialization is complete
  async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    } else {
      // This case should ideally not be hit if initialize() is called at app startup.
      // However, as a fallback, call initialize if it hasn't been called.
      console.warn('AuthManager: ensureInitialized called before initialize. Initializing now.');
      await this.initialize();
    }
  }

  // Set auth token and notify all services
  async setAuthToken(token: string): Promise<void> {
    try {
      this.authToken = token;
      await AsyncStorage.setItem('authToken', token);
      // await AsyncStorage.setItem('currentUserId', response.data.person.id);
      console.log('✅ AuthManager: Token stored and services notified');
      this.notifyListeners(token);
    } catch (error) {
      console.error('❌ AuthManager: Failed to store token:', error);
      throw error;
    }
  }

  // Get current auth token
  getAuthToken(): string | null {
    return this.authToken;
  }

  // Clear auth token and notify all services
  async clearAuthToken(): Promise<void> {
    try {
      this.authToken = null;
      await AsyncStorage.removeItem('authToken');
      console.log('🗑️ AuthManager: Token cleared and services notified');
      this.notifyListeners(null);
    } catch (error) {
      console.error('❌ AuthManager: Failed to clear token:', error);
    }
  }

  // Check if authenticated
  isAuthenticated(): boolean {
    return this.authToken !== null && this.authToken.length > 0;
  }

  // Subscribe to auth token changes
  subscribe(listener: (token: string | null) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all subscribers of token changes
  private notifyListeners(token: string | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(token);
      } catch (error) {
        console.error('❌ AuthManager: Listener error:', error);
      }
    });
  }

  // Debug method to check auth status
  async debugAuthStatus(): Promise<void> {
    console.log('🔍 AuthManager Debug Status:');
    console.log('  Memory Token:', this.authToken ? 'Present' : 'Missing');
    
    try {
      const storageToken = await AsyncStorage.getItem('authToken');
      console.log('  Storage Token:', storageToken ? 'Present' : 'Missing');
      console.log('  Tokens Match:', this.authToken === storageToken);
      console.log('  Is Authenticated:', this.isAuthenticated());
      console.log('  Active Listeners:', this.listeners.length);
    } catch (error) {
      console.error('  Storage Error:', error);
    }
  }
}

export default AuthManager.getInstance();