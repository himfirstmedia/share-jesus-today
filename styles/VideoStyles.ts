// styles/VideoStyles.ts
import { Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

export const videoStyles = StyleSheet.create({
  // Existing styles from the repository
  videoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    marginBottom: 20,
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
    backgroundColor: '#4472C4',
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

  // Modal styles - Enhanced for the new interface
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  swipeInstruction: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
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
    fontSize: 20,
    fontWeight: '600',
  },
  
  // Video player container
  videoPlayerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  videoLoadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  videoLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },

  // Navigation arrows
  navigationArrowLeft: {
    position: 'absolute',
    left: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  navigationArrowRight: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  navigationArrowText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },

  // Side controls (Profile, Share, Flag) - moved higher to avoid video controls
  sideControls: {
    position: 'absolute',
    right: 15,
    bottom: 80,
    alignItems: 'center',
    zIndex: 8,
  },
  sideButton: {
    alignItems: 'center',
    marginBottom: 25,
  },
  profileIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 5,
  },
  profileIconText: {
    fontSize: 20,
    color: '#fff',
  },
  profileImage: { // Added style for the profile image
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 5,
  },
  shareIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  shareIconText: {
    fontSize: 35,
    color: '#000',
  },
  flagIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    color: '#fff',
  },
  flagIconText: {
    fontSize: 26,
    color: '#fff',
  },
  sideButtonLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Menu dropdown - positioned higher to avoid video controls
  menuDropdown: {
    position: 'absolute',
    right: 80,
    bottom: 250,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 120,
    zIndex: 15,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Video title overlay - moved higher to avoid controls
  videoTitleOverlay: {
    position: 'absolute',
    bottom: 150,
    left: 20,
    right: 80,
    zIndex: 5,
  },
  videoTitleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // Existing styles from repository
  videoDetails: {
    backgroundColor: '#000',
    padding: 16,
    paddingBottom: 40,
  },
  videoDetailTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoDetailAuthor: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 4,
  },
  videoDetailDate: {
    color: '#999',
    fontSize: 14,
    marginBottom: 12,
  },
  videoDescription: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    backgroundColor: '#4472C4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#666',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 16,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  videoCounter: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});