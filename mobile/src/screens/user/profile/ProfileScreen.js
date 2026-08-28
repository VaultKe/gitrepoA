import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography } from '../../../utils/theme';
import PageRefreshButton from '../../../components/common/PageRefreshButton';
import ProfileHeader from '../../../components/profile/ProfileHeader';
import PersonalInfoForm from '../../../components/profile/PersonalInfoForm';
import WhatsAppLinkCard from '../../../components/profile/WhatsAppLinkCard';
import useProfileScreen from '../../../hooks/useProfileScreen';

const ProfileScreen = ({ navigation }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const screen = useProfileScreen({ navigation });

  const {
    loading,
    editing,
    profileData,
    profileImage,
    avatarData,
    showCountyPicker,
    countySearch,
    setCountySearch,
    selectCounty,
    setShowCountyPicker,
    imageExpanded,
    setImageExpanded,
    handleInputChange,
    pickImage,
    handleSave,
    handleCancel,
    handleImagePress,
    handleLogout,
    user,
  } = screen;

  const filteredCounties = screen.filteredCounties || [];

  const renderPersonalInfo = useCallback(() => (
    <PersonalInfoForm
      colors={colors}
      editing={editing}
      profileData={profileData}
      showCountyPicker={showCountyPicker}
      countySearch={countySearch}
      filteredCounties={filteredCounties}
      onInputChange={handleInputChange}
      onShowCountyPicker={setShowCountyPicker}
      onSelectCounty={selectCounty}
      onCountySearchChange={setCountySearch}
      onCloseCountyPicker={() => setShowCountyPicker(false)}
      onSave={handleSave}
      onCancel={handleCancel}
      loading={loading}
    />
  ), [colors, editing, profileData, showCountyPicker, countySearch, filteredCounties, handleInputChange, setShowCountyPicker, selectCounty, setCountySearch, handleSave, handleCancel, loading]);

  const handleNavigateWhatsApp = useCallback(() => {
    navigation.navigate('WhatsAppLink');
  }, [navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={async () => {
                console.warn('Profile refresh has no data to reload in this view');
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <ProfileHeader
            colors={colors}
            user={user}
            profileImage={profileImage}
            avatarData={avatarData}
            editing={editing}
            imageExpanded={imageExpanded}
            loading={loading}
            onImagePress={handleImagePress}
            onLogout={handleLogout}
            onNavigateSettings={() => navigation.navigate('Settings')}
            onToggleEditing={() => screen.setEditing((prev) => !prev)}
          />

          {renderPersonalInfo()}

          <WhatsAppLinkCard
            colors={colors}
            onNavigateWhatsApp={handleNavigateWhatsApp}
          />
        </ScrollView>

        <PageRefreshButton
          onRefresh={async () => {
            console.warn('Profile refresh has no data to reload in this view');
          }}
          refreshing={false}
          color={colors.primary}
          bottom={64}
        />
      </View>
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
});

export default ProfileScreen;