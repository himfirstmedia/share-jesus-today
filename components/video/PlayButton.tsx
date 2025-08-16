import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { videoStyles } from '../../styles/VideoStyles';

interface PlayButtonProps {
  onPress: () => void;
}

export const PlayButton: React.FC<PlayButtonProps> = ({ onPress }) => (
  <TouchableOpacity style={videoStyles.playButton} onPress={onPress}>
    <View style={videoStyles.playIcon} />
  </TouchableOpacity>
);
