/**
 * WhatsApp Group Notification Service
 *
 * Integrates with the WhatsApp Group Notifier to send transaction notifications
 * to chama WhatsApp groups automatically.
 */

class WhatsAppNotificationService {
  constructor() {
    this.baseUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002';
    this.enabled = true; // Can be controlled from admin settings
  }

  /**
   * Send transaction notification to WhatsApp group
   */
  async notifyTransaction(transaction, chamaId, userInfo = {}) {
    if (!this.enabled) {
      console.log('📱 WhatsApp notifications disabled');
      return { success: false, reason: 'disabled' };
    }

    try {
      console.log('📱 Sending WhatsApp notification for transaction:', transaction.id);

      const formattedTransaction = this.formatTransaction(transaction, userInfo);

      const response = await fetch(`${this.baseUrl}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction: formattedTransaction,
          chama_id: chamaId
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ WhatsApp notification sent successfully');
        return { success: true, data: result.data };
      } else {
        console.error('❌ WhatsApp notification failed:', result.error);
        return { success: false, error: result.error };
      }

    } catch (error) {
      console.error('❌ WhatsApp notification service error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format transaction data for WhatsApp notification
   */
  formatTransaction(transaction, userInfo = {}) {
    return {
      id: transaction.id,
      type: this.mapTransactionType(transaction.type),
      amount: parseFloat(transaction.amount) || 0,
      member_name: this.getMemberName(transaction, userInfo),
      status: transaction.status || 'completed',
      createdAt: transaction.createdAt || transaction.created_at || new Date().toISOString(),
      description: transaction.description || this.getDefaultDescription(transaction.type),
      metadata: {
        isAnonymous: transaction.metadata?.isAnonymous || false,
        displayName: transaction.metadata?.displayName
      },
      user: transaction.user ? {
        firstName: transaction.user.firstName,
        lastName: transaction.user.lastName,
        email: transaction.user.email
      } : null
    };
  }

  /**
   * Get member name handling anonymous contributions
   */
  getMemberName(transaction, userInfo) {
    // Check for anonymous contributions
    if (transaction.metadata?.isAnonymous || transaction.metadata?.displayName === 'Anonymous') {
      return null; // Will show as "Anonymous" in WhatsApp
    }

    // For personal transactions (wallet)
    if (userInfo.isPersonalTransaction && userInfo.name) {
      return userInfo.name;
    }

    // Try different name sources
    if (transaction.member_name) {
      return transaction.member_name;
    }

    if (transaction.user?.firstName && transaction.user?.lastName) {
      return `${transaction.user.firstName} ${transaction.user.lastName}`;
    }

    if (userInfo.name) {
      return userInfo.name;
    }

    return 'Unknown Member';
  }

  /**
   * Map transaction types to WhatsApp-friendly types
   */
  mapTransactionType(type) {
    const typeMapping = {
      'deposit': 'contribution',
      'contribution': 'contribution',
      'loan_disbursement': 'loan',
      'loan': 'loan',
      'welfare_support': 'welfare',
      'welfare': 'welfare',
      'expense': 'expense',
      'payment': 'expense',
      'dividend_payout': 'dividend',
      'dividend': 'dividend',
      'account_transfer': 'transfer',
      'transfer': 'transfer'
    };

    return typeMapping[type] || type;
  }

  /**
   * Get default description for transaction types
   */
  getDefaultDescription(type) {
    const descriptions = {
      'contribution': 'Chama Contribution',
      'loan': 'Loan Disbursement',
      'welfare': 'Welfare Support',
      'expense': 'Chama Expense',
      'dividend': 'Dividend Distribution',
      'transfer': 'Account Transfer'
    };

    return descriptions[this.mapTransactionType(type)] || 'Transaction';
  }

  /**
   * Check if WhatsApp service is available
   */
  async checkServiceStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      return {
        available: true,
        connected: data.whatsapp_connected,
        groups_count: data.groups_count || 0
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Get available WhatsApp groups
   */
  async getAvailableGroups() {
    try {
      const response = await fetch(`${this.baseUrl}/groups`);
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Failed to get WhatsApp groups:', error);
      return [];
    }
  }

  /**
   * Register a WhatsApp group for a chama
   */
  async registerGroup(chamaId, groupName) {
    try {
      const response = await fetch(`${this.baseUrl}/register-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chama_id: chamaId, group_name: groupName })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(groupName, testMessage = null) {
    try {
      const message = testMessage || `🧪 Test notification from VaultKe Chama App\n\nTime: ${new Date().toLocaleString('en-KE')}\n\nThis is a test to verify WhatsApp notifications are working correctly.`;

      const response = await fetch(`${this.baseUrl}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: groupName, message })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`📱 WhatsApp notifications ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update service URL
   */
  setServiceUrl(url) {
    this.baseUrl = url;
    console.log(`📱 WhatsApp service URL updated to: ${url}`);
  }
}

// Export singleton instance
const whatsappNotificationService = new WhatsAppNotificationService();
export default whatsappNotificationService;
