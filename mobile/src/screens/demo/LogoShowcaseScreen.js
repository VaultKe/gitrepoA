import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import VaultKeLogo from '../../components/common/VaultKeLogo';
import VaultKeLogoWeb from '../../components/common/VaultKeLogoWeb';
import PremiumHeader from '../../components/common/PremiumHeader';

const LogoShowcaseScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <PremiumHeader
        title="VaultKe Premium Logos"
        subtitle="Realistic Vault Design Collection"
        showLogo={true}
        showBack={false}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Professional Logo Collection</Text>
        <Text style={styles.subtitle}>Realistic Vault Design • Professional Grade • Timeless</Text>

        {/* Test Logo to ensure rendering works */}
        <View style={styles.testSection}>
          <Text style={styles.testTitle}>✅ Logo Rendering Test</Text>
          <View style={styles.logoContainer}>
            <VaultKeLogo size={80} variant="full" showText={true} />
            <Text style={styles.logoLabel}>Test Logo (80px)</Text>
          </View>
        </View>
        
        {/* Premium Logo Variants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Vault Logo</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={120} variant="full" showText={true} />
              <Text style={styles.logoLabel}>Large (120px)</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={80} variant="full" showText={true} />
              <Text style={styles.logoLabel}>Medium (80px)</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={60} variant="full" showText={true} />
              <Text style={styles.logoLabel}>Small (60px)</Text>
            </View>
          </View>
        </View>

        {/* React Native SVG Version */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>React Native SVG Version</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={120} variant="full" showText={true} />
              <Text style={styles.logoLabel}>RN Large</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={80} variant="full" showText={true} />
              <Text style={styles.logoLabel}>RN Medium</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={60} variant="full" showText={true} />
              <Text style={styles.logoLabel}>RN Small</Text>
            </View>
          </View>
        </View>

        {/* Premium Badge Variants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Badge Variants</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={100} variant="badge" />
              <Text style={styles.logoLabel}>Large Badge</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={80} variant="badge" />
              <Text style={styles.logoLabel}>Medium Badge</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={60} variant="badge" />
              <Text style={styles.logoLabel}>Small Badge</Text>
            </View>
          </View>
        </View>

        {/* Premium Icon Variants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Icon Variants</Text>
          <View style={styles.logoRow}>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={80} variant="icon" />
              <Text style={styles.logoLabel}>Large Icon</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={60} variant="icon" />
              <Text style={styles.logoLabel}>Medium Icon</Text>
            </View>
            <View style={styles.logoContainer}>
              <VaultKeLogo size={40} variant="icon" />
              <Text style={styles.logoLabel}>Small Icon</Text>
            </View>
          </View>
        </View>

        {/* Design Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Design Features</Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>🏭 Industrial-grade metallic textures</Text>
            <Text style={styles.featureItem}>🔒 Realistic vault door mechanism</Text>
            <Text style={styles.featureItem}>⚙️ Precision combination lock dial</Text>
            <Text style={styles.featureItem}>🔩 Authentic security bolts & rings</Text>
            <Text style={styles.featureItem}>✨ Premium gold accents & glow effects</Text>
            <Text style={styles.featureItem}>🎯 Professional radial gradients</Text>
            <Text style={styles.featureItem}>📱 Scalable SVG with advanced filters</Text>
            <Text style={styles.featureItem}>🌍 African fintech brand identity</Text>
            <Text style={styles.featureItem}>🛡️ Security-first visual language</Text>
            <Text style={styles.featureItem}>⚡ Timeless, designer-approved aesthetics</Text>
          </View>
        </View>

        {/* Color Palette */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Color System</Text>
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: '#64748B' }]}>
              <Text style={styles.colorText}>#64748B</Text>
              <Text style={styles.colorLabel}>Steel</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#334155' }]}>
              <Text style={styles.colorText}>#334155</Text>
              <Text style={styles.colorLabel}>Dark Steel</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.colorText}>#F59E0B</Text>
              <Text style={styles.colorLabel}>Gold Lock</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#6366F1' }]}>
              <Text style={styles.colorText}>#6366F1</Text>
              <Text style={styles.colorLabel}>Brand</Text>
            </View>
          </View>
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: '#92400E' }]}>
              <Text style={styles.colorText}>#92400E</Text>
              <Text style={styles.colorLabel}>Bronze</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#10B981' }]}>
              <Text style={styles.colorText}>#10B981</Text>
              <Text style={styles.colorLabel}>Security</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#EC4899' }]}>
              <Text style={styles.colorText}>#EC4899</Text>
              <Text style={styles.colorLabel}>Accent</Text>
            </View>
            <View style={[styles.colorSwatch, { backgroundColor: '#0F172A' }]}>
              <Text style={styles.colorText}>#0F172A</Text>
              <Text style={styles.colorLabel}>Deep</Text>
            </View>
          </View>
        </View>

        {/* Usage Guidelines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Usage Guidelines</Text>
          <View style={styles.guidelineList}>
            <Text style={styles.guidelineItem}>• Use "full" variant for splash screens, headers, and marketing</Text>
            <Text style={styles.guidelineItem}>• Use "badge" variant for app icons, notifications, and certificates</Text>
            <Text style={styles.guidelineItem}>• Use "icon" variant for UI elements, buttons, and navigation</Text>
            <Text style={styles.guidelineItem}>• Maintain minimum size of 32px for optimal detail visibility</Text>
            <Text style={styles.guidelineItem}>• Preserve aspect ratio and metallic texture quality</Text>
            <Text style={styles.guidelineItem}>• Ensure adequate contrast on all background colors</Text>
            <Text style={styles.guidelineItem}>• Use on dark backgrounds for maximum premium impact</Text>
          </View>
        </View>

        {/* Technical Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Technical Excellence</Text>
          <View style={styles.guidelineList}>
            <Text style={styles.guidelineItem}>🔧 Advanced SVG filters for realistic metallic textures</Text>
            <Text style={styles.guidelineItem}>🎨 Radial gradients mimicking industrial vault materials</Text>
            <Text style={styles.guidelineItem}>⚙️ Precision-engineered combination lock mechanism</Text>
            <Text style={styles.guidelineItem}>🔩 Authentic security bolt placement and sizing</Text>
            <Text style={styles.guidelineItem}>✨ Multi-layer shadow and glow effects</Text>
            <Text style={styles.guidelineItem}>📐 Mathematical precision in spoke and ring positioning</Text>
            <Text style={styles.guidelineItem}>🎯 Designer-approved color harmony and contrast</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  testSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    alignItems: 'center',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 10,
  },
  logoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  featureList: {
    backgroundColor: '#161B22',
    padding: 15,
    borderRadius: 10,
  },
  featureItem: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 70,
    height: 70,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  colorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  colorLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    marginTop: 2,
  },
  guidelineList: {
    backgroundColor: '#161B22',
    padding: 15,
    borderRadius: 10,
  },
  guidelineItem: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
});

export default LogoShowcaseScreen;
