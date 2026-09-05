import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// Without this, an uncaught error anywhere in the render tree it wraps
// unmounts everything with nothing shown -- in a dev client that's masked by
// the redbox, and on web the tab just logs to console and stays put, but a
// release Hermes APK has neither: the app hard-closes with no visible error.
// That's why crashes like the one right after login (dashboard renders a
// currency value via Intl.NumberFormat, which can throw for a locale Hermes'
// bundled ICU data doesn't cover) only ever showed up on installed builds.
// Deliberately dependency-free (no theme/context) so it still renders even
// if the thing that crashed was itself part of that context.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary] Caught error:', error, errorInfo?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              The app hit an unexpected error. You can try again, or close and reopen the app.
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
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
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    color: '#111827',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    color: '#6b7280',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
    backgroundColor: '#2563eb',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default AppErrorBoundary;
