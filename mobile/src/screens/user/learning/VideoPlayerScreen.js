import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';

import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import Card from '../../../components/common/Card';

const { width: screenWidth } = Dimensions.get('window');

const VideoPlayerScreen = ({ navigation, route }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const { course } = route.params;

  const videoRef = useRef(null);
  const [videoStatus, setVideoStatus] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [watchProgress, setWatchProgress] = useState(0);
  const [useWebView, setUseWebView] = useState(false);

  // Early return if no video URL
  if (!course.video_url) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Video Available
          </Text>
          <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
            This course doesn't have a video lesson yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    // Auto-hide controls after 3 seconds
    const timer = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  useEffect(() => {
    // Update watch progress
    if (duration > 0) {
      const progress = (currentPosition / duration) * 100;
      setWatchProgress(progress);
      
      // Auto-save progress every 30 seconds
      if (Math.floor(currentPosition) % 30 === 0 && currentPosition > 0) {
        saveProgress(progress);
      }
    }
  }, [currentPosition, duration]);

  // Determine video type on mount - MOVED HERE TO PREVENT INFINITE LOOP
  useEffect(() => {
    const videoUrl = course.video_url;
    if (videoUrl && (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo.com'))) {
      console.log('🎥 Setting WebView mode for:', videoUrl);
      setUseWebView(true);
    } else {
      setUseWebView(false);
    }
  }, [course.video_url]);

  const saveProgress = async (progress) => {
    try {
      // TODO: Implement progress saving to backend
      // await ApiService.updateVideoProgress(course.id, progress, currentPosition);
      console.log('Saving video progress:', progress);
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (!videoRef.current) {
        console.warn('Video ref is not available');
        return;
      }

      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
      setShowControls(true);
    } catch (error) {
      console.error('Error controlling video playback:', error);
    }
  };

  const handleSeek = async (position) => {
    try {
      if (!videoRef.current) {
        console.warn('Video ref is not available for seeking');
        return;
      }

      await videoRef.current.setPositionAsync(position);
      setCurrentPosition(position);
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  };

  const handleVideoLoad = (status) => {
    console.log('Video load status:', status);
    setVideoStatus(status);
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setLoading(false);
    } else if (status.error) {
      console.error('Video load error:', status.error);
      setLoading(false);
      Alert.alert('Video Error', 'Failed to load video. Please check the video URL.');
    }
  };

  const handlePlaybackStatusUpdate = (status) => {
    setVideoStatus(status);
    if (status.isLoaded) {
      setCurrentPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
      
      // Check if video completed
      if (status.didJustFinish) {
        handleVideoComplete();
      }
    }
  };

  const handleVideoComplete = async () => {
    try {
      setWatchProgress(100);
      await saveProgress(100);
      
      Alert.alert(
        'Video Completed!',
        'Congratulations! You have completed this video lesson.',
        [
          {
            text: 'Continue Learning',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error handling video completion:', error);
    }
  };

  const formatTime = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Extract YouTube video ID from various YouTube URL formats
  const extractYouTubeVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getVideoSource = () => {
    const videoUrl = course.video_url;

    if (!videoUrl) {
      Alert.alert('No Video', 'No video URL found for this course.');
      return null;
    }

    console.log('🎥 Processing video URL:', videoUrl);

    // Handle YouTube videos
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const videoId = extractYouTubeVideoId(videoUrl);
      if (videoId) {
        // YouTube URL processing (WebView mode set in useEffect)
        const youtubeStreamUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&rel=0&showinfo=0&modestbranding=1`;
        console.log('✅ YouTube video detected, using embed URL:', youtubeStreamUrl);
        return { uri: youtubeStreamUrl };
      } else {
        console.error('❌ Invalid YouTube URL format');
        Alert.alert('Invalid YouTube URL', 'Could not extract video ID from YouTube URL.');
        return null;
      }
    }

    // Handle Vimeo videos
    if (videoUrl.includes('vimeo.com')) {
      const vimeoId = videoUrl.match(/vimeo\.com\/(\d+)/);
      if (vimeoId) {
        // Vimeo URL processing (WebView mode set in useEffect)
        const vimeoStreamUrl = `https://player.vimeo.com/video/${vimeoId[1]}?autoplay=0&controls=1`;
        console.log('✅ Vimeo video detected, using player URL:', vimeoStreamUrl);
        return { uri: vimeoStreamUrl };
      }
    }

    // Handle local uploaded videos (from our upload system)
    if (videoUrl.startsWith('/uploads/')) {
      // Convert relative URL to full URL
      const fullUrl = `http://localhost:8080${videoUrl}`;
      console.log('✅ Local video detected, using full URL:', fullUrl);
      return { uri: fullUrl };
    }

    // Handle direct video URLs (mp4, webm, etc.)
    if (videoUrl.match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)(\?.*)?$/i)) {
      console.log('✅ Direct video URL detected:', videoUrl);
      return { uri: videoUrl };
    }

    // Handle streaming URLs (m3u8, mpd, etc.)
    if (videoUrl.match(/\.(m3u8|mpd)(\?.*)?$/i)) {
      console.log('✅ Streaming video URL detected:', videoUrl);
      return { uri: videoUrl };
    }

    // Fallback: try to play any URL as video
    console.log('⚠️ Unknown video format, attempting to play:', videoUrl);
    return { uri: videoUrl };
  };

  const renderVideoPlayer = () => {
    const videoUrl = course.video_url;

    if (!videoUrl) {
      return (
        <View style={[styles.videoContainer, styles.errorContainer]}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            No video URL provided
          </Text>
        </View>
      );
    }

    // Check if it's a YouTube video
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      const youtubeVideoId = extractYouTubeVideoId(videoUrl);

      return (
        <View style={styles.videoContainer}>
          <View style={[styles.videoPlayerCard, { backgroundColor: colors.surface }]}>
            <View style={styles.videoThumbnailContainer}>
              <Ionicons name="logo-youtube" size={80} color="#FF0000" />
              <Text style={[styles.videoTitle, { color: colors.text }]}>
                YouTube Video
              </Text>
              <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
                {course.title || 'Video Content'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.externalPlayButton, { backgroundColor: '#FF0000' }]}
              onPress={async () => {
                try {
                  const youtubeUrl = youtubeVideoId
                    ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
                    : videoUrl;
                  await Linking.openURL(youtubeUrl);
                } catch (error) {
                  console.error('Error opening YouTube:', error);
                  Alert.alert('Error', 'Unable to open YouTube. Please check if YouTube app is installed.');
                }
              }}
            >
              <Ionicons name="play" size={32} color="white" />
              <Text style={[styles.externalPlayButtonText, { color: 'white' }]}>
                Watch on YouTube
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Check if it's a Vimeo video
    if (videoUrl.includes('vimeo.com')) {
      return (
        <View style={styles.videoContainer}>
          <View style={[styles.videoPlayerCard, { backgroundColor: colors.surface }]}>
            <View style={styles.videoThumbnailContainer}>
              <Ionicons name="videocam" size={80} color="#1AB7EA" />
              <Text style={[styles.videoTitle, { color: colors.text }]}>
                Vimeo Video
              </Text>
              <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
                {course.title || 'Video Content'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.externalPlayButton, { backgroundColor: '#1AB7EA' }]}
              onPress={async () => {
                try {
                  await Linking.openURL(videoUrl);
                } catch (error) {
                  console.error('Error opening Vimeo:', error);
                  Alert.alert('Error', 'Unable to open Vimeo.');
                }
              }}
            >
              <Ionicons name="play" size={32} color="white" />
              <Text style={[styles.externalPlayButtonText, { color: 'white' }]}>
                Watch on Vimeo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Check for other video platforms
    if (videoUrl.includes('dailymotion.com') || videoUrl.includes('twitch.tv') || videoUrl.includes('facebook.com')) {
      const platformName = videoUrl.includes('dailymotion.com') ? 'Dailymotion' :
                           videoUrl.includes('twitch.tv') ? 'Twitch' : 'Facebook';

      return (
        <View style={styles.videoContainer}>
          <View style={[styles.videoPlayerCard, { backgroundColor: colors.surface }]}>
            <View style={styles.videoThumbnailContainer}>
              <Ionicons name="videocam" size={80} color={colors.primary} />
              <Text style={[styles.videoTitle, { color: colors.text }]}>
                {platformName} Video
              </Text>
              <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
                {course.title || 'Video Content'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.externalPlayButton, { backgroundColor: colors.primary }]}
              onPress={async () => {
                try {
                  await Linking.openURL(videoUrl);
                } catch (error) {
                  console.error(`Error opening ${platformName}:`, error);
                  Alert.alert('Error', `Unable to open ${platformName}.`);
                }
              }}
            >
              <Ionicons name="play" size={32} color="white" />
              <Text style={[styles.externalPlayButtonText, { color: 'white' }]}>
                Watch on {platformName}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // For direct video URLs, try to play with expo-av
    const videoSource = getVideoSource();
    if (!videoSource) {
      return (
        <View style={[styles.videoContainer, styles.errorContainer]}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Unable to load video
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.videoContainer}>
        <Video
          source={videoSource}
          style={styles.video}
          useNativeControls={true}
          resizeMode="contain"
          shouldPlay={false}
          onError={(error) => {
            console.error('Video playback error:', error);
            Alert.alert(
              'Video Error',
              'Unable to play this video. Would you like to open it externally?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Externally',
                  onPress: async () => {
                    try {
                      await Linking.openURL(videoUrl);
                    } catch (linkError) {
                      console.error('Error opening video URL:', linkError);
                      Alert.alert('Error', 'Unable to open video');
                    }
                  }
                }
              ]
            );
          }}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={[styles.loadingText, { color: colors.white }]}>
              Loading video...
            </Text>
          </View>
        )}
      </View>
    );
  };



  const renderVideoInfo = () => (
    <Card style={styles.infoCard}>
      <Text style={[styles.videoTitle, { color: colors.text }]}>
        {course.title}
      </Text>
      <Text style={[styles.videoDescription, { color: colors.textSecondary }]}>
        {course.content || course.description}
      </Text>
      
      {/* Progress Info */}
      <View style={styles.progressInfo}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>
            Watch Progress
          </Text>
          <Text style={[styles.progressPercentage, { color: colors.primary }]}>
            {Math.round(watchProgress)}%
          </Text>
        </View>
        <View style={[styles.watchProgressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.watchProgressFill,
              {
                backgroundColor: colors.success,
                width: `${watchProgress}%`,
              },
            ]}
          />
        </View>
      </View>
    </Card>
  );

  const renderVideoControls = () => (
    <Card style={styles.controlsCard}>
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.surface }]}
          onPress={() => handleSeek(Math.max(0, currentPosition - 10000))}
        >
          <Ionicons name="play-back" size={20} color={colors.text} />
          <Text style={[styles.controlButtonText, { color: colors.text }]}>
            -10s
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.playPauseButton, { backgroundColor: colors.primary }]}
          onPress={handlePlayPause}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={24}
            color={colors.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.surface }]}
          onPress={() => handleSeek(Math.min(duration, currentPosition + 10000))}
        >
          <Ionicons name="play-forward" size={20} color={colors.text} />
          <Text style={[styles.controlButtonText, { color: colors.text }]}>
            +10s
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderVideoPlayer()}
        {renderVideoInfo()}
        {renderVideoControls()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  videoContainer: {
    backgroundColor: '#000',
    marginBottom: spacing.lg,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: screenWidth * 0.5625, // Same height as video
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  videoTouchable: {
    position: 'relative',
  },
  video: {
    width: screenWidth,
    height: screenWidth * 0.5625, // 16:9 aspect ratio
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#000',
  },
  timeText: {
    fontSize: typography.fontSize.sm,
    minWidth: 40,
    textAlign: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: spacing.md,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  infoCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  videoTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.md,
  },
  videoDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  progressInfo: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  progressPercentage: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  watchProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  watchProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  controlsCard: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  controlButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Loading styles
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },

  openVideoButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  openVideoText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  externalPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  externalPlayButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.sm,
  },
  videoPlayerCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    margin: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoThumbnailContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

});

export default VideoPlayerScreen;
