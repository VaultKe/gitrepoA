import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing } from '../../../utils/theme';
import { formatDate } from '../../../utils/dateUtils';

const ReminderItem = ({
  reminder,
  onToggle,
  onEdit,
  onDelete,
  index,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'daily': return 'today';
      case 'weekly': return 'calendar';
      case 'monthly': return 'calendar-outline';
      default: return 'time';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return 'One-time';
    }
  };

  const isReminderPast = (dateTime) => {
    return new Date(dateTime) < new Date();
  };

  const isPast = isReminderPast(reminder.dateTime);
  const reminderDate = new Date(reminder.dateTime);

  // Zebra design: alternate background colors
  const rowBackgroundColor = index % 2 === 0 ? colors.background : colors.surface;

  // Table row layout
  return (
    <View style={{
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: rowBackgroundColor,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    }}>
      {/* Title & Description */}
      <View style={{ flex: 3 }}>
        <Text style={{
          fontSize: 7,
          fontWeight: '600',
          color: colors.text,
        }} numberOfLines={1}>
          {reminder.title}
        </Text>
        {reminder.description && (
          <Text style={{
            fontSize: 7,
            color: colors.textSecondary,
            marginTop: 1,
          }} numberOfLines={1}>
            {reminder.description}
          </Text>
        )}
      </View>

      {/* Type */}
      <View style={{
        flex: 1,
        alignItems: 'center',
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: colors.primary + '15',
        }}>
          <Ionicons
            name={getTypeIcon(reminder.type)}
            size={7}
            color={colors.primary}
          />
            <Text style={{
              fontSize: 7,
              fontWeight: '500',
              marginLeft: 2,
              color: colors.primary,
            }}>
              {getTypeLabel(reminder.type)}
            </Text>
        </View>
      </View>

      {/* Date & Time */}
      <View style={{
        flex: 2,
        alignItems: 'center',
      }}>
          <Text style={{
            fontSize: 7,
            color: colors.text,
          }}>
            {formatDate(reminderDate, 'datetime')}
          </Text>
      </View>

      {/* Status */}
      <View style={{
        flex: 1,
        alignItems: 'center',
      }}>
        {isPast ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: colors.error + '15',
          }}>
            <Ionicons name="time" size={7} color={colors.error} />
              <Text style={{
                fontSize: 7,
                fontWeight: '500',
                marginLeft: 2,
                color: colors.error,
              }}>Past</Text>
          </View>
        ) : (
          <Switch
            value={reminder.isEnabled}
            onValueChange={() => onToggle(reminder)}
            trackColor={{ false: colors.border, true: colors.primary + '30' }}
            thumbColor={reminder.isEnabled ? colors.primary : colors.textSecondary}
            style={{
              transform: [{ scaleX: 0.5 }, { scaleY: 0.5 }],
            }}
          />
        )}
      </View>

      {/* Actions */}
      <View style={{
        flex: 1.5,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
      }}>
        <TouchableOpacity
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.primary + '15',
          }}
          onPress={() => onEdit(reminder)}
        >
          <Ionicons name="pencil" size={8} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.error + '15',
          }}
          onPress={() => onDelete(reminder)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash" size={8} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ReminderItem;