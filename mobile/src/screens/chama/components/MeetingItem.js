import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors } from '../../../utils/theme';
import { formatDate } from '../../../utils/dateUtils';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';

const MeetingItem = ({
  meeting,
  cardWidth,
  onJoinMeeting,
  onPreviewMeeting,
  onAddToCalendar,
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return colors.primary;
      case 'ongoing': return colors.success;
      case 'past': return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'upcoming': return 'calendar';
      case 'ongoing': return 'radio-button-on';
      case 'past': return 'time';
      default: return 'help-circle';
    }
  };

  const isJoinable = meeting.status === 'ongoing' || (meeting.status === 'upcoming' && meeting.canJoinEarly);

  return (
    <Card style={{
      width: cardWidth,
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
    }}>
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <View style={{
          flex: 1,
          marginRight: 12,
          minHeight: 80,
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 4,
            color: colors.text,
          }} numberOfLines={2}>
            {meeting.title}
          </Text>

          {meeting.description && (
            <Text style={{
              fontSize: 16,
              lineHeight: 20,
              marginBottom: 8,
              color: colors.textSecondary,
            }} numberOfLines={3}>
              {meeting.description}
            </Text>
          )}

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
          }}>
            <Ionicons name="calendar" size={14} color={colors.textSecondary} />
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              marginLeft: 6,
              color: colors.textSecondary,
            }}>
              {formatDate(meeting.startTime, 'datetime')}
            </Text>
          </View>

          {meeting.location && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="location" size={14} color={colors.textSecondary} />
              <Text style={{
                fontSize: 14,
                marginLeft: 6,
                color: colors.textSecondary,
              }}>
                {meeting.location}
              </Text>
            </View>
          )}
        </View>

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: getStatusColor(meeting.status) + '15',
        }}>
          <Ionicons
            name={getStatusIcon(meeting.status)}
            size={12}
            color={getStatusColor(meeting.status)}
          />
          <Text style={{
            fontSize: 12,
            fontWeight: '500',
            marginLeft: 4,
            color: getStatusColor(meeting.status),
          }}>
            {meeting.status === 'upcoming' ? 'Upcoming' :
             meeting.status === 'ongoing' ? 'Ongoing' : 'Past'}
          </Text>
        </View>
      </View>

      <View style={{
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
      }}>
        {isJoinable ? (
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: colors.primary,
              gap: 6,
            }}
            onPress={() => onJoinMeeting(meeting)}
          >
            <Ionicons name="videocam" size={16} color={colors.white} />
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: colors.white,
            }}>
              Join
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
            onPress={() => onPreviewMeeting(meeting)}
          >
            <Ionicons name="eye" size={16} color={colors.text} />
            <Text style={{
              fontSize: 14,
              fontWeight: '500',
              color: colors.text,
            }}>
              Preview
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.secondary + '15',
          }}
          onPress={() => onAddToCalendar(meeting)}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.secondary} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

export default MeetingItem;