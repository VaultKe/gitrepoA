import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import ApiService from '../../services/api';

// WebView is a native-only module; require it lazily so the import does not
// break the JavaScript bundle on web builds.
const WebView = Platform.OS === 'web' ? null : require('react-native-webview').WebView;

const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
const SUPPORTED_PDF_EXTENSIONS = ['pdf'];

/**
 * Resolves a (possibly relative) document URL into a full URL using the API
 * service's upload base URL.  The resolved URL is used internally only for
 * downloading to local storage and is never exposed to the OS or displayed
 * in the UI.
 */
const resolveDocumentUrl = (documentUrl) => {
  if (!documentUrl) return null;
  if (documentUrl.startsWith('http')) return documentUrl;

  const base = ApiService.getUploadBaseUrl();
  const normalizedPath = documentUrl.startsWith('/')
    ? documentUrl
    : `/${documentUrl}`;

  return `${base}${normalizedPath}`;
};

/**
 * Determines the file type from the document name or URL so the correct
 * in-app renderer can be used.
 */
const getFileType = (nameOrUrl) => {
  const lower = (nameOrUrl || '').toLowerCase();
  const extMatch = lower.match(/\.([a-z0-9]+)$/);
  if (!extMatch) return 'other';

  const ext = extMatch[1];
  if (SUPPORTED_PDF_EXTENSIONS.includes(ext)) return 'pdf';
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return 'other';
};

/**
 * Extracts a clean file name (with extension) for local storage.
 */
