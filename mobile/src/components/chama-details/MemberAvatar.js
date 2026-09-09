import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../utils/theme';
import ApiService from '../../services/api';

const AVATAR_COLORS = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1'];

const getAvatarColor = (seed) => {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const genderIconFor = (gender) => (gender === 'female' ? 'female' : gender === 'male' ? 'male' : 'person');

const MemberAvatar = ({ member, colors, onAvatarPress }) => {
  const [failed, setFailed] = useState(false);

  const user = member?.user || {};
  const email = user?.email || member?.email;
  const avatarUrl =
    user?.avatar_url || user?.avatar || user?.profile_image || member?.avatar || member?.avatarUrl || '';

  // Reset the error flag when the source changes.
  useEffect(() => { setFailed(false); }, [avatarUrl]);

  const press = () => { if (typeof onAvatarPress === 'function') onAvatarPress(member); };

  const Fallback = () => {
    const bg = getAvatarColor(member?.id || user?.id || member?.user_id || email || '?');
    return (
      <TouchableOpacity onPress={press} activeOpacity={0.8}>
        <View style={[styles.memberAvatar, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={genderIconFor(user?.gender)} size={22} color={colors?.white || '#fff'} />
        </View>
      </TouchableOpacity>
    );
  };

  if (!member || !avatarUrl.trim() || failed) {
    return <Fallback />;
  }

  const uploadBaseUrl = ApiService.getUploadBaseUrl?.() || '';
  const fullAvatarUrl =
    avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')
      ? avatarUrl
      : `${uploadBaseUrl}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;

  return (
    <TouchableOpacity onPress={press} activeOpacity={0.8}>
      <Image
        source={{ uri: fullAvatarUrl }}
        style={styles.memberAvatar}
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  memberInitials: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default MemberAvatar;
