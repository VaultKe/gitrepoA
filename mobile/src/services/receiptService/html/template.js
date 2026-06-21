export const generatePDFOptimizedReceiptHTML = (transaction, chamaName, performedBy, companyInfo) => {
  if (!transaction || !transaction.id) {
    throw new Error('Invalid transaction data provided');
  }

  const receiptId = `RCP-${Date.now().toString().substring(-8)}`;

  const escapeHTML = (value) => {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  };

  const getValue = (...values) => {
    return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') ?? '';
  };

  const maskPhoneNumber = (phone) => {
    const rawPhone = String(phone ?? '').trim();
    if (!rawPhone || rawPhone === 'N/A') return '';
    if (rawPhone.includes('*')) return rawPhone;

    const digits = rawPhone.replace(/[^\d]/g, '');
    if (digits.length < 5) return '***';

    const visibleStart = Math.min(4, digits.length - 2);
    return `${digits.slice(0, visibleStart)}***${digits.slice(-2)}`;
  };

  const getTransactionCode = () => getValue(
    transaction.transactionCode,
    transaction.transaction_code,
    transaction.mpesaCode,
    transaction.mpesa_code,
    transaction.mPesaCode,
    transaction.m_pesa_code,
    transaction.mpesaReceiptNumber,
    transaction.mpesa_receipt_number,
    transaction.code,
    transaction.reference,
    transaction.ref,
    transaction.transactionId,
    transaction.transaction_id
  );

  const getSenderPhone = () => getValue(
    transaction.senderPhone,
    transaction.sender_phone,
    transaction.fromPhone,
    transaction.from_phone,
    transaction.phoneNumber,
    transaction.phone_number,
    transaction.phone,
    transaction.metadata?.senderPhone,
    transaction.metadata?.sender_phone,
    transaction.metadata?.fromPhone,
    transaction.metadata?.from_phone,
    transaction.metadata?.phoneNumber,
    transaction.metadata?.phone_number,
    transaction.metadata?.phone
  );

  const getDestinationAccount = () => getValue(
    transaction.destinationAccount,
    transaction.destination_account,
    transaction.toAccount,
    transaction.to_account,
    transaction.accountNumber,
    transaction.account_number,
    transaction.account,
    transaction.metadata?.destinationAccount,
    transaction.metadata?.destination_account,
    transaction.metadata?.toAccount,
    transaction.metadata?.to_account,
    transaction.metadata?.accountNumber,
    transaction.metadata?.account_number,
    transaction.metadata?.account
  );

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

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(Math.abs(numAmount));
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

  const transactionDate = formatDate(transaction.date || transaction.createdAt || transaction.created_at);
  const transactionAmount = parseFloat(transaction.amount || transaction.transaction_amount || 0);
  const transactionFees = parseFloat(transaction.fees || transaction.transaction_fees || 0);

  const amount = formatCurrency(transactionAmount);
  const fees = formatCurrency(transactionFees);
  const totalAmount = formatCurrency(transactionAmount + transactionFees);
  const description = transaction.description || transaction.transaction_description || transaction.memo || 'Transaction';

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
              <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${companyInfo.name}</div>
              <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">${chamaName}</div>
              <div style="font-size: 8px; color: #000; line-height: 1.1;">
                ${companyInfo.address}<br>
                Tel: ${companyInfo.phone} | Email: ${companyInfo.email}
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
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-size: 9px;">${getTransactionTypeLabel(transaction.type || transaction.transaction_type)}</td>
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

        <!-- Payment Details -->
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 9px;">
          <thead>
            <tr>
              <th colspan="2" style="background: #e8e8e8; border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 8px;">MPESA / PAYMENT DETAILS</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; width: 35%;">M-Pesa Transaction Code</td>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 9px;">${escapeHTML(getTransactionCode()) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold;">Sender Phone</td>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 9px;">${escapeHTML(maskPhoneNumber(getSenderPhone())) || 'N/A'}</td>
            </tr>
            <tr>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold;">Destination Account</td>
              <td style="border: 1px solid #000; padding: 6px 4px; text-align: left; font-size: 9px;">${escapeHTML(getDestinationAccount()) || 'N/A'}</td>
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
          <div style="font-size: 9px; font-weight: bold; color: #000; margin-bottom: 5px;">Thank you for using ${companyInfo.name}</div>
          <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">This is a computer-generated report and does not require a signature.</div>
          <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">For inquiries, contact us at ${companyInfo.phone} or ${companyInfo.email}</div>
          <div style="font-size: 8px; color: #000; line-height: 1.2; margin-bottom: 3px;">Visit us at ${companyInfo.website}</div>
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
};

export const generateReceiptJSON = (transaction, companyInfo, userInfo = {}) => {
  const transactionId = transaction.id || transaction.transaction_id;
  const receiptId = `RCP-${transactionId.toString().substring(0, 8).toUpperCase()}`;

  const transactionAmount = parseFloat(transaction.amount || transaction.transaction_amount || 0);
  const transactionFees = parseFloat(transaction.fees || transaction.transaction_fees || 0);
  const dateField = transaction.date || transaction.createdAt || transaction.created_at || transaction.timestamp;
  const description = transaction.description || transaction.transaction_description || transaction.memo || 'Transaction';

  return {
    receiptId,
    companyInfo,
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
};