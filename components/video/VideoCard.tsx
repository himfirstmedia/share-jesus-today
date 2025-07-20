import React from 'react';
import { Image, Text, View } from 'react-native';
import { type Video as VideoType } from '../../services/apiService';
import { videoStyles } from '../../styles/VideoStyles';
import { t } from '../../utils/i18n';
import { PlayButton } from './PlayButton';

interface VideoCardProps {
  video: VideoType;
  onPress: (video: VideoType) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onPress }) => (
  <View style={videoStyles.videoCard}>
    <View style={videoStyles.videoThumbnail}>
      {video.thumbnailUrl ? (
        <Image 
          source={{ uri: video.thumbnailUrl }} 
          style={videoStyles.thumbnailImage}
          onError={() => console.log('Thumbnail load error for:', video.title)}
        />
      ) : (
        <View style={videoStyles.placeholderThumbnail}>
          <Text style={videoStyles.placeholderText}>{video.title}</Text>
        </View>
      )}
      <PlayButton onPress={() => onPress(video)} />
      
      {/* Video duration badge if available */}
      {/* {video.duration && (
        <View style={videoStyles.durationBadge}>
          <Text style={videoStyles.durationText}>{video.duration}</Text>
        </View>  
      )} */}
    </View>
    <View style={videoStyles.videoInfo}>
      <Text style={videoStyles.videoTitle} numberOfLines={2}>{video.title}</Text>
      <Text style={videoStyles.videoAuthor}>
        {t('videoCard.postedBy')} {video.uploader?.firstName || 'Unknown'} {video.uploader?.lastName || ''}
      </Text>
      {/* <Text style={videoStyles.videoDate}>
        {new Date(video.createdTimestamp).toLocaleDateString()}
      </Text> */}
    </View>
  </View>
);
