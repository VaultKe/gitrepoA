import { useState, useEffect, useCallback } from 'react';
import { Alert, Toast } from 'react-native';
import { useApp } from '../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../utils/theme';
import api from '../services/api';
import { getChamaSubscriptionPayments, paySubscriptionPayment } from '../services/api/chamaEndpoints';
import { generatePDFOptimizedReceiptHTML } from '../services/receiptService/html/template';
import { COMPANY_INFO } from '../services/receiptService/config';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Dimensions, Platform } from 'react-native';

const useSubscriptionManagementScreen = ({ route }) => {
  const { chamaId } = route.params;
  const { theme, userRole, user } = useApp();
  const colors = getThemeColors(theme);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= breakpoints.lg;

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [page, setPage] = useState(1);
  const [memberRole, setMemberRole] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const PER_PAGE = 12;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadMemberRole();
  }, [chamaId]);

  const loadMemberRole = async () => {
    try {
      const response = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (response.success && response.data) {
        const members = Array.isArray(response.data) ? response.data : [response.data];
        const currentUser = members.find(m => m.userId === user?.id || m.user_id === user?.id);
        if (currentUser) {
          const role = (currentUser.role || currentUser.memberRole || '').toLowerCase();
          setMemberRole(role || null);
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load member role',
        text2: error.message || 'Please try again',
      });
    }
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const response = await getChamaSubscriptionPayments(chamaId);
      if (response.success && response.data) {
        setSubscriptions(response.data);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Failed to load subscriptions',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePaySubscription = async (payment) => {
    const normalizedUserRole = (userRole || '').toLowerCase();
    const normalizedMemberRole = (memberRole || '').toLowerCase();
    const canPay = ['admin'].includes(normalizedUserRole) || ['chairperson', 'treasurer'].includes(normalizedMemberRole);

    if (!canPay) {
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson or treasurer can initiate payments',
      });
      return;
    }

    try {
      setPayingId(payment.id);
      const response = await paySubscriptionPayment(chamaId, payment.id);
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'STK push sent to your phone',
        });
        loadSubscriptions();
      } else {
        const errorMsg = response.error || 'Failed to initiate payment';
        throw new Error(errorMsg);
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'overdue': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'overdue': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getReceiptId = (sub) => {
    return `RCP-${String(sub?.id || sub?.transactionId || Date.now()).substring(0, 8).toUpperCase()}`;
  };

  const getReceiptFileName = (receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
  };

  const getReceiptBodyHTML = (html) => {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1].trim() : html;
  };

  const openReceiptPrintWindow = (html, title, receiptId) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.open) {
      return { success: false, error: 'Print is not available on this device' };
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return { success: false, error: 'Popup blocked. Allow popups to print receipts.' };
    }

    const isFullHTMLDocument = /<!DOCTYPE html>[\s\S]*<\/html>/i.test(html) || /<html[\s\S]*<\/html>/i.test(html);
    const documentHTML = isFullHTMLDocument
      ? html
      : `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif !important; color: #000 !important; background: white !important; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

    printWindow.document.open();
    printWindow.document.write(documentHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);

    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const printReceiptHTML = async (html, title, receiptId) => {
    if (Platform.OS === 'web') {
      return openReceiptPrintWindow(getReceiptBodyHTML(html), title, receiptId);
    }

    if (!Print?.printAsync) {
      return { success: false, error: 'Print is not available on this device' };
    }

    await Print.printAsync({ html, base64: false });
    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const downloadReceiptHTML = async (html, fileName) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
      throw new Error('Download is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Download is not available on this device');
    }

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/html',
      dialogTitle: 'Download subscription receipt',
      UTI: 'public.html',
    });

    return { success: true, fileName, uri };
  };

  const buildReceiptHTML = (sub) => {
    const transaction = {
      id: sub?.id,
      date: sub?.paidAt || sub?.createdAt || sub?.dueDate,
      amount: sub?.amount || 0,
      status: 'paid',
      type: 'payment',
      description: 'Monthly Subscription Payment',
      reference: sub?.transactionId || sub?.id || 'N/A',
      fees: 0,
    };

    return generatePDFOptimizedReceiptHTML(transaction, 'Chama Subscription', user?.chamaName || 'Chama', COMPANY_INFO);
  };

  const buildInvoiceHTML = (sub) => {
    const invoiceId = getReceiptId(sub);
    const invoiceDate = new Date(sub?.paidAt || sub?.createdAt || sub?.dueDate || Date.now());
    const dueDate = sub?.dueDate ? new Date(sub.dueDate) : null;
    const amount = parseFloat(sub?.amount || 0);
    const taxRate = 0.16;
    const taxAmount = amount * taxRate;
    const total = amount + taxAmount;

    const formatDateValue = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Africa/Nairobi'
      });
    };

    const escapeHTML = (value) => {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[char]));
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Invoice ${invoiceId}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif !important; font-size: 12px !important; line-height: 1.4 !important; color: #000 !important; background: white !important; }
          .container { width: 100% !important; max-width: 180mm !important; margin: 0 auto !important; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .meta { text-align: right; font-size: 12px; }
          .panel { border: 1px solid #000; padding: 10px; margin-bottom: 15px; }
          .panel-title { font-weight: bold; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #e8e8e8; font-weight: bold; text-transform: uppercase; }
          .numbers { width: 100%; max-width: 280px; margin-left: auto; border-collapse: collapse; }
          .numbers td { border: 1px solid #000; padding: 8px; }
          .numbers .total td { font-weight: bold; background: #f5f5f5; }
          .footer { margin-top: 15px; font-size: 11px; text-align: center; }
          .watermark { opacity: 0.08; position: fixed; top: 40px; right: 40px; font-size: 80px; font-weight: bold; transform: rotate(-25deg); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="watermark">INVOICE</div>
          <div class="header">
            <div>
              <div class="title">Invoice</div>
              <div style="margin-top:4px;">${COMPANY_INFO.name}</div>
              <div>${COMPANY_INFO.address}</div>
              <div>Tel: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}</div>
            </div>
            <div class="meta">
              <div><strong>Invoice #:</strong> ${escapeHTML(invoiceId)}</div>
              <div><strong>Date:</strong> ${formatDateValue(invoiceDate)}</div>
              ${dueDate ? `<div><strong>Due Date:</strong> ${formatDateValue(dueDate)}</div>` : ''}
            </div>
          </div>

          <div style="display:flex;gap:15px;">
            <div class="panel" style="flex:1;">
              <div class="panel-title">Bill From</div>
              <div><strong>${COMPANY_INFO.name}</strong></div>
              <div>${COMPANY_INFO.address}</div>
              <div>${COMPANY_INFO.email}</div>
              <div>${COMPANY_INFO.phone}</div>
            </div>
            <div class="panel" style="flex:1;">
              <div class="panel-title">Bill To</div>
              <div><strong>${escapeHTML(user?.chamaName || 'Chama')}</div>
              <div>KRA PIN: P05123456K</div>
              <div>VAT Reg: A05123456B</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Invoice</th>
                <th style="width: 18%;">Date</th>
                <th>Item</th>
                <th style="width: 14%;">Amount (KES)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHTML(invoiceId)}</td>
                <td>${formatDateValue(invoiceDate)}</td>
                <td>
                  <strong>Monthly Subscription Payment</strong><br>
                  Chama: ${escapeHTML(user?.chamaName || 'N/A')}<br>
                  Month/Year: ${escapeHTML(sub?.monthYear || 'N/A')}
                </td>
                <td style="text-align: right;">${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <table class="numbers">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td style="text-align: right;">${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td>VAT (16%)</td>
                <td style="text-align: right;">${taxAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr class="total">
                <td>Total</td>
                <td style="text-align: right;">${total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div>VAT Quantity: 1 | VAT Rate: 16%</div>
            <div style="margin-top:6px;">This is a computer-generated invoice and does not require a signature.</div>
            <div>For inquiries, contact us at ${COMPANY_INFO.phone} or ${COMPANY_INFO.email}</div>
            <div style="margin-top:6px;">Generated on ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} | Total Records: 1 | Version: 3.0.0</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintSubscriptionReceipt = async (sub) => {
    if (!sub) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(sub);
      const html = buildReceiptHTML(sub);
      const result = await printReceiptHTML(
        html,
        `Subscription Receipt - ${receiptId}`,
        receiptId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipt');
      }
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleDownloadInvoice = async (sub) => {
    if (!sub) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(sub);
      const html = buildInvoiceHTML(sub);
      const fileName = `VaultKe_Invoice_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
      const result = await downloadReceiptHTML(html, fileName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to download invoice');
      }
      Toast.show({
        type: 'success',
        text1: 'Invoice Downloaded',
        text2: `Invoice saved as ${result.fileName}`,
      });
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Failed to download invoice.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintAllPaidSubscriptions = async () => {
    const paidSubs = subscriptions.filter(s => s.status === 'paid');
    if (paidSubs.length === 0) {
      return;
    }

    setReceiptLoading(true);
    try {
      const rows = paidSubs.map((sub) => `
        <tr>
          <td>${sub.id}</td>
          <td>${sub.dueDate || sub.createdAt || 'N/A'}</td>
          <td>${sub.amount || 0}</td>
          <td>${sub.status || 'N/A'}</td>
          <td>${sub.transactionId || sub.id || 'N/A'}</td>
          <td>${sub.paidAt || 'N/A'}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Subscription Payments Report</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif !important; color: #000 !important; background: white !important; }
              table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; }
              th, td { border: 1px solid #000 !important; padding: 8px !important; text-align: left !important; font-size: 12px !important; }
              th { background: #e8e8e8 !important; font-weight: bold !important; }
            </style>
          </head>
          <body>
            <h2>Subscription Payments Report</h2>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Total Paid: ${paidSubs.length}</p>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction ID</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `;

      const result = await printReceiptHTML(html, 'Subscription Payments Report', 'SUB-ALL');
      if (!result.success) {
        throw new Error(result.error || 'Failed to print report');
      }
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print subscriptions.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const totalPages = Math.ceil(subscriptions.length / PER_PAGE);
  const startIndex = (page - 1) * PER_PAGE;
  const paginatedSubscriptions = subscriptions.slice(startIndex, startIndex + PER_PAGE);

  return {
    colors,
    subscriptions,
    loading,
    payingId,
    page,
    memberRole,
    receiptLoading,
    isDesktop,
    totalPages,
    startIndex,
    paginatedSubscriptions,
    setPage,
    setPayingId,
    loadSubscriptions,
    handlePaySubscription,
    formatDate,
    formatCurrency,
    getStatusColor,
    getStatusIcon,
    handlePrintSubscriptionReceipt,
    handleDownloadInvoice,
    handlePrintAllPaidSubscriptions,
  };
};

export default useSubscriptionManagementScreen;
