import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import ApiService from '../../services/api';
import Toast from 'react-native-toast-message';

const UpdateSupportRequestScreen = ({ route, navigation }) => {
  const { supportRequest } = route.params;
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  
  const [adminNotes, setAdminNotes] = useState(supportRequest?.adminNotes || '');
  const [newStatus, setNewStatus] = useState(supportRequest?.status || 'open');
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: 'open', label: 'Open', color: colors.warning },
    { value: 'in_progress', label: 'In Progress', color: colors.info },
    { value: 'resolved', label: 'Resolved', color: colors.success },
    { value: 'closed', label: 'Closed', color: colors.textSecondary },
  ];

  const handleUpdateRequest = async () => {
    try {
      setLoading(true);
      
      const updateData = {
        status: newStatus,
        adminNotes: adminNotes.trim(),
      };

      const response = await ApiService.updateSupportRequest(supportRequest.id, updateData);

      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Support request updated successfully',
        });

        navigation.goBack();
      } else {
        throw new Error(response.error || 'Failed to update support request');
      }
    } catch (error) {
      console.error('Failed to update support request:', error);
      Alert.alert('Error', error.message || 'Failed to update support request');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleUpdateRequest}
          disabled={loading}
        >
          <Ionicons name="checkmark" size={20} color={colors.white} />
          <Text style={[styles.saveButtonText, { color: colors.white }]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Request Details */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Request Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Subject:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{supportRequest.subject}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Category:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{supportRequest.category}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Priority:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{supportRequest.priority}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Created:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {formatDate(supportRequest.createdAt)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>User:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {supportRequest.userFirstName} {supportRequest.userLastName}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            {supportRequest.description}
          </Text>
        </View>

        {/* Status Update */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Update Status</Text>
          <View style={styles.statusOptions}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  {
                    backgroundColor: newStatus === option.value ? option.color + '20' : colors.background,
                    borderColor: newStatus === option.value ? option.color : colors.border,
                  },
                ]}
                onPress={() => setNewStatus(option.value)}
              >
                <View
                  style={[
                    styles.statusIndicator,
                    {
                      backgroundColor: newStatus === option.value ? option.color : colors.border,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    {
                      color: newStatus === option.value ? option.color : colors.text,
                      fontWeight: newStatus === option.value ? 'bold' : 'normal',
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Admin Notes */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Admin Notes</Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={adminNotes}
            onChangeText={setAdminNotes}
            placeholder="Add internal notes about this support request..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  saveButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  section: {
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    width: 80,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  statusOptions: {
    gap: spacing.sm,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    minHeight: 120,
  },
});

export default UpdateSupportRequestScreen;
