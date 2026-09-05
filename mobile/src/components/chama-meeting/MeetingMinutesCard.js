import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import api from '../../services/api';
import { useApp } from '../../context/AppContext';
import { spacing, typography } from '../../utils/theme';

// Minutes are stored in the existing meeting-minutes record, whose `content`
// column is a plain string. We keep the uploaded file's url and name in there
// as JSON so no schema change is needed, and read it back tolerantly: records
// written by the physical-meeting flow hold plain notes text instead.
const readMinutes = (record) => {
  const content = record?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    if (parsed?.fileUrl) {
      return { fileUrl: parsed.fileUrl, fileName: parsed.fileName || 'Meeting minutes' };
    }
  } catch (e) {
    // Not JSON — fall through to the plain-text handling below.
  }

  if (/^https?:\/\//i.test(content)) {
    return { fileUrl: content, fileName: 'Meeting minutes' };
  }
  return { text: content };
};

const isApproved = (record) => String(record?.status || '').toLowerCase() === 'approved';

// `readOnly` turns the card into a record of what was filed: the minutes are
// shown and can be opened, but nothing can be uploaded or approved from here.
// The meeting summary uses it that way, so minutes are handled in one place --
// the meeting room -- rather than being actionable from two screens.
const MeetingMinutesCard = ({ meetingId, meetingTitle, chamaId, userRole, colors, navigation, readOnly = false }) => {
  const { user } = useApp();
  const [minutes, setMinutes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [chamaRole, setChamaRole] = useState(null);

  // Secretary and chairperson are roles *within a chama*, while the role
  // handed down through navigation is the account-level one. Resolve the
  // chama membership role where we can, and fall back to what we were given.
  useEffect(() => {
    let cancelled = false;
    if (!chamaId || !user?.id) return undefined;

    api.getChamaMember(chamaId, user.id)
      .then((response) => {
        if (!cancelled && response?.success && response.data?.role) {
          setChamaRole(String(response.data.role).toLowerCase());
        }
      })
      .catch((error) => console.warn('[Minutes] Could not resolve chama role:', error?.message || error));

    return () => { cancelled = true; };
  }, [chamaId, user?.id]);

  const role = chamaRole || String(userRole || '').toLowerCase();
  const isSecretary = role === 'secretary';
  const isChairperson = role === 'chairperson';

  const loadMinutes = useCallback(async () => {
    try {
      const response = await api.getMeetingMinutes(meetingId);
      setMinutes(response?.success ? response.data : null);
    } catch (error) {
      console.warn('[Minutes] Could not load minutes:', error?.message || error);
    } finally {
      setIsLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    setIsLoading(true);
    setMinutes(null);
    loadMinutes();
  }, [loadMinutes]);

  const handleUpload = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: '*/*', // a photo of handwritten minutes is as valid as a document
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const file = picked.assets[0];
      setIsBusy(true);

      const formData = new FormData();
      if (file.uri.startsWith('data:')) {
        const blob = await (await fetch(file.uri)).blob();
        formData.append('file', new File([blob], file.name, { type: file.mimeType }));
      } else {
        formData.append('file', { uri: file.uri, type: file.mimeType, name: file.name });
      }
      formData.append('meetingId', meetingId);
      formData.append('documentType', 'meeting_minutes');
      formData.append('description', `Minutes for ${meetingTitle || 'meeting'}`);

      const upload = await api.makeRequest(`/meetings/${meetingId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!upload?.success) throw new Error(upload?.error || 'Upload failed');

      const payload = JSON.stringify({
        fileUrl: upload.data?.url,
        fileName: file.name,
      });

      // Replacing rejected/pending minutes updates the existing record rather
      // than creating a second one for the same meeting.
      const saved = minutes
        ? await api.updateMeetingMinutes(meetingId, { content: payload, status: 'draft' })
        : await api.createMeetingMinutes(meetingId, { content: payload, status: 'draft', meetingId });
      if (!saved?.success) throw new Error(saved?.error || 'Could not save minutes');

      await loadMinutes();
      Toast.show({
        type: 'success',
        text1: 'Minutes uploaded',
        text2: 'Waiting for the chairperson to approve them.',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Upload failed',
        text2: error?.message || 'Could not upload the minutes.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsBusy(true);
      const response = await api.updateMeetingMinutes(meetingId, { status: 'approved' });
      if (!response?.success) throw new Error(response?.error || 'Approval failed');
      await loadMinutes();
      Toast.show({ type: 'success', text1: 'Minutes approved' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Approval failed',
        text2: error?.message || 'Could not approve the minutes.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const file = readMinutes(minutes);
  const approved = isApproved(minutes);
  const hasFile = !!file?.fileUrl;

  const openMinutes = () => {
    if (!hasFile) return;
    navigation.navigate('DocumentViewer', {
      documentUrl: file.fileUrl,
      documentName: file.fileName,
    });
  };

  // Both the secretary and the chairperson can put minutes up, and only while
  // nothing has been approved yet — once the chairperson signs off, the record
  // is final and the upload action goes away for everyone, themselves included.
  const canUpload = !readOnly && (isSecretary || isChairperson) && !approved;
  const canApprove = !readOnly && isChairperson && hasFile && !approved;

  const statusLabel = !minutes ? 'Not uploaded' : approved ? 'Approved' : 'Awaiting approval';
  const statusColor = !minutes ? colors.textTertiary : approved ? colors.success : colors.warning;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>Minutes</Text>
        <View style={[styles.statusPill, { borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {hasFile ? (
              <TouchableOpacity style={styles.fileRow} onPress={openMinutes}>
                <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
                <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                  {file.fileName}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : file?.text ? (
              <Text style={[styles.note, { color: colors.text }]}>{file.text}</Text>
            ) : (
              <Text style={[styles.note, { color: colors.textSecondary }]}>
                {!readOnly && (isSecretary || isChairperson)
                  ? 'No minutes yet. Upload a document or a photo of the minutes for this meeting.'
                  : 'Minutes for this meeting have not been uploaded yet.'}
              </Text>
            )}

            {(canUpload || canApprove) && (
              <View style={styles.actions}>
                {canUpload && (
                  <TouchableOpacity
                    style={[styles.action, { borderColor: colors.primary }]}
                    onPress={handleUpload}
                    disabled={isBusy}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>
                      {hasFile ? 'Replace' : 'Upload minutes'}
                    </Text>
                  </TouchableOpacity>
                )}

                {canApprove && (
                  <TouchableOpacity
                    style={[styles.action, { borderColor: colors.success, backgroundColor: colors.success }]}
                    onPress={handleApprove}
                    disabled={isBusy}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>Approve</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {isBusy && <ActivityIndicator style={styles.busy} color={colors.primary} />}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: spacing.md,
    overflow: 'hidden',
    elevation: 0,
    shadowOpacity: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  body: {
    padding: spacing.md,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  note: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  busy: {
    marginTop: spacing.sm,
  },
});

export default MeetingMinutesCard;
