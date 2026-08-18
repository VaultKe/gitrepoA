import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';

const ViewMemberProfileSection = ({
  memberData,
  imageExpanded,
  failedAvatars,
  renderMemberAvatar,
  handleImagePress,
  styles,
  colors,
}) => {
  if (!memberData) return null;
  return (
    <Card variant="outlined" padding="none" style={[styles.profileCard, imageExpanded && styles.framelessCard]}>
      {imageExpanded ? (
        <View style={styles.framelessProfileLayout}>
          <TouchableOpacity onPress={handleImagePress} style={styles.minimizeButton}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.framelessImageContainer}>{renderMemberAvatar(true)}</View>
          <View style={styles.framelessProfileInfo}>
            <Text style={[styles.minimizeHint, styles.minimizeHintSecondary]}>Tap the × to minimize</Text>
          </View>
        </View>
      ) : (
        <View style={styles.profileHeader}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleImagePress}>
            {renderMemberAvatar()}
            <View style={styles.expandImageOverlay}>
              <Ionicons name="expand" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={[styles.memberName, styles.memberNameText]}>
              {memberData.user?.first_name} {memberData.user?.last_name}
            </Text>
            <Text style={[styles.memberEmail, styles.memberEmailSecondary]}>
              {memberData.user?.email}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
};

export default ViewMemberProfileSection;
