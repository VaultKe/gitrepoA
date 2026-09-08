import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../utils/theme';
import { formatDate } from '../../utils/dateUtils';

const TYPE_META = {
  daily: { icon: 'sync-outline', label: 'Daily' },
  weekly: { icon: 'calendar-outline', label: 'Weekly' },
  monthly: { icon: 'calendar-clear-outline', label: 'Monthly' },
  once: { icon: 'alarm-outline', label: 'One-time' },
};

const relativeLabel = (target) => {
  const ms = target.getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  let value;
  if (abs < hr) value = `${Math.max(1, Math.round(abs / min))} min`;
  else if (abs < day) value = `${Math.round(abs / hr)} hr`;
  else value = `${Math.round(abs / day)} day${Math.round(abs / day) === 1 ? '' : 's'}`;
  return ms >= 0 ? `in ${value}` : `${value} ago`;
};

const ReminderItem = ({ reminder, onToggle, onEdit, onDelete }) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const meta = TYPE_META[reminder.type] || TYPE_META.once;
  const when = new Date(reminder.dateTime);
  const isPast = when.getTime() < Date.now();
  const active = reminder.isEnabled && !isPast;

  const Chip = ({ icon, text, tint }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.sm,
        backgroundColor: (tint || colors.textSecondary) + '18',
      }}
    >
      <Ionicons name={icon} size={12} color={tint || colors.textSecondary} />
      <Text style={{ fontSize: 11, fontWeight: typography.fontWeight.medium, color: tint || colors.textSecondary }}>
        {text}
      </Text>
    </View>
  );

  return (
    <View style={{ opacity: active || isPast ? 1 : 0.6 }}>
      {/* Title row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: (isPast ? colors.error : colors.primary) + '18',
          }}
        >
          <Ionicons name={meta.icon} size={17} color={isPast ? colors.error : colors.primary} />
        </View>

        <View style={{ flex: 1, paddingTop: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: typography.fontWeight.semibold, color: colors.text }} numberOfLines={1}>
            {reminder.title}
          </Text>
          {!!reminder.description && (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>
              {reminder.description}
            </Text>
          )}
        </View>

        {isPast ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.error + '18',
            }}
          >
            <Ionicons name="checkmark-done" size={13} color={colors.error} />
            <Text style={{ fontSize: 11, fontWeight: typography.fontWeight.bold, color: colors.error }}>Past</Text>
          </View>
        ) : (
          <Switch
            value={!!reminder.isEnabled}
            onValueChange={() => onToggle(reminder)}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={reminder.isEnabled ? colors.primary : colors.textSecondary}
          />
        )}
      </View>

      {/* Meta chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
        <Chip icon={meta.icon} text={meta.label} tint={colors.primary} />
        <Chip icon="time-outline" text={formatDate(when, 'datetime')} />
        {!isPast && <Chip icon="hourglass-outline" text={relativeLabel(when)} tint={colors.warning} />}
      </View>

      {/* Actions */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: spacing.sm,
          marginTop: spacing.sm,
          paddingTop: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => onEdit(reminder)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.primary + '15',
          }}
        >
          <Ionicons name="pencil" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: typography.fontWeight.semibold, color: colors.primary }}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onDelete(reminder)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.error + '15',
          }}
        >
          <Ionicons name="trash" size={14} color={colors.error} />
          <Text style={{ fontSize: 12, fontWeight: typography.fontWeight.semibold, color: colors.error }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ReminderItem;
