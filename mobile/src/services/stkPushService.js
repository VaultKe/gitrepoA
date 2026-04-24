import ApiService from './api';

class STKPushService {
  // All M-Pesa STK Push error codes
  static getErrorMessage(code) {
    const errors = {
      // Success
      0: "Payment successful",

      // User cancelled/timeout
      1032: "Payment cancelled by user",
      1037: "Payment timed out - check your phone",
      1025: "Unable to complete payment",
      1001: "Another transaction in progress",

      // Insufficient funds
      1019: "Insufficient funds in M-Pesa",
      1: "Transaction declined - check balance",

      // PIN issues
      2001: "Wrong M-Pesa PIN entered",
      2006: "Could not confirm PIN",

      // System errors
      9999: "System error - try again later"
    };

    return errors[code] || "Payment failed - try again";
  }

  // Validate phone number
  validatePhone(phone) {
    const cleaned = phone.replace(/[\s\-\+]/g, '');
    const kenyan = /^(254|0)?([17][0-9]{8})$/;

    if (!kenyan.test(cleaned)) {
      return { valid: false, error: "Invalid phone number" };
    }

    let formatted = cleaned;
    if (formatted.startsWith('0')) {
      formatted = '254' + formatted.substring(1);
    } else if (!formatted.startsWith('254')) {
      formatted = '254' + formatted;
    }

    return { valid: true, phone: formatted };
  }

  // Validate amount
  validateAmount(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num < 1 || num > 300000) {
      return { valid: false, error: "Amount must be between KES 1 and 300,000" };
    }
    return { valid: true, amount: num };
  }

  // Start payment
  async startPayment(data) {
    try {
      // Validate phone
      const phoneCheck = this.validatePhone(data.phone);
      if (!phoneCheck.valid) {
        return { success: false, message: phoneCheck.error };
      }

      // Validate amount
      const amountCheck = this.validateAmount(data.amount);
      if (!amountCheck.valid) {
        return { success: false, message: amountCheck.error };
      }

      // Send to API
      const response = await ApiService.post('/api/v1/payments/stkpush', {
        phone: phoneCheck.phone,
        amount: amountCheck.amount,
        chamaId: data.chamaId,
        userId: data.userId,
        description: data.description || 'Chama Contribution'
      });

      if (response.success) {
        return {
          success: true,
          checkoutRequestId: response.data.CheckoutRequestID,
          message: "Check your phone and enter M-Pesa PIN"
        };
      } else {
        return { success: false, message: response.error || "Failed to start payment" };
      }

    } catch (error) {
      return { success: false, message: "Network error - try again" };
    }
  }

  // Check payment status
  async checkStatus(checkoutRequestId) {
    try {
      const response = await ApiService.get(`/api/v1/payments/stkpush/status/${checkoutRequestId}`);

      if (response.success) {
        const code = response.data.ResultCode;
        const message = STKPushService.getErrorMessage(code);

        return {
          success: code === 0,
          resultCode: code,
          message: message,
          transactionId: response.data.MpesaReceiptNumber,
          amount: response.data.Amount,
          phone: response.data.PhoneNumber
        };
      } else {
        return { success: false, message: "Could not check payment status" };
      }

    } catch (error) {
      return { success: false, message: "Network error checking status" };
    }
  }

  // Process callback from M-Pesa
  processCallback(callbackData) {
    try {
      const resultCode = callbackData.Body?.stkCallback?.ResultCode;
      const message = STKPushService.getErrorMessage(resultCode);

      let details = {};
      if (resultCode === 0) {
        const items = callbackData.Body?.stkCallback?.CallbackMetadata?.Item || [];
        items.forEach(item => {
          if (item.Name === 'Amount') details.amount = item.Value;
          if (item.Name === 'MpesaReceiptNumber') details.transactionId = item.Value;
          if (item.Name === 'PhoneNumber') details.phone = item.Value;
          if (item.Name === 'TransactionDate') details.date = item.Value;
        });
      }

      return {
        success: resultCode === 0,
        resultCode,
        message,
        details
      };

    } catch (error) {
      return {
        success: false,
        message: "Error processing payment callback"
      };
    }
  }
}

export default new STKPushService();
