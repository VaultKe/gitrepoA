import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, shadows } from '../../utils/theme';
import ResponseFeedback from '../../components/ai/ResponseFeedback';
import MarkdownRenderer from '../../components/ai/MarkdownRenderer';


const AIAssistantScreen = ({ navigation }) => {
  const { theme, user, wallets, transactions, chamas } = useApp();
  const colors = getThemeColors(theme);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const flatListRef = useRef(null);

  const quickSuggestions = [
    { id: 1, text: "What's my account balance?", icon: "wallet" },
    { id: 2, text: "Show my spending this month", icon: "analytics" },
    { id: 3, text: "How can I save more money?", icon: "trending-up" },
    { id: 4, text: "Show my recent transactions", icon: "list" },
    { id: 5, text: "Help me create a budget", icon: "calculator" },
    { id: 6, text: "Investment advice for me", icon: "bar-chart" },
  ];

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = () => {
    const welcomeMessage = {
      id: Date.now(),
      type: 'ai',
      content: `Hello ${user?.first_name || 'there'}! 👋\n\nI'm your personal finance AI assistant. I can help you with:\n\n• Financial planning and budgeting\n• Investment advice\n• Savings strategies\n• Chama management tips\n• Spending analysis\n• Goal setting\n\nWhat would you like to know about your finances today?`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
    generateSuggestions();
  };

  const generateSuggestions = () => {
    // Generate personalized suggestions based on user data
    const personalizedSuggestions = [];

    if (wallets.length > 0) {
      const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
      if (totalBalance < 10000) {
        personalizedSuggestions.push({
          id: 'low_balance',
          text: "Tips to increase my savings",
          icon: "arrow-up-circle"
        });
      }
    }

    if (transactions.length > 0) {
      personalizedSuggestions.push({
        id: 'spending_analysis',
        text: "Analyze my recent spending",
        icon: "pie-chart"
      });
    }

    setSuggestions([...personalizedSuggestions, ...quickSuggestions.slice(0, 4)]);
  };

  const sendMessage = async (messageText = inputText) => {
    if (!messageText.trim()) return;

    const questionId = `q_${Date.now()}`;
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText.trim(),
      timestamp: new Date().toISOString(),
      questionId,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      // Generate AI response with optimization
      const aiResponse = await generateAIResponse(messageText, questionId);

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        questionId,
      };

      setMessages(prev => [...prev, aiMessage]);
      scrollToBottom();
    } catch (error) {
      console.error('AI response failed:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
        timestamp: new Date().toISOString(),
        questionId,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = async (userInput, questionId) => {
    try {
      // Use context data directly for immediate responses
      const response = await generateContextualResponse(userInput, {
        user,
        wallets,
        transactions,
        chamas
      });

      return response;

    } catch (error) {
      console.error('❌ AI Response generation error:', error);

      // Fallback response
      return `I'm having trouble processing your request right now. Please try again in a moment.`;
    }
  };

  const generateContextualResponse = async (question, contextData) => {
    const { user, wallets, transactions, chamas } = contextData;
    const questionLower = question.toLowerCase();

    // Debug: Log the actual data structure

    // Calculate real metrics from context data
    // Handle different wallet data structures
    let totalBalance = 0;
    if (Array.isArray(wallets) && wallets.length > 0) {
      // If wallets is an array, sum all balances
      totalBalance = wallets.reduce((sum, wallet) => {
        const balance = wallet.balance || wallet.amount || 0;
        return sum + balance;
      }, 0);
    } else if (wallets && typeof wallets === 'object' && wallets.balance !== undefined) {
      // If wallets is a single wallet object
      totalBalance = wallets.balance || 0;
    }
    const recentTransactions = Array.isArray(transactions) ? transactions.slice(0, 10) : [];
    const monthlyTransactions = Array.isArray(transactions) ? transactions.filter(t => {
      const transactionDate = new Date(t.created_at || t.timestamp);
      const now = new Date();
      return transactionDate.getMonth() === now.getMonth() &&
             transactionDate.getFullYear() === now.getFullYear();
    }) : [];

    const monthlySpending = monthlyTransactions
      .filter(t => t.type === 'withdrawal' || (t.amount && t.amount < 0))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'deposit' || (t.amount && t.amount > 0))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // Balance inquiry
    if (questionLower.includes('balance') || questionLower.includes('money') || questionLower.includes('have')) {
      // Check if we have wallet data
      if (!wallets || (Array.isArray(wallets) && wallets.length === 0)) {
        return `💰 **Account Balance**\n\nI don't see any wallet data loaded yet. Please make sure you're logged in and your wallet is set up.\n\n**To get started:**\n• Check your internet connection\n• Make sure you're logged in\n• Try refreshing the app\n\nOnce your wallet is loaded, I'll be able to show you your exact balance!`;
      }

      let response = `💰 **Your Current Balance**\n\n`;
      response += `**Total Balance: ${formatCurrency(totalBalance)}**\n\n`;

      // Handle wallet information display
      if (Array.isArray(wallets) && wallets.length > 0) {
        if (wallets.length > 1) {
          response += `**Wallet Breakdown:**\n`;
          wallets.forEach((wallet, index) => {
            const walletName = wallet.name || wallet.wallet_name || `Wallet ${index + 1}`;
            const walletBalance = wallet.balance || wallet.amount || 0;
            response += `• ${walletName}: ${formatCurrency(walletBalance)}\n`;
          });
          response += `\n`;
        } else {
          // Single wallet
          const wallet = wallets[0];
          if (wallet.wallet_id) {
            response += `**Wallet ID:** ${wallet.wallet_id}\n`;
          }
          if (wallet.currency) {
            response += `**Currency:** ${wallet.currency}\n`;
          }
          response += `\n`;
        }
      } else if (wallets && typeof wallets === 'object') {
        // Single wallet object
        if (wallets.wallet_id) {
          response += `**Wallet ID:** ${wallets.wallet_id}\n`;
        }
        if (wallets.currency) {
          response += `**Currency:** ${wallets.currency}\n`;
        }
        response += `\n`;
      }

      if (recentTransactions.length > 0) {
        response += `**Recent Activity:**\n`;
        response += `• ${monthlyTransactions.length} transactions this month\n`;
        response += `• Monthly spending: ${formatCurrency(monthlySpending)}\n`;
        response += `• Monthly income: ${formatCurrency(monthlyIncome)}\n`;
      } else {
        response += `**No recent transactions found.**\n`;
        response += `Start making transactions to see your activity here.\n`;
      }

      return response;
    }

    // Spending analysis
    if (questionLower.includes('spend') || questionLower.includes('expense') || questionLower.includes('cost')) {
      let response = `📊 **Your Spending Analysis**\n\n`;
      response += `**This Month's Summary:**\n`;
      response += `• Total Spending: ${formatCurrency(monthlySpending)}\n`;
      response += `• Number of Transactions: ${monthlyTransactions.length}\n`;

      if (monthlyTransactions.length > 0) {
        response += `• Average per Transaction: ${formatCurrency(monthlySpending / monthlyTransactions.length)}\n`;
      }

      response += `\n**Recent Transactions:**\n`;
      recentTransactions.slice(0, 5).forEach(t => {
        const date = new Date(t.created_at || t.timestamp).toLocaleDateString();
        const amount = formatCurrency(Math.abs(t.amount || 0));
        const type = t.type === 'withdrawal' ? '📉' : '📈';
        response += `${type} ${date}: ${amount}\n`;
      });

      return response;
    }

    // Transaction history
    if (questionLower.includes('transaction') || questionLower.includes('history') || questionLower.includes('recent')) {
      let response = `📋 **Your Transaction History**\n\n`;

      if (recentTransactions.length === 0) {
        response += `No transactions found. Start making transactions to see your history here.`;
        return response;
      }

      response += `**Recent Transactions:**\n`;
      recentTransactions.forEach(t => {
        const date = new Date(t.created_at || t.timestamp).toLocaleDateString();
        const amount = formatCurrency(Math.abs(t.amount || 0));
        const type = t.type === 'withdrawal' ? '📉' : '📈';
        const description = t.description || 'Transaction';
        response += `${type} ${date} - ${description}: ${amount}\n`;
      });

      return response;
    }

    // Savings advice
    if (questionLower.includes('save') || questionLower.includes('saving')) {
      let response = `🎯 **Personalized Savings Strategy**\n\n`;
      response += `**Your Financial Snapshot:**\n`;
      response += `• Current Balance: ${formatCurrency(totalBalance)}\n`;
      response += `• Monthly Income: ${formatCurrency(monthlyIncome)}\n`;
      response += `• Monthly Expenses: ${formatCurrency(monthlySpending)}\n`;

      const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlySpending) / monthlyIncome) * 100 : 0;
      response += `• Current Savings Rate: ${savingsRate.toFixed(1)}%\n\n`;

      response += `**💡 Recommendations:**\n`;
      if (savingsRate < 10) {
        response += `• ⚠️ Your savings rate is low. Try to save at least 10% of your income\n`;
        response += `• Look for ways to reduce expenses\n`;
      } else if (savingsRate < 20) {
        response += `• 👍 Good start! Try to increase your savings rate to 20%\n`;
      } else {
        response += `• 🌟 Excellent savings rate! Keep it up!\n`;
      }

      response += `• Set up automatic savings transfers\n`;
      response += `• Build an emergency fund of 3-6 months expenses\n`;

      return response;
    }

    // Default response
    return `Hello ${user?.first_name || 'there'}! 👋\n\nI can help you with:\n\n• **Account balance** - "What's my balance?"\n• **Spending analysis** - "How much did I spend this month?"\n• **Transaction history** - "Show my recent transactions"\n• **Savings advice** - "How can I save more money?"\n\nWhat would you like to know about your finances?`;
  };

  // Helper function for currency formatting
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.type === 'user';

    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
          </View>
        )}

        <View style={styles.messageContent}>
          <View style={[
            styles.messageBubble,
            {
              backgroundColor: isUser ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
            isUser ? styles.userBubble : styles.aiBubble,
          ]}>
            {isUser ? (
              // User messages - simple text
              <Text
                style={[
                  styles.userMessageText,
                  { color: colors.white }
                ]}
                selectable={true}
              >
                {item.content}
              </Text>
            ) : (
              // AI messages - rendered markdown
              <MarkdownRenderer
                content={item.content}
                style={styles.aiMessageContent}
              />
            )}

            <View style={styles.messageFooter}>
              <Text style={[
                styles.messageTime,
                { color: isUser ? colors.white + '80' : colors.textSecondary }
              ]}>
                {new Date(item.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </Text>
            </View>
          </View>

          {/* Add feedback component under AI messages */}
          {!isUser && (
            <ResponseFeedback
              questionId={item.questionId}
              responseId={item.id}
              onFeedbackSubmitted={(feedback) => {
                console.log('Feedback received:', feedback);
              }}
            />
          )}
        </View>
      </View>
    );
  };

  const renderSuggestions = () => (
    <View style={styles.suggestionsContainer}>
      <Text style={[styles.suggestionsTitle, { color: colors.textSecondary }]}>
        Try asking:
      </Text>
      <View style={styles.suggestionsGrid}>
        {suggestions.slice(0, 4).map((suggestion) => (
          <TouchableOpacity
            key={suggestion.id}
            style={[styles.suggestionChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => sendMessage(suggestion.text)}
          >
            <Ionicons name={suggestion.icon} size={14} color={colors.primary} />
            <Text style={[styles.suggestionText, { color: colors.text }]} numberOfLines={1}>
              {suggestion.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderInputArea = () => (
    <View style={[styles.staticFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                borderColor: colors.border,
              }
            ]}
            placeholder="Ask me anything about your finances..."
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? colors.primary : colors.backgroundSecondary,
              }
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? colors.white : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.staticHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.aiHeaderAvatar, { backgroundColor: colors.primary }]}>
          <Ionicons name="sparkles" size={20} color={colors.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Financial Assistant</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Your personal finance advisor
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }} // Extra padding for stack screens
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        {renderHeader()}

        {/* Messages */}
        {messages.map((message) => (
          <View key={message.id} style={{ paddingHorizontal: spacing.md }}>
            {renderMessage({ item: message })}
          </View>
        ))}

        {/* Loading indicator */}
        {loading && (
          <View style={[styles.typingIndicator, { backgroundColor: colors.surface, marginHorizontal: spacing.md }]}>
            <View style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="sparkles" size={16} color={colors.white} />
            </View>
            <View style={styles.typingDots}>
              <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
              <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
              <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
            </View>
          </View>
        )}

        {/* Suggestions */}
        {messages.length === 1 && renderSuggestions()}
      </ScrollView>

      {/* Fixed Footer */}
      <View style={styles.fixedFooter}>
        {renderInputArea()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  staticHeader: {
    borderBottomWidth: 1,
    ...shadows.sm,
    zIndex: 1000,
    elevation: 5,
  },
  mainContent: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aiHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  headerButton: {
    padding: spacing.sm,
  },

  // Message Styles - Mobile Optimized
  messageContainer: {
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    maxWidth: '100%',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginLeft: '20%', // Leave space for AI avatar
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    marginRight: '10%', // Leave space for user messages
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  messageContent: {
    flex: 1,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minWidth: 120,
  },
  userBubble: {
    borderBottomRightRadius: borderRadius.sm,
    alignSelf: 'flex-end',
  },
  aiBubble: {
    borderBottomLeftRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },

  // Text Styles
  userMessageText: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.fontSize.base * 1.4,
    marginBottom: spacing.xs,
  },
  aiMessageContent: {
    marginBottom: spacing.xs,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  messageTime: {
    fontSize: typography.fontSize.xs,
    opacity: 0.7,
  },

  // Typing Indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },

  // Suggestions - Compact & Elegant
  suggestionsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  suggestionsTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.sm,
    textAlign: 'left',
    opacity: 0.7,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    width: '48%',
    minHeight: 32,
    marginBottom: spacing.xs,
  },
  suggestionText: {
    fontSize: typography.fontSize.xs,
    marginLeft: spacing.xs,
    flex: 1,
    textAlign: 'left',
  },

  // Input Area - Mobile Optimized
  fixedFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 5,
  },
  staticFooter: {
    borderTopWidth: 1,
    ...shadows.sm,
  },
  inputContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg, // Extra padding for mobile keyboards
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 44, // Minimum touch target size
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    maxHeight: 120,
    minHeight: 44,
    marginRight: spacing.sm,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
});

export default AIAssistantScreen;
