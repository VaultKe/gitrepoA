import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import ApiService from '../../services/api';

const AVATAR_COLORS = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1'];

const MemberAvatar = ({ member, colors, onAvatarPress }) => {
  const uploadBaseUrl = ApiService.getUploadBaseUrl();

  const getAvatarColor = (seed) => {
    const str = String(seed || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  };

  const getAvatarGenderIcon = (gender) => {
    if (gender === 'female') return 'female';
    if (gender === 'male') return 'male';
    return 'person';
  };

  if (!member) {
    return (
      <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.memberInitials, { color: colors.white }]}>?</Text>
      </View>
    );
  }

  const user = member?.user || {};
  const email = user?.email || member?.email;
  const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || member?.avatar || member?.avatarUrl;

  if (avatarUrl && avatarUrl.trim()) {
    let fullAvatarUrl;
    if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
      fullAvatarUrl = avatarUrl;
    } else {
           fullAvatarUrl = `${uploadBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
    }

    return (
      <TouchableOpacity onPress={() => onAvatarPress(member)}>
        <Image
          source={{ uri: fullAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            // Will fallback to local initials avatar
          }}
        />
      </TouchableOpacity>
    );
  }

  const avatarColor = getAvatarColor(member?.id || user?.id || member?.user_id || email);
  const genderIcon = getAvatarGenderIcon(user?.gender);
  return (
    <TouchableOpacity onPress={() => onAvatarPress(member)}>
      <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
        <Ionicons name={genderIcon} size={36} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInitials: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default MemberAvatar;
