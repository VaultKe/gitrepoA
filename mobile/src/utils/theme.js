// Theme colors and utilities for VaultKe app

export const lightTheme = {
  // Primary colors
    primary: '#00D4AA',        // Teal green for primary actions
    primaryDark: '#00B894',    // Darker teal for pressed states
    primaryLight: '#55E6C1',   // Lighter teal for highlights

  // Secondary colors
  secondary: '#059669', // Green
  secondaryLight: '#10B981',
  secondaryDark: '#047857',

  // Accent colors
  accent: '#DC2626', // Red
  accentLight: '#EF4444',
  accentDark: '#B91C1C',

  // Background colors
  background: '#F8FAFC',         // cool off-white
  backgroundSecondary: '#F1F5F9', 
  backgroundTertiary: '#E2E8F0',  // muted layer (Slate 200)

  // Surface colors
  surface: '#F5F5F5',
  surfaceSecondary: '#F9FAFB',    // soft light gray for variation
  card: '#FFFFFF',
  divider: '#E2E8F0',

  // Text colors
  text: '#0F172A',         // almost-black (Slate 900)
  textSecondary: '#334155', // darker gray-blue (Slate 700)
  textTertiary: '#64748B',  // medium gray (Slate 500)
  textInverse: '#FFFFFF',   // for dark surfaces

  // Border colors
  border: '#CBD5E1',        // light gray-blue (Slate 300)
  borderSecondary: '#E2E8F0',

  // Status colors
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#eb25b0',

  // Utility colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.05)',   // softer shadows
  shadowDark: 'rgba(0, 0, 0, 0.15)',

  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
};


export const darkTheme = {
  // Primary colors
  primary: '#29a8b4', // Blue
  primaryLight: '#35d3d5',
  primaryDark: '#3beff6',

  // Secondary colors
  secondary: '#10B981', // Green
  secondaryLight: '#135a40',
  secondaryDark: '#059669',

  // Accent colors
  accent: '#EF4444', // Red
  accentLight: '#F87171',
  accentDark: '#DC2626',

  // Background colors
  background: '#124366', // Slate 900
  backgroundSecondary: '#112e42', // Slate 800
  backgroundTertiary: '#334155', // Slate 700

  // Surface colors
  surface: '#08324e', // Slate 800
  surfaceSecondary: '#2E8BC0', // Slate 700
  card: '#1E293B',
  divider: '#334155',

  // Text colors
  text: '#F8FAFC', // Slate 50
  textSecondary: '#CBD5E1', // Slate 300
  textTertiary: '#94A3B8', // Slate 400
  textInverse: '#0F172A', // Slate 900

  // Border colors
  border: '#475569', // Slate 600
  borderSecondary: '#64748B', // Slate 500

  // Status colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Utility colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowDark: 'rgba(0, 0, 0, 0.5)',

  // Overlay colors
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

// Get theme colors based on theme mode
export const getThemeColors = (themeMode = 'light') => {
  return themeMode === 'dark' ? darkTheme : lightTheme;
};

// Common spacing values
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Common border radius values
export const borderRadius = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Typography styles
export const typography = {
  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  // Font weights
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
};

// Shadow styles - Updated to use boxShadow for web compatibility
export const shadows = {
  sm: {
    // Web: boxShadow format (preferred)
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
    // Mobile: legacy shadow props for React Native (still needed for native)
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    // Web: boxShadow format (preferred)
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    // Mobile: legacy shadow props for React Native (still needed for native)
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    // Web: boxShadow format (preferred)
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
    // Mobile: legacy shadow props for React Native (still needed for native)
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    // Web: boxShadow format (preferred)
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
    // Mobile: legacy shadow props for React Native (still needed for native)
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Helper function to get platform-appropriate shadow styles
// This helps avoid deprecation warnings on web while maintaining native compatibility
// Usage: ...getShadowStyle('md') instead of ...shadows.md
// Available levels: 'sm', 'md', 'lg', 'xl'
export const getShadowStyle = (shadowLevel = 'md') => {
  const shadowConfig = shadows[shadowLevel] || shadows.md;

  // For web, prefer boxShadow to avoid deprecation warnings
  if (typeof window !== 'undefined') {
    return {
      boxShadow: shadowConfig.boxShadow,
      // Still include elevation for React Native Web compatibility
      elevation: shadowConfig.elevation,
    };
  }

  // For native, use the traditional shadow props
  return {
    shadowColor: shadowConfig.shadowColor,
    shadowOffset: shadowConfig.shadowOffset,
    shadowOpacity: shadowConfig.shadowOpacity,
    shadowRadius: shadowConfig.shadowRadius,
    elevation: shadowConfig.elevation,
  };
};

// Common component styles
export const commonStyles = {
  // Container styles
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },

  // Card styles
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.sm,
    ...getShadowStyle('md'),
  },

  // Input styles
  input: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    borderWidth: 1,
    minHeight: 44,
  },

  // Button styles
  button: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text styles
  heading1: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    lineHeight: typography.lineHeight.tight,
  },

  heading2: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.tight,
  },

  heading3: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: typography.lineHeight.snug,
  },

  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },

  caption: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
    lineHeight: typography.lineHeight.normal,
  },

  // Layout styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  column: {
    flexDirection: 'column',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  spaceBetween: {
    justifyContent: 'space-between',
  },

  spaceAround: {
    justifyContent: 'space-around',
  },

  // Margin and padding utilities
  mt: (size) => ({ marginTop: spacing[size] || size }),
  mb: (size) => ({ marginBottom: spacing[size] || size }),
  ml: (size) => ({ marginLeft: spacing[size] || size }),
  mr: (size) => ({ marginRight: spacing[size] || size }),
  mx: (size) => ({ marginHorizontal: spacing[size] || size }),
  my: (size) => ({ marginVertical: spacing[size] || size }),
  m: (size) => ({ margin: spacing[size] || size }),

  pt: (size) => ({ paddingTop: spacing[size] || size }),
  pb: (size) => ({ paddingBottom: spacing[size] || size }),
  pl: (size) => ({ paddingLeft: spacing[size] || size }),
  pr: (size) => ({ paddingRight: spacing[size] || size }),
  px: (size) => ({ paddingHorizontal: spacing[size] || size }),
  py: (size) => ({ paddingVertical: spacing[size] || size }),
  p: (size) => ({ padding: spacing[size] || size }),
};

// Helper function to create themed styles
export const createThemedStyles = (styleFunction) => {
  return (themeMode = 'dark') => {
    const colors = getThemeColors(themeMode);
    return styleFunction(colors, spacing, typography, shadows);
  };
};

// Animation durations
export const animations = {
  fast: 150,
  normal: 300,
  slow: 500,
};

// Breakpoints for responsive design
export const breakpoints = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

export default {
  lightTheme,
  darkTheme,
  getThemeColors,
  spacing,
  borderRadius,
  typography,
  shadows,
  getShadowStyle,
  commonStyles,
  createThemedStyles,
  animations,
  breakpoints,
};
