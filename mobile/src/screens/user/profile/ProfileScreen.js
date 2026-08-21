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
import UserChamasTable from '../../../components/profile/UserChamasTable';
import RecentActivityTable from '../../../components/profile/RecentActivityTable';
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
    userChamas,
    chamasLoading,
    payingChamaFee,
    cooldownActive,
    cooldownRemaining,
    chamasPage,
    setChamasPage,
    CHAMAS_PER_PAGE,
    imageExpanded,
    setImageExpanded,
    handleInputChange,
    pickImage,
    handleSave,
    handleCancel,
    handleImagePress,
    loadRecentActivities,
    loadUserChamas,
    handlePayChamaFee,
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
                try {
                  await Promise.all([loadRecentActivities(), loadUserChamas()]);
                } catch (error) {
                  console.warn('Profile refresh failed:', error);
                }
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
            onToggleEditing={screen.setEditing}
          />

          {renderPersonalInfo()}

          <WhatsAppLinkCard
            colors={colors}
            onNavigateWhatsApp={handleNavigateWhatsApp}
          />

          <UserChamasTable
            colors={colors}
            userChamas={userChamas}
            chamasLoading={chamasLoading}
            payingChamaFee={payingChamaFee}
            cooldownActive={cooldownActive}
            cooldownRemaining={cooldownRemaining}
            chamasPage={chamasPage}
            chamasPerPage={CHAMAS_PER_PAGE}
            onPayChamaFee={handlePayChamaFee}
            onPrevPage={() => setChamasPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setChamasPage((p) => Math.min(Math.ceil(userChamas.length / CHAMAS_PER_PAGE), p + 1))}
          />

          <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}>
            <RecentActivityTable
              colors={colors}
              recentActivities={screen.recentActivities}
              activitiesLoading={screen.activitiesLoading}
              formatCurrency={screen.formatCurrency}
            />
          </View>
        </ScrollView>

        <PageRefreshButton
          onRefresh={async () => {
            try {
              await Promise.all([loadRecentActivities(), loadUserChamas()]);
            } catch (error) {
              console.warn('Profile refresh failed:', error);
            }
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