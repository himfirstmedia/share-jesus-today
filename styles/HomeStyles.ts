// styles/HomeStyles.ts
import { Dimensions, Platform, StatusBar, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

// Safe area constants
const statusBarHeight = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24;
const bottomSafeArea = Platform.OS === 'ios' ? 1 : 0;
const navBarHeight = 70;
const totalBottomSpace = navBarHeight + bottomSafeArea;

export const homeStyles = StyleSheet.create({
  // Main Container - FIXED: Removed excessive paddingTop
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 0,
    paddingBottom: 0,
  },
  scrollView: {
    flex: 1,
    paddingBottom: 1,
  },
  scrollViewContent: {
    paddingBottom: 0,
  },

  // Header Section - FIXED: Reduced excessive padding
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20, // CHANGED: Reduced from statusBarHeight + 10 to just 20
    paddingBottom:20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 5,
  },
  logo: {
    alignItems: 'center',
    marginBottom: 5, // CHANGED: Reduced from 10 to 5
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: '#3260ad',
    borderRadius: 12,
    marginBottom: 10, // CHANGED: Reduced from 15 to 10
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3260ad',
    letterSpacing: 1,
    marginBottom: 5,
  },
  appSubtitle: {
    fontSize: 18,
    color: '#3260ad',
    fontStyle: 'italic',
    fontWeight: '300',
  },

  // Main Action Buttons - FIXED: Reduced spacing
  mainButtons: {
    marginBottom: 0, // CHANGED: Reduced from 5 to 0
    paddingHorizontal: 20,
  },
  actionButton: {
    width: '100%',
    paddingVertical: 18,
    marginBottom: 10, // CHANGED: Reduced from 15 to 10
    backgroundColor: '#3260ad',
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#3260ad',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Hero Section - FIXED: Reduced padding
  heroSection: {
    backgroundColor: '#3260ad',
    paddingVertical: 30, // CHANGED: Reduced from 40 to 30

    paddingBottom:20,
    alignItems: 'center',
    marginBottom: 20, // CHANGED: Reduced from 30 to 20
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    opacity: 0.9,
  },

  // Video Section - FIXED: Reduced top spacing
  videoSection: {
    paddingHorizontal: 20,
    paddingBottom: 1,
    marginTop: 0, // ADDED: Ensure no extra top margin
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15, // CHANGED: Reduced from 20 to 15
    lineHeight: 26,
    alignSelf:'center',
    textAlign:'center'
  },

  // Loading States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20, // CHANGED: Reduced from 30 to 20
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },

  // Empty States
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30, // CHANGED: Reduced from 40 to 30
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3260ad',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Watch All Button
  watchAllButton: {
    backgroundColor: '#3260ad',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  watchAllButtonText: {
    color: 'white',
    fontWeight: '600',
  },

  // Video Grid & Cards
  videoGrid: {
    marginBottom: 1,
  },
  videoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    marginBottom: 15, // CHANGED: Reduced from 20 to 15
  },
  videoThumbnail: {
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3260ad',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  placeholderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Play Button
  playButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(68, 114, 196, 0.9)',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderLeftColor: 'white',
    borderTopWidth: 10,
    borderTopColor: 'transparent',
    borderBottomWidth: 10,
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },

  // Video Duration Badge
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Video Info
  videoInfo: {
    padding: 15,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  videoAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  videoDate: {
    fontSize: 12,
    color: '#999',
  },

  // Load More Button
  loadMoreButton: {
    width: '100%',
    paddingVertical: 15,
    backgroundColor: '#3260ad',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  loadMoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  // Video Count
  videoCount: {
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f1f3f4',
    borderRadius: 8,
  },
  videoCountText: {
    color: '#666',
    fontSize: 14,
  },

  // Floating Button - Fixed positioning
  floatingButton: {
    position: 'absolute',
    bottom: totalBottomSpace + 15,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3260ad',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3260ad',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 15,
  },
  floatingButtonText: {
    color: 'white',
    fontSize: 30,
    fontWeight: '300',
  },

  // Bottom Navigation - Fixed with proper safe area handling
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: totalBottomSpace,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 15,
    elevation: 20,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  activeNavItem: {
    // Active state styling can be added here
  },
  navIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconRect: {
    backgroundColor: '#666',
  },
  iconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#666',
  },
  navText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeNavText: {
    color: '#3260ad',
  },

  // Video Modal Styles - Fixed for safe areas
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: statusBarHeight + 10,
    backgroundColor: '#000',
    zIndex: 25,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  videoPlayerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  videoPlayer: {
    width: '100%',
    height: 250,
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  videoLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  videoDetails: {
    padding: 16,
    backgroundColor: '#fff',
    maxHeight: 200,
    paddingBottom: bottomSafeArea + 1,
  },
  videoDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  videoDetailAuthor: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  videoDetailDate: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  videoDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },

  // Notification Styles
  notificationContainer: {
    position: 'absolute',
    top: statusBarHeight + 5,
    left: 20,
    right: 20,
    zIndex: 30,
    elevation: 30,
  },
  notification: {
    backgroundColor: 'rgba(68, 114, 196, 0.95)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },

  // Additional utility styles
  safeAreaTop: {
    paddingTop: statusBarHeight,
  },
  safeAreaBottom: {
    paddingBottom: bottomSafeArea,
  },
  
  // Content wrapper to ensure proper spacing
  contentWrapper: {
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
  },

  // Browse All Videos Button Styles
  browseButtonContainer: {
    marginHorizontal: 20,
    marginVertical: 15, // Space around the button
  },
  browseButton: {
    backgroundColor: '#28a745', // A different color to stand out, e.g., green
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  browseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});