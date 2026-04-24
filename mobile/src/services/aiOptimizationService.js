import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AI Optimization Service
 * Handles learning from user interactions to improve AI responses
 */
class AIOptimizationService {
  constructor() {
    this.STORAGE_KEYS = {
      QUESTION_PATTERNS: 'ai_question_patterns',
      RESPONSE_FEEDBACK: 'ai_response_feedback',
      USER_PREFERENCES: 'ai_user_preferences',
      CONVERSATION_CONTEXT: 'ai_conversation_context'
    };
  }

  /**
   * Track user question patterns for learning
   */
  async trackQuestionPattern(question, userContext, responseType) {
    try {
      const questionData = {
        id: `q_${Date.now()}`,
        question: question.toLowerCase().trim(),
        originalQuestion: question,
        timestamp: new Date().toISOString(),
        userContext,
        responseType,
        wordCount: question.split(' ').length,
        keywords: this.extractKeywords(question),
        sentiment: this.analyzeSentiment(question),
        urgency: this.detectUrgency(question)
      };

      const patterns = await this.getStoredData(this.STORAGE_KEYS.QUESTION_PATTERNS, []);
      patterns.push(questionData);

      // Keep only last 200 questions to prevent storage bloat
      if (patterns.length > 200) {
        patterns.splice(0, patterns.length - 200);
      }

      await AsyncStorage.setItem(this.STORAGE_KEYS.QUESTION_PATTERNS, JSON.stringify(patterns));
      
      // Update user preferences based on question patterns
      await this.updateUserPreferences(questionData);
      
      return questionData.id;
    } catch (error) {
      console.warn('Failed to track question pattern:', error);
      return null;
    }
  }

  /**
   * Track user feedback on AI responses
   */
  async trackResponseFeedback(questionId, responseId, feedback) {
    try {
      const feedbackData = {
        questionId,
        responseId,
        feedback, // 'helpful', 'not_helpful', 'partially_helpful'
        timestamp: new Date().toISOString(),
        improvements: feedback.improvements || null
      };

      const feedbacks = await this.getStoredData(this.STORAGE_KEYS.RESPONSE_FEEDBACK, []);
      feedbacks.push(feedbackData);

      // Keep only last 100 feedbacks
      if (feedbacks.length > 100) {
        feedbacks.splice(0, feedbacks.length - 100);
      }

      await AsyncStorage.setItem(this.STORAGE_KEYS.RESPONSE_FEEDBACK, JSON.stringify(feedbacks));
      
      // Learn from feedback to improve future responses
      await this.learnFromFeedback(feedbackData);
      
    } catch (error) {
      console.warn('Failed to track response feedback:', error);
    }
  }

  /**
   * Find similar questions to improve response quality
   */
  async findSimilarQuestions(currentQuestion, limit = 5) {
    try {
      const patterns = await this.getStoredData(this.STORAGE_KEYS.QUESTION_PATTERNS, []);
      const currentKeywords = this.extractKeywords(currentQuestion);
      const currentWords = currentQuestion.toLowerCase().split(' ');

      const similarities = patterns.map(pattern => {
        // Keyword similarity
        const keywordOverlap = pattern.keywords.filter(k => currentKeywords.includes(k)).length;
        const keywordSimilarity = keywordOverlap / Math.max(pattern.keywords.length, currentKeywords.length);

        // Word similarity
        const wordOverlap = pattern.question.split(' ').filter(word => 
          currentWords.includes(word) && word.length > 2
        ).length;
        const wordSimilarity = wordOverlap / Math.max(currentWords.length, pattern.question.split(' ').length);

        // Combined similarity score
        const similarity = (keywordSimilarity * 0.6) + (wordSimilarity * 0.4);

        return {
          ...pattern,
          similarity,
          keywordSimilarity,
          wordSimilarity
        };
      });

      return similarities
        .filter(s => s.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.warn('Failed to find similar questions:', error);
      return [];
    }
  }

  /**
   * Get personalized response suggestions based on user history
   */
  async getPersonalizedSuggestions(userContext) {
    try {
      const patterns = await this.getStoredData(this.STORAGE_KEYS.QUESTION_PATTERNS, []);
      const preferences = await this.getStoredData(this.STORAGE_KEYS.USER_PREFERENCES, {});

      // Analyze user's most common question types
      const questionTypes = {};
      patterns.forEach(pattern => {
        if (questionTypes[pattern.responseType]) {
          questionTypes[pattern.responseType]++;
        } else {
          questionTypes[pattern.responseType] = 1;
        }
      });

      // Generate suggestions based on patterns and context
      const suggestions = [];

      // Most asked question types
      const topTypes = Object.entries(questionTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      topTypes.forEach(([type, count]) => {
        suggestions.push({
          type: 'frequent',
          category: type,
          text: this.generateSuggestionText(type, userContext),
          confidence: count / patterns.length,
          icon: this.getIconForType(type)
        });
      });

      // Context-based suggestions
      if (userContext.financial.totalBalance < 10000) {
        suggestions.push({
          type: 'contextual',
          category: 'savings',
          text: 'How can I build my emergency fund quickly?',
          confidence: 0.9,
          icon: 'shield-checkmark'
        });
      }

      if (userContext.financial.transactionCount > 20) {
        suggestions.push({
          type: 'contextual',
          category: 'spending',
          text: 'Analyze my spending patterns this month',
          confidence: 0.8,
          icon: 'analytics'
        });
      }

      return suggestions.slice(0, 6);
    } catch (error) {
      console.warn('Failed to get personalized suggestions:', error);
      return [];
    }
  }

  /**
   * Optimize response based on user patterns and feedback
   */
  async optimizeResponse(baseResponse, questionContext, similarQuestions) {
    try {
      const preferences = await this.getStoredData(this.STORAGE_KEYS.USER_PREFERENCES, {});
      let optimizedResponse = baseResponse;

      // Apply user preferences
      if (preferences.prefersBriefResponses) {
        optimizedResponse = this.makeBrief(optimizedResponse);
      }

      if (preferences.prefersDetailedExamples) {
        optimizedResponse = this.addDetailedExamples(optimizedResponse, questionContext);
      }

      if (preferences.prefersActionableSteps) {
        optimizedResponse = this.emphasizeActionableSteps(optimizedResponse);
      }

      // Add learning from similar questions
      if (similarQuestions.length > 0) {
        const learnings = this.extractLearningsFromSimilar(similarQuestions);
        optimizedResponse += `\n\n💡 **Additional insights based on similar questions:**\n${learnings}`;
      }

      return optimizedResponse;
    } catch (error) {
      console.warn('Failed to optimize response:', error);
      return baseResponse;
    }
  }

  // Helper methods
  extractKeywords(text) {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'will', 'be'];
    return text.toLowerCase()
      .split(' ')
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .filter((word, index, arr) => arr.indexOf(word) === index); // Remove duplicates
  }

  analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worried', 'concerned', 'problem'];
    const urgentWords = ['urgent', 'emergency', 'immediately', 'asap', 'quickly', 'now'];

    const words = text.toLowerCase().split(' ');
    const positive = words.filter(word => positiveWords.includes(word)).length;
    const negative = words.filter(word => negativeWords.includes(word)).length;
    const urgent = words.filter(word => urgentWords.includes(word)).length;

    if (urgent > 0) return 'urgent';
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
  }

