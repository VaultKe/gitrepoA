import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getThemeColors } from '../../utils/theme';

class MeetingErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MeetingErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { theme, onGoBack, fallbackTitle = 'Meeting' } = this.props;
      const colors = getThemeColors(theme);

      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: colors.text }]}>
              Unable to load {fallbackTitle}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              Something went wrong while loading this screen. Please try again or go back.
            </Text>
            {onGoBack && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={onGoBack}
              >
                <Text style={[styles.buttonText, { color: '#fff' }]}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MeetingErrorBoundary;
