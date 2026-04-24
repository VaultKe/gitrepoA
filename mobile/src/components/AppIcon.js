import React from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Rect,
  Text as SvgText,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Filter,
  FeDropShadow,
  FeTurbulence,
  FeColorMatrix,
  FeComposite,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  FeOffset,
  ClipPath
} from 'react-native-svg';

const AppIcon = ({ size = 48, style, circular = true }) => {
  const scaleFactor = size / 1024; // Original SVG is 1024x1024

  return (
    <View style={[
      { width: size, height: size },
      circular && {
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: '#F8FAFC' // Light background to ensure visibility
      },
      style
    ]}>
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          {/* Circular Mask for Round Containers */}
          <ClipPath id="circularMask">
            <Circle cx="512" cy="512" r="512"/>
          </ClipPath>

          {/* Ultra-Premium Metallic Gradients */}
          <RadialGradient id="vaultSteelGradient" cx="40%" cy="25%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <Stop offset="15%" stopColor="#F8FAFC" stopOpacity="1" />
            <Stop offset="35%" stopColor="#E2E8F0" stopOpacity="1" />
            <Stop offset="60%" stopColor="#CBD5E1" stopOpacity="1" />
            <Stop offset="85%" stopColor="#94A3B8" stopOpacity="1" />
            <Stop offset="100%" stopColor="#64748B" stopOpacity="1" />
          </RadialGradient>

          <RadialGradient id="vaultRimGradient" cx="50%" cy="30%">
            <Stop offset="0%" stopColor="#0F172A" stopOpacity="1" />
            <Stop offset="30%" stopColor="#1E293B" stopOpacity="1" />
            <Stop offset="70%" stopColor="#334155" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0F172A" stopOpacity="1" />
          </RadialGradient>

          <RadialGradient id="goldLockGradient" cx="25%" cy="25%">
            <Stop offset="0%" stopColor="#FFFBEB" stopOpacity="1" />
            <Stop offset="20%" stopColor="#FEF3C7" stopOpacity="1" />
            <Stop offset="50%" stopColor="#FCD34D" stopOpacity="1" />
            <Stop offset="80%" stopColor="#F59E0B" stopOpacity="1" />
            <Stop offset="100%" stopColor="#92400E" stopOpacity="1" />
          </RadialGradient>

          <LinearGradient id="brandAccentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#6366F1" stopOpacity="1" />
            <Stop offset="50%" stopColor="#8B5CF6" stopOpacity="1" />
            <Stop offset="100%" stopColor="#EC4899" stopOpacity="1" />
          </LinearGradient>

          {/* Advanced Filters for Realism */}
          <Filter id="premiumShadow" x="-50%" y="-50%" width="200%" height="200%">
            <FeDropShadow dx="0" dy="12" stdDeviation="24" floodColor="#000000" floodOpacity="0.4"/>
            <FeDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000000" floodOpacity="0.2"/>
          </Filter>

          <Filter id="metalTexture" x="-50%" y="-50%" width="200%" height="200%">
            <FeTurbulence baseFrequency="0.8" numOctaves="4" result="noise"/>
            <FeColorMatrix in="noise" type="saturate" values="0"/>
            <FeComposite in="SourceGraphic" in2="noise" operator="in" result="textured"/>
            <FeComposite in="textured" in2="SourceGraphic" operator="over"/>
          </Filter>

          <Filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <FeMerge>
              <FeMergeNode in="coloredBlur"/>
              <FeMergeNode in="SourceGraphic"/>
            </FeMerge>
          </Filter>
        </Defs>

        {/* Main Content Group with Circular Clipping */}
        <G clipPath="url(#circularMask)">
          {/* Outer Vault Frame (Dark Steel) */}
          <Circle cx="512" cy="512" r="480" fill="url(#vaultRimGradient)" filter="url(#premiumShadow)"/>

        {/* Main Vault Door (Brushed Steel) */}
        <Circle cx="512" cy="512" r="420" fill="url(#vaultSteelGradient)" stroke="#334155" strokeWidth="8" filter="url(#metalTexture)"/>

        {/* Vault Door Bolts (Industrial Grade) */}
        <G fill="#0F172A" stroke="#64748B" strokeWidth="4">
          <Circle cx="200" cy="200" r="24"/>
          <Circle cx="824" cy="200" r="24"/>
          <Circle cx="200" cy="824" r="24"/>
          <Circle cx="824" cy="824" r="24"/>
          <Circle cx="512" cy="120" r="20"/>
          <Circle cx="512" cy="904" r="20"/>
          <Circle cx="120" cy="512" r="20"/>
          <Circle cx="904" cy="512" r="20"/>
          {/* Corner reinforcement bolts */}
          <Circle cx="300" cy="300" r="16"/>
          <Circle cx="724" cy="300" r="16"/>
          <Circle cx="300" cy="724" r="16"/>
          <Circle cx="724" cy="724" r="16"/>
        </G>

        {/* Concentric Security Rings */}
        <Circle cx="512" cy="512" r="360" fill="none" stroke="#475569" strokeWidth="6" opacity="0.6"/>
        <Circle cx="512" cy="512" r="300" fill="none" stroke="#64748B" strokeWidth="8" opacity="0.8"/>
        <Circle cx="512" cy="512" r="240" fill="none" stroke="#334155" strokeWidth="10"/>

        {/* Premium Combination Lock Mechanism */}
        <Circle cx="512" cy="512" r="180" fill="url(#goldLockGradient)" stroke="#92400E" strokeWidth="12" filter="url(#goldGlow)"/>

        {/* Lock Mechanism Rings */}
        <G stroke="#B45309" strokeWidth="6" fill="none">
          <Circle cx="512" cy="512" r="160"/>
          <Circle cx="512" cy="512" r="140"/>
          <Circle cx="512" cy="512" r="120"/>
          <Circle cx="512" cy="512" r="100"/>
        </G>

        {/* Precision Combination Dial Markers */}
        <G stroke="#92400E" strokeWidth="8" strokeLinecap="round">
          {/* Main hour markers (12 positions) */}
          <Line x1="512" y1="340" x2="512" y2="360" />
          <Line x1="661" y1="363" x2="649" y2="375" />
          <Line x1="689" y1="512" x2="669" y2="512" />
          <Line x1="661" y1="661" x2="649" y2="649" />
          <Line x1="512" y1="684" x2="512" y2="664" />
          <Line x1="363" y1="661" x2="375" y2="649" />
          <Line x1="335" y1="512" x2="355" y2="512" />
          <Line x1="363" y1="363" x2="375" y2="375" />
          {/* Secondary markers */}
          <Line x1="590" y1="350" x2="586" y2="358" />
          <Line x1="674" y1="434" x2="666" y2="438" />
          <Line x1="674" y1="590" x2="666" y2="586" />
          <Line x1="590" y1="674" x2="586" y2="666" />
          <Line x1="434" y1="674" x2="438" y2="666" />
          <Line x1="350" y1="590" x2="358" y2="586" />
          <Line x1="350" y1="434" x2="358" y2="438" />
          <Line x1="434" y1="350" x2="438" y2="358" />
        </G>

        {/* Central Handle/Dial Assembly */}
        <Circle cx="512" cy="512" r="60" fill="#FCD34D" stroke="#92400E" strokeWidth="6" filter="url(#goldGlow)"/>
        <Circle cx="512" cy="512" r="40" fill="#FEF3C7" stroke="#B45309" strokeWidth="3"/>
        <Circle cx="512" cy="512" r="25" fill="#FBBF24"/>

        {/* Handle Grip */}
        <Rect x="502" y="487" width="20" height="50" fill="#92400E" rx="10"/>
        <Circle cx="512" cy="500" r="8" fill="#FEF3C7"/>

        {/* Vault Locking Spokes (Heavy Duty) */}
        <G stroke="#334155" strokeWidth="20" strokeLinecap="round" opacity="0.9">
          <Line x1="512" y1="180" x2="512" y2="240" />
          <Line x1="512" y1="784" x2="512" y2="844" />
          <Line x1="844" y1="512" x2="784" y2="512" />
          <Line x1="180" y1="512" x2="240" y2="512" />
          <Line x1="734" y1="290" x2="690" y2="334" />
          <Line x1="290" y1="734" x2="334" y2="690" />
          <Line x1="734" y1="734" x2="690" y2="690" />
          <Line x1="290" y1="290" x2="334" y2="334" />
        </G>

          {/* Security Status Indicators */}
          <G fill="#10B981" opacity="0.8">
            <Circle cx="150" cy="150" r="12"/>
            <Circle cx="874" cy="874" r="12"/>
            <Circle cx="150" cy="874" r="8"/>
            <Circle cx="874" cy="150" r="8"/>
          </G>
        </G>
      </Svg>
    </View>
  );
};

export default AppIcon;
