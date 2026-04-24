// VaultKe Dark Theme Configuration
export const VaultKeTheme = {
  colors: {
    // Primary colors
    primary: '#00D4AA',        // Teal green for primary actions
    primaryDark: '#00B894',    // Darker teal for pressed states
    primaryLight: '#55E6C1',   // Lighter teal for highlights
    
    // Background colors
    background: '#0D1117',     // Very dark background (GitHub dark)
    surface: '#161B22',        // Card/surface background
    surfaceVariant: '#21262D', // Alternative surface color
    
    // Text colors
    text: '#F0F6FC',           // Primary text (white-ish)
    textSecondary: '#8B949E',  // Secondary text (gray)
    textTertiary: '#6E7681',   // Tertiary text (darker gray)
    
    // Status colors
    success: '#238636',        // Green for success
    warning: '#D29922',        // Orange for warnings
    error: '#DA3633',          // Red for errors
    info: '#1F6FEB',           // Blue for info
    
    // Border and divider colors
    border: '#30363D',         // Border color
    divider: '#21262D',        // Divider color
    
    // Wallet specific colors
    walletBalance: '#00D4AA',  // Balance text color
    walletIncome: '#238636',   // Income/deposit color
    walletExpense: '#DA3633',  // Expense/withdrawal color
    
    // Chama specific colors
    chamaRole: {
      chairperson: '#D29922',  // Gold for chairperson
      treasurer: '#1F6FEB',    // Blue for treasurer
      secretary: '#8957E5',    // Purple for secretary
      member: '#8B949E',       // Gray for regular members
      assistant: '#6E7681',    // Darker gray for assistants
    },
    
    
    
    // Chat colors
    chatBubbleSent: '#00D4AA',     // Sent message bubble
    chatBubbleReceived: '#21262D', // Received message bubble
    chatOnline: '#238636',         // Online status
    chatOffline: '#6E7681',        // Offline status
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 50,
  },
  
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: 'bold',
      lineHeight: 40,
    },
    h2: {
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 36,
    },
    h3: {
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 32,
    },
    h4: {
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 28,
    },
    h5: {
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 24,
    },
    h6: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 22,
    },
    body1: {
      fontSize: 16,
      fontWeight: 'normal',
      lineHeight: 24,
    },
    body2: {
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 20,
    },
    caption: {
      fontSize: 12,
      fontWeight: 'normal',
      lineHeight: 16,
    },
    button: {
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 20,
    },
  },
  
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
  
  // Component specific styles
  components: {
    button: {
      primary: {
        backgroundColor: '#00D4AA',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
      },
      secondary: {
        backgroundColor: 'transparent',
        borderColor: '#00D4AA',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
      },
      danger: {
        backgroundColor: '#DA3633',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
      },
    },
    card: {
      backgroundColor: '#161B22',
      borderRadius: 12,
      padding: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: '#30363D',
    },
    input: {
      backgroundColor: '#21262D',
      borderColor: '#30363D',
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      fontSize: 16,
      color: '#F0F6FC',
    },
  },
};

// Helper functions for theme usage
export const getTextStyle = (variant) => {
  return {
    ...VaultKeTheme.typography[variant],
    color: VaultKeTheme.colors.text,
  };
};

export const getButtonStyle = (variant) => {
  return VaultKeTheme.components.button[variant];
};

export const getChamaRoleColor = (role) => {
  return VaultKeTheme.colors.chamaRole[role] || VaultKeTheme.colors.chamaRole.member;
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'success':
    case 'completed':
    case 'active':
      return VaultKeTheme.colors.success;
    case 'warning':
    case 'pending':
      return VaultKeTheme.colors.warning;
    case 'error':
    case 'failed':
    case 'cancelled':
      return VaultKeTheme.colors.error;
    case 'info':
    case 'processing':
      return VaultKeTheme.colors.info;
    default:
      return VaultKeTheme.colors.textSecondary;
  }
};