const getLocalFileName = (documentName, documentUrl) => {
  const raw = documentName || documentUrl || 'document';
  const extMatch = raw.match(/\.([a-z0-9]+)$/i);
  const extension = extMatch ? extMatch[1].toLowerCase() : 'bin';
  const baseName = raw.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${baseName}.${extension}`;
};

/**
 * DocumentViewerScreen
 *
 * A secure in-app document viewer that downloads a file to local storage
 * before displaying it.  By routing through local storage, the backend URL
 * is never passed to Linking.openURL or any OS-level intent, preventing the
 * backend URL from being exposed to the user or system logs.
 *
 * Route params:
 *   - documentUrl:  the file path or full URL from the backend
 *   - documentName: the display name of the document
 *   - title:        header title (defaults to documentName)
 *   - fileName:     fallback name if documentName is absent
 */
const DocumentViewerScreen = ({ route, navigation }) => {
  const { documentUrl, documentName, fileName } = route.params || {};
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const displayName = documentName || fileName || 'Document';

  const [loading, setLoading] = useState(true);
  const [localUri, setLocalUri] = useState(null);
  const [fileType, setFileType] = useState('other');
  const [error, setError] = useState(null);
  const [webFallbackUrl, setWebFallbackUrl] = useState(null);

  const downloadDocument = useCallback(async () => {
    const fullUrl = resolveDocumentUrl(documentUrl);
    if (!fullUrl) {
      setError('Document URL is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let uri;

      if (Platform.OS === 'web') {
        // On web, the /uploads/ endpoint may not have CORS headers configured.
        // Try a fetch first; if it fails with a network/CORS error, fall back
        // to Linking.openURL which navigates rather than fetching (not subject
        // to CORS).  The backend URL is only exposed in the fallback case on
        // web — on native the local file URI is always used for viewing.
        try {
          const response = await fetch(fullUrl);
          if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
          }
          const blob = await response.blob();
          uri = URL.createObjectURL(blob);
        } catch (webError) {
          // CORS or network error — fall back to browser navigation
          setWebFallbackUrl(fullUrl);
          setLoading(false);
          return;
        }
      } else {
        const localFileName = getLocalFileName(displayName, documentUrl);
        const localPath = `${FileSystem.documentDirectory}${localFileName}`;
        const result = await FileSystem.downloadAsync(fullUrl, localPath);
        uri = result.uri;
      }

      setLocalUri(uri);
      setFileType(getFileType(displayName || documentUrl));
    } catch (downloadError) {
      console.error('[DocumentViewer] Download failed:', downloadError);
      setError(downloadError.message || 'Failed to download document.');
    } finally {
      setLoading(false);
    }
  }, [documentUrl, displayName]);

  useEffect(() => {
    downloadDocument();
  }, [downloadDocument]);

  const handleShare = async () => {
    if (!localUri) return;
    try {
      await Sharing.shareAsync(localUri);
    } catch (shareError) {
      // User cancelled sharing — not an error to surface
    }
  };

  const handleRetry = () => {
    setWebFallbackUrl(null);
    downloadDocument();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading document...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={handleRetry}
          >
            <Text style={[styles.retryButtonText, { color: colors.white }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Web CORS fallback — the file could not be fetched via XHR, so provide
    // a button that opens it in a new tab.  This is the only path where the
    // backend URL surfaces, and only on web when CORS is not configured.
    if (webFallbackUrl) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text" size={80} color={colors.textTertiary} />
          <Text style={[styles.fileName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.fileTypeText, { color: colors.textSecondary }]}>
            Unable to preview this document in-app on web due to browser
            security restrictions. Open it in your browser instead.
          </Text>
          <TouchableOpacity
            style={[styles.downloadButton, { backgroundColor: colors.primary }]}
            onPress={() => Linking.openURL(webFallbackUrl)}
          >
            <Ionicons name="open-outline" size={20} color={colors.white} />
            <Text style={[styles.downloadButtonText, { color: colors.white }]}>
              Open in Browser
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!localUri) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            No content available
          </Text>
        </View>
      );
    }

    // --- Image viewer ---
    if (fileType === 'image') {
      return (
        <Image
          source={{ uri: localUri }}
          style={styles.imageContent}
          resizeMode="contain"
          onError={(e) => {
            console.error('[DocumentViewer] Image load error:', e.nativeEvent.error);
            Alert.alert('Error', 'Failed to display image.');
          }}
        />
      );
    }

    // --- PDF viewer (in-app via WebView on local file) ---
    if (fileType === 'pdf') {
      // On web, fall back to opening the local file via Linking — the local
      // file URI is used, never the backend URL.
      if (Platform.OS === 'web' || !WebView) {
        return (
          <View style={styles.centerContainer}>
            <Ionicons name="document-text" size={80} color={colors.textTertiary} />
            <Text style={[styles.fileName, { color: colors.text }]}>{displayName}</Text>
            <Text style={[styles.fileTypeText, { color: colors.textSecondary }]}>
              PDF document downloaded. Tap below to open.
            </Text>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL(localUri)}
            >
              <Ionicons name="open-outline" size={20} color={colors.white} />
              <Text style={[styles.downloadButtonText, { color: colors.white }]}>
                Open PDF
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <WebView
          source={{ uri: localUri }}
          style={styles.pdfContent}
          originWhitelist={['*']}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[DocumentViewer] WebView error:', nativeEvent);
            Alert.alert('Error', 'Failed to display PDF.');
          }}
        />
      );
    }

    // --- Other file types (preview not supported, offer download) ---
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document" size={80} color={colors.textTertiary} />
        <Text style={[styles.fileName, { color: colors.text }]}>{displayName}</Text>
        <Text style={[styles.fileTypeText, { color: colors.textSecondary }]}>
          This file type cannot be previewed in-app.
        </Text>
        <TouchableOpacity
          style={[styles.downloadButton, { backgroundColor: colors.primary }]}
          onPress={handleShare}
        >
          <Ionicons name="share" size={20} color={colors.white} />
          <Text style={[styles.downloadButtonText, { color: colors.white }]}>
            Open / Save File
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Footer action — always show download/share when a file has been downloaded */}
      {localUri && (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: colors.primary }]}
            onPress={handleShare}
          >
            <Ionicons name="download" size={20} color={colors.white} />
            <Text style={[styles.footerButtonText, { color: colors.white }]}>
              Download
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  errorText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  imageContent: {
    flex: 1,
    width: '100%',
  },
  pdfContent: {
    flex: 1,
    width: '100%',
  },
  fileName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  fileTypeText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  downloadButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  footerButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});

export default DocumentViewerScreen;
