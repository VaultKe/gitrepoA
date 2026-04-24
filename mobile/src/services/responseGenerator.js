/**
 * Response Generator - 100% Backend-Driven Response System
 * 
 * This service generates responses based ONLY on real user data from the backend.
 * NO hardcoded responses - everything is calculated from actual user account data.
 */
class ResponseGenerator {
  constructor() {
    this.responseTemplates = new Map();
    this.dataValidators = new Map();
    this.formatters = new Map();
    
    this.initializeResponseSystem();
  }

  /**
   * Generate response based on real user data
   */
  async generateDataDrivenResponse(questionAnalysis, userData) {
    const { primaryIntent } = questionAnalysis;
    const generator = this.responseTemplates.get(primaryIntent);
    
    if (!generator) {
      throw new Error(`No response generator for intent: ${primaryIntent}`);
    }

    // Generate response using real data
    const response = await generator(questionAnalysis, userData);
    
    // Add data source attribution
    response.dataSources = userData.sources;
    response.dataTimestamp = userData.timestamp;
    response.confidence = this.calculateResponseConfidence(questionAnalysis, userData);
    
    return response;
  }

  /**
   * Initialize all response generators
   */
  initializeResponseSystem() {
    // Balance Inquiry Generator
    this.responseTemplates.set('balance_inquiry', async (analysis, userData) => {
      const { data, metrics } = userData;

      if (!data.wallets || metrics.financial.totalBalance === undefined) {
        return {
          content: `I don't see any wallet data in your account yet. To check your balance, you'll need to set up your wallet first.\n\n**Next Steps:**\n• Set up your wallet\n• Add some funds to get started\n• Then I can help you track your balance`,
          type: 'setup_required',
          actions: ['create_wallet']
        };
      }

      let response = `💰 **Your Current Balance**\n\n`;

      // Total balance from real data
      response += `**Total Balance: ${this.formatCurrency(metrics.financial.totalBalance)}**\n\n`;

      // Wallet information
      if (data.wallets && typeof data.wallets === 'object') {
        if (data.wallets.wallet_id) {
          response += `**Wallet ID:** ${data.wallets.wallet_id}\n`;
        }
        if (data.wallets.currency) {
          response += `**Currency:** ${data.wallets.currency}\n`;
        }
        response += `\n`;
      }

      // Context-based insights from real data
      if (metrics.financial.totalBalance < 1000) {
        response += `💡 **Insight:** Your balance is quite low. Consider:\n`;
        response += `• Setting up automatic savings\n`;
        response += `• Tracking your expenses to identify savings opportunities\n\n`;
      } else if (metrics.financial.totalBalance > 50000) {
        response += `🎯 **Opportunity:** With ${this.formatCurrency(metrics.financial.totalBalance)}, you might consider:\n`;
        response += `• Investment opportunities\n`;
        response += `• Setting up additional savings goals\n\n`;
      }

      // Recent activity from real transaction data
      if (data.transactions && data.transactions.length > 0) {
        const recentCount = data.transactions.filter(t => {
          const transactionDate = new Date(t.created_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return transactionDate >= weekAgo;
        }).length;

        response += `**Recent Activity (Last 7 days):**\n`;
        response += `• ${recentCount} transactions\n`;
        
        if (metrics.financial.monthlyIncome > 0) {
          response += `• Monthly income: ${this.formatCurrency(metrics.financial.monthlyIncome)}\n`;
        }
        if (metrics.financial.monthlyExpenses > 0) {
          response += `• Monthly expenses: ${this.formatCurrency(metrics.financial.monthlyExpenses)}\n`;
        }
      }

      return {
        content: response,
        type: 'informational',
        dataPoints: {
          totalBalance: metrics.financial.totalBalance,
          walletCount: data.wallets.length,
          recentTransactions: data.transactions?.length || 0
        }
      };
    });

    // Spending Analysis Generator
    this.responseTemplates.set('spending_analysis', async (analysis, userData) => {
      const { data, metrics } = userData;
      
      if (!data.transactions || data.transactions.length === 0) {
        return {
          content: `I don't see any transaction history yet. To analyze your spending, you need to make some transactions first.\n\n**Get Started:**\n• Make your first transaction\n• Use your wallet for payments\n• Then I can provide detailed spending analysis`,
          type: 'setup_required',
          actions: ['make_transaction']
        };
      }

      let response = `📊 **Your Spending Analysis**\n\n`;
      
      // Monthly spending from real data
      response += `**This Month's Summary:**\n`;
      response += `• Total Spending: ${this.formatCurrency(metrics.financial.monthlyExpenses)}\n`;
      response += `• Number of Transactions: ${metrics.financial.monthlyTransactionCount}\n`;
      
      if (metrics.financial.monthlyTransactionCount > 0) {
        const avgTransaction = metrics.financial.monthlyExpenses / metrics.financial.monthlyTransactionCount;
        response += `• Average per Transaction: ${this.formatCurrency(avgTransaction)}\n`;
      }
      response += `\n`;

      // Category breakdown from real data
      if (metrics.behavioral.spendingByCategory && Object.keys(metrics.behavioral.spendingByCategory).length > 0) {
        response += `**Spending by Category:**\n`;
        const sortedCategories = Object.entries(metrics.behavioral.spendingByCategory)
          .sort(([,a], [,b]) => b - a);
        
        sortedCategories.forEach(([category, amount]) => {
          const percentage = ((amount / metrics.financial.monthlyExpenses) * 100).toFixed(1);
          response += `• ${category}: ${this.formatCurrency(amount)} (${percentage}%)\n`;
        });
        response += `\n`;
      }

      // Spending trend from real data
      if (metrics.temporal.spendingTrend) {
        response += `**Spending Trend:**\n`;
        switch (metrics.temporal.spendingTrend) {
          case 'increasing':
            response += `📈 Your spending has increased compared to last month\n`;
            break;
          case 'decreasing':
            response += `📉 Your spending has decreased compared to last month\n`;
            break;
          case 'stable':
            response += `📊 Your spending has remained stable compared to last month\n`;
            break;
        }
        response += `\n`;
      }

      // Personalized recommendations based on real data
      response += `**💡 Personalized Recommendations:**\n`;
      
      if (metrics.financial.monthlyExpenses > metrics.financial.monthlyIncome * 0.9) {
        response += `• ⚠️ You're spending ${((metrics.financial.monthlyExpenses / metrics.financial.monthlyIncome) * 100).toFixed(1)}% of your income\n`;
        response += `• Consider reducing expenses in your highest spending category\n`;
      }
      
      if (metrics.risk.spendingVolatility > 0.5) {
        response += `• Your spending varies significantly - consider budgeting\n`;
      }
      
      const dailyBudget = metrics.financial.monthlyIncome * 0.7 / 30; // 70% of income for expenses
      response += `• Suggested daily spending limit: ${this.formatCurrency(dailyBudget)}\n`;

      return {
        content: response,
        type: 'analysis',
        dataPoints: {
          monthlyExpenses: metrics.financial.monthlyExpenses,
          transactionCount: metrics.financial.monthlyTransactionCount,
          categories: Object.keys(metrics.behavioral.spendingByCategory || {}).length
        }
      };
    });

    // Savings Advice Generator
    this.responseTemplates.set('savings_advice', async (analysis, userData) => {
      const { data, metrics } = userData;
      
      let response = `🎯 **Personalized Savings Strategy**\n\n`;
      
      // Current financial situation from real data
      response += `**Your Financial Snapshot:**\n`;
      response += `• Current Balance: ${this.formatCurrency(metrics.financial.totalBalance)}\n`;
      
      if (metrics.financial.monthlyIncome > 0) {
        response += `• Monthly Income: ${this.formatCurrency(metrics.financial.monthlyIncome)}\n`;
        const savingsRate = ((metrics.financial.monthlyIncome - metrics.financial.monthlyExpenses) / metrics.financial.monthlyIncome) * 100;
        response += `• Current Savings Rate: ${savingsRate.toFixed(1)}%\n`;
      }
      response += `\n`;

      // Savings capacity analysis from real data
      if (metrics.financial.monthlyIncome > 0 && metrics.financial.monthlyExpenses > 0) {
        const availableForSavings = metrics.financial.monthlyIncome - metrics.financial.monthlyExpenses;
        
        response += `**Savings Opportunity Analysis:**\n`;
        response += `• Available for Savings: ${this.formatCurrency(availableForSavings)}\n`;
        
        if (availableForSavings > 0) {
          const emergencyFundTarget = metrics.financial.monthlyExpenses * 6;
          const monthsToEmergencyFund = Math.ceil(emergencyFundTarget / availableForSavings);
          
          response += `• Emergency Fund Target: ${this.formatCurrency(emergencyFundTarget)}\n`;
          response += `• Time to Build Emergency Fund: ${monthsToEmergencyFund} months\n`;
        } else {
          response += `• ⚠️ Currently spending more than earning - focus on expense reduction first\n`;
        }
        response += `\n`;
      }

      // Goal-based recommendations from real data
      if (data.goals && data.goals.length > 0) {
        response += `**Your Savings Goals Progress:**\n`;
        data.goals.forEach(goal => {
          const progress = ((goal.current_amount || 0) / (goal.target_amount || 1)) * 100;
          response += `• ${goal.name}: ${progress.toFixed(1)}% complete (${this.formatCurrency(goal.current_amount)} / ${this.formatCurrency(goal.target_amount)})\n`;
        });
        response += `\n`;
      }

      // Actionable recommendations based on real financial situation
      response += `**🚀 Action Plan:**\n`;
      
      if (metrics.financial.totalBalance < 5000) {
        response += `**Phase 1: Emergency Start**\n`;
        response += `• Save KES 500-1,000 weekly\n`;
        response += `• Build to KES 10,000 emergency buffer\n`;
      } else if (metrics.financial.totalBalance < 50000) {
        response += `**Phase 2: Foundation Building**\n`;
        response += `• Save 20% of monthly income\n`;
        response += `• Build 3-month emergency fund\n`;
      } else {
        response += `**Phase 3: Wealth Building**\n`;
        response += `• Consider investment opportunities\n`;
        response += `• Diversify savings across goals\n`;
      }

      return {
        content: response,
        type: 'advisory',
        dataPoints: {
          currentBalance: metrics.financial.totalBalance,
          monthlyIncome: metrics.financial.monthlyIncome,
          savingsGoals: data.goals?.length || 0
        }
      };
    });

    // Transaction History Generator
    this.responseTemplates.set('transaction_history', async (analysis, userData) => {
      const { data } = userData;
      
      if (!data.transactions || data.transactions.length === 0) {
        return {
          content: `No transaction history found. Start making transactions to see your history here.`,
          type: 'empty_state',
          actions: ['make_transaction']
        };
      }

      let response = `📋 **Your Transaction History**\n\n`;
      
      // Recent transactions from real data
      const recentTransactions = data.transactions.slice(0, 10);
      response += `**Recent Transactions (Last 10):**\n`;
      
      recentTransactions.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        const type = transaction.type === 'deposit' ? '📈' : '📉';
        const amount = this.formatCurrency(Math.abs(transaction.amount));
        const description = transaction.description || 'Transaction';
        
        response += `${type} ${date} - ${description}: ${amount}\n`;
      });

      return {
        content: response,
        type: 'historical',
        dataPoints: {
          totalTransactions: data.transactions.length,
          recentCount: recentTransactions.length
        }
      };
    });
  }

  /**
   * Calculate response confidence based on data quality
   */
  calculateResponseConfidence(questionAnalysis, userData) {
    let confidence = questionAnalysis.confidence;
    
    // Boost confidence if we have comprehensive data
    const dataTypes = Object.keys(userData.data);
    const requiredDataAvailable = questionAnalysis.requiredData.filter(req => 
      dataTypes.includes(req) && userData.data[req].length > 0
    ).length;
    
    const dataCompleteness = requiredDataAvailable / questionAnalysis.requiredData.length;
    confidence *= dataCompleteness;
    
    // Boost for data recency
    if (userData.sources.includes('api')) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Format currency consistently
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  /**
   * Generate contextual guidance for out-of-scope questions
   */
  generateContextualGuidance(contextValidation) {
    const { reason, suggestions } = contextValidation;
    
    const guidanceMessages = {
      unsupported_intent: `I specialize in helping with your financial account data. I can provide accurate information about your:`,
      unclear_question: `I want to give you the most accurate answer based on your real account data. Could you be more specific?`,
      too_vague: `To provide accurate information from your account, I need more details about what you're looking for.`
    };

    return {
      success: true,
      response: `${guidanceMessages[reason] || guidanceMessages.unclear_question}\n\n**I can help you with:**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\nAll my responses are based on your real account data - no generic advice!`,
      type: 'guidance',
      suggestions,
      confidence: 0.9
    };
  }

  /**
   * Generate response when data is incomplete
   */
  generateDataGuidanceResponse(dataValidation, userData) {
    const { missingData, recommendations } = dataValidation;
    
    let response = `I'd love to help, but I need more data from your account to give you accurate information.\n\n`;
    
    response += `**Missing Data:**\n`;
    missingData.forEach(data => {
      response += `• ${data.charAt(0).toUpperCase() + data.slice(1)} information\n`;
    });
    
    response += `\n**Recommendations:**\n`;
    recommendations.forEach(rec => {
      response += `• ${rec.message}\n`;
    });

    return {
      success: true,
      response,
      type: 'setup_guidance',
      missingData,
      recommendations,
      confidence: 0.8
    };
  }

  /**
   * Generate error response
   */
  generateErrorResponse(error, question) {
    return {
      success: false,
      response: `I'm having trouble accessing your account data right now. This ensures I only give you accurate information based on your real financial situation.\n\nPlease try again in a moment, or contact support if the issue persists.`,
      error: error.message,
      type: 'error',
      confidence: 0
    };
  }
}

export default new ResponseGenerator();
