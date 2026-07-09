import { useState } from 'react';
import { Image } from 'react-native';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors } from '../../../../utils/theme';
import ApiService from '../../../../services/api';

const useMemberHelpers = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [failedAvatars, setFailedAvatars] = useState(new Set());

  // Local, network-free avatar helpers. Avoid external avatar services entirely
  // so nothing leaks into the browser network tab and there are no ORB/CORS failures.
  const AVATAR_COLORS = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1'];
  const getAvatarColor = (seed) => {
    const str = String(seed || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  };
  const getAvatarInitials = (item, user) => {
    const first = (user?.first_name || item?.first_name || '').trim()[0] || '';
    const last = (user?.last_name || item?.last_name || '').trim()[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const getMemberName = (item) => {
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name || '';
    const lastName = user?.last_name || item?.lastName || item?.last_name || '';
    const fullName = item?.fullName || `${firstName} ${lastName}`.trim();

    if (!fullName) {
      return user?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
    }

    return fullName;
  };

  const renderMemberAvatar = (item) => {
    const user = item?.user || {};
    const firstName = user?.first_name || item?.firstName || item?.first_name;
    const lastName = user?.last_name || item?.lastName || item?.last_name;
    const email = user?.email || item?.email;

    const avatarUrl = user?.avatar_url || user?.avatar || user?.profile_image || item?.avatar || item?.avatarUrl;

    if (avatarUrl && !failedAvatars.has(avatarUrl)) {
      let fullAvatarUrl;
      if (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:')) {
        fullAvatarUrl = avatarUrl;
      } else {
        fullAvatarUrl = `${ApiService.baseURL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
      }

      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            setFailedAvatars(prev => new Set([...prev, avatarUrl]));
          }}
        />
      );
    }

    // No profile photo: render a local initials avatar (no network request).
    const avatarSeed = item?.id || user?.id || item?.user_id || email;
    if (avatarSeed) {
      return (
        <View style={[styles.memberAvatar, { backgroundColor: getAvatarColor(avatarSeed) }]}>
          <Text style={[styles.memberInitials, { color: colors.white }]}>
            {getAvatarInitials(item, user)}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.memberAvatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.memberInitials, { color: colors.white }]}>
          {firstName?.[0]?.toUpperCase() || 'U'}{lastName?.[0]?.toUpperCase() || ''}
        </Text>
      </View>
    );
  };

  return {
    failedAvatars,
    setFailedAvatars,
    getMemberName,
    renderMemberAvatar,
  };
};

const styles = {
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 18,
    fontWeight: 'bold',
  },
};

export default useMemberHelpers;