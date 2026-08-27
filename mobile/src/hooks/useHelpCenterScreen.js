import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';

const useHelpCenterScreen = ({ navigation }) => {
  const { theme } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All Topics', icon: 'apps' },
    { id: 'account', label: 'Account', icon: 'person-circle' },
    { id: 'chama', label: 'Chama', icon: 'people' },
    { id: 'payments', label: 'Payments', icon: 'card' },
    { id: 'security', label: 'Security', icon: 'shield-checkmark' },
    { id: 'marketplace', label: 'Marketplace', icon: 'storefront' },
  ];

  const faqData = [
    {
      id: 1,
      category: 'account',
      question: 'How do I create a VaultKe account?',
      answer: 'To create an account:\n1. Download the VaultKe app\n2. Tap "Sign Up"\n3. Enter your phone number and email\n4. Verify your phone number with the SMS code\n5. Complete your profile information\n6. Set up your security PIN',
    },
    {
      id: 2,
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'To reset your password:\n1. Go to the login screen\n2. Tap "Forgot Password"\n3. Enter your registered email address\n4. Check your email for reset instructions\n5. Follow the link to create a new password',
    },
    {
      id: 3,
      category: 'chama',
      question: 'What is a Chama?',
      answer: 'A Chama is a traditional savings group where members contribute money regularly. VaultKe digitizes this process, making it easier to:\n• Track contributions\n• Manage loans\n• Monitor group finances\n• Communicate with members\n• Access group funds securely',
    },
    {
      id: 4,
      category: 'chama',
      question: 'How do I join a Chama?',
      answer: 'To join a Chama:\n1. Browse available Chamas in the "Browse Chamas" section\n2. Or get invited by an existing member\n3. Review the Chama rules and contribution requirements\n4. Tap "Request to Join"\n5. Wait for approval from Chama administrators\n6. Once approved, you can start contributing',
    },
    {
      id: 5,
      category: 'chama',
      question: 'How do I create my own Chama?',
      answer: 'To create a Chama:\n1. Go to "My Chamas" and tap "Create New Chama"\n2. Fill in Chama details (name, description, rules)\n3. Set contribution amounts and frequency\n4. Define member roles and permissions\n5. Invite initial members\n6. Launch your Chama once you have enough members',
    },
    {
      id: 6,
      category: 'payments',
      question: 'How do I make contributions?',
      answer: 'To make contributions:\n1. Go to your Chama dashboard\n2. Tap "Contribute"\n3. Select contribution type (regular, special, etc.)\n4. Enter the amount\n5. Choose payment method (wallet, M-Pesa, bank)\n6. Confirm the transaction\n7. You\'ll receive a confirmation receipt',
    },
    {
      id: 7,
      category: 'payments',
      question: 'What payment methods are supported?',
      answer: 'VaultKe supports:\n• VaultKe Wallet (instant transfers)\n• M-Pesa (mobile money)\n• Bank transfers\n• Debit/Credit cards\n• Direct bank deposits\n\nAll transactions are secured with bank-level encryption.',
    },
    {
      id: 8,
      category: 'payments',
      question: 'How do I withdraw money?',
      answer: 'To withdraw money:\n1. Go to your Wallet\n2. Tap "Withdraw"\n3. Enter the amount\n4. Select withdrawal method (M-Pesa, bank account)\n5. Confirm your PIN\n6. Processing time: M-Pesa (instant), Bank (1-3 business days)',
    },
    {
      id: 9,
      category: 'security',
      question: 'Is my money safe with VaultKe?',
      answer: 'Yes, your money is protected by:\n• Bank-level encryption (256-bit SSL)\n• Secure payment processing\n• Licensed financial institution partnerships\n• Regular security audits\n• Two-factor authentication\n• Transaction monitoring\n• Insurance coverage for deposits',
    },
    {
      id: 10,
      category: 'security',
      question: 'How do I enable two-factor authentication?',
      answer: 'To enable 2FA:\n1. Go to Settings > Security Settings\n2. Toggle "Two-Factor Authentication"\n3. Choose your preferred method (SMS, email, or authenticator app)\n4. Follow the setup instructions\n5. Verify with a test code\n6. 2FA will be required for sensitive actions',
    },
  ];

  const quickActions = [
    {
      id: 1,
      title: 'Contact Support',
      description: 'Get personalized help',
      icon: 'chatbubble',
      onPress: () => navigation.navigate('ContactSupport'),
    },
    {
      id: 2,
      title: 'Video Tutorials',
      description: 'Watch how-to guides',
      icon: 'play-circle',
      onPress: () => {
        Alert.alert('Coming Soon', 'Video tutorials will be available soon!');
      },
    },
    {
      id: 3,
      title: 'Community Forum',
      description: 'Connect with other users',
      icon: 'people',
      onPress: () => {
        Alert.alert('Coming Soon', 'Community forum will be available soon!');
      },
    },
  ];

  const filteredFAQs = useMemo(() => {
    return faqData.filter(faq => {
      const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
      const matchesSearch = searchQuery === '' || 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const toggleFAQ = useCallback((id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  }, [expandedFAQ]);

  return {
    theme,
    searchQuery,
    expandedFAQ,
    selectedCategory,
    categories,
    faqData,
    quickActions,
    filteredFAQs,
    setSearchQuery,
    setExpandedFAQ,
    setSelectedCategory,
    toggleFAQ,
  };
};

export default useHelpCenterScreen;
