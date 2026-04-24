import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Rect,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  G,
  Polygon,
  Path,
  RadialGradient,
  FeDropShadow,
  FeTurbulence,
  FeColorMatrix,
  FeComposite,
  FeOffset,
  Ellipse
} from 'react-native-svg';

const VaultKeLogo = ({ 
  size = 120, 
  variant = 'full', // 'full', 'badge', 'icon'
  showText = true 
}) => {
  const renderFullLogo = () => (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        {/* Realistic Vault Door Gradients */}
        <RadialGradient id="vaultSteelGradient" cx="40%" cy="25%">
          <Stop offset="0%" stopColor="#E5E7EB" stopOpacity={1} />
          <Stop offset="30%" stopColor="#D1D5DB" stopOpacity={1} />
          <Stop offset="60%" stopColor="#9CA3AF" stopOpacity={1} />
          <Stop offset="85%" stopColor="#6B7280" stopOpacity={1} />
          <Stop offset="100%" stopColor="#374151" stopOpacity={1} />
        </RadialGradient>

        <LinearGradient id="vaultFrameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1F2937" stopOpacity={1} />
          <Stop offset="50%" stopColor="#111827" stopOpacity={1} />
          <Stop offset="100%" stopColor="#030712" stopOpacity={1} />
        </LinearGradient>

        <RadialGradient id="wheelGradient" cx="30%" cy="30%">
          <Stop offset="0%" stopColor="#FEF3C7" stopOpacity={1} />
          <Stop offset="40%" stopColor="#FCD34D" stopOpacity={1} />
          <Stop offset="70%" stopColor="#F59E0B" stopOpacity={1} />
          <Stop offset="100%" stopColor="#92400E" stopOpacity={1} />
        </RadialGradient>

        <LinearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#4B5563" stopOpacity={1} />
          <Stop offset="50%" stopColor="#374151" stopOpacity={1} />
          <Stop offset="100%" stopColor="#1F2937" stopOpacity={1} />
        </LinearGradient>

        <LinearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#6366F1" stopOpacity={1} />
          <Stop offset="50%" stopColor="#8B5CF6" stopOpacity={1} />
          <Stop offset="100%" stopColor="#EC4899" stopOpacity={1} />
        </LinearGradient>

        {/* Realistic Effects */}
        <Filter id="vaultShadow" x="-50%" y="-50%" width="200%" height="200%">
          <FeDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#000000" floodOpacity="0.5"/>
        </Filter>

        <Filter id="innerBevel" x="-50%" y="-50%" width="200%" height="200%">
          <FeOffset dx="1" dy="1"/>
          <FeGaussianBlur stdDeviation="2" result="offset-blur"/>
          <FeComposite in="SourceGraphic" in2="offset-blur" operator="over"/>
        </Filter>

        <Filter id="wheelGlow" x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <FeMerge>
            <FeMergeNode in="coloredBlur"/>
            <FeMergeNode in="SourceGraphic"/>
          </FeMerge>
        </Filter>
      </Defs>

      {/* Outer Vault Ring */}
      <Circle cx="60" cy="60" r="58" fill="url(#vaultRimGradient)" filter="url(#deepShadow)"/>

      {/* Main Vault Door */}
      <Circle cx="60" cy="60" r="48" fill="url(#vaultMetalGradient)" stroke="#334155" strokeWidth="2" filter="url(#metalTexture)"/>

      {/* Vault Door Bolts (Realistic) */}
      <G fill="#1E293B" stroke="#64748B" strokeWidth="0.5">
        <Circle cx="30" cy="30" r="3"/>
        <Circle cx="90" cy="30" r="3"/>
        <Circle cx="30" cy="90" r="3"/>
        <Circle cx="90" cy="90" r="3"/>
        <Circle cx="60" cy="20" r="2.5"/>
        <Circle cx="60" cy="100" r="2.5"/>
        <Circle cx="20" cy="60" r="2.5"/>
        <Circle cx="100" cy="60" r="2.5"/>
      </G>

      {/* Concentric Security Rings */}
      <Circle cx="60" cy="60" r="38" fill="none" stroke="#475569" strokeWidth="1" opacity="0.6"/>
      <Circle cx="60" cy="60" r="32" fill="none" stroke="#64748B" strokeWidth="1.5" opacity="0.8"/>
      <Circle cx="60" cy="60" r="26" fill="none" stroke="#334155" strokeWidth="2"/>

      {/* Premium Combination Lock Mechanism */}
      <Circle cx="60" cy="60" r="20" fill="url(#centerHubGradient)" stroke="#B45309" strokeWidth="2" filter="url(#goldGlow)"/>

      {/* Lock Mechanism Details */}
      <G stroke="#92400E" strokeWidth="1" fill="none">
        <Circle cx="60" cy="60" r="16"/>
        <Circle cx="60" cy="60" r="12"/>
        <Circle cx="60" cy="60" r="8"/>
      </G>

      {/* Combination Dial Markers */}
      <G stroke="#92400E" strokeWidth="2" strokeLinecap="round">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, index) => {
          const radian = (angle * Math.PI) / 180;
          const x1 = 60 + 18 * Math.cos(radian);
          const y1 = 60 + 18 * Math.sin(radian);
          const x2 = 60 + 15 * Math.cos(radian);
          const y2 = 60 + 15 * Math.sin(radian);
          return <Line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </G>

      {/* Central Handle/Dial */}
      <Circle cx="60" cy="60" r="6" fill="url(#handleGradient)" stroke="#92400E" strokeWidth="1"/>
      <Circle cx="60" cy="60" r="3" fill="#FEF3C7"/>
      <Rect x="58" y="57" width="4" height="6" fill="#92400E" rx="1"/>

      {/* Vault Spokes (Realistic Locking Mechanism) */}
      <G stroke="#334155" strokeWidth="3" strokeLinecap="round" opacity="0.9">
        <Line x1="60" y1="26" x2="60" y2="34" />
        <Line x1="60" y1="86" x2="60" y2="94" />
        <Line x1="94" y1="60" x2="86" y2="60" />
        <Line x1="26" y1="60" x2="34" y2="60" />
        <Line x1="81.2" y1="38.8" x2="75.8" y2="44.2" />
        <Line x1="38.8" y1="81.2" x2="44.2" y2="75.8" />
        <Line x1="81.2" y1="81.2" x2="75.8" y2="75.8" />
        <Line x1="38.8" y1="38.8" x2="44.2" y2="44.2" />
      </G>

      {/* Brand Elements */}
      <G opacity="0.8">
        <Rect x="15" y="105" width="30" height="2" fill="url(#brandGradient)" rx="1"/>
        {showText && (
          <SvgText x="85" y="115" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="url(#brandGradient)">
            Ke
          </SvgText>
        )}
      </G>

      {/* Security Indicators */}
      <G fill="#10B981" opacity="0.7">
        <Circle cx="25" cy="25" r="1.5"/>
        <Circle cx="95" cy="95" r="1.5"/>
      </G>
    </Svg>
  );

  const renderBadge = () => (
    <Svg width={size} height={size} viewBox="0 0 80 80">
      <Defs>
        {/* Premium Badge Gradients */}
        <RadialGradient id="badgeMetalGradient" cx="50%" cy="30%">
          <Stop offset="0%" stopColor="#F8FAFC" stopOpacity={1} />
          <Stop offset="50%" stopColor="#CBD5E1" stopOpacity={1} />
          <Stop offset="100%" stopColor="#64748B" stopOpacity={1} />
        </RadialGradient>

        <LinearGradient id="badgeFrameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#1E293B" stopOpacity={1} />
          <Stop offset="50%" stopColor="#334155" stopOpacity={1} />
          <Stop offset="100%" stopColor="#0F172A" stopOpacity={1} />
        </LinearGradient>

        <RadialGradient id="badgeGoldGradient" cx="30%" cy="30%">
          <Stop offset="0%" stopColor="#FEF3C7" stopOpacity={1} />
          <Stop offset="50%" stopColor="#F59E0B" stopOpacity={1} />
          <Stop offset="100%" stopColor="#92400E" stopOpacity={1} />
        </RadialGradient>

        <Filter id="badgeShadow">
          <FeDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.3"/>
        </Filter>
      </Defs>

      {/* Premium Badge Frame */}
      <Rect x="2" y="2" width="76" height="76" rx="18" fill="url(#badgeFrameGradient)" filter="url(#badgeShadow)"/>

      {/* Inner Metallic Surface */}
      <Circle cx="40" cy="40" r="32" fill="url(#badgeMetalGradient)" stroke="#334155" strokeWidth="1.5"/>

      {/* Vault Door Bolts */}
      <G fill="#1E293B" stroke="#64748B" strokeWidth="0.3">
        <Circle cx="20" cy="20" r="2"/>
        <Circle cx="60" cy="20" r="2"/>
        <Circle cx="20" cy="60" r="2"/>
        <Circle cx="60" cy="60" r="2"/>
      </G>

      {/* Security Rings */}
      <Circle cx="40" cy="40" r="24" fill="none" stroke="#475569" strokeWidth="1" opacity="0.6"/>
      <Circle cx="40" cy="40" r="18" fill="none" stroke="#334155" strokeWidth="1.5"/>

      {/* Central Lock Mechanism */}
      <Circle cx="40" cy="40" r="12" fill="url(#badgeGoldGradient)" stroke="#92400E" strokeWidth="1"/>

      {/* Combination Dial */}
      <G stroke="#92400E" strokeWidth="1" strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, index) => {
          const radian = (angle * Math.PI) / 180;
          const x1 = 40 + 10 * Math.cos(radian);
          const y1 = 40 + 10 * Math.sin(radian);
          const x2 = 40 + 8 * Math.cos(radian);
          const y2 = 40 + 8 * Math.sin(radian);
          return <Line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </G>

      {/* Central Handle */}
      <Circle cx="40" cy="40" r="4" fill="#FCD34D" stroke="#92400E" strokeWidth="0.5"/>
      <Circle cx="40" cy="40" r="2" fill="#FEF3C7"/>

      {/* Locking Spokes */}
      <G stroke="#334155" strokeWidth="2" strokeLinecap="round" opacity="0.8">
        <Line x1="40" y1="16" x2="40" y2="22" />
        <Line x1="40" y1="58" x2="40" y2="64" />
        <Line x1="64" y1="40" x2="58" y2="40" />
        <Line x1="16" y1="40" x2="22" y2="40" />
      </G>

      {/* Security Indicators */}
      <G fill="#10B981" opacity="0.7">
        <Circle cx="15" cy="15" r="1"/>
        <Circle cx="65" cy="65" r="1"/>
      </G>
    </Svg>
  );

  const renderIcon = () => (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Defs>
        <RadialGradient id="iconMetalGradient" cx="50%" cy="30%">
          <Stop offset="0%" stopColor="#F1F5F9" stopOpacity={1} />
          <Stop offset="50%" stopColor="#94A3B8" stopOpacity={1} />
          <Stop offset="100%" stopColor="#475569" stopOpacity={1} />
        </RadialGradient>

        <RadialGradient id="iconGoldGradient" cx="30%" cy="30%">
          <Stop offset="0%" stopColor="#FEF3C7" stopOpacity={1} />
          <Stop offset="100%" stopColor="#D97706" stopOpacity={1} />
        </RadialGradient>

        <Filter id="iconShadow">
          <FeDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.2"/>
        </Filter>
      </Defs>

      {/* Metallic Vault Door */}
      <Circle cx="30" cy="30" r="28" fill="url(#iconMetalGradient)" stroke="#334155" strokeWidth="1" filter="url(#iconShadow)"/>

      {/* Security Ring */}
      <Circle cx="30" cy="30" r="20" fill="none" stroke="#475569" strokeWidth="1" opacity="0.7"/>

      {/* Central Lock */}
      <Circle cx="30" cy="30" r="8" fill="url(#iconGoldGradient)" stroke="#92400E" strokeWidth="0.5"/>

      {/* Dial Markers */}
      <G stroke="#92400E" strokeWidth="1" strokeLinecap="round">
        {[0, 90, 180, 270].map((angle, index) => {
          const radian = (angle * Math.PI) / 180;
          const x1 = 30 + 6 * Math.cos(radian);
          const y1 = 30 + 6 * Math.sin(radian);
          const x2 = 30 + 5 * Math.cos(radian);
          const y2 = 30 + 5 * Math.sin(radian);
          return <Line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </G>

      {/* Center Handle */}
      <Circle cx="30" cy="30" r="3" fill="#FCD34D"/>
      <Circle cx="30" cy="30" r="1.5" fill="#FEF3C7"/>

      {/* Locking Mechanism */}
      <G stroke="#334155" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
        <Line x1="30" y1="10" x2="30" y2="15" />
        <Line x1="30" y1="45" x2="30" y2="50" />
        <Line x1="50" y1="30" x2="45" y2="30" />
        <Line x1="10" y1="30" x2="15" y2="30" />
      </G>
    </Svg>
  );

  const renderLogo = () => {
    switch (variant) {
      case 'badge':
        return renderBadge();
      case 'icon':
        return renderIcon();
      default:
        return renderFullLogo();
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {renderLogo()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VaultKeLogo;
