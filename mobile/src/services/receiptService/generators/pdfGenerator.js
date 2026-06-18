import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform, Alert } from 'react-native';
import { generatePDFOptimizedReceiptHTML, generateReceiptJSON } from '../html/template';
import { getMemberNameFromTransaction } from '../memberName';
import { COMPANY_INFO } from '../config';

export const generatePDFReceipt = async (transaction, userInfo = {}, chamaMembers = [], options = {}) => {
  try {
    if (!transaction || !transaction.id) {
      throw new Error('Invalid transaction data provided');
    }

    const chamaName = options.chamaName || userInfo.chamaName ||
                     (userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama');

    const performedBy = getMemberNameFromTransaction(transaction, chamaMembers, userInfo);
    const html = generatePDFOptimizedReceiptHTML(transaction, chamaName, performedBy, COMPANY_INFO);

    const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
    const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.pdf`;

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        return generateWebDownload(html, `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`, 'text/html');
      }

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

    if (!Print || !Print.printToFileAsync) {
      throw new Error('PDF generation not available on this platform');
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 612,
      height: 792,
    });

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
    return {
      success: false,
      error: error.message
    };
  }
};

export const generateHTMLReceipt = async (transaction, userInfo = {}) => {
  try {
    if (!transaction || !transaction.id) {
      throw new Error('Invalid transaction data provided');
    }

    const chamaName = userInfo?.isPersonalTransaction ? 'Transactions' : 'Chama';
    const performedBy = getMemberNameFromTransaction(transaction, [], userInfo);
    const html = generatePDFOptimizedReceiptHTML(transaction, chamaName, performedBy, COMPANY_INFO);

    const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
    const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;

    if (Platform.OS === 'web') {
      return generateWebDownload(html, fileName, 'text/html');
    }

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
    return {
      success: false,
      error: error.message
    };
  }
};

export const generateJSONReceipt = async (transaction, userInfo = {}) => {
  try {
    if (!transaction || !transaction.id) {
      throw new Error('Invalid transaction data provided');
    }

    const jsonData = generateReceiptJSON(transaction, COMPANY_INFO, userInfo);
    const receiptId = `RCP-${transaction.id.substring(0, 8).toUpperCase()}`;
    const fileName = `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.json`;
    const jsonString = JSON.stringify(jsonData, null, 2);

    if (Platform.OS === 'web') {
      return generateWebDownload(jsonString, fileName, 'application/json');
    }

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
    return {
      success: false,
      error: error.message
    };
  }
};

export const generateWebDownload = (content, fileName, mimeType) => {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    return {
      success: true,
      uri: url,
      fileName,
      message: `${fileName} has been downloaded to your Downloads folder.`,
      receiptId: fileName.split('_')[2]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const getMimeType = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf': return 'application/pdf';
    case 'html': return 'text/html';
    case 'json': return 'application/json';
    case 'csv': return 'text/csv';
    default: return 'application/octet-stream';
  }
};

export const getUTI = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  switch (extension) {
    case 'pdf': return 'com.adobe.pdf';
    case 'html': return 'public.html';
    case 'json': return 'public.json';
    case 'csv': return 'public.plain-text';
    default: return 'public.data';
  }
};