  detectUrgency(text) {
    const urgentIndicators = ['urgent', 'emergency', 'immediately', 'asap', 'quickly', 'now', 'help', 'crisis'];
    const words = text.toLowerCase().split(' ');
    return urgentIndicators.some(indicator => words.includes(indicator));
  }

  async updateUserPreferences(questionData) {
    try {
      const preferences = await this.getStoredData(this.STORAGE_KEYS.USER_PREFERENCES, {});
      
      // Track response length preferences
      if (questionData.wordCount < 5) {
        preferences.prefersBriefResponses = (preferences.prefersBriefResponses || 0) + 1;
      } else if (questionData.wordCount > 15) {
        preferences.prefersDetailedExamples = (preferences.prefersDetailedExamples || 0) + 1;
      }

      // Track question types
      preferences.questionTypes = preferences.questionTypes || {};
      preferences.questionTypes[questionData.responseType] = 
        (preferences.questionTypes[questionData.responseType] || 0) + 1;

      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to update user preferences:', error);
    }
  }

  async learnFromFeedback(feedbackData) {
    // Implementation for learning from user feedback
    // This would adjust response strategies based on what users find helpful
    console.log('Learning from feedback:', feedbackData);
  }

  generateSuggestionText(type, context) {
    const suggestions = {
      savings: 'How can I improve my savings strategy?',
      spending: 'Help me analyze my spending patterns',
      investment: 'What investment options are best for me?',
      chama: 'How should I manage my chama contributions?',
      emergency: 'How much should I save for emergencies?'
    };
    return suggestions[type] || 'How can I improve my finances?';
  }

  getIconForType(type) {
    const icons = {
      savings: 'wallet',
      spending: 'analytics',
      investment: 'trending-up',
      chama: 'people',
      emergency: 'shield-checkmark'
    };
    return icons[type] || 'help-circle';
  }

  async getStoredData(key, defaultValue) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.warn(`Failed to get stored data for ${key}:`, error);
      return defaultValue;
    }
  }

  // Response optimization helpers
  makeBrief(response) {
    // Simplify response for users who prefer brief answers
    return response.split('\n').slice(0, 10).join('\n') + '\n\nWould you like more details on any specific point?';
  }

  addDetailedExamples(response, context) {
    // Add more examples for users who prefer detailed responses
    return response + '\n\n📋 **Detailed Example:**\nBased on your current balance of ' + 
           `${context.financial?.totalBalance || 0}, here\'s a step-by-step plan...`;
  }

  emphasizeActionableSteps(response) {
    // Highlight actionable steps for users who prefer clear actions
    return response.replace(/(\d+\.\s)/g, '✅ $1');
  }

  extractLearningsFromSimilar(similarQuestions) {
    // Extract common patterns from similar questions
    const commonKeywords = {};
    similarQuestions.forEach(q => {
      q.keywords.forEach(keyword => {
        commonKeywords[keyword] = (commonKeywords[keyword] || 0) + 1;
      });
    });

    const topKeywords = Object.entries(commonKeywords)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([keyword]) => keyword);

    return `Users often ask about: ${topKeywords.join(', ')}`;
  }
}

export default new AIOptimizationService();
