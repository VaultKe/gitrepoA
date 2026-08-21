import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/common/Card';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { resolveAvatarUrl } from '../../utils/profileHelpers';

const ProfileHeader = memo(({
  colors,
  user,
  profileImage,
  avatarData,
  editing,
  imageExpanded,
  loading,
  onImagePress,
  onLogout,
  onNavigateSettings,
  onToggleEditing,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [profileImage, avatarData]);

  const renderImageContent = () => {
    const isLocalImage = profileImage && (profileImage.startsWith('file://') || profileImage.startsWith('blob:') || profileImage.startsWith('data:'));
    
    let displayUri = null;
    if (profileImage) {
      const isMarker = profileImage === 'avatar://cached-base64-image';
      const isValid = !profileImage.includes('undefined') && !isMarker;
      if (isValid) {
        displayUri = profileImage;
      }
    }
    if (!displayUri && avatarData && !isLocalImage) {
      displayUri = avatarData;
    }

    if (displayUri) {
      return (
        <Image
          source={{ uri: displayUri }}
          style={imageExpanded ? styles.framelessImage : styles.profileImage}
          onError={(error) => {
            console.warn('Profile image load error:', error);
            setImgError(true);
            setImageLoading(false);
          }}
          onLoadStart={() => setImageLoading(true)}
          onLoadEnd={() => setImageLoading(false)}
        />
      );
    }

    if (imageExpanded) {
      return (
        <View style={[styles.framelessPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={[styles.framelessPlaceholderText, { color: colors.white }]}>
            {(user?.first_name || user?.firstName)?.[0]}{(user?.last_name || user?.lastName)?.[0]}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.placeholderImage, { backgroundColor: colors.primary }]}>
        <Text style={[styles.placeholderText, { color: colors.white }]}>
          {(user?.first_name || user?.firstName)?.[0]}{(user?.last_name || user?.lastName)?.[0]}
        </Text>
      </View>
    );
  };

  if (imageExpanded) {
    return (
      <Card variant="outlined" style={[styles.section, styles.framelessCard]}>
        <View style={styles.framelessProfileLayout}>
          <TouchableOpacity onPress={onImagePress} style={styles.minimizeButton}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.framelessImageContainer}>
            {renderImageContent()}
          </View>

          <View style={styles.framelessProfileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {(user?.first_name || user?.firstName)} {(user?.last_name || user?.lastName)}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email}
            </Text>
            <Text style={[styles.profileLocation, { color: colors.textTertiary }]}>
              {user?.town}, {user?.county}
            </Text>

            <Text style={[styles.minimizeHint, { color: colors.textSecondary }]}>
              Tap the × to minimize
            </Text>
          </View>

          <View style={styles.framelessHeaderActions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.error + '20' },
                loading && { opacity: 0.6 },
              ]}
              onPress={onLogout}
              disabled={loading}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={onNavigateSettings}
            >
              <Ionicons name="settings" size={22} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={onToggleEditing}
            >
              <Ionicons name={editing ? 'close' : 'pencil'} size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card variant="outlined" style={styles.section}>
      <View style={styles.profileHeader}>
        <TouchableOpacity style={styles.imageContainer} onPress={onImagePress}>
          {renderImageContent()}

          {editing && (
            <View style={[styles.editImageOverlay, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={20} color={colors.white} />
            </View>
          )}

          {!editing && (
            <View style={[styles.expandImageOverlay, { backgroundColor: colors.info + '90' }]}>
              <Ionicons name="expand" size={16} color={colors.white} />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {(user?.first_name || user?.firstName)} {(user?.last_name || user?.lastName)}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {user?.email}
          </Text>

          <View style={styles.profileActionIcons}>
            <TouchableOpacity
              style={[
                styles.profileActionButton,
                { backgroundColor: colors.error + '20' },
                loading && { opacity: 0.6 },
              ]}
              onPress={onLogout}
              disabled={loading}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileActionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={onNavigateSettings}
            >
              <Ionicons name="settings" size={20} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profileActionButton, { backgroundColor: colors.primary + '20' }]}
              onPress={onToggleEditing}
            >
              <Ionicons name={editing ? 'close' : 'pencil'} size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.profileLocation, { color: colors.textTertiary }]}>
            {user?.town}, {user?.county}
          </Text>
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  section: {
    margin: spacing.md,
  },
  framelessCard: {
    padding: 0,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  framelessProfileLayout: {
    position: 'relative',
    overflow: 'hidden',
  },
  minimizeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: spacing.sm,
  },
  framelessImageContainer: {
    width: '100%',
    alignItems: 'center',
  },
  framelessImage: {
    width: '100%',
    height: 400,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  framelessPlaceholder: {
    width: '100%',
    height: 400,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  framelessPlaceholderText: {
    fontSize: 80,
    fontWeight: typography.fontWeight.bold,
  },
  framelessProfileInfo: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'transparent',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  profileLocation: {
    fontSize: typography.fontSize.sm,
  },
  profileActionIcons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  profileActionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    marginLeft: spacing.xs,
  },
  minimizeHint: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  framelessHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});

export default ProfileHeader;
