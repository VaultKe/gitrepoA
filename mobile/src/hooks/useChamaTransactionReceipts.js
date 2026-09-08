import { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { getMemberNameFromTransaction } from '../services/receiptService/memberName';
import { generatePDFOptimizedReceiptHTML } from '../services/receiptService/html/template';
import { COMPANY_INFO } from '../services/receiptService/config';
import { downloadBackendPdf, downloadTransactionReceiptPdf } from '../services/pdfDownload';
import {
  formatDate,
  getTransactionUserName,
  getReportValue,
} from '../utils/transactionsHelpers';

const useChamaTransactionReceipts = ({ selectedChama, chamaId, chamaMembers, transactions, allRecords, exportLoading, setExportLoading, setShowExportModal, canViewGroup, viewMode }) => {
  const getReceiptId = useCallback((transaction) => {
    return `RCP-${String(transaction?.id || transaction?.transaction_id || transaction?.reference || Date.now()).substring(0, 8).toUpperCase()}`;
  }, []);

  const getReceiptFileName = useCallback((receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
  }, []);

  const getReceiptBodyHTML = useCallback((html) => {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1].trim() : html;
  }, []);

  const openReceiptPrintWindow = useCallback((html, title, receiptId) => {
    if (typeof window === 'undefined' || !window.open) {
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
              section { page-break-after: always; }
              section:last-child { page-break-after: auto; }
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
  }, [getReceiptFileName]);

  const printReceiptHTML = useCallback(async (html, title, receiptId) => {
    if (Platform.OS === 'web') {
      return openReceiptPrintWindow(getReceiptBodyHTML(html), title, receiptId);
    }

    if (!Print?.printAsync) {
      return { success: false, error: 'Print is not available on this device' };
    }

    await Print.printAsync({ html, base64: false });
    return { success: true, fileName: getReceiptFileName(receiptId) };
  }, [openReceiptPrintWindow, getReceiptBodyHTML, getReceiptFileName]);

  const shareReceiptHTML = useCallback(async (html, fileName) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      if (navigator.share && window.File) {
        const file = new File([blob], fileName, { type: 'text/html' });
        await navigator.share({
          title: 'Transaction Reports',
          text: 'Transaction reports from VaultKe',
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    if (!Sharing.isAvailableAsync || !FileSystem.documentDirectory) {
      throw new Error('Sharing is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/html',
      dialogTitle: 'Share transaction reports',
      UTI: 'public.html',
    });

    return { success: true, fileName, uri };
  }, []);

  const buildReceiptHTML = useCallback((transaction) => {
    return generatePDFOptimizedReceiptHTML(
      transaction,
      selectedChama?.name || 'Chama',
      getMemberNameFromTransaction(transaction, chamaMembers),
      COMPANY_INFO
    );
  }, [selectedChama, chamaMembers]);

  const escapeReportHTML = useCallback((value) => {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }, []);

  const formatReportDate = useCallback((transaction) => {
    const dateValue = transaction.date || transaction.createdAt || transaction.created_at || transaction.timestamp;
    if (!dateValue) return 'N/A';

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Nairobi',
    });
  }, []);

  const formatReportAmount = useCallback((transaction, fractionDigits = 0) => {
    const type = (transaction.type || transaction.transaction_type || '').toLowerCase();
    const rawAmount = getReportValue(
      transaction.amount,
      transaction.transaction_amount,
      transaction.total_amount,
      transaction.metadata?.amount,
      transaction.metadata?.transaction_amount,
      transaction.metadata?.total_amount
    );
    const numericAmount = parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0;
    const sign = ['contribution', 'deposit', 'welfare_contribution'].includes(type) ? '+' : '-';
    const formattedAmount = new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: fractionDigits,
    }).format(Math.abs(numericAmount));

    return fractionDigits > 0 ? formattedAmount : `${sign} ${formattedAmount}`;
  }, [getReportValue]);

  const getReportNumericAmount = useCallback((transaction) => {
    const rawAmount = getReportValue(
      transaction.amount,
      transaction.transaction_amount,
      transaction.total_amount,
      transaction.metadata?.amount,
      transaction.metadata?.transaction_amount,
      transaction.metadata?.total_amount
    );

    return Math.abs(parseFloat(String(rawAmount).replace(/[KES,\s]/g, '')) || 0);
  }, [getReportValue]);

  const getReportNumericFees = useCallback((transaction) => {
    const rawFees = getReportValue(
      transaction.fees,
      transaction.transaction_fees,
      transaction.fee,
      transaction.metadata?.fees,
      transaction.metadata?.transaction_fees,
      transaction.metadata?.fee
    );

    return Math.abs(parseFloat(String(rawFees).replace(/[KES,\s]/g, '')) || 0);
  }, [getReportValue]);

  const isCompletedTransaction = useCallback((transaction) => {
    const status = String(transaction.status || '').toLowerCase();
    return ['completed', 'paid', 'success', 'successful', 'approved'].includes(status);
  }, []);

  const formatSummaryAmount = useCallback((amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2,
    }).format(amount);
  }, []);

  const formatReportType = useCallback((transaction) => {
    const type = transaction.type || transaction.transaction_type || 'Transaction';
    return String(type).replace(/_/g, ' ').toUpperCase();
  }, []);

  const getReportDescription = useCallback((transaction) => {
    return getReportValue(
      transaction.description,
      transaction.transaction_description,
      transaction.memo,
      transaction.purpose,
      `${transaction.type || transaction.transaction_type || 'Transaction'} transaction`
    );
  }, [getReportValue]);

  const buildCombinedReceiptsHTML = useCallback((receiptTransactions) => {
    const rows = receiptTransactions.map((transaction) => {
      return `
        <tr>
          <td>${escapeReportHTML(formatReportDate(transaction))}</td>
          <td>${escapeReportHTML(getMemberNameFromTransaction(transaction, chamaMembers))}</td>
          <td>${escapeReportHTML(getReportDescription(transaction))}</td>
          <td>${escapeReportHTML(formatReportType(transaction))}</td>
          <td style="text-align: right; font-weight: bold;">${escapeReportHTML(formatReportAmount(transaction, 2))}</td>
          <td style="text-align: right;">${escapeReportHTML(formatSummaryAmount(getReportNumericFees(transaction)))}</td>
          <td style="text-align: center;">${escapeReportHTML(transaction.status || 'completed')}</td>
          <td>${escapeReportHTML(transaction.reference || transaction.ref || transaction.transaction_id || transaction.id || 'N/A')}</td>
        </tr>
      `;
    }).join('');

    const completedTransactions = receiptTransactions.filter(isCompletedTransaction);
    const totalAmount = completedTransactions.reduce((sum, transaction) => sum + getReportNumericAmount(transaction), 0);
    const totalFees = completedTransactions.reduce((sum, transaction) => sum + getReportNumericFees(transaction), 0);
    const grandTotal = totalAmount + totalFees;

    const chamaName = selectedChama?.name || 'Chama';
    const generatedAt = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi',
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Transaction Report - ${escapeReportHTML(chamaName)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif !important; font-size: 9px !important; line-height: 1.2 !important; color: #000 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .container { width: 100% !important; }
            .report-title { text-align: center; font-size: 14px !important; font-weight: bold; margin: 15px 0 !important; text-transform: uppercase; letter-spacing: 1px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 15px !important; font-size: 8px !important; line-height: 1.1; }
            table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 15px !important; font-size: 9px !important; }
            th { background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 8px !important; }
            td { border: 1px solid #000 !important; padding: 6px 4px !important; font-size: 9px !important; vertical-align: top !important; }
            .footer { border-top: 2px solid #000 !important; padding-top: 10px !important; margin-top: 15px !important; text-align: center !important; font-size: 8px !important; line-height: 1.2; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div style="flex: 1;">
                  <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 2px;">${escapeReportHTML(COMPANY_INFO.name)}</div>
                  <div style="font-size: 12px; font-weight: bold; color: #000; margin-bottom: 4px;">${escapeReportHTML(chamaName)}</div>
                  <div style="font-size: 8px; color: #000; line-height: 1.1;">
                    ${escapeReportHTML(COMPANY_INFO.address)}<br>
                    Tel: ${escapeReportHTML(COMPANY_INFO.phone)} | Email: ${escapeReportHTML(COMPANY_INFO.email)}
                  </div>
                </div>
                <div style="text-align: right; font-size: 8px; color: #000; line-height: 1.1;">
                  Report No: BULK-${escapeReportHTML(new Date().toISOString().split('T')[0])}<br>
                  Generated: ${escapeReportHTML(generatedAt)}
                </div>
              </div>
              <div style="text-align: center; font-size: 14px; font-weight: bold; color: #000; margin: 15px 0; text-transform: uppercase; letter-spacing: 1px;">TRANSACTION RECEIPT</div>
              <div style="border-bottom: 2px solid #000; margin: 10px 0 15px 0;"></div>
            </div>
            <table border="1" cellpadding="6" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin-bottom: 15px !important; font-size: 9px !important;">
              <thead>
                <tr>
                  <th style="width: 12%;">DATE</th>
                  <th style="width: 14%;">NAME</th>
                  <th style="width: 20%;">DESCRIPTION</th>
                  <th style="width: 10%;">TYPE</th>
                  <th style="width: 12%;">AMOUNT</th>
                  <th style="width: 10%;">FEES</th>
                  <th style="width: 10%;">STATUS</th>
                  <th style="width: 12%;">REFERENCE</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <table border="1" cellpadding="6" cellspacing="0" style="width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; margin: 15px 0 !important; font-size: 8px !important;">
              <thead>
                <tr>
                  <th colspan="2" style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 7px !important;">SUMMARY</th>
                  <th style="background: #e8e8e8 !important; border: 1px solid #000 !important; padding: 6px 4px !important; text-align: center !important; font-weight: bold !important; text-transform: uppercase !important; font-size: 7px !important;">AMOUNT (KES)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="2" style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;">Total Transaction Amount</td>
                  <td style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;">${escapeReportHTML(formatSummaryAmount(totalAmount))}</td>
                </tr>
                <tr>
                  <td colspan="2" style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;">Total Transaction Fees</td>
                  <td style="border: 1px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;">${escapeReportHTML(formatSummaryAmount(totalFees))}</td>
                </tr>
                <tr style="background: #f0f0f0 !important; font-weight: bold !important;">
                  <td colspan="2" style="border: 1px solid #000 !important; border-top: 2px solid #000 !important; padding: 6px 4px !important; text-align: left !important; font-size: 8px !important;"><strong>GRAND TOTAL</strong></td>
                  <td style="border: 1px solid #000 !important; border-top: 2px solid #000 !important; padding: 6px 4px !important; text-align: right !important; font-weight: bold !important; font-size: 8px !important;"><strong>${escapeReportHTML(formatSummaryAmount(grandTotal))}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <div>This report was generated from VaultKe transaction records.</div>
              <div>Summary totals include completed transactions only.</div>
            </div>
          </div>
        </body>
      </html>
    `;
  }, [selectedChama, chamaMembers, escapeReportHTML, formatReportDate, getMemberNameFromTransaction, getReportDescription, formatReportType, formatReportAmount, formatSummaryAmount, getReportNumericFees, isCompletedTransaction, getReportNumericAmount, COMPANY_INFO]);

  const getBulkReceiptTransactions = useCallback(() => {
    return (transactions.length > 0 ? transactions : allRecords).filter(Boolean);
  }, [transactions, allRecords]);

  // The statement itself is rendered server-side as a table-based PDF (same
  // style as the loan report). "Print" and "Share" both fetch that PDF and hand
  // it to the OS print / share sheet.
  const downloadStatementPdf = useCallback(async (dialogTitle) => {
    const scope = canViewGroup && viewMode === 'group' ? 'group' : 'personal';
    return downloadBackendPdf({
      path: `/chamas/${chamaId}/transactions/report?scope=${scope}`,
      fileName: `VaultKe_Transactions_${scope}_${new Date().toISOString().split('T')[0]}.pdf`,
      dialogTitle,
    });
  }, [chamaId, canViewGroup, viewMode]);

  const handleBulkPrintReceipts = useCallback(async () => {
    if (getBulkReceiptTransactions().length === 0) {
      Alert.alert('No Data', 'No transactions found to include in the statement.', [{ text: 'OK' }]);
      return;
    }
    setExportLoading(true);
    try {
      await downloadStatementPdf('Transactions statement');
    } catch (error) {
      console.error('Bulk statement error:', error);
      Alert.alert('Failed', error.message || 'Failed to generate the transactions statement.', [{ text: 'OK' }]);
    } finally {
      setExportLoading(false);
    }
  }, [getBulkReceiptTransactions, downloadStatementPdf, setExportLoading]);

  const handleBulkShareReceipts = useCallback(async () => {
    if (getBulkReceiptTransactions().length === 0) {
      Alert.alert('No Data', 'No transactions found to include in the statement.', [{ text: 'OK' }]);
      return;
    }
    setExportLoading(true);
    try {
      await downloadStatementPdf('Share transactions statement');
    } catch (error) {
      console.error('Bulk share error:', error);
      Alert.alert('Failed', error.message || 'Failed to generate the transactions statement.', [{ text: 'OK' }]);
    } finally {
      setExportLoading(false);
    }
  }, [getBulkReceiptTransactions, downloadStatementPdf, setExportLoading]);

  const handleIndividualReceipt = useCallback(async (transaction) => {
    // A welfare *request* or a loan record is not a payment — there is no
    // receipt for it (only its contributions / repayments have one).
    const kind = String(transaction?.transaction_type || transaction?.type || '').toLowerCase();
    if (kind === 'welfare' || kind === 'loan') {
      Alert.alert('No receipt', 'This is a request/record, not a payment. Receipts are available for contributions and repayments.', [{ text: 'OK' }]);
      return;
    }
    // Prefer the linked ledger transaction id when the row carries one.
    const txnId = transaction?.transaction_id || transaction?.transactionId || transaction?.id;
    if (!txnId) {
      Alert.alert('Receipt unavailable', 'This record has no transaction reference yet.', [{ text: 'OK' }]);
      return;
    }
    try {
      setExportLoading(true);
      await downloadTransactionReceiptPdf(txnId);
    } catch (error) {
      console.error('Individual receipt error:', error);
      Alert.alert('Receipt Failed', error.message || 'Failed to generate the transaction receipt.', [{ text: 'OK' }]);
    } finally {
      setExportLoading(false);
    }
  }, [setExportLoading]);

  return {
    handleIndividualReceipt,
    handleBulkPrintReceipts,
    handleBulkShareReceipts,
    getReceiptId,
    getReceiptFileName,
    getReceiptBodyHTML,
    buildReceiptHTML,
    buildCombinedReceiptsHTML,
    printReceiptHTML,
    shareReceiptHTML,
    formatReportDate,
    formatReportAmount,
    formatSummaryAmount,
    formatReportType,
    getReportDescription,
    getReportValue,
    getReportNumericAmount,
    getReportNumericFees,
    isCompletedTransaction,
    escapeReportHTML,
  };
};

export default useChamaTransactionReceipts;
