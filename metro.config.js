// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configure resolver to handle path aliases
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
  '@/components': path.resolve(__dirname, './components'),
  '@/constants': path.resolve(__dirname, './constants'),
  '@/hooks': path.resolve(__dirname, './hooks'),
  '@/services': path.resolve(__dirname, './services'),
  '@/utils': path.resolve(__dirname, './utils'),
  '@/screens': path.resolve(__dirname, './screens'),
};

// Ensure TypeScript files are resolved
config.resolver.sourceExts.push('ts', 'tsx');

// Add video and media file extensions for proper asset handling
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'm4v',
  '3gp',
  'flv',
  'wmv'
];

// Configure transformer for better video handling
config.transformer = {
  ...config.transformer,
  // Enable inline requires for better performance with video files
  inlineRequires: true,
  // Optimize asset transformation
  publicPath: '/assets',
  assetPlugins: ['expo-asset/tools/hashAssetFiles'],
};

module.exports = config;