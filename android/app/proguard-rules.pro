# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# react-native-video
-keep class com.brentvatne.react.** { *; }
-dontwarn com.brentvatne.react.**

# react-native-video-trim
-keep class com.reactnativevideotrim.** { *; }
-dontwarn com.reactnativevideotrim.**

# expo-image-picker
-keep class expo.modules.imagepicker.** { *; }
-dontwarn expo.modules.imagepicker.**

# expo-file-system
-keep class expo.modules.filesystem.** { *; }
-dontwarn expo.modules.filesystem.**

# react-native-compressor
-keep class com.reactnativecompressor.** { *; }
-dontwarn com.reactnativecompressor.**

# react-native-fs
-keep class com.rnfs.** { *; }
-dontwarn com.rnfs.**

# react-native-blob-util
-keep class com.ReactNativeBlobUtil.** { *; }
-dontwarn com.ReactNativeBlobUtil.**
