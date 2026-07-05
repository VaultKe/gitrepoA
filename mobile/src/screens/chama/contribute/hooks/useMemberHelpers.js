import { useState } from 'react';
import { Image } from 'react-native';
import { useApp } from '../../../../context/AppContext';
import { getThemeColors } from '../../../../utils/theme';
import ApiService from '../../../../services/api';

const useMemberHelpers = () => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [failedAvatars, setFailedAvatars] = useState(new Set());

  const getAvatarFromEmail = (email, size = 50) => {
    if (!email) return null;
    const emailParts = email.split('@')[0];
    const initials = emailParts.substring(0, 2).toUpperCase();
    return `https://ui-avatars.com/api/?name=${initials}&size=${size}&background=00D4AA&color=fff&format=png&rounded=true&bold=true`;
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

    if (email && !failedAvatars.has(email)) {
      const generatedAvatarUrl = getAvatarFromEmail(email, 40);
      return (
        <Image
          source={{ uri: generatedAvatarUrl }}
          style={styles.memberAvatar}
          onError={(error) => {
            setFailedAvatars(prev => new Set([...prev, email]));
          }}
        />
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
    getAvatarFromEmail,
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