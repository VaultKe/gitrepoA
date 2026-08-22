import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { useApp } from '../context/AppContext';
import ApiService from '../services/api';

const useContactSupportScreen = ({ navigation }) => {
  const { theme, user } = useApp();
  
  const [selectedIssue, setSelectedIssue] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [contactMethod, setContactMethod] = useState('email');

  const issueTypes = [
    { id: 'account', label: 'Account Issues', icon: 'person-circle' },
    { id: 'payment', label: 'Payment Problems', icon: 'card' },
    { id: 'chama', label: 'Chama Related', icon: 'people' },
    { id: 'technical', label: 'Technical Issues', icon: 'bug' },
    { id: 'security', label: 'Security Concerns', icon: 'shield-checkmark' },
    { id: 'other', label: 'Other', icon: 'help-circle' },
  ];

  const priorityLevels = [
    { id: 'low', label: 'Low', description: 'General inquiry' },
    { id: 'medium', label: 'Medium', description: 'Issue affecting usage' },
    { id: 'high', label: 'High', description: 'Urgent issue' },
  ];

  const contactMethods = [
    { id: 'email', label: 'Email', icon: 'mail', description: 'Response within 24 hours' },
    { id: 'phone', label: 'Phone Call', icon: 'call', description: 'Business hours only' },
  ];

  const handleSubmitTicket = useCallback(async () => {
    if (!selectedIssue) {
      Alert.alert('Error', 'Please select an issue type.');
      return;
    }
    
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe your issue.');
      return;
    }

    try {
      const supportRequest = {
        category: selectedIssue,
        subject: `${issueTypes.find(t => t.id === selectedIssue)?.label || 'Support Request'}`,
        description: description.trim(),
        priority,
        userInfo: {
          userId: user?.id,
          email: user?.email,
          firstName: user?.firstName || user?.first_name,
          lastName: user?.lastName || user?.last_name,
        },
      };
      const response = await ApiService.createSupportRequest(supportRequest);
      if (response.success) {
        Alert.alert(
          'Support Request Submitted',
          `Your support request has been submitted successfully!\n\nRequest ID: #${response.data?.requestId || Date.now()}\n\nWe'll get back to you within 24 hours.`,
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedIssue('');
                setDescription('');
                setPriority('medium');
                setContactMethod('email');
                navigation.goBack();
              },
            },
          ]
        );
      } else {
        throw new Error(response.error || 'Failed to submit support request');
      }
    } catch (error) {
      console.error('Failed to create support request:', error);
      Alert.alert('Error', error.message || 'Failed to create support request. Please try again.');
    }
  }, [selectedIssue, description, priority, user, navigation, issueTypes]);

  const handleDirectContact = useCallback((method) => {
    switch (method) {
      case 'email':
        const email = 'support@vaultke.com';
        const subject = `VaultKe Support - ${issueTypes.find(t => t.id === selectedIssue)?.label || 'General Inquiry'}`;
        const body = `Issue Type: ${selectedIssue}\nPriority: ${priority}\n\nDescription:\n${description}\n\nUser ID: ${user?.id}\nApp Version: 1.0.0`;
        
        Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
          .catch(() => Alert.alert('Error', 'Unable to open email app'));
        break;
        
       case 'phone':
        const phoneNumber = '+254700000000';
        Alert.alert(
          'Call Support',
          `Call ${phoneNumber}?\n\nBusiness Hours: Mon-Fri 8AM-6PM EAT`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => Linking.openURL(`tel:${phoneNumber}`) },
          ]
        );
        break;
    }
  }, [selectedIssue, priority, description, user, issueTypes]);

  return {
    theme,
    user,
    selectedIssue,
    description,
    priority,
    contactMethod,
    issueTypes,
    priorityLevels,
    contactMethods,
    setSelectedIssue,
    setDescription,
    setPriority,
    setContactMethod,
    handleSubmitTicket,
    handleDirectContact,
  };
};

export default useContactSupportScreen;
