// app/(tabs)/_layout.tsx - Updated to match white bottom navigation design
import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProtectedRoute from '../../components/ProtectedRoute';
import AuthManager from '../../utils/authManager'; // Import AuthManager

function TabBarIcon(props: { name: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  useEffect(() => {
    // Initialize AuthManager when the app layout loads
    AuthManager.initialize().catch(error => {
      console.error("Failed to initialize AuthManager:", error);
      // Optionally handle initialization error, e.g., show a message to the user
    });
  }, []); // Empty dependency array ensures this runs only once on mount

  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Define screens that should NOT show the bottom navigation
  const hideTabBarScreens = [
    '/login',
    '/Signup', 
    '/VerifyOtp',
    '/CreatePassword',
    '/CameraRecord'
  ];
  
  // Check if current screen should hide the tab bar
  // const shouldHideTabBar = hideTabBarScreens.includes(pathname);
  const shouldHideTabBar = hideTabBarScreens.includes(pathname) || 
                        pathname.includes('CameraRecord') ||
                        pathname.endsWith('/CameraRecord');

  console.log('CustomTabBar: app/(tabs)/_layout.tsx', { pathname, shouldHideTabBar }); // Added log

  // Custom tab bar component
  const CustomTabBar = ({
    state,
    descriptors,
    navigation,
  }: {
    state: {
      index: number;
      routes: { key: string; name: string }[];
    };
    descriptors: {
      [key: string]: {
        options: {
          tabBarLabel?: string;
          title?: string;
          tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
        };
      };
    };
    navigation: {
      navigate: (name: string) => void;
    };
  }) => {
    // Don't render the tab bar for auth screens
    if (shouldHideTabBar) {
      return null;
    }

    return (
      <View style={{
        backgroundColor: 'white', // Changed from #E6E6E6 to white
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        height: (Platform.OS === 'ios' ? 80 : 70) + insets.bottom, // Slightly increased height
        paddingTop: 12, // Increased padding for better spacing
        paddingBottom: insets.bottom + 8,
        elevation: 8, // Increased elevation for better shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15, // Slightly stronger shadow
        shadowRadius: 6,
      }}>
        <View style={{
          maxWidth: 400,
          alignSelf: 'center',
          width: '100%',
          flex: 1,
          justifyContent: 'center',
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 20,
            position: 'relative'
          }}>
            {/* Home Button - Left Side */}
            <TouchableOpacity
              onPress={() => {
                const currentRoute = state.routes[state.index]?.name;
                if (currentRoute !== 'index') {
                  navigation.navigate('index');
                }
              }}
              style={{
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 8,
                minWidth: 80,
              }}
            >
              <Ionicons
                name={state.routes[state.index]?.name === 'index' ? 'home' : 'home-outline'}
                size={24} // Slightly larger icons
                color={state.routes[state.index]?.name === 'index' ? '#3260AD' : '#8E8E93'} // Updated inactive color
              />
              <Text
                style={{
                  fontSize: 11, // Slightly smaller text
                  fontWeight: '500',
                  marginTop: 4,
                  color: state.routes[state.index]?.name === 'index' ? '#3260AD' : '#8E8E93',
                }}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* Spacer for better distribution */}
            <View style={{ flex: 1 }} />

            {/* Post Button - Center with Semi-Circle Cutout */}
            <View style={{
              position: 'relative',
              alignItems: 'center',
            }}>
              {/* Semi-circle cutout background */}
              <View style={{
                position: 'absolute',
                top: -15,
                width: 80,
                height: 40,
                backgroundColor: 'white',
                borderTopLeftRadius: 40,
                borderTopRightRadius: 40,
                borderBottomWidth: 0,
              }} />
              
              <TouchableOpacity
                onPress={() => {
                  const currentRoute = state.routes[state.index]?.name;
                  if (currentRoute !== 'post') {
                    navigation.navigate('post');
                  }
                }}
                style={{
                  backgroundColor: '#3260AD',
                  borderRadius: 35,
                  width: 70,
                  height: 70,
                  justifyContent: 'center',
                  alignItems: 'center',
                  shadowColor: '#3260AD',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 15,
                  marginTop: -35, // Lifted higher to create floating effect
                  zIndex: 10,
                  // Add a white border for clean separation
                  borderWidth: 4,
                  borderColor: 'white',
                }}
              >
                <Ionicons
                  name="add"
                  size={28}
                  color="white"
                  style={{ fontWeight: '300' }}
                />
              </TouchableOpacity>
            </View>

            {/* Spacer for better distribution */}
            <View style={{ flex: 1 }} />

            {/* Menu Button - Right Side */}
            <TouchableOpacity
              onPress={() => {
                const currentRoute = state.routes[state.index]?.name;
                if (currentRoute !== 'menu') {
                  navigation.navigate('menu');
                }
              }}
              style={{
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 8,
                minWidth: 80,
              }}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color={state.routes[state.index]?.name === 'menu' ? '#3260AD' : '#8E8E93'}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  marginTop: 4,
                  color: state.routes[state.index]?.name === 'menu' ? '#3260AD' : '#8E8E93',
                }}
              >
                Menu
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <ProtectedRoute>
        <Tabs.Screen
          name="post"
          options={{
            title: 'Post',
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon name={focused ? 'add-circle' : 'add-circle-outline'} color={color} />
            ),
          }}
        />
      </ProtectedRoute>
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'menu' : 'menu-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}