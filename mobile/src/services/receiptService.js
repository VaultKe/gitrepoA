import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';

class ReceiptService {
  constructor() {
    this.companyInfo = {
      name: 'VaultKe',
      address: 'Nairobi, Kenya',
      phone: '+254 700 000 000',
      email: 'support@vaultke.co.ke',
      website: 'www.vaultke.co.ke',
      logo: 'https://vaultke.co.ke/logo.png' // Replace with actual logo URL
    };
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi'
      });
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'N/A';
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2,
      }).format(Math.abs(amount || 0));
    } catch (error) {
      console.warn('Currency formatting error:', error);
      return `KES ${parseFloat(amount || 0).toFixed(2)}`;
    }
  }

  /**
   * Get member name from transaction using chama members list - SAME LOGIC AS ChamaMembersScreen
   * For personal transactions (user dashboard), returns the logged-in user's name
   */
  getMemberNameFromTransaction(transaction, chamaMembers = [], userInfo = {}) {
    // CHECK FOR ANONYMOUS CONTRIBUTIONS FIRST
    if (transaction.metadata) {
      let metadata;
      try {
        // Handle both string and object metadata
        metadata = typeof transaction.metadata === 'string'
          ? JSON.parse(transaction.metadata)
          : transaction.metadata;

        console.log('🔍 Transaction metadata:', metadata);

        // Check if this is an anonymous contribution
        if (metadata.isAnonymous || metadata.displayName === 'Anonymous') {
          console.log('🔒 Anonymous contribution detected - returning "Anonymous"');
          return 'Anonymous';
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse transaction metadata:', error);
      }
    }

    // FOR PERSONAL TRANSACTIONS (User Dashboard): Always return the logged-in user's name
    console.log('🔍 Checking personal transaction:', {
      isPersonalTransaction: userInfo.isPersonalTransaction,
      userName: userInfo.name,
      userInfo
    });

    if (userInfo.isPersonalTransaction && userInfo.name) {
      console.log('👤 Personal transaction - using logged-in user name:', userInfo.name);
      return userInfo.name;
    }

    if (userInfo.isPersonalTransaction && !userInfo.name) {
      console.log('⚠️ Personal transaction but no name provided in userInfo');
    }

    // FOR CHAMA TRANSACTIONS: Use chama members list to resolve names
    // Handle different transaction types with different user ID fields
    let transactionUserId = null;

    // For welfare transactions: use requesterId (person who created the welfare request)
    if (transaction.type === 'welfare' && transaction.requesterId) {
      transactionUserId = transaction.requesterId;
    }
    // For merry-go-round transactions: try different possible fields
    else if (transaction.type === 'merry-go-round') {
      transactionUserId = transaction.createdBy ||      // Person who created the merry-go-round
                         transaction.created_by ||      // Alternative field name
                         transaction.contributorId ||   // If there's a specific contributor
                         transaction.user_id ||         // Standard field
                         transaction.initiated_by;      // Standard field
    }
    // For regular transactions: use standard fields
    else {
      transactionUserId = transaction.user_id || transaction.initiated_by ||
                         transaction.contributed_by || transaction.member_id;
    }

    console.log('🔍 Looking for user ID:', transactionUserId, 'in', chamaMembers.length, 'members');
    console.log('🔍 Sample chama member structure:', chamaMembers[0]);

    if (transactionUserId && chamaMembers.length > 0) {
      const member = chamaMembers.find(m =>
        m.user_id === transactionUserId ||
        m.id === transactionUserId ||
        m.user?.id === transactionUserId
      );

      console.log('🔍 Found member:', member ? 'YES' : 'NO');
      if (member) {
        console.log('🔍 Member data structure:', member);
      }

      if (member) {
        // Try multiple field combinations to get the member's name
        const user = member.user || {};

        // Try different field name variations
        const firstName = user.first_name || user.firstName ||
                         member.firstName || member.first_name ||
                         member.name?.split(' ')[0] || '';

        const lastName = user.last_name || user.lastName ||
                        member.lastName || member.last_name ||
                        member.name?.split(' ').slice(1).join(' ') || '';

        // Try different full name variations
        let fullName = member.fullName || member.full_name ||
                      user.fullName || user.full_name ||
                      member.name || user.name ||
                      `${firstName} ${lastName}`.trim();

        console.log('🔍 Member name extraction:', {
          firstName,
          lastName,
          fullName,
          memberName: member.name,
          userName: user.name,
          email: user.email || member.email
        });

        // Only return the name if it's not empty and not just whitespace
        if (fullName && fullName.trim() && fullName.trim() !== 'undefined undefined') {
          console.log('✅ Using member name:', fullName.trim());
          return fullName.trim();
        }

        // If no name found, fallback to email or ID
        console.log('⚠️ No name found, falling back to email');
        return user.email || member.email || `Member ${(member.user_id || member.id || '').slice(-4)}`;
      }
    }

    // For welfare transactions: try to use requester object directly
    if (transaction.type === 'welfare' && transaction.requester) {
      const firstName = transaction.requester.firstName || transaction.requester.first_name || '';
      const lastName = transaction.requester.lastName || transaction.requester.last_name || '';
      const fullName = transaction.requester.fullName || `${firstName} ${lastName}`.trim();

      if (fullName) {
        console.log('🔍 Using welfare requester name:', fullName);
        return fullName;
      }

      if (transaction.requester.email) {
        return transaction.requester.email;
      }
    }

    // For merry-go-round transactions: try to use creator object directly
    if (transaction.type === 'merry-go-round' && transaction.creator) {
      const firstName = transaction.creator.firstName || transaction.creator.first_name || '';
      const lastName = transaction.creator.lastName || transaction.creator.last_name || '';
      const fullName = transaction.creator.fullName || `${firstName} ${lastName}`.trim();

      if (fullName) {
        console.log('🔍 Using merry-go-round creator name:', fullName);
        return fullName;
      }

      if (transaction.creator.email) {
        return transaction.creator.email;
      }
    }

    // Fallback to transaction's own user data if member not found in chama members
    console.log('⚠️ Member not found in chama members list, trying transaction user data');
    console.log('🔍 Transaction user data:', transaction.user);

    if (transaction.user?.firstName || transaction.user?.lastName ||
        transaction.user?.first_name || transaction.user?.last_name) {

      const firstName = transaction.user.firstName || transaction.user.first_name || '';
      const lastName = transaction.user.lastName || transaction.user.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();

      console.log('🔍 Extracting name from transaction user:', { firstName, lastName, fullName });

      if (fullName && fullName !== 'undefined undefined' && fullName !== ' ') {
        console.log('✅ Using transaction user name:', fullName);
        return fullName;
      }
    }

    if (transaction.user?.name && transaction.user.name.trim()) {
      console.log('✅ Using transaction user name field:', transaction.user.name);
      return transaction.user.name.trim();
    }

    // Try other possible name fields in the transaction
    if (transaction.contributor_name && transaction.contributor_name.trim()) {
      console.log('✅ Using contributor_name:', transaction.contributor_name);
      return transaction.contributor_name.trim();
    }

    if (transaction.member_name && transaction.member_name.trim()) {
      console.log('✅ Using member_name:', transaction.member_name);
      return transaction.member_name.trim();
    }

    // Last resort: use email
    if (transaction.user?.email) {
      console.log('⚠️ No name found, using email as last resort:', transaction.user.email);
      return transaction.user.email;
    }

    if (transaction.member_name) {
      return transaction.member_name;
    }

    if (transaction.user_name) {
      return transaction.user_name;
    }

    // Final fallback
    return `Member ${(transactionUserId || transaction.id || '').slice(-4)}`;
  }

/**
    * Generate PDF-optimized HTML with inline styles for better PDF rendering
    */
  generatePDFOptimizedReceiptHTML(transaction, userInfo = {}, chamaMembers = [], options = {}) {
    if (!transaction || !transaction.id) {
      throw new Error('Invalid transaction data provided');
    }

    // Extract chama name from options (passed from ChamaTransactionsScreen)
    // Use 'Transactions' for personal wallet transactions
    const chamaName = options.chamaName || userInfo.chamaName ||
                     (userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama');

    // Debug: Log transaction structure to see what data is available
    console.log('🔍 Transaction data for receipt:', {
      id: transaction.id,
      type: transaction.type,
      user: transaction.user,
      member_name: transaction.member_name,
      user_name: transaction.user_name,
      user_id: transaction.user_id,
      initiated_by: transaction.initiated_by,
      contributed_by: transaction.contributed_by,
      member_id: transaction.member_id,
      // Welfare-specific fields
      requesterId: transaction.requesterId,
      beneficiaryId: transaction.beneficiaryId,
      requester: transaction.requester,
      beneficiary: transaction.beneficiary,
      // Merry-go-round specific fields
      createdBy: transaction.createdBy,
      created_by: transaction.created_by,
      creator: transaction.creator,
      contributorId: transaction.contributorId,
      amount: transaction.amount,
      description: transaction.description,
      chamaMembersCount: chamaMembers.length,
      allTransactionFields: Object.keys(transaction)
    });

    const receiptId = `RCP-${Date.now().toString().substring(-8)}`;

    // Get person who performed the transaction using chama members list
    const performedBy = this.getMemberNameFromTransaction(transaction, chamaMembers, userInfo);

    console.log('👤 Resolved member name:', performedBy);



    // Helper functions for PDF generation
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Nairobi'
        });
      } catch (error) {
        console.warn('Date formatting error:', error);
        return 'N/A';
      }
    };

    const formatCurrency = (amount) => {
      try {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: 'KES',
          minimumFractionDigits: 2
        }).format(Math.abs(numAmount));
      } catch (error) {
        console.warn('Currency formatting error:', error);
        return 'KES 0.00';
      }
    };

    const transactionDate = formatDate(transaction.date || transaction.createdAt || transaction.created_at);

    // Handle different amount formats
    const transactionAmount = parseFloat(transaction.amount || transaction.transaction_amount || 0);
    const transactionFees = parseFloat(transaction.fees || transaction.transaction_fees || 0);

    const amount = formatCurrency(transactionAmount);
    const fees = formatCurrency(transactionFees);
    const totalAmount = formatCurrency(transactionAmount + transactionFees);
    const description = transaction.description || transaction.transaction_description || transaction.memo || 'Transaction';

    // Helper function for transaction type labels
    const getTransactionTypeLabel = (type) => {
      switch (type) {
        case 'deposit': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'transfer': return 'Transfer';
        case 'payment': return 'Payment';
        default: return 'Transaction';
      }
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Transaction Receipt - ${receiptId}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif !important; font-size: 10px !important; line-height: 1.2 !important; color: #000 !important; background: white !important; }
          .container { width: 100% !important; max-width: 180mm !important; margin: 0 auto !important; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${this.companyInfo.name}</div>
                <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">${chamaName}</div>
                <div style="font-size: 8px; color: #000; line-height: 1.1;">
                  ${this.companyInfo.address}<br>
                  Tel: ${this.companyInfo.phone} | Email: ${this.companyInfo.email}
                </div>
              </div>
              <div style="text-align: right; font-size: 8px; color: #000; line-height: 1.1;">
                Report No: ${receiptId}<br>
                Generated: ${new Date().toLocaleString('en-KE', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Africa/Nairobi'
                })}
              </div>
            </div>
            <div style="text-align: center; font-size: 14px; font-weight: bold; color: #000; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px;">TRANSACTION RECEIPT</div>
            <div style="border-bottom: 2px solid #000; margin: 10px 0 15px 0;"></div>
          </div>

          <!-- Report Summary -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px;">
            <thead>
              <tr>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 9px;">REPORT PERIOD</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 9px;">TOTAL TRANSACTIONS</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 9px;">TOTAL AMOUNT (KES)</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 9px;">TOTAL FEES (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; font-size: 10px;">Single Transaction</td>
                <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; font-size: 10px;">1</td>
                <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; font-size: 10px;">${amount}</td>
                <td style="border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: bold; font-size: 10px;">${fees}</td>
              </tr>
            </tbody>
          </table>

          <!-- Transaction Details Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9px;">
            <thead>
              <tr>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">DATE</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 15%;">NAME</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 20%;">DESCRIPTION</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">TYPE</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 12%;">AMOUNT</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 8%;">FEES</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">STATUS</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 15%;">REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${transactionDate}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #2563eb;">${performedBy}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 9px;">${description}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${getTransactionTypeLabel(transaction.type)}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 9px;">${amount}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 9px;">${fees}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; text-transform: uppercase; border: 1px solid #000; background: #90EE90; color: #000;">
                    ${(transaction.status || 'completed').toUpperCase()}
                  </span>
                </td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${transaction.reference || '-'}</td>
              </tr>
            </tbody>
          </table>

          <!-- Summary Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 8px;">
            <thead>
              <tr>
                <th colspan="2" style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">SUMMARY</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">AMOUNT (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="2" style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;">Total Transaction Amount</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;">${amount}</td>
              </tr>
              <tr>
                <td colspan="2" style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;">Total Transaction Fees</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;">${fees}</td>
              </tr>
              <tr style="background: #f0f0f0; font-weight: bold;">
                <td colspan="2" style="border: 1px solid #000; border-top: 2px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;"><strong>GRAND TOTAL</strong></td>
                <td style="border: 1px solid #000; border-top: 2px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;"><strong>${totalAmount}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Footer -->
          <div style="border-top: 2px solid #000; padding-top: 10px; margin-top: 15px; text-align: center;">
            <div style="font-size: 9px; font-weight: bold; color: #000; margin-bottom: 5px;">Thank you for using ${this.companyInfo.name}</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">This is a computer-generated report and does not require a signature.</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">For inquiries, contact us at ${this.companyInfo.phone} or ${this.companyInfo.email}</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">Visit us at ${this.companyInfo.website}</div>
            <div style="font-size: 9px; color: #666; margin-top: 8px;">
              Report generated on ${new Date().toLocaleString('en-KE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Nairobi'
              })} | Total Records: 1
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate receipt HTML template
   */
  generateReceiptHTML(transaction, userInfo = {}) {
    // Validate transaction data
    if (!transaction || !transaction.id) {
      throw new Error('Invalid transaction data provided');
    }

    console.log('🧾 Generating receipt HTML for transaction:', transaction);

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2,
      }).format(Math.abs(amount));
    };

    const getTransactionTypeLabel = (type) => {
      switch (type) {
        case 'deposit': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'transfer': return 'Transfer';
        default: return 'Transaction';
      }
    };

    // Handle different transaction ID formats
    const transactionId = transaction.id || transaction.transaction_id || 'unknown';
    const receiptId = `RCP-${transactionId.toString().substring(0, 8).toUpperCase()}`;

    // Handle different date formats
    const dateField = transaction.date || transaction.createdAt || transaction.created_at || transaction.timestamp;
    const transactionDate = formatDate(dateField);

    // Handle different amount formats
    const transactionAmount = parseFloat(transaction.amount || transaction.transaction_amount || 0);
    const transactionFees = parseFloat(transaction.fees || transaction.transaction_fees || 0);

    const amount = formatCurrency(transactionAmount);
    const fees = formatCurrency(transactionFees);
    const totalAmount = formatCurrency(transactionAmount + transactionFees);

    // Handle description
    const description = transaction.description || transaction.transaction_description || transaction.memo || 'Transaction';

    console.log('🧾 Receipt data:', {
      receiptId,
      transactionId,
      transactionDate,
      amount,
      fees,
      totalAmount,
      description,
      type: transaction.type,
      status: transaction.status
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Transaction Receipt - ${receiptId}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            line-height: 1.2;
            color: #000;
            background: white;
            padding: 0;
            margin: 0;
          }

          .receipt-container {
            width: 210mm;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 20mm;
          }
          
          /* Header Styles */
          .receipt-header {
            margin-bottom: 20px;
          }

          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
          }

          .company-info {
            flex: 1;
          }

          .company-name {
            font-size: 14px;
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }

          .company-details {
            font-size: 8px;
            color: #000;
            line-height: 1.1;
          }

          .receipt-id {
            text-align: right;
            font-size: 8px;
            color: #000;
            line-height: 1.1;
          }

          .receipt-title {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            color: #000;
            margin: 15px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .title-underline {
            border-bottom: 2px solid #000;
            margin: 10px 0 15px 0;
          }
          
          /* Report Summary Table */
          .report-summary {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 8px;
          }

          .report-summary th {
            background: #e8e8e8;
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 7px;
          }

          .report-summary td {
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
            font-weight: bold;
            font-size: 8px;
          }

          /* Main Transactions Table */
          .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 7px;
          }

          .transactions-table th {
            background: #e8e8e8;
            border: 1px solid #000;
            padding: 4px 2px;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 6px;
          }

          .transactions-table td {
            border: 1px solid #000;
            padding: 4px 2px;
            text-align: center;
            font-size: 7px;
          }

          .transactions-table .amount-col {
            text-align: right;
            font-weight: bold;
          }

          .transactions-table .desc-col {
            text-align: left;
          }

          /* Summary Table */
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 8px;
          }

          .summary-table th {
            background: #e8e8e8;
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 7px;
          }

          .summary-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: left;
            font-size: 8px;
          }

          .summary-table .amount-col {
            text-align: right;
            font-weight: bold;
          }

          .summary-table .grand-total {
            background: #f0f0f0;
            font-weight: bold;
          }

          .summary-table .grand-total td {
            border-top: 2px solid #000;
          }

          /* Status Badge */
          .status-badge {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 6px;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid;
          }

          .status-completed {
            background: #90EE90;
            color: #000;
            border-color: #000;
          }

          .status-pending {
            background: #FFD700;
            color: #000;
            border-color: #000;
          }

          .status-failed {
            background: #FF6B6B;
            color: #000;
            border-color: #000;
          }
          
          /* Amount Summary */
          .amount-summary {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 11px;
          }

          .amount-summary th,
          .amount-summary td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: right;
          }

          .amount-summary th {
            background: #f0f0f0;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
          }

          .amount-summary .label-col {
            text-align: left;
            font-weight: bold;
          }

          .amount-summary .total-row {
            background: #e8f4f8;
            font-weight: bold;
            font-size: 12px;
          }

          .amount-summary .total-row td {
            border-top: 2px solid #000;
          }

          /* Separator Line */
          .separator {
            border: none;
            border-top: 1px solid #ccc;
            margin: 15px 0;
          }

          .thick-separator {
            border-top: 2px solid #000;
          }
          
          /* Footer */
          .receipt-footer {
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 15px;
            text-align: center;
          }

          .thank-you {
            font-size: 9px;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
          }

          .footer-text {
            font-size: 8px;
            color: #000;
            line-height: 1.2;
            margin-bottom: 3px;
          }

          .timestamp {
            font-size: 7px;
            color: #666;
            margin-top: 8px;
          }

          /* Print Styles */
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
              font-size: 11px;
            }

            .receipt-container {
              width: 100%;
              max-width: none;
              padding: 10mm;
              box-shadow: none;
              border-radius: 0;
            }

            .no-print {
              display: none !important;
            }

            .page-break {
              page-break-before: always;
            }
          }

          /* Responsive */
          @media screen and (max-width: 600px) {
            .receipt-container {
              width: 100%;
              padding: 10px;
            }

            .header-row {
              flex-direction: column;
              text-align: center;
            }

            .receipt-id {
              text-align: center;
              margin-top: 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- Header -->
          <div class="receipt-header">
            <div class="header-row">
              <div class="company-info">
                <div class="company-name">${this.companyInfo.name}</div>
                <div class="company-details">
                  ${this.companyInfo.address}<br>
                  Tel: ${this.companyInfo.phone} | Email: ${this.companyInfo.email}
                </div>
              </div>
              <div class="receipt-id">
                Report No: ${receiptId}<br>
                Generated: ${new Date().toLocaleString('en-KE', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                  timeZone: 'Africa/Nairobi'
                })}
              </div>
            </div>
            <div class="receipt-title">TRANSACTION HISTORY REPORT</div>
            <div class="title-underline"></div>
          </div>

          <!-- Report Summary -->
          <table class="report-summary">
            <thead>
              <tr>
                <th>REPORT PERIOD</th>
                <th>TOTAL TRANSACTIONS</th>
                <th>TOTAL AMOUNT (KES)</th>
                <th>TOTAL FEES (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Single Transaction</td>
                <td>1</td>
                <td>${amount}</td>
                <td>${fees}</td>
              </tr>
            </tbody>
          </table>

          <!-- Transaction Details Table -->
          <table class="transactions-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>TRANSACTION ID</th>
                <th>DESCRIPTION</th>
                <th>TYPE</th>
                <th>AMOUNT</th>
                <th>FEES</th>
                <th>STATUS</th>
                <th>REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${transactionDate}</td>
                <td>${transactionId.substring(0, 12)}...</td>
                <td class="desc-col">${description}</td>
                <td>${getTransactionTypeLabel(transaction.type)}</td>
                <td class="amount-col">${amount}</td>
                <td class="amount-col">${fees}</td>
                <td>
                  <span class="status-badge status-${transaction.status || 'completed'}">
                    ${(transaction.status || 'completed').toUpperCase()}
                  </span>
                </td>
                <td>${transaction.reference || '-'}</td>
              </tr>
            </tbody>
          </table>

          <!-- Summary Table -->
          <table class="summary-table">
            <thead>
              <tr>
                <th colspan="2">SUMMARY</th>
                <th>AMOUNT (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="2">Total Transaction Amount</td>
                <td class="amount-col">${amount}</td>
              </tr>
              <tr>
                <td colspan="2">Total Transaction Fees</td>
                <td class="amount-col">${fees}</td>
              </tr>
              <tr class="grand-total">
                <td colspan="2"><strong>GRAND TOTAL</strong></td>
                <td class="amount-col"><strong>${totalAmount}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Footer -->
          <div class="receipt-footer">
            <div class="thank-you">Thank you for using ${this.companyInfo.name}</div>
            <div class="footer-text">
              This is a computer-generated report and does not require a signature.
            </div>
            <div class="footer-text">
              For inquiries, contact us at ${this.companyInfo.phone} or ${this.companyInfo.email}
            </div>
            <div class="footer-text">
              Visit us at ${this.companyInfo.website}
            </div>
            <div class="timestamp">
              Report generated on ${new Date().toLocaleString('en-KE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Nairobi'
              })} | Total Records: 1
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate receipt in JSON format
   */
  generateReceiptJSON(transaction, userInfo = {}) {
    // Validate transaction data
    const transactionId = transaction.id || transaction.transaction_id;
    if (!transaction || !transactionId) {
      throw new Error('Invalid transaction data provided');
    }

    const receiptId = `RCP-${transactionId.toString().substring(0, 8).toUpperCase()}`;

    // Handle different data formats
    const transactionAmount = parseFloat(transaction.amount || transaction.transaction_amount || 0);
    const transactionFees = parseFloat(transaction.fees || transaction.transaction_fees || 0);
    const dateField = transaction.date || transaction.createdAt || transaction.created_at || transaction.timestamp;
    const description = transaction.description || transaction.transaction_description || transaction.memo || 'Transaction';

    return {
      receiptId,
      companyInfo: this.companyInfo,
      transaction: {
        id: transactionId,
        type: transaction.type || 'unknown',
        status: transaction.status || 'completed',
        amount: transactionAmount,
        fees: transactionFees,
        totalAmount: transactionAmount + transactionFees,
        currency: 'KES',
        description: description,
        reference: transaction.reference || transaction.ref || null,
        paymentMethod: transaction.paymentMethod || transaction.payment_method || null,
        date: dateField,
        metadata: transaction.metadata || {}
      },
      userInfo,
      generatedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Generate and download PDF receipt
   */
  async generatePDFReceipt(transaction, userInfo = {}, chamaMembers = [], options = {}) {
    try {
      // Validate transaction data
      if (!transaction || !transaction.id) {
        throw new Error('Invalid transaction data provided');
      }

      const html = this.generatePDFOptimizedReceiptHTML(transaction, userInfo, chamaMembers, options);
      const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
      const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.pdf`;

      // For web platform, create a print-friendly version
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Transaction Receipt - ${receiptId}</title>
            <style>
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${html.replace(/<html>.*?<body>/s, '').replace(/<\/body>.*?<\/html>/s, '')}
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #007bff; color: white; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="window.print()">
              Click here to save as PDF
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => window.print(), 500);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
        return { success: true, uri: null, fileName, receiptId };
      }

      // Check if Print is available for native platforms
      if (!Print || !Print.printToFileAsync) {
        throw new Error('PDF generation not available on this platform');
      }

      // Generate PDF for native platforms
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
        width: 612,
        height: 792,
      });

// For native platforms, move to documents directory
       if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
         const newUri = `${FileSystem.documentDirectory}${fileName}`;
         await FileSystem.moveAsync({
           from: uri,
           to: newUri,
         });

         return {
           success: true,
           uri: newUri,
           fileName,
           receiptId
         };
       }

       return {
        success: true,
        uri,
        fileName,
        receiptId
      };
    } catch (error) {
      console.error('Error generating PDF receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate web download for browsers
   */
  generateWebDownload(content, fileName, mimeType, title) {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);

      return {
        success: true,
        uri: url,
        fileName,
        message: `${fileName} has been downloaded to your Downloads folder.`,
        receiptId: fileName.split('_')[2]
      };
    } catch (error) {
      console.error('Error generating web download:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate and save HTML receipt
   */
  async generateHTMLReceipt(transaction, userInfo = {}) {
    try {
      if (!transaction || !transaction.id) {
        throw new Error('Invalid transaction data provided');
      }

      const html = this.generatePDFOptimizedReceiptHTML(transaction, userInfo);
      const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
      const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;

      // For web platform, trigger download
      if (Platform.OS === 'web') {
        return this.generateWebDownload(html, fileName, 'text/html');
      }

      // For native platforms, save to file system
      if (FileSystem.documentDirectory && FileSystem.writeAsStringAsync) {
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, html);

        return {
          success: true,
          uri,
          fileName,
          receiptId
        };
      }

      throw new Error('File system not available on this platform');
    } catch (error) {
      console.error('Error generating HTML receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate and save JSON receipt
   */
  async generateJSONReceipt(transaction, userInfo = {}) {
    try {
      if (!transaction || !transaction.id) {
        throw new Error('Invalid transaction data provided');
      }

      const jsonData = this.generateReceiptJSON(transaction, userInfo);
      const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
      const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(jsonData, null, 2);

      // For web platform, trigger download
      if (Platform.OS === 'web') {
        return this.generateWebDownload(jsonString, fileName, 'application/json');
      }

      // For native platforms, save to file system
      if (FileSystem.documentDirectory && FileSystem.writeAsStringAsync) {
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, jsonString);

        return {
          success: true,
          uri,
          fileName,
          receiptId
        };
      }

      throw new Error('File system not available on this platform');
    } catch (error) {
      console.error('Error generating JSON receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate and save CSV receipt for individual transaction
   */
  async generateCSVReceipt(transaction, userInfo = {}, chamaMembers = []) {
    try {
      if (!transaction || !transaction.id) {
        throw new Error('Invalid transaction data provided');
      }

      const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
      const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.csv`;

      // Get person who performed the transaction using chama members list
      const performedBy = this.getMemberNameFromTransaction(transaction, chamaMembers, userInfo);

      // Generate CSV content for individual transaction
      let csvContent = `TRANSACTION RECEIPT\n`;
      csvContent += `Receipt ID,${receiptId}\n`;
      csvContent += `Generated,${this.formatDate(new Date().toISOString())}\n`;
      csvContent += `Company,${this.companyInfo.name}\n`;
      csvContent += `Member,"${performedBy}"\n\n`;

      csvContent += `TRANSACTION DETAILS\n`;
      csvContent += `Field,Value\n`;
      csvContent += `Date,${this.formatDate(transaction.created_at || transaction.date)}\n`;
      csvContent += `Performed by,"${performedBy}"\n`;
      csvContent += `Type,${transaction.type || transaction.transaction_type || 'N/A'}\n`;
      csvContent += `Description,"${(transaction.description || transaction.title || 'N/A').replace(/"/g, '""')}"\n`;
      csvContent += `Amount,${this.formatCurrency(parseFloat(transaction.amount || 0))}\n`;
      csvContent += `Fees,${this.formatCurrency(parseFloat(transaction.fees || 0))}\n`;
      csvContent += `Status,${transaction.status || 'Completed'}\n`;
      csvContent += `Reference,${transaction.reference || transaction.id || 'N/A'}\n`;

      // For web platform, trigger download
      if (Platform.OS === 'web') {
        return this.generateWebDownload(csvContent, fileName, 'text/csv');
      }

      // For native platforms, save to file system
      if (FileSystem.documentDirectory && FileSystem.writeAsStringAsync) {
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Share Transaction Receipt',
          });
        }

        return {
          success: true,
          uri,
          fileName,
          receiptId
        };
      }

      throw new Error('File system not available');
    } catch (error) {
      console.error('Error generating CSV receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Share receipt file
   */
  async shareReceipt(uri, fileName) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return { success: false, error: 'Sharing not available' };
      }

      await Sharing.shareAsync(uri, {
        mimeType: this.getMimeType(fileName),
        dialogTitle: `Share ${fileName}`,
        UTI: this.getUTI(fileName)
      });

      return { success: true };
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Failed to share receipt');
      return { success: false, error: error.message };
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(transaction, userInfo = {}) {
    try {
      if (!transaction || !transaction.id) {
        throw new Error('Invalid transaction data provided');
      }

      const html = this.generatePDFOptimizedReceiptHTML(transaction, userInfo);

      // For web platform, use browser print
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
        return { success: true };
      }

      // For native platforms, use expo-print
      if (!Print || !Print.isAvailableAsync || !Print.printAsync) {
        Alert.alert('Error', 'Printing is not available on this platform');
        return { success: false, error: 'Printing not available' };
      }

      const canPrint = await Print.isAvailableAsync();
      if (!canPrint) {
        Alert.alert('Error', 'Printing is not available on this device');
        return { success: false, error: 'Printing not available' };
      }

      await Print.printAsync({
        html,
        printerUrl: undefined, // Let user select printer
      });

      return { success: true };
    } catch (error) {
      console.error('Error printing receipt:', error);
      Alert.alert('Error', 'Failed to print receipt');
      return { success: false, error: error.message };
    }
  }

  /**
   * Get MIME type based on file extension
   */
  getMimeType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'pdf': return 'application/pdf';
      case 'html': return 'text/html';
      case 'json': return 'application/json';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Get UTI (Uniform Type Identifier) for iOS
   */
  getUTI(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'pdf': return 'com.adobe.pdf';
      case 'html': return 'public.html';
      case 'json': return 'public.json';
      default: return 'public.data';
    }
  }

  /**
   * Download receipt in specified format
   */
  async downloadReceipt(transaction, format = 'pdf', userInfo = {}) {
    try {
      let result;

      switch (format.toLowerCase()) {
        case 'pdf':
          result = await this.generatePDFReceipt(transaction, userInfo);
          break;
        case 'html':
          result = await this.generateHTMLReceipt(transaction, userInfo);
          break;
        case 'json':
          result = await this.generateJSONReceipt(transaction, userInfo);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (result.success) {
        Alert.alert(
          'Success',
          `Receipt downloaded successfully as ${result.fileName}`,
          [
            { text: 'OK' },
            {
              text: 'Share',
              onPress: () => this.shareReceipt(result.uri, result.fileName)
            }
          ]
        );
      } else {
        Alert.alert('Error', `Failed to download receipt: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Error downloading receipt:', error);
      Alert.alert('Error', 'Failed to download receipt');
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate PDF-optimized bulk transaction history report with inline styles
   */
  generatePDFOptimizedBulkReceiptHTML(transactions, userInfo = {}, chamaMembers = []) {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions provided for bulk receipt');
    }

    console.log('🔍 Bulk receipt generation - userInfo:', userInfo);
    console.log('🔍 Bulk receipt generation - chamaMembers count:', chamaMembers.length);

    const reportId = `RPT-${Date.now().toString().substring(-8)}`;
    const reportDate = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi'
    });

    // Extract chama information - use 'Transactions' for personal wallet transactions
    const chamaName = userInfo?.chamaName ||
                     (userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama');
    const reportTitle = userInfo?.reportTitle || 'Transaction History Report';

    // Calculate totals
    let totalAmount = 0;
    let totalFees = 0;

    transactions.forEach(tx => {
      totalAmount += parseFloat(tx.amount || 0);
      totalFees += parseFloat(tx.fees || 0);
    });

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2
      }).format(Math.abs(amount || 0));
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Nairobi'
      });
    };

    const getTransactionTypeLabel = (type) => {
      switch (type) {
        case 'deposit': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'transfer': return 'Transfer';
        case 'payment': return 'Payment';
        default: return 'Transaction';
      }
    };

    // Helper function to get member name from transaction using chama members list
    const getMemberName = (tx) => {
      return this.getMemberNameFromTransaction(tx, chamaMembers, userInfo);
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Transaction History Report - ${reportId}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif !important; font-size: 10px !important; line-height: 1.2 !important; color: #000 !important; background: white !important; }
          .container { width: 100% !important; max-width: 180mm !important; margin: 0 auto !important; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
              <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${this.companyInfo.name}</div>
                <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">${chamaName}</div>
                <div style="font-size: 8px; color: #000; line-height: 1.1;">
                  ${this.companyInfo.address}<br>
                  Tel: ${this.companyInfo.phone} | Email: ${this.companyInfo.email}
                </div>
              </div>
              <div style="text-align: right; font-size: 8px; color: #000; line-height: 1.1;">
                Report No: ${reportId}<br>
                Generated: ${reportDate}
              </div>
            </div>
            <div style="text-align: center; font-size: 12px; font-weight: bold; color: #000; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px;">${reportTitle.toUpperCase()}</div>
            <div style="border-bottom: 2px solid #000; margin: 10px 0 15px 0;"></div>
          </div>

          <!-- Report Summary -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8px;">
            <thead>
              <tr>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">REPORT PERIOD</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">TOTAL TRANSACTIONS</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">TOTAL AMOUNT (KES)</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">TOTAL FEES (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 8px;">All Time</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 8px;">${transactions.length}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 8px;">${formatCurrency(totalAmount)}</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 8px;">${formatCurrency(totalFees)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Transactions Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 7px;">
            <thead>
              <tr>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">DATE</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 15%;">NAME</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 20%;">DESCRIPTION</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">TYPE</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 12%;">AMOUNT</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 8%;">FEES</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 10%;">STATUS</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px; width: 15%;">REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map((tx, index) => {
                const txAmount = parseFloat(tx.amount || 0);
                const txFees = parseFloat(tx.fees || 0);
                const txDate = formatDate(tx.date || tx.createdAt || tx.created_at);
                const memberName = getMemberName(tx);

                return `
                <tr>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${txDate}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: bold; color: #2563eb;">${memberName}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 9px;">${tx.description || tx.transaction_description || tx.memo || 'N/A'}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${getTransactionTypeLabel(tx.type)}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 9px;">${formatCurrency(txAmount)}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 9px;">${formatCurrency(txFees)}</td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">
                    <span style="display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8px; font-weight: bold; text-transform: uppercase; border: 1px solid #000; background: #90EE90; color: #000;">
                      ${(tx.status || 'completed').toUpperCase()}
                    </span>
                  </td>
                  <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${tx.reference || tx.ref || '-'}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Summary Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 8px;">
            <thead>
              <tr>
                <th colspan="2" style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">SUMMARY</th>
                <th style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 7px;">AMOUNT (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="2" style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;">Total Transaction Amount</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;">${formatCurrency(totalAmount)}</td>
              </tr>
              <tr>
                <td colspan="2" style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;">Total Transaction Fees</td>
                <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;">${formatCurrency(totalFees)}</td>
              </tr>
              <tr style="background: #f0f0f0; font-weight: bold;">
                <td colspan="2" style="border: 1px solid #000; border-top: 2px solid #000; padding: 6px 4px; text-align: left; font-size: 8px;"><strong>GRAND TOTAL</strong></td>
                <td style="border: 1px solid #000; border-top: 2px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; font-size: 8px;"><strong>${formatCurrency(totalAmount + totalFees)}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Footer -->
          <div style="border-top: 2px solid #000; padding-top: 10px; margin-top: 15px; text-align: center;">
            <div style="font-size: 9px; font-weight: bold; color: #000; margin-bottom: 5px;">Thank you for using ${this.companyInfo.name}</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">This is a computer-generated report and does not require a signature.</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">For inquiries, contact us at ${this.companyInfo.phone} or ${this.companyInfo.email}</div>
            <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">Visit us at ${this.companyInfo.website}</div>
            <div style="font-size: 7px; color: #666; margin-top: 8px;">
              Report generated on ${reportDate} | Total Records: ${transactions.length}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate bulk transaction history report
   */
  generateBulkReceiptHTML(transactions, userInfo = {}) {
    if (!transactions || transactions.length === 0) {
      throw new Error('No transactions provided for bulk receipt');
    }

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 2,
      }).format(Math.abs(amount || 0));
    };

    const getTransactionTypeLabel = (type) => {
      switch (type) {
        case 'deposit': return 'Deposit';
        case 'withdraw': return 'Withdrawal';
        case 'transfer': return 'Transfer';
        default: return 'Transaction';
      }
    };

    const reportId = `RPT-${Date.now().toString().substring(-8)}`;
    const reportDate = formatDate(new Date().toISOString());
    const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const totalFees = transactions.reduce((sum, tx) => sum + (tx.fees || 0), 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Transaction History Report - ${reportId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
            background: white;
            padding: 0;
            margin: 0;
          }
          .report-container {
            width: 210mm;
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 15mm;
          }
          .report-header {
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }
          .company-info { flex: 1; }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
          }
          .company-details {
            font-size: 10px;
            color: #666;
            line-height: 1.3;
          }
          .report-title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            color: #000;
            margin: 15px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .report-id {
            text-align: right;
            font-size: 11px;
            color: #666;
          }
          .report-info {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            font-size: 11px;
          }
          .report-info th {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
          }
          .report-info td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: center;
            font-weight: bold;
          }
          .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 9px;
          }
          .transactions-table th {
            background: #f0f0f0;
            border: 1px solid #ccc;
            padding: 6px 4px;
            text-align: left;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8px;
          }
          .transactions-table td {
            border: 1px solid #ccc;
            padding: 6px 4px;
            vertical-align: top;
            font-size: 9px;
          }
          .transactions-table tr:nth-child(even) {
            background: #f9f9f9;
          }
          .status-badge {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 7px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-completed {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .status-pending {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
          }
          .amount-cell {
            text-align: right;
            font-weight: bold;
          }
          .summary {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 11px;
          }
          .summary th, .summary td {
            border: 1px solid #ccc;
            padding: 8px;
            text-align: right;
          }
          .summary th {
            background: #f0f0f0;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 10px;
          }
          .summary .label-col {
            text-align: left;
            font-weight: bold;
          }
          .summary .total-row {
            background: #e8f4f8;
            font-weight: bold;
            font-size: 12px;
          }
          .summary .total-row td {
            border-top: 2px solid #000;
          }
          .report-footer {
            border-top: 2px solid #000;
            padding-top: 15px;
            margin-top: 20px;
            text-align: center;
          }
          .footer-text {
            font-size: 10px;
            color: #666;
            line-height: 1.4;
            margin-bottom: 5px;
          }
          @media print {
            body { background: white; padding: 0; margin: 0; font-size: 10px; }
            .report-container { width: 100%; max-width: none; padding: 10mm; box-shadow: none; border-radius: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <!-- Header -->
          <div class="report-header">
            <div class="header-row">
              <div class="company-info">
                <div class="company-name">${this.companyInfo.name}</div>
                <div class="company-details">
                  ${this.companyInfo.address}<br>
                  Tel: ${this.companyInfo.phone} | Email: ${this.companyInfo.email}
                </div>
              </div>
              <div class="report-id">
                Report No: ${reportId}<br>
                Generated: ${reportDate}
              </div>
            </div>
            <div class="report-title">TRANSACTION HISTORY REPORT</div>
            <div class="title-underline"></div>
          </div>

          <!-- Report Summary -->
          <table class="report-summary">
            <thead>
              <tr>
                <th>REPORT PERIOD</th>
                <th>TOTAL TRANSACTIONS</th>
                <th>TOTAL AMOUNT (KES)</th>
                <th>TOTAL FEES (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>All Time</td>
                <td>${transactions.length}</td>
                <td>${formatCurrency(totalAmount)}</td>
                <td>${formatCurrency(totalFees)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Transactions Table -->
          <table class="transactions-table">
            <thead>
              <tr>
                <th style="width: 12%;">DATE</th>
                <th style="width: 15%;">TRANSACTION ID</th>
                <th style="width: 25%;">DESCRIPTION</th>
                <th style="width: 8%;">TYPE</th>
                <th style="width: 12%;">AMOUNT</th>
                <th style="width: 8%;">FEES</th>
                <th style="width: 10%;">STATUS</th>
                <th style="width: 10%;">REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map((tx, index) => {
                const txAmount = parseFloat(tx.amount || 0);
                const txFees = parseFloat(tx.fees || 0);
                const txDate = formatDate(tx.date || tx.createdAt || tx.created_at);
                const txId = (tx.id || tx.transaction_id || '').toString();
                const shortId = txId.length > 12 ? txId.substring(0, 12) + '...' : txId;

                return `
                <tr>
                  <td>${txDate}</td>
                  <td>${shortId}</td>
                  <td class="desc-col">${tx.description || tx.transaction_description || tx.memo || 'N/A'}</td>
                  <td>${getTransactionTypeLabel(tx.type)}</td>
                  <td class="amount-col">${formatCurrency(txAmount)}</td>
                  <td class="amount-col">${formatCurrency(txFees)}</td>
                  <td><span class="status-badge status-${tx.status || 'completed'}">${(tx.status || 'completed').toUpperCase()}</span></td>
                  <td>${tx.reference || tx.ref || '-'}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Summary Table -->
          <table class="summary-table">
            <thead>
              <tr>
                <th colspan="2">SUMMARY</th>
                <th>AMOUNT (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colspan="2">Total Transaction Amount</td>
                <td class="amount-col">${formatCurrency(totalAmount)}</td>
              </tr>
              <tr>
                <td colspan="2">Total Transaction Fees</td>
                <td class="amount-col">${formatCurrency(totalFees)}</td>
              </tr>
              <tr class="grand-total">
                <td colspan="2"><strong>GRAND TOTAL</strong></td>
                <td class="amount-col"><strong>${formatCurrency(totalAmount + totalFees)}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Footer -->
          <div class="report-footer">
            <div class="footer-text">
              <strong>Thank you for using ${this.companyInfo.name}</strong>
            </div>
            <div class="footer-text">
              This is a computer-generated report and does not require a signature.
            </div>
            <div class="footer-text">
              For inquiries, contact us at ${this.companyInfo.phone} or ${this.companyInfo.email}
            </div>
            <div class="footer-text">
              Visit us at ${this.companyInfo.website}
            </div>
            <div style="font-size: 9px; color: #999; margin-top: 10px;">
              Report generated on ${new Date().toLocaleString('en-KE', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Nairobi'
              })} | Total Records: ${transactions.length}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Download bulk transaction history
   */
  async downloadBulkReceipts(transactions, format = 'pdf', userInfo = {}) {
    try {
      if (!transactions || transactions.length === 0) {
        throw new Error('No transactions provided for bulk download');
      }

      const reportId = `RPT-${Date.now().toString().substring(-8)}`;
      const fileName = `VaultKe_TransactionHistory_${reportId}_${new Date().toISOString().split('T')[0]}`;

      // Calculate totals
      const totalAmount = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
      const totalFees = transactions.reduce((sum, tx) => sum + (parseFloat(tx.fees) || 0), 0);
      const reportDate = new Date().toISOString();

      console.log('🔍 downloadBulkReceipts called with:', {
        format,
        transactionCount: transactions.length,
        userInfo
      });

      switch (format.toLowerCase()) {
        case 'pdf': {
          console.log('🔍 Generating PDF bulk receipt...');
          const html = this.generatePDFOptimizedBulkReceiptHTML(transactions, userInfo);

          if (Platform.OS === 'web') {
            // For web, create a print-friendly version and trigger browser print to PDF
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>Transaction History Report - ${reportId}</title>
                <style>
                  @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                  }
                </style>
              </head>
              <body>
                ${html.replace(/<html>.*?<body>/s, '').replace(/<\/body>.*?<\/html>/s, '')}
                <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #007bff; color: white; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="window.print()">
                  Click here to save as PDF
                </div>
                <script>
                  window.onload = function() {
                    setTimeout(() => window.print(), 500);
                  };
                </script>
              </body>
              </html>
            `);
            printWindow.document.close();
            return { success: true, uri: null, fileName: `${fileName}.pdf`, reportId };
          } else if (Print && Print.printToFileAsync) {
            const { uri } = await Print.printToFileAsync({
              html,
              base64: false,
              width: 612,
              height: 792
            });
            return { success: true, uri, fileName: `${fileName}.pdf`, reportId };
          }
          throw new Error('PDF generation not available');
        }

        case 'html': {
          const html = this.generateBulkReceiptHTML(transactions, userInfo);
          if (Platform.OS === 'web') {
            return this.generateWebDownload(html, `${fileName}.html`, 'text/html');
          } else if (FileSystem.documentDirectory) {
            const uri = `${FileSystem.documentDirectory}${fileName}.html`;
            await FileSystem.writeAsStringAsync(uri, html);
            return { success: true, uri, fileName: `${fileName}.html`, reportId };
          }
          throw new Error('HTML generation not available');
        }

        case 'excel':
        case 'csv': {
          const csvContent = this.generateCSVContent(transactions, {
            reportId,
            companyInfo: this.companyInfo,
            totalAmount,
            totalFees,
            reportDate,
            userInfo
          });

          const csvFileName = `${fileName}.csv`;
          if (Platform.OS === 'web') {
            return this.generateWebDownload(csvContent, csvFileName, 'text/csv');
          } else if (FileSystem.documentDirectory) {
            const uri = `${FileSystem.documentDirectory}${csvFileName}`;
            await FileSystem.writeAsStringAsync(uri, csvContent);
            return { success: true, uri, fileName: csvFileName, reportId };
          }
          throw new Error('CSV generation not available');
        }

        case 'word': {
          const wordContent = this.generateWordContent(transactions, {
            reportId,
            companyInfo: this.companyInfo,
            totalAmount,
            totalFees,
            reportDate,
            userInfo
          });

          const wordFileName = `${fileName}.doc`;
          if (Platform.OS === 'web') {
            return this.generateWebDownload(wordContent, wordFileName, 'application/msword');
          } else if (FileSystem.documentDirectory) {
            const uri = `${FileSystem.documentDirectory}${wordFileName}`;
            await FileSystem.writeAsStringAsync(uri, wordContent);
            return { success: true, uri, fileName: wordFileName, reportId };
          }
          throw new Error('Word generation not available');
        }

        case 'json': {
          const jsonData = {
            reportId,
            companyInfo: this.companyInfo,
            transactions: transactions.map(tx => ({
              ...tx,
              totalAmount: (tx.amount || 0) + (tx.fees || 0)
            })),
            summary: {
              totalTransactions: transactions.length,
              totalAmount: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
              totalFees: transactions.reduce((sum, tx) => sum + (tx.fees || 0), 0),
            },
            userInfo,
            generatedAt: new Date().toISOString(),
            version: '1.0'
          };

          const jsonString = JSON.stringify(jsonData, null, 2);
          if (Platform.OS === 'web') {
            return this.generateWebDownload(jsonString, `${fileName}.json`, 'application/json');
          } else if (FileSystem.documentDirectory) {
            const uri = `${FileSystem.documentDirectory}${fileName}.json`;
            await FileSystem.writeAsStringAsync(uri, jsonString);
            return { success: true, uri, fileName: `${fileName}.json`, reportId };
          }
          throw new Error('JSON generation not available');
        }

        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Error downloading bulk receipts:', error);
      Alert.alert('Error', `Failed to download transaction history: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate CSV content for Excel export
   */
  generateCSVContent(transactions, metadata) {
    const { reportId, companyInfo, totalAmount, totalFees, reportDate, userInfo, chamaMembers = [] } = metadata;

    // Extract chama information - use 'Transactions' for personal wallet transactions
    const chamaName = userInfo?.chamaName ||
                     (userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama');
    const reportTitle = userInfo?.reportTitle || 'Transaction History Report';

    let csv = '';

    // Header with chama name
    csv += `${companyInfo.name}\n`;
    csv += `${reportTitle}\n`;
    csv += `CHAMA: ${chamaName}\n`;
    csv += `Report ID: ${reportId}\n`;
    csv += `Generated: ${new Date().toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;
    csv += `Total Records: ${transactions.length}\n\n`;

    // Column headers - Member name comes after Date
    csv += 'Date,Member,Description,Type,Amount (KES),Fees (KES),Status,Reference\n';

    // Helper function to get member name using chama members list
    const getMemberName = (tx) => {
      return this.getMemberNameFromTransaction(tx, chamaMembers, userInfo);
    };

    // Data rows
    transactions.forEach(tx => {
      const date = this.formatDate(tx.date || tx.createdAt || tx.created_at);
      const memberName = getMemberName(tx).replace(/"/g, '""'); // Escape quotes for CSV
      const description = (tx.description || tx.transaction_description || tx.memo || 'N/A').replace(/"/g, '""');
      const type = tx.type || 'Transaction';
      const amount = parseFloat(tx.amount || 0);
      const fees = parseFloat(tx.fees || 0);
      const status = tx.status || 'completed';
      const reference = (tx.reference || tx.ref || '-').replace(/"/g, '""');

      csv += `"${date}","${memberName}","${description}","${type}",${amount},${fees},"${status}","${reference}"\n`;
    });

    // Summary
    csv += '\n';
    csv += 'SUMMARY\n';
    csv += `Total Transaction Amount,${totalAmount}\n`;
    csv += `Total Transaction Fees,${totalFees}\n`;
    csv += `Grand Total,${totalAmount + totalFees}\n`;

    return csv;
  }

  /**
   * Generate Word document content
   */
  generateWordContent(transactions, metadata) {
    const { reportId, companyInfo, totalAmount, totalFees, reportDate, userInfo, chamaMembers = [] } = metadata;

    // Extract chama information - use 'Transactions' for personal wallet transactions
    const chamaName = userInfo?.chamaName ||
                     (userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama');
    const reportTitle = userInfo?.reportTitle || 'Transaction History Report';

    // Generate responsive HTML that works perfectly in Word
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transaction History Report - ${reportId}</title>
        <style>
          /* Page and body setup for Word compatibility */
          @page {
            size: A4;
            margin: 0.75in;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            color: #333;
            background: white;
          }

          /* Header styling */
          .header {
            text-align: center;
            margin-bottom: 30pt;
            border-bottom: 2pt solid #2563eb;
            padding-bottom: 15pt;
          }
          .company-name {
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 8pt;
            color: #2563eb;
          }
          .report-title {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 12pt;
            color: #1e40af;
            text-transform: uppercase;
            letter-spacing: 1pt;
          }
          .report-info {
            font-size: 11pt;
            margin-bottom: 20pt;
            color: #666;
            line-height: 1.6;
          }

          /* Responsive table styling */
          .table-container {
            width: 100%;
            overflow-x: auto;
            margin-bottom: 25pt;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20pt;
            table-layout: auto;
            word-wrap: break-word;
          }

          th, td {
            border: 1.5pt solid #ddd;
            padding: 8pt 6pt;
            font-size: 11pt;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          th {
            background-color: #f8fafc;
            font-weight: bold;
            text-align: center;
            color: #1e40af;
            border-bottom: 2pt solid #2563eb;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
          }

          /* Column-specific styling */
          .col-date { width: 12%; min-width: 80pt; }
          .col-member { width: 18%; min-width: 100pt; font-weight: 600; }
          .col-description { width: 25%; min-width: 120pt; }
          .col-type { width: 12%; min-width: 70pt; }
          .col-amount { width: 13%; min-width: 80pt; text-align: right; }
          .col-fees { width: 10%; min-width: 60pt; text-align: right; }
          .col-status { width: 10%; min-width: 70pt; text-align: center; }
          .col-reference { width: 15%; min-width: 80pt; }

          .amount {
            text-align: right;
            font-weight: 600;
            color: #059669;
          }

          .member-name {
            font-weight: bold;
            color: #2563eb;
            font-size: 11pt;
          }

          .status-completed { color: #059669; font-weight: 600; }
          .status-pending { color: #d97706; font-weight: 600; }
          .status-failed { color: #dc2626; font-weight: 600; }

          /* Summary section */
          .summary {
            margin-top: 30pt;
            page-break-inside: avoid;
          }
          .summary-table {
            width: 60%;
            margin-left: auto;
            margin-right: 0;
          }
          .summary-table th {
            background-color: #1e40af;
            color: white;
            font-size: 11pt;
          }
          .total-row {
            font-weight: bold;
            background-color: #f0f9ff;
            border-top: 2pt solid #2563eb;
          }
          .total-amount {
            font-size: 12pt;
            font-weight: bold;
            color: #1e40af;
          }

          /* Print and Word-specific optimizations */
          @media print {
            body { font-size: 10pt; }
            th, td { padding: 6pt 4pt; font-size: 9pt; }
            .header { margin-bottom: 20pt; }
          }

          /* Responsive adjustments */
          @media screen and (max-width: 768px) {
            .table-container { font-size: 10pt; }
            th, td { padding: 6pt 4pt; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${companyInfo.name}</div>
          <div class="report-title">${reportTitle.toUpperCase()}</div>
          <div style="font-size: 18pt; font-weight: bold; color: #1e40af; margin: 15pt 0; padding: 10pt; background-color: #f0f9ff; border: 2pt solid #2563eb; border-radius: 5pt;">
            ${chamaName}
          </div>
          <div class="report-info">
            Report ID: ${reportId}<br>
            Generated: ${new Date().toLocaleDateString('en-KE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}<br>
            Total Records: ${transactions.length}
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th class="col-date">DATE</th>
                <th class="col-member">NAME</th>
                <th class="col-description">DESCRIPTION</th>
                <th class="col-type">TYPE</th>
                <th class="col-amount">AMOUNT (KES)</th>
                <th class="col-fees">FEES (KES)</th>
                <th class="col-status">STATUS</th>
                <th class="col-reference">REFERENCE</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => {
                const date = this.formatDate(tx.date || tx.createdAt || tx.created_at);
                // Get member name using chama members list
                const memberName = this.getMemberNameFromTransaction(tx, chamaMembers, userInfo);
                const description = (tx.description || tx.transaction_description || tx.memo || 'N/A');
                const type = (tx.type || 'Transaction').charAt(0).toUpperCase() + (tx.type || 'Transaction').slice(1);
                const amount = this.formatCurrency(parseFloat(tx.amount || 0));
                const fees = this.formatCurrency(parseFloat(tx.fees || 0));
                const status = (tx.status || 'completed').toLowerCase();
                const statusClass = `status-${status}`;
                const reference = tx.reference || tx.ref || '-';

                // Truncate long descriptions for better table layout
                const shortDescription = description.length > 50 ?
                  description.substring(0, 47) + '...' : description;

                return `
                  <tr>
                    <td class="col-date">${date}</td>
                    <td class="col-member member-name">${memberName}</td>
                    <td class="col-description" title="${description}">${shortDescription}</td>
                    <td class="col-type">${type}</td>
                    <td class="col-amount amount">${amount}</td>
                    <td class="col-fees amount">${fees}</td>
                    <td class="col-status ${statusClass}">${status.toUpperCase()}</td>
                    <td class="col-reference">${reference}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="summary">
          <h3 style="color: #1e40af; margin-bottom: 15pt; font-size: 14pt; text-align: right;">TRANSACTION SUMMARY</h3>
          <table class="summary-table">
            <thead>
              <tr>
                <th style="text-align: left; width: 70%;">DESCRIPTION</th>
                <th style="text-align: right; width: 30%;">AMOUNT (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 10pt 8pt; font-weight: 500;">Total Transaction Amount</td>
                <td class="amount" style="padding: 10pt 8pt;">${this.formatCurrency(totalAmount)}</td>
              </tr>
              <tr>
                <td style="padding: 10pt 8pt; font-weight: 500;">Total Transaction Fees</td>
                <td class="amount" style="padding: 10pt 8pt;">${this.formatCurrency(totalFees)}</td>
              </tr>
              <tr class="total-row">
                <td style="padding: 12pt 8pt; font-weight: bold; font-size: 12pt;">GRAND TOTAL</td>
                <td class="amount total-amount" style="padding: 12pt 8pt;">${this.formatCurrency(totalAmount + totalFees)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Report footer -->
          <div style="margin-top: 40pt; padding-top: 20pt; border-top: 1pt solid #ddd; text-align: center; color: #666; font-size: 10pt;">
            <p style="margin: 0;">Generated on ${new Date().toLocaleDateString('en-KE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p style="margin: 5pt 0 0 0;">Report ID: ${reportId}</p>
            <p style="margin: 5pt 0 0 0; font-style: italic;">This is a computer-generated document. No signature required.</p>
            <p style="margin: 10pt 0 0 0;">For inquiries, contact us at ${companyInfo.phone} or ${companyInfo.email}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate comprehensive chama transactions PDF report - USING EXACT SAME METHOD AS USER DASHBOARD
   */
  async generateChamaTransactionsPDF(options) {
    try {
      const {
        title,
        chamaName,
        allData,
        generatedBy,
        scope
      } = options;

      console.log('🔍 Generating PDF with data:', {
        title,
        chamaName,
        dataCount: allData?.length || 0,
        scope
      });

      if (!allData || allData.length === 0) {
        throw new Error('No transaction data provided for PDF generation');
      }

      // Use the EXACT same method as user dashboard transaction history
      const html = this.generatePDFOptimizedBulkReceiptHTML(allData, {
        reportTitle: title,
        chamaName: chamaName,
        generatedBy: generatedBy
      }, options.chamaMembers || []);

      if (!html || html.length < 100) {
        throw new Error('Generated HTML is empty or too short');
      }

      const reportId = `RPT-${Date.now().toString().substring(-8)}`;
      const fileName = `${(chamaName || 'Chama').replace(/[^a-zA-Z0-9]/g, '_')}_${scope}_transactions_${reportId}.pdf`;

      if (Platform.OS === 'web') {
        // Web implementation - same as user dashboard
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          throw new Error('Popup blocked. Please allow popups for this site.');
        }

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title || 'Transaction Report'}</title>
            <style>
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${html.replace(/<html>.*?<body>/s, '').replace(/<\/body>.*?<\/html>/s, '')}
            <div class="no-print" style="position: fixed; top: 10px; right: 10px; background: #007bff; color: white; padding: 10px; border-radius: 5px; cursor: pointer;" onclick="window.print()">
              Click here to save as PDF
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => window.print(), 500);
              };
            </script>
          </body>
          </html>
        `);
        printWindow.document.close();
        return { success: true, uri: null, fileName, reportId };
      } else {
        // Mobile implementation - EXACT same as user dashboard
        if (!Print || !Print.printToFileAsync) {
          throw new Error('Print service not available');
        }

        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
          width: 612,
          height: 792
        });

        if (!uri) {
          throw new Error('PDF generation failed - no URI returned');
        }

        // For native platforms, move to documents directory
        if (FileSystem.documentDirectory) {
          const newUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.moveAsync({
            from: uri,
            to: newUri,
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(newUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Share ${title}`,
            });
          }

          return { success: true, uri: newUri, fileName, reportId };
        }

        return { success: true, uri, fileName, reportId };
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate chama transactions Excel file - USING EXACT SAME METHOD AS USER DASHBOARD
   */
  async generateChamaTransactionsExcel(options) {
    try {
      const {
        title,
        chamaName,
        allData,
        generatedBy,
        scope
      } = options;

      console.log('🔍 Generating Excel with data:', {
        title,
        chamaName,
        dataCount: allData?.length || 0,
        scope
      });

      if (!allData || allData.length === 0) {
        throw new Error('No transaction data provided for Excel generation');
      }

      // Use the EXACT same CSV generation as user dashboard
      const reportId = `RPT-${Date.now().toString().substring(-8)}`;
      const totalAmount = allData.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
      const totalFees = allData.reduce((sum, tx) => sum + (parseFloat(tx.fees) || 0), 0);
      const reportDate = new Date().toISOString();

      const csvContent = this.generateCSVContent(allData, {
        reportId,
        companyInfo: this.companyInfo,
        totalAmount,
        totalFees,
        reportDate,
        userInfo: { reportTitle: title, chamaName, generatedBy },
        chamaMembers: options.chamaMembers || []
      });

      const fileName = `${(chamaName || 'Chama').replace(/[^a-zA-Z0-9]/g, '_')}_${scope}_transactions_${reportId}.csv`;

      if (Platform.OS === 'web') {
        // Web implementation - same as user dashboard
        return this.generateWebDownload(csvContent, fileName, 'text/csv');
      } else {
        // Mobile implementation - same as user dashboard
        if (!FileSystem || !FileSystem.documentDirectory) {
          throw new Error('FileSystem not available');
        }

        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/csv',
            dialogTitle: `Share ${title}`,
          });
        }

        return { success: true, uri: fileUri, fileName, reportId };
      }
    } catch (error) {
      console.error('Excel generation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate chama transactions Word document - USING EXACT SAME METHOD AS USER DASHBOARD
   */
  async generateChamaTransactionsWord(options) {
    try {
      const {
        title,
        chamaName,
        allData,
        generatedBy,
        scope
      } = options;

      console.log('🔍 Generating Word with data:', {
        title,
        chamaName,
        dataCount: allData?.length || 0,
        scope
      });

      if (!allData || allData.length === 0) {
        throw new Error('No transaction data provided for Word generation');
      }

      // Use the EXACT same method as user dashboard - generate proper Word document
      const reportId = `RPT-${Date.now().toString().substring(-8)}`;
      const totalAmount = allData.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
      const totalFees = allData.reduce((sum, tx) => sum + (parseFloat(tx.fees) || 0), 0);
      const reportDate = new Date().toISOString();

      const wordContent = this.generateWordContent(allData, {
        reportId,
        companyInfo: this.companyInfo,
        totalAmount,
        totalFees,
        reportDate,
        userInfo: { reportTitle: title, chamaName, generatedBy },
        chamaMembers: options.chamaMembers || []
      });

      const fileName = `${(chamaName || 'Chama').replace(/[^a-zA-Z0-9]/g, '_')}_${scope}_transactions_${reportId}.doc`;

      if (Platform.OS === 'web') {
        // Web implementation - same as user dashboard
        return this.generateWebDownload(wordContent, fileName, 'application/msword');
      } else {
        // Mobile implementation - same as user dashboard
        if (!FileSystem || !FileSystem.documentDirectory) {
          throw new Error('FileSystem not available');
        }

        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, wordContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/msword',
            dialogTitle: `Share ${title}`,
          });
        }

        return { success: true, uri: fileUri, fileName, reportId };
      }
    } catch (error) {
      console.error('Word generation error:', error);
      return { success: false, error: error.message };
    }
  }






  /**
   * Generate individual transaction receipt - USING EXACT SAME METHOD AS USER DASHBOARD
   */
  async generateTransactionReceipt(transaction, format = 'pdf', options = {}) {
    try {
      const { chamaName, userInfo, chamaMembers } = options;

      console.log('🧾 Generating individual receipt using user dashboard method:', {
        transactionId: transaction?.id,
        format,
        userInfo,
        chamaMembersCount: chamaMembers?.length || 0
      });

      // Use the EXACT same method as user dashboard for individual receipts
      switch (format.toLowerCase()) {
        case 'pdf':
          // This is the EXACT same method used in user dashboard TransactionHistoryScreen
          return await this.generatePDFReceipt(transaction, userInfo || {}, chamaMembers, options);
        case 'excel':
        case 'csv':
          return await this.generateCSVReceipt(transaction, userInfo || {}, chamaMembers, options);
        case 'word':
        case 'html':
          return await this.generateHTMLReceipt(transaction, userInfo || {}, chamaMembers, options);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Transaction receipt generation error:', error);
      return { success: false, error: error.message };
    }
  }










}

export default new ReceiptService();
