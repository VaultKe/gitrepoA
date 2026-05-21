import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Linking,
  Dimensions,
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../../utils/theme';
import { toEAT, formatDate, nowEAT } from '../../../utils/dateUtils';
import Card from '../../../components/common/Card';
import Button from '../../../components/common/Button';
import ApiService from '../../../services/api';

const ChamaMeetingsScreen = ({ route, navigation, onRouteChange }) => {
  const { chamaId, chamaName, newMeeting, refresh, fromUserDashboard } = route.params || {};
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);

  // Responsive layout logic
  const screenWidth = Dimensions.get('window').width;
  const isTablet = screenWidth >= 768;
  const isDesktop = screenWidth >= 1024;

  // Calculate number of columns and card width
  const getNumColumns = () => {
    if (isDesktop) return 3; // 3 cards per row on desktop
    if (isTablet) return 2;  // 2 cards per row on tablet
    return 1; // 1 card per row on mobile
  };

  const numColumns = getNumColumns();
  const cardMargin = spacing.md;
  const availableWidth = screenWidth - (cardMargin * 2); // Account for container padding
  const cardWidth = numColumns > 1
    ? (availableWidth - (cardMargin * (numColumns - 1))) / numColumns
    : availableWidth;

  // Determine if we're showing all user meetings or chama-specific meetings
  const isUserMeetingsView = fromUserDashboard || !chamaId;

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  // Removed joinableMeetings state - banner was removed
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set());
  // Track which meeting descriptions are expanded and which are truncated
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());
  const [truncatedDescriptions, setTruncatedDescriptions] = useState(new Set());

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const filterOptions = [
    { id: 'all', name: 'All' },
    { id: 'scheduled', name: 'Upcoming' },
    { id: 'ongoing', name: 'Ongoing' },
    { id: 'ended', name: 'Past' },
  ];

  useEffect(() => {
    loadMeetings();
    loadDismissedNotifications();
    loadPersistedMeetingState();
  }, [chamaId, selectedTab]);

  // Load persisted meeting state from AsyncStorage
  const loadPersistedMeetingState = async () => {
    try {
      const persistedState = await AsyncStorage.getItem(`meetings_${chamaId}_${selectedTab}`);
      if (persistedState) {
        const { meetings: persistedMeetings, timestamp } = JSON.parse(persistedState);
        const now = Date.now();

        // Use persisted data if it's less than 5 minutes old
        if (now - timestamp < 5 * 60 * 1000) {
          setMeetings(persistedMeetings);
          updateMeetingNotifications(persistedMeetings);
        }
      }
    } catch (error) {
    }
  };

  // Persist meeting state to AsyncStorage
  const persistMeetingState = async (meetingsData) => {
    try {
      const stateToSave = {
        meetings: meetingsData,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`meetings_${chamaId}_${selectedTab}`, JSON.stringify(stateToSave));
    } catch (error) {
    }
  };

  // Auto-refresh every minute to update meeting join buttons
  useEffect(() => {
    const interval = setInterval(() => {
      loadMeetings();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [chamaId, selectedTab]);

  // Handle new meeting data from navigation
  useEffect(() => {
    if (newMeeting && refresh) {
      setMeetings(prevMeetings => {
        // Check if the new meeting should be visible in the current tab
        const meetingDate = new Date(newMeeting.scheduledAt || newMeeting.date);
        const now = new Date();
        const meetingDurationMinutes = newMeeting.duration || 60;
        const meetingEndTime = new Date(meetingDate.getTime() + (meetingDurationMinutes * 60 * 1000));
        const isUpcoming = meetingEndTime > now; // Meeting is upcoming if it hasn't ended yet

        let shouldAddToCurrentTab = true;
        if (selectedTab === 'upcoming' && !isUpcoming) {
          shouldAddToCurrentTab = false;
        } else if (selectedTab === 'past' && isUpcoming) {
          shouldAddToCurrentTab = false;
        }

        if (shouldAddToCurrentTab) {
          const updatedMeetings = [newMeeting, ...prevMeetings];
          return updatedMeetings;
        } else {
          return prevMeetings;
        }
      });

      // Show success toast with appropriate message
      const meetingDate = new Date(newMeeting.scheduledAt || newMeeting.date);
      const now = new Date();
      const meetingDurationMinutes = newMeeting.duration || 60;
      const meetingEndTime = new Date(meetingDate.getTime() + (meetingDurationMinutes * 60 * 1000));
      const isUpcoming = meetingEndTime > now; // Meeting is upcoming if it hasn't ended yet

      let toastMessage = `${newMeeting.title} has been scheduled successfully`;
      if (selectedTab === 'upcoming' && !isUpcoming) {
        toastMessage += '. Switch to "Past" tab to see it.';
      } else if (selectedTab === 'past' && isUpcoming) {
        toastMessage += '. Switch to "Upcoming" tab to see it.';
      }

      Toast.show({
        type: 'success',
        text1: 'Meeting Scheduled! 📅',
        text2: toastMessage,
        position: 'top',
        visibilityTime: 4000,
      });

      // Clear the navigation params to prevent re-adding
      navigation.setParams({ newMeeting: null, refresh: false });

      // Optionally refresh the full list from server after a short delay
      setTimeout(() => {
        loadMeetings();
      }, 1000);
    }
  }, [newMeeting, refresh, navigation]);

  const loadMeetings = async () => {
    try {
      setLoading(true);

      // Try to load from API first
      try {
        // Use different API calls based on context
        const response = isUserMeetingsView
          ? await ApiService.getUserMeetings(50, 0)  // Get all user meetings across chamas
          : await ApiService.getMeetings(chamaId);   // Get meetings for specific chama

        if (response.success) {
          let filteredMeetings = response.data || [];
          const now = nowEAT(); // Use EAT for current time

          if (selectedTab === 'upcoming') {
            filteredMeetings = filteredMeetings.filter(meeting => {
              // If meeting is manually ended, don't show in upcoming
              if (meeting.status === 'completed' || meeting.status === 'ended') {
                return false;
              }

              const meetingDate = meeting.scheduledAt || meeting.date;
              const meetingDateEAT = toEAT(meetingDate);

              // Meeting is upcoming if it hasn't started yet
              return meetingDateEAT > now;
            });
          } else if (selectedTab === 'ongoing') {
            filteredMeetings = filteredMeetings.filter(meeting => {
              // If meeting is manually ended, don't show in ongoing
              if (meeting.status === 'completed' || meeting.status === 'ended') {
                return false;
              }

              const meetingDate = meeting.scheduledAt || meeting.date;
              const meetingDateEAT = toEAT(meetingDate);
              const meetingDurationMinutes = meeting.duration || 60;
              const meetingEndTime = new Date(meetingDateEAT.getTime() + (meetingDurationMinutes * 60 * 1000));

              // Meeting is ongoing if it has started but not ended
              return meetingDateEAT <= now && meetingEndTime > now;
            });
          } else if (selectedTab === 'past') {
            filteredMeetings = filteredMeetings.filter(meeting => {
              // If meeting is manually ended, always show in past
              if (meeting.status === 'completed' || meeting.status === 'ended') {
                return true;
              }

              const meetingDate = meeting.scheduledAt || meeting.date;
              const meetingDateEAT = toEAT(meetingDate);
              const meetingDurationMinutes = meeting.duration || 60;
              const meetingEndTime = new Date(meetingDateEAT.getTime() + (meetingDurationMinutes * 60 * 1000));

              // Meeting is past only if it has completely ended
              return meetingEndTime <= now;
            });
          }

          setMeetings(filteredMeetings);
          persistMeetingState(filteredMeetings);

          // Update meeting notifications
          updateMeetingNotifications(response.data || []);
          return;
        }
      } catch (apiError) {
        console.error('📅 API call failed:', apiError);

        // Check if it's a specific database error
        if (apiError.message && apiError.message.includes('no such column')) {
          console.error('📅 Database schema error detected - backend needs to be updated');
        }

        // For now, don't use mock data - let the user know there's an issue
        setMeetings([]);
        return;
      }
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetings();
    setRefreshing(false);
  };

  // Load dismissed notifications from storage
  const loadDismissedNotifications = async () => {
    try {
      const dismissed = await AsyncStorage.getItem(`dismissed_notifications_${chamaId}`);
      if (dismissed) {
        setDismissedNotifications(new Set(JSON.parse(dismissed)));
      }
    } catch (error) {
      console.error('Failed to load dismissed notifications:', error);
    }
  };

  // Save dismissed notifications to storage
  const saveDismissedNotifications = async (dismissedSet) => {
    try {
      await AsyncStorage.setItem(
        `dismissed_notifications_${chamaId}`,
        JSON.stringify(Array.from(dismissedSet))
      );
    } catch (error) {
      console.error('Failed to save dismissed notifications:', error);
    }
  };

  // Create persistent notification for meeting starting soon
  const createPersistentNotification = (meeting) => {
    const notificationId = `meeting_${meeting.id}_starting_soon`;

    // Don't create if already dismissed
    if (dismissedNotifications.has(notificationId)) {
      return;
    }

    const meetingDate = toEAT(meeting.scheduledAt || meeting.date);
    const currentTime = nowEAT();
    const timeDiffMinutes = Math.floor((meetingDate - currentTime) / (1000 * 60));
    };

  // Dismiss a persistent notification
  const dismissNotification = async (notificationId) => {
    const newDismissed = new Set(dismissedNotifications);
    newDismissed.add(notificationId);
    setDismissedNotifications(newDismissed);
    await saveDismissedNotifications(newDismissed);

    // Remove from current notifications
    setPersistentNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  };

  // Update persistent notifications based on current meetings
  const updatePersistentNotifications = (allMeetings) => {
    const currentTime = nowEAT();

    // Clean up expired notifications (older than 30 minutes after meeting start)
    setPersistentNotifications(prev => {
      return prev.filter(notification => {
        const meetingDate = toEAT(notification.meeting.scheduledAt || notification.meeting.date);
        const timeSinceStart = (currentTime - meetingDate) / (1000 * 60);
        return timeSinceStart < 30; // Keep for 30 minutes after start
      });
    });

    // Create notifications for meetings starting soon
    allMeetings.forEach(meeting => {
      if (meeting.status === 'scheduled') {
        createPersistentNotification(meeting);
      }
    });
  };

  // Update persistent notifications for active meetings
  const updateMeetingNotifications = (allMeetings) => {
    updatePersistentNotifications(allMeetings);
  };

  const handleJoinMeeting = (meeting) => {
    // Debug: Log the entire meeting object to see what fields are available
    console.log('🔍 Full meeting object:', meeting);
    console.log('🔍 Available fields:', Object.keys(meeting));
    console.log('🔍 Navigation object:', navigation);
    console.log('🔍 Available navigation methods:', Object.keys(navigation));

    const meetingType = meeting.meetingType || meeting.type || meeting.meeting_type || 'virtual'; // Default to virtual
    const meetingDate = toEAT(meeting.scheduledAt || meeting.date);
    const currentTime = nowEAT();
    const meetingDurationMinutes = meeting.duration || 60;
    const meetingEndTime = new Date(meetingDate.getTime() + (meetingDurationMinutes * 60 * 1000));

    const isMeetingActive = currentTime >= meetingDate && currentTime <= meetingEndTime;
    const isMeetingEnded = currentTime > meetingEndTime;
    const isMeetingStartingSoon = (meetingDate - currentTime) <= (10 * 60 * 1000) && currentTime < meetingDate;



    // Handle ended meetings
    if (isMeetingEnded) {
      Alert.alert(
        '📝 Meeting Ended',
        `The meeting "${meeting.title}" has ended.\n\nWould you like to view the meeting summary or notes?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Summary', onPress: () => {
            navigation.navigate('MeetingSummary', {
              meetingId: meeting.id,
              meetingData: meeting,
              chamaId: chamaId || meeting.chamaId,
              chamaName: chamaName || meeting.chamaName || 'Chama'
            });
          }}
        ]
      );
      return;
    }

    if (meetingType === 'virtual') {
      // Navigate directly to online meeting screen

      // Show status-appropriate message
      if (isMeetingStartingSoon) {
        Alert.alert(
          '⏰ Meeting Starting Soon',
          `"${meeting.title}" will start in a few minutes.\n\nYou can join the virtual meeting room now.`,
          [
            { text: 'Wait', style: 'cancel' },
            { text: 'Join Now', onPress: () => {
              // Use chama layout navigation for meetings
              try {
                if (onRouteChange) {
                  onRouteChange('online-meeting', 'OnlineMeeting', {
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    userRole: getUserRole(),
                    meetingData: meeting,
                  });
                } else {
                  try {
                    // Check if we're in UserDashboard context
                    if (fromUserDashboard) {
                      navigation.navigate('OnlineMeeting', {
                        meetingId: meeting.id,
                        meetingTitle: meeting.title,
                        userRole: getUserRole(),
                        meetingData: meeting,
                      });
                    } else {
                      // We're in chama context
                      navigation.navigate('OnlineMeeting', {
                        meetingId: meeting.id,
                        meetingTitle: meeting.title,
                        userRole: getUserRole(),
                        meetingData: meeting,
                      });
                    }
                  } catch (navError) {
                    // Try to navigate to chama dashboard first, then to meeting
                    try {
                      if (meeting.chamaId) {
                        // Navigate to chama dashboard first
                        navigation.navigate('ChamaDashboard', {
                          screen: 'ChamaTabs',
                          params: {
                            screen: 'OnlineMeeting',
                            params: {
                              meetingId: meeting.id,
                              meetingTitle: meeting.title,
                              userRole: getUserRole(),
                              meetingData: meeting,
                            }
                          }
                        });
                      } else {
                        throw new Error('No chama ID available for navigation');
                      }
                    } catch (altNavError) {
                      console.error('❌ Alternative navigation failed:', altNavError);
                      Alert.alert(
                        'Navigation Error',
                        'Unable to join meeting through app navigation. This may be due to chama membership restrictions.',
                        [
                          { text: 'OK', style: 'default' }
                        ]
                      );
                    }
                  }
                }
              } catch (error) {
                console.error('❌ Navigation error:', error);
                Alert.alert('Navigation Error', `Failed to join meeting: ${error.message}. Please try again.`);
              }
            }}
          ]
        );
      } else {
        // Use chama layout navigation for meetings
        try {
          if (onRouteChange) {
            onRouteChange('online-meeting', 'OnlineMeeting', {
              meetingId: meeting.id,
              meetingTitle: meeting.title,
              userRole: getUserRole(),
              meetingData: meeting,
            });
          } else {
            // Fallback to direct navigation if onRouteChange not available
            try {
              // Check if we're in UserDashboard context
              if (fromUserDashboard) {
                navigation.navigate('OnlineMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: getUserRole(),
                  meetingData: meeting,
                });
              } else {
                // We're in chama context
                navigation.navigate('OnlineMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: getUserRole(),
                  meetingData: meeting,
                });
              }
            } catch (navError) {
              // Try to navigate to chama dashboard first, then to meeting
              try {
                if (meeting.chamaId) {
                  // Navigate to chama dashboard first
                  navigation.navigate('ChamaDashboard', {
                    screen: 'ChamaTabs',
                    params: {
                      screen: 'OnlineMeeting',
                      params: {
                        meetingId: meeting.id,
                        meetingTitle: meeting.title,
                        userRole: getUserRole(),
                        meetingData: meeting,
                      }
                    }
                  });
                } else {
                  throw new Error('No chama ID available for navigation');
                }
              } catch (altNavError) {
                Alert.alert(
                  'Navigation Error',
                  'Unable to join meeting through app navigation. This may be due to chama membership restrictions.',
                  [
                    { text: 'OK', style: 'default' }
                  ]
                );
              }
            }
          }
        } catch (error) {
          console.error('❌ Navigation error:', error);
          Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
        }
      }
    } else if (meetingType === 'physical') {
      // For active physical meetings, navigate directly without showing alert
      if (isMeetingActive || isMeetingStartingSoon) {
        try {
          let navigationSuccess = false;
          try {
            if (onRouteChange) {
              onRouteChange('physical-meeting', 'PhysicalMeeting', {
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                userRole: getUserRole(),
                meetingData: meeting,
                chamaId: chamaId,
              });
              navigationSuccess = true;
              console.log('✅ Chama layout navigation successful');
            } else {
              // Fallback to direct navigation if onRouteChange not available
              console.log('🔄 Fallback to direct navigation');
              navigation.navigate('PhysicalMeeting', {
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                userRole: getUserRole(),
                meetingData: meeting,
                chamaId: chamaId,
              });
              navigationSuccess = true;
              console.log('✅ Direct navigation successful');
            }
          } catch (error) {
            console.error('❌ Navigation failed:', error);
          }

          if (navigationSuccess) {
            return; // Exit early to avoid showing the alert
          } else {
            console.error('❌ All navigation methods failed');
            Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
            return;
          }
        } catch (error) {
          console.error('❌ Navigation error:', error);
          Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
          return;
        }
      }

      // For non-active physical meetings, show the alert with options
      console.log('📌 Showing physical meeting details...');
      const statusMessage = isMeetingActive
        ? 'The meeting is currently in progress!'
        : isMeetingStartingSoon
          ? 'The meeting will start soon. Please head to the location.'
          : 'Please arrive at the location on time.';

      Alert.alert(
        '📌 Physical Meeting',
        `Meeting: ${meeting.title}\n\nLocation: ${meeting.location}\n\nTime: ${formatMeetingTime(meeting.scheduledAt || meeting.date)} EAT\n\n${statusMessage}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Get Directions',
            onPress: () => {
              // TODO: Integrate with maps app
              Alert.alert('Directions', 'Map integration will be implemented here.');
            }
          },
          {
            text: 'Add to Calendar',
            onPress: () => handleAddToCalendar(meeting)
          },
          {
            text: 'Join Meeting',
            style: 'default',
            onPress: () => {
              console.log('📌 Navigating to PhysicalMeeting from alert...');

              try {
                if (onRouteChange) {
                  console.log('🔄 Using onRouteChange for PhysicalMeeting from alert');
                  onRouteChange('physical-meeting', 'PhysicalMeeting', {
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    userRole: getUserRole(),
                    meetingData: meeting,
                    chamaId: chamaId,
                  });
                } else {
                  // Fallback to direct navigation
                  const rootNavigation = navigation.getParent?.() || navigation;
                  rootNavigation.navigate('PhysicalMeeting', {
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    userRole: getUserRole(),
                    meetingData: meeting,
                    chamaId: chamaId,
                  });
                }

                console.log('✅ Successfully navigated to PhysicalMeeting from alert');
              } catch (error) {
                console.error('❌ Navigation error from alert:', error);
                Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
              }
            }
          },
        ]
      );
    } else if (meetingType === 'hybrid') {
      // Show options for hybrid meeting
      console.log('🔄 Showing hybrid meeting options...');
      const statusText = isMeetingActive
        ? 'The meeting is currently in progress.'
        : isMeetingStartingSoon
          ? 'The meeting will start soon.'
          : 'Choose how you would like to attend.';

      Alert.alert(
        '🔄 Hybrid Meeting Options',
        `"${meeting.title}"\n\n${statusText}\n\nHow would you like to attend?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: '🎥 Join Online',
            onPress: () => {
              console.log('🎥 User chose online for hybrid meeting');
              console.log('🎥 Navigating to OnlineMeeting with params:', {
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                userRole: getUserRole(),
                meetingData: meeting,
              });

              try {
                if (onRouteChange) {
                  console.log('🔄 Using onRouteChange for OnlineMeeting from hybrid');
                  onRouteChange('online-meeting', 'OnlineMeeting', {
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    userRole: getUserRole(),
                    meetingData: meeting,
                  });
                } else {
                  // Fallback to direct navigation
                  navigation.navigate('OnlineMeeting', {
                    meetingId: meeting.id,
                    meetingTitle: meeting.title,
                    userRole: getUserRole(),
                    meetingData: meeting,
                  });
                }
              } catch (error) {
                console.error('❌ Navigation error:', error);
                Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
              }
            }
          },
          {
            text: '📌 Attend Physically',
            onPress: () => {
              console.log('📌 User chose physical for hybrid meeting');
              Alert.alert(
                '📌 Physical Attendance',
                `Location: ${meeting.location}\n\nTime: ${formatMeetingTime(meeting.scheduledAt || meeting.date)} EAT\n\n${statusMessage}`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Add to Calendar', onPress: () => handleAddToCalendar(meeting) },
                  {
                    text: 'Join Meeting',
                    style: 'default',
                    onPress: () => {
                      console.log('📌 Navigating to PhysicalMeeting from hybrid choice');

                      // Navigate to PhysicalMeeting screen for hybrid physical attendance
                      console.log('🔄 Navigating to PhysicalMeeting for hybrid meeting...');
                      try {
                        if (onRouteChange) {
                          console.log('🔄 Using onRouteChange for PhysicalMeeting from hybrid');
                          onRouteChange('physical-meeting', 'PhysicalMeeting', {
                            meetingId: meeting.id,
                            meetingTitle: meeting.title,
                            userRole: getUserRole(),
                            meetingData: meeting,
                            chamaId: chamaId,
                          });
                        } else {
                          // Fallback to direct navigation
                          const rootNavigation = navigation.getParent?.() || navigation;
                          rootNavigation.navigate('PhysicalMeeting', {
                            meetingId: meeting.id,
                            meetingTitle: meeting.title,
                            userRole: getUserRole(),
                            meetingData: meeting,
                            chamaId: chamaId,
                          });
                        }

                        console.log('✅ Successfully navigated to PhysicalMeeting for hybrid');
                      } catch (error) {
                        console.error('❌ Navigation error:', error);
                        Alert.alert('Navigation Error', 'Failed to join meeting. Please try again.');
                      }
                    }
                  }
                ]
              );
            }
          },
        ]
      );
    } else {
      // Fallback for unknown meeting types - provide helpful information
      console.log('❓ Unknown meeting type, showing comprehensive info...');
      Alert.alert(
        'Meeting Information',
        `Meeting: ${meeting.title}\nType: ${meetingType}\nLocation: ${meeting.location}\nTime: ${formatMeetingTime(meeting.scheduledAt || meeting.date)} EAT\n\nPlease contact the meeting organizer for specific join instructions.`,
        [ { text: 'OK' }, { text: 'Add to Calendar', onPress: () => handleAddToCalendar(meeting) } ]
      );
    }
  };

  // Handle adding meeting to calendar
  const handleAddToCalendar = async (meeting) => {
    try {
      console.log('📅 Adding meeting to calendar:', meeting.id);

      // Call backend API to get Google Calendar URL
      const response = await ApiService.makeRequest(`/meetings/${meeting.id}/calendar/add-url`, {
        method: 'GET',
      });

      if (response.success && response.data?.url) {
        console.log('📅 Calendar URL received:', response.data.url);

        // Open the Google Calendar URL
        const canOpen = await Linking.canOpenURL(response.data.url);
        if (canOpen) {
          await Linking.openURL(response.data.url);
          console.log('📅 Opened Google Calendar URL');

          Toast.show({
            type: 'success',
            text1: 'Calendar Opened! 📅',
            text2: 'Add the meeting to your Google Calendar',
            position: 'top',
            visibilityTime: 3000,
          });
        } else {
          Alert.alert(
            'Cannot Open Calendar',
            'Unable to open Google Calendar. Please copy the URL manually.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Copy URL',
                onPress: () => {
                  // You could implement clipboard functionality here
                  Alert.alert('URL', response.data.url);
                }
              }
            ]
          );
        }
      } else {
        console.error('📅 Failed to get calendar URL:', response.error);
        Alert.alert(
          'Calendar Error',
          'Unable to generate calendar link. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('📅 Calendar integration error:', error);
      Alert.alert(
        'Calendar Error',
        'Failed to add meeting to calendar. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Helper function to get user role in the chama
  const getUserRole = () => {
    // TODO: Replace this with actual role checking logic
    // For now, return 'chairperson' for testing preview functionality
    // MODERATORS: chairperson, secretary, treasurer (can approve participants)
    return 'chairperson'; // Change this to test different roles: 'chairperson', 'secretary', 'treasurer', 'member'
  };

  // Check if user can preview meetings (chairperson, secretary, or treasurer)
  const canPreviewMeeting = () => {
    const role = getUserRole();
    return role === 'chairperson' || role === 'secretary' || role === 'treasurer';
  };

  // Handle meeting preview for chairpersons and secretaries
  const handlePreviewMeeting = async (meeting) => {
    try {
      const userRole = getUserRole();
      const response = await ApiService.makeRequest(`/meetings/${meeting.id}/preview?role=${userRole}`, {
        method: 'GET',
      });

      if (response.success) {
        const previewData = response.data;
        const meetingType = previewData.meetingType || meeting.meetingType || meeting.type;
        if (meetingType === 'physical') {
          try {
            console.log('🔄 Attempting navigation to PhysicalMeeting preview...');
            console.log('🔄 Navigation object methods:', Object.keys(navigation));

            // Try different navigation approaches
            let navigationSuccess = false;

            // Navigate to PhysicalMeeting preview
            try {
              // Get the root navigation to access main stack screens
              const rootNavigation = navigation.getParent?.() || navigation;

              // Use chama layout navigation for preview
              if (onRouteChange) {
                onRouteChange('physical-meeting', 'PhysicalMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: userRole,
                  isPreview: true,
                  previewData: previewData,
                  meetingData: meeting,
                  chamaId: chamaId,
                });
              } else {
                // Fallback to direct navigation
                rootNavigation.navigate('PhysicalMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: userRole,
                  isPreview: true,
                  previewData: previewData,
                  meetingData: meeting,
                  chamaId: chamaId,
                });
              }
            } catch (error) {
              Alert.alert('Navigation Error', 'Failed to open meeting preview. Please try again.');
            }
          } catch (error) {
            Alert.alert('Navigation Error', 'Failed to open meeting details. Please try again.');
          }
        } else {
          // For virtual/hybrid meetings
          if (previewData.fallbackMode) {
            // Handle fallback mode for meetings without LiveKit rooms
            Alert.alert(
              '🎥 Virtual Meeting Preview',
              `Meeting: ${meeting.title}\n\nTime: ${formatMeetingTime(meeting.scheduledAt || meeting.date)} EAT\n\n${previewData.previewMessage || 'This is a virtual meeting.'}\n\nMeeting URL: ${previewData.meetingUrl || 'Will be provided when meeting starts'}`,
              [
                { text: 'Close', style: 'cancel' },
                {
                  text: 'Open Meeting Details',
                  onPress: () => {
                    try {
                      if (onRouteChange) {
                        onRouteChange('online-meeting', 'OnlineMeeting', {
                          meetingId: meeting.id,
                          meetingTitle: meeting.title,
                          userRole: userRole,
                          isPreview: true,
                          previewData: previewData,
                          meetingData: meeting,
                          fallbackMode: true,
                        });
                      } else {
                        // Fallback to direct navigation
                        navigation.navigate('OnlineMeeting', {
                          meetingId: meeting.id,
                          meetingTitle: meeting.title,
                          userRole: userRole,
                          isPreview: true,
                          previewData: previewData,
                          meetingData: meeting,
                          fallbackMode: true,
                        });
                      }
                    } catch (error) {
                      Alert.alert('Navigation Error', 'Failed to open meeting details. Please try again.');
                    }
                  }
                }
              ]
            );
          } else {
            try {
              if (onRouteChange) {
                onRouteChange('online-meeting', 'OnlineMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: userRole,
                  isPreview: true,
                  previewData: previewData,
                });
              } else {
                // Fallback to direct navigation
                navigation.navigate('OnlineMeeting', {
                  meetingId: meeting.id,
                  meetingTitle: meeting.title,
                  userRole: userRole,
                  isPreview: true,
                  previewData: previewData,
                });
              }
            } catch (error) {
              Alert.alert('Navigation Error', 'Failed to join meeting preview. Please try again.');
            }
          }
        }
      } else {
        Alert.alert('Preview Error', response.error || 'Failed to generate meeting preview');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to preview meeting. Please try again.');
    }
  };

  const handleScheduleMeeting = () => {
    if (onRouteChange) {
      onRouteChange('create-meeting', 'CreateMeeting');
    } else {
      // Check if we're in UserDashboard context (fromUserDashboard flag)
      if (fromUserDashboard) {
        // In UserDashboard context, we can't navigate to CreateMeeting directly
        // Show an alert explaining this limitation
        Alert.alert(
          'Create Meeting',
          'To create a meeting, please navigate to your chama dashboard first.',
          [
            { text: 'OK', style: 'default' }
          ]
        );
      } else {
        // We're in chama context, can navigate to CreateMeeting
        navigation.navigate('CreateMeeting', { chamaId });
      }
    }
  };

  const formatMeetingDate = (dateString) => {
    const eatDate = toEAT(dateString);
    if (!eatDate) return 'Invalid Date';
    const day = eatDate.getDate();
    const month = eatDate.toLocaleString('en-KE', { month: 'short', timeZone: 'Africa/Nairobi' });
    const year = eatDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatMeetingTime = (dateString) => {
    const eatDate = toEAT(dateString);
    return formatDate(eatDate, 'time');
  };

  // Intelligent time formatting function
  const formatTimeRemaining = (minutes) => {
    const absMinutes = Math.abs(minutes);

    // Less than 1 minute
    if (absMinutes < 1) {
      return minutes >= 0 ? 'Starting now' : 'Just started';
    }

    // Less than 60 minutes - show minutes only
    if (absMinutes < 60) {
      const unit = absMinutes === 1 ? 'minute' : 'minutes';
      return minutes >= 0 ? `${absMinutes} ${unit} to go` : `Started ${absMinutes} ${unit} ago`;
    }

    // Less than 24 hours - show hours and minutes
    if (absMinutes < 1440) { // 24 * 60 = 1440 minutes
      const hours = Math.floor(absMinutes / 60);
      const remainingMinutes = absMinutes % 60;

      let timeStr = '';
      if (hours > 0) {
        const hourUnit = hours === 1 ? 'hour' : 'hours';
        timeStr += `${hours} ${hourUnit}`;
      }

      if (remainingMinutes > 0) {
        const minuteUnit = remainingMinutes === 1 ? 'minute' : 'minutes';
        timeStr += timeStr ? ` ${remainingMinutes} ${minuteUnit}` : `${remainingMinutes} ${minuteUnit}`;
      }

      return minutes >= 0 ? `${timeStr} to go` : `Started ${timeStr} ago`;
    }

    // 24 hours or more - show days and hours
    const days = Math.floor(absMinutes / 1440);
    const remainingHours = Math.floor((absMinutes % 1440) / 60);

    let timeStr = '';
    if (days > 0) {
      const dayUnit = days === 1 ? 'day' : 'days';
      timeStr += `${days} ${dayUnit}`;
    }

    if (remainingHours > 0) {
      const hourUnit = remainingHours === 1 ? 'hour' : 'hours';
      timeStr += timeStr ? ` ${remainingHours} ${hourUnit}` : `${remainingHours} ${hourUnit}`;
    }

    return minutes >= 0 ? `${timeStr} to go` : `Started ${timeStr} ago`;
  };

  // Compact version for badges (shorter text)
  const formatTimeRemainingCompact = (minutes) => {
    const absMinutes = Math.abs(minutes);

    // Less than 1 minute
    if (absMinutes < 1) {
      return minutes >= 0 ? 'NOW' : 'LIVE';
    }

    // Less than 60 minutes - show minutes only
    if (absMinutes < 60) {
      return `${absMinutes}m`;
    }

    // Less than 24 hours - show hours and minutes
    if (absMinutes < 1440) {
      const hours = Math.floor(absMinutes / 60);
      const remainingMinutes = absMinutes % 60;

      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }

    // 24 hours or more - show days and hours
    const days = Math.floor(absMinutes / 1440);
    const remainingHours = Math.floor((absMinutes % 1440) / 60);

    if (remainingHours === 0) {
      return `${days}d`;
    } else {
      return `${days}d ${remainingHours}h`;
    }
  };

  // Get dynamic status based on current time and selected tab
  const getDynamicStatus = (meeting, selectedTab) => {
    const meetingDate = meeting.scheduledAt || meeting.date;
    const meetingDateEAT = toEAT(meetingDate);
    const currentTime = nowEAT();
    const meetingDurationMinutes = meeting.duration || 60;
    const meetingEndTime = new Date(meetingDateEAT.getTime() + (meetingDurationMinutes * 60 * 1000));

    const isMeetingActive = currentTime >= meetingDateEAT && currentTime <= meetingEndTime;
    const isMeetingEnded = currentTime > meetingEndTime;

    // Return status based on selected tab
    switch (selectedTab) {
      case 'upcoming':
        return 'SCHEDULED';
      case 'ongoing':
        return 'ONGOING';
      case 'past':
        return 'ENDED';
      case 'all':
        if (isMeetingEnded) return 'ENDED';
        if (isMeetingActive) return 'ONGOING';
        return 'SCHEDULED';
      default:
        return 'SCHEDULED';
    }
  };

  // Filter and paginate meetings for table display
  const getFilteredMeetings = () => {
    let filtered = meetings;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.title?.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.location?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(meeting => {
        const status = getDynamicStatus(meeting, 'all').toLowerCase();
        return status === filterStatus.toLowerCase();
      });
    }

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedMeetings = filtered.slice(startIndex, endIndex);

    return {
      meetings: paginatedMeetings,
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return colors.primary;
      case 'ONGOING':
        return colors.warning;
      case 'ENDED':
        return colors.success;
      case 'cancelled':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const renderTable = () => {
    const { meetings: filteredMeetings, totalCount, totalPages } = getFilteredMeetings();

    return (
      <View style={styles.tableContainer}>
        {/* Table Header */}
        <View style={[styles.tableHeader, { backgroundColor: colors.surface }]}>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 2 }]}>Title</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1.5 }]}>Date</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1 }]}>Location</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderText, { color: colors.text, flex: 1.5 }]}>Actions</Text>
        </View>

        {/* Table Body */}
        <FlatList
          data={filteredMeetings}
          renderItem={({ item, index }) => (
            <View style={[styles.tableRow, index % 2 === 0 ? { backgroundColor: colors.background } : { backgroundColor: colors.surface }]}>
              <View style={{ flex: 2 }}>
                <Text style={[styles.tableCellText, { color: colors.text }]} numberOfLines={2}>
                  {item.title.length > 10 ? item.title.substring(0, 10) + '..' : item.title}
                </Text>
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={[styles.tableCellText, { color: colors.text }]}>
                  {formatMeetingDate(item.scheduledAt || item.date)}
                </Text>
              </View>
              <Text style={[styles.tableCellText, { color: colors.text, flex: 1 }]}>
                {item.location}
              </Text>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(getDynamicStatus(item, 'all')) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(getDynamicStatus(item, 'all')) }]}>
                    {getDynamicStatus(item, 'all')}
                  </Text>
                </View>
              </View>
              <View style={[styles.tableActions, { flex: 1.5 }]}>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: colors.primary }]}
                  onPress={() => handleViewSummary(item)}
                >
                  <Ionicons name="eye" size={12} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: colors.success }]}
                  onPress={() => handleAttend(item)}
                >
                  <Ionicons name="play" size={12} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButtonSmall, { backgroundColor: colors.error }]}
                  onPress={() => handleDelete(item)}
                >
                  <Ionicons name="trash" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={!loading && renderEmptyState()}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
              onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? colors.textSecondary : colors.text} />
            </TouchableOpacity>
            <Text style={[styles.pageText, { color: colors.text }]}>
              {currentPage} of {totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
              onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <Ionicons name="chevron-forward" size={16} color={currentPage === totalPages ? colors.textSecondary : colors.text} />
            </TouchableOpacity>
          </View>
        )}


      </View>
    );
  };

  // Table action handlers
  const handleViewSummary = (meeting) => {
    navigation.navigate('MeetingSummary', {
      meetingId: meeting.id,
      meetingData: meeting,
      chamaId: chamaId || meeting.chamaId,
      chamaName: chamaName || meeting.chamaName || 'Chama'
    });
  };

  const handleAttend = (meeting) => {
    handleJoinMeeting(meeting);
  };

  const handleDelete = (meeting) => {
    Alert.alert(
      'Delete Meeting',
      `Are you sure you want to delete "${meeting.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.makeRequest(`/meetings/${meeting.id}`, {
                method: 'DELETE',
              });
              if (response.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Meeting Deleted',
                  text2: 'The meeting has been removed successfully',
                  position: 'top',
                  visibilityTime: 3000,
                });
                loadMeetings(); // Refresh the list
              } else {
                Alert.alert('Error', 'Failed to delete meeting');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete meeting');
            }
          }
        }
      ]
    );
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Joinable meetings banner removed - was yellowish and close to header



  const renderMeeting = ({ item }) => {
    const meetingDate = item.scheduledAt || item.date; // Support both API and mock data
    const meetingDateEAT = toEAT(meetingDate);
    const currentTime = nowEAT();
    const isUpcoming = meetingDateEAT > currentTime;

    // Calculate time difference in minutes
    const timeDiffMinutes = Math.floor((meetingDateEAT - currentTime) / (1000 * 60));
    const meetingDurationMinutes = item.duration || 60;
    const meetingEndTime = new Date(meetingDateEAT.getTime() + (meetingDurationMinutes * 60 * 1000));

    // SIMPLIFIED: Clear meeting states based on actual time AND status
    const isMeetingActive = currentTime >= meetingDateEAT && currentTime <= meetingEndTime;
    const isMeetingEnded = currentTime > meetingEndTime || item.status === 'completed' || item.status === 'ended';
    const isMeetingStartingSoon = timeDiffMinutes <= 10 && timeDiffMinutes > 0;
    const hasMeetingStarted = currentTime >= meetingDateEAT;

    // Only allow joining if meeting hasn't ended (time-based OR status-based)
    const canJoinMeeting = !isMeetingEnded;

    // Calculate remaining time for active meetings
    const remainingMinutes = isMeetingActive ? Math.floor((meetingEndTime - currentTime) / (1000 * 60)) : 0;

    return (
      <Card variant="outlined" style={[
        styles.meetingCard,
        {
          width: numColumns > 1 ? cardWidth : '100%',
          marginHorizontal: numColumns > 1 ? cardMargin / 2 : 0,
        }
      ]}>
        <View style={styles.meetingHeader}>
          <View style={styles.meetingInfo}>
            <Text style={[styles.meetingTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            {isUserMeetingsView && item.chamaName && (
              <Text style={[styles.chamaName, { color: colors.primary }]}>
                📌 <strong>{item.chamaName}</strong>
              </Text>
            )}
            <TouchableOpacity
              onPress={() => {
                setExpandedDescriptions(prev => {
                  const next = new Set(prev);
                  if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                  return next;
                });
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.meetingDescription, { color: colors.text }]}>
                {expandedDescriptions.has(item.id)
                  ? item.description
                  : item.description.length > 100
                    ? item.description.substring(0, 100) + '...more'
                    : item.description
                }
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(getDynamicStatus(item, selectedTab)) + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: getStatusColor(getDynamicStatus(item, selectedTab)) }
              ]}>
                {getDynamicStatus(item, selectedTab)}
              </Text>
            </View>

            {/* Meeting timing status */}
            {item.status === 'scheduled' && (
              <View style={[ 
                styles.timingBadge,
                {
                  backgroundColor: isMeetingActive
                    ? colors.success + '20'
                    : canJoinMeeting
                      ? colors.warning + '20'
                      : 'transparent'
                }
              ]}>
                {isMeetingActive && (
                  <Text style={[styles.timingText, { color: colors.success }]}>
                    LIVE
                  </Text>
                )}
                {!isMeetingActive && canJoinMeeting && timeDiffMinutes > 0 && (
                  <Text style={[styles.timingText, { color: colors.warning }]}>
                    {formatTimeRemainingCompact(timeDiffMinutes)}
                  </Text>
                )}
                {!isMeetingActive && canJoinMeeting && timeDiffMinutes <= 0 && (
                  <Text style={[styles.timingText, { color: colors.warning }]}>
                    {formatTimeRemainingCompact(timeDiffMinutes)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.meetingDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {formatMeetingDate(meetingDate)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color={colors.secondary} />
            <Text style={[styles.detailText, { color: colors.text, fontWeight: isUserMeetingsView ? 'bold' : 'normal' }]}>
              {formatMeetingTime(meetingDate)} EAT
            </Text>
            {/* Show time status for user meetings view */}
            {isUserMeetingsView && item.status === 'scheduled' && (
              <Text style={[ 
                styles.timeStatus,
                {
                  color: isMeetingActive
                    ? colors.success
                    : canJoinMeeting
                      ? colors.warning
                      : colors.textSecondary,
                  fontWeight: 'bold',
                  marginLeft: 8
                }
              ]}>
                {isMeetingActive
                  ? '🔴 LIVE NOW'
                  : canJoinMeeting
                    ? `⏰ ${formatTimeRemaining(timeDiffMinutes)}`
                    : timeDiffMinutes < 0
                      ? '✅ Ended'
                      : `📅 ${formatTimeRemaining(Math.abs(timeDiffMinutes))}`
                }
              </Text>
            )}
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name={item.type === 'virtual' ? 'videocam' : 'location'}
              size={16}
              color={colors.warning}
            />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {item.location}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="people" size={16} color={colors.success} />
            <Text style={[styles.detailText, { color: colors.text }]}>
              {item.attendees} attendees
            </Text>
          </View>
        </View>

        {item.agenda && item.agenda.length > 0 && (
          <View style={styles.agendaSection}>
            <Text style={[styles.agendaTitle, { color: colors.text }]}>
              Agenda
            </Text>
            {item.agenda.map((agendaItem, index) => (
              <Text key={index} style={[styles.agendaItem, { color: colors.textSecondary }]}>
                {index + 1}. {agendaItem}
              </Text>
            ))}
          </View>
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.cardJoinButtonSection}>
          {isMeetingEnded ? (
            // Show View Summary button for past meetings
            <Button
              title="View Summary"
              onPress={() => navigation.navigate('MeetingSummary', {
                meetingId: item.id,
                meetingData: item,
                chamaId: chamaId || item.chamaId,
                chamaName: chamaName || item.chamaName || 'Chama'
              })}
              style={[styles.cardJoinButton, styles.summaryButton]}
              textStyle={[styles.cardJoinButtonText, { color: colors.white }]}
              icon={<Ionicons name="document-text" size={18} color={colors.white} />}
            />
          ) : (
            // Show Join button for upcoming/active meetings
            <Button
              title={
                isMeetingActive
                  ? `🔴 JOIN ${item.type?.toUpperCase() || 'MEETING'} NOW - LIVE`
                  : hasMeetingStarted
                    ? `🟡 JOIN ${item.type?.toUpperCase() || 'MEETING'} - IN PROGRESS`
                    : `🟢 JOIN ${item.type?.toUpperCase() || 'MEETING'}`
              }
              onPress={() => handleJoinMeeting(item)}
              disabled={false}
              style={[ 
                styles.cardJoinButton,
                isMeetingActive
                  ? styles.liveMeetingButton
                  : hasMeetingStarted
                    ? styles.inProgressMeetingButton
                    : isMeetingStartingSoon
                      ? styles.readyMeetingButton
                      : styles.scheduledMeetingButton
              ]}
              textStyle={[styles.cardJoinButtonText, { color: colors.white }]}
              icon={
                <Ionicons
                  name={
                    item.type === 'virtual' || item.type === 'hybrid'
                      ? isMeetingActive ? 'videocam' : 'videocam-outline'
                      : isMeetingActive ? 'location' : 'location-outline'
                  }
                  size={18}
                  color={colors.white}
                />
              }
            />
          )}
        </View>

        {/* Additional action buttons for scheduled meetings */}
        {item.status === 'scheduled' && !isMeetingActive && (
          <View style={styles.actionButtons}>
            <Button
              title="Add to Calendar"
              onPress={() => handleAddToCalendar(item)}
              style={styles.actionButton}
              variant="outline"
              icon={
                <Ionicons
                  name="calendar"
                  size={16}
                  color={colors.primary}
                />
              }
            />

            {/* Preview button for chairpersons and secretaries on virtual/hybrid meetings - Hidden when accessed from user dashboard */}
            {!isUserMeetingsView && (() => {
              const canPreview = canPreviewMeeting();
              const isVirtualOrHybrid = item.type === 'virtual' || item.meetingType === 'virtual' || item.type === 'hybrid' || item.meetingType === 'hybrid';
              // For testing: show preview for all meetings when user can preview
              const shouldShowPreview = canPreview; // Change back to: canPreview && isVirtualOrHybrid for production

              return shouldShowPreview ? (
                <Button
                  title="Preview Room"
                  onPress={() => handlePreviewMeeting(item)}
                  style={[styles.actionButton, styles.previewButton]}
                  variant="outline"
                  icon={
                    <Ionicons
                      name="eye"
                      size={16}
                      color={colors.secondary}
                    />
                  }
                />
              ) : null;
            })()}
          </View>
        )}
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Meetings Found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {isUserMeetingsView
          ? filterStatus === 'scheduled'
            ? 'No upcoming meetings from your chamas'
            : filterStatus === 'ended'
            ? 'No past meetings from your chamas'
            : 'No meetings found from your chamas'
          : filterStatus === 'scheduled'
            ? 'No upcoming meetings scheduled'
            : filterStatus === 'ended'
            ? 'No past meetings found'
            : 'No meetings have been scheduled yet'
        }
      </Text>
    </View>
  );

  // Render persistent notifications that survive screen reloads
  const renderPersistentNotifications = () => {
    if (persistentNotifications.length === 0) return null;

    return (
      <View style={styles.persistentNotificationsContainer}>
        {persistentNotifications.map((notification) => (
          <View
            key={notification.id}
            style={[ 
              styles.persistentNotification,
              {
                backgroundColor: notification.type === 'meeting_starting_soon'
                  ? notification.timeText.includes('Starting in')
                    ? '#FFA500' // Orange for starting soon
                    : '#FF4444' // Red for live/started
                  : colors.primary
              }
            ]}>
            <View style={styles.persistentNotificationContent}>
              <View style={styles.persistentNotificationIcon}>
                <Ionicons
                  name={
                    notification.timeText.includes('Starting in')
                      ? 'time'
                      : notification.timeText.includes('now')
                        ? 'radio-button-on'
                        : 'play-circle'
                  }
                  size={24}
                  color="white"
                />
              </View>

              <View style={styles.persistentNotificationText}>
                <Text style={styles.persistentNotificationTitle}>
                  {notification.title}
                </Text>
                <Text style={styles.persistentNotificationSubtitle}>
                  {notification.subtitle}
                </Text>
                <Text style={styles.persistentNotificationTime}>
                  {notification.timeText}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.persistentNotificationJoinButton}
                onPress={() => handleJoinMeeting(notification.meeting)}
              >
                <Ionicons name="arrow-forward" size={20} color="white" />
                <Text style={styles.persistentNotificationJoinText}>JOIN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.persistentNotificationDismissButton}
                onPress={() => dismissNotification(notification.id)}
              >
                <Ionicons name="close" size={18} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>

            {/* Pulsing indicator for live meetings */}
            {!notification.timeText.includes('Starting in') && (
              <View style={[styles.pulsingDot, { backgroundColor: 'rgba(255, 255, 255, 0.8)' }]} />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        {/* Search and Filter Row */}
        <View style={styles.tableControls}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Search meetings..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { borderColor: colors.border }]}
            onPress={() => setShowFilterDropdown(!showFilterDropdown)}
          >
            <Text style={[styles.filterButtonText, { color: colors.text }]}>
              {filterOptions.find(opt => opt.id === filterStatus)?.name || 'All'}
            </Text>
            <Ionicons name={showFilterDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Overlay */}
      {showFilterDropdown && (
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterDropdown(false)}
        />
      )}

      {/* Filter Dropdown - Rendered at root level for proper z-index */}
      {showFilterDropdown && (
        <View style={[styles.dropdownContainer, {
          position: 'absolute',
          top: 100, // Approximate position below header
          right: 20, // Position from right edge
          zIndex: 10000,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        }]}>
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.dropdownItem,
                filterStatus === filter.id && { backgroundColor: colors.primary }
              ]}
              onPress={() => {
                setFilterStatus(filter.id);
                setShowFilterDropdown(false);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
            >
              <Text style={[
                styles.dropdownItemText,
                { color: filterStatus === filter.id ? colors.white : colors.text }
              ]}>
                {filter.name}
              </Text>
              {filterStatus === filter.id && (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* PERSISTENT NOTIFICATIONS - SURVIVE SCREEN RELOADS */}
      {renderPersistentNotifications()}

      {/* Meetings Table */}
      <View style={{ flex: 1 }}>
        {renderTable()}
      </View>

      {!isUserMeetingsView && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handleScheduleMeeting}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.sm,
  },
  headerTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  headerTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: spacing.sm,
  },
  headerTabText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },

  meetingsList: {
    padding: spacing.md,
  },
  row: {
    justifyContent: 'space-around',
    marginHorizontal: -spacing.md / 2,
  },
  meetingCard: {
    marginBottom: spacing.md,
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  meetingInfo: {
    flex: 1,
    marginRight: spacing.md,
    minHeight: 80,
  },
  meetingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  chamaName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  meetingDescription: {
    fontSize: typography.fontSize.base,
    lineHeight: 24,
    fontWeight: '600',
    minHeight: 50,
    paddingVertical: spacing.xs,
    letterSpacing: 0.4,
  },
  readMoreButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  readMoreText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: 8.5,
    fontWeight: typography.fontWeight.bold,
  },
  timingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  timingText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  activeMeetingButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  joinButtonContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: '#FFA500',
    backgroundColor: '#FFF8DC',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  liveMeetingContainer: {
    borderColor: '#FF4444',
    backgroundColor: '#FFE6E6',
    shadowColor: '#FF4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pulseIndicator: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
  },
  prominentJoinButton: {
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  liveMeetingButton: {
    backgroundColor: '#FF4444',
  },
  countdownMeetingButton: {
    backgroundColor: '#FFA500',
  },
  readyMeetingButton: {
    backgroundColor: '#28A745',
  },
  inProgressMeetingButton: {
    backgroundColor: '#FFA500',
  },
  scheduledMeetingButton: {
    backgroundColor: '#6C757D',
  },
  endedMeetingButton: {
    backgroundColor: '#495057',
  },
  summaryButton: {
    backgroundColor: '#6C63FF',
  },
  disabledMeetingButton: {
    backgroundColor: '#ADB5BD',
    opacity: 0.6,
  },
  prominentJoinButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  joinButtonSubtext: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Prominent banner styles
  joinableBanner: {
    margin: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  bannerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bannerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  bannerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerSubtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: 'white',
    marginTop: spacing.xs,
  },
  bannerTime: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  bannerJoinButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerJoinButtonText: {
    color: 'white',
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  pulsingDot: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.8,
  },
  meetingDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    marginLeft: spacing.sm,
  },
  timeStatus: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.xs,
  },
  agendaSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  agendaTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  agendaItem: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
    lineHeight: typography.lineHeight.relaxed,
  },
  cardJoinButtonSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cardJoinButton: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cardJoinButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButtons: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  previewButton: {
    flex: 0.8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  scheduleButton: {
    marginTop: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  // Persistent notification styles
  persistentNotificationsContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  persistentNotification: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  persistentNotificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  persistentNotificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  persistentNotificationText: {
    flex: 1,
    marginRight: spacing.md,
  },
  persistentNotificationTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  persistentNotificationSubtitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: 'white',
    marginTop: spacing.xs,
  },
  persistentNotificationTime: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  persistentNotificationJoinButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: spacing.sm,
  },
  persistentNotificationJoinText: {
    color: 'white',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  persistentNotificationDismissButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  // Table styles
  tableContainer: {
    flex: 1,
    padding: spacing.md,
  },
  tableControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    paddingVertical: spacing.xs,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 100,
    justifyContent: 'space-between',
  },
  filterButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: 8.5,
    fontWeight: typography.fontWeight.medium,
  },
  tableCellSubText: {
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  tableActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 2,
  },
  actionButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    textTransform: 'uppercase',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  dropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  dropdownContainer: {
    minWidth: 200,
    maxWidth: 250,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  dropdownItemText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});

export default ChamaMeetingsScreen;
